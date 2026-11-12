import logo from "./assets/3d_green_gradient_recycle_sign-Photoroom.png";
import { lerSessao, sair } from "./api";

export default function Cabecalho({ ativo }) {
  const sessao = lerSessao();
  const marca = (id, texto) => (ativo === id ? <span>{texto}</span> : texto);
  return (
    <header className="nave-bar">
      <div className="logo-titulo">
        <img src={logo} alt="Bio-Óleo" />
        <h1>BIO-ÓLEO</h1>
      </div>
      <nav className="navegacao">
        <a href="#/inicio">{marca("inicio", "INICIO")}</a>
        <a href="/sobre.html">SOBRE</a>
        <a href="#/agendar">{marca("agendar", "AGENDAMENTOS")}</a>
        <a href="#/minhas-coletas">{marca("minhas", "MINHAS COLETAS")}</a>
        {sessao ? (
          <a href="#/inicio" onClick={async (e) => { e.preventDefault(); await sair(); location.hash = "#/inicio"; location.reload(); }}>
            Sair ({sessao.usuario.nome.split(" ")[0]})
          </a>
        ) : (
          <a href="#/entrar">Entrar 🡪</a>
        )}
      </nav>
    </header>
  );
}
