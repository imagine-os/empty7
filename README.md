# Graph Gallery

Twenty-two live demos of graph visualization libraries in three groups, each group rendering **one shared dataset** with the same type colours and the same basic interactions, so the libraries can be compared on equal footing and we can pick the ones worth leading with.

1. **Network views** (9 demos): a fictional film-studio catalog (85 nodes, 361 links: studios, films, people, genres and awards) as a force-directed network.
2. **Structured views** (6 demos + the featured executive view): a fictional company org tree (189 nodes: company, departments, projects and typed leaves) drawn so that every department branch stays in its own lane or sector, plus the **Business Sunburst**, a 554-node business model with KPIs and drill-down.
3. **Object views** (6 demos): the same company's system map (92 objects, 188 relations: services, databases, queues, repos, files, documents, people, cloud) where every node is drawn as the thing itself: brand or language logo, file icon with extension badge, document thumbnail, avatar, or a 3D model.

Live site: https://imagine-os.github.io/empty7/

The landing page (`index.html`) has one card grid per group (the network grid is ranked by the shortlist in [`research.md`](research.md)), followed by a comparison table (including the commercial and licence-restricted libraries that were surveyed but not demoed) and a short list of findings. [`plan.md`](plan.md) holds the per-demo visual briefs for the network group; [`plan-structured.md`](plan-structured.md) holds the dataset spec, rules and briefs for the structured group; [`plan-objects.md`](plan-objects.md) holds the system-map dataset spec, the asset table, the drawing rules and the briefs for the object group.

## Group 1: network views (film-studio dataset)

| # | Demo | Folder | Library (pinned) | Renderer | Licence |
|---|---|---|---|---|---|
| 01 | Nebula | `demos/three-nebula/` | three.js 0.186.0 + d3-force-3d 3.0.6 (custom scene, InstancedMesh + UnrealBloom) | WebGL 3D | MIT |
| 02 | Living Galaxy | `demos/cosmos-galaxy/` | cosmos.gl `@cosmos.gl/graph` 3.4.1 | GPU 2D (WebGL2) | MIT |
| 03 | Constellation | `demos/force3d-bloom/` | 3d-force-graph 1.80.0 + three-spritetext 1.10.0 | WebGL 3D | MIT |
| 04 | Editorial Dark | `demos/sigma-editorial/` | Sigma.js 3.0.3 + graphology 0.26.0 (+ `@sigma/edge-curve`, `@sigma/node-border`) | WebGL 2D | MIT |
| 05 | G6 Studio | `demos/g6-studio/` | AntV G6 5.1.1 (+ g6-extension-3d 0.1.23) | Canvas 2D | MIT |
| 06 | ECharts Neon | `demos/echarts-neon/` | Apache ECharts 6.1.0 + echarts-gl 2.1.0 | Canvas 2D (+ graphGL WebGL) | Apache-2.0 |
| 07 | Blueprint | `demos/cytoscape-blueprint/` | Cytoscape.js 3.34.3 + cytoscape-fcose 2.2.0 | Canvas 2D | MIT |
| 08 | Ink & Neon | `demos/d3-ink/` | D3 7.9.0 (d3-force, d3-zoom, d3-drag; hand-drawn Canvas) | Canvas 2D | ISC |
| 09 | Studio Graph | `demos/studio-graph/` | 3d-force-graph + sql.js 1.10.3 (the SQL-driven original) | WebGL 3D | MIT |

Press `H` inside any demo except Studio Graph to hide the HUD for a clean screenshot.

## Group 2: structured views (department tree)

Same idea, different shape: one root, six department branches that never touch, projects under each department, typed leaves under the projects. Every demo is a *tree* layout of `shared/org.json`, with a visible gap between departments, node type shown by shape + colour + HUD legend, and the department shown as an accent hue on the branch edges. Skills carry a 1–5 `level`, agents a `status` (live / pilot / idea). Things to compare: separation clarity, type legibility at leaf size, and how each layout would cope with 1000+ leaves.

