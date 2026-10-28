/* Shared, marker-anchored reward for the shark and burger puzzles. */
AFRAME.registerComponent("ar-celebration", {
  init: function () {
    const THREE = AFRAME.THREE;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.el.setObject3D("celebration", this.group);
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const makeTexture = (star) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext("2d");
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.18, "rgba(255,255,255,0.95)");
      gradient.addColorStop(0.48, "rgba(255,255,255,0.35)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
      if (star) {
        ctx.fillStyle = "white";
        ctx.beginPath();
        [[32,2],[37,27],[62,32],[37,37],[32,62],[27,37],[2,32],[27,27]].forEach((p,i) => {
          if (i === 0) ctx.moveTo(p[0],p[1]); else ctx.lineTo(p[0],p[1]);
        });
        ctx.closePath();
        ctx.fill();
      }
      return new THREE.CanvasTexture(canvas);
    };
    this.glowTexture = makeTexture(false);
    this.starTexture = makeTexture(true);
    const additive = {
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
    };
    this.aura = new THREE.Sprite(new THREE.SpriteMaterial(Object.assign({
      map: this.glowTexture, color: 0xffd45b, opacity: 0
    }, additive)));
    this.aura.position.set(0, 0.8, -0.24);
    this.aura.scale.set(3.6, 3.6, 1);
    this.group.add(this.aura);
    this.rings = [0xffd45b, 0x78eaff].map((color, index) => {
      const ring = new THREE.Mesh(
        new THREE.TorusBufferGeometry(0.92 + index * 0.12, 0.035 - index * 0.01, 6, 80),
        new THREE.MeshBasicMaterial(Object.assign({ color: color, opacity: 0 }, additive))
      );
      ring.position.set(0, 0.8, -0.15 - index * 0.06);
      ring.rotation.x = index ? -0.3 : 0.3;
      this.group.add(ring);
      return ring;
    });
    this.burstCount = 6;
    this.perBurst = 64;
    this.trailCount = 4;
    this.count = this.burstCount * this.perBurst * this.trailCount;
    this.positions = new Float32Array(this.count * 3);
    this.colors = new Float32Array(this.count * 3);
    this.geometry = new THREE.BufferGeometry();
    (this.geometry.setAttribute || this.geometry.addAttribute).call(this.geometry, "position", new THREE.BufferAttribute(this.positions, 3));
    (this.geometry.setAttribute || this.geometry.addAttribute).call(this.geometry, "color", new THREE.BufferAttribute(this.colors, 3));
    this.sparks = new THREE.Points(this.geometry, new THREE.PointsMaterial(Object.assign({
      map: this.starTexture, size: 0.105, sizeAttenuation: true, vertexColors: THREE.VertexColors
    }, additive)));
    this.sparks.frustumCulled = false;
    this.group.add(this.sparks);
    const palette = [0xffda60, 0xff83bf, 0x7ceaff, 0xa0ff9c, 0xbca0ff, 0xffaa65];
    const origins = [
      [-1.05,1.2,0.05], [1.05,1.3,0.05], [-0.65,1.95,-0.05],
      [0.65,2.05,-0.05], [-1.2,0.55,0.15], [1.2,0.65,0.15]
    ];
    this.flares = origins.map((origin, burst) => {
      const flare = new THREE.Sprite(new THREE.SpriteMaterial(Object.assign({
        map: this.starTexture, color: palette[burst], opacity: 0
      }, additive)));
      flare.position.fromArray(origin);
      flare.scale.set(0.9,0.9,1);
      this.group.add(flare);
      return flare;
    });
    this.particles = Array.from({ length: this.burstCount * this.perBurst }, (_, index) => {
      const burst = Math.floor(index / this.perBurst);
      const point = index % this.perBurst;
      const y = 1 - 2 * (point + 0.5) / this.perBurst;
      const radius = Math.sqrt(1 - y * y);
      const angle = point * 2.399963;
      return {
        burst: burst, origin: origins[burst], delay: 0.3 + burst * 0.2,
        direction: [radius * Math.cos(angle), y, radius * Math.sin(angle)],
        speed: 1.35 + (point % 7) * 0.14,
        color: new THREE.Color(palette[(point % 3 === 0 ? burst + 1 : burst) % palette.length])
      };
    });
    this.started = null;
  },
  celebrate: function () {
    this.started = performance.now();
    this.colors.fill(0);
    this.geometry.attributes.color.needsUpdate = true;
    this.flares.forEach((flare) => { flare.material.opacity = 0; });
    this.sparks.visible = !this.reducedMotion;
    this.group.visible = true;
  },
  stop: function () {
    this.started = null;
    this.group.visible = false;
  },
  tick: function () {
    if (this.started === null) return;
    const elapsed = (performance.now() - this.started) / 1000;
    const duration = this.reducedMotion ? 1.2 : 3;
    if (elapsed >= duration) { this.stop(); return; }
    const envelope = Math.sin(Math.PI * elapsed / duration);
    this.aura.material.opacity = 0.72 * envelope;
    this.rings.forEach((ring, index) => {
      ring.material.opacity = (index ? 0.6 : 0.95) * envelope;
    });
    if (this.reducedMotion) return;
    this.aura.scale.set(3.6 + 0.4 * envelope, 3.6 + 0.4 * envelope, 1);
    this.rings.forEach((ring, index) => {
      ring.scale.setScalar(1 + 0.35 * envelope);
      ring.rotation.y = (index ? -1 : 1) * 0.35 * Math.sin(elapsed * 2);
    });
    this.flares.forEach((flare, index) => {
      const age = elapsed - (0.3 + index * 0.2);
      flare.material.opacity = age >= 0 && age < 0.22 ? Math.pow(1 - age / 0.22, 2) : 0;
      flare.scale.setScalar(0.65 + Math.max(0, age) * 1.8);
    });
    this.particles.forEach((particle, index) => {
      for (let trail = 0; trail < this.trailCount; trail++) {
        const age = elapsed - particle.delay - trail * 0.035;
        const offset = (index * this.trailCount + trail) * 3;
        let brightness = 0;
        let x = particle.origin[0], y = particle.origin[1], z = particle.origin[2];
        if (age >= -0.3 && age < 0) {
          // A rising comet leads into each explosion.
          const launch = Math.max(0, Math.min(1, (age + 0.3) / 0.3));
          x *= 0.35 + launch * 0.65;
          y = 0.12 + (y - 0.12) * launch;
          brightness = index % this.perBurst === 0 ? 1.8 : 0;
        } else if (age >= 0 && age < 1.45) {
          const travel = particle.speed * age;
          x += particle.direction[0] * travel;
          y += particle.direction[1] * travel - 0.5 * age * age;
          z += particle.direction[2] * travel;
          brightness = 1.6 * Math.pow(1 - age / 1.45, 1.45) * Math.pow(0.65, trail);
        }
        this.positions[offset] = x;
        this.positions[offset + 1] = y;
        this.positions[offset + 2] = z;
        this.colors[offset] = particle.color.r * brightness;
        this.colors[offset + 1] = particle.color.g * brightness;
        this.colors[offset + 2] = particle.color.b * brightness;
      }
    });
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  },
  remove: function () {
    this.stop();
    this.geometry.dispose();
    this.sparks.material.dispose();
    this.rings.forEach((ring) => { ring.geometry.dispose(); ring.material.dispose(); });
    this.flares.forEach((flare) => flare.material.dispose());
    this.aura.material.dispose();
    this.glowTexture.dispose();
    this.starTexture.dispose();
    this.el.removeObject3D("celebration");
  }
});
