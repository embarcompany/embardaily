# Guia completo de configuração — EmbarDaily

Este guia coloca o CRM no ar com a planilha, o Drive e a Evolution API conectados.

## 1. O que cada integração faz

| Integração | Função no EmbarDaily |
|---|---|
| Google Sheets | Cadastro de embarques e status do CRM |
| Google Drive | Pastas mensais e arquivos de cada embarque |
| Evolution API | Envio e recebimento de mensagens WhatsApp |
| Anthropic (opcional) | Entende depoimentos e confirmações automaticamente |
| VPS | Mantém o sistema disponível 24 horas |

## 2. Google Cloud: criar o acesso da planilha e do Drive

1. Acesse [Google Cloud Console](https://console.cloud.google.com/).
2. Crie um projeto chamado `EmbarDaily`.
3. Em **APIs e serviços → Biblioteca**, ative **Google Sheets API** e **Google Drive API**.
4. Em **APIs e serviços → Credenciais**, escolha **Criar credenciais → Conta de serviço**.
5. Dê o nome `embardaily-service` e conclua.
6. Abra a conta criada, vá em **Chaves → Adicionar chave → Criar nova chave → JSON**. Guarde o arquivo em local seguro; ele não deve ir para o GitHub.
7. No JSON, copie `client_email` para `GOOGLE_SERVICE_ACCOUNT_EMAIL` e `private_key` para `GOOGLE_PRIVATE_KEY`.

## 3. Compartilhar a planilha e a pasta do Drive

1. Abra a planilha Google que contém a aba `Embarques`.
2. Clique em **Compartilhar** e adicione o `client_email` da service account como **Editor**.
3. Crie uma pasta mãe no Google Drive, por exemplo `EmbarDaily - Arquivos`.
4. Compartilhe essa pasta com o mesmo `client_email` como **Editor**.
5. Copie o ID da planilha: é o trecho entre `/d/` e `/edit` na URL.
6. Copie o ID da pasta mãe: é o trecho após `/folders/` na URL.

Exemplo de organização criada automaticamente:

```text
EmbarDaily - Arquivos
└── 07 - julho 2026
    └── TCVIA - GUILHERME MAYER - CWBxGRUxMIA15/07/26 - P: 1871 🐶: Parafina
        ├── foto.jpg
        └── video.mp4
```

## 4. Configurar a Evolution API

1. Entre no painel da Evolution API da sua VPS/provedor.
2. Crie uma instância com o nome `embardaily`.
3. Conecte o WhatsApp escaneando o QR Code com o aparelho da empresa.
4. Copie a URL da API, o nome da instância e a API key.
5. Configure o webhook da instância para `https://SEU-DOMINIO/webhook/whatsapp`.
6. Ative o evento `MESSAGES_UPSERT`.

O sistema envia mensagens em `POST /message/sendText/{instância}` e processa as respostas recebidas no webhook.

## 5. Preencher o arquivo .env

Na pasta do projeto na VPS, crie o arquivo `.env` a partir de `.env.example`.

```env
GOOGLE_SHEET_ID=ID_DA_SUA_PLANILHA
GOOGLE_SHEET_TAB=Embarques
GOOGLE_SERVICE_ACCOUNT_EMAIL=embardaily-service@seu-projeto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nSUA_CHAVE_AQUI\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_PARENT_FOLDER_ID=ID_DA_PASTA_MAE

WHATSAPP_PROVIDER=evolution
EVOLUTION_API_URL=https://evolution.seudominio.com
EVOLUTION_INSTANCE_NAME=embardaily
EVOLUTION_API_KEY=SUA_CHAVE_EVOLUTION

GOOGLE_REVIEW_URL=LINK_DA_AVALIACAO_GOOGLE
TOQUE1_DELAY_DAYS=6
REMINDER_DELAY_DAYS=4
CRM_USERNAME=admin
CRM_PASSWORD=ESCOLHA_UMA_SENHA_FORTE
PORT=3000
```

`ANTHROPIC_API_KEY` é opcional. Sem ela, respostas que precisam ser interpretadas ficam em **Revisar manualmente** no Kanban.

## 6. Testar antes de enviar WhatsApp

1. Execute `npm start` na pasta do projeto.
2. Acesse `http://IP-DA-VPS:3000/novo-embarque`.
3. Cadastre um embarque de teste com o seu próprio telefone.
4. Verifique se a linha aparece na aba `Embarques`.
5. Anexe uma foto pequena e confirme se a pasta/mídia aparece no Drive.
6. No CRM, confirme que o card aparece em **Prontos para contato**.
7. Use o botão **Enviar próxima mensagem** somente quando a Evolution estiver conectada e o telefone for de teste.

## 7. Colocar na VPS com systemd

No Ubuntu, instale Node.js 20+, Git e Nginx. Depois:

```bash
git clone https://github.com/embarcompany/embardaily.git
cd embardaily
cp .env.example .env
# preencha o .env com nano .env
npm start
```

Quando o teste estiver correto, crie `/etc/systemd/system/embardaily.service`:

```ini
[Unit]
Description=EmbarDaily CRM
After=network.target

[Service]
Type=simple
User=SEU_USUARIO
WorkingDirectory=/caminho/para/embardaily
ExecStart=/usr/bin/node src/server.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Ative com:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now embardaily
sudo systemctl status embardaily
```

Por fim, configure um domínio e Nginx/HTTPS antes de apontar o webhook da Evolution. Não exponha a porta 3000 diretamente na internet.
