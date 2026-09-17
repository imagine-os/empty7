# Graph Gallery — group 3: "Object views" (nodes ARE the objects)

Justin's brief: *"integrate images and icons and pngs to make it more clear. 3D models can also be used. Make sure we
can visually navigate the graphs even in screenshots. If we're looking deeper into software or documents … really
seeing what's being connected not just as circles or nodes, but as the objects themselves."*

So: **never a bare circle.** A service is a rack with its language logo, a document is its own thumbnail, a person is
an avatar, a file is a tile with the language icon and an extension badge, a repo is a folder. Labels always on.

## 0. Dataset — `shared/system.json` (from `shared/build-system.py`, seed 11; do not hand-edit)

"Northwind Labs" system map: **92 nodes, 188 links, 12 groups**.
service 12 · database 6 · queue 2 · repo 8 · file 30 · document 14 · person 12 · cloud 8.
Relations: calls 20 · reads 10 · writes 10 · publishes 6 · consumes 4 · contains 30 (repo→file) · documents 21
(document→service/repo/cloud/db) · references 10 (doc→doc) · owns 20 (person→service/repo) · authored 14
(person→doc) · deploys_to 22 (service→cloud, repo→GitHub Actions) · monitors 21 (Datadog/Sentry→service).

```jsonc
{ "meta": {
    "asset_root": "../../shared/assets/",           // prefix for every icon/logo/thumb/avatar/model path below
    "type_colors":  { "service":"#5ec8ff","database":"#f5b642","queue":"#ff9f43","repo":"#b48cff",
                      "file":"#cfd6e6","document":"#ffd166","person":"#ff5f8f","cloud":"#8dff9e" },
    "type_frames":  { "service":"rack","database":"cylinder","queue":"pipe","repo":"folder",
                      "file":"tile","document":"page","person":"circle","cloud":"cloud" },
    "type_models":  { "service":"models/server.glb", "database":"models/database.glb", "queue":"models/queue.glb",
                      "repo":"models/folder.glb", "file":"models/document.glb", "document":"models/document.glb",
                      "person":"models/laptop.glb", "cloud":"models/cloud.glb" },
    "relation_styles": { "calls": { "color":"#5ec8ff","width":1.6,"dash":null,"arrow":true,"label":"calls" },
                         "publishes": { "color":"#ff9f43","width":1.4,"dash":[6,3],"arrow":true, ... }, ... },
    "ext_icons": { "ts":"icons/lang-typescript.svg", "py":"icons/lang-python.svg", "go":"icons/lang-go.svg",
                   "rs":"icons/lang-rust.svg", "md":"icons/brand-markdown.svg", "json":"icons/ui-braces.svg",
                   "yaml":"icons/brand-yaml.svg", "sql":"icons/ui-database.svg" },
    "teams": { "platform": {"label":"Platform","color":"#5ec8ff"}, "payments": {...}, "data": {...}, "frontend": {...} },
    "counts": { "nodes":92, "links":188, "groups":12, "by_type":{...}, "by_relation":{...} } },
  "nodes": [
    { "id":"svc:billing","type":"service","label":"billing","sublabel":"invoices & plans",
      "icon":"icons/ui-receipt.svg","logo":"icons/lang-go.svg","lang":"Go","owner":"person:priya-nair",
      "team":"payments","repo":"repo:billing-service","health":"healthy","rps":1834,"degree":13 },
    { "id":"db:postgres-main","type":"database","label":"postgres-main","icon":"icons/ui-database.svg",
      "logo":"icons/brand-postgresql.svg","engine":"PostgreSQL","size_gb":340 },
    { "id":"file:billing-service/internal/invoice/invoice.go","type":"file","label":"invoice.go",
      "sublabel":"internal/invoice/invoice.go","icon":"icons/lang-go.svg","ext":"go","repo":"repo:billing-service","loc":812 },
    { "id":"doc:invoice-datadog","type":"document","label":"Datadog invoice — Aug 2026","sublabel":"PDF · 2 pp",
      "icon":"icons/ui-file-text.svg","thumb":"thumbs/invoice-datadog.png","format":"pdf","pages":2,
      "kind":"invoice","updated":"2026-07-14","author":"person:..." },
    { "id":"person:ada-okafor","type":"person","label":"Ada Okafor","sublabel":"Staff engineer","icon":"icons/ui-user.svg",
      "avatar":"avatars/ada-okafor.svg","role":"Staff engineer","team":"platform","initials":"AO" },
    { "id":"cloud:datadog","type":"cloud","label":"Datadog","sublabel":"Datadog · metrics & APM",
      "icon":"icons/ui-heart-pulse.svg","logo":"icons/brand-datadog.svg","provider":"Datadog" } ],
  "links":  [ { "source":"svc:billing","target":"db:postgres-billing","relation":"writes" }, ... ],
  "groups": [ { "id":"group:repo:billing-service","kind":"repo","label":"billing-service","color":"#b48cff",
                "parent":"repo:billing-service","members":["file:billing-service/cmd/billing/main.go", ...] },
              { "id":"group:team-payments","kind":"team","label":"Payments team","color":"#f5b642",
                "members":["person:diego-ruiz", ..., "svc:billing", "svc:payments", "svc:orders", "repo:billing-service"] } ] }
```
Ids are prefixed by type: `svc:` `db:` `q:` `repo:` `file:<repo>/<path>` `doc:` `person:` `cloud:`.
Loader: `const sys = await (await fetch('../../shared/system.json')).json();` then
`const asset = p => sys.meta.asset_root + p;` — `hud.js`'s `mountHud` works unchanged
(`mountHud({ typeColors: sys.meta.type_colors, ... })`); `buildNeighbors(sys.links)` is reusable as-is.
**Picture precedence for a node**: `thumb` (documents) → `avatar` (people) → `logo` (brand/lang mark) → `icon` (generic glyph).
Show `logo` *and* `icon` together when both exist (icon = what it is, logo = which tech), e.g. rack glyph + Go gopher.

