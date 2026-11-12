// Converte o endereço do agendamento em coordenadas, em segundo plano: Google (Geocoding API) se houver chave,
// senão Nominatim/OpenStreetMap (gratuito: 1 consulta/segundo e uso com identificação).
// Se falhar ou estiver sem internet, o agendamento segue normal e a equipe marca o local no mapa.
import { geocodificarGoogle, googleAtivo } from "./google.js";
const CIDADE = process.env.GEOCODE_CIDADE || "Cianorte, Paraná";
const CONTATO = process.env.NOMINATIM_EMAIL || "";
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
let fila = Promise.resolve();

export async function buscar(q) {
    const u = new URL("https://nominatim.openstreetmap.org/search");
    u.search = new URLSearchParams({ format: "jsonv2", limit: "1", countrycodes: "br", q, ...(CONTATO && { email: CONTATO }) });
    const r = await fetch(u, {
        headers: { "User-Agent": `BioOleoBrasil/1.0 (${CONTATO || "projeto escolar"})`, "Accept-Language": "pt-BR" },
        signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    const [p] = await r.json();
    const lat = parseFloat(p?.lat), lng = parseFloat(p?.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export function agendarGeocodificacao(pool, id, { rua, casa, bairro }) {
    if (process.env.GEOCODING === "off") return;
    fila = fila.then(async () => {
        const google = googleAtivo();
        try {
            let p = google ? await geocodificarGoogle(`${rua}, ${casa}, ${bairro}, ${CIDADE}`) : await buscar(`${rua}, ${casa}, ${bairro}, ${CIDADE}`);
            if (!p) {
                if (!google) await pausa(1100);
                p = google ? await geocodificarGoogle(`${rua}, ${bairro}, ${CIDADE}`) : await buscar(`${rua}, ${bairro}, ${CIDADE}`);
            }
            if (p) await pool.execute("UPDATE agendamentos SET destino_lat = ?, destino_lng = ?, destino_aproximado = ? WHERE id = ? AND destino_lat IS NULL", [p.lat, p.lng, p.aproximado === false ? 0 : 1, id]);
        } catch (e) {
            console.warn("[geocodificação] não foi possível localizar o endereço:", e.message);
        }
        if (!google) await pausa(1100); // Nominatim: 1 consulta por segundo
    });
}
