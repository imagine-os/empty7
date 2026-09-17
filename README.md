# Graph Gallery

Fifteen live demos of graph visualization libraries in two groups, each group rendering **one shared dataset** with the same type colours and the same basic interactions, so the libraries can be compared on equal footing and we can pick the ones worth leading with.

1. **Network views** (9 demos): a fictional film-studio catalog (85 nodes, 361 links: studios, films, people, genres and awards) as a force-directed network.
2. **Structured views** (6 demos): a fictional company org tree (189 nodes: company, departments, projects and typed leaves) drawn so that every department branch stays in its own lane or sector.

Live site: https://imagine-os.github.io/empty7/

The landing page (`index.html`) has one card grid per group (the network grid is ranked by the shortlist in [`research.md`](research.md)), followed by a comparison table (including the commercial and licence-restricted libraries that were surveyed but not demoed) and a short list of findings. [`plan.md`](plan.md) holds the per-demo visual briefs for the network group; [`plan-structured.md`](plan-structured.md) holds the dataset spec, rules and briefs for the structured group.

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

### The org dataset

`shared/org.json` describes the fictional company **Northwind Labs**: 1 company, 6 departments (Engineering, Design, Marketing, Sales, Operations, Finance), 21 projects and 161 typed leaves (52 skills, 34 agents, 33 templates, 42 tools), 189 nodes and 188 parent-child links in total. It carries the tree in three forms so any library can consume it directly: `tree` (nested `children`), a flat `nodes` list (with `type`, `department`, `parent`, `depth`, plus `level` on skills and `status` on agents) and a flat `links` list. `meta.type_colors` and `meta.type_shapes` give the shared colour and shape per type; `meta.departments` fixes the department order that the six accent hues follow.

Demos load it through `loadOrg()` in `shared/hud.js`, which indexes the nodes (`byId`, `childrenOf`, `deptOf`) and attaches `.color` to every node and `.hue` (the department accent) to each department.

The file is generated, not hand-edited. To regenerate it (Python 3, standard library only, deterministic seed 7):

```
python3 shared/build-org.py
```

## Layout

```
index.html            landing: two card grids, comparison table, findings
shared/
  data.json           network dataset (nodes, links, meta.type_colors)
  build-data.py       regenerates data.json from demos/studio-graph/seed.sql
  org.json            structured dataset (tree, nodes, links, meta)
  build-org.py        regenerates org.json (stdlib only, seed 7)
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
```

## Run locally

Everything is static and uses relative paths, so there is no build step. Serve the repo root with any static server and open the landing page:

```
python3 -m http.server 8000
# then open http://localhost:8000/
```

A plain `file://` open will not work: the demos `fetch()` `shared/data.json` or `shared/org.json` and load their libraries as ES modules from public CDNs.

## Add a demo

1. Create `demos/<slug>/index.html`. Start with a head comment listing the library version and every CDN URL, link `../../shared/theme.css`, and import `mountHud` and `tooltipHtml` plus `loadData` (network group) or `loadOrg` (structured group) from `../../shared/hud.js` so the colours, legend, toggles and tooltip match the other demos.
2. Network group: colour nodes from `data.meta.type_colors` and edges with `linkColor(link)` (gold for wins, role tints, faint structural edges); size nodes from the shared `node.size`. Structured group: fill nodes with `node.color`, pick the shape from `org.meta.type_shapes`, tint branch edges with the department's `.hue`, and keep the six departments in separate sectors or lanes (see `plan-structured.md`).
3. Capture `thumb.jpg` at 1280x800 (press `H` first to hide the HUD) and drop it in the folder.
4. Copy an `<article class="card">` block from the matching grid in `index.html`, point it at the new folder, and (network group) add a row to the comparison table.

## CDN URLs

Every library is loaded from a public CDN (jsDelivr, unpkg or esm.sh) at an **exact pinned version**. The demos were built in a sandbox where those CDNs were blocked, so the URLs were derived from the npm tarballs rather than fetched. Open each demo once on a machine with normal internet access to confirm they resolve; the URLs are listed in each demo's head comment and in `research.md`.

## Deployment

The site is served by GitHub Pages from the `main` branch, root folder. `.nojekyll` makes Pages serve the files exactly as committed.
