# Google Maps no rastreio — configuração passo a passo

O que o sistema usa do Google (e por quê):
| API | Para quê | Onde roda |
|---|---|---|
| **Maps JavaScript API** | Mapa interativo na tela de rastreio | Navegador (chave pública) |
| **Routes API** | Trajeto, distância e tempo estimado (substitui a Directions API e a Distance Matrix API, que são as versões antigas) | Servidor (chave secreta) |
| **Geocoding API** | Converte o endereço do agendamento em coordenadas | Servidor (chave secreta) |

Sem chaves o sistema continua funcionando: usa OpenStreetMap, mostra a distância em linha reta (sem tempo de viagem) e converte endereços pelo Nominatim.

## 1. Projeto e faturamento (o que aparece na sua tela do Google Cloud)
1. No topo, em **"Selecione um projeto"** → **Novo projeto** → nome `bio-oleo` → Criar.
2. **"Concluir configuração"**: crie/vincule uma conta de faturamento (exige cartão). O Google dá uma cota grátis **por API** todo mês (veja "Custos"), mas as APIs de Rotas e Geocoding só funcionam com faturamento ativo.
3. **Proteja o bolso**: Faturamento → *Orçamentos e alertas* → crie um orçamento (ex.: R$ 50) com alertas em 50%, 90% e 100%. Em *APIs e serviços → Cotas*, limite as requisições por dia da Routes API.

## 2. Ativar as APIs
*APIs e serviços → Biblioteca* → ative **Maps JavaScript API**, **Routes API** e **Geocoding API**. (Não precisa de Directions API nem Distance Matrix API.)

## 3. Criar as DUAS chaves (*APIs e serviços → Credenciais → Criar credenciais → Chave de API*)
**Chave do navegador** (vai para `GOOGLE_MAPS_BROWSER_KEY`)
- Restrições de aplicativo: *Sites (referenciadores HTTP)* → `http://localhost:5173/*` e `https://SEU-DOMINIO/*`.
- Restrições de API: somente **Maps JavaScript API**.
- Esta chave aparece no código da página; a restrição por domínio é a proteção dela.

**Chave do servidor** (vai para `GOOGLE_MAPS_SERVER_KEY`)
- Restrições de API: somente **Routes API** e **Geocoding API**.
- Restrições de aplicativo: *Endereços IP* → IP do servidor de produção (em desenvolvimento, pode deixar sem restrição de aplicativo, mas mantenha a restrição de API).
- Nunca coloque esta chave no front-end nem no GitHub.

## 4. ID do mapa (recomendado)
*Google Maps Platform → Gerenciamento de mapas → IDs de mapa → Criar* (tipo JavaScript, Vetor). Copie para `GOOGLE_MAP_ID`. O mapa usa marcadores avançados, que exigem um ID de mapa; sem o seu, o sistema usa o `DEMO_MAP_ID`, de demonstração (serve para testar).

## 5. Variáveis de ambiente
```
cd BACKEND
cp .env.example .env      # Windows: copy .env.example .env
```
Preencha o `.env` (ele está no `.gitignore`; confira com `git status` que ele NÃO aparece antes de fazer commit):
`ADMIN_KEY`, `GOOGLE_MAPS_BROWSER_KEY`, `GOOGLE_MAPS_SERVER_KEY`, `GOOGLE_MAP_ID` e o ponto de partida da equipe (`BASE_LAT`/`BASE_LNG` ou `BASE_ENDERECO`). Reinicie o backend. Para conferir: abra http://localhost:3000/api/config/mapa — deve mostrar `"provedor":"google"`.

## 6. Como funciona
- Ao **agendar**, o servidor converte o endereço em coordenadas (Geocoding) e guarda no banco. Se o Google errar o ponto, a equipe corrige em "Marcar local da coleta".
- **Rota planejada**: da base até o local, enquanto a equipe não saiu (recalculada a cada 30 min).
- **Rota restante**: quando a equipe compartilha a posição, o servidor calcula posição atual → local, com distância, tempo e chegada prevista. O cálculo é refeito no máximo a cada 60 s (ou se a equipe andou 300 m, com intervalo mínimo de 20 s) — por isso o cliente atualizando a tela não gera cobrança extra.
- Trânsito em tempo real: `ROTA_COM_TRAFEGO=on` (mais preciso, mas usa o nível "Pro", mais caro e com cota grátis menor). Padrão: desligado.
- Se o Google falhar (sem internet, chave recusada, sem faturamento) a tela avisa e cai para o OpenStreetMap; a rota vira distância em linha reta.

## 7. Custos (confira sempre a calculadora oficial — os preços mudam)
Desde março de 2025 cada API tem cota grátis própria por mês: em geral 10.000 chamadas nas APIs do nível Essentials, 5.000 no Pro. A Routes API sem trânsito é Essentials; com trânsito em tempo real é Pro. Estimativa deste sistema: ~1 cálculo por minuto por entrega em andamento (≈30 por entrega de 30 min) + 1 geocodificação por agendamento + 1 carregamento de mapa por visita à tela de rastreio.

## 8. App do entregador (envio da posição GPS)
Página pronta: `/rastreio/entregador.html` (link também no Painel da empresa).
1. No celular do entregador, abra o endereço do site (em produção precisa ser **HTTPS**; o GPS do navegador não funciona em HTTP).
2. Digite a chave da equipe (`ADMIN_KEY`). Aparecem as entregas em aberto.
3. Toque na entrega → **Iniciar rota e compartilhar posição** → permita a localização. O cliente passa a ver "Equipe a caminho" e a posição no mapa.
4. **Abrir navegação no Google Maps** abre o trajeto no app do celular.
5. Na chegada, informe os litros e toque em **Marcar como coletado**.
Dicas: no navegador, "Adicionar à tela inicial" cria um atalho de app. **Limite técnico**: o navegador só envia a posição com a tela ligada e a página aberta. Para rastrear em segundo plano, use um app de rastreio (ex.: Traccar Client) ou um rastreador GPS veicular e faça-o enviar `POST /api/frascos/:id/localizacoes` com o cabeçalho `x-admin-key` — a API já está pronta para isso.

## 9. Produção
- Servir o site e a API em **HTTPS**.
- Definir as variáveis no servidor (não envie o `.env`): `ADMIN_KEY`, chaves do Google, `BASE_*`, `DB_*`.
- Informar o endereço da API ao front: `VITE_API_URL=https://api.seudominio.com.br npm run build` (React) e `window.BIOOLEO_API_URL` em `barbearia-react/public/rastreio/config.js` (módulo de rastreio).
- Trocar a restrição de referenciador da chave do navegador pelo domínio final e a de IP da chave do servidor.
- O backend aceita requisições de qualquer origem (`cors()` original). Em produção, restrinja ao seu domínio.

## 10. Testes
- `cd BACKEND && npm test` — usa um "Google de mentira" local (sem internet nem cobrança): conferem pedido de rota, geocodificação, cache/custo, fallback, e a API completa.
- `cd barbearia-react && npm test` — regras do rastreio, inclusive a leitura da rota do Google.
- **Não foi possível testar daqui contra o Google real** (sem internet e sem chave). Teste real: depois de configurar, agende uma coleta, abra o rastreio, inicie a rota pelo app do entregador e confira mapa, trajeto, tempo e chegada.
