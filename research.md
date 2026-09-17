# Network-graph library survey — "gorgeous graphs" gallery

Date: 2026-09-17. Scope: node-link (network) graph renderers, 2D and 3D, that can run in a
static page (GitHub Pages, no build step) via CDN `<script>` tags or ESM import maps.

**How this was verified.** The sandbox egress proxy blocks every public CDN
(cdn.jsdelivr.net, unpkg.com, cdnjs.cloudflare.com, esm.sh, esm.run, ga.jspm.io all answered
403 on CONNECT) and most vendor sites (cosmograph.app, sigmajs.org, g6.antv.antgroup.com,
neo4j.com, linkurious.com, yworks.com). registry.npmjs.org and raw.githubusercontent.com were
reachable, so every package below was inspected with `npm view` and `npm pack` and the exact
dist file names, UMD global names, licences and dependency shapes come from the tarballs
themselves. CDN URLs are therefore *derived* (jsDelivr/unpkg serve the tarball verbatim) and
must be smoke-tested once from a machine with normal internet.

---

## 1. Comparison table

| Library (pkg@ver) | Renderer | 2D/3D | Licence | No-build load | Sweet-spot scale | Signature visuals | Interaction | Verdict |
|---|---|---|---|---|---|---|---|---|
| **3d-force-graph** `3d-force-graph@1.80.0` | three.js WebGL | 3D (also 2D/1D via `numDimensions`) | MIT | UMD `dist/3d-force-graph.min.js` (bundles three r0.18x) or ESM `dist/3d-force-graph.mjs` + import map | 1k–20k nodes | Bloom via `postProcessingComposer()`, directional link **particles**, `linkCurvature`, custom `nodeThreeObject` (sprites, glTF), DAG modes, camera fly-to | Orbit/fly controls, drag nodes, hover/click, `cameraPosition()` animation | The quickest route to a jaw-dropping 3D scene; default look is already good, bloom makes it spectacular. |
| **three.js custom** `three@0.186.0` | WebGL(2) / WebGPU | 3D | MIT | ESM import map (`build/three.module.js`, `examples/jsm/*` verified) | 1k–50k nodes with InstancedMesh | Full control: `InstancedMesh` spheres, `UnrealBloomPass`, `Line2` fat lines, tube/Bezier edges, particles, fog, HDR env, DOF | You write it (OrbitControls, raycast picking) | Maximum "wow" ceiling; most work. This is the demo that will look like a film title sequence. |
| **cosmos.gl** `@cosmos.gl/graph@3.4.1` (ex-Cosmograph engine) | WebGL2 (luma.gl), **GPU-side force layout** | 2D | **MIT** (moved to OpenJS Foundation) | UMD `dist/index.min.js` → global `Cosmos` (self-contained, 700 kB) | 10k–1M+ nodes | Real-time GPU ForceAtlas-like simulation, `curvedLinks`, hover/focus **rings**, greyout/highlight sets, GPU colour/size **transitions**, cluster forces, collision force, dashed links, arrows | Zoom, drag points, right-click repulsion, touch, lasso via `findPointsInPolygon` | The "living galaxy" look — the most visually alive 2D graph you can put on a page. Note: no built-in labels (overlay them yourself), WebGL2 required. |
| **Sigma.js v3** `sigma@3.0.3` + `graphology@0.26.0` (+ `graphology-library@0.8.0`) | WebGL 2D, labels on Canvas | 2D | MIT | UMD: `dist/sigma.min.js` → `Sigma`; `dist/graphology.umd.min.js` → `graphology`; `dist/graphology-library.min.js` → `graphologyLibrary` (ForceAtlas2, Louvain…). Satellite programs (`@sigma/edge-curve@3.1.0`, `@sigma/node-border@3.0.0`, `@sigma/node-image`, `@sigma/layer-webgl`) are **ESM-only** | 5k–200k nodes | ForceAtlas2 (worker), **node borders / halos**, curved + parallel edges, image nodes, custom WebGL layers, reducers for hover dimming, label density control, camera animations | Excellent: hover, drag, zoom, lasso via graphology; Gephi Lite is built on it | The "editorial" WebGL look (Gephi-style); very polished and battle-tested. Best 2D balance of beauty, scale and control. |
| **AntV G6 v5** `@antv/g6@5.1.1` (+ `@antv/g6-extension-3d@0.1.23`) | Canvas / SVG / WebGL via @antv/g; 3D via g-webgl | 2D (+3D) | MIT | UMD `dist/g6.min.js` → `G6` (self-contained, 1.4 MB). 3D UMD `dist/g6-extension-3d.min.js` → `G6Extension3D` | 1k–10k (Canvas), more with WebGL | Built-in **light/dark themes** + 20 palettes, enter/exit/update **animations**, hulls, **bubble-sets**, **edge bundling**, fisheye, edge-filter lens, minimap, legend, timebar, donut/badge/icon nodes, combos | Rich behaviours (drag, brush, lasso, hover-activate, focus, collapse/expand) | Most "product-grade" UI feel; the plugins (bubble sets, bundling, fisheye) are unique. 3D extension exists but is young. |
| **Cytoscape.js** `cytoscape@3.34.3` + `cytoscape-fcose@2.2.0` (+ `cose-base@2.2.0`, `layout-base@2.0.1`) | Canvas 2D | 2D | MIT | UMD `dist/cytoscape.min.js` → `cytoscape`; fcose UMD `cytoscape-fcose.js` needs globals `layoutBase`, `coseBase` loaded first | ≤ 5k nodes | CSS-like stylesheet, **compound nodes**, fcose/cola/cose-bilkent layouts with animation, haystack/bezier/taxi edges, `background-image` nodes, pie nodes | Very good: selection, box select, context menus, animation API | Clean, precise, "scientific diagram" aesthetic; not flashy but extremely controllable. |
| **Apache ECharts graph** `echarts@6.1.0` (+ `echarts-gl@2.1.0` for `graphGL`) | Canvas/SVG (`graph`), WebGL + GPU ForceAtlas2 (`graphGL`) | 2D | Apache-2.0 (echarts), MIT (gl) | UMD `dist/echarts.min.js` → `echarts`; `dist/echarts-gl.min.js` (peer echarts ^5 or ^6, confirmed) | `graph`: ≤ 3k; `graphGL`: 100k+ | `shadowBlur` **glow**, `emphasis.focus:'adjacency'` with fade, `curveness`, animated force, categories legend, tooltips, `graphGL` modularity colouring | Roam zoom/pan, hover focus, legend toggles | Very dashboard-friendly with an instantly recognisable neon-on-dark ECharts look; graphGL is a hidden gem for big graphs. |
| **vis-network** `vis-network@10.1.2` | Canvas 2D | 2D | Apache-2.0 OR MIT | UMD `standalone/umd/vis-network.min.js` → `vis`; ESM `standalone/esm/vis-network.min.mjs` | ≤ 2k nodes | Physics solvers (barnesHut, forceAtlas2Based), smooth/curved edges, shadows, clustering, image/icon nodes, hierarchical layout | Good: drag, physics live, navigation buttons, editing toolbar | Solid and friendly, but the default look is dated; needs heavy theming to compete. |
| **D3-force custom** `d3@7.9.0` | Canvas 2D or SVG (you write it) | 2D | ISC | UMD `dist/d3.min.js` → `d3` | ≤ 5k (Canvas) | Anything you can draw: radial gradients, glow via `shadowBlur`, arcs, animated entrance, hull blobs, label collision | You write it | Hand-crafted "ink & neon" look; unbounded polish per unit effort for small graphs. |
| **deck.gl** `deck.gl@9.4.0` | WebGL2/WebGPU (luma.gl) | 2D/2.5D | MIT | UMD `dist.min.js` → `deck` | 100k+ | ScatterplotLayer/LineLayer/ArcLayer for nodes and edges; no graph layout built in (bring d3-force). `graph.gl@1.0.0` (Uber) is **abandoned** (deck.gl 7, React 16, last publish 2022) | Pan/zoom/pick via deck | Great as a geo-graph renderer; for pure network graphs it is more work than cosmos.gl for a similar look. Survey only. |
| **VivaGraphJS** `vivagraphjs@0.12.0` | WebGL/SVG/Canvas 2D | 2D | BSD-3 | UMD `dist/vivagraph.min.js` → `Viva` | 10k+ | WebGL sprites, fast layouts (anvaka) | Basic | Historic pioneer; unmaintained since 2022. Survey only. |
| **ngraph.pixel** `ngraph.pixel@2.4.1` | three.js WebGL | 3D | MIT | **No dist bundle** (CommonJS `index.js` + `lib/`) → needs bundler or esm.sh | 10k+ | 3D point-sprite nodes, 3D force layout | Basic fly camera | Cannot be loaded from a static page without a bundler; unmaintained. Survey only. |
| **Reagraph** `reagraph@4.32.0` | three.js WebGL (React) | 2D/3D | Apache-2.0 | ESM-only, React peer; possible via esm.sh import map but not a plain script | 1k–10k | Glow/edge-arrows, clusters, radial/hierarchical layouts, dark theme | React-driven | Pretty and modern but React-only; not a fit for plain static demos. Survey only. |
| **ccNetViz** `ccnetviz@1.0.19` | WebGL 2D | 2D | **GPL-3.0** | `lib/ccNetViz.js` (UMD-ish) | 100k+ | Curved edges, textures, many layouts | Basic | GPL makes it awkward for a product; unmaintained. Survey only. |
| **Cosmograph** `@cosmograph/cosmograph@2.5.1` | cosmos.gl engine + DuckDB-WASM UI kit | 2D | **CC-BY-NC-4.0** (non-commercial; commercial licence by contacting the team; "free for pre-revenue startups") | ESM modules only (no bundle), pulls `@duckdb/duckdb-wasm`, Arrow, Mosaic | 1M+ | Timeline, histograms, legends, search, cluster labels on top of cosmos.gl | Excellent | The most spectacular *app*, but non-commercial licence. Use its MIT engine `@cosmos.gl/graph` instead. |
| **NVL (Neo4j Visualization Library)** `@neo4j-nvl/base@2.0.0` | WebGL 2D | 2D | **Proprietary** — LICENSE.txt: may only be used with Neo4j Aura or Neo4j commercial database products | ESM `dist/base.mjs`; peer `neo4j-driver` | 10k+ | Neo4j Bloom-style nodes with captions, rings, layouts in workers | Good | Looks great (Bloom heritage) but the licence forbids standalone use. Survey only. |
| **KeyLines / ReGraph** (Cambridge Intelligence) | Canvas/WebGL | 2D (KeyLines has 3D-ish maps/time bar) | Commercial | Licensed download only | 10k+ | Time bar, combos, link analysis styling | Excellent | Enterprise link-analysis gold standard; free trial (KeyLines: on request; ReGraph: 21-day), pricing on request (third-party listings quote roughly $30–50/user/month tiers). |
| **Ogma** (Linkurious) | WebGL/Canvas/SVG | 2D (+ geo) | Commercial | Licensed download only | 100k+ | Very polished styling, geo mode, Neo4j/graph-DB integrations | Excellent | Beautiful and huge feature set; 30-day free trial, pricing on request. |
| **yFiles for HTML** (yWorks) | SVG/Canvas/WebGL2 | 2D | Commercial | Licensed download only; free evaluation | 10k+ | Best-in-class automatic layouts (hierarchic, orthogonal, organic), diagram-quality edge routing | Excellent | The diagramming reference; perpetual per-developer licences, priced on request (historically several thousand USD per developer). |
| **Kumu** | Canvas (SaaS) | 2D | SaaS | Not embeddable as a library | Small | Lovely soft "systems map" style, decorations | Good | Free basic workspace; Pro $10/mo, private projects $20/project/mo. Inspiration only. |
| **Gephi Lite** | Sigma.js + graphology (web app) | 2D | Open source app (GPL family; verify) | It is an app, not a library | 100k | Gephi-style layouts, appearance panels | Good | Proof of what Sigma can look like; not a library to embed. |
| **G6 3D** (`@antv/g6-extension-3d`) | @antv/g-webgl | 3D | MIT | UMD `dist/g6-extension-3d.min.js` (see gotcha) | ≤ 5k | Sphere/Cube/Torus nodes, Phong materials, directional light, `D3Force3DLayout`, orbit/roll/zoom behaviours | Good | Attractive but young; the UMD bundle inlines its own copy of G6/@antv/g, so prefer ESM import map with pinned `?deps=@antv/g6@5.1.1` or test the UMD pairing carefully. |

