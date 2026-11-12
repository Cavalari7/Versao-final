/* Mapa do rastreio com dois provedores atrás da mesma interface:
   Google Maps (se o servidor tiver a chave pública) ou Leaflet/OpenStreetMap (sem chave, ou se o Google falhar).
   mapa.atualizar({ destino, equipe, origem, rota, reenquadrar }) desenha tudo; o resto da página não sabe qual provedor é. */
(function (root) {
  var R = root.RastreioRules;
  var CENTRO = { lat: -23.66, lng: -52.6 };

  function pontos(e) {
    var pts = [];
    if (e.destino && R.coordsValidas(e.destino.lat, e.destino.lng)) pts.push([e.destino.lat, e.destino.lng]);
    if (e.origem && R.coordsValidas(e.origem.lat, e.origem.lng)) pts.push([e.origem.lat, e.origem.lng]);
    if (e.equipe && R.coordsValidas(e.equipe.lat, e.equipe.lng)) pts.push([e.equipe.lat, e.equipe.lng]);
    return pts;
  }
  function trajeto(e) { return e.rota && e.rota.polyline ? R.decodificarPolyline(e.rota.polyline) : []; }
  var textoDestino = function (d) { return d.aproximado ? 'Local da coleta (endereço aproximado)' : 'Local da coleta'; };

  /* ---------- Leaflet / OpenStreetMap ---------- */
  function criarLeaflet(el, aoClicar) {
    L.Icon.Default.imagePath = 'lib/leaflet/images/';
    var map = L.map(el).setView([CENTRO.lat, CENTRO.lng], 12), camada = L.layerGroup().addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
    map.on('click', function (ev) { aoClicar(ev.latlng.lat, ev.latlng.lng); });
    var pino = function (letra, cls) { return L.divIcon({ className: '', html: '<span class="pino ' + cls + '">' + letra + '</span>', iconSize: [28, 28], iconAnchor: [14, 14] }); };
    return {
      provedor: 'osm',
      atualizar: function (e) {
        camada.clearLayers();
        var pts = pontos(e), rota = trajeto(e);
        if (rota.length > 1) L.polyline(rota, { color: '#f2b705', weight: 5, opacity: 0.9 }).addTo(camada);
        if (e.destino && R.coordsValidas(e.destino.lat, e.destino.lng)) L.marker([e.destino.lat, e.destino.lng], { icon: pino('C', 'pino-c') }).addTo(camada).bindPopup(textoDestino(e.destino));
        if (e.origem && R.coordsValidas(e.origem.lat, e.origem.lng)) L.marker([e.origem.lat, e.origem.lng], { icon: pino('B', 'pino-b') }).addTo(camada).bindPopup(e.origem.nome || 'Base');
        if (e.equipe && R.coordsValidas(e.equipe.lat, e.equipe.lng)) L.marker([e.equipe.lat, e.equipe.lng], { icon: pino('', 'pino-e') }).addTo(camada).bindPopup('Equipe de coleta');
        if (e.reenquadrar && pts.length) {
          if (pts.length === 1) map.setView(pts[0], 16); else map.fitBounds(rota.length > 1 ? rota.concat(pts) : pts, { padding: [40, 40], maxZoom: 16 });
        }
      },
      invalidar: function () { map.invalidateSize(); }
    };
  }

  /* ---------- Google Maps (Maps JavaScript API) ---------- */
  function carregarGoogle(chave, aoFalharDepois) {
    return new Promise(function (ok, falha) {
      if (root.google && root.google.maps && root.google.maps.importLibrary) return ok();
      var fim = setTimeout(function () { falha(new Error('tempo esgotado')); }, 12000);
      root.__gmPronto = function () { clearTimeout(fim); ok(); };
      root.gm_authFailure = function () { clearTimeout(fim); if (aoFalharDepois) aoFalharDepois(); falha(new Error('chave recusada')); }; // chave inválida/sem permissão/sem faturamento
      var s = document.createElement('script');
      s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(chave) + '&loading=async&v=weekly&language=pt-BR&region=BR&callback=__gmPronto';
      s.async = true; s.onerror = function () { clearTimeout(fim); falha(new Error('sem acesso ao Google')); };
      document.head.appendChild(s);
    });
  }
  async function criarGoogle(el, cfg, aoClicar, aoFalharDepois) {
    await carregarGoogle(cfg.chave, aoFalharDepois);
    var lib = await google.maps.importLibrary('maps'), mk = await google.maps.importLibrary('marker');
    var map = new lib.Map(el, {
      center: CENTRO, zoom: 12, mapId: cfg.mapId || 'DEMO_MAP_ID', colorScheme: 'DARK',
      gestureHandling: 'cooperative', streetViewControl: false, mapTypeControl: true, fullscreenControl: true
    });
    map.addListener('click', function (ev) { aoClicar(ev.latLng.lat(), ev.latLng.lng()); });
    var itens = [], linha = null;
    var pino = function (pos, titulo, fundo, letra, cor) {
      var p = new mk.PinElement({ background: fundo, borderColor: '#000', glyph: letra, glyphColor: cor || '#000' });
      itens.push(new mk.AdvancedMarkerElement({ map: map, position: { lat: pos.lat, lng: pos.lng }, title: titulo, content: p.element }));
    };
    return {
      provedor: 'google',
      atualizar: function (e) {
        itens.forEach(function (m) { m.map = null; }); itens = [];
        if (linha) { linha.setMap(null); linha = null; }
        var pts = pontos(e), rota = trajeto(e);
        if (rota.length > 1) linha = new lib.Polyline({ map: map, path: rota.map(function (q) { return { lat: q[0], lng: q[1] }; }), strokeColor: '#f2b705', strokeOpacity: 0.9, strokeWeight: 5 });
        if (e.destino && R.coordsValidas(e.destino.lat, e.destino.lng)) pino(e.destino, textoDestino(e.destino), '#f2b705', 'C');
        if (e.origem && R.coordsValidas(e.origem.lat, e.origem.lng)) pino(e.origem, e.origem.nome || 'Base', '#1f6b35', 'B', '#fff');
        if (e.equipe && R.coordsValidas(e.equipe.lat, e.equipe.lng)) pino(e.equipe, 'Equipe de coleta', '#22c55e', '');
        if (e.reenquadrar && pts.length) {
          if (pts.length === 1) { map.setCenter({ lat: pts[0][0], lng: pts[0][1] }); map.setZoom(16); }
          else {
            var b = new google.maps.LatLngBounds();
            pts.concat(rota).forEach(function (q) { b.extend({ lat: q[0], lng: q[1] }); });
            map.fitBounds(b, 48);
          }
        }
      },
      invalidar: function () { if (root.google) google.maps.event.trigger(map, 'resize'); }
    };
  }

  // Tenta o Google; se não houver chave, ou ele falhar (rede, chave recusada, sem faturamento), usa o OpenStreetMap e explica por quê.
  async function criar(el, cfg, aoClicar, aoFalharDepois) {
    if (cfg && cfg.provedor === 'google' && cfg.chave) {
      try { var m = await criarGoogle(el, cfg, aoClicar, aoFalharDepois); m.aviso = ''; return m; }
      catch (e) { el.innerHTML = ''; var o = criarLeaflet(el, aoClicar); o.aviso = 'Não foi possível carregar o Google Maps (' + e.message + '). Mostrando o OpenStreetMap.'; return o; }
    }
    var l = criarLeaflet(el, aoClicar); l.aviso = ''; return l;
  }

  root.RastreioMapa = { criar: criar };
})(window);