## 0b. Local assets — `shared/assets/` (all relative paths, no CDN; see `assets/LICENSES.md`)

| folder | what | count / size |
|---|---|---|
| `icons/` | `brand-*.svg` (simple-icons, CC0, brand hex baked as `fill`, near-black brands lifted to `#e8eaf2`), `lang-*.svg` + `brand-aws.svg` (devicon, MIT, full colour), `ui-*.svg` (lucide, ISC, `stroke="#e8eaf2"` baked in). `icons/index.json` = `{ icons: {name→path}, ext_icons, type_default, light }` | 71 files, 76 KB |
| `thumbs/` | `<doc-slug>.png` 480×620 renders of 14 distinct HTML documents (invoice, runbook, slides, sheet, README, design doc w/ diagram, contract, postmortem, policy, release notes…) | 14 files, 313 KB (14–49 KB each) |
| `avatars/` | `<person-slug>.svg` procedural two-tone geometric avatars, hue per team (platform blue, payments amber, data violet, frontend pink), initials centred, 96×96 | 12 files, ~30 KB |
| `models/` | `server.glb database.glb queue.glb folder.glb document.glb laptop.glb cloud.glb` — low-poly flat-colour primitives, ~1 unit tall, origin-centred, facing +Z, 7–39 KB each, verified with GLTFLoader (`_test/models-check.mjs`, `screenshots/models-check.png`). Plus `models/models.js` exporting `buildModel(THREE, typeOrName)` / `BUILDERS` / `TYPE_TO_MODEL` for building the same groups at runtime without a loader | 7 glb + 1 js, 184 KB |

All SVGs render via `<img src>`, `background-image`, SVG `<image href>`, `new Image()` → canvas texture, and inline
`<foreignObject>`. They have no `width/height` dependency issues (viewBox only) except lucide (24×24 given, scales fine).

## 1. Rules for every demo in this group

1. **Nodes are objects, never bare circles.** Each node is drawn as its picture (per precedence above) inside a
   **type-consistent frame** from `meta.type_frames`: `tile` = rounded 14px square (files) with an **extension badge**
   (`.go`, `.ts`… bottom-right, monospace); `page` = portrait rectangle 3:4 with a folded corner showing the thumbnail
   (documents); `circle` = ring in the team colour with the avatar (people); `rack` = wide rounded rectangle with the
   ui icon left, language logo right and a **health dot** (healthy green `#8dff9e`, degraded amber `#ffb347`, down red
   `#ff5f8f`) (services); `cylinder` = pill with a rim line + engine logo (databases); `pipe` = long pill (queues);
   `folder` = tabbed rectangle with GitHub mark + `★ stars` (repos); `cloud` = soft blob/rounded with provider logo.
   Frame fill is the type colour at ~14% alpha over the dark bg, stroke = type colour; the picture sits on a slightly
   lighter well so dark logos remain visible.
2. **Labels are always visible** (screenshot rule): `label` under/inside every frame at ≥ 11px; `sublabel` in muted
   text when zoom ≥ 1 (or always for services/repos/documents). Never rely on hover for identity. Truncate with
   ellipsis at ~18 chars, full text in tooltip.