---

## 2. Per-library notes and no-build load recipes (verified against tarballs)

### 2.1 3d-force-graph (3D, three.js)
- Tarball `3d-force-graph-1.80.0.tgz`: `dist/3d-force-graph.min.js` (UMD, **bundles three.js**; `REVISION` present), `dist/3d-force-graph.mjs` (ESM; bare imports `three`, `three-forcegraph`, `three-render-objects`, `kapsule`, `accessor-fn`, `three/examples/jsm/controls/DragControls.js`).
- Labels: `three-spritetext@1.10.0` (`dist/three-spritetext.min.js` UMD → `SpriteText`, or `.mjs`).
- Bloom (official example `example/bloom-effect/index.html`): `Graph.postProcessingComposer().addPass(new UnrealBloomPass())` with `strength 4, radius 1, threshold 0` on `backgroundColor('#000003')`.
- **Recipe A (UMD, simplest):**
  ```html
  <script src="https://cdn.jsdelivr.net/npm/3d-force-graph@1.80.0/dist/3d-force-graph.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three-spritetext@1.10.0/dist/three-spritetext.min.js"></script>
  <script type="module">
    import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.186.0/examples/jsm/postprocessing/UnrealBloomPass.js';
    // works because the pass only needs its own three classes; official example does exactly this via esm.sh
  </script>
  ```
