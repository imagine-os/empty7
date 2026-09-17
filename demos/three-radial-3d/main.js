// Graph Gallery · three-radial-3d: company sphere at the origin, six department limbs along octahedral directions,
// projects in a cone around each limb, leaves as instanced typed glyphs, department-tinted tube edges, bloom + fog.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadOrg, mountHud, tooltipHtml } from '../../shared/hud.js';

const BG = '#04050c', app = document.getElementById('app');
const org = await loadOrg();
const { nodes, byId, childrenOf, meta } = org, DEPTS = meta.departments, N = nodes.length;
const index = new Map(nodes.map((n, i) => [n.id, i]));
const kids = id => childrenOf.get(id) || [];
const isLeaf = n => !kids(n.id).length && n.type !== 'company';
const deptIdx = n => n.type === 'company' ? -1 : DEPTS.indexOf(n.type === 'department' ? n.id : n.department);
const DEPT = nodes.map(deptIdx), DEPTH = nodes.map(n => n.depth ?? 0);
const HUE = DEPTS.map(id => new THREE.Color(byId.get(id).hue));
const pathOf = n => { const p = []; for (let m = n; m; m = m.parent ? byId.get(m.parent) : null) p.unshift(m.label); return p.join(' › '); };
const ease = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const back = t => { t = Math.min(1, Math.max(0, t)); const c = 1.5; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

// ---- layout: octahedral department directions (90° apart), oriented so the initial view looks down a body diagonal ------
// (all six limbs then sit 55° off the view axis and project as a six-pointed star); recursive cones for children.
const VIEW = new THREE.Vector3(0, 220, 900).normalize(), roll = new THREE.Quaternion().setFromAxisAngle(VIEW, 0.35);
const tilt = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 1, 1).normalize(), VIEW).premultiply(roll);
const DIR = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [-1, 0, 0], [0, -1, 0], [0, 0, -1]].map(a => new THREE.Vector3(...a).applyQuaternion(tilt));
const P = nodes.map(() => new THREE.Vector3()), R1 = 165;
const basis = d => { const u = new THREE.Vector3().crossVectors(d, Math.abs(d.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize(); return [u, new THREE.Vector3().crossVectors(d, u)]; };
function cone(parent, dir, ids, theta, len, phase) {          // children share a ring at angle theta around dir; slot width ∝ weight
  const [u, v] = basis(dir), w = id => byId.get(id).type === 'project' ? 4 : 1.2, W = ids.reduce((s, id) => s + w(id), 0);
  let a = phase;
  for (const id of ids) {
    const slot = 2 * Math.PI * w(id) / W, phi = a + slot / 2, L = len(byId.get(id)); a += slot;
    P[index.get(id)].copy(parent).addScaledVector(dir, L * Math.cos(theta)).addScaledVector(u, L * Math.sin(theta) * Math.cos(phi)).addScaledVector(v, L * Math.sin(theta) * Math.sin(phi));
  }
}
DEPTS.forEach((id, k) => {
  const d = DIR[k], pd = P[index.get(id)].copy(d).multiplyScalar(R1);
  cone(pd, d, kids(id), 0.52, n => n.type === 'project' ? 125 : 78, k * 0.7);
  for (const pid of kids(id).filter(c => byId.get(c).type === 'project')) {
    const pp = P[index.get(pid)], dir = pp.clone().sub(pd).normalize();
    cone(pp, dir, kids(pid), 0.36, () => 58, k);
  }
});

// ---- renderer / scene / camera -------------------------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
app.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(BG); scene.fog = new THREE.FogExp2(BG, 0.00045);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 1, 5000); camera.position.copy(VIEW).multiplyScalar(950);
scene.add(new THREE.HemisphereLight(0xdde6ff, 0x1a1030, 1.1));
const key = new THREE.DirectionalLight(0xffffff, 1.3); key.position.set(1, 1.4, 1.2); scene.add(key);

// ---- glyphs: one InstancedMesh per type, instance colour also drives emission ---------------------------------------------
const star = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.5 : 1.25, a = i * Math.PI / 5 - Math.PI / 2; star[i ? 'lineTo' : 'moveTo'](r * Math.cos(a), r * Math.sin(a)); }
const GEO = { company: new THREE.SphereGeometry(1, 32, 24), department: new THREE.CylinderGeometry(1, 1, 0.55, 6), project: new THREE.BoxGeometry(1.6, 1.6, 1.6),
  skill: new THREE.SphereGeometry(1, 16, 12), agent: new THREE.OctahedronGeometry(1.25), template: new THREE.ConeGeometry(1, 2.1, 4), tool: new THREE.ExtrudeGeometry(star, { depth: 0.5, bevelEnabled: false }).center() };
