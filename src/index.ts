// Carregar variáveis de ambiente
import * as dotenv from 'dotenv';
dotenv.config();

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto,
} from 'whaileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

// Diretório para salvar a autenticação
const authDir = path.join(__dirname, '../auth');

// Diretório para salvar histórico de chat do Gemini
const chatHistoryDir = path.join(__dirname, '../chat_history');

// Função para garantir que o diretório existe
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

if (!fs.existsSync(chatHistoryDir)) {
  fs.mkdirSync(chatHistoryDir, { recursive: true });
}

// Variável para armazenar o socket
let sock: WASocket | null = null;

// Funções para gerenciar histórico de chat do Gemini
function getChatHistoryFile(remoteJid: string): string {
  // Criar nome de arquivo seguro a partir do remoteJid
  const safeFileName = remoteJid.replace(/[@:]/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  return path.join(chatHistoryDir, `${safeFileName}.json`);
}

function loadChatHistory(remoteJid: string): any[] {
  const historyFile = getChatHistoryFile(remoteJid);
  if (fs.existsSync(historyFile)) {
    try {
      const data = fs.readFileSync(historyFile, 'utf-8');
      const history = JSON.parse(data);
      // Retornar histórico sem conversão - a conversão será feita conforme o provider usado
      return Array.isArray(history) ? history : [];
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      return [];
    }
  }
  return [];
}

function saveChatHistory(remoteJid: string, history: any[]): void {
  const historyFile = getChatHistoryFile(remoteJid);
  try {
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), 'utf-8');
  } catch (error) {
    console.error('Erro ao salvar histórico:', error);
  }
}

