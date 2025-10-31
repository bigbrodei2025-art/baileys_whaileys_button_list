# Bot WhatsApp - Listas e Botões

Bot WhatsApp criado com **whaileys** (baseado em Baileys) que responde aos comandos `!list` e `!button` enviando mensagens interativas.

## 🚀 Funcionalidades

- ✅ Conexão automática com WhatsApp via QR Code
- ✅ Envio de mensagens com **listas interativas** (sections)
- ✅ Envio de mensagens com **botões interativos**
- ✅ Envio de mensagens com **botões e imagem** (bônus)

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

## 📱 Comandos Disponíveis

| Comando | Descrição |
|---------|-----------|
| `!list` | Envia uma mensagem com lista interativa (sections) |
| `!button` | Envia uma mensagem com botões interativos |
| `!buttonimg` | Envia uma mensagem com botões e imagem |

## 📁 Estrutura do Projeto

```
botao/
├── src/
│   └── index.ts       # Código principal do bot
├── dist/              # Código compilado (gerado automaticamente)
├── auth/              # Credenciais de autenticação (gerado automaticamente)
├── package.json
├── tsconfig.json
└── README.md
```

## ⚙️ Configuração

O bot salva as credenciais de autenticação na pasta `auth/`. Após a primeira conexão, você não precisará escanear o QR Code novamente (a menos que deslogue manualmente).

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