3. **Relations from `meta.relation_styles`**: colour, width, dash array and arrowhead exactly as given. Data-flow
   relations (`calls reads writes publishes consumes`) are the loud ones; structural/ownership relations (`contains
   owns authored references monitors`) are faint. Where the library supports it, put the relation word on the edge on
   hover only.
4. **Groups**: repos hull/compound their files; teams hull/compound their people + services + repos (`groups[]`).
   A hull is a translucent rounded region in `group.color` at 8–10% with the group label at its top-left. Files never
   stray outside their repo hull.
5. **Hover** enlarges the object ~1.35× (bring to front) and shows a metadata card: picture, label, type, and the
   attrs in this order per type — service: lang · health · owner · repo · rps · deploys_to; database: engine ·
   size_gb; repo: language · stars · files; file: path · ext · loc · repo; document: format · pages · kind · updated ·
   author; person: role · team; cloud: provider. Highlight incident edges; dim the rest to ~0.2.
6. **Click focuses**: zoom/pan so the node and its neighbours fill the view (3D: fly camera). Second click or
   double-click on empty space resets. For a document, clicking the thumbnail opens a larger preview panel (the same
   PNG, ~360px wide) with its `references`/`documents` links listed as chips.
7. **Legend of object kinds** in the HUD: one row per type, drawn with the *actual frame + a sample picture*, not a
   coloured dot (`mountHud({ legend: false })` then append a custom legend into `hud.root`, or pass
   `typeColors` and restyle the swatches). A second legend row lists relation strokes from `relation_styles`.
8. Shared HUD, dark `theme.css` background, full viewport, **H hides the HUD**, `window.__demo = { hud, ... }` for
   the smoke test; pinned CDN URLs (see recipes), one `index.html` (+ optional `main.js`), ≤ ~320 lines.
9. **Density guard**: 92 objects with pictures is roughly the limit for a single 1280×800 screenshot at readable
   size. Every demo ships a toggle **"files inside repos"** (collapse the 30 files into their repo's folder, showing a
   count badge) so the map drops to 62 objects, and a **"pictures / glyphs"** toggle that swaps thumbnails for the
   generic icon for speed comparisons.

## 2. Visual brief

Dark ink bg. Objects are the light: frames ~14% type-colour fill, 1.5px type-colour stroke, soft 6px shadow of the
type colour behind hovered/focused items. Pictures on a slightly lighter well (`rgba(255,255,255,.06)`) so dark brand
marks (GitHub, Vercel, Stripe are baked light already) read. Sizes at zoom 1: service rack 120×44, database pill
96×40, queue pipe 130×32, repo folder 110×56, file tile 44×44 (+badge), document page 54×72 with thumb, person circle
Ø48, cloud 96×44. Labels 11–12px sans, sublabels 10px muted, ext badges 9px mono. Edges thin and luminous; arrowheads
small (6px). Leave room around documents — they are the eye-catchers.

## 3. Load recipes (pinned; smoke test routes CDNs to `_vendor*/`)

```html
<script src="https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/cytoscape@3.34.3/dist/cytoscape.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/layout-base@2.0.1/layout-base.js"></script>
<script src="https://cdn.jsdelivr.net/npm/cose-base@2.2.0/cose-base.js"></script>
<script src="https://cdn.jsdelivr.net/npm/cytoscape-fcose@2.2.0/cytoscape-fcose.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@antv/g6@5.1.1/dist/g6.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/echarts@6.1.0/dist/echarts.min.js"></script>
<script type="importmap">{"imports":{
  "three":"https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js",
  "three/addons/":"https://cdn.jsdelivr.net/npm/three@0.186.0/examples/jsm/",
  "graphology":"https://esm.sh/graphology@0.26.0",
  "graphology-library":"https://esm.sh/graphology-library@0.8.0",
  "graphology-layout-forceatlas2/worker":"https://esm.sh/graphology-layout-forceatlas2@0.10.1/worker",
  "sigma":"https://esm.sh/sigma@3.0.3",
  "@sigma/node-border":"https://esm.sh/@sigma/node-border@3.0.0?deps=sigma@3.0.3",
  "@sigma/node-image":"https://esm.sh/@sigma/node-image@3.0.0?deps=sigma@3.0.3"}}</script>
```
`@sigma/node-image@3.0.0` exists on npm (MIT, peer `sigma >=3.0.0-beta.10`); its ESM build exports
`createNodeImageProgram`, `NodeImageProgram`, `NodePictogramProgram` (verified from the tarball). The `?deps=sigma@3.0.3`
suffix is the same trick `sigma-editorial` already uses so the plugin shares one sigma instance. For the sandbox
smoke test the package is vendored at `_vendor/node_modules/@sigma/node-image/` and a self-contained esbuild bundle
sits at `_vendor/bundles/node-image.js` (same shape as `bundles/node-border.js`); route the esm.sh URL to it the way
the sigma-editorial run did. Three demos: `import { GLTFLoader } from
'three/addons/loaders/GLTFLoader.js'` and `loader.load(asset(sys.meta.type_models[type]))`, or skip the loader and
`import { buildModel } from '../../shared/assets/models/models.js'` (same shapes, zero network).