// Função auxiliar para aguardar um tempo
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Função para converter histórico do formato Gemini para OpenAI
function convertHistoryForOpenAI(history: any[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return history.map((item: any) => {
    if (item.role === 'model') {
      return { role: 'assistant', content: item.parts?.[0]?.text || '' };
    }
    return { role: item.role as 'user' | 'assistant', content: item.parts?.[0]?.text || '' };
  });
}

// Função para processar mensagem com ChatGPT
async function processWithChatGPT(textMessage: string, remoteJid: string, retryCount: number = 0): Promise<string | null> {
  if (!CHATGPT_ENABLED || !openaiClient) {
    return null;
  }

  const maxRetries = 2;
  
  try {
    // Carregar histórico de chat
    let chatHistory = loadChatHistory(remoteJid);
    
    // Converter histórico para formato OpenAI se necessário
    let openaiHistory: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    if (chatHistory.length > 0) {
      // Verificar se está no formato Gemini (tem 'parts' ou role 'model')
      const isGeminiFormat = chatHistory[0].parts || 
                             chatHistory.some((item: any) => item.role === 'model');
      
      if (isGeminiFormat) {
        // Formato Gemini, converter para OpenAI
        openaiHistory = convertHistoryForOpenAI(chatHistory);
      } else {
        // Já está no formato OpenAI, mas garantir que não há roles 'model'
        openaiHistory = chatHistory.map((item: any) => {
          if (item.role === 'model') {
            return { ...item, role: 'assistant' };
          }
          return item;
        }) as OpenAI.Chat.Completions.ChatCompletionMessageParam[];
      }
    }

    // Adicionar mensagem do usuário ao histórico
    openaiHistory.push({
      role: 'user',
      content: textMessage
    });

    // Limitar histórico a últimas 20 mensagens para evitar tokens excessivos
    if (openaiHistory.length > 20) {
      openaiHistory = openaiHistory.slice(-20);
    }

    // Gerar resposta com ChatGPT
    // Modelos mais recentes (gpt-4+, gpt-5, o1) usam max_completion_tokens
    // Modelos mais antigos (gpt-3.5-turbo) usam max_tokens
    // Alguns modelos (gpt-5, o1) não suportam temperature customizado
    const modelVersionMatch = CHATGPT_MODEL.match(/gpt-(\d+)/);
    const modelVersion = modelVersionMatch ? parseInt(modelVersionMatch[1]) : 0;
    const isNewModel = modelVersion >= 4 || CHATGPT_MODEL.includes('o1');
    const isRestrictedModel = modelVersion >= 5 || CHATGPT_MODEL.includes('o1');
    
    const completionParams: any = {
      model: CHATGPT_MODEL,
      messages: openaiHistory,
    };
    
    // Apenas adicionar temperature se o modelo suportar valores customizados
    if (!isRestrictedModel) {
      completionParams.temperature = 0.7;
    }
    
    if (isNewModel) {
      completionParams.max_completion_tokens = 2000;
    } else {
      completionParams.max_tokens = 2000;
    }
    
    const completion = await openaiClient.chat.completions.create(completionParams);

    const responseText = completion.choices[0]?.message?.content;

    if (responseText) {
      // Adicionar resposta do modelo ao histórico
      openaiHistory.push({
        role: 'assistant',
        content: responseText
      });

      // Salvar histórico atualizado
      saveChatHistory(remoteJid, openaiHistory);

      return responseText;
    }

    return null;
  } catch (error: any) {
    // Tratar erro 429 (quota excedida)
    if (error.status === 429) {
      const retryAfter = error.headers?.['retry-after'] 
        ? parseInt(error.headers['retry-after']) * 1000 
        : 30000; // 30 segundos padrão
      
      if (retryCount < maxRetries) {
        console.log(`⏳ Quota excedida. Aguardando ${retryAfter / 1000}s antes de tentar novamente... (tentativa ${retryCount + 1}/${maxRetries})`);
        await wait(retryAfter);
        return processWithChatGPT(textMessage, remoteJid, retryCount + 1);
      } else {
        console.error('❌ Erro ao processar com ChatGPT: Quota excedida após múltiplas tentativas');
        return `Desculpe, atingi o limite de requisições do modelo ${CHATGPT_MODEL}. Por favor, tente novamente em alguns minutos.`;
      }
    }
    
    // Tratar outros erros
    console.error('❌ Erro ao processar com ChatGPT:', error.message || error);
    
    // Mensagem amigável para erros conhecidos
    if (error.message?.includes('quota') || error.message?.includes('Quota') || error.message?.includes('rate_limit')) {
      return `Desculpe, o modelo ${CHATGPT_MODEL} não está disponível no seu plano atual ou a quota foi excedida. Tente novamente mais tarde.`;
    }
    
    if (error.status === 404) {
      return `Desculpe, o modelo ${CHATGPT_MODEL} não foi encontrado ou não está disponível. Verifique se o nome do modelo está correto.`;
    }
    
    if (error.status === 401) {
      return `Desculpe, a API key do ChatGPT está inválida. Verifique a configuração no arquivo .env.`;
    }
    
    return null;
  }
}

// Função para processar mensagem com Gemini
async function processWithGemini(textMessage: string, remoteJid: string, retryCount: number = 0): Promise<string | null> {
  if (!GEMINI_ENABLED || !geminiModel) {
    return null;
  }

  const maxRetries = 2;
  
  try {
    // Carregar histórico de chat
    let chatHistory = loadChatHistory(remoteJid);
    
    // Converter histórico para formato Gemini se necessário
    // Se o histórico está no formato OpenAI (sem 'parts' ou com 'assistant'), converter
    if (chatHistory.length > 0 && !chatHistory[0].parts) {
      // Está no formato OpenAI, converter para Gemini
      chatHistory = chatHistory.map((item: any) => {
        const content = typeof item.content === 'string' ? item.content : '';
        if (item.role === 'assistant') {
          return { role: 'model', parts: [{ text: content }] };
        }
        return { role: item.role, parts: [{ text: content }] };
      });
    } else if (chatHistory.length > 0 && chatHistory.some((item: any) => item.role === 'assistant')) {
      // Tem alguns itens no formato OpenAI, converter todos
      chatHistory = chatHistory.map((item: any) => {
        if (item.role === 'assistant') {
          const content = typeof item.content === 'string' ? item.content : '';
          return { role: 'model', parts: [{ text: content }] };
        }
        // Se já tem parts, manter como está
        if (item.parts) {
          return item;
        }
        // Se não tem parts mas tem content, converter
        const content = typeof item.content === 'string' ? item.content : '';
        return { role: item.role, parts: [{ text: content }] };
      });
    }

    // Adicionar mensagem do usuário ao histórico
    chatHistory.push({
      role: 'user',
      parts: [{ text: textMessage }]
    });

    // Limitar histórico a últimas 20 mensagens para evitar tokens excessivos
    if (chatHistory.length > 20) {
      chatHistory = chatHistory.slice(-20);
    }

    // Gerar resposta com Gemini
    const result = await geminiModel.generateContent({
      contents: chatHistory,
      generationConfig: {
        maxOutputTokens: 2000,
        temperature: 0.7,
      }
    });

    const response = result.response;
    const responseText = response.text();

    if (responseText) {
      // Adicionar resposta do modelo ao histórico
      chatHistory.push({
        role: 'model',
        parts: [{ text: responseText }]
      });

      // Salvar histórico atualizado
      saveChatHistory(remoteJid, chatHistory);

      return responseText;
    }

    return null;
  } catch (error: any) {
    // Tratar erro 429 (quota excedida)
    if (error.status === 429) {
      const retryDelay = error.errorDetails?.[2]?.retryDelay 
        ? parseInt(error.errorDetails[2].retryDelay.replace('s', '')) * 1000 
        : 30000; // 30 segundos padrão
      
      if (retryCount < maxRetries) {
        console.log(`⏳ Quota excedida. Aguardando ${retryDelay / 1000}s antes de tentar novamente... (tentativa ${retryCount + 1}/${maxRetries})`);
        await wait(retryDelay);
        return processWithGemini(textMessage, remoteJid, retryCount + 1);
      } else {
        console.error('❌ Erro ao processar com Gemini: Quota excedida após múltiplas tentativas');
        // Retornar mensagem amigável para o usuário
        return `Desculpe, atingi o limite de requisições do modelo ${GEMINI_MODEL}. Por favor, tente novamente em alguns minutos ou configure um modelo diferente no arquivo .env (ex: gemini-1.5-flash ou gemini-2.0-flash-exp).`;
      }
    }
    
    // Tratar outros erros
    console.error('❌ Erro ao processar com Gemini:', error.message || error);
    
    // Mensagem amigável para erros conhecidos
    if (error.message?.includes('quota') || error.message?.includes('Quota')) {
      return `Desculpe, o modelo ${GEMINI_MODEL} não está disponível no seu plano atual. Tente usar um modelo compatível com o plano gratuito como 'gemini-1.5-flash' ou 'gemini-2.0-flash-exp'.`;
    }
    
    if (error.status === 404) {
      return `Desculpe, o modelo ${GEMINI_MODEL} não foi encontrado ou não está disponível. Verifique se o nome do modelo está correto.`;
    }
    
    return null;
  }
}

// Configuração do Gemini
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const GEMINI_ENABLED = GEMINI_API_KEY !== '';

// Configuração do ChatGPT
const CHATGPT_API_KEY = process.env.CHATGPT_API_KEY || '';
const CHATGPT_MODEL = process.env.CHATGPT_MODEL || 'gpt-3.5-turbo';
const CHATGPT_ENABLED = CHATGPT_API_KEY !== '';

// Escolher qual provider usar (gemini ou chatgpt)
const AI_PROVIDER = (process.env.AI_PROVIDER || 'gemini').toLowerCase();

// Inicializar Gemini se a API key estiver configurada
let genAI: GoogleGenerativeAI | null = null;
let geminiModel: any = null;

if (GEMINI_ENABLED) {
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    geminiModel = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    console.log('✅ Gemini AI inicializado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao inicializar Gemini:', error);
  }
} else {
  console.log('⚠️  Gemini AI não configurado. Configure GEMINI_API_KEY para habilitar.');
}

