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

// Diretório para salvar a autenticação
const authDir = path.join(__dirname, '../auth');

// Função para garantir que o diretório existe
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

// Variável para armazenar o socket
let sock: WASocket | null = null;

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
        console.log('   • !buttonimg  - Envia botões com imagem');
        console.log('\n💬 Aguardando comandos...\n');
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

