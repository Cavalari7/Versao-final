/* ===== ELEMENTOS ===== */
const $ = (id) => document.getElementById(id);

const el = {
    qr: $("qr"),
    statusAtual: $("statusAtual"),
    statusTexto: $("statusTexto"),
    linhaTempo: $("linhaTempo")
};

/* ===== DADOS ===== */
// Texto e estilo do status conforme quantas etapas foram concluídas
const STATUS = [
    { texto: "AGUARDANDO", classe: "aguardando" },
    { texto: "ENTREGUE", classe: "andamento" },
    { texto: "AGENDADO", classe: "andamento" },
    { texto: "COLETADO", classe: "" }
];

/* ===== QR CODE (decorativo) ===== */
// Padrão fixo, gerado sempre igual, com os 3 marcadores de canto
function desenharQr() {
    const ctx = el.qr.getContext("2d");
    const tamanho = 29;
    let semente = 3;

    const aleatorio = () => (semente = (semente * 16807) % 2147483647) / 2147483647;

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, tamanho, tamanho);

    ctx.fillStyle = "#000";
    for (let x = 0; x < tamanho; x++) {
        for (let y = 0; y < tamanho; y++) {
            if (aleatorio() > 0.52) ctx.fillRect(x, y, 1, 1);
        }
    }

    [[0, 0], [tamanho - 7, 0], [0, tamanho - 7]].forEach(([x, y]) => {
        ctx.fillStyle = "#fff"; ctx.fillRect(x - 1, y - 1, 9, 9);
        ctx.fillStyle = "#000"; ctx.fillRect(x, y, 7, 7);
        ctx.fillStyle = "#fff"; ctx.fillRect(x + 1, y + 1, 5, 5);
        ctx.fillStyle = "#000"; ctx.fillRect(x + 2, y + 2, 3, 3);
    });
}

/* ===== LINHA DO TEMPO ===== */
const etapas = [...el.linhaTempo.querySelectorAll(".etapa")];

function atualizarStatus() {
    const concluidas = etapas.filter((e) => e.classList.contains("feita")).length;
    const status = STATUS[concluidas];

    el.statusTexto.textContent = status.texto;
    el.statusAtual.className = "status-atual " + status.classe;
}

etapas.forEach((etapa, indice) => {
    etapa.addEventListener("click", () => {
        const marcar = !etapa.classList.contains("feita");

        // Clicar numa etapa marca ela e todas as anteriores
        etapas.forEach((e, i) => {
            e.classList.toggle("feita", marcar ? i <= indice : i < indice);
        });

        atualizarStatus();
    });
});

/* ===== INICIALIZAÇÃO ===== */
desenharQr();
atualizarStatus();
