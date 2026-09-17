# Graph Gallery — group 2: "Structured" (department tree) demos

Justin's brief: *"branching patterns … each in their own lanes: treeing and branching out. A circle with
different branches jutting out of the circle in their own directions but separate … I want more of that
rather than giant clusters where everything is jumbled together. I want to see the type as well."*

So: **one root, six department branches that never touch, sub-branches per project, typed leaves.**
Not a force cluster. Every demo below is a *tree* layout of the same `shared/org.json`.

## 0. Dataset (`shared/org.json`, from `shared/build-org.py`, seed 7 — do not hand-edit)

Company "Northwind Labs" → 6 departments (Engineering, Design, Marketing, Sales, Operations, Finance)
→ 21 projects (3–4 each) → typed leaves under projects **and** directly under departments.
189 nodes / 188 `child` links: company 1, department 6, project 21, skill 52, agent 34, template 33, tool 42.

```jsonc
{ "meta": { "type_colors": { "company":"#ffffff","department":"#f5b642","project":"#ff5f8f",
                             "skill":"#5ec8ff","agent":"#8dff9e","template":"#e6c3ff","tool":"#4fd1c5" },
            "type_shapes": { "company":"circle","department":"hexagon","project":"square",
                             "skill":"circle","agent":"diamond","template":"triangle","tool":"wrench-or-star" },
            "counts": {...}, "departments": ["dept:eng","dept:design","dept:mkt","dept:sales","dept:ops","dept:fin"] },
  "tree":  { "id":"company:root","type":"company","label":"Northwind Labs","children":[ ... nested ... ] },
  "nodes": [ { "id":"skill:eng-rust","type":"skill","label":"Rust","department":"dept:eng",
               "parent":"proj:eng-platform","depth":3,"level":2 },
             { "id":"agent:eng-code-review-agent","type":"agent", ..., "status":"live" } ],
  "links": [ { "source":"dept:eng","target":"proj:eng-platform","relation":"child" } ] }
```
Skills carry `level` 1–5 (how developed); agents carry `status` live | pilot | idea.
Ids: `company:root`, `dept:eng`, `proj:eng-platform`, `skill:eng-rust`, `tool:mkt-figma` …

Loader (in `shared/hud.js`, non-breaking addition):
```js
import { loadOrg, mountHud, tooltipHtml, DEPT_HUES } from '../../shared/hud.js';
const org = await loadOrg();            // loadOrg(url = '../../shared/org.json')
// → { meta, tree, nodes, links, byId: Map, childrenOf: Map<id, id[]>, deptOf(id) → department node | null }
// every node: .color = meta.type_colors[type]; department nodes: .hue = distinct accent (DEPT_HUES, 6 colours)
```
Department accents (`DEPT_HUES`, in `meta.departments` order): Engineering `#ff7a45`, Design `#ffd166`,
Marketing `#4fd1c5`, Sales `#5ec8ff`, Operations `#b48cff`, Finance `#ff5f8f`.
Use `d3.hierarchy(org.tree)` for D3 demos; ECharts/G6 take the nested `tree` directly (map `children`).

## 1. Rules for every demo in this group

1. **Separation first.** The six department branches occupy their own sector / lane / direction with a
   visible gap between them (gap wedges, lane gutters, angular spacing). No two departments' leaves may
   interleave. Projects fan out from their department; leaves fan out from their project (or department).
2. **Type is visible three ways:** shape (`meta.type_shapes`: hexagon dept, square project, circle skill,
   diamond agent, triangle template, star/wrench tool), colour (`meta.type_colors`), and the HUD legend
   (`mountHud({ typeColors: org.meta.type_colors })`). Skills additionally show `level` (1–5 rings/ticks or
   size); agents show `status` (live = solid, pilot = dashed ring, idea = hollow / dim).
3. **Department accent tints the branch edges** (`dept.hue`), so a branch reads as one limb even though its
   nodes are typed by colour. Node fill = type colour; edge stroke = department hue at ~0.55 alpha; a soft
   glow/halo of the hue behind the department node.
4. **Hover**: tooltip with `label`, **type**, and the path from the company
   (`Northwind Labs › Engineering › Platform › Rust`), plus `level` / `status` when present. Highlight the
   node's ancestor path; dim other branches to ~0.25.
5. **Click** a department/project: focus (zoom/fly so the branch fills the view) or collapse/expand it
   (second click on a focused node collapses). Double-click empty space: reset to the full tree.
6. **Animated unfurl from the root**: on load the company appears, then departments grow outward, then
   projects, then leaves (~1.8 s total, staggered by depth; edges draw along their length).
7. Shared HUD via `mountHud` (title, library, version, legend, 2–4 toggles, FPS); **H hides the HUD**
   (already built into `mountHud`). Full-viewport, dark background from `shared/theme.css`.
8. Same constraints as group 1: one `index.html` (+ optional `main.js`), pinned CDN URLs, ≤ ~300 lines,
   `fetch('../../shared/org.json')` via `loadOrg()`.

## 2. Visual brief

Dark ink background (`theme.css`). Thin luminous edges, tinted by department, thickest near the root and
tapering toward leaves (width by depth: 3 → 2 → 1.2 → 0.8). Nodes small at the leaves (r 4–6), projects
r 8, departments r 14 with a hue halo, company r 22 white with a soft bloom. Labels: departments always
(sans, caps, letter-spaced), projects always, leaves on hover or when zoomed in (or when a branch is
focused). Leave generous negative space between branches — the gaps are the point.

## 3. Load recipe (pinned, verified versions from research.md)

