// Teste de ponta a ponta da API de rastreio. Com o backend rodando: npm test
import assert from "node:assert/strict";
const B = process.env.API || "http://localhost:3000", CHAVE = process.env.ADMIN_KEY || "bioleo-admin";
const chamar = async (rota, { metodo = "GET", corpo, chave } = {}) => {
    const h = { "Content-Type": "application/json" };
    if (chave) h["x-admin-key"] = chave;
    const r = await fetch(B + rota, { method: metodo, headers: h, body: corpo && JSON.stringify(corpo) });
    return { s: r.status, j: await r.json().catch(() => ({})) };
};
const ok = (n) => console.log("ok -", n);
const eq = { chave: CHAVE };
const ag = { nome: "Teste", telefone: "44 99999-0000", dia: "2026-12-01", hora: "09:00", rua: "Rua A", casa: "1", bairro: "Centro", quantidade_litros: "10" };

let r = await chamar("/salvar-agendamento", { metodo: "POST", corpo: ag });
assert.equal(r.s, 200); const { codigo, token } = r.j; assert.match(codigo, /^BO-\d{5}$/); ok("agendar continua funcionando e gera o frasco " + codigo);
r = await chamar(`/api/frascos/${codigo}`);
assert.equal(r.j.publico, true); assert.equal(r.j.cliente, undefined); assert.equal(r.j.movimentacoes[0].status, "AGENDADA"); ok("visão pública: só ID e status");
r = await chamar(`/api/frascos/${codigo}?t=errado`); assert.equal(r.j.publico, true); ok("token errado cai na visão pública");
r = await chamar(`/api/frascos/${codigo}?t=${token}`); assert.equal(r.j.cliente, "Teste"); assert.equal(r.j.litrosPrevistos, 10); ok("token do cliente: visão completa");
for (const [rota, m] of [["/api/admin/frascos", "GET"], [`/api/frascos/${codigo}/movimentacoes`, "POST"], [`/api/frascos/${codigo}/localizacoes`, "POST"], [`/api/frascos/${codigo}/destino`, "PUT"]]) {
    r = await chamar(rota, { metodo: m, corpo: m === "GET" ? undefined : {} }); assert.equal(r.s, 401);
}
ok("ações da equipe exigem a chave");
r = await chamar("/api/admin/frascos", eq); assert.equal(r.j.find((f) => f.id === codigo).token, token); ok("a equipe recebe o comprovante para avisar o cliente");
r = await chamar("/listar-agendamento"); assert.equal(r.s, 401); ok("/listar-agendamento não expõe mais dados pessoais sem a chave");
r = await chamar("/listar-agendamento", eq); assert.equal(r.s, 200); assert.equal(r.j.at(-1).token, undefined); ok("/listar-agendamento com a chave da equipe, sem expor o token");
r = await chamar(`/api/frascos/${codigo}/localizacoes`, { metodo: "POST", ...eq, corpo: { lat: 99, lng: 0 } }); assert.equal(r.s, 400); ok("posição inválida é recusada");
r = await chamar(`/api/frascos/${codigo}/movimentacoes`, { metodo: "POST", ...eq, corpo: { status: "EM_ROTA" } }); assert.equal(r.s, 201);
r = await chamar(`/api/frascos/${codigo}/movimentacoes`, { metodo: "POST", ...eq, corpo: { status: "EM_ROTA" } }); assert.equal(r.s, 200); assert.equal(r.j.jaEmRota, true); ok("equipe inicia a rota (repetir é inofensivo)");
r = await chamar(`/api/frascos/${codigo}/localizacoes`, { metodo: "POST", ...eq, corpo: { lat: -23.6, lng: -52.6, precisaoM: 12 } }); assert.equal(r.s, 201);
r = await chamar(`/api/frascos/${codigo}/localizacoes`, { metodo: "POST", ...eq, corpo: { lat: -23.61, lng: -52.61 } }); assert.equal(r.s, 201);
r = await chamar(`/api/frascos/${codigo}?t=${token}`); assert.equal(r.j.localizacao.lat, -23.61); assert.equal(r.j.destino, null); ok("cliente vê a última posição da equipe");
r = await chamar(`/api/frascos/${codigo}`); assert.equal(r.j.localizacao, undefined); ok("visão pública não vê posição");
r = await chamar(`/api/frascos/${codigo}/destino`, { metodo: "PUT", ...eq, corpo: { lat: -23.66, lng: -52.6 } }); assert.equal(r.s, 200);
r = await chamar(`/api/frascos/${codigo}?t=${token}`); assert.deepEqual(r.j.destino, { lat: -23.66, lng: -52.6, aproximado: false }); ok("equipe marca o local da coleta");
r = await chamar(`/api/frascos/${codigo}/movimentacoes`, { metodo: "POST", ...eq, corpo: { status: "COLETADO" } }); assert.equal(r.s, 400); ok("coletado sem litros é recusado");
r = await chamar(`/api/frascos/${codigo}/movimentacoes`, { metodo: "POST", ...eq, corpo: { status: "COLETADO", litrosColetados: 9.5 } }); assert.equal(r.s, 201);
r = await chamar(`/api/frascos/${codigo}?t=${token}`);
assert.equal(r.j.litrosColetados, 9.5); assert.equal(r.j.movimentacoes.at(-1).status, "COLETADO"); assert.equal(r.j.localizacao, null); ok("coletado: litros salvos e posição deixa de ser exposta");
r = await chamar(`/api/frascos/${codigo}/localizacoes`, { metodo: "POST", ...eq, corpo: { lat: -23.6, lng: -52.6 } }); assert.equal(r.s, 409);
r = await chamar(`/api/frascos/${codigo}/movimentacoes`, { metodo: "POST", ...eq, corpo: { status: "CANCELADA" } }); assert.equal(r.s, 409); ok("coleta encerrada não aceita mais nada");
r = await chamar("/api/frascos/BO-09999"); assert.equal(r.s, 404); r = await chamar("/api/frascos/XX"); assert.equal(r.s, 400); ok("ID inexistente e inválido");
console.log("\nTudo certo.");