const SIZE = n => ({ company: 13, department: 9, project: 4.2, skill: 2.6 + (n.level || 1) * 0.35, agent: 3.6, template: 3.6, tool: 3.4 })[n.type];
const uEmissive = { value: 0.55 };
const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.05 });
mat.onBeforeCompile = sh => { sh.uniforms.uEmissive = uEmissive;
  sh.fragmentShader = sh.fragmentShader.replace('uniform vec3 emissive;', 'uniform vec3 emissive; uniform float uEmissive;')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_INSTANCING_COLOR\n totalEmissiveRadiance += vColor * uEmissive;\n#endif'); };
const slots = nodes.map(() => 0), meshes = {};
for (const type of Object.keys(GEO)) { const ids = nodes.filter(n => n.type === type); meshes[type] = new THREE.InstancedMesh(GEO[type], mat, ids.length); ids.forEach((n, j) => slots[index.get(n.id)] = j); scene.add(meshes[type]); }
const pick = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ visible: false }), N); scene.add(pick);
const haloTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,0.8)'); grd.addColorStop(0.3, 'rgba(255,255,255,0.25)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const halos = nodes.map((n, i) => { if (n.type !== 'company' && n.type !== 'department') return null;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: n.type === 'company' ? '#ffffff' : n.hue, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.35, fog: false }));
  s.scale.setScalar(SIZE(n) * 6.5); scene.add(s); return s; });
const baseColor = nodes.map(n => new THREE.Color(n.color).multiplyScalar(n.status === 'idea' ? 0.35 : n.status === 'pilot' ? 0.7 : 1));
const label = (text, color, h, weight) => { const c = document.createElement('canvas'), g = c.getContext('2d'), f = `${weight} 44px Inter, Segoe UI, Helvetica, Arial, sans-serif`;
  g.font = f; c.width = Math.ceil(g.measureText(text).width) + 24; c.height = 68; g.font = f; g.fillStyle = color; g.textBaseline = 'middle'; g.fillText(text, 12, 34);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })); s.scale.set(h * c.width / c.height, h, 1); scene.add(s); return s; };
const labels = nodes.map(n => n.type === 'department' ? label(n.label.toUpperCase().split('').join(' '), n.hue, 13, 700) : n.type === 'project' ? label(n.label, '#e2e5f2', 7.5, 500) : null);

// ---- edges: per-department merged tubes, radius tapering by depth, vertex colours = department hue ----------------------
const TUB = 8, RAD = 5, VT = (TUB + 1) * (RAD + 1), limbs = [], edgesOf = DEPTS.map(() => []);
org.links.forEach(l => edgesOf[DEPT[index.get(l.target)]].push(l));
DEPTS.forEach((id, k) => {
  const geos = edgesOf[k].map(l => { const a = P[index.get(l.source)], b = P[index.get(l.target)], t = byId.get(l.target);
    const curve = t.type === 'department' ? new THREE.LineCurve3(a, b) : new THREE.QuadraticBezierCurve3(a, a.clone().lerp(b, 0.5).addScaledVector(DIR[k], a.distanceTo(b) * 0.2), b);
    return new THREE.TubeGeometry(curve, TUB, { department: 1.9, project: 1.0 }[t.type] || 0.5, RAD, false); });
  const geo = mergeGeometries(geos); geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(edgesOf[k].length * VT * 3), 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  scene.add(mesh); limbs.push(mesh);
});
const tmp = new THREE.Color();
function paintLimb(k) {                                          // brightness by depth; ancestor path of the hovered node lit
  const arr = limbs[k].geometry.attributes.color.array;
  edgesOf[k].forEach((l, e) => {
    const t = byId.get(l.target), ti = index.get(l.target), onPath = hover >= 0 && pathSet.has(l.target), hide = collapsed[k] && isLeaf(t);
    tmp.copy(HUE[k]).multiplyScalar(hide ? 0 : ({ department: 1.1, project: 0.85 }[t.type] || 0.6) * (hover < 0 ? 1 : onPath ? 1.8 : 0.45) * leafScale[ti]);
    for (let v = 0; v < VT; v++) arr.set([tmp.r, tmp.g, tmp.b], (e * VT + v) * 3);
  });
  limbs[k].geometry.attributes.color.needsUpdate = true;
}

