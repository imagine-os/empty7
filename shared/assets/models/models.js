// Graph Gallery — low-poly object models built from three.js primitives (flat colours, no textures).
// Browser:  import { buildModel } from '../../shared/assets/models/models.js'; scene.add(buildModel(THREE, 'server'));
// Node:     shared/build-models.mjs exports the same builders to .glb files next to this file.
// Every model is ~1 unit tall, centred at the origin, facing +Z. Colours mirror system.json meta.type_colors.
const C = { server: 0x5ec8ff, database: 0xf5b642, queue: 0xff9f43, folder: 0xb48cff, document: 0xfff4d6, laptop: 0xff5f8f, cloud: 0x8dff9e, dark: 0x1a1f2e, mid: 0x2c3448, light: 0xe8eaf2 };
const mat = (THREE, color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, flatShading: true, ...extra });
const mesh = (THREE, geo, m, x = 0, y = 0, z = 0, name = '') => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.name = name; return o; };

export const BUILDERS = {
  server(THREE) {                    // 4U rack: dark chassis, blue faceplates, green/amber status LEDs
    const g = new THREE.Group();
    g.add(mesh(THREE, new THREE.BoxGeometry(1.2, 1.0, 0.8), mat(THREE, C.dark), 0, 0, 0, 'chassis'));
    for (let i = 0; i < 4; i++) {
      const y = -0.36 + i * 0.24;
      g.add(mesh(THREE, new THREE.BoxGeometry(1.14, 0.18, 0.04), mat(THREE, C.server), 0, y, 0.42, 'unit'));
      g.add(mesh(THREE, new THREE.BoxGeometry(0.05, 0.05, 0.02), mat(THREE, i === 2 ? 0xffb347 : 0x8dff9e, { emissive: i === 2 ? 0xffb347 : 0x8dff9e, emissiveIntensity: 0.9 }), 0.45, y, 0.45, 'led'));
      g.add(mesh(THREE, new THREE.BoxGeometry(0.4, 0.05, 0.02), mat(THREE, C.mid), -0.2, y, 0.45, 'vent'));
    }
    g.add(mesh(THREE, new THREE.BoxGeometry(1.3, 0.06, 0.9), mat(THREE, C.mid), 0, -0.53, 0, 'base'));
    return g;
  },
  database(THREE) {                  // three stacked discs with lighter rims
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const y = -0.33 + i * 0.33;
      g.add(mesh(THREE, new THREE.CylinderGeometry(0.5, 0.5, 0.26, 24), mat(THREE, C.database), 0, y, 0, 'disc'));
      g.add(mesh(THREE, new THREE.CylinderGeometry(0.52, 0.52, 0.05, 24), mat(THREE, 0xffe1a3), 0, y + 0.15, 0, 'rim'));
    }
    return g;
  },
  queue(THREE) {                     // conveyor: open tube with 5 message cubes travelling through it
    const g = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.6, 16, 1, true), mat(THREE, C.queue, { side: THREE.DoubleSide, transparent: true, opacity: 0.55 }));
    tube.rotation.z = Math.PI / 2; tube.name = 'tube'; g.add(tube);
    for (const k of [-0.6, -0.3, 0, 0.3, 0.6]) g.add(mesh(THREE, new THREE.BoxGeometry(0.16, 0.16, 0.16), mat(THREE, C.light, { emissive: 0xffd9b0, emissiveIntensity: 0.3 }), k, 0, 0, 'msg'));
    for (const k of [-0.8, 0.8]) g.add(mesh(THREE, new THREE.TorusGeometry(0.3, 0.04, 8, 20), mat(THREE, 0xffc784), k, 0, 0, 'ring')).children.at(-1).rotation.y = Math.PI / 2;
    return g;
  },
  folder(THREE) {                    // repo: folder body, back panel, tab
    const g = new THREE.Group();
    g.add(mesh(THREE, new THREE.BoxGeometry(1.2, 0.8, 0.1), mat(THREE, 0x8f6bd6), 0, -0.05, -0.08, 'back'));
    g.add(mesh(THREE, new THREE.BoxGeometry(0.5, 0.14, 0.1), mat(THREE, 0x8f6bd6), -0.35, 0.4, -0.08, 'tab'));
    g.add(mesh(THREE, new THREE.BoxGeometry(1.2, 0.72, 0.08), mat(THREE, C.folder), 0, -0.1, 0.04, 'front'));
    g.add(mesh(THREE, new THREE.PlaneGeometry(0.9, 0.5), mat(THREE, C.light), 0, 0.02, -0.02, 'sheet'));
    return g;
  },
  document(THREE) {                  // stack of 3 offset sheets + text bars
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) g.add(mesh(THREE, new THREE.BoxGeometry(0.8, 1.05, 0.02), mat(THREE, i === 2 ? C.document : 0xd6d9e6), i * 0.04, -i * 0.03, i * 0.03, 'sheet'));
    for (let j = 0; j < 5; j++) g.add(mesh(THREE, new THREE.BoxGeometry(j === 0 ? 0.42 : 0.56, 0.05, 0.01), mat(THREE, j === 0 ? 0x2c3448 : 0x9aa3b8), 0.08 - (j === 0 ? 0.07 : 0), 0.3 - j * 0.13, 0.08, 'line'));
    return g;
  },
  laptop(THREE) {                    // person / workstation: base, tilted lid, glowing screen
    const g = new THREE.Group();
    g.add(mesh(THREE, new THREE.BoxGeometry(1.1, 0.06, 0.75), mat(THREE, C.mid), 0, -0.3, 0, 'base'));
    g.add(mesh(THREE, new THREE.BoxGeometry(0.8, 0.01, 0.35), mat(THREE, C.dark), 0, -0.265, 0.05, 'keys'));
    const lid = new THREE.Group(); lid.position.set(0, -0.27, -0.37); lid.rotation.x = -Math.PI / 2 + 0.35; lid.name = 'lid';
    lid.add(mesh(THREE, new THREE.BoxGeometry(1.1, 0.72, 0.04), mat(THREE, C.mid), 0, 0.36, 0));
    lid.add(mesh(THREE, new THREE.PlaneGeometry(1.0, 0.62), mat(THREE, C.laptop, { emissive: C.laptop, emissiveIntensity: 0.6 }), 0, 0.36, 0.025, 'screen'));
    g.add(lid);
    return g;
  },
  cloud(THREE) {                     // merged spheres on a flat base
    const g = new THREE.Group();
    const m = mat(THREE, C.cloud);
    for (const [x, y, r] of [[0, 0.05, 0.42], [-0.42, -0.08, 0.3], [0.42, -0.1, 0.32], [0.15, 0.22, 0.3], [-0.2, 0.18, 0.26]]) g.add(mesh(THREE, new THREE.SphereGeometry(r, 12, 10), m, x, y, 0, 'puff'));
    g.add(mesh(THREE, new THREE.CylinderGeometry(0.72, 0.72, 0.12, 20), m, 0, -0.32, 0, 'base'));
    return g;
  },
};
export const TYPE_TO_MODEL = { service: 'server', database: 'database', queue: 'queue', repo: 'folder', file: 'document', document: 'document', person: 'laptop', cloud: 'cloud' };
export function buildModel(THREE, type) { const b = BUILDERS[type] || BUILDERS[TYPE_TO_MODEL[type]]; if (!b) throw new Error('no model for ' + type); return b(THREE); }
