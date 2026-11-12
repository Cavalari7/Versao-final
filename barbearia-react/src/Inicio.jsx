import { useState } from "react";
import Cabecalho from "./Cabecalho";
import { linkRastreio } from "./api";

export default function Inicio() {
  const [id, setId] = useState("");
  const [erro, setErro] = useState("");
  const consultar = (e) => {
    e.preventDefault();
    const v = id.trim().toUpperCase();
    if (!/^BO-\d{5}$/.test(v)) return setErro("ID inválido. Use o formato BO-00000.");
    location.href = linkRastreio(v);
  };
  const passos = [
    ["1", "Agende", "Escolha dia e horário. Você recebe o ID do seu frasco (BO-00000) e um QR Code."],
    ["2", "Acompanhe", "Veja o status em tempo real: agendada, entregue, equipe a caminho e coletado."],
    ["3", "Entregue o óleo", "A equipe vai até você, coleta e registra os litros. Tudo fica no histórico."],
  ];
  return (
    <div className="ag-page">
      <Cabecalho ativo="inicio" />
      <main className="bo-wrap">
        <section className="bo-card" style={{ textAlign: "center", padding: "48px 20px" }}>
          <h1 className="ag-title" style={{ marginBottom: 12 }}>NÓS COLETAMOS<br />O SEU ÓLEO</h1>
          <p className="ag-subtitle">Transformamos óleo de cozinha usado em novos recursos. Cadastre-se, agende a coleta e acompanhe cada etapa.</p>
          <div className="bo-acoes" style={{ justifyContent: "center", marginTop: 20 }}>
            <a className="bo-btn bo-btn-ouro" href="#/agendar">Agendar coleta 🡪</a>
            <a className="bo-btn" href="#/cadastro">Criar conta</a>
            <a className="bo-btn" href="#/entrar">Entrar</a>
          </div>
        </section>

        <h2 className="ag-title" style={{ fontSize: "1.5rem", marginTop: 32 }}>Como funciona</h2>
        <div className="bo-lista">
          {passos.map(([n, t, d]) => (
            <article className="bo-card" key={n}><h2>{n}. {t}</h2><p className="bo-mut">{d}</p></article>
          ))}
        </div>

        <h2 className="ag-title" style={{ fontSize: "1.5rem", marginTop: 32 }}>Rastrear um frasco</h2>
        <form className="bo-busca" onSubmit={consultar}>
          <input className="ag-input" placeholder="ID do frasco (BO-00000)" value={id} aria-label="ID do frasco"
            onChange={(e) => { setId(e.target.value); setErro(""); }} />
          <button className="bo-btn bo-btn-ouro" type="submit">Consultar</button>
          <a className="bo-btn" href="/rastreio/rastreio.html">Ler QR Code</a>
        </form>
        {erro && <p className="bo-erro" role="alert">{erro}</p>}

        <footer className="bo-card" style={{ marginTop: 32 }}>
          <dl className="bo-dados">
            <div><dt>Telefone</dt><dd>(44) 99977-7632</dd></div>
            <div><dt>Endereço</dt><dd>Rodovia PR-323, Lote 4, Gleba São Januário, Cianorte - PR</dd></div>
          </dl>
        </footer>
      </main>
    </div>
  );
}
