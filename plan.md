# Graph Gallery — demo build plan

Goal: a static GitHub Pages site where each folder is a self-contained, *gorgeous* demo of one
network-graph library, all rendering the same film-studio dataset, so the team can compare looks
and pick a library. No build step: CDN `<script>` tags or ESM import maps only (see research.md
for the verified file paths and versions).

## 1. Repository layout

```
gallery/
  index.html                 landing page: card grid of demos (thumbnail, library, renderer, licence, "open" link)
  shared/
    data.json                the shared dataset (generated, do not hand-edit)
    build-data.py            generator: seed.sql -> data.json (python3 + sqlite3, stdlib only)
    theme.css                shared chrome: dark page bg, HUD panel, legend, type colours as CSS vars
    hud.js                   tiny helper: title/legend/FPS/controls panel + `loadData()` (fetch + index maps)
    stress.js                optional synthetic 20k–100k node generator for the GPU demos (cosmos, graphGL)
  demos/
    three-nebula/index.html      (+ main.js)   three.js custom, bloom
    cosmos-galaxy/index.html     (+ main.js)   cosmos.gl
    force3d-bloom/index.html                   3d-force-graph
    sigma-editorial/index.html   (+ main.js)   sigma v3 + graphology
    g6-studio/index.html                       AntV G6 v5 (+ 3D toggle)
    echarts-neon/index.html                    ECharts graph (+ graphGL toggle)
    cytoscape-blueprint/index.html             Cytoscape.js + fcose
    d3-ink/index.html            (+ main.js)   d3-force custom canvas
  research.md, plan.md
```

Rules for every demo:
- One `index.html`, optional `main.js` (ES module). Load data with `fetch('../../shared/data.json')`.
- Pin every CDN URL to the exact versions verified in research.md (never `@latest`).
- Full-viewport canvas, dark background, shared HUD (top-left: demo name + library + version;
  bottom-left: legend by node type; top-right: 2–4 toggles specific to the library; bottom-right: FPS).
- Same colour semantics everywhere (from `data.json` `meta.type_colors`):
  studio `#f5b642` amber, film `#ff5f8f` rose, person `#5ec8ff` sky, genre `#8dff9e` mint, award `#e6c3ff` lilac.
- Same size semantics: node size ∝ `degree` (films additionally boosted by `gross_musd`, people by `wins`).
- Same edge semantics: `won`/`nominee(won)` edges are bright gold; credit roles are tinted by role
  (director warm white, actor sky, writer violet, composer teal, producer amber); `genre` and
  `produced_by` edges are faint structural edges.
- Hover: highlight the node + its neighbourhood, dim the rest, show a tooltip with the label and
  key numbers. Click: "focus" (camera fly-to or zoom-to-fit neighbourhood). Double-click empty: reset.
- Entrance: never pop in fully formed — animate the layout settling or fade/scale nodes in over ~1.5 s.
- Keep each demo under ~300 lines; the point is the look, not a framework.

## 2. Shared dataset spec (`shared/data.json`)

Generated from `graph-app/seed.sql` by `shared/build-data.py` (already run; 85 nodes, 361 links —
well under the 1,000-node ceiling; GPU demos add a synthetic stress set at runtime instead).

