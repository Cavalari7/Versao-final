// Roda antes do build (npm run build). Escreve public/rastreio/config.js a partir das variáveis de ambiente do deploy,
// para as páginas de rastreio, entregador e termo falarem com a API certa sem editar arquivo à mão.
// Sem VITE_API_URL (desenvolvimento local), não mexe em nada.
import fs from "node:fs";

const api = (process.env.VITE_API_URL || "").trim().replace(/\/$/, "");
if (!api) { console.log("[config] VITE_API_URL não definida: config.js mantido como está."); process.exit(0); }

let site = (process.env.VITE_SITE_URL || "").trim().replace(/\/$/, "");
if (!site && process.env.VERCEL_PROJECT_PRODUCTION_URL) site = "https://" + process.env.VERCEL_PROJECT_PRODUCTION_URL;
if (!site && process.env.RENDER_EXTERNAL_URL) site = process.env.RENDER_EXTERNAL_URL.replace(/\/$/, "");

const conteudo = `// GERADO no build a partir das variáveis de ambiente (scripts/gerar-config.mjs).
window.BIOOLEO_API_URL = ${JSON.stringify(api)};
window.BIOOLEO_SITE_URL = ${JSON.stringify(site)};
`;
fs.writeFileSync(new URL("../public/rastreio/config.js", import.meta.url), conteudo);
console.log(`[config] API=${api} SITE=${site || "(endereço da página)"}`);
