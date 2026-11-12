# Rastreio e Monitoramento — Bio Óleo / Brasil

## Como rodar
1. Nada de banco para instalar: o projeto usa SQLite (arquivo BACKEND/dados/bioleo.db, criado sozinho). Troque o local com DB_FILE.
2. `cd BACKEND && npm install && npm run dev` — as tabelas são criadas sozinhas (nada é apagado).
3. `cd barbearia-react && npm install && npm run dev` — abra o endereço do Vite (normalmente http://localhost:5173).

## Como o cliente usa
1. Agenda em `#/agendar` (formulário de sempre). A resposta traz o ID do frasco (ex.: BO-00001) e o aparelho guarda o comprovante.
2. Em `#/minhas-coletas` vê suas coletas e clica em **Acompanhar**: status, linha do tempo, litros, QR Code e mapa. A página se atualiza sozinha a cada 15 s.
3. Quando a equipe sai para a coleta, o mapa mostra a posição da equipe **ao vivo** ("Ao vivo" / "há X min") e o local da coleta.
Qualquer pessoa pode consultar `.../rastreio/rastreio.html?id=BO-00001` (ou ler o QR Code): sem o comprovante vê **só o ID e o status**.

## Como a equipe usa
0. **App do entregador** (`/rastreio/entregador.html`): lista as entregas, compartilha o GPS, abre a navegação e conclui a coleta, tudo no celular.
1. `#/empresa` (não aparece no menu do cliente): digite a chave da equipe. Lista os agendamentos; botões: registrar entrega, **marcar como coletado** (pede os litros) e cancelar.
2. Em "Rastreio, mapa e posição ao vivo": **Marcar local da coleta** (clique no mapa; use quando o endereço não for localizado sozinho) e **Compartilhar posição ao vivo** (pede permissão do GPS, muda o status para "Equipe a caminho" e envia a posição a cada ~10 s até a coleta terminar).

## Configurações EXTERNAS (precisam ser feitas por vocês)
Passo a passo completo do Google Cloud, chaves, custos e app do entregador: **`GOOGLE_MAPS.md`**.
| O quê | Detalhe |
|---|---|
| Arquivo `.env` | Copie `BACKEND/.env.example` para `BACKEND/.env` e preencha (não vai para o GitHub). |
| Chave da equipe | `ADMIN_KEY` no `.env`. Sem isso vale a chave de DESENVOLVIMENTO `bioleo-admin` (o terminal avisa). **Troque antes de publicar.** |
| Google Maps (opcional, recomendado) | Projeto + faturamento + 3 APIs + 2 chaves (navegador e servidor). Sem chaves: OpenStreetMap + distância em linha reta. |
| HTTPS | Câmera (ler QR) e GPS só funcionam em HTTPS ou localhost. |
| Ponto de partida | `BASE_LAT`/`BASE_LNG` (ou `BASE_ENDERECO`) para a rota planejada. |
| Limite do navegador | A posição ao vivo só é enviada com a página/app do entregador aberta e com a tela ligada. Para rastrear em segundo plano, use um app de rastreio ou rastreador GPS que envie a posição para a API. |
| LGPD | A posição da equipe só aparece para o cliente da coleta e some quando ela termina. Posições antigas são apagadas (padrão 30 dias, `RETENCAO_DIAS`). Definam a política final com o grupo. |

## API (BACKEND/rastreio.js, prefixo /api)
- GET /api/frascos/:id[?t=comprovante] — público: ID e status; com comprovante ou chave: tudo.
- GET /api/config/mapa (público: qual mapa usar e a chave pública do navegador).
- A resposta completa de /api/frascos/:id inclui `destino`, `origem` (base) e `rota` {tipo, distanciaM, duracaoS, polyline, chegadaEm}.
- GET /api/admin/frascos · POST /api/frascos/:id/movimentacoes {status: ENTREGUE|EM_ROTA|COLETADO|CANCELADA, litrosColetados?} · POST /api/frascos/:id/localizacoes {lat,lng,precisaoM} · PUT /api/frascos/:id/destino {lat,lng} — todas exigem a chave.
- O ID é `BO-` + número do agendamento com 5 dígitos.

## O que mudou em arquivos que já existiam (nada além disso)
- BACKEND/app.js: lê o `.env` (dotenv) e a porta por variável de ambiente; usa db.js; ao salvar o agendamento grava o comprovante, registra a etapa AGENDADA e inicia a busca do endereço; devolve `codigo` e `token`; cria as tabelas ao subir; `/listar-agendamento` continua aberto como antes, só não mostra o comprovante dos clientes.
- BACKEND/package.json: scripts `start` e `test` e a dependência `dotenv`.
- Novos: BACKEND/google.js (Routes + Geocoding), BACKEND/.env.example, .gitignore (protege o `.env`), public/rastreio/entregador.html, js/rastreio-mapa.js (Google/OpenStreetMap), GOOGLE_MAPS.md.
- barbearia-react: AgendamentosForm.jsx (mostra o ID do frasco, guarda o comprovante, links do menu "Agendamentos" e "Minhas coletas" no lugar de "Minha conta"), App.jsx (rotas `#/minhas-coletas` e `#/empresa`; a tela padrão continua o formulário), App.css (estilos novos no fim), package.json (script `test`).
- Não mexi nas páginas HTML (inicial, sobre, cadastro), no LEIA-ME nem no script.js.
- Observação: `/listar-agendamento` já expunha nome, telefone e endereço de todos sem login; não alterei, mas vale proteger.

## Testes
- `cd BACKEND && npm test` (com o backend rodando): API de ponta a ponta + geocodificação.
- `cd barbearia-react && npm test`: regras do rastreio.
- `BACKEND/npm test` agora inclui o Google de mentira (rota, geocodificação, cache) e a rota ponta a ponta.
- Verificados também em navegador automatizado (incluindo o mapa do Google com biblioteca simulada, recusa da chave, falta de acesso ao Google e o app do entregador): agendar → acompanhar → equipe marca local e compartilha posição → cliente vê "Ao vivo" sem recarregar → equipe marca coletado → cliente vê COLETADO com os litros; celular sem rolagem lateral.

## Fora do rastreio (de outros integrantes)
Login/cadastro e a etapa de entrega (termo de responsabilidade). Ponto de ligação: o termo pode chamar `POST /api/frascos/:id/movimentacoes {status:"ENTREGUE"}` com a chave da equipe.
