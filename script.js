/* ===== DADOS ===== */
const MESES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];
const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const LOCAIS = {
    residencia: { nome: "Residência", quantidades: [5, 10, 20, 50], padrao: 20 },
    comercial: { nome: "Restaurante, condomínio ou indústria", quantidades: [50, 100, 200, 500], padrao: 100 }
};

const PERIODOS = {
    manha: { nome: "Manhã", horario: "8h às 12h" },
    tarde: { nome: "Tarde", horario: "13h às 17h" }
};

/* ===== ESTADO ===== */
const hoje = new Date();
hoje.setHours(0, 0, 0, 0);

const estado = {
    local: "residencia",
    quantidade: 20,
    periodo: "manha",
    data: null,                                   // objeto Date
    mesVisivel: new Date(hoje.getFullYear(), hoje.getMonth(), 1)
};

/* ===== ELEMENTOS ===== */
const $ = (id) => document.getElementById(id);

const el = {
    form: $("formAgendamento"),
    tipoLocal: $("tipoLocal"),
    endereco: $("endereco"),
    enderecoWrap: $("enderecoWrap"),
    erroEndereco: $("erroEndereco"),
    quantidades: $("quantidades"),
    obs: $("obs"),
    tituloMes: $("tituloMes"),
    diasMes: $("diasMes"),
    mesAnterior: $("mesAnterior"),
    proximoMes: $("proximoMes"),
    erroData: $("erroData"),
    periodos: $("periodos"),
    resLocal: $("resLocal"),
    resData: $("resData"),
    resPeriodo: $("resPeriodo"),
    resOleo: $("resOleo"),
    modal: $("modal"),
    modalTexto: $("modalTexto"),
    modalProtocolo: $("modalProtocolo"),
    fecharModal: $("fecharModal")
};

/* ===== UTILITÁRIOS ===== */
const mesmoDia = (a, b) =>
    a && b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

// Só permite datas futuras e que não sejam domingo
const dataDisponivel = (d) => d > hoje && d.getDay() !== 0;

function formatarData(d) {
    return `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()}`;
}

// Primeira data disponível, a partir de 3 dias à frente
function dataInicial() {
    const d = new Date(hoje);
    d.setDate(d.getDate() + 3);
    while (!dataDisponivel(d)) d.setDate(d.getDate() + 1);
    return d;
}

/* ===== TIPO DE LOCAL ===== */
el.tipoLocal.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-local]");
    if (!btn) return;

    estado.local = btn.dataset.local;
    el.tipoLocal.querySelectorAll(".pill").forEach((b) => b.classList.toggle("active", b === btn));

    // Ajusta as opções de litros para o tipo de local
    estado.quantidade = LOCAIS[estado.local].padrao;
    renderQuantidades();
    atualizarResumo();
});

/* ===== QUANTIDADE ===== */
function renderQuantidades() {
    el.quantidades.innerHTML = "";
    LOCAIS[estado.local].quantidades.forEach((litros) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "qty" + (litros === estado.quantidade ? " active" : "");
        btn.textContent = `${litros} L`;
        btn.addEventListener("click", () => {
            estado.quantidade = litros;
            renderQuantidades();
            atualizarResumo();
        });
        el.quantidades.appendChild(btn);
    });
}

/* ===== CALENDÁRIO ===== */
function renderCalendario() {
    const ano = estado.mesVisivel.getFullYear();
    const mes = estado.mesVisivel.getMonth();

    el.tituloMes.textContent = `${MESES[mes]} ${ano}`;
    el.diasMes.innerHTML = "";

    // Células vazias antes do dia 1
    const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
    for (let i = 0; i < primeiroDiaSemana; i++) {
        el.diasMes.appendChild(document.createElement("span"));
    }

    const totalDias = new Date(ano, mes + 1, 0).getDate();
    for (let dia = 1; dia <= totalDias; dia++) {
        const data = new Date(ano, mes, dia);
        const btn = document.createElement("button");

        btn.type = "button";
        btn.className = "day";
        btn.textContent = dia;
        btn.disabled = !dataDisponivel(data);

        if (mesmoDia(data, hoje)) btn.classList.add("today");
        if (mesmoDia(data, estado.data)) btn.classList.add("selected");

        btn.addEventListener("click", () => {
            estado.data = data;
            el.erroData.hidden = true;
            renderCalendario();
            atualizarResumo();
        });

        el.diasMes.appendChild(btn);
    }

    // Não deixa voltar para meses que já passaram
    const mesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    el.mesAnterior.disabled = estado.mesVisivel <= mesAtual;
}