// ---- post, controls, camera tweens --------------------------------------------------------------------------------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.5, 0.35); composer.addPass(bloom); composer.addPass(new OutputPass());
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.06; controls.autoRotate = true; controls.autoRotateSpeed = 0.5;
let tween = null;
const tweenCamera = (pos, target, ms) => { tween = { p0: camera.position.clone(), p1: pos, t0: controls.target.clone(), t1: target, start: performance.now(), ms }; };
function fitCamera(ms, dir = camera.position.clone().sub(controls.target).normalize()) {
  const R = Math.max(...P.map(p => p.length())) + 20;
  tweenCamera(dir.multiplyScalar(R / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.9), new THREE.Vector3(), ms);
}
function flyToDept(k) {
  const ids = nodes.filter((n, i) => DEPT[i] === k), c = ids.reduce((a, n) => a.add(P[index.get(n.id)]), new THREE.Vector3()).divideScalar(ids.length);
  const side = new THREE.Vector3().crossVectors(DIR[k], new THREE.Vector3(0, 1, 0)); if (side.lengthSq() < 0.05) side.set(1, 0, 0); side.normalize();
  tweenCamera(c.clone().addScaledVector(side, 300).addScaledVector(DIR[k], 40).add(new THREE.Vector3(0, 60, 0)), c, 1200);
}
function focusNode(i) {
  const n = nodes[i], k = DEPT[i];
  if (n.type === 'company') return reset();
  if (n.type === 'department') { if (focus === k) collapsed[k] = !collapsed[k]; else { focus = k; flyToDept(k); } }
  else { focus = k; const dir = camera.position.clone().sub(P[i]).normalize(); tweenCamera(P[i].clone().addScaledVector(dir, n.type === 'project' ? 150 : 70), P[i].clone(), 1000); }
}
function reset() { focus = -1; collapsed.fill(state.collapseAll); fitCamera(1000, VIEW.clone()); }   // back to the six-pointed view

// ---- interaction --------------------------------------------------------------------------------------------------------
let hover = -1, focus = -1, pathSet = new Set(), pointer = { x: 0, y: 0, downAt: null };
const collapsed = DEPTS.map(() => false), leafScale = new Float32Array(N).fill(1), alpha = DEPTS.map(() => 1), scaleNow = new Float32Array(N).fill(1);
const state = { collapseAll: false, labels: true };
const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
function doPick() {
  ndc.set(pointer.x / innerWidth * 2 - 1, -(pointer.y / innerHeight) * 2 + 1); raycaster.setFromCamera(ndc, camera);
  pick.computeBoundingSphere();
  const hit = raycaster.intersectObject(pick)[0], i = hit ? hit.instanceId : -1;
  if (i === hover) return;
  const prev = hover; hover = i; app.style.cursor = i >= 0 ? 'pointer' : '';
  pathSet = new Set(); if (i >= 0) for (let m = nodes[i]; m; m = m.parent ? byId.get(m.parent) : null) pathSet.add(m.id);
  for (const k of new Set([prev >= 0 ? DEPT[prev] : -1, i >= 0 ? DEPT[i] : -1])) if (k >= 0) paintLimb(k); else limbs.forEach((_, k) => paintLimb(k));
  if (i >= 0) { const n = nodes[i]; hud.showTooltip(tooltipHtml(n.label, { type: n.type, path: pathOf(n), level: n.level ? `${n.level} / 5` : null, status: n.status }), pointer.x, pointer.y); } else hud.hideTooltip();
}
const stopSpin = () => { controls.autoRotate = false; hud.setToggle('spin', false); };
renderer.domElement.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; if (!entrance) doPick(); });
renderer.domElement.addEventListener('pointerdown', e => { pointer.downAt = [e.clientX, e.clientY]; stopSpin(); });
renderer.domElement.addEventListener('pointerup', e => { if (pointer.downAt && Math.hypot(e.clientX - pointer.downAt[0], e.clientY - pointer.downAt[1]) < 4 && hover >= 0) focusNode(hover); pointer.downAt = null; });
renderer.domElement.addEventListener('dblclick', () => { if (hover < 0) reset(); });
addEventListener('wheel', stopSpin, { passive: true });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });

