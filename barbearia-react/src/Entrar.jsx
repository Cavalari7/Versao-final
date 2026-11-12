import { useState } from "react";
import Cabecalho from "./Cabecalho";
import { API, salvarSessao } from "./api";

export default function Entrar({ modo }) {
  const cadastro = modo === "cadastro";
  const [f, setF] = useState({ nome: "", email: "", telefone: "", senha: "" });
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const enviar = async (e) => {
    e.preventDefault();
    setErro(""); setEnviando(true);
    try {
      const r = await fetch(`${API}/api/auth/${cadastro ? "cadastro" : "login"}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return setErro(j.mensagem || "Não foi possível concluir.");
      salvarSessao({ token: j.token, usuario: j.usuario });
      location.hash = "#/minhas-coletas";
      location.reload();
    } catch {
      setErro("Erro de conexão com o servidor.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="ag-page">
      <Cabecalho ativo="entrar" />
      <main className="bo-wrap" style={{ maxWidth: 460 }}>
        <h1 className="ag-title">{cadastro ? "Criar conta" : "Entrar"}</h1>
        <p className="ag-subtitle">{cadastro ? "Cadastre-se para agendar e acompanhar suas coletas." : "Acesse suas coletas e o rastreio dos seus frascos."}</p>
        <form className="bo-card" onSubmit={enviar} style={{ display: "grid", gap: 12 }}>
          {cadastro && <input className="ag-input" placeholder="Seu nome" value={f.nome} onChange={set("nome")} required autoComplete="name" aria-label="Nome" />}
          <input className="ag-input" type="email" placeholder="Seu e-mail" value={f.email} onChange={set("email")} required autoComplete="email" aria-label="E-mail" />
          {cadastro && <input className="ag-input" type="tel" placeholder="Telefone (opcional)" value={f.telefone} onChange={set("telefone")} autoComplete="tel" aria-label="Telefone" />}
          <input className="ag-input" type="password" placeholder="Senha" value={f.senha} onChange={set("senha")} required minLength={cadastro ? 8 : undefined}
            autoComplete={cadastro ? "new-password" : "current-password"} aria-label="Senha" />
          {cadastro && <p className="bo-mut" style={{ fontSize: 12, margin: 0 }}>Mínimo 8 caracteres, com letra maiúscula, minúscula e número.</p>}
          {erro && <p className="bo-erro" role="alert" style={{ margin: 0 }}>{erro}</p>}
          <button className="bo-btn bo-btn-ouro" type="submit" disabled={enviando}>{enviando ? "Aguarde…" : cadastro ? "Cadastrar" : "Entrar"}</button>
          <p className="bo-mut" style={{ margin: 0, fontSize: 13 }}>
            {cadastro ? <>Já tem conta? <a href="#/entrar">Entrar</a></> : <>Ainda não tem conta? <a href="#/cadastro">Cadastre-se</a></>}
          </p>
        </form>
      </main>
    </div>
  );
}
