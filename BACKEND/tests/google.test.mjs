// Testa a integração com o Google (Routes + Geocoding) contra um servidor de mentira.
import assert from "node:assert/strict";
import { subirGoogleFalso } from "./fake-google.mjs";
const g = await subirGoogleFalso();
process.env.GOOGLE_ROUTES_URL = `http://127.0.0.1:${g.porta}/routes`;
process.env.GOOGLE_GEOCODE_URL = `http://127.0.0.1:${g.porta}/geocode`;
const G = await import("../google.js");
const ok = (n) => console.log("ok -", n);
const base = { lat: -23.6598, lng: -52.605 }, dest = { lat: -23.66, lng: -52.6 };

delete process.env.GOOGLE_MAPS_SERVER_KEY;
assert.equal(G.googleAtivo(), false);
assert.equal(await G.geocodificarGoogle("Rua A"), null);
let r = await G.rotaDaEntrega("sem-chave", base, null, dest);
assert.equal(r.fonte, "linha-reta"); assert.ok(r.distanciaRetaM > 300 && r.distanciaRetaM < 700); assert.equal(r.duracaoS, undefined);
assert.equal(g.estado.rotas + g.estado.geos, 0); ok("sem chave: distância em linha reta, sem tempo inventado e sem chamar o Google");

process.env.GOOGLE_MAPS_SERVER_KEY = "k-servidor";
const geo = await G.geocodificarGoogle("Rua A, 1, Centro, Cianorte");
assert.deepEqual(geo, { lat: -23.66, lng: -52.6, aproximado: false }); assert.equal(await G.geocodificarGoogle("Nada existe"), null); ok("geocodificação: endereço vira coordenadas; endereço inexistente vira null");

r = await G.calcularRota(base, dest);
assert.deepEqual(r, { distanciaM: 4200, duracaoS: 600, polyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" });
assert.equal(g.estado.ultimoHeaders["x-goog-fieldmask"], "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline");
assert.equal(g.estado.ultimaRota.travelMode, "DRIVE"); assert.equal(g.estado.ultimaRota.routingPreference, "TRAFFIC_UNAWARE");
assert.equal(g.estado.ultimaRota.origin.location.latLng.latitude, base.lat); ok("rota: pedido correto (campos mínimos, sem trânsito) e resposta lida");
process.env.ROTA_COM_TRAFEGO = "on"; await G.calcularRota(base, dest); assert.equal(g.estado.ultimaRota.routingPreference, "TRAFFIC_AWARE"); delete process.env.ROTA_COM_TRAFEGO; ok("trânsito em tempo real só quando ligado");

const antes = g.estado.rotas;
r = await G.rotaDaEntrega("e1", base, base, dest); assert.equal(r.fonte, "google"); assert.equal(r.tipo, "restante"); assert.equal(r.duracaoS, 600); assert.ok(r.chegadaEm);
await G.rotaDaEntrega("e1", base, { lat: -23.6599, lng: -52.6049 }, dest);
await G.rotaDaEntrega("e1", base, { lat: -23.663, lng: -52.602 }, dest); // andou +300 m, mas faz menos de 20 s
assert.equal(g.estado.rotas - antes, 1); ok("cache: várias consultas seguidas geram só 1 cobrança");
await G.rotaDaEntrega("e1", base, null, dest); assert.equal(g.estado.rotas - antes, 2); ok("rota planejada (base -> local) é separada da rota restante");
r = await G.rotaDaEntrega("e1", base, null, { lat: -23.7, lng: -52.7 }); assert.equal(g.estado.rotas - antes, 3); ok("mudar o local da coleta refaz a rota");

process.env.GOOGLE_MAPS_SERVER_KEY = "chave-errada";
assert.equal(await G.calcularRota(base, dest), null);
r = await G.rotaDaEntrega("e2", base, null, dest); assert.equal(r.fonte, "linha-reta"); ok("chave recusada pelo Google: não quebra, volta à linha reta");

process.env.BASE_LAT = "-23.1"; process.env.BASE_LNG = "-52.1";
assert.deepEqual(await G.baseOrigem(), { lat: -23.1, lng: -52.1, nome: "Bio Óleo / Brasil" }); ok("ponto de partida vem do .env");
g.fechar(); console.log("\nTudo certo."); process.exit(0);
