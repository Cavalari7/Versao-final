// Sobe o backend de verdade (porta 3101) apontando para o Google de mentira e confere a rota ponta a ponta.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { subirGoogleFalso } from "./fake-google.mjs";
const g = await subirGoogleFalso();
const env = { ...process.env, PORT: "3101", ADMIN_KEY: "k-equipe", GOOGLE_MAPS_SERVER_KEY: "k-servidor", GOOGLE_MAPS_BROWSER_KEY: "k-navegador-publica",
    GOOGLE_ROUTES_URL: `http://127.0.0.1:${g.porta}/routes`, GOOGLE_GEOCODE_URL: `http://127.0.0.1:${g.porta}/geocode`, BASE_LAT: "-23.6598", BASE_LNG: "-52.605", GEOCODE_CIDADE: "Cianorte" };
const api = spawn("node", ["app.js"], { env, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; api.stdout.on("data", (d) => (log += d)); api.stderr.on("data", (d) => (log += d));
const B = "http://127.0.0.1:3101";
for (let i = 0; i < 40 && !log.includes("Servidor rodando"); i++) await new Promise((r) => setTimeout(r, 250));
assert.ok(log.includes("Servidor rodando"), "backend não subiu:\n" + log);
const chamar = async (rota, { metodo = "GET", corpo, chave } = {}) => {
    const r = await fetch(B + rota, { method: metodo, headers: { "Content-Type": "application/json", ...(chave && { "x-admin-key": chave }) }, body: corpo && JSON.stringify(corpo) });
    return { s: r.status, j: await r.json(), t: "" };
};
const ok = (n) => console.log("ok -", n);
try {
    let r = await chamar("/api/config/mapa");
    assert.deepEqual(r.j, { provedor: "google", chave: "k-navegador-publica", mapId: "DEMO_MAP_ID" }); ok("o navegador recebe só a chave pública do mapa");
    r = await chamar("/salvar-agendamento", { metodo: "POST", corpo: { nome: "T", telefone: "44 99999-0000", dia: "2026-12-01", hora: "09:00", rua: "Rua A", casa: "1", bairro: "Centro", quantidade_litros: "10" } });
    const { codigo, token } = r.j; assert.equal(r.s, 200);
    let v; for (let i = 0; i < 20; i++) { v = (await chamar(`/api/frascos/${codigo}?t=${token}`)).j; if (v.destino) break; await new Promise((x) => setTimeout(x, 200)); }
    assert.deepEqual(v.destino, { lat: -23.66, lng: -52.6, aproximado: false }); ok("endereço do agendamento virou coordenadas pelo Google");
    assert.equal(v.rota.tipo, "planejada"); assert.equal(v.rota.fonte, "google"); assert.equal(v.rota.distanciaM, 4200); assert.deepEqual([v.origem.lat, v.origem.lng], [-23.6598, -52.605]); ok("rota planejada da base até o local");
    await chamar(`/api/frascos/${codigo}/movimentacoes`, { metodo: "POST", chave: "k-equipe", corpo: { status: "EM_ROTA" } });
    await chamar(`/api/frascos/${codigo}/localizacoes`, { metodo: "POST", chave: "k-equipe", corpo: { lat: -23.65, lng: -52.59 } });
    v = (await chamar(`/api/frascos/${codigo}?t=${token}`)).j;
    assert.equal(v.rota.tipo, "restante"); assert.equal(v.rota.duracaoS, 600); assert.ok(v.rota.polyline && v.rota.chegadaEm); ok("com a equipe em movimento: rota restante, tempo e chegada prevista");
    const n = g.estado.rotas; await chamar(`/api/frascos/${codigo}?t=${token}`); await chamar(`/api/frascos/${codigo}?t=${token}`);
    assert.equal(g.estado.rotas, n); ok("o cliente atualizando a tela não gera cobrança extra");
    r = await chamar(`/api/frascos/${codigo}`); assert.equal(r.j.rota, undefined); assert.equal(r.j.origem, undefined); ok("visão pública não recebe rota nem posição");
    assert.ok(!JSON.stringify(v).includes("k-servidor")); ok("a chave secreta nunca aparece nas respostas");
    await chamar(`/api/frascos/${codigo}/movimentacoes`, { metodo: "POST", chave: "k-equipe", corpo: { status: "COLETADO", litrosColetados: 9 } });
    v = (await chamar(`/api/frascos/${codigo}?t=${token}`)).j; assert.equal(v.rota, null); assert.equal(v.localizacao, null); ok("coleta encerrada: rota e posição somem");
    console.log("\nTudo certo.");
} finally { api.kill(); g.fechar(); setTimeout(() => process.exit(0), 200); }
