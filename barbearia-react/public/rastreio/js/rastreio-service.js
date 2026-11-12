/* DADOS DE DEMONSTRAÇÃO — não são registros reais. Remova este bloco ao integrar o backend. */
window.RASTREIO_DEMO = {
  'BO-00003': {
    id: 'BO-00003', cliente: '[Cliente 5]', pedido: '#0004', bairro: 'Bairro D',
    endereco: 'Rua [exemplo], 12 - Bairro D', litrosPrevistos: 15, litrosColetados: 15,
    responsavel: 'Equipe Bio Óleo',
    localizacao: { lat: -23.6598, lng: -52.605, dataHora: '2026-10-14T09:05:00-03:00', responsavel: 'Equipe Bio Óleo' },
    movimentacoes: [
      { status: 'ENTREGUE', dataHora: '2026-10-07T10:20:00-03:00', local: 'Rua [exemplo], 12 - Bairro D', responsavel: 'Equipe Bio Óleo', obs: '' },
      { status: 'AGENDADA', dataHora: '2026-10-14T08:00:00-03:00', local: '', responsavel: '', obs: 'Manhã · Pedido #0004' },
      { status: 'COLETADO', dataHora: '2026-10-14T09:05:00-03:00', local: 'Rua [exemplo], 12 - Bairro D', responsavel: 'Equipe Bio Óleo', obs: 'Retirado pela equipe Bio Óleo' }
    ]
  },
  'BO-00005': {
    id: 'BO-00005', cliente: '[Cliente 7]', pedido: '#0006', bairro: 'Bairro A',
    endereco: 'Rua [exemplo], 45 – Bairro A', litrosPrevistos: 10, litrosColetados: null,
    responsavel: 'Motorista [exemplo]', localizacao: null,
    movimentacoes: [
      { status: 'ENTREGUE', dataHora: '2026-10-22T08:15:00-03:00', local: 'Rua [exemplo], 45 – Bairro A', responsavel: 'Motorista [exemplo]', obs: 'Termo de responsabilidade aceito' }
    ]
  },
  'BO-00007': {
    id: 'BO-00007', cliente: '[Cliente 9]', pedido: '#0009', bairro: 'Bairro B',
    endereco: 'Rua [exemplo], 80 - Bairro B', litrosPrevistos: 20, litrosColetados: null,
    responsavel: '', localizacao: null, movimentacoes: []
  }
};