// Inicializar ChatGPT se a API key estiver configurada
let openaiClient: OpenAI | null = null;

if (CHATGPT_ENABLED) {
  try {
    openaiClient = new OpenAI({ apiKey: CHATGPT_API_KEY });
    console.log('✅ ChatGPT inicializado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao inicializar ChatGPT:', error);
  }
} else {
  console.log('⚠️  ChatGPT não configurado. Configure CHATGPT_API_KEY para habilitar.');
}

// Verificar qual provider está ativo
const AI_ENABLED = (AI_PROVIDER === 'gemini' && GEMINI_ENABLED) || (AI_PROVIDER === 'chatgpt' && CHATGPT_ENABLED);

// Função para processar mensagens recebidas
async function handleMessage(msg: proto.IWebMessageInfo) {
  if (!msg.message || !msg.key.remoteJid) return;

  // Ignorar mensagens de grupos (opcional - remova se quiser responder em grupos)
  if (msg.key.remoteJid.includes('@g.us')) {
    // Se quiser responder em grupos, comente as próximas 2 linhas
    // return;
  }

  // Obter o texto da mensagem
  const message = msg.message;
  let textMessage = '';
  
  if (message.conversation) {
    textMessage = message.conversation;
  } else if (message.extendedTextMessage?.text) {
    textMessage = message.extendedTextMessage.text;
  } else if (message.imageMessage?.caption) {
    textMessage = message.imageMessage.caption;
  } else if (message.videoMessage?.caption) {
    textMessage = message.videoMessage.caption;
  }

  // Remover espaços e converter para minúsculas para comparação
  const command = textMessage.trim().toLowerCase();

  if (!sock) {
    console.log('Socket não está conectado');
    return;
  }

  try {
    // Ignorar mensagens enviadas pelo próprio bot
    if (msg.key.fromMe) return;

    // Log de debug para mensagens recebidas
    const providerName = AI_PROVIDER === 'chatgpt' ? 'ChatGPT' : 'Gemini';
    console.log(`📨 Mensagem recebida: "${textMessage}" | Provider: ${providerName} | Habilitado: ${AI_ENABLED}`);

    // Comando !list - Enviar mensagem com lista (sections)
    if (command === '!list') {
      const sections = [
        {
          title: 'Seção 1',
          rows: [
            {
              rowId: 'option1',
              title: 'Opção 1',
              description: 'Descrição da opção 1',
            },
            {
              rowId: 'option2',
              title: 'Opção 2',
              description: 'Descrição da opção 2',
            },
          ],
        },
        {
          title: 'Seção 2',
          rows: [
            {
              rowId: 'option3',
              title: 'Opção 3',
              description: 'Descrição da opção 3',
            },
          ],
        },
      ];

      await sock.sendMessage(msg.key.remoteJid, {
        text: 'Escolha uma opção',
        footer: 'Rodapé da mensagem',
        title: 'Título da Lista',
        buttonText: 'Clique aqui',
        sections,
      });

      console.log('✅ Mensagem de lista enviada!');
      return;
    }

    // Comando !button - Enviar mensagem com botões
    if (command === '!button') {
      const buttons = [
        { buttonId: 'id1', buttonText: { displayText: 'Botão 1' }, type: 1 },
        { buttonId: 'id2', buttonText: { displayText: 'Botão 2' }, type: 1 },
        { buttonId: 'id3', buttonText: { displayText: 'Botão 3' }, type: 1 },
      ];

      await sock.sendMessage(msg.key.remoteJid, {
        text: 'Escolha um botão',
        footer: 'Rodapé',
        buttons,
      });

      console.log('✅ Mensagem com botões enviada!');
      return;
    }

    // Comando !buttonimg - Enviar mensagem com botões e imagem (bônus)
    if (command === '!buttonimg') {
      const buttons = [
        { buttonId: 'id1', buttonText: { displayText: 'Button 1' }, type: 1 },
        { buttonId: 'id2', buttonText: { displayText: 'Button 2' }, type: 1 },
        { buttonId: 'id3', buttonText: { displayText: 'Button 3' }, type: 1 },
      ];

      const buttonMessage = {
        image: {
          url: 'https://fastly.picsum.photos/id/534/536/354.jpg?hmac=tab6Z5S4lvYxZsVcDIxELokB38Smjq75X4XQxpRBgg0',
        },
        caption: "Hi it's button message",
        footer: 'Hello World',
        buttons: buttons,
        headerType: 4,
      };

      await sock.sendMessage(msg.key.remoteJid, buttonMessage);

      console.log('✅ Mensagem com botões e imagem enviada!');
      return;
    }

    // Comando !clearchat - Limpar histórico de chat
    if (command === '!clearchat') {
      const historyFile = getChatHistoryFile(msg.key.remoteJid);
      if (fs.existsSync(historyFile)) {
        fs.unlinkSync(historyFile);
        await sock.sendMessage(msg.key.remoteJid, {
          text: '✅ Histórico de chat limpo com sucesso!'
        });
        console.log('✅ Histórico de chat limpo!');
      } else {
        await sock.sendMessage(msg.key.remoteJid, {
          text: 'ℹ️ Não há histórico de chat para limpar.'
        });
      }
      return;
    }

    // Resposta automática com IA (apenas se houver texto na mensagem e IA estiver habilitada)
    if (AI_ENABLED && textMessage.trim() !== '') {
      console.log(`🤖 Processando mensagem com ${providerName}...`);
      // Mostrar indicador de digitação
      try {
        await sock.sendPresenceUpdate('composing', msg.key.remoteJid);
      } catch (error) {
        console.log('⚠️  Erro ao enviar presence update (pode ser normal):', error);
      }

      // Processar mensagem com o provider selecionado
      let aiResponse: string | null = null;
      if (AI_PROVIDER === 'chatgpt') {
        aiResponse = await processWithChatGPT(textMessage, msg.key.remoteJid);
      } else {
        aiResponse = await processWithGemini(textMessage, msg.key.remoteJid);
      }

      if (aiResponse) {
        await sock.sendMessage(msg.key.remoteJid, {
          text: aiResponse
        });
        // Verificar se é uma mensagem de erro (começa com "Desculpe")
        if (aiResponse.startsWith('Desculpe')) {
          console.log('⚠️  Mensagem de erro/enquota enviada ao usuário');
        } else {
          console.log(`✅ Resposta do ${providerName} enviada!`);
        }
      } else {
        await sock.sendMessage(msg.key.remoteJid, {
          text: 'Desculpe, não consegui processar sua mensagem no momento. Tente novamente mais tarde.'
        });
        console.log(`⚠️  ${providerName} não retornou resposta`);
      }

      // Parar indicador de digitação
      try {
        await sock.sendPresenceUpdate('paused', msg.key.remoteJid);
      } catch (error) {
        // Ignorar erro de presence update
      }
    } else if (!AI_ENABLED && textMessage.trim() !== '') {
      const providerConfig = AI_PROVIDER === 'chatgpt' 
        ? 'CHATGPT_API_KEY' 
        : 'GEMINI_API_KEY';
      console.log(`ℹ️  Mensagem recebida mas ${providerName} não está configurado. Configure ${providerConfig} no arquivo .env`);
    }
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error);
  }
}

