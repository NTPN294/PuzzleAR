/* Marker 4: Dutch burger riddles and AR celebrations. */
AFRAME.registerComponent("macdonald-model", {
  init: function () {
    const THREE = AFRAME.THREE;
    const manager = new THREE.LoadingManager();
    const base = "models/macdonald/textures/";
    manager.setURLModifier((url) => {
      if (/^(blob:|data:)/.test(url) || !/\.(png|jpe?g)(?:[?#].*)?$/i.test(url)) return url;
      return base + (url.toLowerCase().includes("ground") ? "internal_ground_ao_texture.jpeg" : "psx_texture_processed(7).png");
    });
    this.disposed = false;
    new THREE.FBXLoader(manager).load("models/macdonald/macdonald.fbx", (source) => {
      if (this.disposed) return;
      source.traverse((part) => {
        if (!part.isMesh) return;
        part.frustumCulled = false;
        const materials = Array.isArray(part.material) ? part.material : [part.material];
        materials.forEach((material) => {
          material.side = THREE.DoubleSide;
          if (material.map) {
            material.map.encoding = THREE.sRGBEncoding;
            material.map.magFilter = THREE.NearestFilter;
            material.map.needsUpdate = true;
          }
        });
      });
      source.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(source);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const factor = 1.45 / (size.y || Math.max(size.x, size.z) || 1);
      const model = new THREE.Group();
      model.scale.setScalar(factor);
      source.position.x -= center.x;
      source.position.y -= bounds.min.y;
      source.position.z -= center.z;
      model.add(source);
      this.el.setObject3D("mesh", model);
      this.el.emit("model-loaded", { format: "fbx", model: model });
    }, undefined, (error) => {
      if (!this.disposed) this.el.emit("model-error", { format: "fbx", error: error });
    });
  },
  remove: function () { this.disposed = true; this.el.removeObject3D("mesh"); }
});

AFRAME.registerComponent("cat-reaction", {
  init: function () { this.reaction = null; },
  react: function (kind) { this.reaction = kind; this.started = performance.now(); },
  tick: function () {
    if (!this.reaction) return;
    const t = Math.min((performance.now() - this.started) / 1000, 1);
    const object = this.el.object3D;
    if (this.reaction === "happy") {
      object.position.y = 0.16 * Math.pow(Math.sin(2 * Math.PI * t), 2);
      object.rotation.z = 0.07 * Math.sin(4 * Math.PI * t);
    } else {
      object.rotation.z = 0.055 * Math.sin(6 * Math.PI * t) * Math.sin(Math.PI * t);
    }
    if (t === 1) {
      object.position.y = 0;
      object.rotation.z = 0;
      this.reaction = null;
    }
  }
});


document.addEventListener("DOMContentLoaded", function () {
  const config = window.CAT_CONFIG;
  const panel = document.getElementById("cat-puzzle");
  const marker = document.getElementById("cat-marker");
  const model = document.getElementById("cat-model");
  const hint = document.getElementById("scan-hint");
  const riddle = document.getElementById("cat-riddle");
  const feedback = document.getElementById("cat-feedback");
  const check = document.getElementById("cat-check");
  const next = document.getElementById("cat-next");
  const options = Array.from(document.querySelectorAll("[data-food]"));
  const effects = () => document.getElementById("cat-effects").components["ar-celebration"];
  const selected = new Set();
  let round = 0;
  let found = false;
  let loaded = false;
  let failed = false;
  let correct = false;
  let won = false;
  let feedbackState = "answer";

  function render() {
    document.getElementById("cat-round").textContent = "Burger " + (round + 1) + " van " + config.orders.length;
    panel.dataset.phase = !loaded ? (failed ? "error" : "loading") : (correct || won ? "success" : feedbackState);
    document.querySelectorAll("#cat-progress li").forEach((dot, index) => {
      dot.classList.toggle("current", index === round && !correct);
      dot.classList.toggle("complete", index < round || (index === round && correct));
      dot.setAttribute("aria-label", "Burger " + (index + 1) + (index < round || (index === round && correct) ? ": gelukt" : ""));
      if (index === round && !correct) dot.setAttribute("aria-current", "step");
      else dot.removeAttribute("aria-current");
    });
    riddle.textContent = config.orders[round].riddle;
    options.forEach((button) => {
      button.setAttribute("aria-pressed", String(selected.has(button.dataset.food)));
      button.disabled = !found || !loaded || correct || won;
    });
    let layerY = 0.205;
    const thickness = { kaas: 0.035, sla: 0.045, tomaat: 0.065, ui: 0.045 };
    ["kaas", "sla", "tomaat", "ui"].forEach((id) => {
      const layer = document.getElementById("ingredient-" + id);
      const active = selected.has(id);
      layer.setAttribute("visible", active);
      if (active) {
        layer.setAttribute("position", { x: 0, y: layerY, z: 0 });
        layerY += thickness[id];
      }
    });
    document.getElementById("burger-top").setAttribute("position", { x: 0, y: layerY + 0.08, z: 0 });
    check.disabled = !found || !loaded || correct || won;
    check.hidden = correct || won;
    next.hidden = !correct || won;
    document.getElementById("cat-reward").hidden = !won;
    if (won) {
      document.getElementById("cat-code").textContent = config.launchCode
        ? "Mijn geheime code is: " + config.launchCode
        : "Alle burgers zijn klaar! Vraag de spelleider om het geheime getal.";
    }
  }

  function stopEffects() { const effect = effects(); if (effect) effect.stop(); }
  function activate() {
    window.dispatchEvent(new CustomEvent("ar-station-active", { detail: { marker: 4 } }));
    found = true;
    feedbackState = "answer";
    panel.hidden = false;
    hint.hidden = true;
    document.body.classList.add("cat-visible");
    if (!loaded) feedback.textContent = failed
      ? "De kat kon niet laden. Vraag de spelleider om hulp."
      : "Even wachten, de kat komt eraan...";
    else if (!correct && !won) feedback.textContent = "Kies wat op mijn burger mag. Tik op iets om het erbij te doen of weg te halen.";
    render();
  }
  model.addEventListener("model-loaded", () => {
    loaded = true;
    if (found) {
      feedback.textContent = "Kies wat op mijn burger mag. Tik op iets om het erbij te doen of weg te halen.";
      render();
    }
  });
  model.addEventListener("model-error", () => {
    failed = true;
    if (found) feedback.textContent = "De kat kon niet laden. Vraag de spelleider om hulp.";
  });
  loaded = !!model.getObject3D("mesh");
  marker.addEventListener("markerFound", activate);
  marker.addEventListener("markerLost", () => {
    found = false;
    stopEffects();
    panel.hidden = true;
    document.body.classList.remove("cat-visible");
    hint.hidden = document.body.classList.contains("tralalero-visible");
    render();
  });
  window.addEventListener("ar-station-active", (event) => {
    if (event.detail.marker === 4) return;
    found = false;
    stopEffects();
    panel.hidden = true;
    document.body.classList.remove("cat-visible");
    render();
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopEffects(); });
  options.forEach((button) => button.addEventListener("click", () => {
    if (!found || !loaded || correct || won) return;
    feedbackState = "answer";
    const id = button.dataset.food;
    if (selected.has(id)) selected.delete(id); else selected.add(id);
    feedback.textContent = "Kijk naar je burger. Klaar? Tik op 'Check burger'";
    render();
  }));
  check.addEventListener("click", () => {
    if (!found || !loaded || correct || won) return;
    const answer = config.orders[round].items;
    correct = selected.size === answer.length && answer.every((id) => selected.has(id));
    if (correct) {
      model.components["cat-reaction"].react("happy");
      effects().celebrate();
      if (round === config.orders.length - 1) {
        won = true;
        feedback.textContent = "Alle burgers goed! Miauw, jij bent een topkok!";
      } else feedback.textContent = "Miauw! Precies de burger die ik wilde! Op naar de volgende!";
    } else {
      feedbackState = "error";
      model.components["cat-reaction"].react("wrong");
      feedback.textContent = "Bijna! Lees het raadsel nog eens. Tik op iets om het erbij te doen of weg te halen.";
    }
    render();
  });
  next.addEventListener("click", () => {
    if (!found || !correct || won) return;
    round += 1;
    correct = false;
    feedbackState = "answer";
    selected.clear();
    feedback.textContent = "Nog een burger! Wat vind ik deze keer lekker?";
    render();
  });
  render();
});
