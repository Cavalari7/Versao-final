import { Router } from "express";
import crypto from "node:crypto";
import { db } from "./db.js";
import { baseOrigem, rotaDaEntrega } from "./google.js";

// Acesso da equipe: enquanto não existe login, uma chave (ADMIN_KEY) enviada no cabeçalho x-admin-key.
// Troque pelo login real quando ele existir. Defina ADMIN_KEY no ambiente em produção.
const ADMIN_KEY = process.env.ADMIN_KEY || "bioleo-admin";
if (!process.env.ADMIN_KEY) {
    if (process.env.NODE_ENV === "production") { console.error("[rastreio] Defina ADMIN_KEY em produção."); process.exit(1); }
    console.warn("[rastreio] ADMIN_KEY não definida: usando a chave de DESENVOLVIMENTO.");
}

export const pool = db;
const ID_RE = /^BO-(\d{5})$/;

export const codigo = (id) => "BO-" + String(id).padStart(5, "0");
const iguais = (a, b) => {
    const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
    return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
};
const ehAdmin = (req) => iguais(req.get("x-admin-key"), ADMIN_KEY);
export const exigirAdmin = (req, res, next) =>
    ehAdmin(req) ? next() : res.status(401).json({ mensagem: "Acesso restrito à equipe." });
const iso = (s) => (s ? String(s).replace(" ", "T") : null);
const txt = (v, n) => String(v || "").trim().slice(0, n);

// Chamado pelo POST /salvar-agendamento: todo agendamento nasce com o status AGENDADA.
export async function registrarAgendamentoCriado(conn, id, dia, hora) {
    await conn.execute("INSERT INTO movimentacoes (agendamento_id, status, obs) VALUES (?, 'AGENDADA', ?)", [
        id, `Coleta prevista para ${dia} às ${hora}`,
    ]);
}

async function carregar(id) {
    const [[a]] = await pool.query("SELECT * FROM agendamentos WHERE id = ?", [id]);
    if (!a) return null;
    const [movs] = await pool.query(
        "SELECT status, data_hora, local, responsavel, obs FROM movimentacoes WHERE agendamento_id = ? ORDER BY data_hora, id", [id]);
    return { a, movs };
}

const r = Router();

// Configuração pública do mapa. A chave do navegador é pública por natureza (por isso deve ter restrição por domínio);
// a chave secreta do servidor nunca sai daqui.
r.get("/config/mapa", (_req, res) => {
    const chave = process.env.GOOGLE_MAPS_BROWSER_KEY || "";
    res.json({ provedor: chave ? "google" : "osm", chave, mapId: process.env.GOOGLE_MAP_ID || "DEMO_MAP_ID" });
});

// Consulta de um frasco. Visão completa: chave da equipe OU token do próprio cliente. Senão: só ID e status.
r.get("/frascos/:id", async (req, res) => {
    const m = ID_RE.exec(String(req.params.id).toUpperCase());
    if (!m) return res.status(400).json({ mensagem: "ID inválido." });
    const id = parseInt(m[1], 10);
    const d = await carregar(id);
    if (!d) return res.status(404).json({ mensagem: "Frasco não encontrado." });
    const { a, movs } = d;
    const movimentacoes = movs.map((x) => ({
        status: x.status, dataHora: iso(x.data_hora), local: x.local || "", responsavel: x.responsavel || "", obs: x.obs || "",
    }));
    const completo = req.query.visao !== "publica" && (ehAdmin(req) || iguais(req.query.t, a.token));
    if (!completo) {
        return res.json({ id: codigo(id), publico: true, movimentacoes: movimentacoes.map(({ status, dataHora }) => ({ status, dataHora })) });
    }
    const atual = movimentacoes.length ? movimentacoes[movimentacoes.length - 1].status : null;
    const encerrado = atual === "COLETADO" || atual === "CANCELADA"; // depois de encerrada, a posição da equipe não é mais exposta
    let loc = null;
    if (!encerrado) {
        [[loc]] = await pool.query(
            "SELECT lat, lng, data_hora, responsavel FROM localizacoes WHERE agendamento_id = ? ORDER BY data_hora DESC, id DESC LIMIT 1", [id]);
    }
    const destino = a.destino_lat == null ? null : { lat: Number(a.destino_lat), lng: Number(a.destino_lng), aproximado: !!a.destino_aproximado };
    const equipe = loc ? { lat: Number(loc.lat), lng: Number(loc.lng) } : null;
    const origem = encerrado ? null : await baseOrigem();
    const rota = encerrado ? null : await rotaDaEntrega(id, origem, equipe, destino);
    res.json({
        id: codigo(id), cliente: a.nome, pedido: "#" + String(id).padStart(4, "0"), bairro: a.bairro,
        endereco: `${a.rua}, ${a.casa} - ${a.bairro}`, dataPrevista: `${a.dia} ${a.hora}`,
        litrosPrevistos: Number(a.quantidade_litros),
        litrosColetados: a.litros_coletados == null ? null : Number(a.litros_coletados),
        responsavel: [...movimentacoes].reverse().map((x) => x.responsavel).find(Boolean) || "",
        destino, origem, rota,
        localizacao: loc ? { lat: Number(loc.lat), lng: Number(loc.lng), dataHora: iso(loc.data_hora), responsavel: loc.responsavel || "" } : null,
        movimentacoes,
    });
});

