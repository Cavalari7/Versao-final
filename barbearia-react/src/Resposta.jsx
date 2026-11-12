import { linkRastreio } from "./api";

// Janela de resposta do agendamento: sempre visível no centro da tela.
export default function Resposta({ mensagem, onFechar }) {
  if (!mensagem) return null;
  const m = typeof mensagem === "string" ? { tipo: "erro", texto: mensagem } : mensagem;
  const cor = m.tipo === "ok" ? "#22c55e" : m.tipo === "erro" ? "#ef4444" : "#ffd21f";
  return (
    <div role="alertdialog" aria-live="assertive" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", display: "grid", placeItems: "center", zIndex: 50, padding: 16 }}>
      <div className="bo-card" style={{ maxWidth: 460, width: "100%", textAlign: "center", borderColor: cor, display: "grid", gap: 14 }}>
        <h2 style={{ color: cor }}>{m.tipo === "ok" ? "Agendamento confirmado!" : m.tipo === "erro" ? "Algo deu errado" : "Enviando…"}</h2>
        <p style={{ margin: 0, color: "#fff" }}>{m.texto}</p>
        {m.tipo !== "carregando" && (
          <div className="bo-acoes" style={{ justifyContent: "center" }}>
            {m.tipo === "ok" && <a className="bo-btn bo-btn-ouro" href={linkRastreio(m.codigo, m.token)}>Acompanhar coleta</a>}
            {m.tipo === "ok" && <a className="bo-btn" href="#/minhas-coletas">Minhas coletas</a>}
            <button className="bo-btn" type="button" onClick={onFechar}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}
