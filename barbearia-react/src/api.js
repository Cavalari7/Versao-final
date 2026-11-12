// Ponto único de acesso à API e ao armazenamento local do navegador.
// Em produção, defina VITE_API_URL (ex.: https://api.seudominio.com.br) antes do build.
export const API = import.meta.env.VITE_API_URL || `http://${location.hostname}:3000`;
export const STATUS = { AGENDADA: "Coleta agendada", ENTREGUE: "Frasco entregue", EM_ROTA: "Equipe a caminho", COLETADO: "Coletado", CANCELADA: "Cancelada" };
export const fmt = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
export const statusAtual = (f) => (f?.movimentacoes?.length ? f.movimentacoes[f.movimentacoes.length - 1].status : null);
export const linkRastreio = (id, t) => `/rastreio/rastreio.html?id=${id}${t ? `&t=${t}` : ""}`;

// Coletas feitas neste aparelho: { codigo, token }. O token é o "comprovante" que dá acesso aos dados do próprio cliente.
export const lerColetas = () => {
  try { return JSON.parse(localStorage.getItem("bioleo_coletas")) || []; } catch { return []; }
};
export const salvarColetas = (l) => {
  try { localStorage.setItem("bioleo_coletas", JSON.stringify(l)); } catch { /* armazenamento bloqueado */ }
};
export const lerChave = () => {
  try { return localStorage.getItem("bioleo_admin_key") || ""; } catch { return ""; }
};
export const salvarChave = (k) => {
  try { localStorage.setItem("bioleo_admin_key", k); } catch { /* armazenamento bloqueado */ }
};

// Sessão do usuário (login). O token fica só neste navegador.
export const lerSessao = () => {
  try { return JSON.parse(localStorage.getItem("bioleo_sessao")) || null; } catch { return null; }
};
export const salvarSessao = (s) => {
  try { s ? localStorage.setItem("bioleo_sessao", JSON.stringify(s)) : localStorage.removeItem("bioleo_sessao"); } catch { /* armazenamento bloqueado */ }
};
export const authHeaders = () => { const s = lerSessao(); return s?.token ? { Authorization: `Bearer ${s.token}` } : {}; };
export async function sair() {
  try { await fetch(`${API}/api/auth/logout`, { method: "POST", headers: authHeaders() }); } catch { /* sem rede: encerra só localmente */ }
  salvarSessao(null);
}