```jsonc
{
  "meta": {
    "source": "graph-app/seed.sql (fictional film-studio universe)",
    "node_types": {"award":4,"film":25,"genre":10,"person":40,"studio":6},
    "relation_types": {"actor":88,"composer":25,"director":25,"genre":51,"nominated":26,
                       "nominee":34,"produced_by":25,"producer":27,"won":19,"writer":41},
    "type_colors": {"studio":"#f5b642","film":"#ff5f8f","person":"#5ec8ff","genre":"#8dff9e","award":"#e6c3ff"}
  },
  "nodes": [
    {"id":"studio:1","type":"studio","label":"Halcyon Pictures","founded":1931,"country":"United States","degree":5},
    {"id":"film:13","type":"film","label":"Hemisphere","year":2013,"runtime_min":151,"budget_musd":95,
     "gross_musd":402.3,"roi":4.24,"degree":14,"wins":4},
    {"id":"person:4","type":"person","label":"Dae-hyun Seo","born":1975,"nationality":"South Korean",
     "degree":9,"film_count":5,"wins":1},
    {"id":"genre:3","type":"genre","label":"Science Fiction","degree":7},
    {"id":"award:1","type":"award","label":"Golden Meridian – Best Picture","award":"Golden Meridian",
     "category":"Best Picture","degree":14}
  ],
  "links": [
    {"source":"film:1","target":"studio:1","relation":"produced_by"},
    {"source":"person:13","target":"film:1","relation":"actor","character":"Elena Marchetti"},
    {"source":"film:1","target":"genre:1","relation":"genre"},
    {"source":"film:3","target":"award:1","relation":"won","year":2002},
    {"source":"person:6","target":"award:2","relation":"nominee","year":2002,"won":true}
  ]
}
```

- `id` = `<type>:<pk>` so every demo can split type from id without a lookup.
- Node numeric attributes available for sizing/colouring: `degree` (all), `year/runtime_min/budget_musd/gross_musd/roi/wins` (film), `born/film_count/wins` (person), `founded` (studio).
- Link `relation` values: `produced_by` (film→studio), `director|writer|actor|composer|producer`
  (person→film, credits), `genre` (film→genre), `nominated|won` (film→award), `nominee` (person→award, with `won`).
- Regenerate with `python3 shared/build-data.py [path/to/seed.sql]`.

### Loader helper (`shared/hud.js`), shared by all demos
```js
export async function loadData(url = '../../shared/data.json') {
  const d = await (await fetch(url)).json();
  const byId = new Map(d.nodes.map(n => [n.id, n]));
  d.nodes.forEach(n => { n.color = d.meta.type_colors[n.type]; n.size = 3 + Math.sqrt(n.degree) * 2; });
  return { ...d, byId };
}
```

## 3. Per-demo visual briefs

### 3.1 `three-nebula` — three.js custom (3D, bloom) — "Nebula"
- **Look:** deep-space black `#02030a`; nodes are emissive `InstancedMesh` spheres (per-instance colour by type, radius ∝ size) with a second, larger, additive-blended sprite halo; edges are `QuadraticBezierCurve3` tubes or `Line2` fat lines with per-vertex colours interpolating between endpoint colours, ~25% opacity; `won` edges pulse (animated emissive intensity). `UnrealBloomPass` strength 1.2–1.6, radius 0.6, threshold 0.15; `OutputPass` last; `FogExp2` for depth; slow auto-orbit until first interaction.
- **Layout:** `d3-force-3d` (forceLink distance by relation, forceManyBody −40, forceCenter); run ~200 ticks off-screen then animate positions in over 1.5 s with easing (nodes scale from 0).
- **Interaction:** `OrbitControls` with damping; raycast hover on the instanced mesh (`instanceId`) → grow instance, brighten neighbourhood, dim others via per-instance colour; click → `gsap`-free camera tween toward node; HUD toggles: bloom on/off, edge style (tube/line), spin.
- **Load:** import map (research §2.2). WebGL2 fine; keep instance count and tube segment count modest.

