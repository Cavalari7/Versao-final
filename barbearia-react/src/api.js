// Ponto único de acesso à API e ao armazenamento local do navegador.

// Em produção, configure VITE_API_URL com o endereço do backend.
// Localmente, utiliza a porta 3000 do computador.

const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? `http://${location.hostname}:3000` : "");

export const API = API_URL.replace(/\/+$/, "");

// Status das coletas
export const STATUS = {
  AGENDADA: "Coleta agendada",
  ENTREGUE: "Frasco entregue",
  EM_ROTA: "Equipe a caminho",
  COLETADO: "Coletado",
  CANCELADA: "Cancelada"
};

// Formatação de datas
export const fmt = (d) =>
  d
    ? new Date(d).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short"
      })
    : "—";

// Status atual do frasco
export const statusAtual = (f) =>
  f?.movimentacoes?.length
    ? f.movimentacoes[f.movimentacoes.length - 1].status
    : null;

// Link de rastreamento
export const linkRastreio = (id, t) =>
  `/rastreio/rastreio.html?id=${id}${t ? `&t=${t}` : ""}`;

// ========================================
// ARMAZENAMENTO LOCAL DAS COLETAS
// ========================================

// Coletas feitas neste aparelho: { codigo, token }.
// O token permite acessar os dados do próprio cliente.

export const lerColetas = () => {
  try {
    return JSON.parse(localStorage.getItem("bioleo_coletas")) || [];
  } catch {
    return [];
  }
};

export const salvarColetas = (l) => {
  try {
    localStorage.setItem("bioleo_coletas", JSON.stringify(l));
  } catch {
    // Armazenamento bloqueado
  }
};

// ========================================
// CHAVE ADMINISTRATIVA
// ========================================

export const lerChave = () => {
  try {
    return localStorage.getItem("bioleo_admin_key") || "";
  } catch {
    return "";
  }
};

export const salvarChave = (k) => {
  try {
    localStorage.setItem("bioleo_admin_key", k);
  } catch {
    // Armazenamento bloqueado
  }
};

// ========================================
// SESSÃO DO USUÁRIO
// ========================================

// O token de autenticação fica armazenado somente neste navegador.

export const lerSessao = () => {
  try {
    return JSON.parse(localStorage.getItem("bioleo_sessao")) || null;
  } catch {
    return null;
  }
};

export const salvarSessao = (s) => {
  try {
    if (s) {
      localStorage.setItem("bioleo_sessao", JSON.stringify(s));
    } else {
      localStorage.removeItem("bioleo_sessao");
    }
  } catch {
    // Armazenamento bloqueado
  }
};

// ========================================
// AUTENTICAÇÃO
// ========================================

export const authHeaders = () => {
  const s = lerSessao();

  return s?.token
    ? { Authorization: `Bearer ${s.token}` }
    : {};
};

// Encerrar sessão
export async function sair() {
  try {
    await fetch(`${API}/api/auth/logout`, {
      method: "POST",
      headers: authHeaders()
    });
  } catch {
    // Sem conexão: encerra somente a sessão local
  }

  salvarSessao(null);
}