## 4. The six demos (`demos/<slug>/index.html`)

| slug | library | how the objects are drawn | layout | toggles |
|---|---|---|---|---|
| `d3-object-map` | d3@7.9.0 (SVG) | `<g class=node>` per node: frame `<rect rx>`/`<circle>`, picture as `<image href=asset(...)>` (thumbs, avatars, logos all work in SVG `<image>`); file tiles get a `<text class=badge>` ext badge; service racks get the health `<circle>`; labels `<text>` under the frame. Repo hulls via `d3.polygonHull` of member positions, expanded by 24px, rounded with `d3.curveCatmullRomClosed`. Edges `<path>` with `marker-end` arrowheads coloured per relation (one `<marker>` per relation colour) | `d3.forceSimulation` + `forceCollide(r by frame size)` + `forceX/Y` per type band (cloud top, services middle, data stores below, repos+files right, people+docs left) so the picture has a readable "layers" structure; `forceLink` distance by relation | files-in-repos · pictures/glyphs · relation labels · layers vs free force |
| `cytoscape-icons` | cytoscape@3.34.3 + fcose@2.2.0 | node style `background-image: data(picture)`, `background-fit: contain`, `background-clip: none`, `shape` per frame (`round-rectangle` files/services, `ellipse` people, `rectangle` documents 3:4 with `background-image` thumb, `barrel` databases, `round-tag` repos), `border-color` type colour; `label: data(label)`, `text-valign: bottom`, `text-wrap: ellipsis`; second background image for `logo` (`background-image: [icon, logo]`, `background-position-x: [15%, 85%]`) — cytoscape supports image arrays. Edge style from `relation_styles` via `line-style: dashed` + `line-dash-pattern`, `target-arrow-shape: triangle` | compound nodes: each repo group becomes a parent node containing its files, each team a parent containing people + services + repos (nested compound: repo inside team). `fcose` with `nodeRepulsion` raised and `idealEdgeLength` by relation; `quality:'proof'` | expand/collapse compounds (via `cy.nodes(':parent')` toggling children `display`) · pictures/glyphs · teams as compounds on/off · relation labels |
| `g6-cards` | @antv/g6@5.1.1 | `node.type: 'html'` with `style.innerHTML` returning a **card**: 150×56 (service: icon well + title + `sublabel` + health dot + language logo; repo: folder tab, GitHub mark, `★ stars`; database: cylinder-ish pill; person: avatar circle 40 + name + role; document: 3:4 thumbnail `<img>` on the left, title + `PDF · 42 pp` right; file: 44 tile + name + ext badge). Use `image` node type (`style.src`) for the "glyph" fallback. Edge `type:'polyline'` with `router: { type:'orth' }` in dagre mode, `cubic` in force mode; `endArrow` per relation | `layout: { type:'antv-dagre', rankdir:'LR', nodesep 24, ranksep 90 }` — dependency flow reads left→right (people/docs → repos/services → data stores/cloud); `combo` for repo and team groups (`combo.type:'rect'`); toggle to `d3-force` | dagre / force · combos on/off · files-in-repos · cards / glyphs |
| `sigma-images` | sigma@3.0.3 + @sigma/node-image@3.0.0 + graphology@0.26.0 + forceatlas2@0.10.1 | `nodeProgramClasses: { image: createNodeImageProgram({ padding: 0.15, keepWithinCircle: false, drawingMode: 'color' → use 'background' for thumbs }) }` (check the exported factory name: `createNodeImageProgram`); node attrs `{ type:'image', image: asset(picture), color: typeColor, size }` — logos/avatars/thumbs all as texture-atlased images; `NodeBorderProgram` (also in `@sigma/node-border`? if not vendorable, fake the frame with `color`). Labels `renderLabels: true`, `labelRenderedSizeThreshold: 0` so every label always shows (screenshot rule). Custom `defaultDrawNodeLabel` to add the ext badge. Edge `type:'arrow'`, colour/size from `relation_styles` (WebGL edges cannot dash: encode dashed relations by lower alpha + thinner) | `forceAtlas2.assign(graph, { iterations: 400, settings: { gravity: 1, scalingRatio: 8, barnesHutOptimize: true } })` then `nodeReducer` for hover dimming | pictures/glyphs · labels density (all / hubs) · files-in-repos · edge arrows |
| `echarts-image-symbols` | echarts@6.1.0 | `series:[{ type:'graph', layout:'force', data: nodes.map(n => ({ symbol: 'image://' + asset(picture), symbolSize: sizeByType, label: { show:true, position:'bottom', formatter } , itemStyle: { borderColor: typeColor, borderWidth: 2, borderRadius? (n/a for image) } }))` — documents get `symbolSize: [54, 72]` with the thumbnail, people `[48, 48]` avatar, files `[40, 40]` icon, services `[110, 44]` a **pre-composed canvas card** (draw frame + icon + logo + health dot to an offscreen canvas → `image://` dataURL; cache per node); `edgeSymbol: ['none','arrow']`, `lineStyle: { color, width, type: dash ? 'dashed' : 'solid' }` per link from `relation_styles`; `categories` for the legend but replace legend icons with `'image://'` too; `emphasis.focus:'adjacency'`; `roam:true` | `force: { repulsion: 420, edgeLength: [60, 160], gravity: 0.08 }`; toggle `layout:'circular'` grouped by type | force / circular · cards / glyphs · files-in-repos · labels |
| `three-objects-3d` | three@0.186.0 (import map) | Each node = the `.glb` from `meta.type_models` via `GLTFLoader` (load 7 once, `clone()` per node; `SkeletonUtils` not needed), or `buildModel(THREE, type)` from `models/models.js` when a toggle says "procedural". Logos/avatars: `new THREE.TextureLoader().load(asset(logo))` (SVG loads fine as an image texture at 128px via an `Image` → canvas rasterise; rasterise SVGs to canvas first to control size) applied to a small `PlaneGeometry` decal on the front of the rack/cylinder/folder; **documents = sprite plane with the thumbnail** (`PlaneGeometry(0.8, 1.05)` + `MeshBasicMaterial({ map: thumb })`) standing on the document stack; person = laptop with the avatar on the screen plane. Edges `TubeGeometry` along a `CatmullRomCurve3` with a slight arc, radius by `relation_styles.width × 0.02`, colour from relation, arrow = small `ConeGeometry` at the target; dashed relations as `LineDashedMaterial` lines instead of tubes. Labels = canvas-text `Sprite`s above every object, always visible (`sizeAttenuation: true`, min scale clamp in the render loop) | positions from a 3D force pre-pass (run `d3-force` in 2D for x/z and set y by type band: cloud y=+3, services 0, data stores −2, repos/files/docs/people spread ±1) — computed once, no live sim; `OrbitControls` with damping, auto-rotate off by default; raycast hover (enlarge 1.3× + card in HUD); click → `gsap`-free lerp of camera to frame the object + neighbours; **"Export scene as glTF"** button: `new GLTFExporter().parse(scene, blob => download)` (optional) | glb / procedural · thumbnails on/off · labels · auto-rotate · export glTF |