- **Recipe B (all-ESM, single three instance — preferred):** import map `three` → `https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js`, `three/addons/` → `https://cdn.jsdelivr.net/npm/three@0.186.0/examples/jsm/`, `3d-force-graph` → `https://cdn.jsdelivr.net/npm/3d-force-graph@1.80.0/+esm` (jsDelivr rewrites bare imports) or `https://esm.sh/3d-force-graph@1.80.0?deps=three@0.186.0`.
- Gotchas: the UMD bundle ships its own three; do not also load a second three UMD. `linkDirectionalParticles` costs CPU on >5k links.

### 2.2 three.js custom (3D, postprocessing bloom)
- Tarball `three-0.186.0.tgz` verified paths: `build/three.module.js`, `build/three.core.js`, `build/three.webgpu.js`, `examples/jsm/postprocessing/{EffectComposer,RenderPass,UnrealBloomPass,OutputPass,SMAAPass}.js`, `examples/jsm/controls/OrbitControls.js`, `examples/jsm/lines/Line2.js`. `package.json` `exports` maps `./addons/*` → `./examples/jsm/*`.
- Layout: `d3-force-3d@3.0.6` (`dist/d3-force-3d.min.js` UMD, or ESM) — same author as 3d-force-graph.
- **Recipe (import map):**
  ```html
  <script type="importmap">{"imports":{
    "three":"https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js",
    "three/addons/":"https://cdn.jsdelivr.net/npm/three@0.186.0/examples/jsm/",
    "d3-force-3d":"https://cdn.jsdelivr.net/npm/d3-force-3d@3.0.6/+esm"}}</script>
  <script type="module">
    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
    import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
    import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
    import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
    import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
  </script>
  ```