| # | Demo | Folder | Library (pinned) | Renderer | Licence |
|---|---|---|---|---|---|
| 10 | Radial Tree | `demos/radial-tree-d3/` | D3 7.9.0 (d3-hierarchy tree per department sector, d3-shape, d3-zoom) | SVG | ISC |
| 11 | Lanes Skill-tree | `demos/lanes-skilltree/` | D3 7.9.0 (one swimlane per department, left-to-right tech tree) | SVG | ISC |
| 12 | Radial 3D | `demos/three-radial-3d/` | three.js 0.186.0 (OrbitControls, UnrealBloom, InstancedMesh glyphs) | WebGL 3D | MIT |
| 13 | Mindmap | `demos/g6-mindmap/` | AntV G6 5.1.1 (mindmap / dendrogram / compact-box layouts) | Canvas 2D | MIT |
| 14 | ECharts Radial Tree | `demos/echarts-radial-tree/` | Apache ECharts 6.1.0 (`series.type: 'tree'`, radial and orthogonal) | Canvas 2D | Apache-2.0 |
| 15 | Sunburst | `demos/sunburst-d3/` | D3 7.9.0 (d3-hierarchy partition, zoomable) | SVG | ISC |

### Featured: the executive view

| Demo | Folder | Library (pinned) | Renderer | Licence |
|---|---|---|---|---|
| Business Sunburst | `demos/sunburst-business/` | D3 7.9.0 (d3-hierarchy partition, d3-shape arc, d3-scale diverging, d3-transition) | SVG | ISC |

`shared/business.json` as a zoomable sunburst: **554 nodes, 6 levels** (company, business units, product lines / departments, products / teams, sub-products / services, offerings). Arc angle is the size metric (revenue, cost, headcount, customers, or equal); fill is the unit hue or a diverging scale by margin, growth, stage or health. Click an arc to drill down (750 ms tween, `Esc` backs out one level, double-click empty space resets), type in the search box to jump to a match, and the quick filters light up the top-10 revenue makers or the loss-makers. The side panel shows the focused arc's KPIs (revenue, cost, margin, growth YoY, headcount, customers, health, revenue per FTE, descendants) with a 12-month sparkline, the lowest-margin and fastest-growing descendants, and the children ranked by revenue. It sits at the top of the structured grid on the landing page with a "Featured" badge.

### The org dataset

`shared/org.json` describes the fictional company **Northwind Labs**: 1 company, 6 departments (Engineering, Design, Marketing, Sales, Operations, Finance), 21 projects and 161 typed leaves (52 skills, 34 agents, 33 templates, 42 tools), 189 nodes and 188 parent-child links in total. It carries the tree in three forms so any library can consume it directly: `tree` (nested `children`), a flat `nodes` list (with `type`, `department`, `parent`, `depth`, plus `level` on skills and `status` on agents) and a flat `links` list. `meta.type_colors` and `meta.type_shapes` give the shared colour and shape per type; `meta.departments` fixes the department order that the six accent hues follow.

Demos load it through `loadOrg()` in `shared/hud.js`, which indexes the nodes (`byId`, `childrenOf`, `deptOf`) and attaches `.color` to every node and `.hue` (the department accent) to each department.

The file is generated, not hand-edited. To regenerate it (Python 3, standard library only, deterministic seed 7):

```
python3 shared/build-org.py
```

### The business dataset

`shared/business.json` describes the **Northwind Labs** business model: 1 company, 4 business units (Platform, Enterprise, Consumer, Services), 12 product lines and 6 departments, 40 products and 18 teams, 122 sub-products and 47 services, 304 offerings (regions, segments, channels, revenue streams, features), 554 nodes in total. Every node carries `revenue`, `cost`, `margin`, `growth`, `headcount`, `customers`, `health`, `stage` (core / growth / incubate / sunset) and `owner`; parents aggregate their children. `meta.kpis` gives the label, unit and number format per KPI, `meta.unit_hues` and `meta.stage_colors` the palettes, `meta.thresholds` the company-level margin and growth that the diverging colour scales pivot on.

The file is generated, not hand-edited (Python 3, standard library only, deterministic seed 11):

