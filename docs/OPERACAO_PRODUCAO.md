# Operação de produção

## Antes de ativar mensagens

1. Preencha `.env` usando `.env.example` como modelo.
2. Defina `APP_BASE_URL` com o domínio público HTTPS, por exemplo `https://crm.seudominio.com`.
3. Rode:

```bash
npm run check:integrations
```

O comando deve retornar `OK` para Google Sheets, Google Drive e Evolution API. Ele apenas consulta as integrações: não cria embarques e não dispara mensagens.

4. Cadastre um embarque de teste com o telefone da equipe.
5. Confirme a linha na planilha, a pasta mensal/caso no Drive e o card no CRM.
6. Só então teste o botão de envio com a Evolution API conectada.

## Subir com Docker na VPS

```bash
git clone https://github.com/embarcompany/embardaily.git
cd embardaily
cp .env.example .env
# preencha o arquivo .env
docker compose up -d --build
docker compose logs -f
```

O `docker-compose.yml` mantém o serviço ativo após reinicialização da VPS e preserva os logs de auditoria na pasta `data/`.

## Evolução API

Configure o webhook da instância para:

```text
https://SEU-DOMINIO/webhook/whatsapp
```

Os eventos necessários são `MESSAGES_UPSERT`, `MESSAGES_UPDATE` e `CONNECTION_UPDATE`. A API disponibiliza a rota de status da instância em `/instance/connectionState/{instance}`; o verificador de integração consulta essa rota.

## Segurança mínima

- Nunca envie `.env` ou a chave JSON da service account para o GitHub.
- Use `CRM_USERNAME` e `CRM_PASSWORD` fortes.
- Publique o CRM atrás de HTTPS (Nginx ou Caddy), não expondo a porta 3000 diretamente.
- Teste todos os envios com um número interno antes de liberar a equipe.
