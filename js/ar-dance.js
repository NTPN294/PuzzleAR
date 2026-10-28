(function () {
  "use strict";
  const settings = window.TRALALERO_CONFIG;

  AFRAME.registerComponent("tralalero-dancer", {
    init: function () {
      this.mixer = null;
      this.clips = [];
      this.el.addEventListener("model-loaded", (event) => {
        const THREE = AFRAME.THREE;
        const model = event.detail.model;
        this.mixer = new THREE.AnimationMixer(model);

        // Start from the artist's relaxed idle pose, rather than the rig's T-pose.
        const idle = (model.animations || []).find((clip) => /idle/i.test(clip.name));
        if (idle) {
          this.mixer.clipAction(idle).play();
          this.mixer.update(0.1);
          const pose = [];
          model.traverse((part) => pose.push({
            part: part, position: part.position.clone(),
            quaternion: part.quaternion.clone(), scale: part.scale.clone()
          }));
          this.mixer.stopAllAction();
          pose.forEach((item) => {
            item.part.position.copy(item.position);
            item.part.quaternion.copy(item.quaternion);
            item.part.scale.copy(item.scale);
          });
        }

        const motion = model.getObjectByName("DanceRoot");
        const height = model.userData.danceHeight || 1;
        const bones = [];
        model.traverse((part) => { if (part.isBone) bones.push(part); });
        const key = (part) => part.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        const times = Array.from({ length: 61 }, (_, index) => index / 60);
        const pulse = (t) => Math.pow(Math.sin(Math.PI * t), 2);
        const trackRotation = (part, rotationAt) => {
          const rest = part.quaternion.clone();
          const values = [];
          times.forEach((t) => {
            const angles = rotationAt(t);
            const delta = new THREE.Quaternion().setFromEuler(new THREE.Euler(angles[0], angles[1], angles[2], "XYZ"));
            const value = rest.clone().multiply(delta).normalize();
            values.push(value.x, value.y, value.z, value.w);
          });
          return new THREE.QuaternionKeyframeTrack(part.uuid + ".quaternion", times, values);
        };
        const trackPosition = (part, positionAt) => {
          const rest = part.position.clone();
          const values = [];
          times.forEach((t) => {
            const offset = positionAt(t);
            values.push(rest.x + offset[0], rest.y + offset[1], rest.z + offset[2]);
          });
          return new THREE.VectorKeyframeTrack(part.uuid + ".position", times, values);
        };
        this.clips = ["left", "right", "jump"].map((name) => {
          const jumping = name === "jump";
          const sign = name === "left" ? -1 : 1;
          const activeSide = name === "left" ? "l" : "r";
          const tracks = [trackPosition(motion, (t) => {
            if (!jumping) return [sign * height * 0.16 * pulse(t), height * 0.025 * pulse(t * 2), 0];
            let lift = 0;
            if (t < 0.15) lift = -0.035 * pulse(t / 0.15);
            else if (t < 0.85) lift = 0.24 * pulse((t - 0.15) / 0.7);
            else lift = -0.025 * pulse((t - 0.85) / 0.15);
            return [0, height * lift, 0];
          }), trackRotation(motion, (t) => jumping ? [0.08 * pulse(t), 0, 0]
              : [0, sign * 0.12 * pulse(t), -sign * 0.08 * pulse(t)])];
          bones.forEach((bone) => {
            const id = key(bone);
            if (/ik/.test(id)) return;
            const side = id.endsWith("l") ? "l" : id.endsWith("r") ? "r" : "";
            const active = jumping || side === activeSide;
            if (/^(arm|leg)1[lr]$/.test(id)) {
              tracks.push(trackRotation(bone, (t) => [
                (jumping ? -0.32 : active ? -0.5 : 0.10) * pulse(t),
                0, (jumping ? 0 : (side === "l" ? 0.15 : -0.15)) * pulse(t)
              ]));
            } else if (/^(arm|leg)2[lr]$/.test(id)) {
              tracks.push(trackRotation(bone, (t) => [(jumping ? 0.72 : active ? 0.62 : 0.12) * pulse(t), 0, 0]));
            } else if (/^(arm|leg)foot[lr]$/.test(id)) {
              tracks.push(trackRotation(bone, (t) => [-(active ? 0.28 : 0.05) * pulse(t), 0, 0]));
            } else if (id === "body") {
              tracks.push(trackRotation(bone, (t) => [0.055 * pulse(t), 0, jumping ? 0 : -sign * 0.07 * pulse(t)]));
            } else if (id === "head") {
              tracks.push(trackRotation(bone, (t) => [-0.06 * pulse(t), jumping ? 0 : -sign * 0.12 * pulse(t), 0]));
            } else if (/^tail[1-5]$/.test(id)) {
              const tailIndex = Number(id.slice(-1));
              tracks.push(trackRotation(bone, (t) => [0, 0.10 * pulse(t) * Math.sin(2 * Math.PI * t - tailIndex * 0.35), 0]));
            }
          });
          return new THREE.AnimationClip(name, 1, tracks);
        });
      });
    },
    dance: function (name) {
      if (!this.mixer) return;
      const clip = this.clips.find((item) => item.name === name);
      if (!clip) return;
      this.mixer.stopAllAction();
      const action = this.mixer.clipAction(clip);
      action.reset();
      action.setLoop(AFRAME.THREE.LoopOnce, 1);
      action.clampWhenFinished = false;
      action.setDuration(settings.moveDuration / 1000);
      action.play();
    },
    stop: function () {
      if (this.mixer) this.mixer.stopAllAction();
    },
    tick: function (time, delta) {
      if (this.mixer) this.mixer.update(Math.min(delta || 0, 100) / 1000);
    },
    remove: function () {
      if (this.mixer) {
        this.mixer.stopAllAction();
        this.mixer.uncacheRoot(this.mixer.getRoot());
      }
    }
  });

  AFRAME.registerComponent("fit-tralalero", {
    init: function () {
      this.el.addEventListener("model-loaded", () => {
        const mesh = this.el.getObject3D("mesh");
        mesh.updateMatrixWorld(true);
        const bounds = new AFRAME.THREE.Box3().setFromObject(mesh.clone(true));
        const size = bounds.getSize(new AFRAME.THREE.Vector3());
        const center = bounds.getCenter(new AFRAME.THREE.Vector3());
        const factor = 3.0 / Math.max(size.x, size.y, size.z);
        mesh.scale.multiplyScalar(factor);
        mesh.position.x -= center.x * factor;
        mesh.position.y -= bounds.min.y * factor;
        mesh.position.z -= center.z * factor;
        // Face the player looking down at the printed marker.
        this.el.setAttribute('rotation', '-75 0 0');
      });
    }
  });

  document.addEventListener("DOMContentLoaded", function () {
    const marker = document.getElementById("tralalero-marker");
    const dancer = document.getElementById("tralalero-dancer");
    const model = document.getElementById("tralalero-model");
    const panel = document.getElementById("dance-puzzle");
    const hint = document.getElementById("scan-hint");
    const status = document.getElementById("dance-status");
    const answer = document.getElementById("dance-order");
    const submit = document.getElementById("check-dance");
    const replay = document.getElementById("replay-dance");
    const clear = document.getElementById("clear-dance");
    const moveButtons = Array.from(document.querySelectorAll("[data-dance-move]"));
    const names = { left: "Links", right: "Rechts", jump: "Spring" };
    const icons = { left: "⬅", right: "➡", jump: "⬆" };
    let found = false;
    let loaded = false;
    let failed = false;
    let playing = false;
    let solved = false;
    let timer = null;
    let session = 0;
    let scannedAt = 0;

    const chosenMoves = () => answer.value.split(",").map((move) => move.trim()).filter(Boolean);
    function state(phase, label) {
      panel.dataset.phase = phase;
      document.getElementById("dance-phase").textContent = label;
    }
    function drawAnswer() {
      const moves = chosenMoves();
      const list = document.getElementById("dance-answer");
      list.replaceChildren();
      settings.order.forEach((_, index) => {
        const slot = document.createElement("li");
        const move = moves[index];
        if (move) {
          slot.dataset.move = move;
          const icon = document.createElement("span");
          icon.textContent = icons[move];
          icon.setAttribute("aria-hidden", "true");
          const label = document.createElement("span");
          label.textContent = names[move];
          slot.append(icon, label);
          slot.setAttribute("aria-label", "Stap " + (index + 1) + ": " + names[move]);
        } else {
          slot.textContent = index + 1;
          slot.setAttribute("aria-label", "Stap " + (index + 1) + ": nog leeg");
        }
        list.appendChild(slot);
      });
      document.getElementById("dance-count").textContent = moves.length + " van " + settings.order.length;
    }
    function enableAnswer(enabled) {
      const moves = chosenMoves();
      answer.disabled = !enabled;
      submit.disabled = !enabled || moves.length !== settings.order.length;
      clear.disabled = !enabled || moves.length === 0;
      moveButtons.forEach((button) => {
        button.disabled = !enabled || moves.length >= settings.order.length;
      });
      drawAnswer();
    }
    function stopDance() {
      session += 1;
      clearTimeout(timer);
      playing = false;
      const component = dancer.components["tralalero-dancer"];
      if (component) component.stop();
      const effect = document.getElementById("shark-effects").components["ar-celebration"];
      if (effect) effect.stop();
    }
    function playDance(delay = settings.startDelay) {
      if (!found || !loaded || solved || document.hidden) return;
      stopDance();
      const run = session;
      playing = true;
      answer.value = "";
      enableAnswer(false);
      replay.disabled = true;
      state("watch", "Even lezen");
      status.textContent = "Lees de vraag. Mijn dans begint zo!";
      function step(index) {
        if (run !== session || !found || document.hidden) return;
        if (index === settings.order.length) {
          playing = false;
          state("answer", "Jouw beurt!");
          enableAnswer(true);
          replay.disabled = false;
          status.textContent = "Nu jij! Tik de " + settings.order.length + " bewegingen in de goede volgorde.";
          return;
        }
        state("watch", "Kijk goed!");
        status.textContent = "Onthoud de bewegingen. Straks ben jij aan de beurt!";
        dancer.components["tralalero-dancer"].dance(settings.order[index]);
        timer = setTimeout(() => step(index + 1), settings.moveDuration + settings.moveGap);
      }
      timer = setTimeout(() => step(0), delay);
    }
    model.addEventListener("model-loaded", function () {
      loaded = true;
      failed = false;
      if (found) playDance(Math.max(0, settings.startDelay - (performance.now() - scannedAt)));
    });
    model.addEventListener("model-error", function () {
      failed = true;
      if (found) {
        state("error", "Even hulp");
        status.textContent = "De haai kon niet laden. Vraag de spelleider om hulp.";
      }
    });
    marker.addEventListener("markerFound", function () {
      window.dispatchEvent(new CustomEvent("ar-station-active", { detail: { marker: 3 } }));
      found = true;
      scannedAt = performance.now();
      panel.hidden = false;
      hint.hidden = true;
      document.body.classList.add("tralalero-visible");
      if (solved) return;
      if (loaded) playDance();
      else {
        state(failed ? "error" : "loading", failed ? "Even hulp" : "Even wachten");
        status.textContent = failed ? "De haai kon niet laden. Vraag de spelleider om hulp." : "Even wachten, de haai komt eraan...";
      }
    });
    marker.addEventListener("markerLost", function () {
      found = false;
      stopDance();
      panel.hidden = true;
      hint.hidden = document.body.classList.contains("cat-visible");
      document.body.classList.remove("tralalero-visible");
      enableAnswer(false);
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        stopDance();
        enableAnswer(false);
      } else if (found && loaded && !solved) playDance();
    });
    replay.addEventListener("click", () => playDance());
    moveButtons.forEach((button) => {
      button.addEventListener("click", () => {
        if (!found || playing || solved || answer.disabled) return;
        const moves = chosenMoves();
        if (moves.length >= settings.order.length) return;
        moves.push(button.dataset.danceMove);
        answer.value = moves.join(",");
        state("answer", "Jouw beurt!");
        enableAnswer(true);
        const remaining = settings.order.length - moves.length;
        status.textContent = remaining ? "Nog " + remaining + (remaining === 1 ? " beweging kiezen." : " bewegingen kiezen.")
          : "Klaar? Tik op 'Check dans'";
      });
    });
    clear.addEventListener("click", () => {
      if (!found || playing || solved || answer.disabled) return;
      answer.value = "";
      state("answer", "Jouw beurt!");
      enableAnswer(true);
      status.textContent = "Probeer het opnieuw. Tik de bewegingen in de goede volgorde.";
    });
    document.getElementById("dance-form").addEventListener("submit", function (event) {
      event.preventDefault();
      if (!found || !loaded || playing || solved || answer.disabled) return;
      const order = chosenMoves();
      if (order.length === settings.order.length && order.every((move, index) => move === settings.order[index])) {
        solved = true;
        state("success", "Gelukt!");
        const effect = document.getElementById("shark-effects").components["ar-celebration"];
        if (effect) effect.celebrate();
        enableAnswer(false);
        replay.disabled = true;
        submit.hidden = true;
        replay.hidden = true;
        clear.hidden = true;
        status.textContent = "Hoera! Je hebt mijn dans onthouden!";
        document.getElementById("dance-reward").hidden = false;
        document.getElementById("dance-code").textContent = settings.launchCode
          ? "Mijn geheime code is: " + settings.launchCode
          : "Vraag de spelleider om het geheime getal.";
      } else {
        state("error", "Nog een keer!");
        status.textContent = "Bijna! Tik op 'Wissen' en probeer het nog eens. Je mag ook nog eens kijken!";
      }
    });
    window.addEventListener("ar-station-active", function (event) {
      if (event.detail.marker === 3) return;
      found = false;
      stopDance();
      panel.hidden = true;
      document.body.classList.remove("tralalero-visible");
      enableAnswer(false);
    });
    enableAnswer(false);
    replay.disabled = true;
    model.setAttribute("fbx-model", settings.modelUrl);
  });

})();