```
python3 shared/build-business.py
```

## Group 3: object views (system map)

Every node is drawn as the object it is, never as a bare circle: a service is a rack with its language logo and a health dot, a database a pill with the engine logo, a repo a folder with the GitHub mark and star count, a file a tile with its language icon and an `.ext` badge, a document a page showing its own thumbnail, a person an avatar ring, a cloud its provider's mark, and in 3D each of them is a small glTF model. Labels are always visible so a screenshot reads as a map. Every demo ships a "files inside repos" toggle (folds the 30 files into their repo folders, 92 objects become 62) and a "pictures" toggle (swaps pictures for generic glyphs). Things to compare: recognisability at a glance with the HUD hidden, screenshot legibility at 1280x800, and how many picture-nodes fit before the map clutters.

| # | Demo | Folder | Library (pinned) | Renderer | Licence |
|---|---|---|---|---|---|
| 16 | Object Map | `demos/d3-object-map/` | D3 7.9.0 (d3-force, d3-zoom, d3-drag, d3-polygon; hand-built SVG frames and `<image>`) | SVG | ISC |
| 17 | Images | `demos/sigma-images/` | Sigma.js 3.0.3 + `@sigma/node-image` 3.0.0 + graphology 0.26.0 + graphology-layout-forceatlas2 0.10.1 | WebGL 2D | MIT |
| 18 | Icons | `demos/cytoscape-icons/` | Cytoscape.js 3.34.3 + cytoscape-fcose 2.2.0 (background-image nodes, nested compounds) | Canvas 2D | MIT |
| 19 | Object Cards | `demos/g6-cards/` | AntV G6 5.1.1 (`html` nodes as DOM cards, antv-dagre / d3-force, rect combos) | Canvas 2D + HTML | MIT |
| 20 | Objects 3D | `demos/three-objects-3d/` | three.js 0.186.0 (GLTFLoader, OrbitControls, GLTFExporter) | WebGL 3D | MIT |
| 21 | Image Symbols | `demos/echarts-image-symbols/` | Apache ECharts 6.1.0 (`series.type: 'graph'`, `image://` symbols composed offscreen) | Canvas 2D | Apache-2.0 |

### The system dataset

`shared/system.json` is the **Northwind Labs** system map: **92 nodes, 188 links, 12 groups** (12 services, 6 databases, 2 queues, 8 repos, 30 files, 14 documents, 12 people, 8 cloud providers). Links carry a `relation` (`calls`, `reads`, `writes`, `publishes`, `consumes`, `contains`, `documents`, `references`, `owns`, `authored`, `deploys_to`, `monitors`) and `meta.relation_styles` fixes the colour, width, dash and arrowhead per relation. Every node names its pictures relative to `meta.asset_root` (`../../shared/assets/`): `icon` (generic glyph), `logo` (brand or language mark), `thumb` (documents), `avatar` (people); `meta.type_frames` gives the frame shape per type, `meta.type_models` the glTF model, `meta.ext_icons` the icon per file extension. `groups` lists the repo groups (a repo and its files) and the team groups (people, services and repos) for hulls and compounds.

The file is generated, not hand-edited (Python 3, standard library only, deterministic seed 11):

```
python3 shared/build-system.py
```

### Assets

`shared/assets/` holds everything the object demos draw, all local, nothing fetched from an image host at runtime (about 900 KB):

- `icons/` (71 SVGs): `brand-*.svg` from simple-icons (CC0), `lang-*.svg` and `brand-aws.svg` from devicon (MIT), `ui-*.svg` from lucide (ISC), each with a fill or stroke colour baked in so it renders standalone on a dark page; `icons/index.json` indexes them.
- `thumbs/` (14 PNGs, 480x620): page renders of fictional documents (invoice, runbook, slides, sheet, README, design doc, contract, postmortem, policy, release notes).
- `avatars/` (12 SVGs): procedural two-tone avatars with initials, hue per team; no real people.
- `models/` (7 glTF binaries + `models.js`): low-poly server, database, queue, folder, document, laptop and cloud, plus a `buildModel(THREE, type)` helper that builds the same shapes at runtime without a loader.