```html
<script src="https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js"></script>          <!-- global d3 -->
<script src="https://cdn.jsdelivr.net/npm/echarts@6.1.0/dist/echarts.min.js"></script><!-- global echarts -->
<script src="https://cdn.jsdelivr.net/npm/@antv/g6@5.1.1/dist/g6.min.js"></script>    <!-- global G6 -->
<script type="importmap">{"imports":{
  "three":"https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js",
  "three/addons/":"https://cdn.jsdelivr.net/npm/three@0.186.0/examples/jsm/"}}</script>
```
Smoke test: `node _test/run.mjs <slug> <vendorDir>` (routes CDN URLs to local tarballs; see `_test/run.mjs`).

## 4. The six demos (`demos/<slug>/index.html`)

| slug | library | layout idea | toggles |
|---|---|---|---|
| `radial-tree-d3` | d3@7.9.0 | `d3.tree().size([2π, R])` on `d3.hierarchy(org.tree)`; custom `.separation()` that adds a gap wedge (≈ 14°) between sibling departments so each department owns a clean sector; `d3.linkRadial` edges tinted by `dept.hue`; leaves drawn with `d3.symbol` (`symbolCircle/Diamond/Triangle/Square/Star`) coloured by type; department arc labels along the sector (textPath); click department to collapse/expand (`node.children ↔ node._children`) with tweened re-layout | labels on/off · gaps wide/narrow · level rings · collapse all |
| `lanes-skilltree` | d3@7.9.0 (SVG or Canvas) | One horizontal **lane per department** (lane header at left with the hue), tech-tree left→right: column = depth (dept → project → leaf), rows packed with `d3.tree().nodeSize` per lane so lanes never overlap; curved `d3.linkHorizontal` connectors; skills show 1–5 level rings (or a 5-tick meter), agents a status badge (live/pilot/idea); leaves that hang directly off the department sit in the project column as a "general" cluster | compact/expanded rows · show levels · show status · lane dividers |
| `echarts-radial-tree` | echarts@6.1.0 | `series:[{type:'tree', layout:'radial', data:[tree], symbolSize by depth, expandAndCollapse:true, initialTreeDepth:2}]`; `symbol` per type (`circle/diamond/triangle/rect/pin`); department-tinted lines by setting `lineStyle.color` on each department subtree's nodes (ECharts colours the edge from the child's `lineStyle`); `roam:true`; tooltip formatter builds the path; toggle `layout:'radial'` ↔ `'orthogonal'` (`orient:'LR'`) via `setOption` (animated) | radial/orthogonal · expand all · labels · glow (`shadowBlur`) |
| `g6-mindmap` | @antv/g6@5.1.1 | `layout:{type:'mindmap', direction:'H', getSide: dept index < 3 ? 'left' : 'right'}` so three departments jut left, three right; `node.type` by node type (`circle/diamond/triangle/rect/star`), `style.fill` type colour, `stroke` dept hue; `edge.type:'cubic-horizontal'` with `stroke` dept hue; behaviours `collapse-expand`, `drag-canvas`, `zoom-canvas`, `hover-activate`; toggles switch `layout.type` to `dendrogram` (radial: `radial:true`) and `compact-box` with animated transition | mindmap / dendrogram(radial) / compact-box · collapse all · labels |
| `three-radial-3d` | three@0.186.0 (import map) | Company sphere at origin (white, emissive); six department directions spread over a sphere with ≥ 60° separation (e.g. Fibonacci points or ±X ±Y ±Z tilted); each department branch = a `TubeGeometry` limb along its direction, projects as sub-branches inside a cone (half-angle ≈ 18°) around it, leaves as `InstancedMesh` glyphs (sphere/octahedron/tetrahedron/box/star) per type, coloured by type; tube edges tinted by `dept.hue`; `UnrealBloomPass` gentle (strength 0.6); `OrbitControls` auto-rotate; raycast hover tooltip; click a department to fly the camera in (lerp position/target over 1.2 s); unfurl by scaling limbs from the root | bloom · auto-rotate · labels (sprites) · type glyphs / plain spheres |
| `sunburst-d3` | d3@7.9.0 | `d3.partition().size([2π, R])` on `d3.hierarchy(org.tree).sum(() => 1)`; ring depth = hierarchy (departments inner ring, projects, leaves outer); arcs filled with the **type** colour and stroked on the outer border with the **department** hue; small angular gap (`padAngle`) between department sectors; hover shows breadcrumb path in the HUD + tooltip; click a department to zoom it to a full circle (Bostock zoomable sunburst tween), click centre to zoom out; type glyph drawn at each leaf arc's centroid | glyphs · labels · pad gaps · centre summary |

Common shape ↔ type mapping (2D symbol names): company circle · department hexagon (draw as `d3.symbol`
with a custom hexagon path, or a circle with a thick ring where the library cannot) · project square ·
skill circle · agent diamond · template triangle · tool star (the "wrench-or-star" — star is fine).

## 5. What to compare across the six

- **Separation clarity**: can you tell the six departments apart at a glance and follow one branch outward
  without crossing another? (Radial tree and 3D risk crowding at the leaf ring; lanes and mindmap are
  structurally immune; sunburst never crosses but hides leaf identity.)
- **Type legibility**: are shape + colour readable at leaf size, and do skill level / agent status survive?
  (Lanes best; ECharts/G6 symbols acceptable; 3D needs hover.)
- **Scalability to 1000+ leaves**: radial layouts run out of circumference (~600 leaves at R = 500 px
  before labels collide); lanes scroll vertically indefinitely; sunburst degrades gracefully to thin
  slivers; 3D instancing handles 10k glyphs but hover/labels get hard. Note where collapse/focus is
  *required* rather than nice-to-have.
- Also note load time, animation smoothness (FPS in HUD), and how much code the library saved.