### 3.2 `cosmos-galaxy` — cosmos.gl (GPU 2D) — "Living galaxy"
- **Look:** background `#05060f`; `pointDefaultShape` circle for people, star for awards, square for studios (via `setPointShapes`); sizes ∝ degree with `scalePointsOnZoom`; `curvedLinks: true`, `linkColorInterpolateFromEndpoints: true`, `linkOpacity 0.35`, gold `won` links wider; `renderHoveredPointRing` with a white ring, `focusedPointRingColor` gold; `simulationRepulsionFromMouse` on so the graph *flows* away from the cursor; `enableRightClickRepulsion`.
- **Layout:** the GPU simulation itself, `simulationGravity 0.25`, `simulationRepulsion 1.2`, `simulationLinkSpring 1.5`, `simulationDecay` high so it keeps breathing; use `setPointClusters` by node type with `simulationCluster 0.3` so studios/genres form soft regions; on toggle, `transitionDuration 800` GPU-animated re-colouring by community.
- **Labels:** HTML overlay of the top-N degree nodes positioned from `getSampledPointPositionsMap()` each frame, fading by zoom level.
- **Interaction:** hover → `highlightedPointIndices` = neighbourhood, `pointGreyoutOpacity 0.15`; click → `fitViewByPointIndices` on neighbourhood; HUD: play/pause simulation, "stress test" toggle that swaps in `shared/stress.js` (50k nodes) to show the GPU flex.
- **Load:** UMD `dist/index.min.js` → `Cosmos.Graph` (research §2.3). Requires WebGL2; show a friendly fallback message if unavailable.

### 3.3 `force3d-bloom` — 3d-force-graph (3D) — "Constellation"
- **Look:** `backgroundColor('#000004')`, `nodeOpacity 0.95`, node colour by type, `nodeVal` ∝ degree; `linkOpacity 0.25`, `linkCurvature 0.25`, `linkColor` by relation; **directional particles** only on `won`/`nominee` links (`linkDirectionalParticles 2`, gold, width 1.5) so awards visibly "flow" to winners; `UnrealBloomPass` strength 1.5, radius 0.8, threshold 0.1 via `postProcessingComposer()`; `SpriteText` labels (`three-spritetext`) for studios and awards only, others on hover.
- **Layout:** built-in 3D force (`d3AlphaDecay 0.02`, `d3VelocityDecay 0.3`), `cooldownTicks 200` then `zoomToFit(1000, 60)`; optional `dagMode('radialout')` toggle rooted at studios for a structured alternative.
- **Interaction:** hover highlight (neighbour set via prebuilt adjacency), click → `cameraPosition({x,y,z: distance ratio}, node, 1200)` fly-in, drag nodes on; HUD: bloom, particles, DAG mode.
- **Load:** Recipe B all-ESM import map so `UnrealBloomPass` and the graph share one three (research §2.1); Recipe A UMD as fallback.

### 3.4 `sigma-editorial` — Sigma.js v3 + graphology (WebGL 2D) — "Editorial dark"
- **Look:** background `#0b0d14`; nodes via `@sigma/node-border` program: inner disc in type colour, 2 px outer ring white at 25% (halo), award/winner nodes get a gold ring; edges via `@sigma/edge-curve` with `curvature 0.25` (parallel credits offset with `indexParallelEdgesIndex`), thin (`size 0.8`), colour = blend of endpoint colours at 30% opacity; `labelRenderedSizeThreshold` so only hubs show labels, label font `Inter`/system, white 90%; `zIndex` so films draw above people.
- **Layout:** `graphologyLibrary.layout.circular.assign` seed → `layoutForceAtlas2` in a **web worker** (`FA2Layout` from graphology-library) with `scalingRatio 8`, `gravity 0.5`, `barnesHutOptimize` off (small graph), running live for 3 s (nodes visibly organising), then stopped; toggle to re-run; `communitiesLouvain.assign` to offer a "communities" colour mode.
- **Interaction:** `nodeReducer`/`edgeReducer` for hover (neighbours full colour, others `#2a2d3a` + `hidden` labels); click → `sigma.getCamera().animate({x,y,ratio:0.35})`; drag nodes (mousedown → `graph.setNodeAttribute`); HUD: colour by type/community, curved/straight, labels density slider.
- **Load:** all-ESM import map (research §2.4 Recipe B) so `sigma`, `@sigma/edge-curve`, `@sigma/node-border` share one instance.

