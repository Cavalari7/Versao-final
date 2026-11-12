// Integração com o Google Maps Platform. Roda SÓ no servidor: a chave secreta nunca vai para o navegador.
// APIs usadas: Routes API (rota, distância e tempo) e Geocoding API (endereço -> coordenadas).
// Sem chave configurada tudo continua funcionando: o sistema mostra a distância em linha reta e usa o Nominatim.
const chave = () => process.env.GOOGLE_MAPS_SERVER_KEY || "";
const URL_ROTAS = () => process.env.GOOGLE_ROUTES_URL || "https://routes.googleapis.com/directions/v2:computeRoutes";
const URL_GEO = () => process.env.GOOGLE_GEOCODE_URL || "https://maps.googleapis.com/maps/api/geocode/json";
export const googleAtivo = () => !!chave();

// Distância em linha reta (metros) — só uma aproximação, nunca apresentada como rota.
export function distanciaReta(a, b) {
    const r = (g) => (g * Math.PI) / 180, R = 6371000;
    const x = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
}

// Os avisos de erro nunca imprimem a URL nem a chave.
export async function geocodificarGoogle(endereco) {
    if (!chave()) return null;
    const u = new URL(URL_GEO());
    u.search = new URLSearchParams({ address: endereco, region: "br", language: "pt-BR", key: chave() });
    try {
        const j = await (await fetch(u, { signal: AbortSignal.timeout(6000) })).json();
        if (j.status !== "OK") { if (j.status !== "ZERO_RESULTS") console.warn("[google] geocoding:", j.status); return null; }
        const g = j.results[0], l = g.geometry.location;
        return { lat: l.lat, lng: l.lng, aproximado: g.geometry.location_type !== "ROOFTOP" };
    } catch (e) {
        console.warn("[google] geocoding falhou:", e.name);
        return null;
    }
}

export async function calcularRota(origem, destino) {
    if (!chave()) return null;
    const ponto = (p) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
    try {
        const r = await fetch(URL_ROTAS(), {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Goog-Api-Key": chave(), "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline" },
            body: JSON.stringify({
                origin: ponto(origem), destination: ponto(destino), travelMode: "DRIVE", languageCode: "pt-BR", units: "METRIC",
                routingPreference: process.env.ROTA_COM_TRAFEGO === "on" ? "TRAFFIC_AWARE" : "TRAFFIC_UNAWARE",
                polylineEncoding: "ENCODED_POLYLINE",
            }),
            signal: AbortSignal.timeout(8000),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { console.warn("[google] rotas:", r.status, j?.error?.status || ""); return null; }
        const rota = j.routes?.[0];
        if (!rota || !Number.isFinite(rota.distanceMeters)) return null;
        return { distanciaM: rota.distanceMeters, duracaoS: parseInt(String(rota.duration), 10) || 0, polyline: rota.polyline?.encodedPolyline || null };
    } catch (e) {
        console.warn("[google] rotas falhou:", e.name);
        return null;
    }
}

// Ponto de partida da equipe: BASE_LAT/BASE_LNG, ou o BASE_ENDERECO convertido uma vez (guardado em memória).
let base, baseEm = 0;
export async function baseOrigem() {
    const nome = process.env.BASE_NOME || "Bio Óleo / Brasil";
    const lat = parseFloat(process.env.BASE_LAT), lng = parseFloat(process.env.BASE_LNG);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng, nome };
    if (base || Date.now() - baseEm < 5 * 60000) return base || null;
    baseEm = Date.now();
    const end = process.env.BASE_ENDERECO;
    const g = end && googleAtivo() ? await geocodificarGoogle(end) : null;
    base = g ? { lat: g.lat, lng: g.lng, nome } : null;
    return base;
}

// Rota de uma entrega, com cache para controlar o custo (cada consulta ao Google é cobrada após a cota grátis):
// "restante" = da posição atual da equipe ao local (refeita no máx. a cada 60 s ou se andou 300 m);
// "planejada" = da base ao local, enquanto a equipe ainda não saiu (refeita a cada 30 min).
const cache = new Map(), pend = new Map();
export async function rotaDaEntrega(id, base, equipe, destino) {
    const de = equipe || base;
    if (!destino || !de) return null;
    const tipo = equipe ? "restante" : "planejada";
    const aprox = { tipo, fonte: "linha-reta", distanciaRetaM: Math.round(distanciaReta(de, destino)) };
    if (!googleAtivo()) return aprox;
    const c = cache.get(id), idade = c ? Date.now() - c.em : Infinity;
    const mesmoAlvo = c && c.tipo === tipo && c.dest.lat === destino.lat && c.dest.lng === destino.lng;
    const andou = c ? distanciaReta(c.de, de) : Infinity;
    if (mesmoAlvo && (idade < (equipe ? 60000 : 1800000)) && !(equipe && andou >= 300 && idade >= 20000)) return c.dado;
    if (pend.has(id)) return pend.get(id);
    const p = (async () => {
        const r = await calcularRota(de, destino);
        const dado = r
            ? { tipo, fonte: "google", distanciaM: r.distanciaM, duracaoS: r.duracaoS, polyline: r.polyline,
                calculadaEm: new Date().toISOString(), chegadaEm: new Date(Date.now() + r.duracaoS * 1000).toISOString() }
            : aprox; // Google indisponível: cai para a distância em linha reta e tenta de novo em 60 s
        cache.set(id, { tipo, de, dest: { lat: destino.lat, lng: destino.lng }, em: r ? Date.now() : Date.now() - (equipe ? 0 : 1740000), dado });
        return dado;
    })().finally(() => pend.delete(id));
    pend.set(id, p);
    return p;
}
