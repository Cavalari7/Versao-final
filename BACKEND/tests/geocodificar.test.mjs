// Testa a geocodificação sem internet, trocando o fetch por uma resposta de mentira.
import assert from "node:assert/strict";
process.env.GEOCODE_CIDADE = "Cianorte, Paraná";
const { agendarGeocodificacao } = await import("../geocodificar.js");
const chamadas = [];
globalThis.fetch = async (url, opts) => { chamadas.push({ url: String(url), ua: opts.headers["User-Agent"] }); return { ok: true, json: async () => [{ lat: "-23.66", lon: "-52.60" }] }; };
const gravou = [];
agendarGeocodificacao({ execute: async (sql, p) => gravou.push(p) }, 7, { rua: "Rua A", casa: "12", bairro: "Centro" });
await new Promise((r) => setTimeout(r, 300));
assert.deepEqual(gravou[0], [-23.66, -52.6, 1, 7]); assert.match(chamadas[0].url, /Cianorte/); assert.match(chamadas[0].ua, /BioOleo/);
console.log("ok - endereço vira coordenadas e é gravado");
globalThis.fetch = async () => { throw new Error("sem internet"); };
agendarGeocodificacao({ execute: async () => assert.fail("não deveria gravar") }, 8, { rua: "X", casa: "1", bairro: "Y" });
await new Promise((r) => setTimeout(r, 1500));
console.log("ok - sem internet: falha em silêncio, sem derrubar nada");
process.exit(0);
