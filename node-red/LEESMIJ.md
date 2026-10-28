# Node-RED importeren

1. Open http://iot08:1880 op hetzelfde netwerk als de Pi.
2. Kies menu → Import → select a file en selecteer `puzzlear-flow.json`.
3. Klik Import en daarna Deploy.
4. Controleer dat de MQTT-node `connected` toont. De broker staat op
   `192.168.1.46:1883`. Vul in de brokerconfiguratie je inloggegevens in als nodig.
5. Open http://iot08:1880/puzzle-ar/status voor een verbindingstest.

De website controleert de geheime code zelf en stuurt alleen `message=pass`
en een timestamp naar `POST /puzzle-ar`. De flow publiceert op `PuzzleAR` met QoS 1:

```json
{"message":"pass","timestamp":"2026-10-28T13:34:56+01:00"}
```

De timestamp wordt in de browser gemaakt in Nederlandse tijd (Europe/Amsterdam, automatisch zomer-/wintertijd) en ongewijzigd doorgestuurd. HTTP 202 bevestigt acceptatie door
de flow, niet de ontvangst door de MQTT-broker. Controleer die in MQTT Explorer.
Verander bij een nieuwe geheime code alleen `GEHEIME_CODE` in de HTML.

## GitHub Pages en telefoon

`http://iot08:1880` is het lokale testadres. GitHub Pages gebruikt HTTPS;
configureer daarom een HTTPS-proxy/tunnel naar de HTTP-endpoints op de Pi en
vervang `NODE_RED_URL` in `AR1.html` door dat HTTPS-adres. Publiceer alleen
`/puzzle-ar` en `/puzzle-ar/status`, niet de Node-RED-editor.
De hostnaam `iot08` moet door het apparaat kunnen worden gevonden bij lokaal gebruik.

De flow voegt CORS-headers toe aan antwoorden. De formulier-POST gebruikt geen
JSON-contenttype, waardoor een gewone CORS-preflight niet nodig is. Browsers
kunnen daarnaast toestemming vereisen voor toegang tot het lokale netwerk.
Als je proxy een OPTIONS-preflight vereist, configureer daar CORS voor de
GitHub Pages-origin, GET/POST/OPTIONS en Content-Type. Node-RED ondersteunt dit
ook met `httpNodeCors` in `settings.js`.
