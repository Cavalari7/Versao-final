/* App do entregador: lista as entregas, compartilha a posição (GPS do celular) e conclui a coleta.
   Só funciona com a chave da equipe e em HTTPS (ou localhost). */
(function () {
  var R = window.RastreioRules, S = window.RastreioService;
  var $ = function (s) { return document.querySelector(s); };
  var itens = [], atual = null, watchId = null, ultimoEnvio = 0, wake = null;
  var ROT = { AGENDADA: 'Coleta agendada', ENTREGUE: 'Frasco entregue', EM_ROTA: 'A caminho', COLETADO: 'Coletado', CANCELADA: 'Cancelada' };
  var msg = function (t, erro) { var m = $('#msg'); m.textContent = t || ''; m.className = erro ? 'erro' : 'mut'; };
  var gps = function (t) { $('#gps').textContent = t; };
  var txt = function (sel, t) { $(sel).textContent = t == null || t === '' ? '—' : t; };
  var mostrar = function (q) { ['#login', '#lista', '#entrega'].forEach(function (x) { $(x).hidden = x !== q; }); };
  var erroTxt = function (e) {
    return { NAO_AUTORIZADO: 'Chave da equipe inválida.', REDE: 'Sem conexão com o servidor.', ENCERRADA: 'Esta coleta já foi encerrada.' }[e.codigo] || 'Algo deu errado. Tente de novo.';
  };

  async function carregarLista(aviso) {
    msg(aviso || 'Carregando…');
    try {
      var lista = itens = await S.listarAtivos();
      var box = $('#lista'); box.replaceChildren();
      msg([aviso, lista.length ? '' : 'Nenhuma entrega em aberto.'].filter(Boolean).join(' '));
      lista.forEach(function (f) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'item';
        var t = document.createElement('strong'); t.textContent = f.id + ' · ' + (ROT[f.status] || f.status);
        var l1 = document.createElement('div'); l1.textContent = f.endereco;
        var l2 = document.createElement('small'); l2.className = 'mut'; l2.textContent = f.cliente + ' · ' + f.litrosPrevistos + ' L · ' + (f.dia || '').split('-').reverse().join('/') + ' ' + (f.hora || '').slice(0, 5);
        b.append(t, l1, l2); b.onclick = function () { abrir(f.id); }; box.appendChild(b);
      });
      mostrar('#lista');
    } catch (e) {
      if (e.codigo === 'NAO_AUTORIZADO') { mostrar('#login'); msg('Digite a chave da equipe.', false); } else { mostrar('#lista'); msg(erroTxt(e), true); }
    }
  }

  async function abrir(id) {
    msg('Abrindo…');
    try {
      atual = await S.consultarFrasco(id);
      msg(''); desenhar(); mostrar('#entrega');
    } catch (e) { msg(erroTxt(e), true); }
  }
  function desenhar() {
    var f = atual, st = R.statusAtual(f.movimentacoes);
    txt('#e-id', f.id); txt('#e-status-txt', R.rotuloStatus(st)); $('#e-status').dataset.st = st || 'nenhum';
    txt('#e-cliente', f.cliente); txt('#e-end', f.endereco); txt('#e-litros', f.litrosPrevistos + ' L');
    $('#litros').value = f.litrosPrevistos;
    var d = f.destino, alvo = d ? d.lat + ',' + d.lng : encodeURIComponent(f.endereco || '');
    $('#e-nav').href = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' + alvo;
    // WhatsApp: abre a conversa com o cliente já com o link de acompanhamento (sem custo, sem API).
    var it = itens.filter(function (x) { return x.id === f.id; })[0], zap = $('#e-zap');
    var dig = it ? String(it.telefone || '').replace(/\D/g, '') : '';
    if (dig.length >= 10 && it.token) {
      var link = location.origin + '/rastreio/rastreio.html?id=' + f.id + '&t=' + it.token;
      zap.href = 'https://wa.me/' + (dig.length <= 11 ? '55' + dig : dig) + '?text=' + encodeURIComponent('Olá, ' + f.cliente + '! Aqui é a equipe da Bio Óleo / Brasil. Estamos a caminho da sua coleta. Acompanhe em tempo real: ' + link);
      zap.hidden = false;
    } else zap.hidden = true;
    var aberto = st !== 'COLETADO' && st !== 'CANCELADA';
    $('#btn-iniciar').hidden = !aberto; $('#btn-coletar').hidden = !aberto; $('#litros').hidden = !aberto;
    $('#btn-iniciar').textContent = watchId == null ? 'Iniciar rota e compartilhar posição' : 'Parar de compartilhar';
  }

  async function iniciar() {
    if (watchId != null) return parar('Compartilhamento parado.');
    if (!navigator.geolocation) return gps('Este aparelho não oferece geolocalização.');
    try { await S.iniciarRota(atual.id); } catch (e) { return gps(erroTxt(e)); }
    ultimoEnvio = 0; gps('Obtendo o GPS…');
    watchId = navigator.geolocation.watchPosition(aoReceber, aoErrar, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    try { if (navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); } catch (e) { wake = null; }
    desenhar();
  }
  function parar(t) {
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    watchId = null; try { if (wake) wake.release(); } catch (e) { /* ignora */ } wake = null;
    if (t) gps(t); if (atual) desenhar();
  }
  async function aoReceber(p) {
    var lat = p.coords.latitude, lng = p.coords.longitude, agora = Date.now();
    if (!R.coordsValidas(lat, lng) || agora - ultimoEnvio < 10000) return;   // no máximo 1 envio a cada 10 s
    ultimoEnvio = agora;
    try {
      await S.registrarLocalizacao(atual.id, { lat: lat, lng: lng, precisaoM: Math.round(p.coords.accuracy) });
      gps('Posição enviada às ' + new Date().toLocaleTimeString('pt-BR') + ' (precisão ~' + Math.round(p.coords.accuracy) + ' m).');
    } catch (e) { if (e.codigo === 'ENCERRADA' || e.codigo === 'NAO_AUTORIZADO') parar(erroTxt(e)); else gps('Falha ao enviar. Tentando de novo…'); }
  }
  function aoErrar(err) {
    gps({ 1: 'Permissão de localização negada. Libere nas configurações do navegador.', 2: 'GPS indisponível. Ative a localização do aparelho.', 3: 'Tempo esgotado ao obter o GPS.' }[err.code] || 'Erro de GPS.');
    if (err.code === 1) parar();
  }

  async function coletar() {
    var l = parseFloat($('#litros').value);
    if (!(l > 0)) return gps('Informe os litros coletados.');
    if (!confirm('Confirmar a coleta de ' + l + ' L?')) return;
    try { await S.coletar(atual.id, l); parar(); var feita = atual.id; atual = null; carregarLista('Coleta ' + feita + ' concluída.'); }
    catch (e) { gps(e.codigo === 'ENCERRADA' ? 'Esta coleta já foi encerrada.' : erroTxt(e)); }
  }

  $('#btn-entrar').onclick = function () { try { localStorage.setItem('bioleo_admin_key', $('#chave').value.trim()); } catch (e) { /* ignora */ } carregarLista(); };
  $('#btn-iniciar').onclick = iniciar; $('#btn-coletar').onclick = coletar;
  $('#btn-voltar').onclick = function () { parar(); atual = null; carregarLista(); };
  document.addEventListener('visibilitychange', async function () { if (!document.hidden && watchId != null && !wake && navigator.wakeLock) { try { wake = await navigator.wakeLock.request('screen'); } catch (e) { wake = null; } } });
  carregarLista();
})();