### 3.5 `g6-studio` — AntV G6 v5 — "Product-grade"
- **Look:** `theme: 'dark'`, `background: '#0f1117'`; node `type:'circle'` with `fill` by type, `lineWidth 1.5` stroke lighter tint, `halo: true` on hover state, `badge` showing wins count on films, `icon` (studio/award glyph) via `iconText`; edges `type:'cubic'` for credits, `type:'line'` dashed for `genre`, `endArrow` only on `won` (gold); **`bubble-sets` plugin** drawing a soft translucent blob around each studio's films; **`edge-bundling` plugin** toggle for the credits; `fisheye` plugin toggle; `legend` plugin bottom-left; `minimap` bottom-right; enter animation `animation: { duration: 800 }`.
- **Layout:** `d3-force` layout with `link.distance` by relation and `manyBody.strength -60`; alternative `radial` rooted at a chosen studio on click ("focus-element" behaviour) with animated transition.
- **Interaction:** behaviours `['drag-canvas','zoom-canvas','drag-element','hover-activate','click-select','brush-select']`; `tooltip` plugin with label + numbers; HUD: bundling, fisheye, layout switch, **3D mode** toggle that re-creates the graph with `renderer` + `sphere`/`line3d` from `@antv/g6-extension-3d` and `d3-force-3d` layout under a directional `3d-light` (Phong material, dark background).
- **Load:** UMD `dist/g6.min.js` (research §2.5); the 3D toggle via ESM import map `esm.sh/@antv/g6-extension-3d@0.1.23?deps=@antv/g6@5.1.1` (test the UMD pair first; fall back to ESM for both if class identity issues appear).

### 3.6 `echarts-neon` — ECharts graph + graphGL — "Neon dashboard"
- **Look:** `backgroundColor '#070a12'`; `series.type:'graph'`, `layout:'force'`, `roam:true`, `draggable:true`; `categories` = node types with type colours; `itemStyle: { shadowBlur: 25, shadowColor: <type colour>, borderColor: '#fff', borderWidth: 0.5 }` for the neon glow; `lineStyle: { curveness: 0.25, opacity: 0.35, color: 'source' }`, `won` edges gold width 2 with `effect`-like emphasis; `emphasis: { focus: 'adjacency', lineStyle: { width: 3 } }` and `blur: { itemStyle: { opacity: 0.08 } }` so hovering isolates the neighbourhood with a smooth fade; `label.show` for degree > 8, `label.position 'right'`, `textBorder` for legibility; legend top-right toggles types; animated force (`force: { repulsion: 220, edgeLength: [40,120], gravity: 0.08, friction: 0.15, layoutAnimation: true }`).
- **Interaction:** built-in roam/drag/tooltip (`tooltip.formatter` with numbers); click → `dispatchAction({type:'focusNodeAdjacency'})`; HUD: **"GPU mode"** toggle that swaps to `series.type:'graphGL'` on a 50k-node synthetic set (`shared/stress.js`) with `forceAtlas2: { GPU: true, steps: 5, gravity: 1, scaling: 1 }` and `modularity` colouring.
- **Load:** UMD echarts + echarts-gl (research §2.7).

### 3.7 `cytoscape-blueprint` — Cytoscape.js + fcose — "Blueprint"
- **Look:** background `#0c1220` with a faint CSS grid; **compound nodes**: each studio is a parent box (`shape: round-rectangle`, translucent amber fill 6%, 1 px amber border, label top-left in small caps) containing its films; films `shape: ellipse`, rose fill with `background-gradient` radial highlight; people `diamond` sky; genres and awards outside compounds; `underlay-color`/`underlay-opacity` on hover as a soft glow; edges `curve-style: unbundled-bezier` with `control-point-distances`, credits sky/violet 40%, `won` gold with `target-arrow-shape: triangle`; `genre` edges `haystack` faint.
- **Layout:** `fcose` (`quality:'proof'`, `nodeRepulsion 6000`, `idealEdgeLength 90`, `animate:true`, `animationDuration 1200`, `packComponents`) so compounds settle into view; toggle to `cola` or `concentric` (by degree) with animation.
- **Interaction:** selection styling (`:selected` bright), neighbourhood highlight via classes (`cy.elements().not(neighborhood).addClass('faded')`), `cy.animate({ fit: { eles: neighborhood, padding: 80 } })` on click; HUD: layout switch, compounds on/off, edge style.
- **Load:** UMD chain cytoscape → layout-base → cose-base → cytoscape-fcose (research §2.6).

