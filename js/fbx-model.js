/* Load the supplied FBX and PBR textures using the workshop's Three.js version. */
AFRAME.registerComponent("fbx-model", {
  schema: { type: "string" },
  init: function () { this.loadVersion = 0; },
  update: function () {
    if (!this.data) return;
    const version = ++this.loadVersion;
    const THREE = AFRAME.THREE;
    const texturePath = "models/tralalero/textures/";
    const manager = new THREE.LoadingManager();
    manager.setURLModifier(function (url) {
      if (/^(blob:|data:)/.test(url) || !/\.(png|jpe?g)(?:[?#].*)?$/i.test(url)) return url;
      const name = url.toLowerCase();
      if (name.includes("normal")) return texturePath + "normal.png";
      if (name.includes("roughness")) return texturePath + "roughness.jpg";
      if (name.includes("metallic")) return texturePath + "metallic.jpg";
      return texturePath + "color.jpg";
    });
    const fail = (error) => {
      if (version === this.loadVersion) this.el.emit("model-error", { format: "fbx", src: this.data, error: error });
    };
    new THREE.FBXLoader(manager).load(this.data, async (source) => {
      try {
        const textures = new THREE.TextureLoader(manager);
        const loadTexture = (name) => new Promise((resolve, reject) => textures.load(texturePath + name, resolve, undefined, reject));
        const [color, normal, roughness, metallic] = await Promise.all([
          loadTexture("color.jpg"), loadTexture("normal.png"),
          loadTexture("roughness.jpg"), loadTexture("metallic.jpg")
        ]);
        if (version !== this.loadVersion) return;
        color.encoding = THREE.sRGBEncoding;
        source.traverse(function (part) {
          if (!part.isMesh) return;
          part.material = new THREE.MeshStandardMaterial({
            map: color, normalMap: normal, roughnessMap: roughness,
            metalnessMap: metallic, roughness: 1, metalness: 1,
            skinning: !!part.isSkinnedMesh, side: THREE.DoubleSide
          });
          part.frustumCulled = false;
        });

        // Put the imported skeleton into the game's Y-up, face-forward convention.
        source.updateMatrixWorld(true);
        const bones = [];
        source.traverse((part) => { if (part.isBone) bones.push(part); });
        const key = (bone) => bone.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        const head = bones.find((bone) => key(bone) === "head");
        const tail = bones.find((bone) => key(bone) === "tail1");
        const body = bones.find((bone) => key(bone) === "body");
        const feet = bones.filter((bone) => /^(arm|leg)foot[lr]$/.test(key(bone)));
        const canonical = new THREE.Group();
        canonical.name = "ModelOrientation";
        canonical.add(source);
        if (head && tail && body && feet.length) {
          const footCenter = new THREE.Vector3();
          feet.forEach((bone) => footCenter.add(bone.getWorldPosition(new THREE.Vector3())));
          footCenter.multiplyScalar(1 / feet.length);
          const up = body.getWorldPosition(new THREE.Vector3()).sub(footCenter).normalize();
          const forward = head.getWorldPosition(new THREE.Vector3()).sub(tail.getWorldPosition(new THREE.Vector3()));
          forward.addScaledVector(up, -forward.dot(up)).normalize();
          const right = new THREE.Vector3().crossVectors(up, forward).normalize();
          up.crossVectors(forward, right).normalize();
          const basis = new THREE.Matrix4().makeBasis(right, up, forward);
          canonical.quaternion.setFromRotationMatrix(basis).conjugate();
        }
        const motion = new THREE.Group();
        motion.name = "DanceRoot";
        motion.add(canonical);
        const model = new THREE.Group();
        model.name = "Tralalero";
        model.add(motion);
        model.animations = source.animations || [];
        model.updateMatrixWorld(true);
        const size = new THREE.Box3().setFromObject(canonical).getSize(new THREE.Vector3());
        model.userData.danceHeight = size.y;
        this.el.setObject3D("mesh", model);
        this.el.emit("model-loaded", { format: "fbx", model: model });
      } catch (error) { fail(error); }
    }, undefined, fail);
  },
  remove: function () {
    this.loadVersion += 1;
    const resources = new Set();
    const model = this.el.getObject3D("mesh");
    if (model) model.traverse((part) => {
      if (part.geometry) resources.add(part.geometry);
      const materials = Array.isArray(part.material) ? part.material : [part.material];
      materials.filter(Boolean).forEach((material) => {
        ["map", "normalMap", "roughnessMap", "metalnessMap"].forEach((name) => {
          if (material[name]) resources.add(material[name]);
        });
        resources.add(material);
      });
    });
    resources.forEach((resource) => resource.dispose());
    this.el.removeObject3D("mesh");
  }
});
