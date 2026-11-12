// Contas de usuário ponta a ponta. Com o backend rodando: node tests/auth.test.mjs
import assert from "node:assert/strict";
const B = process.env.API || "http://localhost:3000";
const ok = (n) => console.log("ok -", n);
const call = async (rota, { metodo = "GET", corpo, auth } = {}) => {
    const h = { "Content-Type": "application/json" };
    if (auth) h.Authorization = "Bearer " + auth;
    const r = await fetch(B + rota, { method: metodo, headers: h, body: corpo && JSON.stringify(corpo) });
    return { s: r.status, j: await r.json().catch(() => ({})) };
};
const email = `t${Date.now()}@teste.com`, senha = "Senha1234";
const ag = { nome: "Maria", telefone: "44 99999-0000", dia: "2026-12-02", hora: "10:00", rua: "Rua B", casa: "2", bairro: "Centro", quantidade_litros: "20" };

let r = await call("/api/auth/cadastro", { metodo: "POST", corpo: { nome: "Maria", email, senha: "fraca" } }); assert.equal(r.s, 400); ok("senha fraca recusada");
r = await call("/api/auth/cadastro", { metodo: "POST", corpo: { nome: "Maria", email: "x", senha } }); assert.equal(r.s, 400); ok("e-mail inválido recusado");
r = await call("/api/auth/cadastro", { metodo: "POST", corpo: { nome: "Maria", email, senha } }); assert.equal(r.s, 201); const tok = r.j.token; assert.match(tok, /^[0-9a-f]{64}$/); assert.equal(r.j.usuario.senha_hash, undefined); ok("cadastro cria conta e sessão");
r = await call("/api/auth/cadastro", { metodo: "POST", corpo: { nome: "Maria", email: email.toUpperCase(), senha } }); assert.equal(r.s, 409); ok("e-mail duplicado recusado");
r = await call("/api/auth/login", { metodo: "POST", corpo: { email, senha: "Errada123" } }); assert.equal(r.s, 401); ok("senha errada recusada");
r = await call("/api/auth/login", { metodo: "POST", corpo: { email, senha } }); assert.equal(r.s, 200); const tok2 = r.j.token; ok("login correto");
r = await call("/api/auth/me", { auth: tok2 }); assert.equal(r.j.usuario.email, email); ok("sessão identifica o usuário");
r = await call("/api/auth/me"); assert.equal(r.s, 401); r = await call("/api/minhas-coletas"); assert.equal(r.s, 401); ok("sem sessão: acesso negado");
r = await call("/salvar-agendamento", { metodo: "POST", corpo: ag, auth: tok2 }); assert.equal(r.s, 200); const cod = r.j.codigo;
r = await call("/salvar-agendamento", { metodo: "POST", corpo: ag }); assert.equal(r.s, 200); const anon = r.j.codigo; ok("agendar logado e anônimo");
r = await call("/api/minhas-coletas", { auth: tok }); assert.equal(r.s, 200); assert.equal(r.j.length, 1); assert.equal(r.j[0].codigo, cod); assert.ok(!r.j.find((x) => x.codigo === anon)); assert.equal(r.j[0].status, "AGENDADA"); ok("minhas coletas traz só as da conta");
r = await call(`/api/frascos/${cod}?t=${r.j[0].token}`); assert.equal(r.j.cliente, "Maria"); ok("comprovante da conta abre o rastreio completo");
r = await call("/api/auth/logout", { metodo: "POST", auth: tok }); r = await call("/api/auth/me", { auth: tok }); assert.equal(r.s, 401);
r = await call("/api/auth/me", { auth: tok2 }); assert.equal(r.s, 200); ok("logout encerra só aquela sessão");
console.log("\nTudo certo.");