[`shared/assets/LICENSES.md`](shared/assets/LICENSES.md) lists the source package, version and licence of every third-party file, with the trademark caveat for the brand marks. Thumbnails, avatars and models are our own generated files (CC0).

## Layout

```
index.html            landing: three card grids (+ the featured executive view), comparison table, findings
shared/
  data.json           network dataset (nodes, links, meta.type_colors)
  build-data.py       regenerates data.json from demos/studio-graph/seed.sql
  org.json            structured dataset (tree, nodes, links, meta)
  build-org.py        regenerates org.json (stdlib only, seed 7)
  business.json       business-model dataset for the sunburst (554 nodes with KPIs)
  build-business.py   regenerates business.json (stdlib only, seed 11)
  system.json         system-map dataset for the object group (92 nodes, 188 links, groups, asset paths)
  build-system.py     regenerates system.json (stdlib only, seed 11)
  assets/             icons/, thumbs/, avatars/, models/ used by the object demos; LICENSES.md
  theme.css           shared dark chrome: HUD panels, legend, pills, tooltip, back link
  hud.js              ES module: loadData(), loadOrg(), linkColor(), mountHud(), tooltipHtml()
  stress.js           seeded synthetic stress graph for the GPU demos
demos/<slug>/
  index.html          the demo (head comment lists the exact CDN URLs it uses)
  main.js             optional, scene code for the larger demos
  thumb.jpg           1280x800 card thumbnail
screenshots/          full-size captures of each demo
research.md           library survey: comparison table, licences, CDN recipes, verdicts
plan.md               network group: dataset spec, per-demo visual briefs, build order
plan-structured.md    structured group: org dataset spec, rules, per-demo briefs
plan-objects.md       object group: system dataset spec, asset table, drawing rules, per-demo briefs
```

## Run locally

Everything is static and uses relative paths, so there is no build step. Serve the repo root with any static server and open the landing page:

```
python3 -m http.server 8000
# then open http://localhost:8000/
```

A plain `file://` open will not work: the demos `fetch()` a dataset from `shared/` (`data.json`, `org.json`, `system.json` or `business.json`) and load their libraries as ES modules from public CDNs.

## Add a demo

1. Create `demos/<slug>/index.html`. Start with a head comment listing the library version and every CDN URL, link `../../shared/theme.css`, and import `mountHud` and `tooltipHtml` plus `loadData` (network group) or `loadOrg` (structured group) from `../../shared/hud.js` so the colours, legend, toggles and tooltip match the other demos. Object group: `fetch('../../shared/system.json')` and prefix every picture path with `meta.asset_root`.
2. Network group: colour nodes from `data.meta.type_colors` and edges with `linkColor(link)` (gold for wins, role tints, faint structural edges); size nodes from the shared `node.size`. Structured group: fill nodes with `node.color`, pick the shape from `org.meta.type_shapes`, tint branch edges with the department's `.hue`, and keep the six departments in separate sectors or lanes (see `plan-structured.md`). Object group: draw every node as its picture (`thumb`, then `avatar`, then `logo`, then `icon`) inside the frame from `meta.type_frames`, style edges from `meta.relation_styles`, keep labels always on, and ship the "files inside repos" and "pictures" toggles (see `plan-objects.md`).
3. Capture `thumb.jpg` at 1280x800 (press `H` first to hide the HUD) and drop it in the folder.
4. Copy an `<article class="card">` block from the matching grid in `index.html`, point it at the new folder, and (network group) add a row to the comparison table.

## CDN URLs

Every library is loaded from a public CDN (jsDelivr, unpkg or esm.sh) at an **exact pinned version**. The demos were built in a sandbox where those CDNs were blocked, so the URLs were derived from the npm tarballs rather than fetched. Open each demo once on a machine with normal internet access to confirm they resolve; the URLs are listed in each demo's head comment and in `research.md`.

## Deployment

The site is served by GitHub Pages from the `main` branch, root folder. `.nojekyll` makes Pages serve the files exactly as committed.
