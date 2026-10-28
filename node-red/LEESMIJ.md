# Publieke MQTT naar lokale Mosquitto

1. Open http://iot08:1880 en verwijder of disable de oude PuzzleAR HTTP-flow.
2. Menu > Import > selecteer `puzzlear-flow.json` > Import > Deploy.
3. Beide MQTT-nodes moeten connected tonen. De Pi heeft internet nodig.
4. Vul bij Lokale Mosquitto zo nodig de bestaande gebruikersnaam en het wachtwoord in.
5. Open de bijgewerkte website en vul de juiste code in.
6. In de debug-zijbalk verschijnt het bericht; MQTT Explorer ontvangt het op `PuzzleAR`.

Route:
- Website: `wss://broker.emqx.io:8084/mqtt`
- Publiek topic: `PuzzleAR/NTPN294/iot08/pass`
- Node-RED ontvangt van `broker.emqx.io:1883`
- Lokale bestemming: `192.168.1.46:1883`, topic `PuzzleAR`

Alleen `message: pass` en de Nederlandse timestamp worden verstuurd.
De geheime code wordt alleen in AR1.html gecontroleerd. Het publieke bericht
wordt niet retained opgeslagen. De flow onderdrukt directe dubbele afleveringen.
De webpagina bevestigt ontvangst door de publieke broker; dat bewijst nog niet
dat de Pi het bericht heeft doorgestuurd. Controleer hiervoor MQTT Explorer.

Dit is een publieke testbroker: berichten zijn voor anderen leesbaar en het topic
is geen wachtwoord. Gebruik dit voor de workshop, niet voor beveiligde toegangscontrole.

HTTPS op de Pi en CORS zijn voor deze route niet nodig. Publiceer de bijgewerkte
HTML en scripts op GitHub Pages voordat je de telefoon opnieuw test.
