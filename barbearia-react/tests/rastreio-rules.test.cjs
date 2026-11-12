// Regras do rastreio (sem navegador): node tests/rastreio-rules.test.cjs
const assert = require('node:assert');
// O projeto é "type: module"; o arquivo do rastreio é um script comum, então carregamos em um contexto isolado.
const ctx = { module: { exports: {} }, URL };
require('node:vm').runInNewContext(require('node:fs').readFileSync(__dirname + '/../public/rastreio/js/rastreio-rules.js', 'utf8'), ctx);
const R = ctx.module.exports;
const t = (n, f) => { f(); console.log('ok -', n); };
const D = (m) => new Date(Date.now() - m * 60000).toISOString();
t('valida ID', () => { assert(R.validarId('bo-00003')); assert(!R.validarId('BO-3')); assert(!R.validarId("BO-00003'; DROP")); });
t('extrai ID da URL do QR', () => { assert.strictEqual(R.extrairId('https://x.com/rastreio.html?id=bo-00003'), 'BO-00003'); });
t('sem registro não há status', () => assert.strictEqual(R.statusAtual([]), null));
t('status vem do último registro', () => assert.strictEqual(R.statusAtual([{ status: 'COLETADO', dataHora: '2026-10-14T09:00:00Z' }, { status: 'AGENDADA', dataHora: '2026-10-07T09:00:00Z' }]), 'COLETADO'));
t('linha do tempo com rota', () => {
  const l = R.montarLinhaDoTempo([{ status: 'AGENDADA', dataHora: '2026-10-07T09:00:00Z' }, { status: 'EM_ROTA', dataHora: '2026-10-08T09:00:00Z' }]);
  assert.deepEqual(l.map(x => x.status + ':' + x.estado), ['AGENDADA:concluida', 'EM_ROTA:atual', 'COLETADO:futura']);
});
t('etapa pulada some', () => assert.deepEqual(R.montarLinhaDoTempo([{ status: 'AGENDADA', dataHora: '2026-10-07T09:00:00Z' }, { status: 'COLETADO', dataHora: '2026-10-08T09:00:00Z' }]).map(x => x.status), ['AGENDADA', 'COLETADO']));
t('cancelamento encerra a linha', () => assert.deepEqual(R.montarLinhaDoTempo([{ status: 'AGENDADA', dataHora: '2026-10-07T09:00:00Z' }, { status: 'CANCELADA', dataHora: '2026-10-08T09:00:00Z' }]).map(x => x.estado), ['concluida', 'cancelada']));
t('estado da localização', () => {
  assert.strictEqual(R.estadoLocalizacao(null), 'indisponivel');
  assert.strictEqual(R.estadoLocalizacao({ lat: 95, lng: 0, dataHora: D(0) }), 'indisponivel');
  assert.strictEqual(R.estadoLocalizacao({ lat: -23, lng: -52, dataHora: D(1) }), 'aovivo');
  assert.strictEqual(R.estadoLocalizacao({ lat: -23, lng: -52, dataHora: D(60) }), 'disponivel');
  assert.strictEqual(R.estadoLocalizacao({ lat: -23, lng: -52, dataHora: D(60 * 30) }), 'desatualizada');
});
t('diferença de litros', () => { assert.strictEqual(R.diferencaLitros(15, null), null); assert.strictEqual(R.diferencaLitros(15, 13.5), -1.5); });
t('decodifica a rota do Google', () => {
  const p = R.decodificarPolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@'); // exemplo da documentação do Google
  assert.strictEqual(p.length, 3); assert.deepEqual(p[0], [38.5, -120.2]); assert.deepEqual(p[1], [40.7, -120.95]); assert.deepEqual(p[2], [43.252, -126.453]);
  assert.strictEqual(R.decodificarPolyline('').length, 0);
});
