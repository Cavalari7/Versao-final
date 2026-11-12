/* Termo de responsabilidade: grava o aceite no servidor e registra a entrega do frasco. */
const $ = (id) => document.getElementById(id);
const API = (window.BIOOLEO_API_URL || `http://${location.hostname}:3000`).replace(/\/$/, "");
const CHAVE = "bioleo_admin_key"; // mesma chave usada pelo app do entregador
let frascos = [];

/* ===== AVISO ===== */
let tempoAviso;
function mostrarAviso(texto, erro) {
    const a = $("aviso");
    a.textContent = texto;
    a.className = "aviso mostrar" + (erro ? " erro" : "");
    clearTimeout(tempoAviso);
    tempoAviso = setTimeout(() => a.classList.remove("mostrar"), 4500);
}

const chave = () => { try { return localStorage.getItem(CHAVE) || ""; } catch { return ""; } };
async function chamar(rota, opcoes = {}) {
    const r = await fetch(API + rota, { ...opcoes, headers: { "Content-Type": "application/json", "x-admin-key": chave(), "x-responsavel": "App do motorista", ...(opcoes.headers || {}) } });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, j };
}

/* ===== FRASCOS AGUARDANDO ENTREGA ===== */
function atual() { return frascos.find((f) => f.id === $("frasco").value); }
function mostrarFrasco() {
    const f = atual();
    $("dFrasco").textContent = f ? f.id : "—";
    $("tFrasco").textContent = f ? f.id : "—";
    $("dLocal").textContent = f ? f.endereco : "—";
    $("dData").textContent = f ? `${String(f.dia).slice(0, 10).split("-").reverse().join("/")} · ${String(f.hora).slice(0, 5)}` : "—";
    $("opcoes").hidden = !f;
    $("vazio").hidden = !!f;
}
async function carregar(preferido) {
    const r = await chamar("/api/admin/frascos");
    if (r.status === 401) { try { localStorage.removeItem(CHAVE); } catch { /* ignora */ } mostrarAviso("Chave da equipe incorreta.", true); return mostrarEntrada(); }
    if (!r.ok) return mostrarAviso("Não foi possível carregar os frascos. O backend está rodando?", true);
    frascos = r.j.filter((f) => f.status === "AGENDADA").reverse();
    $("frasco").innerHTML = frascos.map((f) => `<option value="${f.id}">${f.id} · ${f.cliente}</option>`).join("");
    if (preferido && frascos.some((f) => f.id === preferido)) $("frasco").value = preferido;
    $("blocoChave").hidden = true; $("blocoTermo").hidden = false;
    mostrarFrasco(); ajustarCanvas();
}
function mostrarEntrada() { $("blocoChave").hidden = false; $("blocoTermo").hidden = true; }
$("frasco").addEventListener("change", mostrarFrasco);
$("entrar").addEventListener("click", () => {
    try { localStorage.setItem(CHAVE, $("chave").value.trim()); } catch { /* ignora */ }
    carregar(new URLSearchParams(location.search).get("id"));
});

/* ===== ASSINATURA NA TELA ===== */
const canvas = $("assinatura");
const ctx = canvas.getContext("2d");
let desenhando = false;
let assinou = false;

function ajustarCanvas() {
    const m = canvas.getBoundingClientRect();
    if (!m.width) return;
    const escala = window.devicePixelRatio || 1;
    canvas.width = m.width * escala;
    canvas.height = m.height * escala;
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    ctx.strokeStyle = "#111"; // preto: a imagem salva tem fundo branco
    ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    assinou = false;
}
const posicao = (e) => { const m = canvas.getBoundingClientRect(); return [e.clientX - m.left, e.clientY - m.top]; };
canvas.addEventListener("pointerdown", (e) => { desenhando = true; canvas.setPointerCapture(e.pointerId); const [x, y] = posicao(e); ctx.beginPath(); ctx.moveTo(x, y); });
canvas.addEventListener("pointermove", (e) => { if (!desenhando) return; const [x, y] = posicao(e); ctx.lineTo(x, y); ctx.stroke(); assinou = true; });
["pointerup", "pointercancel"].forEach((ev) => canvas.addEventListener(ev, () => { desenhando = false; }));
$("limpar").addEventListener("click", () => { ctx.clearRect(0, 0, canvas.width, canvas.height); assinou = false; });
window.addEventListener("resize", () => { if (!$("blocoTermo").hidden) ajustarCanvas(); });

// PNG com fundo branco e largura reduzida (o servidor aceita até ~300 KB).
function assinaturaPng() {
    const w = Math.min(canvas.width, 600), h = Math.round(canvas.height * (w / canvas.width));
    const o = document.createElement("canvas"); o.width = w; o.height = h;
    const c = o.getContext("2d"); c.fillStyle = "#fff"; c.fillRect(0, 0, w, h); c.drawImage(canvas, 0, 0, w, h);
    return o.toDataURL("image/png");
}

async function enviar(corpo, botao) {
    const f = atual();
    if (!f) return mostrarAviso("Selecione um frasco.", true);
    botao.disabled = true;
    try {
        const r = await chamar(`/api/frascos/${f.id}/termo`, { method: "POST", body: JSON.stringify(corpo) });
        if (!r.ok) return mostrarAviso(r.j.mensagem || "Não foi possível registrar o termo.", true);
        mostrarAviso(`Entrega do frasco ${f.id} confirmada para ${corpo.nome}. Status: ENTREGUE.`);
        $("limpar").click(); $("nomeAssinatura").value = ""; $("nomeAceite").value = ""; $("concordo").checked = false;
        await carregar();
    } catch {
        mostrarAviso("Erro de conexão com o servidor.", true);
    } finally {
        botao.disabled = false;
    }
}

$("formAssinatura").addEventListener("submit", (e) => {
    e.preventDefault();
    const nome = $("nomeAssinatura").value.trim();
    if (!assinou) return mostrarAviso("Peça ao responsável para assinar na tela.", true);
    if (!nome) return mostrarAviso("Informe o nome do responsável.", true);
    enviar({ tipo: "ASSINATURA", nome, assinatura: assinaturaPng() }, e.submitter);
});
$("formAceite").addEventListener("submit", (e) => {
    e.preventDefault();
    const nome = $("nomeAceite").value.trim();
    if (!$("concordo").checked) return mostrarAviso("Marque que leu e concorda com os termos.", true);
    if (!nome) return mostrarAviso("Informe o nome do responsável.", true);
    enviar({ tipo: "ACEITE", nome }, e.submitter);
});

/* ===== INÍCIO ===== */
if (chave()) carregar(new URLSearchParams(location.search).get("id")); else mostrarEntrada();
