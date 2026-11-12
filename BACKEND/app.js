import "dotenv/config"; // lê o arquivo .env (chaves e senhas) antes de tudo
import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import { db, ensureSchema, limparLocalizacoes } from "./db.js";
import { agendarGeocodificacao } from "./geocodificar.js";
import auth, { usuarioDe } from "./auth.js";
import rastreio, { exigirAdmin, registrarAgendamentoCriado, codigo } from "./rastreio.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
app.use("/api", auth); // contas de usuário
app.use("/api", rastreio); // Rastreio e Monitoramento

app.post("/salvar-agendamento", async (req, res) => {
    const {
        nome,
        telefone,
        dia,
        hora,
        rua,
        casa,
        bairro,
        complemento,
        quantidade_litros,
        observacoes,
    } = req.body;

    if (!nome || !telefone || !dia || !hora || !rua || !casa || !bairro || !quantidade_litros) {
        return res
            .status(400)
            .json({ sucesso: false, mensagem: "Preencha todos os campos." });
    }

    const connection = db;

    try {
                const usuario = await usuarioDe(req); // opcional: se logado, o agendamento fica na conta
        const token = crypto.randomBytes(16).toString("hex"); // comprovante do cliente para acompanhar o frasco

        const insertQuery = `
            INSERT INTO agendamentos (nome, telefone, dia, hora, rua, casa, bairro, complemento, quantidade_litros, observacoes, token, usuario_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const [result] = await connection.execute(insertQuery, [
            nome,
            telefone,
            dia,
            hora,
            rua,
            casa,
            bairro,
            complemento || null,
            quantidade_litros,
            observacoes || null,
            token,
            usuario ? usuario.id : null,
        ]);
        await registrarAgendamentoCriado(connection, result.insertId, dia, hora); // rastreio: status AGENDADA
        agendarGeocodificacao(db, result.insertId, { rua, casa, bairro }); // rastreio: local no mapa (segundo plano)

        const mensagem = `Olá ${nome}, aguardamos você no dia ${dia} às ${hora} horas.`;

        res.status(200).json({
            sucesso: true,
            id: result.insertId,
            codigo: codigo(result.insertId),
            token,
            mensagem,
        });
    } catch (err) {
        console.error("Erro ao processar o agendamento:", err);
        res
            .status(500)
            .json({ sucesso: false, mensagem: "Erro ao salvar o agendamento" });
    }
});

// Dados pessoais de todos os clientes: só a equipe.
app.get("/listar-agendamento", exigirAdmin, async (_req, res) => {
    const connection = db;

    try {
        
        const [rows] = await connection.execute(
            "SELECT id, nome, telefone, dia, hora, rua, casa, bairro, complemento, quantidade_litros, observacoes FROM agendamentos"
        );
        res.status(200).json(rows);
    } catch (err) {
        console.error("Erro ao listar o agendamento:", err);
        res
            .status(500)
            .json({ mensagem: "Erro interno ao buscar o agendamento" });
    }
});

app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ mensagem: "Erro interno do servidor." });
});

try {
    await ensureSchema(); // cria banco/tabelas do rastreio se faltarem
} catch (err) {
    console.error("Não foi possível preparar o banco de dados:", err.message);
    process.exit(1);
}
limparLocalizacoes().catch((e) => console.warn("Limpeza de posições antigas falhou:", e.message));
setInterval(() => limparLocalizacoes().catch(() => {}), 24 * 3600 * 1000).unref();

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});