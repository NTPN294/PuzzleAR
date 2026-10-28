// Eén spelpaneel tegelijk; elk spel bewaart zijn eigen voortgang.
document.addEventListener("DOMContentLoaded", () => {
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
