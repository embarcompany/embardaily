# EmbarDaily

Automação pós-embarque para solicitar depoimentos, avaliação no Google e autorização de uso no Instagram. A fonte de verdade é a aba `Embarques` de uma planilha Google Sheets.

## Canal escolhido

O projeto usa a **Evolution API**, definida por `EVOLUTION_API_URL`, `EVOLUTION_INSTANCE_NAME` e `EVOLUTION_API_KEY`. Ela envia texto por `/message/sendText/{instance}` e entrega respostas em `POST /webhook/whatsapp`. Como é uma integração não oficial, o número deve ser usado com volume prudente e somente com clientes elegíveis.

## Estado e colunas necessárias

O serviço cria/usa estas colunas na aba de embarques:

`status_embardaily`, `data_toque1`, `data_resposta_toque1`, `texto_depoimento`, `data_toque2`, `avaliacao_confirmada`, `data_toque3`, `autorizacao_instagram`, `tentativas_lembrete`, `erro_log`.

O campo `Contato` deve conter telefone com DDI; números brasileiros sem DDI são normalizados para `55`. Linhas sem telefone, com observações de recusa/opt-out, ou já em estado terminal nunca recebem envio.

## Controle de cobertura e arquivos

O painel mostra o número de clientes **ainda não contatados** e oferece um filtro exclusivo para eles. Esse número vem de `Contato Realizado?`; ele é marcado automaticamente quando a mensagem é enviada pela Evolution API.

Em cada cartão, abra o detalhe para enviar fotos ou vídeos. Se o cliente ainda não tiver `Pasta no Drive`, o CRM cria uma pasta com o nome do tutor e pet, grava o link na planilha e envia o arquivo para lá. Compartilhe a pasta mãe definida em `GOOGLE_DRIVE_PARENT_FOLDER_ID` com a service account como **Editor**.

## Configuração

1. Copie `.env.example` para `.env` e preencha as variáveis. Não versione `.env`.
2. Crie uma service account no Google Cloud, ative Google Sheets API e compartilhe a planilha com o e-mail da service account como **Editor**.
3. Crie/conecte a instância na Evolution API e use o QR Code dela para vincular o WhatsApp.
4. Na Evolution, habilite o evento `MESSAGES_UPSERT` e aponte o webhook para `https://SEU-DOMINIO/webhook/whatsapp`.
5. Defina `CRM_USERNAME` e `CRM_PASSWORD` antes de expor a interface na VPS. O webhook permanece público para que a Evolution consiga entregar as respostas.

## Operação

```powershell
Copy-Item .env.example .env
npm run run:campaign     # processamento manual seguro
npm start                 # CRM visual + webhook + job diário às 09:00
npm test
```

O job é idempotente: atualiza o estado somente após um envio bem-sucedido. Cada operação relevante entra em `data/embardaily-audit.jsonl` (ou no caminho definido em `AUDIT_LOG_PATH`). Erros de linha são registrados em `erro_log` e não interrompem o lote.

## Regras do fluxo

- Toque 1: `Data do embarque + TOQUE1_DELAY_DAYS`, estado `não_iniciado`.
- Lembrete: somente uma vez após `REMINDER_DELAY_DAYS` sem resposta.
- `sair`, `pare`, `cancelar` e equivalentes: bloqueiam imediatamente o contato.
- Respostas que não forem classificadas com segurança como depoimento ficam em `revisao_manual`; o fluxo não avança automaticamente.
- A confirmação da avaliação leva ao Toque 3; autorização `sim`, `não` ou `sim_sem_identificação` conclui o fluxo.

Abra `http://IP-DA-VPS:3000` para o kanban. O quadro permite buscar clientes, abrir detalhes e mover manualmente uma etapa; a planilha continua sendo a fonte de verdade. Antes do primeiro envio real, execute o job com uma planilha/número de teste e confira o log de auditoria.

## Formulário de novo embarque

Use `http://IP-DA-VPS:3000/novo-embarque` para registrar um novo caso. O formulário aceita um resumo como `TCVIA - GUILHERME MAYER - CWBxGRUxMIA 15/07/26 - P: 1871 🐶: Parafina`, preenche os campos identificáveis, permite cadastrar quantos pets forem necessários e anexa fotos/vídeos. Ao concluir, cria a linha na aba `Embarques` com estado `não_iniciado`; os arquivos seguem para a pasta individual do Drive.