// Função para inicializar o socket
async function startSocket() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }) as any,
      printQRInTerminal: false,
      browser: ['WhatsApp Bot', 'Chrome', '1.0.0'],
    });

    // Salvar credenciais quando atualizadas
    sock.ev.on('creds.update', saveCreds);

    // Escutar atualizações de conexão
    sock.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        // Limpar a tela e mostrar QR Code
        console.clear();
        console.log('\n════════════════════════════════════════');
        console.log('📱 ESCANEIE O QR CODE ABAIXO');
        console.log('   Abra o WhatsApp > Configurações >');
        console.log('   Aparelhos vinculados > Conectar');
        console.log('════════════════════════════════════════\n');
        // Usar tamanho pequeno para melhor leitura
        qrcode.generate(qr, { small: true });
        console.log('\n════════════════════════════════════════');
        console.log('⏳ Aguardando leitura do QR Code...\n');
      }

      if (connection === 'close') {
        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !==
          DisconnectReason.loggedOut;

        console.log(
          'Conexão fechada devido a:',
          lastDisconnect?.error,
          ', reconectando:',
          shouldReconnect
        );

        if (shouldReconnect) {
          startSocket();
        }
      } else if (connection === 'open') {
        console.clear();
        console.log('\n════════════════════════════════════════');
        console.log('✅ BOT CONECTADO AO WHATSAPP COM SUCESSO!');
        console.log('════════════════════════════════════════');
        console.log('\n📋 Comandos disponíveis:');
        console.log('   • !list      - Envia lista interativa');
        console.log('   • !button    - Envia botões interativos');
        console.log('   • !buttonimg - Envia botões com imagem');
        console.log('   • !clearchat - Limpa histórico de chat');
        console.log('\n🤖 Status da IA:');
        console.log(`   Provider selecionado: ${AI_PROVIDER.toUpperCase()}`);
        console.log('\n   📊 Gemini AI:');
        if (GEMINI_ENABLED) {
          console.log(`   ✅ HABILITADO (Modelo: ${GEMINI_MODEL})`);
        } else {
          console.log('   ❌ DESABILITADO');
          console.log('   📝 Para habilitar: Configure GEMINI_API_KEY no .env');
          console.log('   🔗 Obtenha sua API key em: https://makersuite.google.com/app/apikey');
        }
        console.log('\n   📊 ChatGPT:');
        if (CHATGPT_ENABLED) {
          console.log(`   ✅ HABILITADO (Modelo: ${CHATGPT_MODEL})`);
        } else {
          console.log('   ❌ DESABILITADO');
          console.log('   📝 Para habilitar: Configure CHATGPT_API_KEY no .env');
          console.log('   🔗 Obtenha sua API key em: https://platform.openai.com/api-keys');
        }
        if (AI_ENABLED) {
          console.log(`\n   ✅ IA ATIVA - O bot responderá automaticamente usando ${AI_PROVIDER.toUpperCase()}`);
        } else {
          console.log('\n   ⚠️  NENHUMA IA HABILITADA');
          console.log('   📝 Configure pelo menos uma API key no arquivo .env');
          console.log('   📝 Use AI_PROVIDER=gemini ou AI_PROVIDER=chatgpt para escolher');
        }
        console.log('\n💬 Aguardando mensagens...\n');
      }
    });

    // Escutar mensagens recebidas
    sock.ev.on('messages.upsert', async ({ messages, type }: { messages: proto.IWebMessageInfo[], type: string }) => {
      if (type === 'notify') {
        for (const msg of messages) {
          await handleMessage(msg);
        }
      }
    });

    // Escutar interações com botões/listas
    sock.ev.on('messages.update', async (updates: any[]) => {
      for (const update of updates) {
        if (update.update.pollUpdates) {
          // Handle poll updates if needed
        }
      }
    });

    console.log('🚀 Bot iniciado, aguardando conexão...');
  } catch (error) {
    console.error('❌ Erro ao iniciar o bot:', error);
    process.exit(1);
  }
}

// Iniciar o bot
startSocket();

// Manter o processo rodando
process.on('SIGINT', () => {
  console.log('\n👋 Encerrando o bot...');
  process.exit(0);
});

