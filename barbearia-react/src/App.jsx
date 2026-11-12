import AgendamentoForm from "./AgendamentosForm";
import Resposta from "./Resposta";
import MinhasColetas from "./MinhasColetas";
import PainelEmpresa from "./PainelEmpresa";
import Inicio from "./Inicio";
import Entrar from "./Entrar";
import { useEffect, useState } from "react";
import "./App.css";

// Rotas por hash (#/agendar, #/minhas-coletas, #/empresa): não precisa de biblioteca extra.
const rotaAtual = () => location.hash.replace(/^#\/?/, "") || "inicio";

export default function App() {
  const [mensagem, setMensagem] = useState("");
  const [rota, setRota] = useState(rotaAtual());
  useEffect(() => {
    const f = () => setRota(rotaAtual());
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);

  if (rota === "minhas-coletas") return <MinhasColetas />;
  if (rota === "entrar" || rota === "cadastro") return <Entrar modo={rota} />;
  if (rota === "empresa") return <PainelEmpresa />;
  if (rota === "inicio") return <Inicio />;
  return (
    <div>
      <AgendamentoForm setMensagem={setMensagem} />
      <Resposta mensagem={mensagem} onFechar={() => setMensagem("")} />
    </div>
  );
}