- Gotchas: `examples/jsm` files import from bare `three` → the import map entry is mandatory. Use `OutputPass` last for correct colour space in r15x+. Bloom needs a `renderer.toneMapping` and an all-dark background to read well.

### 2.3 cosmos.gl (GPU 2D)
- Tarball `cosmos.gl-graph-3.4.1.tgz`: `dist/index.js` (ESM), `dist/index.min.js` (UMD → `globalThis.Cosmos`, self-contained incl. luma.gl; `WebGL2RenderingContext` referenced → **WebGL2 required**). Licence MIT (package.json + README). `@cosmograph/cosmos` (old name) stays CC-BY-NC — do not use it.
- API (README + `src/config.ts`): `new Graph(div, config)`; `setPointPositions(Float32Array xy)`, `setLinks(Float32Array pairs)`, `setPointColors`, `setPointSizes`, `setLinkColors`, `setLinkWidths`, `setPointClusters`, `render()`, `start/pause/unpause`, `fitView`. Config highlights: `backgroundColor`, `spaceSize`, `pointDefaultColor/Size/Shape` (`PointShape.Star` etc.), `renderHoveredPointRing`, `hoveredPointRingColor`, `focusedPointRingColor`, `highlightedPointIndices`, `outlinedPointIndices`, `pointGreyoutOpacity`, `linkDefaultColor`, `linkOpacity`, `curvedLinks`, `curvedLinkWeight`, `linkDefaultArrows`, `linkColorInterpolateFromEndpoints`, `linkDefaultStyle` (dashed) , `simulationRepulsion/Gravity/Center/LinkSpring/LinkDistance/Friction/Decay/Cluster/Collision`, `simulationRepulsionFromMouse`, `enableRightClickRepulsion`, `transitionDuration` (GPU colour/size/position transitions), `scalePointsOnZoom`, `enableDrag`, `fitViewOnInit`, `showFPSMonitor`.
- **Recipe:**
  ```html
  <script src="https://cdn.jsdelivr.net/npm/@cosmos.gl/graph@3.4.1/dist/index.min.js"></script>
  <script> const { Graph } = Cosmos; const g = new Graph(el, { curvedLinks: true, renderHoveredPointRing: true }); </script>
  ```
  or `import { Graph } from 'https://cdn.jsdelivr.net/npm/@cosmos.gl/graph@3.4.1/+esm'`.
