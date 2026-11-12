import { Router } from "express";
import crypto from "node:crypto";
import { promisify } from "node:util";
import { db as pool } from "./db.js";
import { codigo } from "./rastreio.js";

const scrypt = promisify(crypto.scrypt);
const DIAS_SESSAO = 30;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const sha = (t) => crypto.createHash("sha256").update(t).digest("hex");
const txt = (v, n) => String(v || "").trim().slice(0, n);

async function hashSenha(senha) {
    const sal = crypto.randomBytes(16);
    const h = await scrypt(senha, sal, 64);
    return `scrypt$${sal.toString("hex")}$${h.toString("hex")}`;
}
async function confere(senha, guardado) {
    const [alg, sal, h] = String(guardado).split("$");
    if (alg !== "scrypt") return false;
    const novo = await scrypt(senha, Buffer.from(sal, "hex"), 64);
    const velho = Buffer.from(h, "hex");
    return novo.length === velho.length && crypto.timingSafeEqual(novo, velho);
}
async function abrirSessao(usuarioId) {
    const token = crypto.randomBytes(32).toString("hex");
    await pool.execute(
        "INSERT INTO sessoes (token_hash, usuario_id, expira_em) VALUES (?, ?, datetime('now', ?))",
        [sha(token), usuarioId, `+${DIAS_SESSAO} days`]
    );
    return token;
}

// Usuário logado (Authorization: Bearer <token>) ou null.
export async function usuarioDe(req) {
    const m = /^Bearer ([0-9a-f]{64})$/.exec(req.get("authorization") || "");
    if (!m) return null;
    const [[u]] = await pool.query(
        `SELECT u.id, u.nome, u.email, u.telefone FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
         WHERE s.token_hash = ? AND s.expira_em > datetime('now')`, [sha(m[1])]);
    return u || null;
}

// Freio simples contra tentativas de senha em sequência (por IP+e-mail).
const falhas = new Map();
const bloqueado = (k) => { const f = falhas.get(k); return f && f.n >= 8 && Date.now() - f.t < 15 * 60 * 1000; };
const falhou = (k) => { const f = falhas.get(k); falhas.set(k, { n: (f && Date.now() - f.t < 15 * 60 * 1000 ? f.n : 0) + 1, t: Date.now() }); };

const r = Router();
const publico = (u) => ({ id: u.id, nome: u.nome, email: u.email, telefone: u.telefone || "" });

r.post("/auth/cadastro", async (req, res) => {
    const nome = txt(req.body?.nome, 120), email = txt(req.body?.email, 160).toLowerCase();
    const telefone = txt(req.body?.telefone, 30), senha = String(req.body?.senha || "");
    if (nome.length < 2) return res.status(400).json({ mensagem: "Informe seu nome." });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ mensagem: "E-mail inválido." });
    if (senha.length < 8 || !/\d/.test(senha) || !/[a-z]/.test(senha) || !/[A-Z]/.test(senha) || senha.length > 200)
        return res.status(400).json({ mensagem: "A senha precisa ter 8+ caracteres, com letra maiúscula, minúscula e número." });
    const [[ja]] = await pool.query("SELECT id FROM usuarios WHERE email = ?", [email]);
    if (ja) return res.status(409).json({ mensagem: "Este e-mail já está cadastrado." });
    try {
        const [ins] = await pool.execute("INSERT INTO usuarios (nome, email, telefone, senha_hash) VALUES (?, ?, ?, ?)",
            [nome, email, telefone || null, await hashSenha(senha)]);
        const token = await abrirSessao(ins.insertId);
        res.status(201).json({ sucesso: true, token, usuario: publico({ id: ins.insertId, nome, email, telefone }) });
    } catch (e) {
        if (e.code === "ER_DUP_ENTRY") return res.status(409).json({ mensagem: "Este e-mail já está cadastrado." });
        throw e;
    }
});

r.post("/auth/login", async (req, res) => {
    const email = txt(req.body?.email, 160).toLowerCase(), senha = String(req.body?.senha || "");
    const chave = `${req.ip}|${email}`;
    if (bloqueado(chave)) return res.status(429).json({ mensagem: "Muitas tentativas. Aguarde alguns minutos." });
    const [[u]] = await pool.query("SELECT * FROM usuarios WHERE email = ?", [email]);
    if (!u || !(await confere(senha, u.senha_hash))) {
        falhou(chave);
        return res.status(401).json({ mensagem: "E-mail ou senha incorretos." });
    }
    falhas.delete(chave);
    res.json({ sucesso: true, token: await abrirSessao(u.id), usuario: publico(u) });
});

r.get("/auth/me", async (req, res) => {
    const u = await usuarioDe(req);
    if (!u) return res.status(401).json({ mensagem: "Sessão expirada. Entre novamente." });
    res.json({ usuario: publico(u) });
});

r.post("/auth/logout", async (req, res) => {
    const m = /^Bearer ([0-9a-f]{64})$/.exec(req.get("authorization") || "");
    if (m) await pool.execute("DELETE FROM sessoes WHERE token_hash = ?", [sha(m[1])]);
    res.json({ sucesso: true });
});

// Coletas da conta logada (com o comprovante, que dá a visão completa do rastreio).
r.get("/minhas-coletas", async (req, res) => {
    const u = await usuarioDe(req);
    if (!u) return res.status(401).json({ mensagem: "Entre na sua conta para ver suas coletas." });
    const [rows] = await pool.query(`SELECT a.id, a.token, a.dia, a.hora, a.rua, a.casa, a.bairro, a.quantidade_litros, a.litros_coletados,
        (SELECT status FROM movimentacoes m WHERE m.agendamento_id = a.id ORDER BY m.data_hora DESC, m.id DESC LIMIT 1) AS status
        FROM agendamentos a WHERE a.usuario_id = ? ORDER BY a.id DESC LIMIT 200`, [u.id]);
    res.json(rows.map((a) => ({
        codigo: codigo(a.id), token: a.token, dia: a.dia, hora: a.hora, endereco: `${a.rua}, ${a.casa} - ${a.bairro}`,
        status: a.status || "AGENDADA", litrosPrevistos: Number(a.quantidade_litros),
        litrosColetados: a.litros_coletados == null ? null : Number(a.litros_coletados),
    })));
});

export default r;
