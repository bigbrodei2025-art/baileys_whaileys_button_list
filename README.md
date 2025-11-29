# Bot WhatsApp - Listas e Botões

Bot WhatsApp criado com **whaileys** (baseado em Baileys) que responde aos comandos `!list` e `!button` enviando mensagens interativas.

## 🚀 Funcionalidades

- ✅ Conexão automática com WhatsApp via QR Code
- ✅ Envio de mensagens com **listas interativas** (sections)
- ✅ Envio de mensagens com **botões interativos**
- ✅ Envio de mensagens com **botões e imagem** (bônus)
- ✅ **Respostas automáticas com Google Gemini AI** 🤖
- ✅ Histórico de conversa persistente por contato

## 📋 Pré-requisitos

- Node.js 16+ instalado
- npm ou yarn
- WhatsApp instalado no celular (para escanear o QR Code)

## 🔧 Instalação

1. Clone ou baixe este repositório
2. Instale as dependências:

```bash
npm install
```

3. **Configurar Gemini AI (Opcional mas recomendado):**

   Crie um arquivo `.env` na raiz do projeto com:
   
   ```env
   GEMINI_API_KEY=sua_api_key_aqui
   GEMINI_MODEL=gemini-2.0-flash
   ```
   
   Para obter uma API key do Gemini:
   - Acesse [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Crie uma nova API key
   - Cole a chave no arquivo `.env`
   
   **Nota:** Se você não configurar o Gemini, o bot ainda funcionará, mas apenas responderá aos comandos específicos (`!list`, `!button`, etc.)

## 🎯 Como Usar

1. Inicie o bot:

```bash
npm run dev
```

ou para produção:

```bash
npm run build
npm start
```

2. **Escaneie o QR Code** que aparecerá no terminal com seu WhatsApp:
   - Abra o WhatsApp no celular
   - Vá em **Dispositivos conectados** ou **Aparelhos vinculados**
   - Toque em **Conectar um aparelho**
   - Escaneie o QR Code exibido no terminal

3. Aguarde a mensagem: `✅ Bot conectado ao WhatsApp com sucesso!`

4. **Envie comandos** para o bot:
   - `!list` - Receberá uma mensagem com lista interativa
   - `!button` - Receberá uma mensagem com botões
   - `!buttonimg` - Receberá uma mensagem com botões e imagem (bônus)
   - `!clearchat` - Limpa o histórico de chat do Gemini para o contato atual
   
   **Com Gemini habilitado:** O bot responderá automaticamente a qualquer mensagem de texto usando IA, mantendo contexto da conversa!

## 📱 Comandos Disponíveis

| Comando | Descrição |
|---------|-----------|
| `!list` | Envia uma mensagem com lista interativa (sections) |
| `!button` | Envia uma mensagem com botões interativos |
| `!buttonimg` | Envia uma mensagem com botões e imagem |
| `!clearchat` | Limpa o histórico de chat do Gemini para o contato atual |

**🤖 Respostas Automáticas com Gemini:**
- Quando o Gemini está habilitado, o bot responde automaticamente a qualquer mensagem de texto
- O bot mantém contexto da conversa usando histórico persistente
- Cada contato tem seu próprio histórico de conversa

## 📁 Estrutura do Projeto

```
botao/
├── src/
│   └── index.ts       # Código principal do bot
├── dist/              # Código compilado (gerado automaticamente)
├── auth/              # Credenciais de autenticação (gerado automaticamente)
├── chat_history/      # Histórico de chat do Gemini (gerado automaticamente)
├── .env               # Configurações (criar manualmente)
├── package.json
├── tsconfig.json
└── README.md
```

## ⚙️ Configuração

### Autenticação WhatsApp
O bot salva as credenciais de autenticação na pasta `auth/`. Após a primeira conexão, você não precisará escanear o QR Code novamente (a menos que deslogue manualmente).

### Google Gemini AI
Para habilitar respostas automáticas com IA:

1. Crie um arquivo `.env` na raiz do projeto
2. Adicione sua API key do Gemini:
   ```env
   GEMINI_API_KEY=sua_api_key_aqui
   GEMINI_MODEL=gemini-1.5-flash
   ```
3. Reinicie o bot

**Variáveis de ambiente disponíveis:**
- `GEMINI_API_KEY` (obrigatório para habilitar Gemini) - Sua chave de API do Google Gemini
- `GEMINI_MODEL` (opcional) - Modelo do Gemini a usar (padrão: `gemini-1.5-flash`)
  
  **Modelos disponíveis (Plano Gratuito):**
  - `gemini-1.5-flash` ⚡ - Rápido e eficiente (padrão recomendado)
  - `gemini-1.5-pro` 🚀 - Mais poderoso para tarefas complexas
  - `gemini-2.0-flash-exp` 🆕 - Versão experimental mais recente
  
  **Modelos Premium (requerem plano pago):**
  - `gemini-2.5-flash` - Disponível em alguns planos
  - `gemini-3-pro-preview` - Requer plano pago (não disponível no free tier)
  
  **⚠️ Nota:** Alguns modelos como `gemini-3-pro-preview` não estão disponíveis no plano gratuito e retornarão erro de quota. Use modelos compatíveis com free tier para evitar problemas.

**Histórico de Chat:**
- O histórico de conversa é salvo na pasta `chat_history/`
- Cada contato tem seu próprio arquivo de histórico
- Use `!clearchat` para limpar o histórico de um contato específico

## 📝 Exemplos de Uso

### Lista Interativa (!list)

Quando você enviar `!list`, receberá uma mensagem como:

```
Título da Lista
Escolha uma opção
[Botão: Clique aqui]

Seção 1
  • Opção 1 - Descrição da opção 1
  • Opção 2 - Descrição da opção 2

Seção 2
  • Opção 3 - Descrição da opção 3
```

### Botões Interativos (!button)

Quando você enviar `!button`, receberá uma mensagem com botões clicáveis:

```
Escolha um botão
[Botão 1] [Botão 2] [Botão 3]
```

## 🔒 Segurança

- **NÃO compartilhe** a pasta `auth/` - ela contém suas credenciais de autenticação
- Adicione `auth/` ao `.gitignore` (já incluído)

## 🐛 Troubleshooting

### Bot não conecta
- Certifique-se de que o QR Code foi escaneado corretamente
- Delete a pasta `auth/` e tente novamente

### Mensagens não são enviadas
- Verifique se você está enviando os comandos exatamente como: `!list`, `!button`, `!buttonimg`
- Os comandos são case-insensitive, mas devem começar com `!`

### Erro de dependências
- Execute `npm install` novamente
- Certifique-se de ter Node.js 16+ instalado

## 📚 Referências

- [Whaileys GitHub](https://github.com/canove/whaileys) - Biblioteca usada no projeto
- [Whaileys Pull Request #36](https://github.com/canove/whaileys/pull/36) - Suporte para listas e botões
- [Baileys GitHub](https://github.com/WhiskeySockets/Baileys) - Biblioteca base

## 📄 Licença

MIT

## 🤝 Contribuições

Sinta-se à vontade para contribuir com melhorias!

