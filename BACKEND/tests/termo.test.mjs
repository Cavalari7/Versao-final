// Termo de responsabilidade ponta a ponta. Com o backend rodando: ADMIN_KEY=... node tests/termo.test.mjs
import assert from "node:assert/strict";
const B = process.env.API || "http://localhost:3000";
const KEY = process.env.ADMIN_KEY || "bioleo-admin";
const ok = (n) => console.log("ok -", n);
const call = async (rota, { metodo = "GET", corpo, admin = true } = {}) => {
    const h = { "Content-Type": "application/json" };
    if (admin) h["x-admin-key"] = KEY;
    const r = await fetch(B + rota, { method: metodo, headers: h, body: corpo && JSON.stringify(corpo) });
    return { s: r.status, j: await r.json().catch(() => ({})) };
};
const ag = { nome: "Cliente Termo", telefone: "44 99999-0000", dia: "2026-12-05", hora: "09:00", rua: "Rua T", casa: "5", bairro: "Centro", quantidade_litros: "15" };
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const novo = async () => (await call("/salvar-agendamento", { metodo: "POST", corpo: ag, admin: false })).j.codigo;
const status = async (id) => (await call("/api/admin/frascos")).j.find((f) => f.id === id).status;

const a = await novo(), b = await novo();
let r = await call(`/api/frascos/${a}/termo`, { metodo: "POST", corpo: { tipo: "ASSINATURA", nome: "Maria", assinatura: PNG }, admin: false }); assert.equal(r.s, 401); ok("sem a chave da equipe: negado");
r = await call(`/api/frascos/${a}/termo`, { metodo: "POST", corpo: { tipo: "ASSINATURA", nome: "Maria" } }); assert.equal(r.s, 400); ok("assinatura ausente recusada");
r = await call(`/api/frascos/${a}/termo`, { metodo: "POST", corpo: { tipo: "ASSINATURA", nome: "Maria", assinatura: "data:image/png;base64,<script>" } }); assert.equal(r.s, 400); ok("assinatura inválida recusada");
r = await call(`/api/frascos/${a}/termo`, { metodo: "POST", corpo: { tipo: "ACEITE", nome: "" } }); assert.equal(r.s, 400); ok("nome vazio recusado");
r = await call(`/api/frascos/BO-99999/termo`, { metodo: "POST", corpo: { tipo: "ACEITE", nome: "Maria" } }); assert.equal(r.s, 404); ok("frasco inexistente");
assert.equal(await status(a), "AGENDADA");
r = await call(`/api/frascos/${a}/termo`, { metodo: "POST", corpo: { tipo: "ASSINATURA", nome: "Maria", assinatura: PNG } }); assert.equal(r.s, 201); ok("termo com assinatura aceito");
assert.equal(await status(a), "ENTREGUE"); ok("frasco passou para ENTREGUE");
r = await call(`/api/frascos/${a}/termo`, { metodo: "POST", corpo: { tipo: "ACEITE", nome: "Maria" } }); assert.equal(r.s, 409); ok("não aceita o termo duas vezes");
r = await call(`/api/admin/frascos/${a}/termo`); assert.equal(r.s, 200); assert.equal(r.j.tipo, "ASSINATURA"); assert.equal(r.j.nome, "Maria"); assert.equal(r.j.assinatura, PNG); ok("termo e assinatura podem ser consultados");
r = await call(`/api/admin/frascos/${a}/termo`, { admin: false }); assert.equal(r.s, 401); ok("consulta do termo exige a chave");
r = await call(`/api/frascos/${b}/termo`, { metodo: "POST", corpo: { tipo: "ACEITE", nome: "João" } }); assert.equal(r.s, 201); assert.equal(await status(b), "ENTREGUE"); ok("aceite digital registra a entrega");
r = await call(`/api/admin/frascos/${b}/termo`); assert.equal(r.j.tipo, "ACEITE"); assert.equal(r.j.assinatura, null); ok("aceite digital não guarda imagem");
console.log("\nTudo certo.");
