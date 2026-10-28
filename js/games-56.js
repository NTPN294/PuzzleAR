AFRAME.registerComponent("fit-coffee", {
  init: function () {
    this.el.addEventListener("model-loaded", () => {
      const mesh = this.el.getObject3D("mesh");
      const bounds = new THREE.Box3().setFromObject(mesh);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const factor = 0.65 / Math.max(size.x, size.y, size.z, 0.001);
      mesh.scale.multiplyScalar(factor);
      mesh.position.x -= center.x * factor;
      mesh.position.y -= bounds.min.y * factor;
      mesh.position.z -= center.z * factor;
      document.getElementById("coffee-fallback").setAttribute("visible", false);
    });
  },
});

AFRAME.registerComponent("extra-puzzle", {
  schema: { kind: { type: "int", default: 5 } },
  init: function () {
    this.kind = this.data.kind;
    this.panel = document.getElementById(`puzzle-${this.kind}`);
    this.status = document.getElementById(`status-${this.kind}`);
    this.progress = document.getElementById(`progress-${this.kind}`);
    this.replay = document.getElementById(`replay-${this.kind}`);
    this.buttons = [...this.panel.querySelectorAll("[data-choice]")];
    this.bananas = [...this.el.querySelectorAll(".banana-option")];
    this.runner = this.el.querySelector("#coffee-runner");
    this.cups = [...this.el.querySelectorAll("#coffee-cups > a-entity")];
    this.active = false;
    this.phase = "idle";
    this.round = 0;
    this.sequence = [];
    this.entered = 0;
    this.el.addEventListener("markerFound", () => {
      this.panel.hidden = false;
      if (this.active) return;
      this.active = true;
      window.dispatchEvent(new CustomEvent("ar-station-active", { detail: { marker: this.kind } }));
      if (this.phase === "idle") this.startRound();
    });
    this.el.addEventListener("markerLost", () => this.pauseStation());
    this.stationListener = event => { if (event.detail.marker !== this.kind) this.pauseStation(); };
    window.addEventListener("ar-station-active", this.stationListener);
    this.replay.addEventListener("click", () => {
      if (this.phase === "won" || this.phase === "watch") return;
      if (!this.el.object3D.visible) return;
      this.active = true;
      if (this.phase === "between") {
        this.round = Math.min(this.round + 1, 2);
        this.sequence = [];
      }
      this.startRound();
    });
    this.buttons.forEach(button => button.addEventListener("click", () => {
      if (!this.active || this.phase !== "input") return;
      const answer = Number(button.dataset.choice);
      if (this.kind === 6) {
        if (answer !== this.cupSlots[this.hiddenCup] + 1) {
          this.startRound();
          this.status.textContent = "Mis! Volg de beker opnieuw. Deze ronde telt nog niet.";
          return;
        }
        this.setButtons(false);
        // Til de juiste beker op en laat zien waar Cappuccino zit.
        this.cups[this.hiddenCup].object3D.position.y = 0.95;
        this.runner.object3D.position.set((answer - 2) * 0.5, 0.04, 0);
        this.runner.object3D.scale.setScalar(1);
        this.runner.object3D.visible = true;
        if (this.round === 2) this.win(7);
        else {
          this.phase = "between";
          this.replay.disabled = false;
          this.status.textContent = "Goed gevonden! De volgende ronde gaat sneller.";
          this.replay.textContent = "Volgende ronde";
        }
        return;
      }
      if (answer !== this.mathRounds[this.round].answer) {
        this.status.textContent = "Bijna! Reken nog eens rustig uit. Je mag opnieuw kiezen.";
        return;
      }
      this.setButtons(false);
      if (this.round === 2) this.win(4);
      else {
        this.phase = "between";
        this.replay.disabled = false;
        this.status.textContent = "Helemaal goed! Op naar de volgende bananensom.";
        this.replay.textContent = "Volgende som";
      }
    }));
  },
  setButtons: function (enabled) { this.buttons.forEach(button => { button.disabled = !enabled; }); },
  // `pause` is een A-Frame lifecycle-hook; gebruik die niet als spelactie.
  pauseStation: function () { this.active = false; this.panel.hidden = true; },
  play: function () {
    if (this.panel && !this.panel.hidden && this.el.object3D.visible) this.active = true;
  },
  startRound: function () {
    this.active = this.el.object3D.visible;
    this.panel.hidden = !this.active;
    this.elapsed = 0;
    this.entered = 0;
    this.playFrom = 0;
    this.phase = "watch";
    this.replay.hidden = false;
    this.replay.disabled = this.kind === 6;
    this.replay.textContent = "Nog eens kijken";
    this.setButtons(false);
    if (this.kind === 5) {
      this.mathRounds = [
        { text: "Chimpanzini heeft 18 bananen. Hij vindt er nog 7. Hoeveel heeft hij nu?", formula: "18 + 7 = ?", answer: 25, choices: [24, 25, 26] },
        { text: "Er zijn 4 trossen met elk 6 bananen. Chimpanzini eet er 5 op. Hoeveel blijven er over?", formula: "4 x 6 - 5 = ?", answer: 19, choices: [19, 21, 24] },
        { text: "Chimpanzini verdeelt 30 bananen eerlijk over 5 apen. Elke aap krijgt daarna nog 3 bananen. Hoeveel heeft elke aap?", formula: "30 / 5 + 3 = ?", answer: 9, choices: [6, 8, 9] },
      ];
      const sum = this.mathRounds[this.round];
      this.phase = "input";
      this.replay.disabled = false;
      this.progress.textContent = `Som ${this.round + 1} van 3`;
      this.status.textContent = sum.text;
      this.el.querySelector("#banana-formula").setAttribute("value", sum.formula);
      document.getElementById("banana-sum").textContent = sum.formula;
      this.buttons.forEach((button, i) => {
        button.dataset.choice = String(sum.choices[i]);
        button.textContent = String(sum.choices[i]);
      });
      this.setButtons(true);
      this.replay.textContent = "Som opnieuw lezen";
    } else {
      this.progress.textContent = `Ronde ${this.round + 1} van 3`;
      this.status.textContent = "Volg zijn beker! De bekers wisselen straks van plek.";
      this.cupSlots = [0, 1, 2];
      this.hiddenCup = Math.floor(Math.random() * 3);
      this.swapDuration = [520, 400, 300][this.round];
      this.swaps = [];
      const pairs = [[0, 1], [0, 2], [1, 2]];
      let previous = -1;
      for (let i = 0; i < [6, 9, 12][this.round]; i++) {
        // Kies uit een eindige lijst; geen retry-lus die kan blijven hangen.
        const choices = pairs.map((pair, index) => ({pair, index}))
          .filter(item => item.index !== previous && (i !== 0 || item.pair.includes(this.hiddenCup)));
        const chosen = choices[Math.floor(Math.random() * choices.length)];
        this.swaps.push(chosen.pair);
        previous = chosen.index;
      }
      this.finishedSwaps = 0;
      this.cups.forEach((cup, i) => {
        cup.object3D.position.set((i - 1) * 0.5, 0.22, 0);
        cup.object3D.rotation.y = 0;
        cup.querySelector("a-text").setAttribute("visible", false);
      });
      this.runner.object3D.visible = true;
      this.runner.object3D.scale.setScalar(1);
      this.runner.object3D.position.set(-0.95, 0.08, 0.35);
    }
  },
  win: function (digit) {
    this.phase = "won";
    this.setButtons(false);
    this.replay.hidden = true;
    const reward = document.getElementById(`reward-${this.kind}`);
    reward.hidden = false;
    reward.textContent = `Mijn geheime code is: ${digit}`;
    this.status.textContent = this.kind === 5 ? "Alle drie de bananensommen goed!" : "Goed gevonden!";
  },
  tick: function (time, delta) {
    if (this.phase !== "watch" || document.hidden) return;
    if (!this.el.object3D.visible || this.panel.hidden) return;
    // Een afgeronde markerLost/pause-callback mag een zichtbare ronde niet blokkeren.
    this.active = true;
    this.elapsed += Math.min(Math.max(Number(delta) || 0, 0), 100);
    if (this.kind === 6) {
      const t = this.elapsed;
      const run = Math.max(0, Math.min(1, (t - 600) / 1200));
      const hide = Math.max(0, Math.min(1, (t - 1800) / 700));
      const targetX = (this.hiddenCup - 1) * 0.5;
      // Spring boven de open beker en zak IN de beker, nooit onder de grond.
      const jump = Math.sin(Math.PI * run) * 0.7;
      const height = hide > 0 ? 0.52 - hide * 0.43 : 0.08 + jump + run * 0.44;
      this.runner.object3D.position.set(-0.95 + (targetX + 0.95) * run, height, 0.35 * (1 - run));
      this.runner.object3D.scale.setScalar(1 - hide * 0.72);
      if (hide === 1) {
        this.runner.object3D.visible = false;
        const shuffleTime = Math.max(0, t - 2800);
        const completed = Math.min(this.swaps.length, Math.floor((shuffleTime + 0.0001) / this.swapDuration));
        // Werk elke volledige wissel precies één keer bij, ook na een traag frame.
        while (this.finishedSwaps < completed) {
          const [a, b] = this.swaps[this.finishedSwaps++];
          this.cupSlots = this.cupSlots.map(slot => slot === a ? b : slot === b ? a : slot);
        }
        this.cups.forEach((cup, i) => {
          cup.object3D.position.set((this.cupSlots[i] - 1) * 0.5, 0.22, 0);
          cup.object3D.rotation.y = 0;
        });
        if (t >= 2800 && completed < this.swaps.length) {
          this.status.textContent = "Blijf de juiste beker volgen!";
          const [a, b] = this.swaps[completed];
          const phase = (shuffleTime % this.swapDuration) / this.swapDuration;
          const eased = phase * phase * (3 - 2 * phase);
          this.cups.forEach((cup, i) => {
            const slot = this.cupSlots[i];
            if (slot !== a && slot !== b) return;
            const next = slot === a ? b : a;
            cup.object3D.position.x = (slot - 1 + (next - slot) * eased) * 0.5;
            cup.object3D.position.z = Math.sin(Math.PI * eased) * (slot === a ? 0.3 : -0.3);
            cup.object3D.rotation.y = Math.sin(Math.PI * eased) * (slot === a ? 0.5 : -0.5);
          });
        }
        if (completed === this.swaps.length) {
          this.phase = "input";
          this.replay.disabled = false;
          this.setButtons(true);
          this.cups.forEach((cup, i) => {
            const label = cup.querySelector("a-text");
            label.setAttribute("value", String(this.cupSlots[i] + 1));
            label.setAttribute("visible", true);
          });
          this.status.textContent = "Waar zit hij? Kies beker 1 (links), 2 (midden) of 3 (rechts).";
        }
      }
    }
  },
  remove: function () { window.removeEventListener("ar-station-active", this.stationListener); },
});