// Lista para o painel da empresa.
r.get("/admin/frascos", exigirAdmin, async (_req, res) => {
    const [rows] = await pool.query(`SELECT a.id, a.token, a.nome, a.telefone, a.dia, a.hora, a.rua, a.casa, a.bairro,
        a.quantidade_litros, a.litros_coletados,
        (SELECT status FROM movimentacoes m WHERE m.agendamento_id = a.id ORDER BY m.data_hora DESC, m.id DESC LIMIT 1) AS status
        FROM agendamentos a ORDER BY a.id DESC LIMIT 500`);
    res.json(rows.map((a) => ({
        id: codigo(a.id), token: a.token, cliente: a.nome, telefone: a.telefone, dia: a.dia, hora: a.hora,
        endereco: `${a.rua}, ${a.casa} - ${a.bairro}`, bairro: a.bairro, status: a.status || "AGENDADA",
        litrosPrevistos: Number(a.quantidade_litros), litrosColetados: a.litros_coletados == null ? null : Number(a.litros_coletados),
    })));
});

// Registra uma etapa nova: ENTREGUE, EM_ROTA, COLETADO ou CANCELADA. Só a equipe.
r.post("/frascos/:id/movimentacoes", exigirAdmin, async (req, res) => {
    const m = ID_RE.exec(String(req.params.id).toUpperCase());
    if (!m) return res.status(400).json({ mensagem: "ID inválido." });
    const id = parseInt(m[1], 10);
    const { status, litrosColetados, obs } = req.body || {};
    if (!["ENTREGUE", "EM_ROTA", "COLETADO", "CANCELADA"].includes(status)) return res.status(400).json({ mensagem: "Status inválido." });
    const d = await carregar(id);
    if (!d) return res.status(404).json({ mensagem: "Frasco não encontrado." });
    const atual = d.movs.length ? d.movs[d.movs.length - 1].status : null;
    if (atual === "COLETADO" || atual === "CANCELADA") return res.status(409).json({ mensagem: "Este frasco já foi encerrado." });
    if (status === "EM_ROTA" && atual === "EM_ROTA") return res.json({ sucesso: true, jaEmRota: true });
    if (status === "ENTREGUE" && atual !== "AGENDADA") return res.status(409).json({ mensagem: "A entrega só pode ser registrada logo após o agendamento." });
    if (status === "COLETADO") {
        const l = Number(litrosColetados);
        if (!(l > 0 && l <= 100000)) return res.status(400).json({ mensagem: "Informe os litros coletados (maior que zero)." });
        await pool.execute("UPDATE agendamentos SET litros_coletados = ? WHERE id = ?", [l, id]);
    }
    const local = status === "CANCELADA" ? null : d.a.endereco || `${d.a.rua}, ${d.a.casa} - ${d.a.bairro}`;
    await pool.execute("INSERT INTO movimentacoes (agendamento_id, status, local, responsavel, obs) VALUES (?, ?, ?, ?, ?)", [
        id, status, local, txt(req.get("x-responsavel"), 80) || "Equipe Bio Óleo", txt(obs, 255) || null,
    ]);
    res.status(201).json({ sucesso: true });
});

// Registra a posição informada por um coletor autorizado.
r.post("/frascos/:id/localizacoes", exigirAdmin, async (req, res) => {
    const m = ID_RE.exec(String(req.params.id).toUpperCase());
    if (!m) return res.status(400).json({ mensagem: "ID inválido." });
    const id = parseInt(m[1], 10);
    const { lat, lng, precisaoM } = req.body || {};
    if (typeof lat !== "number" || typeof lng !== "number" || !isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
        return res.status(400).json({ mensagem: "Coordenadas inválidas." });
    const d = await carregar(id);
    if (!d) return res.status(404).json({ mensagem: "Frasco não encontrado." });
    const ult = d.movs.length ? d.movs[d.movs.length - 1].status : null;
    if (ult === "COLETADO" || ult === "CANCELADA") return res.status(409).json({ mensagem: "Esta coleta já foi encerrada." });
    await pool.execute("INSERT INTO localizacoes (agendamento_id, lat, lng, precisao_m, responsavel) VALUES (?, ?, ?, ?, ?)", [
        id, lat, lng, Number.isFinite(precisaoM) ? Math.round(precisaoM) : null, txt(req.get("x-responsavel"), 80) || "Equipe Bio Óleo",
    ]);
    res.status(201).json({ persistido: true });
});

// A equipe marca (ou corrige) o local da coleta no mapa quando a busca automática do endereço falha ou erra.
r.put("/frascos/:id/destino", exigirAdmin, async (req, res) => {
    const m = ID_RE.exec(String(req.params.id).toUpperCase());
    if (!m) return res.status(400).json({ mensagem: "ID inválido." });
    const { lat, lng } = req.body || {};
    if (typeof lat !== "number" || typeof lng !== "number" || !isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
        return res.status(400).json({ mensagem: "Coordenadas inválidas." });
    const [r2] = await pool.execute("UPDATE agendamentos SET destino_lat = ?, destino_lng = ?, destino_aproximado = 0 WHERE id = ?", [lat, lng, parseInt(m[1], 10)]);
    if (!r2.affectedRows) return res.status(404).json({ mensagem: "Frasco não encontrado." });
    res.json({ sucesso: true });
});

export default r;
