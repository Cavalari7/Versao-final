import { useState } from "react";
import Cabecalho from "./Cabecalho";
import { API, authHeaders, lerColetas, lerSessao, salvarColetas } from "./api";

// Data digitada como dd/mm/aaaa (o campo type="date" segue o idioma do navegador/Windows, não do site).
const mascaraData = (v) => {
  const n = v.replace(/\D/g, "").slice(0, 8);
  return n.length > 4 ? `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}` : n.length > 2 ? `${n.slice(0, 2)}/${n.slice(2)}` : n;
};
const dataParaIso = (t) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (!m) return "";
  const d = new Date(+m[3], +m[2] - 1, +m[1]);
  if (d.getFullYear() !== +m[3] || d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[1]) return ""; // ex.: 31/02
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return d < hoje ? "" : `${m[3]}-${m[2]}-${m[1]}`;
};

export default function AgendamentoForm({ setMensagem }) {
  const [nome, setNome] = useState(() => lerSessao()?.usuario.nome || "");
  const [dataTxt, setDataTxt] = useState("");
  const dia = dataParaIso(dataTxt); // vai para o servidor como aaaa-mm-dd
  const [hora, setHora] = useState("");
  const [telefone, setTelefone] = useState(() => lerSessao()?.usuario.telefone || "");
  const [rua, setRua] = useState("");
  const [casa, setCasa] = useState("");
  const [bairro, setBairro] = useState("");
  const [complemento, setComplemento] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!dia) return setMensagem({ tipo: "erro", texto: "Data inválida. Use dd/mm/aaaa e uma data de hoje em diante." });

    setMensagem({ tipo: "carregando", texto: "Aguarde, processando seu agendamento..." });

    const dadosAgendamentos = {
      nome,
      telefone,
      dia,
      hora,
      rua,
      casa,
      bairro,
      complemento,
      quantidade_litros: quantidade,
      observacoes,
    };

    try {
      const response = await fetch(`${API}/salvar-agendamento`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(dadosAgendamentos),
      });

      const result = await response.json();

      if (response.ok) {
        if (result.codigo && result.token) salvarColetas([...lerColetas(), { codigo: result.codigo, token: result.token }]);
        setMensagem({
          tipo: "ok", codigo: result.codigo, token: result.token,
          texto: `Coleta agendada para ${dia.split("-").reverse().join("/")} às ${hora}. O ID do seu frasco é ${result.codigo}.`,
        });
        setDataTxt(""); setHora(""); setQuantidade(""); setObservacoes(""); setComplemento(""); // evita enviar duas vezes
      } else {
        setMensagem({ tipo: "erro", texto: "Não foi possível agendar: " + (result.mensagem || "erro desconhecido") });
      }
    } catch (error) {
      console.error("Erro na requisição", error);
      setMensagem({ tipo: "erro", texto: "Erro de conexão com o servidor. Confirme que o backend está rodando (npm run dev na pasta BACKEND)." });
    }
  };

  const diaFormatado = dia ? dia.split("-").reverse().join("/") : "—";

  return (
    <div className="ag-page">
      <Cabecalho ativo="agendar" />

      <main className="ag-main">
        <h1 className="ag-title">Agende sua coleta</h1>
        <p className="ag-subtitle">
          Escolha o dia e o horário. O coletor vai até você buscar o óleo.
        </p>

        <div className="ag-layout">
          <form id="agendamento-form" className="ag-card" onSubmit={handleSubmit}>
            <div className="ag-grid">
              <div className="ag-field">
                <label className="ag-label">Nome</label>
                <input
                  className="ag-input"
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                />
              </div>

              <div className="ag-field">
                <label className="ag-label">Telefone</label>
                <input
                  className="ag-input"
                  type="text"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  required
                />
              </div>

              <div className="ag-field">
                <label className="ag-label">Rua / Número</label>
                <div className="ag-row">
                  <input
                    className="ag-input"
                    type="text"
                    placeholder="Rua"
                    value={rua}
                    onChange={(e) => setRua(e.target.value)}
                    required
                  />
                  <input
                    className="ag-input"
                    type="number"
                    placeholder="Nº"
                    value={casa}
                    onChange={(e) => setCasa(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="ag-field">
                <label className="ag-label">Bairro</label>
                <input
                  className="ag-input"
                  type="text"
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  required
                />
              </div>

              <div className="ag-field ag-full">
                <label className="ag-label">Complemento / referência (opcional)</label>
                <input
                  className="ag-input"
                  type="text"
                  value={complemento}
                  onChange={(e) => setComplemento(e.target.value)}
                />
              </div>

              <div className="ag-field">
                <label className="ag-label">Data da coleta</label>
                <input
                  className="ag-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="dd/mm/aaaa"
                  maxLength={10}
                  value={dataTxt}
                  onChange={(e) => setDataTxt(mascaraData(e.target.value))}
                  pattern="\d{2}/\d{2}/\d{4}"
                  title="Use o formato dd/mm/aaaa"
                  required
                />
              </div>

              <div className="ag-field">
                <label className="ag-label">Hora</label>
                <input
                  className="ag-input"
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  required
                />
              </div>

              <div className="ag-field ag-full">
                <label className="ag-label">Quantidade estimada de óleo (litros)</label>
                <input
                  className="ag-input"
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  required
                />
                <p className="ag-hint">
                  O valor final é pago pela quantidade de litros coletados.
                </p>
              </div>

              <div className="ag-field ag-full">
                <label className="ag-label">Observações (opcional)</label>
                <textarea
                  className="ag-textarea"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                />
              </div>
            </div>

            <button className="ag-button" type="submit">
              Confirmar agendamento
            </button>
          </form>

          <aside className="ag-summary">
            <h2>Resumo do agendamento</h2>
            <div className="ag-summary-item">
              <span>Data</span>
              <strong>{diaFormatado}</strong>
            </div>
            <div className="ag-summary-item">
              <span>Hora</span>
              <strong>{hora || "—"}</strong>
            </div>
            <div className="ag-summary-item">
              <span>Bairro</span>
              <strong>{bairro || "—"}</strong>
            </div>
            <div className="ag-summary-item">
              <span>Óleo estimado</span>
              <strong>{quantidade ? `${quantidade} L` : "—"}</strong>
            </div>
            <div className="ag-summary-note">
              Depois da coleta, você recebe a confirmação do serviço.
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}