Picture helper every 2D demo should share (inline, ~10 lines): `pictureFor(n) → n.thumb || n.avatar || n.logo || n.icon`,
`frameFor(n) → sys.meta.type_frames[n.type]`, `sizeFor(n)` from the table in §2, `healthColor(n.health)`.

## 5. What to compare across the six

- **Recognisability at a glance**: with the HUD hidden, can a newcomer name the object kinds and the specific
  technologies (Go vs Rust service, Postgres vs Redis, invoice vs runbook) without reading labels? Score each demo
  on how many of the 8 kinds are identifiable from the picture alone; note where the frame carries it vs the logo.
- **Screenshot legibility**: take the 1280×800 smoke screenshot; are all 92 labels readable, do any overlap the
  pictures, do the document thumbnails still read as *those* documents at ~54×72? Which demos need
  "files-in-repos" on to stay legible?
- **Density before it clutters**: how many picture-nodes fit before overlap makes the map unreadable — try the
  full 92, then collapsed 62, then note the ceiling each renderer hits (SVG `<image>` count, Cytoscape image cache,
  Sigma texture atlas size, ECharts image symbols per frame, three.js draw calls / sprite count).
- Also: load time with ~100 image fetches (are they cached across toggles?), hover/focus smoothness, and how much
  code the rich node cost (G6 HTML cards vs D3 hand-drawn frames vs Cytoscape CSS-like style).
