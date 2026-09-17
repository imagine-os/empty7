# shared/assets — third-party asset sources and licences

Everything under `shared/assets/` is vendored locally (no CDN / image host at runtime). Files were copied from
npm tarballs (`npm pack`, unpacked in `gallery/_vendor-assets/`, which is NOT shipped) and lightly normalised
(a `fill`/`stroke` colour baked in so they render standalone via `<img>`/`background-image`/canvas on a dark page).

| package | version | licence | used for |
|---|---|---|---|
| [simple-icons](https://www.npmjs.com/package/simple-icons) | 16.31.0 | CC0-1.0 | `icons/brand-*.svg` (brand marks) |
| [devicon](https://www.npmjs.com/package/devicon) | 2.17.0 | MIT | `icons/lang-*.svg`, `icons/brand-aws.svg` |
| [lucide-static](https://www.npmjs.com/package/lucide-static) | 1.47.0 | ISC | `icons/ui-*.svg` (generic UI glyphs) |
| three (GLTFExporter) | 0.186.0 | MIT | tooling only; `models/*.glb` are our own primitives (CC0) |

**Trademark caveat.** Brand marks are trademarks of their owners (PostgreSQL, Redis, ClickHouse, Apache Kafka, GitHub,
Vercel, Datadog, Sentry, Stripe, Node.js, Go, Python, Rust, TypeScript, AWS). The CC0/MIT licences cover the SVG files,
not the marks; they are used here nominatively to label fictional infrastructure in a demo. simple-icons removed the
AWS marks in 2024 for trademark reasons, so `brand-aws.svg` comes from devicon (MIT) instead; there are no separate
S3/SQS/EC2/Lambda/CloudFront marks — those nodes use a lucide `ui-*` icon plus the AWS wordmark as `logo`.

`avatars/*.svg` (procedural, no real people), `thumbs/*.png` (rendered from our own HTML) and `models/*.glb` are
generated in-repo by `shared/build-assets.py`, `shared/build-thumbs.mjs`, `shared/build-models.mjs` — CC0.

## Per-file sources

- `icons/brand-aws.svg` ← devicon/icons/amazonwebservices/amazonwebservices-original-wordmark.svg (MIT)
- `icons/brand-clickhouse.svg` ← simple-icons/clickhouse.svg (CC0-1.0, fill #FFCC01 baked in)
- `icons/brand-datadog.svg` ← simple-icons/datadog.svg (CC0-1.0, fill #e8eaf2 baked in)
- `icons/brand-docker.svg` ← simple-icons/docker.svg (CC0-1.0, fill #2496ED baked in)
- `icons/brand-github.svg` ← simple-icons/github.svg (CC0-1.0, fill #e8eaf2 baked in)
- `icons/brand-github-actions.svg` ← simple-icons/githubactions.svg (CC0-1.0, fill #2088FF baked in)
- `icons/brand-grafana.svg` ← simple-icons/grafana.svg (CC0-1.0, fill #F46800 baked in)
- `icons/brand-json.svg` ← simple-icons/json.svg (CC0-1.0, fill #e8eaf2 baked in)
- `icons/brand-kafka.svg` ← simple-icons/apachekafka.svg (CC0-1.0, fill #e8eaf2 baked in)
- `icons/brand-kubernetes.svg` ← simple-icons/kubernetes.svg (CC0-1.0, fill #326CE5 baked in)
- `icons/brand-markdown.svg` ← simple-icons/markdown.svg (CC0-1.0, fill #e8eaf2 baked in)
- `icons/brand-nodejs.svg` ← simple-icons/nodedotjs.svg (CC0-1.0, fill #5FA04E baked in)
- `icons/brand-postgresql.svg` ← simple-icons/postgresql.svg (CC0-1.0, fill #4169E1 baked in)
- `icons/brand-redis.svg` ← simple-icons/redis.svg (CC0-1.0, fill #FF4438 baked in)
- `icons/brand-sentry.svg` ← simple-icons/sentry.svg (CC0-1.0, fill #e8eaf2 baked in)
- `icons/brand-stripe.svg` ← simple-icons/stripe.svg (CC0-1.0, fill #635BFF baked in)
- `icons/brand-vercel.svg` ← simple-icons/vercel.svg (CC0-1.0, fill #e8eaf2 baked in)
- `icons/brand-yaml.svg` ← simple-icons/yaml.svg (CC0-1.0, fill #e8eaf2 baked in)
- `icons/lang-go.svg` ← devicon/icons/go/go-original.svg (MIT)
- `icons/lang-nodejs.svg` ← devicon/icons/nodejs/nodejs-original.svg (MIT)
- `icons/lang-python.svg` ← devicon/icons/python/python-original.svg (MIT)
- `icons/lang-rust.svg` ← devicon/icons/rust/rust-original.svg (MIT)
- `icons/lang-typescript.svg` ← devicon/icons/typescript/typescript-original.svg (MIT)
- `icons/ui-activity.svg` ← lucide-static/icons/activity.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-bell.svg` ← lucide-static/icons/bell.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-book-open.svg` ← lucide-static/icons/book-open.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-box.svg` ← lucide-static/icons/box.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-braces.svg` ← lucide-static/icons/braces.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-cloud.svg` ← lucide-static/icons/cloud.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-code.svg` ← lucide-static/icons/code.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-cpu.svg` ← lucide-static/icons/cpu.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-credit-card.svg` ← lucide-static/icons/credit-card.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-database.svg` ← lucide-static/icons/database.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-file.svg` ← lucide-static/icons/file.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-file-check.svg` ← lucide-static/icons/file-check.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-file-code.svg` ← lucide-static/icons/file-code.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-file-json.svg` ← lucide-static/icons/file-json.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-file-signature.svg` ← lucide-static/icons/file-signature.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-file-spreadsheet.svg` ← lucide-static/icons/file-spreadsheet.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-file-text.svg` ← lucide-static/icons/file-text.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-file-warning.svg` ← lucide-static/icons/file-warning.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-folder.svg` ← lucide-static/icons/folder.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-folder-git-2.svg` ← lucide-static/icons/folder-git-2.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-git-branch.svg` ← lucide-static/icons/git-branch.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-globe.svg` ← lucide-static/icons/globe.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-hard-drive.svg` ← lucide-static/icons/hard-drive.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-heart-pulse.svg` ← lucide-static/icons/heart-pulse.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-key-round.svg` ← lucide-static/icons/key-round.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-layers.svg` ← lucide-static/icons/layers.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-layout-dashboard.svg` ← lucide-static/icons/layout-dashboard.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-lock.svg` ← lucide-static/icons/lock.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-mail.svg` ← lucide-static/icons/mail.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-network.svg` ← lucide-static/icons/network.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-package.svg` ← lucide-static/icons/package.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-presentation.svg` ← lucide-static/icons/presentation.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-receipt.svg` ← lucide-static/icons/receipt.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-scroll-text.svg` ← lucide-static/icons/scroll-text.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-search.svg` ← lucide-static/icons/search.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-send.svg` ← lucide-static/icons/send.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-server.svg` ← lucide-static/icons/server.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-shield.svg` ← lucide-static/icons/shield.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-shopping-cart.svg` ← lucide-static/icons/shopping-cart.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-sparkles.svg` ← lucide-static/icons/sparkles.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-table.svg` ← lucide-static/icons/table.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-terminal.svg` ← lucide-static/icons/terminal.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-triangle-alert.svg` ← lucide-static/icons/triangle-alert.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-user.svg` ← lucide-static/icons/user.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-users.svg` ← lucide-static/icons/users.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-webhook.svg` ← lucide-static/icons/webhook.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-workflow.svg` ← lucide-static/icons/workflow.svg (ISC, stroke #e8eaf2 baked in)
- `icons/ui-zap.svg` ← lucide-static/icons/zap.svg (ISC, stroke #e8eaf2 baked in)
