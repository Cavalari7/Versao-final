import { useCallback, useEffect, useState } from "react";
import Cabecalho from "./Cabecalho";
import { API, STATUS, lerChave, salvarChave, linkRastreio } from "./api";

function Linha({ f, agir }) {
  const [litros, setLitros] = useState(String(f.litrosPrevistos));
  const [aberto, setAberto] = useState(false);
  const ativo = ["AGENDADA", "ENTREGUE", "EM_ROTA"].includes(f.status);
  return (
    <article className="bo-card">
      <div className="bo-topo">
        <h2>{f.id}</h2>
        <span className={`bo-st bo-st-${f.status}`}>{STATUS[f.status] || f.status}</span>
      </div>
      <dl className="bo-dados">
        <div><dt>Cliente</dt><dd>{f.cliente} · {f.telefone}</dd></div>
        <div><dt>Endereço</dt><dd>{f.endereco}</dd></div>
        <div><dt>Data / hora</dt><dd>{f.dia?.split("-").reverse().join("/")} · {f.hora?.slice(0, 5)}</dd></div>
        <div><dt>Litros</dt><dd>{f.litrosPrevistos} L previstos{f.litrosColetados != null ? ` · ${f.litrosColetados} L coletados` : ""}</dd></div>
      </dl>
      {aberto && (
        <div className="bo-busca">
          <input className="ag-input" type="number" min="0.5" step="0.5" value={litros} onChange={(e) => setLitros(e.target.value)} aria-label="Litros coletados" />
          <button className="bo-btn bo-btn-verde" type="button" onClick={() => agir(f.id, { status: "COLETADO", litrosColetados: Number(litros) })}>Confirmar coleta</button>
        </div>
      )}
      <div className="bo-acoes">
        {ativo && <button className="bo-btn bo-btn-verde" type="button" onClick={() => setAberto(!aberto)}>Marcar como coletado</button>}
        {f.status === "AGENDADA" && <button className="bo-btn" type="button" onClick={() => agir(f.id, { status: "ENTREGUE" })}>Registrar entrega do frasco</button>}
        {ativo && <button className="bo-btn bo-btn-perigo" type="button" onClick={() => confirm(`Cancelar a coleta ${f.id}?`) && agir(f.id, { status: "CANCELADA" })}>Cancelar coleta</button>}
        <a className="bo-btn" href={linkRastreio(f.id)}>Rastreio, mapa e posição ao vivo</a>
      </div>
    </article>
  );
}

export default function PainelEmpresa() {
  const [chave, setChave] = useState(lerChave());
  const [lista, setLista] = useState(null);
  const [msg, setMsg] = useState("");
  const [filtro, setFiltro] = useState("TODOS");

  const carregar = useCallback(async (k) => {
    setMsg("");
    try {
      const r = await fetch(`${API}/api/admin/frascos`, { headers: { "x-admin-key": k } });
      if (r.status === 401) { setLista(null); return setMsg("Chave de acesso inválida."); }
      if (!r.ok) throw new Error();
      setLista(await r.json());
    } catch { setMsg("Não foi possível falar com o servidor."); }
  }, []);
  useEffect(() => { if (chave) carregar(chave); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const entrar = (e) => { e.preventDefault(); salvarChave(chave.trim()); carregar(chave.trim()); };
  const agir = async (id, corpo) => {
    setMsg("");
    try {
      const r = await fetch(`${API}/api/frascos/${id}/movimentacoes`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-admin-key": chave }, body: JSON.stringify(corpo),
      });
      if (!r.ok) setMsg((await r.json()).mensagem || "Não foi possível atualizar.");
      else carregar(chave);
    } catch { setMsg("Não foi possível falar com o servidor."); }
  };

  const vis = (lista || []).filter((f) => filtro === "TODOS" || f.status === filtro);
  return (
    <div className="ag-page">
      <Cabecalho ativo="empresa" />
      <main className="bo-wrap">
        <h1 className="ag-title">Painel da empresa</h1>
        <p className="ag-subtitle">Acompanhe os agendamentos, registre entregas e marque as coletas. <a className="bo-link" href="/rastreio/entregador.html">Abrir o app do entregador</a></p>
        {!lista ? (
          <form className="bo-busca" onSubmit={entrar}>
            <input className="ag-input" type="password" placeholder="Chave de acesso da equipe" value={chave} onChange={(e) => setChave(e.target.value)} aria-label="Chave de acesso" />
            <button className="bo-btn bo-btn-ouro" type="submit">Entrar</button>
          </form>
        ) : (
          <div className="bo-busca">
            <select className="ag-input" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Filtrar por status">
              <option value="TODOS">Todos os status</option>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button className="bo-btn" type="button" onClick={() => carregar(chave)}>Atualizar</button>
          </div>
        )}
        {msg && <p className="bo-erro" role="alert">{msg}</p>}
        {lista && vis.length === 0 && <p className="bo-mut">Nenhum agendamento para mostrar.</p>}
        <div className="bo-lista">{vis.map((f) => <Linha key={f.id + f.status} f={f} agir={agir} />)}</div>
      </main>
    </div>
  );
}