- Gotchas: async init (`await graph.ready`); no labels → draw an HTML/Canvas overlay using `getSampledPointPositionsMap()`/`spaceToScreenPosition`; Android devices without `OES_texture_float` unsupported.

### 2.4 Sigma.js v3 + graphology (WebGL 2D)
- Tarballs: `sigma-3.0.3.tgz` → `dist/sigma.min.js` (UMD → `Sigma`; "carries everything the npm package exports", e.g. `Sigma.rendering.NodeCircleProgram`), `dist/sigma.esm.js`. `graphology-0.26.0.tgz` → `dist/graphology.umd.min.js` (→ `graphology`). `graphology-library-0.8.0.tgz` → `dist/graphology-library.min.js` (UMD → `graphologyLibrary`, contains `layoutForceAtlas2`, `communitiesLouvain`, `layout.circular`, metrics). `graphology-layout-forceatlas2@0.10.1` alone has **no** UMD (CommonJS only).
- Satellite renderers are **ESM-only** (`dist/sigma-edge-curve.esm.js`, `dist/sigma-node-border.esm.js`, `dist/sigma-node-image.esm.js`, `dist/sigma-layer-webgl.esm.js`; peer `sigma`).
- **Recipe A (UMD core):**
  ```html
  <script src="https://cdn.jsdelivr.net/npm/graphology@0.26.0/dist/graphology.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/graphology-library@0.8.0/dist/graphology-library.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/sigma@3.0.3/dist/sigma.min.js"></script>
  ```
- **Recipe B (all-ESM via import map, needed for edge-curve / node-border):**
  ```html
  <script type="importmap">{"imports":{
    "graphology":"https://esm.sh/graphology@0.26.0",
    "graphology-library":"https://esm.sh/graphology-library@0.8.0",
    "sigma":"https://esm.sh/sigma@3.0.3",
    "@sigma/edge-curve":"https://esm.sh/@sigma/edge-curve@3.1.0?deps=sigma@3.0.3",
    "@sigma/node-border":"https://esm.sh/@sigma/node-border@3.0.0?deps=sigma@3.0.3"}}</script>
  ```
  (jsDelivr `/+esm` also works for these; pin `?deps` so only one `sigma` instance exists.)
