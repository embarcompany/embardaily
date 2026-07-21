import { config } from "./config.js";
import { SheetsClient } from "./sheets-client.js";
import { createWhatsAppClient } from "./whatsapp-client.js";
import { processCampaign } from "./campaign.js";

if (!config.sheetId) throw new Error("Defina GOOGLE_SHEET_ID no .env.");
console.log(await processCampaign({ sheets: new SheetsClient(config), whatsapp: createWhatsAppClient(config.provider), config }));
