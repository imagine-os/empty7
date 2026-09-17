# Graph Gallery

Nine live demos of graph visualization libraries, all rendering the **same fictional film-studio dataset** (85 nodes, 361 links: studios, films, people, genres and awards) with the same type colours and the same basic interactions, so the libraries can be compared on equal footing and we can pick the ones worth leading with.

Live site: https://imagine-os.github.io/empty7/

The landing page (`index.html`) is a card grid ranked by the shortlist in [`research.md`](research.md), followed by a comparison table (including the commercial and licence-restricted libraries that were surveyed but not demoed) and a short list of findings. [`plan.md`](plan.md) holds the per-demo visual briefs and the build plan.

## Demos

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

Press `H` inside any of demos 01–08 to hide the HUD for a clean screenshot.

## Layout

```
index.html            landing: cards, comparison table, findings
shared/
  data.json           the shared dataset (nodes, links, meta.type_colors)
  build-data.py       regenerates data.json from demos/studio-graph/seed.sql
  theme.css           shared dark chrome: HUD panels, legend, pills, tooltip, back link
  hud.js              ES module: loadData(), linkColor(), mountHud(), tooltipHtml()
  stress.js           seeded synthetic stress graph for the GPU demos
demos/<slug>/
  index.html          the demo (head comment lists the exact CDN URLs it uses)
  main.js             optional, scene code for the larger demos
  thumb.jpg           1280x800 card thumbnail
screenshots/          full-size captures of each demo
research.md           library survey: comparison table, licences, CDN recipes, verdicts
plan.md               dataset spec, per-demo visual briefs, build order
```

## Run locally

Everything is static and uses relative paths, so there is no build step. Serve the repo root with any static server and open the landing page:

```
python3 -m http.server 8000
# then open http://localhost:8000/
```

A plain `file://` open will not work: the demos `fetch()` `shared/data.json` and load their libraries as ES modules from public CDNs.

## Add a demo

1. Create `demos/<slug>/index.html`. Start with a head comment listing the library version and every CDN URL, link `../../shared/theme.css`, and import `loadData`, `mountHud`, `linkColor` and `tooltipHtml` from `../../shared/hud.js` so the colours, legend, toggles and tooltip match the other demos.
2. Colour nodes from `data.meta.type_colors` and edges with `linkColor(link)` (gold for wins, role tints, faint structural edges). Size nodes from the shared `node.size` (proportional to the square root of degree).
3. Capture `thumb.jpg` at 1280x800 (press `H` first to hide the HUD) and drop it in the folder.
4. Copy an `<article class="card">` block in `index.html`, point it at the new folder, and add a row to the comparison table.

## CDN URLs

Every library is loaded from a public CDN (jsDelivr, unpkg or esm.sh) at an **exact pinned version**. The demos were built in a sandbox where those CDNs were blocked, so the URLs were derived from the npm tarballs rather than fetched. Open each demo once on a machine with normal internet access to confirm they resolve; the URLs are listed in each demo's head comment and in `research.md`.

## Deployment

The site is served by GitHub Pages from the `main` branch, root folder. `.nojekyll` makes Pages serve the files exactly as committed.