- Gotchas: mixing UMD `Sigma` with ESM satellites yields two sigma copies (usually still works since programs are duck-typed, but avoid). Nodes need `x`,`y` before rendering (run `layout.circular.assign` then ForceAtlas2).

### 2.5 AntV G6 v5 (+ 3D extension)
- Tarballs: `antv-g6-5.1.1.tgz` → `dist/g6.min.js` (UMD → `G6`, exports verified: `Graph, register, ExtensionCategory, BaseNode, BaseEdge, Hull, BubbleSets, EdgeBundling, Fisheye, Minimap, Legend, Tooltip, Background, GridLine, Circle, Line, Quadratic, Cubic…`). `antv-g6-extension-3d-0.1.23.tgz` → `dist/g6-extension-3d.min.js` (UMD → `G6Extension3D`, exports `renderer, Sphere, Cube, Capsule, Cone, Cylinder, Torus, Plane, Line3D, Light, DragCanvas3D, ObserveCanvas3D, RollCanvas3D, ZoomCanvas3D`).
- Official CDN recipe (docs `installation.en.md`): `<script src="https://unpkg.com/@antv/g6@5/dist/g6.min.js"></script>` (pin `@5.1.1`).
- 3D usage (README): `register(ExtensionCategory.NODE,'sphere',Sphere)`, `register(ExtensionCategory.EDGE,'line3d',Line3D)`, `register(ExtensionCategory.PLUGIN,'3d-light',Light)`, then `new Graph({ renderer, node:{type:'sphere', style:{materialType:'phong'}}, edge:{type:'line3d'}, layout:{type:'d3-force-3d'}, behaviors:['observe-canvas-3d','zoom-canvas-3d'], plugins:[{type:'camera-setting', projectionMode:'perspective', fov:45}, {type:'3d-light', directional:{direction:[0,0,1]}}] })`.
- **Gotcha:** the 3D UMD bundle does *not* reference `window.G6`; it inlines its own @antv/g / g6 code (1.86 MB), so class identity may differ from the G6 UMD. Test the UMD pair first; if `register` complains or rendering is blank, switch both to ESM: `https://esm.sh/@antv/g6@5.1.1` and `https://esm.sh/@antv/g6-extension-3d@0.1.23?deps=@antv/g6@5.1.1`.
- Visual features: `theme: 'dark'`, palettes (`palette: 'spectral'` etc.), `animation` on enter/update, plugins `hull`, `bubble-sets`, `edge-bundling`, `fisheye`, `edge-filter-lens`, `minimap`, `legend`, `tooltip`, `background`, `grid-line`; node types `donut`, `image`, `html`, badges and icons; combos.

### 2.6 Cytoscape.js + fcose
- Tarballs: `cytoscape-3.34.3.tgz` → `dist/cytoscape.min.js` (UMD → `cytoscape`), `dist/cytoscape.esm.min.mjs`. `cytoscape-fcose-2.2.0.tgz` → `cytoscape-fcose.js` (UMD → `cytoscapeFcose`, **external `cose-base`** → global `coseBase`). `cose-base@2.2.0` → `cose-base.js` (needs `layoutBase`), `layout-base@2.0.1` → `layout-base.js`.
- **Recipe (order matters):**
  ```html
  <script src="https://cdn.jsdelivr.net/npm/cytoscape@3.34.3/dist/cytoscape.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/layout-base@2.0.1/layout-base.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/cose-base@2.2.0/cose-base.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/cytoscape-fcose@2.2.0/cytoscape-fcose.js"></script>
  <script> cytoscape.use(cytoscapeFcose); </script>
  ```
  (`cytoscape-cola@2.5.1` is an alternative; it bundles WebCola.)
- Visuals: stylesheet selectors (`node[type="film"]`), `background-gradient-*`, `shadow` via `underlay-*`/`overlay-*`, `curve-style: unbundled-bezier | haystack | taxi`, compound parents for studios, `animate: true` layouts, `cy.animate` camera moves.