/* Camada de serviços: é o ÚNICO arquivo que fala com dados. Para integrar, troque MODO por 'api'. */
(function (root) {
  var R = root.RastreioRules;
  var q = new URLSearchParams(location.search);
  var MODO = q.get('demo') === '1' ? 'demo' : 'api';   // ?demo=1 usa os dados de demonstração
  var API_BASE = (root.BIOOLEO_API_URL || (location.protocol + '//' + location.hostname + ':3000')) + '/api';  // backend Express (em produção: veja config.js)
  function chaveEquipe() { try { return localStorage.getItem('bioleo_admin_key') || ''; } catch (e) { return ''; } }
  function cab(extra) { var h = Object.assign({}, extra), k = chaveEquipe(); if (k) h['x-admin-key'] = k; return h; }

  function erro(codigo) { var e = new Error(codigo); e.codigo = codigo; return e; }
  function espera(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function checar(resp) {
    if (resp.status === 400) throw erro('ID_INVALIDO');
    if (resp.status === 404) throw erro('NAO_ENCONTRADO');
    if (resp.status === 409) throw erro('ENCERRADA');
    if (resp.status === 401 || resp.status === 403) throw erro('NAO_AUTORIZADO');
    if (!resp.ok) throw erro('REDE');
    return resp.json();
  }

  // GET /api/frascos/{id}[?t=token] — o backend decide o que a visão pública pode ver.
  async function consultarFrasco(id, opts) {
    if (!R.validarId(id)) throw erro('ID_INVALIDO');
    id = R.normalizarId(id);
    var publico = !!(opts && opts.publico);
    if (MODO === 'api') {
      var resp;
      var qs = new URLSearchParams(); if (publico) qs.set('visao', 'publica'); if (q.get('t')) qs.set('t', q.get('t'));
      try { resp = await fetch(API_BASE + '/frascos/' + encodeURIComponent(id) + '?' + qs, { headers: cab() }); }
      catch (e) { throw erro('REDE'); }
      return checar(resp);
    }
    await espera(250);
    var f = root.RASTREIO_DEMO[id];
    if (!f) throw erro('NAO_ENCONTRADO');
    if (publico) { // visão pública: apenas ID e status/data, sem dados pessoais
      return { id: f.id, publico: true, movimentacoes: f.movimentacoes.map(function (m) { return { status: m.status, dataHora: m.dataHora }; }) };
    }
    return JSON.parse(JSON.stringify(f));
  }

  // POST /api/frascos/{id}/localizacoes — só a equipe (cabeçalho x-admin-key).
  async function registrarLocalizacao(id, pos) {
    if (!R.coordsValidas(pos.lat, pos.lng)) throw erro('COORDENADAS_INVALIDAS');
    if (MODO === 'api') {
      var resp;
      try {
        resp = await fetch(API_BASE + '/frascos/' + encodeURIComponent(id) + '/localizacoes', {
          method: 'POST', headers: cab({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ lat: pos.lat, lng: pos.lng, precisaoM: pos.precisaoM })
        });
      } catch (e) { throw erro('REDE'); }
      return checar(resp);
    }
    await espera(200);
    return { persistido: false, demo: true }; // demo: nada é gravado
  }

  // Ações da equipe (precisam da chave): iniciar a rota e marcar o local da coleta.
  async function iniciarRota(id) {
    if (MODO === 'api') {
      var resp;
      try { resp = await fetch(API_BASE + '/frascos/' + encodeURIComponent(id) + '/movimentacoes', { method: 'POST', headers: cab({ 'Content-Type': 'application/json' }), body: JSON.stringify({ status: 'EM_ROTA' }) }); }
      catch (e) { throw erro('REDE'); }
      return checar(resp);
    }
    await espera(150); return { demo: true };
  }
  async function definirDestino(id, lat, lng) {
    if (!R.coordsValidas(lat, lng)) throw erro('COORDENADAS_INVALIDAS');
    if (MODO === 'api') {
      var resp;
      try { resp = await fetch(API_BASE + '/frascos/' + encodeURIComponent(id) + '/destino', { method: 'PUT', headers: cab({ 'Content-Type': 'application/json' }), body: JSON.stringify({ lat: lat, lng: lng }) }); }
      catch (e) { throw erro('REDE'); }
      return checar(resp);
    }
    await espera(150); return { demo: true };
  }

  // Qual mapa usar (Google se o servidor tiver a chave pública configurada; senão OpenStreetMap).
  async function configMapa() {
    if (MODO !== 'api') return { provedor: 'osm' };
    try { var r = await fetch(API_BASE + '/config/mapa'); return r.ok ? await r.json() : { provedor: 'osm' }; }
    catch (e) { return { provedor: 'osm' }; }
  }
  // App do entregador: entregas em aberto e conclusão da coleta (precisam da chave da equipe).
  async function listarAtivos() {
    var resp;
    try { resp = await fetch(API_BASE + '/admin/frascos', { headers: cab() }); } catch (e) { throw erro('REDE'); }
    var lista = await checar(resp);
    return lista.filter(function (f) { return f.status === 'AGENDADA' || f.status === 'ENTREGUE' || f.status === 'EM_ROTA'; });
  }
  async function coletar(id, litros) {
    var resp;
    try { resp = await fetch(API_BASE + '/frascos/' + encodeURIComponent(id) + '/movimentacoes', { method: 'POST', headers: cab({ 'Content-Type': 'application/json' }), body: JSON.stringify({ status: 'COLETADO', litrosColetados: litros }) }); }
    catch (e) { throw erro('REDE'); }
    return checar(resp);
  }

  root.RastreioService = { modo: MODO, configMapa: configMapa, listarAtivos: listarAtivos, coletar: coletar, ehEquipe: function () { return !!chaveEquipe(); }, iniciarRota: iniciarRota, definirDestino: definirDestino, consultarFrasco: consultarFrasco, registrarLocalizacao: registrarLocalizacao };
})(window);
