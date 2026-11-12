/* Interface do módulo de Rastreio. Usa textContent em todo dado vindo do serviço (evita XSS). */
(function () {
  var R = window.RastreioRules, S = window.RastreioService;
  var $ = function (s) { return document.querySelector(s); };
  var params = new URLSearchParams(location.search);
  var publico = params.get('publico') === '1';   // visão pública: só ID e status
  var frasco = null, leitor = null;

  var MSG = {
    ID_INVALIDO: 'ID inválido. Use o formato BO-00000.',
    NAO_ENCONTRADO: 'Nenhum frasco encontrado com esse ID. Confira o código e tente de novo.',
    NAO_AUTORIZADO: 'Você não tem permissão para ver este frasco. Entre na sua conta.',
    REDE: 'Não foi possível falar com o servidor. Verifique a conexão e tente de novo.'
  };
  var fmt = function (d) { return d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'; };
  var set = function (sel, t) { $(sel).textContent = (t == null || t === '') ? '—' : t; };
  var litros = function (n) { return n == null ? '—' : n + ' L'; };

  function estado(tipo, msg) {
    var el = $('#estado'); el.textContent = msg || ''; el.dataset.tipo = tipo;
    $('#resultado').hidden = tipo !== 'ok';
  }

  async function consultar(id) {
    if (compartilhando) pararVivo();
    estado('carregando', 'Consultando…');
    try {
      frasco = await S.consultarFrasco(id, { publico: publico });
      var q = new URLSearchParams(); if (publico) q.set('publico', '1'); if (params.get('demo')) q.set('demo', '1'); if (params.get('t')) q.set('t', params.get('t')); q.set('id', frasco.id);
      history.replaceState(null, '', '?' + q);
      $('#busca-id').value = frasco.id;
      estado('ok', ''); render();
    } catch (e) { estado('erro', MSG[e.codigo] || MSG.REDE); }
  }

  function render() {
    var movs = frasco.movimentacoes || [];
    var st = R.statusAtual(movs);
    var restrito = publico || !!frasco.publico;
    $('#equipe').hidden = restrito || !S.ehEquipe();   // o servidor decide: sem token/chave só chega ID e status
    document.querySelectorAll('[data-priv]').forEach(function (el) { el.hidden = restrito; });
    set('#f-id', frasco.id);
    $('#f-status').dataset.st = st || 'nenhum';
    set('#f-status-txt', R.rotuloStatus(st));
    var ult = movs.length ? R.statusAtual(movs) && movs.slice().sort(function (a, b) { return new Date(b.dataHora) - new Date(a.dataHora); })[0].dataHora : null;
    set('#f-atualizado', fmt(ult));
    if (!restrito) {
      set('#f-cliente', frasco.cliente); set('#f-pedido', frasco.pedido); set('#f-bairro', frasco.bairro);
      set('#f-litros', litros(frasco.litrosPrevistos)); set('#f-resp', frasco.responsavel);
      set('#c-prev', litros(frasco.litrosPrevistos));
      set('#c-col', frasco.litrosColetados == null ? 'Ainda não coletado' : litros(frasco.litrosColetados));
      var dif = R.diferencaLitros(frasco.litrosPrevistos, frasco.litrosColetados);
      set('#c-dif', dif == null ? '—' : (dif > 0 ? '+' : '') + dif + ' L');
      set('#c-end', frasco.endereco);
      renderMapa();
    }
    renderLinha(movs); renderQr();
  }

  function renderLinha(movs) {
    var ol = $('#linha'); ol.replaceChildren();
    $('#linha-vazia').hidden = movs.length > 0;
    if (!movs.length) return;
    R.montarLinhaDoTempo(movs).forEach(function (e) {
      var li = document.createElement('li'); li.className = e.estado;
      var n = document.createElement('strong'); n.textContent = e.nome; li.appendChild(n);
      var partes = e.mov ? [fmt(e.mov.dataHora), e.mov.local, e.mov.responsavel && 'Por ' + e.mov.responsavel, e.mov.obs] : ['Etapa pendente'];
      partes.filter(Boolean).forEach(function (p) { var s = document.createElement('small'); s.textContent = p; li.appendChild(s); });
      ol.appendChild(li);
    });
  }

  /* ---------- QR Code: só a URL de consulta, nunca dados pessoais ---------- */
  // Endereço que vai dentro do QR. Em produção/teste no celular, defina BIOOLEO_SITE_URL em config.js (ex.: http://192.168.0.10:5173 ou https://seusite.com.br).
  function urlConsulta(id) {
    var base = window.BIOOLEO_SITE_URL ? new URL('/rastreio/rastreio.html', window.BIOOLEO_SITE_URL) : new URL(location.href);
    base.search = ''; base.hash = ''; base.searchParams.set('id', id); return base.href;
  }
  function avisoQr() {
    var local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(urlConsulta('BO-00000')).hostname);
    var a = $('#qr-aviso'); a.hidden = !local;
    a.textContent = local ? 'Atenção: este QR aponta para "localhost" e só abre neste computador. Para ler com o celular, defina BIOOLEO_SITE_URL em public/rastreio/config.js.' : '';
  }
  function qrSvg(id, opts) {
    var q = qrcode(0, 'M'); q.addData(urlConsulta(id)); q.make();
    return q.createSvgTag(opts);
  }
  function renderQr() {
    $('#qr').innerHTML = qrSvg(frasco.id, { cellSize: 4, margin: 0, scalable: true }); // SVG gerado pela biblioteca
    set('#qr-id', frasco.id); avisoQr();
  }
  $('#qr-ampliar').onclick = function () {
    $('#qr-grande').innerHTML = qrSvg(frasco.id, { cellSize: 4, margin: 0, scalable: true });
    set('#qr-grande-id', frasco.id); $('#dlg-qr').showModal();
  };
  $('#qr-baixar').onclick = function () {
    var svg = qrSvg(frasco.id, { cellSize: 10, margin: 4 });
    var a = document.createElement('a'); a.download = 'qrcode-' + frasco.id + '.svg';
    a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); a.click(); URL.revokeObjectURL(a.href);
  };
  $('#qr-imprimir').onclick = function () {
    var w = window.open('', '_blank'); if (!w) return;
    w.document.write('<title>' + frasco.id + '</title><body style="font-family:sans-serif;text-align:center">' +
      qrSvg(frasco.id, { cellSize: 8, margin: 4 }) + '<h1>' + frasco.id + '</h1></body>');
    w.document.close(); w.focus(); w.print();
  };

  /* ---------- Leitura pela câmera (precisa de HTTPS ou localhost) ---------- */
  async function abrirLeitor() {
    var d = $('#dlg-leitor'); d.showModal(); set('#leitor-msg', 'Abrindo a câmera…');
    if (!window.Html5Qrcode) return set('#leitor-msg', 'Leitor indisponível: biblioteca não carregada.');
    try {
      leitor = new Html5Qrcode('leitor');
      await leitor.start({ facingMode: 'environment' }, { fps: 10, qrbox: 240 }, function (txt) {
        fecharLeitor(); consultar(R.extrairId(txt));
      }, function () {});
      set('#leitor-msg', 'Aponte a câmera para o QR Code do frasco.');
    } catch (e) {
      var seguro = window.isSecureContext;
      set('#leitor-msg', !seguro ? 'A câmera só funciona em HTTPS ou localhost. Abra o módulo por um servidor local.'
        : (/denied|permission/i.test(String(e)) ? 'Permissão da câmera negada. Libere o acesso nas configurações do navegador.'
        : 'Não foi possível acessar a câmera deste dispositivo.'));
    }
  }
  async function fecharLeitor() {
    var l = leitor; leitor = null;
    try { if (l) { await l.stop(); l.clear(); } } catch (e) {}
    if ($('#dlg-leitor').open) $('#dlg-leitor').close();
  }
  $('#btn-ler').onclick = abrirLeitor;
  $('#dlg-leitor').addEventListener('cancel', function () { fecharLeitor(); });
  document.querySelectorAll('[data-fechar]').forEach(function (b) {
    b.onclick = function () { var d = b.closest('dialog'); if (d.id === 'dlg-leitor') fecharLeitor(); else d.close(); };
  });

  /* ---------- Mapa (Google Maps ou OpenStreetMap, escolhido pelo servidor; veja rastreio-mapa.js) ---------- */
  var ajustadoPara = null, marcandoDestino = false, mapaPronto = null;
  var ROTULO = { aovivo: 'Ao vivo', disponivel: 'Disponível', desatualizada: 'Desatualizada', indisponivel: 'Sem posição' };
  var minAtras = function (d) { return Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 6e4)); };
  var km = function (m) { return m >= 1000 ? (m / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(m) + ' m'; };
  var dur = function (s) { var min = Math.max(1, Math.round(s / 60)); return min >= 60 ? Math.floor(min / 60) + ' h ' + (min % 60) + ' min' : min + ' min'; };

  function garantirMapa(forcarOsm) {
    if (!mapaPronto) {
      mapaPronto = S.configMapa().then(function (cfg) {
        return RastreioMapa.criar($('#mapa'), forcarOsm ? { provedor: 'osm' } : cfg, cliqueNoMapa, trocarParaOsm);
      });
    }
    return mapaPronto;
  }
  // O Google recusou a chave depois de carregar (chave inválida, sem faturamento, domínio não autorizado): volta ao OpenStreetMap.
  function trocarParaOsm() {
    mapaPronto = null; ajustadoPara = null; $('#mapa').innerHTML = '';
    garantirMapa(true).then(function () { $('#mapa-aviso').textContent = 'O Google Maps recusou a chave (confira faturamento, APIs ativadas e restrição de domínio). Mostrando o OpenStreetMap.'; renderMapa(); });
  }

  async function renderMapa() {
    var m = await garantirMapa();
    if (m.aviso) $('#mapa-aviso').textContent = m.aviso;
    var loc = frasco.localizacao, dest = frasco.destino, e = R.estadoLocalizacao(loc);
    var selo = $('#loc-estado'); selo.dataset.e = e; selo.textContent = ROTULO[e];
    var equipe = e !== 'indisponivel' ? loc : null;
    var n = [dest, frasco.origem, equipe].filter(Boolean).length;
    var chave = frasco.id + ':' + n + ':' + (frasco.rota && frasco.rota.polyline ? frasco.rota.tipo : '-'); // reenquadra só quando muda o conjunto de pontos/rota
    var reenq = n > 0 && ajustadoPara !== chave; if (reenq) ajustadoPara = chave;
    m.atualizar({ destino: dest, equipe: equipe, origem: frasco.origem, rota: frasco.rota, reenquadrar: reenq });
    $('#mapa-vazio').hidden = n > 0;
    var info = [dest ? (dest.aproximado ? 'Local da coleta: endereço aproximado.' : 'Local da coleta localizado no mapa.') : 'O local da coleta ainda não foi localizado no mapa.'];
    info.push(e === 'indisponivel' ? 'A equipe ainda não compartilhou a posição.' : e === 'aovivo' ? 'Posição da equipe atualizada agora.' : 'Última posição da equipe há ' + minAtras(loc.dataHora) + ' min.');
    set('#loc-info', info.join(' '));
    renderRota();
    setTimeout(function () { m.invalidar(); }, 50);
  }

  function renderRota() {
    var r = frasco.rota; $('#rota-dados').hidden = !r; $('#rota-nota').textContent = '';
    if (!r) return;
    if (r.fonte === 'google') {
      var vivo = r.tipo === 'restante';
      set('#r-rotulo', vivo ? 'Percurso restante' : 'Rota planejada (base → local)');
      set('#r-dist', km(r.distanciaM)); set('#r-tempo', dur(r.duracaoS));
      set('#r-chegada', vivo ? new Date(r.chegadaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—');
      $('#rota-nota').textContent = vivo ? 'Calculado pelo Google a partir da posição atual da equipe (atualiza a cada ~1 min).' : 'A previsão de chegada aparece quando a equipe sair para a coleta.';
    } else {
      set('#r-rotulo', 'Distância aproximada'); set('#r-dist', km(r.distanciaRetaM) + ' em linha reta'); set('#r-tempo', '—'); set('#r-chegada', '—');
      $('#rota-nota').textContent = 'O trajeto e o tempo de viagem aparecem quando o Google Maps estiver configurado no servidor.';
    }
  }

  /* ---------- Equipe: posição ao vivo (só com a chave da equipe; pede permissão e avisa) ---------- */
  var watchId = null, ultimoEnvio = 0, wake = null, compartilhando = false;
  function msgPos(t) { $('#pos-msg').textContent = t; }
  async function atualizarAgora() { try { frasco = await S.consultarFrasco(frasco.id, { publico: publico }); render(); } catch (e) { /* tenta no próximo ciclo */ } }
  async function pegarWakeLock() { try { if (navigator.wakeLock && !wake) wake = await navigator.wakeLock.request('screen'); } catch (e) { wake = null; } }

  async function iniciarVivo() {
    if (!navigator.geolocation) return msgPos('Este navegador não oferece geolocalização.');
    if (!confirm('Sua posição será enviada ao sistema a cada poucos segundos, e o cliente verá a equipe no mapa até a coleta terminar. Mantenha esta página aberta. Continuar?')) return;
    try { await S.iniciarRota(frasco.id); }
    catch (e) { return msgPos(e.codigo === 'NAO_AUTORIZADO' ? 'Chave da equipe ausente ou inválida. Entre no Painel da empresa.' : e.codigo === 'ENCERRADA' ? 'Esta coleta já foi encerrada.' : 'Não foi possível iniciar a rota agora.'); }
    compartilhando = true; ultimoEnvio = 0;
    $('#btn-vivo').textContent = 'Parar de compartilhar'; $('#btn-vivo').classList.add('btn-ativo');
    msgPos('Obtendo a posição…');
    watchId = navigator.geolocation.watchPosition(aoReceberPosicao, aoErrarPosicao, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    pegarWakeLock(); atualizarAgora();
  }
  function pararVivo(msg) {
    compartilhando = false;
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
    try { if (wake) wake.release(); } catch (e) { /* ignora */ }
    wake = null;
    $('#btn-vivo').textContent = 'Compartilhar posição ao vivo'; $('#btn-vivo').classList.remove('btn-ativo');
    if (msg) msgPos(msg);
  }
  async function aoReceberPosicao(p) {
    var lat = p.coords.latitude, lng = p.coords.longitude, agora = Date.now();
    if (!R.coordsValidas(lat, lng) || agora - ultimoEnvio < 10000) return; // no máximo 1 envio a cada 10 s
    ultimoEnvio = agora;
    try {
      var r = await S.registrarLocalizacao(frasco.id, { lat: lat, lng: lng, precisaoM: Math.round(p.coords.accuracy) });
      msgPos(r.persistido ? 'Posição enviada às ' + new Date().toLocaleTimeString('pt-BR') + '.' : 'Demonstração: a posição não foi salva.');
      atualizarAgora();
    } catch (e) {
      if (e.codigo === 'ENCERRADA') pararVivo('Coleta encerrada: o compartilhamento foi parado.');
      else if (e.codigo === 'NAO_AUTORIZADO') pararVivo('Sem permissão: confira a chave da equipe.');
      else msgPos('Não foi possível enviar a posição. Tentando de novo…');
    }
  }
  function aoErrarPosicao(err) {
    msgPos({ 1: 'Permissão negada. Libere a localização nas configurações do navegador.', 2: 'Posição indisponível. Verifique se o GPS está ativado.', 3: 'Tempo esgotado ao obter a posição.' }[err.code] || 'Erro ao obter a posição.');
    if (err.code === 1) pararVivo();
  }
  $('#btn-vivo').onclick = function () { if (compartilhando) pararVivo('Compartilhamento parado.'); else iniciarVivo(); };
  document.addEventListener('visibilitychange', function () { if (!document.hidden && compartilhando) pegarWakeLock(); });

  /* ---------- Equipe: marcar o local da coleta clicando no mapa ---------- */
  $('#btn-destino').onclick = function () {
    marcandoDestino = !marcandoDestino;
    $('#mapa').classList.toggle('marcando', marcandoDestino); $('#btn-destino').classList.toggle('btn-ativo', marcandoDestino);
    msgPos(marcandoDestino ? 'Clique no mapa no local exato da coleta.' : '');
  };
  function cliqueNoMapa(lat, lng) {
    if (!marcandoDestino) return;
    marcandoDestino = false; $('#mapa').classList.remove('marcando'); $('#btn-destino').classList.remove('btn-ativo');
    S.definirDestino(frasco.id, lat, lng)
      .then(function (r) { msgPos(r && r.demo ? 'Demonstração: o local não foi salvo.' : 'Local da coleta marcado.'); atualizarAgora(); })
      .catch(function (e) { msgPos(e.codigo === 'NAO_AUTORIZADO' ? 'Chave da equipe ausente ou inválida.' : 'Não foi possível salvar o local.'); });
  }

  /* ---------- Atualização automática: o cliente acompanha sem recarregar a página ---------- */
  setInterval(function () {
    if (document.hidden || !frasco || compartilhando) return;
    var st = R.statusAtual(frasco.movimentacoes);
    if (st === 'COLETADO' || st === 'CANCELADA') return;
    atualizarAgora();
  }, 15000);

  /* ---------- Início ---------- */
  $('#aviso-demo').hidden = S.modo !== 'demo';
  $('#busca').addEventListener('submit', function (ev) { ev.preventDefault(); consultar($('#busca-id').value); });
  var inicial = params.get('id');
  if (inicial) consultar(inicial);
  else estado('vazio', 'Digite o ID de um frasco ou leia o QR Code para começar.');
})();