### 2.7 Apache ECharts `graph` + echarts-gl `graphGL`
- Tarballs: `echarts-6.1.0.tgz` → `dist/echarts.min.js` (UMD → `echarts`), `dist/echarts.esm.min.mjs`. `echarts-gl-2.1.0.tgz` → `dist/echarts-gl.min.js` (UMD, bundles claygl; peer `echarts ^5.1.2 || ^6.0.0` — **works with echarts 6**; contains `graphGL` + `forceAtlas2`).
- **Recipe:**
  ```html
  <script src="https://cdn.jsdelivr.net/npm/echarts@6.1.0/dist/echarts.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/echarts-gl@2.1.0/dist/echarts-gl.min.js"></script>
  ```
- Visuals: `series.type:'graph'`, `layout:'force'` (`force.repulsion`, `edgeLength`, `gravity`, `friction`), `itemStyle.shadowBlur/shadowColor` glow, `lineStyle.curveness`, `emphasis.focus:'adjacency'`, `blur` state fading, `categories` + legend, `label.formatter`, `roam:true`, `draggable`. `series.type:'graphGL'` with `forceAtlas2:{GPU:true, steps, gravity, scaling}` and `modularity` colouring for 100k+ (from `test/graphGL.html`).

### 2.8 vis-network
- Tarball `vis-network-10.1.2.tgz`: `standalone/umd/vis-network.min.js` (→ `vis`), `standalone/esm/vis-network.min.mjs`, CSS auto-injected in standalone builds; `peer/*` builds need `vis-data`, `hammerjs`, `uuid`, `keycharm` externals.
- **Recipe:** `<script src="https://cdn.jsdelivr.net/npm/vis-network@10.1.2/standalone/umd/vis-network.min.js"></script>` then `new vis.Network(el, {nodes:new vis.DataSet(...), edges:new vis.DataSet(...)}, options)`.
- Visuals: `nodes.shape:'dot'|'circularImage'`, `shadow`, `edges.smooth:{type:'curvedCW'}`, `physics.solver:'forceAtlas2Based'`, `interaction.hover`, `groups` palette. Dated defaults — theme aggressively if used.

### 2.9 D3 custom Canvas
- Tarball `d3-7.9.0.tgz` → `dist/d3.min.js` (UMD → `d3`); `d3-force@3.0.0` standalone also has `dist/d3-force.min.js`.
- **Recipe:** `<script src="https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js"></script>`; draw on a `<canvas>` with `devicePixelRatio` scaling; `d3.forceSimulation` + `forceLink/forceManyBody/forceCollide/forceX/Y`; `d3.zoom` for camera; `simulation.find(x,y)` for hover.

### 2.10 Excluded from demos, reasons
- **Cosmograph** (`@cosmograph/cosmograph`): CC-BY-NC-4.0 + no browser bundle + DuckDB-WASM dependency. Use cosmos.gl.
- **NVL**: licence limited to Neo4j Aura / commercial Neo4j products.
- **KeyLines / ReGraph / Ogma / yFiles**: commercial, trial-only downloads; no public CDN.
- **Kumu**: SaaS, not embeddable. **Gephi Lite**: an app.
- **ngraph.pixel**: no dist; **graph.gl**: abandoned (deck.gl 7 / React 16); **ccNetViz**: GPL-3.0; **Reagraph**: React-only; **VivaGraphJS**: unmaintained (loadable, but no reason to prefer it over Sigma).

---

## 3. Ranked shortlist for demos (8)

Criteria: maximal visual impact first, then variety (≥2 3D, ≥2 WebGL-2D, one custom three.js with bloom), MIT/Apache/ISC only, loadable from a static page.

