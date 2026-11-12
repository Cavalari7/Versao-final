import { useEffect, useState } from "react";
import Cabecalho from "./Cabecalho";
import { API, STATUS, authHeaders, lerSessao, salvarSessao, fmt, lerColetas, salvarColetas, statusAtual, linkRastreio } from "./api";

export default function MinhasColetas() {
  const [itens, setItens] = useState(null); // null = carregando
  const [aviso, setAviso] = useState("");
  const [busca, setBusca] = useState("");
  const [erroBusca, setErroBusca] = useState("");

  useEffect(() => {
    let ativo = true;
    (async () => {
      let locais = lerColetas();
      if (lerSessao()) { // conta: traz as coletas do servidor e junta com as deste aparelho
        try {
          const r = await fetch(`${API}/api/minhas-coletas`, { headers: authHeaders() });
          if (r.ok) {
            const srv = await r.json();
            const ja = new Set(srv.map((x) => x.codigo));
            locais = [...locais.filter((c) => !ja.has(c.codigo)), ...srv.reverse().map((x) => ({ codigo: x.codigo, token: x.token }))];
          } else if (r.status === 401) { salvarSessao(null); }
        } catch { /* usa só as locais */ }
      }
      const res = await Promise.all(
        locais.map(async (c) => {
          try {
            const r = await fetch(`${API}/api/frascos/${c.codigo}?t=${c.token}`);
            return r.ok ? { ...c, dados: await r.json() } : { ...c, indisponivel: true };
          } catch {
            return { ...c, indisponivel: true, rede: true };
          }
        })
      );
      if (!ativo) return;
      setItens(res.reverse());
      if (res.some((x) => x.rede)) setAviso("Não foi possível falar com o servidor. Verifique a conexão e atualize a página.");
    })();
    return () => { ativo = false; };
  }, []);

  const remover = (codigo) => {
    salvarColetas(lerColetas().filter((c) => c.codigo !== codigo));
    setItens((l) => l.filter((c) => c.codigo !== codigo));
  };
  const consultar = (e) => {
    e.preventDefault();
    const id = busca.trim().toUpperCase();
    if (!/^BO-\d{5}$/.test(id)) return setErroBusca("ID inválido. Use o formato BO-00000.");
    location.href = linkRastreio(id);
  };

  return (
    <div className="ag-page">
      <Cabecalho ativo="minhas" />
      <main className="bo-wrap">
        <h1 className="ag-title">Minhas coletas</h1>
        <p className="ag-subtitle">Acompanhe o status de cada frasco, do agendamento até a coleta.</p>

        <form className="bo-busca" onSubmit={consultar}>
          <input className="ag-input" placeholder="Consultar outro frasco (BO-00000)" value={busca}
            onChange={(e) => { setBusca(e.target.value); setErroBusca(""); }} aria-label="ID do frasco" />
          <button className="bo-btn bo-btn-ouro" type="submit">Consultar</button>
          <a className="bo-btn" href="#/agendar">Agendar nova coleta</a>
        </form>
        {erroBusca && <p className="bo-erro" role="alert">{erroBusca}</p>}
        {aviso && <p className="bo-erro" role="alert">{aviso}</p>}

        {itens === null && <p className="bo-mut">Carregando suas coletas…</p>}
        {itens && itens.length === 0 && (
          <div className="bo-card bo-vazio">
            <p>Você ainda não tem coletas neste aparelho.</p>
            <a className="bo-btn bo-btn-ouro" href="#/agendar">Agendar uma coleta</a>
          </div>
        )}

        <div className="bo-lista">
          {itens && itens.map((c) => {
            const d = c.dados, st = statusAtual(d);
            return (
              <article className="bo-card" key={c.codigo}>
                <div className="bo-topo">
                  <h2>{c.codigo}</h2>
                  {d && <span className={`bo-st bo-st-${st}`}>{STATUS[st] || "Sem registros"}</span>}
                </div>
                {c.indisponivel ? (
                  <p className="bo-mut">Não foi possível carregar esta coleta agora.</p>
                ) : (
                  <dl className="bo-dados">
                    <div><dt>Data prevista</dt><dd>{d.dataPrevista ? fmt(d.dataPrevista.replace(" ", "T")) : "—"}</dd></div>
                    <div><dt>Endereço</dt><dd>{d.endereco}</dd></div>
                    <div><dt>Óleo previsto</dt><dd>{d.litrosPrevistos} L</dd></div>
                    <div><dt>Óleo coletado</dt><dd>{d.litrosColetados == null ? "Ainda não coletado" : `${d.litrosColetados} L`}</dd></div>
                  </dl>
                )}
                <div className="bo-acoes">
                  <a className="bo-btn bo-btn-ouro" href={linkRastreio(c.codigo, c.token)}>Acompanhar</a>
                  <button className="bo-btn" type="button" onClick={() => remover(c.codigo)}>Remover da lista</button>
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}
