// Eén spelpaneel tegelijk; elk spel bewaart zijn eigen voortgang.
// Controleer ook de trackingstatus: een gemist markerLost-event mag geen HUD laten staan.
AFRAME.registerComponent("marker-hud-guard", {
  init: function () {
    this.stations = [
      ["marker-1", "vraag-1"],
      ["marker-2", "vraag-2"],
      ["tralalero-marker", "dance-puzzle"],
      ["cat-marker", "cat-puzzle"],
      ["marker-5", "puzzle-5"],
      ["marker-6", "puzzle-6"],
    ].map(([marker, panel]) => ({
      marker: document.getElementById(marker),
      panel: document.getElementById(panel),
      wasVisible: false,
    }));
    this.hideAll = () => {
      this.stations.forEach(({ marker, panel }) => {
        if (marker && panel && !panel.hidden) marker.emit("markerLost");
        if (panel) panel.hidden = true;
      });
      this.stations.forEach(station => { station.wasVisible = false; });
      document.getElementById("sla-knop").hidden = true;
    };
    document.addEventListener("visibilitychange", this.hideAll);
    window.addEventListener("pagehide", this.hideAll);
  },
  tock: function () {
    if (document.hidden) return;
    this.stations.forEach(station => {
      const { marker, panel } = station;
      if (!marker || !panel) return;
      const zichtbaar = marker.object3D.visible;
      if (!zichtbaar) {
        if (station.wasVisible || !panel.hidden) marker.emit("markerLost");
        panel.hidden = true;
      } else if (!station.wasVisible && panel.hidden) {
        // Herstel ook een gemist markerFound-event en hervat de spelstatus.
        marker.emit("markerFound");
      }
      station.wasVisible = zichtbaar;
    });
    const marker = document.getElementById("marker-1");
    if (!marker.object3D.visible) document.getElementById("sla-knop").hidden = true;
  },
  remove: function () {
    document.removeEventListener("visibilitychange", this.hideAll);
    window.removeEventListener("pagehide", this.hideAll);
  },
});

document.addEventListener("DOMContentLoaded", () => {
  document.querySelector("a-scene").setAttribute("marker-hud-guard", "");
  [1, 2].forEach(nummer => {
    document.getElementById(`marker-${nummer}`).addEventListener("markerFound", () => {
      window.dispatchEvent(new CustomEvent("ar-station-active", { detail: { marker: nummer } }));
    });
  });
  window.addEventListener("ar-station-active", event => {
    const nummer = event.detail.marker;
    [1, 2].forEach(andere => {
      if (nummer === andere) return;
      document.getElementById(`vraag-${andere}`).hidden = true;
      const marker = document.getElementById(`marker-${andere}`);
      const spel = marker.components[andere === 1 ? "sahur-slagen" : "bombardino"];
      if (spel) spel.actief = false;
      if (andere === 1) document.getElementById("sla-knop").hidden = true;
    });
  });
});
