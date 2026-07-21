# EmbarDaily

CRM operacional pós-embarque da Embarpet e Embartravel.

**Supabase é a única fonte de dados.** Ele guarda clientes, embarques, pets, Kanban, conversas, auditoria, fotos e vídeos. A Google Sheets não faz parte do fluxo.

## Como funciona

1. O time cadastra um embarque pelo formulário.
2. Os dados e arquivos privados são salvos no Supabase.
3. O dashboard Kanban consulta o Supabase e mostra a situação de cada tutor.
4. A Edge Function envia o Toque 1 pela Evolution API na data configurada.
5. A Evolution envia as respostas ao webhook; o card muda para revisão manual.
6. As mensagens posteriores são escolhidas pelo time na página de mensagens prontas.

## Subir na VPS

1. Crie o projeto Supabase e siga [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md).
2. Copie `.env.example` para `.env` e preencha `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
3. Suba o CRM com Docker ou `npm start`.
4. Abra `https://seu-dominio` para o Kanban e `/embarques/novo` para cadastrar embarques.

Nunca coloque a `SUPABASE_SERVICE_ROLE_KEY` no navegador. Ela é usada apenas pelo servidor e pelas Edge Functions.
