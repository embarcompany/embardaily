# Supabase como centro operacional do EmbarDaily

## O que muda

O Supabase passa a ser a fonte oficial de dados. O CRM consulta o banco; a Evolution API registra cada envio e resposta; os arquivos vão para o bucket privado `embardaily-media`. A planilha Google recebe somente a visão operacional escolhida, por uma sincronização de mão única. O Drive pode permanecer como cópia organizada dos arquivos para o time, mas não controla status nem mensagens.

```mermaid
flowchart LR
  F[Formulário de embarque] --> DB[(Supabase Postgres)]
  F --> ST[Supabase Storage]
  DB --> CRM[CRM Kanban]
  DB --> Q[Campanha agendada]
  Q --> EVO[Evolution API]
  EVO --> WH[Webhook Evolution]
  WH --> DB
  DB --> GS[Google Sheets — espelho]
  ST -. espelho opcional .-> GD[Google Drive]
```

## 1. Criar o projeto

1. Crie um projeto no [Supabase Dashboard](https://supabase.com/dashboard).
2. Em **Project Settings → API**, copie a URL e a **publishable key**.
3. Em **Project Settings → API**, copie a `service_role` apenas para os segredos das Edge Functions. Ela nunca pode ficar no JavaScript do navegador, na planilha ou em um repositório.
4. Em **Authentication → Users**, crie os usuários internos do CRM. Depois crie um `profiles` para cada usuário via SQL (o primeiro administrador pode ser inserido no SQL Editor com o UUID do usuário).

```sql
insert into public.profiles (id, full_name, role)
values ('UUID_DO_USUARIO', 'Nome da pessoa', 'admin');
```

## 2. Aplicar banco e Storage

Instale a [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), faça login e vincule o projeto:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push
supabase db seed
```

As migrations criam os dados do CRM, as regras RLS, o bucket privado e a view `google_sheet_export`. Esta view é a única base da exportação para Sheets, evitando que conteúdo bruto de conversa, credenciais ou caminhos do Storage vazem para a planilha.

## 3. Configurar segredos das Functions

No Dashboard, abra **Edge Functions → Secrets** e cadastre:

```text
SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
EVOLUTION_API_URL=https://evolution.seudominio.com
EVOLUTION_INSTANCE_NAME=embardaily
EVOLUTION_API_KEY=...
EVOLUTION_WEBHOOK_SECRET=um-segredo-longo
INTERNAL_FUNCTION_SECRET=outro-segredo-longo
GOOGLE_SHEET_ID=...
GOOGLE_SHEET_TAB=Embarques
GOOGLE_SERVICE_ACCOUNT_EMAIL=...@...iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

Faça o deploy:

```bash
supabase functions deploy evolution-webhook --no-verify-jwt
supabase functions deploy campaign-dispatch --no-verify-jwt
supabase functions deploy google-sheets-sync --no-verify-jwt
```

## 4. Ligar Evolution API

No painel da Evolution, configure o webhook para:

```text
https://SEU_PROJECT_REF.supabase.co/functions/v1/evolution-webhook
```

Adicione o header `x-evolution-secret` com o mesmo valor de `EVOLUTION_WEBHOOK_SECRET`, quando a sua versão da Evolution permitir headers personalizados. Ative pelo menos os eventos de mensagem recebida e atualização de mensagem. Uma resposta recebida muda o card para **Revisão manual**; as próximas mensagens são escolhidas pelo time, nunca disparadas automaticamente pelo texto da conversa.

O agendador deve chamar `campaign-dispatch` uma vez por hora com o header `x-embardaily-secret`. A function bloqueia e reivindica os casos antes de enviar, impedindo envio duplo mesmo em execuções concorrentes.

## 5. Espelhar para Google Sheets

Compartilhe a planilha de destino com o e-mail da service account como **Editor**. A function `google-sheets-sync` reescreve apenas as colunas da view operacional; ela não lê status nem altera dados no Supabase. Agende-a, por exemplo, a cada hora depois da campanha, usando o mesmo header interno.

## O que cada local guarda

| Local | Responsabilidade |
|---|---|
| Supabase Postgres | clientes, embarques, pets, Kanban, mensagens, atividades e agenda |
| Supabase Storage | fotos e vídeos privados vinculados ao embarque |
| Evolution API | canal de envio e eventos do WhatsApp |
| Google Sheets | relatório operacional para consulta/compartilhamento |
| Google Drive | cópia opcional por mês e resumo do embarque |