el.mesAnterior.addEventListener("click", () => {
    estado.mesVisivel = new Date(estado.mesVisivel.getFullYear(), estado.mesVisivel.getMonth() - 1, 1);
    renderCalendario();
});

el.proximoMes.addEventListener("click", () => {
    estado.mesVisivel = new Date(estado.mesVisivel.getFullYear(), estado.mesVisivel.getMonth() + 1, 1);
    renderCalendario();
});

/* ===== PERÍODO ===== */
el.periodos.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-periodo]");
    if (!btn) return;

    estado.periodo = btn.dataset.periodo;
    el.periodos.querySelectorAll(".period").forEach((b) => b.classList.toggle("active", b === btn));
    atualizarResumo();
});

/* ===== RESUMO ===== */
function atualizarResumo() {
    const periodo = PERIODOS[estado.periodo];

    el.resLocal.textContent = LOCAIS[estado.local].nome;
    el.resData.textContent = estado.data ? formatarData(estado.data) : "—";
    el.resPeriodo.textContent = `${periodo.nome}, ${periodo.horario}`;
    el.resOleo.textContent = `${estado.quantidade} L`;
}

/* ===== VALIDAÇÃO ===== */
el.endereco.addEventListener("input", () => {
    el.enderecoWrap.classList.remove("invalid");
    el.erroEndereco.hidden = true;
});

function validar() {
    let valido = true;

    if (el.endereco.value.trim().length < 8) {
        el.enderecoWrap.classList.add("invalid");
        el.erroEndereco.hidden = false;
        el.endereco.focus();
        valido = false;
    }

    if (!estado.data) {
        el.erroData.hidden = false;
        valido = false;
    }

    return valido;
}

/* ===== ENVIO ===== */
el.form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validar()) return;

    const protocolo = "BO-" + Date.now().toString(36).toUpperCase().slice(-6);
    const periodo = PERIODOS[estado.periodo];

    const agendamento = {
        protocolo,
        local: estado.local,
        endereco: el.endereco.value.trim(),
        quantidade: estado.quantidade,
        observacoes: el.obs.value.trim(),
        data: estado.data.toISOString(),
        periodo: estado.periodo,
        criadoEm: new Date().toISOString()
    };

    // Guarda no navegador (troque por um fetch() para o seu back-end quando tiver)
    try {
        const lista = JSON.parse(localStorage.getItem("agendamentos") || "[]");
        lista.push(agendamento);
        localStorage.setItem("agendamentos", JSON.stringify(lista));
    } catch (err) {
        console.warn("Não foi possível salvar o agendamento localmente.", err);
    }

    el.modalTexto.textContent =
        `${formatarData(estado.data)}, ${periodo.nome.toLowerCase()} (${periodo.horario}). ` +
        `O coletor vai buscar cerca de ${estado.quantidade} L de óleo no endereço informado.`;
    el.modalProtocolo.textContent = protocolo;
    abrirModal();
});

/* ===== MODAL ===== */
function abrirModal() {
    el.modal.hidden = false;
    el.fecharModal.focus();
}
function fecharModal() {
    el.modal.hidden = true;
}

el.fecharModal.addEventListener("click", fecharModal);
el.modal.addEventListener("click", (e) => { if (e.target === el.modal) fecharModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !el.modal.hidden) fecharModal(); });

/* ===== INICIALIZAÇÃO ===== */
function iniciar() {
    estado.data = dataInicial();
    estado.mesVisivel = new Date(estado.data.getFullYear(), estado.data.getMonth(), 1);

    renderQuantidades();
    renderCalendario();
    atualizarResumo();
}

iniciar();