### 3.8 `d3-ink` — D3-force custom Canvas — "Ink & neon"
- **Look:** background `#0a0a0f` with subtle vignette; nodes drawn as radial gradients (bright core → type colour → transparent) plus `shadowBlur 18` in the type colour for glow; edges as quadratic arcs (`ctx.quadraticCurveTo`) with alpha 0.25, drawn with `globalCompositeOperation: 'lighter'` so crossings brighten; `won` edges gold with an animated dash offset ("marching" light); labels for hubs in a serif display font (Fraunces/Playfair via Google Fonts) — the editorial contrast against the neon; convex hulls (`d3.polygonHull`) filled 5% around each studio's films.
- **Layout:** `forceSimulation` with `forceLink` distance by relation, `forceManyBody -120`, `forceCollide(size+2)`, `forceX/Y` weak centring; staged entrance: studios appear first, then films spring out, then people, then genres/awards (spawn per type every 300 ms, alpha reheated) — the settle *is* the intro animation.
- **Interaction:** `d3.zoom` on the canvas; hover via `simulation.find`; drag via `d3.drag` with `subject: simulation.find`; click → zoom transform tween to the neighbourhood's bounding box; HUD: hulls, glow, replay entrance.
- **Load:** UMD `d3.min.js` (research §2.9).

## 4. Landing page (`index.html`)
- Card grid (2–4 columns), each card: static thumbnail (`demos/<slug>/thumb.jpg`, captured once from the demo at 1280×800), title, library name + version, renderer badge (WebGL 3D / GPU 2D / WebGL 2D / Canvas 2D), licence badge, one-line "signature look", buttons "Open demo" and "npm". Dark theme matching the demos; the shared HUD styles live in `shared/theme.css`.
- A short "How to compare" note: same dataset, same colours, same interactions; look for label legibility, motion quality, hover feel, and how much of the beauty is default vs. custom code (report that per demo in a small "effort" meter on the card).

## 5. Build order and checkpoints
1. `shared/` chrome (`theme.css`, `hud.js`, `stress.js`) and landing page skeleton.
2. `force3d-bloom` (fastest wow, validates the CDN + import-map approach on GitHub Pages).
3. `cosmos-galaxy` and `sigma-editorial` (the two WebGL-2D anchors).
4. `three-nebula` (highest effort; reuse the 3D layout code from step 2).
5. `g6-studio`, `echarts-neon`, `cytoscape-blueprint`, `d3-ink`.
6. Thumbnails, landing-page cards, README with the licence/CDN table from research.md.
Checkpoint for each demo: loads from a clean `file://`-free static server (`python3 -m http.server`) with no console errors, 60 fps at 1080p on integrated graphics, hover/click/reset all work, and it looks deliberate in a screenshot with the HUD hidden.

## 6. Risks and mitigations
- **CDN availability** could not be tested from this sandbox (all CDNs blocked); paths were verified against npm tarballs. First step on a normal machine: open each pinned URL once.
- **Import-map browser support**: all evergreen browsers; add `<script async src="es-module-shims">` only if Safari < 16.4 matters.
- **WebGL2** required by cosmos.gl (and G6 WebGL renderer); show a fallback message.
- **G6 3D UMD** dual-instance risk → ESM import map with pinned `?deps`.
- **Sigma satellites** ESM-only → the Sigma demo is all-ESM.
- **Font loading**: use Google Fonts with `display=swap`; Canvas demos must wait for `document.fonts.ready` before drawing labels.
