import { DatabaseSync } from "node:sqlite"; // SQLite embutido no Node 22.13+ (nada para compilar)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Banco SQLite: um arquivo local, sem instalar nem ligar servidor. Troque o caminho com DB_FILE.
const aqui = path.dirname(fileURLToPath(import.meta.url));
export const arquivoBanco = process.env.DB_FILE || path.join(aqui, "dados", "bioleo.db");
fs.mkdirSync(path.dirname(arquivoBanco), { recursive: true });
const sqlite = new DatabaseSync(arquivoBanco);
sqlite.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");

const limpa = (p) => (p || []).map((v) => (v === undefined ? null : typeof v === "boolean" ? Number(v) : v));

// Mesma interface do mysql2/promise usada no resto do código: query/execute devolvem [linhas] ou [{insertId, affectedRows}].
async function rodar(sql, params) {
    try {
        const st = sqlite.prepare(sql);
        if (/^\s*(select|with|pragma)\b/i.test(sql)) return [st.all(...limpa(params)).map((r) => ({ ...r }))];
        const r = st.run(...limpa(params));
        return [{ insertId: Number(r.lastInsertRowid), affectedRows: r.changes }];
    } catch (e) {
        if (e.errcode === 19 || /constraint/i.test(String(e.message))) e.code = "ER_DUP_ENTRY";
        throw e;
    }
}
export const db = { query: rodar, execute: rodar };

const LOCAL = "(datetime('now','localtime'))";

// Cria as tabelas e adapta a tabela "agendamentos" sem apagar dados. Pode rodar quantas vezes quiser.
export async function ensureSchema() {
    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS agendamentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL, telefone TEXT NOT NULL, dia TEXT NOT NULL, hora TEXT NOT NULL,
            rua TEXT NOT NULL, casa TEXT NOT NULL, bairro TEXT NOT NULL, complemento TEXT NULL,
            quantidade_litros REAL NOT NULL, observacoes TEXT NULL
        );
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
            telefone TEXT NULL, senha_hash TEXT NOT NULL, criado_em TEXT NOT NULL DEFAULT ${LOCAL}
        );
        CREATE TABLE IF NOT EXISTS sessoes (
            token_hash TEXT PRIMARY KEY, usuario_id INTEGER NOT NULL,
            criado_em TEXT NOT NULL DEFAULT ${LOCAL}, expira_em TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ix_sessoes_usuario ON sessoes (usuario_id);
        CREATE TABLE IF NOT EXISTS movimentacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT, agendamento_id INTEGER NOT NULL,
            status TEXT NOT NULL, data_hora TEXT NOT NULL DEFAULT ${LOCAL},
            local TEXT NULL, responsavel TEXT NULL, obs TEXT NULL
        );
        CREATE INDEX IF NOT EXISTS ix_mov_ag ON movimentacoes (agendamento_id);
        CREATE TABLE IF NOT EXISTS termos (
            id INTEGER PRIMARY KEY AUTOINCREMENT, agendamento_id INTEGER NOT NULL UNIQUE,
            tipo TEXT NOT NULL, nome_responsavel TEXT NOT NULL, assinatura TEXT NULL,
            registrado_por TEXT NULL, criado_em TEXT NOT NULL DEFAULT ${LOCAL}
        );
        CREATE TABLE IF NOT EXISTS localizacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT, agendamento_id INTEGER NOT NULL,
            lat REAL NOT NULL, lng REAL NOT NULL, precisao_m INTEGER NULL,
            data_hora TEXT NOT NULL DEFAULT ${LOCAL}, responsavel TEXT NULL
        );
        CREATE INDEX IF NOT EXISTS ix_loc_ag ON localizacoes (agendamento_id);
    `);
    const tem = new Set(sqlite.prepare("PRAGMA table_info(agendamentos)").all().map((c) => c.name));
    const novas = {
        token: "TEXT NULL", litros_coletados: "REAL NULL", destino_lat: "REAL NULL", destino_lng: "REAL NULL",
        destino_aproximado: "INTEGER NOT NULL DEFAULT 1", usuario_id: "INTEGER NULL",
    };
    for (const [nome, def] of Object.entries(novas)) {
        if (!tem.has(nome)) sqlite.exec(`ALTER TABLE agendamentos ADD COLUMN ${nome} ${def}`);
    }
    sqlite.exec("UPDATE agendamentos SET token = lower(hex(randomblob(16))) WHERE token IS NULL");
    // Agendamentos antigos (sem histórico) entram como "AGENDADA".
    sqlite.exec(`INSERT INTO movimentacoes (agendamento_id, status, obs)
        SELECT a.id, 'AGENDADA', 'Agendamento anterior ao rastreio' FROM agendamentos a
        WHERE NOT EXISTS (SELECT 1 FROM movimentacoes m WHERE m.agendamento_id = a.id)`);
}

// Privacidade (LGPD): posições antigas são apagadas. Padrão: 30 dias (RETENCAO_DIAS).
export async function limparLocalizacoes() {
    const dias = Math.max(1, parseInt(process.env.RETENCAO_DIAS || "30", 10) || 30);
    const [r] = await db.execute("DELETE FROM localizacoes WHERE data_hora < datetime('now','localtime', ?)", [`-${dias} days`]);
    return r.affectedRows;
}