const hud = mountHud({
  title: 'Radial 3D', library: 'three.js', version: '0.186.0', typeColors: meta.type_colors,
  toggles: [
    { id: 'bloom', label: 'Bloom', on: true, onChange: on => { bloom.enabled = on; } },
    { id: 'labels', label: 'Labels', on: true, onChange: on => { state.labels = on; } },
    { id: 'collapse', label: 'Collapse leaves', on: false, onChange: on => { state.collapseAll = on; collapsed.fill(on); } },
    { id: 'spin', label: 'Auto-orbit', on: true, onChange: on => { controls.autoRotate = on; } },
  ],
});

// ---- unfurl + render loop ------------------------------------------------------------------------------------------------
const M = new THREE.Matrix4(), S = new THREE.Vector3(), Q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3();
const FACE = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));   // hex prism face-on to the camera
const limbE = (k, t) => entrance ? ease((t - 250 - k * 90) / 900) : 1;
let t0 = performance.now(), entrance = true;
app.classList.add('in'); fitCamera(2400);
renderer.setAnimationLoop(now => {
  const t = now - t0; if (entrance && t > 3400) entrance = false;
  DEPTS.forEach((_, k) => { const a = (focus < 0 || focus === k) && (hover < 0 || DEPT[hover] < 0 || DEPT[hover] === k) ? 1 : 0.25; alpha[k] += (a - alpha[k]) * 0.12; });
  let repaint = false;
  for (let i = 0; i < N; i++) {
    const n = nodes[i], k = DEPT[i], E = k < 0 ? 1 : limbE(k, t), A = k < 0 ? 1 : alpha[k];
    const pop = entrance ? back((t - 300 - DEPTH[i] * 380) / 800) : 1;
    const ls = isLeaf(n) && collapsed[k] ? 0 : 1; if (Math.abs(ls - leafScale[i]) > 1e-3) { leafScale[i] += (ls - leafScale[i]) * 0.15; repaint = true; }
    scaleNow[i] += ((hover === i ? 1.5 : 1) - scaleNow[i]) * 0.15;
    const s = SIZE(n) * pop * scaleNow[i] * (isLeaf(n) ? leafScale[i] : 1); pos.copy(P[i]).multiplyScalar(E);
    if (n.type === 'template') Q.setFromUnitVectors(Y, P[i].clone().sub(P[index.get(n.parent)]).normalize());
    else if (n.type === 'department') Q.copy(camera.quaternion).multiply(FACE); else if (n.type === 'tool') Q.copy(camera.quaternion); else Q.identity();
    M.compose(pos, Q, S.set(s, s, s)); meshes[n.type].setMatrixAt(slots[i], M);
    M.compose(pos, Q.identity(), S.setScalar(Math.max(s * 1.5, 4) * (isLeaf(n) ? leafScale[i] : 1))); pick.setMatrixAt(i, M);
    tmp.copy(baseColor[i]).multiplyScalar(A * (hover === i ? 1.35 : hover >= 0 && pathSet.has(n.id) ? 1.2 : 1)); meshes[n.type].setColorAt(slots[i], tmp);
    if (halos[i]) { halos[i].position.copy(pos); halos[i].material.opacity = 0.35 * A * pop; }
    if (labels[i]) { labels[i].position.copy(pos).addScaledVector(Y, s + (n.type === 'department' ? 9 : 5)); labels[i].material.opacity = (state.labels ? 1 : 0) * A * pop; labels[i].visible = state.labels; }
  }
  for (const m of Object.values(meshes)) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  pick.instanceMatrix.needsUpdate = true;
  limbs.forEach((m, k) => { m.scale.setScalar(limbE(k, t)); m.material.opacity = 0.6 * alpha[k]; if (repaint) paintLimb(k); });
  if (tween) { const k = Math.min(1, (now - tween.start) / tween.ms), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(tween.p0, tween.p1, e); controls.target.lerpVectors(tween.t0, tween.t1, e); if (k >= 1) tween = null; }
  controls.update(); composer.render();
});
limbs.forEach((_, k) => paintLimb(k));

// Debug hooks for the gallery's automated smoke test.
window.__demo = { org, hud, bloom, state, ready: true,
  get hoverNode() { return hover >= 0 ? nodes[hover] : null; },
  screenPos: id => { const v = P[index.get(id)].clone().project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; },
  cameraPos: () => ({ x: camera.position.x, y: camera.position.y, z: camera.position.z }),
  clickState: () => ({ focus, collapsed: [...collapsed], alpha: alpha.map(a => +a.toFixed(2)) }),
  toggleState: () => ({ bloom: bloom.enabled, labels: state.labels, collapseAll: state.collapseAll, spin: controls.autoRotate }),
  focus: id => focusNode(index.get(id)), reset, settle: () => { entrance = false; },
};