| # | Demo slug | Library | Why it is on the list |
|---|---|---|---|
| 1 | `three-nebula` | three.js custom (3D, bloom) | Highest ceiling: instanced glowing spheres, Bezier tube edges, UnrealBloom, depth fog — the "film title" demo. |
| 2 | `cosmos-galaxy` | cosmos.gl (GPU 2D) | The most *alive* graph on the web: GPU simulation you can push around with the mouse, curved links, rings, GPU transitions. |
| 3 | `force3d-bloom` | 3d-force-graph (3D) | 80% of demo 1's wow for 10% of the code, plus directional particles and camera fly-to, all built in. |
| 4 | `sigma-editorial` | Sigma.js v3 + graphology (WebGL 2D) | Gephi-quality ForceAtlas2 with halos, curved edges, community colours and hover dimming; the most "designed" 2D look. |
| 5 | `g6-studio` | AntV G6 v5 (Canvas/WebGL 2D, optional 3D variant) | Product-grade UI: dark theme, bubble sets around studios, edge bundling, fisheye, animated transitions, legend/minimap. |
| 6 | `echarts-neon` | ECharts graph (+ graphGL toggle) | Neon glow + adjacency-focus fade that dashboards love; graphGL shows GPU ForceAtlas2 on a synthetic 50k stress set. |
| 7 | `cytoscape-blueprint` | Cytoscape.js + fcose (Canvas 2D) | Crisp compound-node "blueprint" with animated fcose layout — the precise, analytical counterpoint. |
| 8 | `d3-ink` | D3-force custom Canvas (2D) | Hand-drawn "ink & neon" look with gradients, arcs and staged entrance animation; proves what custom Canvas can do. |

Optional 9th if wanted for completeness: `vis-classic` (vis-network) — classic physics playground, heavily re-themed.

3D count: #1, #3 (+ optional G6 3D mode inside #5). WebGL-2D count: #2, #4, #6 (graphGL), and G6 can run its WebGL renderer.

---

## 4. Three most notable findings

1. **Cosmograph's engine is now MIT.** `@cosmograph/cosmos` (CC-BY-NC) was renamed `@cosmos.gl/graph` and donated to the OpenJS Foundation; v3.4.1 ships a self-contained UMD (`dist/index.min.js`, global `Cosmos`) that runs the whole force simulation on the GPU. The Cosmograph *app/UI kit* remains non-commercial, so build on the engine directly.
2. **NVL is not usable here.** Its LICENSE.txt restricts the library to Neo4j Aura or Neo4j commercial database deployments, so despite looking like Neo4j Bloom it must stay a survey entry only.
3. **Everything on the shortlist has a verified no-build path**, with two caveats: Sigma's pretty renderers (`@sigma/edge-curve`, `@sigma/node-border`) are ESM-only, so the Sigma demo should use an import map instead of UMD scripts; and G6's 3D extension UMD inlines its own G6 copy, so the ESM import map with `?deps=@antv/g6@5.1.1` is the safer pairing.

## 5. Libraries that cannot be loaded from a static page (without a bundler or licence)
- `ngraph.pixel` (CommonJS only, no dist).
- `graph.gl` (needs React 16 + deck.gl 7 peer stack; abandoned).
- `reagraph` (React component library; ESM-only).
- `@cosmograph/cosmograph` (ESM module tree + DuckDB-WASM; plus CC-BY-NC).
- `@neo4j-nvl/base` (loadable as ESM but licence prohibits standalone use).
- KeyLines / ReGraph / Ogma / yFiles (commercial downloads, no CDN).

## Sources consulted
- npm registry metadata and tarballs for every package listed (versions as of 2026-09-17).
- OpenJS Foundation: "Introducing cosmos.gl" and "cosmos.gl v3 Is Here" (openjsf.org/blog); cosmosgl/graph README and `src/config.ts` (raw.githubusercontent.com).
- vasturiano/3d-force-graph README and `example/bloom-effect/index.html`.
- jacomyal/sigma.js `packages/website/docs/quickstart.md`, `packages/edge-curve/README.md`.
- antvis/G6 v5 `docs/manual/getting-started/installation.en.md`, `docs/manual/further-reading/3d.en.md`, `packages/g6-extension-3d/README.md`, `examples/element/node/demo/3d-node.js`.
- ecomfe/echarts-gl `test/graphGL.html`.
- Cosmograph licensing page (via search snippets): CC-BY-NC-4.0, commercial by contact, free for pre-revenue startups.
- Cambridge Intelligence / Linkurious / yWorks / Kumu pricing pages (via search snippets; vendor sites blocked from sandbox).
