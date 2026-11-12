// "Google de mentira" para testes: responde como a Routes API e a Geocoding API, sem internet e sem cobrança.
import http from "node:http";
export function subirGoogleFalso(porta = 0) {
    const estado = { rotas: 0, geos: 0, ultimaRota: null, ultimoHeaders: null };
    const srv = http.createServer((req, res) => {
        const u = new URL(req.url, "http://x");
        const json = (c, o) => { res.writeHead(c, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
        if (u.pathname === "/geocode") {
            estado.geos++;
            if (u.searchParams.get("key") !== "k-servidor") return json(200, { status: "REQUEST_DENIED" });
            if ((u.searchParams.get("address") || "").includes("Nada")) return json(200, { status: "ZERO_RESULTS", results: [] });
            return json(200, { status: "OK", results: [{ geometry: { location: { lat: -23.66, lng: -52.6 }, location_type: "ROOFTOP" } }] });
        }
        let corpo = "";
        req.on("data", (c) => (corpo += c));
        req.on("end", () => {
            estado.rotas++; estado.ultimoHeaders = req.headers; estado.ultimaRota = JSON.parse(corpo || "{}");
            if (req.headers["x-goog-api-key"] !== "k-servidor") return json(403, { error: { status: "PERMISSION_DENIED" } });
            // polyline de exemplo da documentação do Google (3 pontos)
            json(200, { routes: [{ distanceMeters: 4200, duration: "600s", polyline: { encodedPolyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" } }] });
        });
    });
    return new Promise((ok) => srv.listen(porta, "127.0.0.1", () => ok({ estado, porta: srv.address().port, fechar: () => srv.close() })));
}
