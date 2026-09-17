#!/usr/bin/env python3
"""Graph Gallery — "object views" dataset (stdlib only, deterministic, seed 11).

A fictional software company ("Northwind Labs") system map: services, databases, queues, repos,
source files, documents, people and cloud/SaaS. Every node carries a local asset reference
(icon / logo / thumb / avatar, relative to meta.asset_root) so demos draw the OBJECT, not a circle.

    python3 shared/build-system.py        # writes shared/system.json
"""
import json, os, random

SEED = 11
rng = random.Random(SEED)
HERE = os.path.dirname(os.path.abspath(__file__))

TYPE_COLORS = {'service': '#5ec8ff', 'database': '#f5b642', 'queue': '#ff9f43', 'repo': '#b48cff',
               'file': '#cfd6e6', 'document': '#ffd166', 'person': '#ff5f8f', 'cloud': '#8dff9e'}
# How each kind is framed, so the same object reads the same in every demo.
TYPE_FRAMES = {'service': 'rack', 'database': 'cylinder', 'queue': 'pipe', 'repo': 'folder',
               'file': 'tile', 'document': 'page', 'person': 'circle', 'cloud': 'cloud'}
TYPE_MODELS = {'service': 'models/server.glb', 'database': 'models/database.glb', 'queue': 'models/queue.glb',
               'repo': 'models/folder.glb', 'file': 'models/document.glb', 'document': 'models/document.glb',
               'person': 'models/laptop.glb', 'cloud': 'models/cloud.glb'}
RELATION_STYLES = {
  'calls':      {'color': '#5ec8ff', 'width': 1.6, 'dash': None,   'arrow': True,  'label': 'calls'},
  'reads':      {'color': '#f5b642', 'width': 1.2, 'dash': None,   'arrow': True,  'label': 'reads'},
  'writes':     {'color': '#ff9f43', 'width': 1.6, 'dash': None,   'arrow': True,  'label': 'writes'},
  'publishes':  {'color': '#ff9f43', 'width': 1.4, 'dash': [6, 3], 'arrow': True,  'label': 'publishes'},
  'consumes':   {'color': '#ff9f43', 'width': 1.4, 'dash': [2, 3], 'arrow': True,  'label': 'consumes'},
  'contains':   {'color': 'rgba(180,140,255,0.45)', 'width': 0.9, 'dash': None, 'arrow': False, 'label': 'contains'},
  'documents':  {'color': '#ffd166', 'width': 1.1, 'dash': [4, 4], 'arrow': True,  'label': 'documents'},
  'references': {'color': 'rgba(255,209,102,0.5)', 'width': 0.9, 'dash': [1, 3], 'arrow': True, 'label': 'references'},
  'owns':       {'color': '#ff5f8f', 'width': 1.1, 'dash': None,   'arrow': False, 'label': 'owns'},
  'authored':   {'color': 'rgba(255,95,143,0.55)', 'width': 0.9, 'dash': [3, 3], 'arrow': True, 'label': 'authored'},
  'deploys_to': {'color': '#8dff9e', 'width': 1.2, 'dash': None,   'arrow': True,  'label': 'deploys to'},
  'monitors':   {'color': 'rgba(141,255,158,0.55)', 'width': 0.9, 'dash': [2, 4], 'arrow': True, 'label': 'monitors'},
}
EXT_ICONS = {'ts': 'icons/lang-typescript.svg', 'py': 'icons/lang-python.svg', 'go': 'icons/lang-go.svg',
             'rs': 'icons/lang-rust.svg', 'md': 'icons/brand-markdown.svg', 'json': 'icons/ui-braces.svg',
             'yaml': 'icons/brand-yaml.svg', 'sql': 'icons/ui-database.svg'}
LANG_ICONS = {'Node': 'icons/lang-nodejs.svg', 'TypeScript': 'icons/lang-typescript.svg', 'Go': 'icons/lang-go.svg',
              'Python': 'icons/lang-python.svg', 'Rust': 'icons/lang-rust.svg'}
FORMAT_ICONS = {'pdf': 'icons/ui-file-text.svg', 'docx': 'icons/ui-scroll-text.svg', 'pptx': 'icons/ui-presentation.svg',
                'xlsx': 'icons/ui-table.svg', 'md': 'icons/brand-markdown.svg'}

TEAMS = {'platform': ('Platform', '#5ec8ff'), 'payments': ('Payments', '#f5b642'),
         'data': ('Data', '#b48cff'), 'frontend': ('Frontend', '#ff5f8f')}

# id, label, lang, team, repo, health, ui icon, sublabel
SERVICES = [
  ('svc:api-gateway', 'api-gateway', 'Node', 'platform', 'repo:platform-api', 'healthy', 'ui-network', 'edge routing'),
  ('svc:auth', 'auth', 'Rust', 'platform', 'repo:auth-service', 'healthy', 'ui-key-round', 'OIDC / sessions'),
  ('svc:user-profile', 'user-profile', 'TypeScript', 'platform', 'repo:platform-api', 'healthy', 'ui-user', 'accounts'),
  ('svc:webhooks', 'webhooks', 'Rust', 'platform', 'repo:platform-api', 'degraded', 'ui-webhook', 'outbound events'),
  ('svc:billing', 'billing', 'Go', 'payments', 'repo:billing-service', 'healthy', 'ui-receipt', 'invoices & plans'),
  ('svc:payments', 'payments', 'Go', 'payments', 'repo:billing-service', 'healthy', 'ui-credit-card', 'Stripe adapter'),
  ('svc:orders', 'orders', 'Go', 'payments', 'repo:billing-service', 'down', 'ui-shopping-cart', 'order lifecycle'),
  ('svc:search', 'search', 'Python', 'data', 'repo:search-service', 'healthy', 'ui-search', 'full-text + vector'),
  ('svc:analytics-ingest', 'analytics-ingest', 'Python', 'data', 'repo:data-pipeline', 'healthy', 'ui-activity', 'event firehose'),
  ('svc:recommendations', 'recommendations', 'Python', 'data', 'repo:data-pipeline', 'degraded', 'ui-sparkles', 'ranking model'),
  ('svc:notifications', 'notifications', 'Node', 'frontend', 'repo:web-frontend', 'healthy', 'ui-bell', 'email / push'),
  ('svc:admin-portal', 'admin-portal', 'TypeScript', 'frontend', 'repo:web-frontend', 'healthy', 'ui-layout-dashboard', 'internal UI'),
]
DATABASES = [
  ('db:postgres-main', 'postgres-main', 'PostgreSQL', 'brand-postgresql', 'primary OLTP'),
  ('db:postgres-billing', 'postgres-billing', 'PostgreSQL', 'brand-postgresql', 'ledger'),
  ('db:redis-cache', 'redis-cache', 'Redis', 'brand-redis', 'hot cache'),
  ('db:redis-sessions', 'redis-sessions', 'Redis', 'brand-redis', 'session store'),
  ('db:clickhouse-events', 'clickhouse-events', 'ClickHouse', 'brand-clickhouse', 'analytics OLAP'),
  ('db:s3-assets', 's3-assets', 'Amazon S3', 'brand-aws', 'object bucket'),
]
QUEUES = [('q:kafka-events', 'kafka-events', 'Apache Kafka', 'brand-kafka', '24 partitions'),
          ('q:sqs-jobs', 'sqs-jobs', 'Amazon SQS', 'brand-aws', 'background jobs')]
REPOS = [  # id, label, language, stars, team
  ('repo:platform-api', 'platform-api', 'TypeScript', 412, 'platform'),
  ('repo:auth-service', 'auth-service', 'Rust', 288, 'platform'),
  ('repo:billing-service', 'billing-service', 'Go', 197, 'payments'),
  ('repo:search-service', 'search-service', 'Python', 163, 'data'),
  ('repo:data-pipeline', 'data-pipeline', 'Python', 121, 'data'),
  ('repo:web-frontend', 'web-frontend', 'TypeScript', 534, 'frontend'),
  ('repo:infra', 'infra', 'YAML', 76, 'platform'),
  ('repo:docs', 'docs', 'Markdown', 58, 'frontend'),
]
FILES = {  # repo -> [(path, ext)]
  'repo:platform-api': [('src/gateway/router.ts', 'ts'), ('src/gateway/rate-limit.ts', 'ts'), ('src/profile/service.ts', 'ts'),
                        ('src/webhooks/dispatch.rs', 'rs'), ('package.json', 'json'), ('README.md', 'md')],
  'repo:auth-service': [('src/main.rs', 'rs'), ('src/oidc.rs', 'rs'), ('src/session.rs', 'rs'), ('Cargo.toml', 'yaml')],
  'repo:billing-service': [('cmd/billing/main.go', 'go'), ('internal/invoice/invoice.go', 'go'), ('internal/stripe/client.go', 'go'),
                           ('internal/orders/state.go', 'go'), ('migrations/001_ledger.sql', 'sql')],
  'repo:search-service': [('search/indexer.py', 'py'), ('search/query.py', 'py'), ('search/embeddings.py', 'py'), ('pyproject.toml', 'yaml')],
  'repo:data-pipeline': [('pipeline/ingest.py', 'py'), ('pipeline/rank.py', 'py'), ('sql/events_rollup.sql', 'sql'), ('schemas/event.json', 'json')],
  'repo:web-frontend': [('app/admin/page.tsx', 'ts'), ('app/notify/worker.ts', 'ts'), ('tsconfig.json', 'json')],
  'repo:infra': [('k8s/gateway.yaml', 'yaml'), ('k8s/kafka.yaml', 'yaml')],
  'repo:docs': [('CONTRIBUTING.md', 'md'), ('architecture.md', 'md')],
}
DOCUMENTS = [  # id, title, format, pages, kind, targets(documents ->), refs(->docs)
  ('doc:api-spec', 'Platform API Specification v3', 'pdf', 42, 'spec', ['svc:api-gateway', 'repo:platform-api'], ['doc:security-policy']),
  ('doc:billing-runbook', 'Billing On-call Runbook', 'docx', 11, 'runbook', ['svc:billing', 'svc:payments'], ['doc:incident-report']),
  ('doc:q3-roadmap', 'Q3 Roadmap', 'pptx', 18, 'slides', ['repo:web-frontend'], ['doc:arch-overview']),
  ('doc:cloud-costs', 'Cloud cost breakdown 2026', 'xlsx', 4, 'spreadsheet', ['cloud:aws-ec2'], ['doc:invoice-datadog']),
  ('doc:readme-platform', 'platform-api README', 'md', 3, 'readme', ['repo:platform-api'], ['doc:api-spec']),
  ('doc:search-design', 'Search relevance design doc', 'pdf', 14, 'design', ['svc:search', 'repo:search-service'], ['doc:data-dictionary']),
  ('doc:vendor-contract', 'Stripe master services agreement', 'pdf', 27, 'contract', ['cloud:stripe'], []),
  ('doc:invoice-datadog', 'Datadog invoice — Aug 2026', 'pdf', 2, 'invoice', ['cloud:datadog'], []),
  ('doc:oncall-handbook', 'On-call handbook', 'docx', 22, 'handbook', ['svc:api-gateway', 'svc:auth'], ['doc:billing-runbook']),
  ('doc:arch-overview', 'Architecture overview', 'pptx', 9, 'slides', ['svc:api-gateway', 'q:kafka-events'], ['doc:api-spec']),
  ('doc:incident-report', 'INC-2291 postmortem: orders outage', 'md', 5, 'postmortem', ['svc:orders'], ['doc:oncall-handbook']),
  ('doc:security-policy', 'Security & access policy', 'pdf', 16, 'policy', ['svc:auth'], []),
  ('doc:data-dictionary', 'Event data dictionary', 'xlsx', 7, 'spreadsheet', ['db:clickhouse-events', 'svc:analytics-ingest'], []),
  ('doc:release-notes', 'Release notes 2026.09', 'md', 2, 'release-notes', ['repo:web-frontend', 'repo:platform-api'], ['doc:q3-roadmap']),
]
PEOPLE = [  # id, name, role, team
  ('person:ada-okafor', 'Ada Okafor', 'Staff engineer', 'platform'),
  ('person:lars-brekke', 'Lars Brekke', 'Backend engineer', 'platform'),
  ('person:mei-tanaka', 'Mei Tanaka', 'SRE', 'platform'),
  ('person:diego-ruiz', 'Diego Ruiz', 'Engineering manager', 'payments'),
  ('person:priya-nair', 'Priya Nair', 'Backend engineer', 'payments'),
  ('person:tomasz-wolak', 'Tomasz Wolak', 'Finance ops', 'payments'),
  ('person:sofia-marin', 'Sofia Marin', 'Data engineer', 'data'),
  ('person:kwame-mensah', 'Kwame Mensah', 'ML engineer', 'data'),
  ('person:hana-kim', 'Hana Kim', 'Analyst', 'data'),
  ('person:noor-haddad', 'Noor Haddad', 'Frontend lead', 'frontend'),
  ('person:felix-berg', 'Felix Berg', 'Frontend engineer', 'frontend'),
  ('person:ines-costa', 'Ines Costa', 'Technical writer', 'frontend'),
]
CLOUD = [  # id, label, provider, ui icon, logo, sublabel
  ('cloud:aws-ec2', 'EC2', 'AWS', 'ui-cpu', 'brand-aws', 'compute'),
  ('cloud:aws-lambda', 'Lambda', 'AWS', 'ui-zap', 'brand-aws', 'functions'),
  ('cloud:aws-cloudfront', 'CloudFront', 'AWS', 'ui-globe', 'brand-aws', 'CDN'),
  ('cloud:github-actions', 'GitHub Actions', 'GitHub', 'ui-workflow', 'brand-github-actions', 'CI/CD'),
  ('cloud:vercel', 'Vercel', 'Vercel', 'ui-cloud', 'brand-vercel', 'frontend hosting'),
  ('cloud:datadog', 'Datadog', 'Datadog', 'ui-heart-pulse', 'brand-datadog', 'metrics & APM'),
  ('cloud:sentry', 'Sentry', 'Sentry', 'ui-triangle-alert', 'brand-sentry', 'error tracking'),
  ('cloud:stripe', 'Stripe', 'Stripe', 'ui-credit-card', 'brand-stripe', 'payments API'),
]

nodes, links, seen = [], [], set()
def add(n): nodes.append(n)
def link(s, t, rel):
    key = (s, t, rel)
    if key in seen or s == t: return
    seen.add(key); links.append({'source': s, 'target': t, 'relation': rel})

team_people = {t: [p[0] for p in PEOPLE if p[3] == t] for t in TEAMS}
svc_owner = {}
for sid, label, lang, team, repo, health, ui, sub in SERVICES:
    owner = rng.choice(team_people[team]); svc_owner[sid] = owner
    add({'id': sid, 'type': 'service', 'label': label, 'sublabel': sub, 'icon': f'icons/{ui}.svg',
         'logo': LANG_ICONS[lang], 'lang': lang, 'owner': owner, 'team': team, 'repo': repo, 'health': health,
         'rps': rng.randint(20, 4000)})
for did, label, engine, logo, sub in DATABASES:
    add({'id': did, 'type': 'database', 'label': label, 'sublabel': sub, 'icon': 'icons/ui-database.svg',
         'logo': f'icons/{logo}.svg', 'engine': engine, 'size_gb': rng.choice([12, 48, 120, 340, 900, 2400])})
for qid, label, engine, logo, sub in QUEUES:
    add({'id': qid, 'type': 'queue', 'label': label, 'sublabel': sub, 'icon': 'icons/ui-layers.svg',
         'logo': f'icons/{logo}.svg', 'engine': engine})
for rid, label, language, stars, team in REPOS:
    add({'id': rid, 'type': 'repo', 'label': label, 'sublabel': f'{language} · ★ {stars}', 'icon': 'icons/ui-folder-git-2.svg',
         'logo': 'icons/brand-github.svg', 'language': language, 'stars': stars, 'team': team,
         'files': len(FILES[rid])})
for rid, files in FILES.items():
    for path, ext in files:
        fid = f'file:{rid.split(":")[1]}/{path}'
        add({'id': fid, 'type': 'file', 'label': path.split('/')[-1], 'sublabel': path, 'icon': EXT_ICONS[ext],
             'ext': ext, 'repo': rid, 'loc': rng.randint(20, 1400)})
        link(rid, fid, 'contains')
for did, title, fmt, pages, kind, targets, refs in DOCUMENTS:
    slug = did.split(':')[1]
    add({'id': did, 'type': 'document', 'label': title, 'sublabel': f'{fmt.upper()} · {pages} pp', 'icon': FORMAT_ICONS[fmt],
         'thumb': f'thumbs/{slug}.png', 'format': fmt, 'pages': pages, 'kind': kind,
         'updated': f'2026-0{rng.randint(4, 9)}-{rng.randint(10, 28)}'})
    for t in targets: link(did, t, 'documents')
    for r in refs: link(did, r, 'references')
for pid, name, role, team in PEOPLE:
    slug = pid.split(':')[1]
    add({'id': pid, 'type': 'person', 'label': name, 'sublabel': role, 'icon': 'icons/ui-user.svg',
         'avatar': f'avatars/{slug}.svg', 'role': role, 'team': team, 'initials': ''.join(w[0] for w in name.split())})
for cid, label, provider, ui, logo, sub in CLOUD:
    add({'id': cid, 'type': 'cloud', 'label': label, 'sublabel': f'{provider} · {sub}', 'icon': f'icons/{ui}.svg',
         'logo': f'icons/{logo}.svg', 'provider': provider})

# --- relations --------------------------------------------------------------------------------
CALLS = [('svc:api-gateway', 'svc:auth'), ('svc:api-gateway', 'svc:user-profile'), ('svc:api-gateway', 'svc:billing'),
         ('svc:api-gateway', 'svc:search'), ('svc:api-gateway', 'svc:orders'), ('svc:api-gateway', 'svc:recommendations'),
         ('svc:billing', 'svc:payments'), ('svc:orders', 'svc:billing'), ('svc:orders', 'svc:notifications'),
         ('svc:billing', 'svc:notifications'), ('svc:user-profile', 'svc:auth'), ('svc:admin-portal', 'svc:api-gateway'),
         ('svc:admin-portal', 'svc:billing'), ('svc:recommendations', 'svc:search'), ('svc:webhooks', 'svc:auth'),
         ('svc:orders', 'svc:webhooks'), ('svc:payments', 'svc:webhooks'), ('svc:notifications', 'svc:user-profile')]
for s, t in CALLS: link(s, t, 'calls')
RW = [('svc:auth', 'db:redis-sessions', 'writes'), ('svc:auth', 'db:postgres-main', 'reads'),
      ('svc:user-profile', 'db:postgres-main', 'writes'), ('svc:user-profile', 'db:redis-cache', 'reads'),
      ('svc:user-profile', 'db:s3-assets', 'writes'), ('svc:api-gateway', 'db:redis-cache', 'reads'),
      ('svc:billing', 'db:postgres-billing', 'writes'), ('svc:payments', 'db:postgres-billing', 'writes'),
      ('svc:orders', 'db:postgres-main', 'writes'), ('svc:orders', 'db:postgres-billing', 'reads'),
      ('svc:search', 'db:postgres-main', 'reads'), ('svc:search', 'db:redis-cache', 'writes'),
      ('svc:analytics-ingest', 'db:clickhouse-events', 'writes'), ('svc:recommendations', 'db:clickhouse-events', 'reads'),
      ('svc:recommendations', 'db:redis-cache', 'writes'), ('svc:admin-portal', 'db:postgres-main', 'reads'),
      ('svc:admin-portal', 'db:clickhouse-events', 'reads'), ('svc:notifications', 'db:postgres-main', 'reads'),
      ('svc:webhooks', 'db:postgres-main', 'reads'), ('svc:billing', 'db:s3-assets', 'writes')]
for s, t, r in RW: link(s, t, r)
PUBSUB = [('svc:orders', 'q:kafka-events', 'publishes'), ('svc:user-profile', 'q:kafka-events', 'publishes'),
          ('svc:payments', 'q:kafka-events', 'publishes'), ('svc:api-gateway', 'q:kafka-events', 'publishes'),
          ('svc:analytics-ingest', 'q:kafka-events', 'consumes'), ('svc:search', 'q:kafka-events', 'consumes'),
          ('svc:webhooks', 'q:kafka-events', 'consumes'), ('svc:notifications', 'q:sqs-jobs', 'consumes'),
          ('svc:billing', 'q:sqs-jobs', 'publishes'), ('svc:recommendations', 'q:sqs-jobs', 'publishes')]
for s, t, r in PUBSUB: link(s, t, r)
for sid, *_ in SERVICES: link(svc_owner[sid], sid, 'owns')
repo_owner = {}
for rid, label, language, stars, team in REPOS:
    o = rng.choice(team_people[team]); repo_owner[rid] = o; link(o, rid, 'owns')
for i, (did, title, fmt, pages, kind, targets, refs) in enumerate(DOCUMENTS):
    author = PEOPLE[(i * 5) % len(PEOPLE)][0]
    link(author, did, 'authored')
    nodes[[n['id'] for n in nodes].index(did)]['author'] = author
DEPLOY = {'svc:api-gateway': 'cloud:aws-ec2', 'svc:auth': 'cloud:aws-ec2', 'svc:user-profile': 'cloud:aws-ec2',
          'svc:webhooks': 'cloud:aws-lambda', 'svc:billing': 'cloud:aws-ec2', 'svc:payments': 'cloud:aws-ec2',
          'svc:orders': 'cloud:aws-ec2', 'svc:search': 'cloud:aws-ec2', 'svc:analytics-ingest': 'cloud:aws-lambda',
          'svc:recommendations': 'cloud:aws-ec2', 'svc:notifications': 'cloud:aws-lambda', 'svc:admin-portal': 'cloud:vercel'}
for s, t in DEPLOY.items(): link(s, t, 'deploys_to')
link('svc:admin-portal', 'cloud:aws-cloudfront', 'deploys_to'); link('svc:api-gateway', 'cloud:aws-cloudfront', 'deploys_to')
link('svc:payments', 'cloud:stripe', 'calls'); link('svc:billing', 'cloud:stripe', 'calls')
for rid, *_ in REPOS: link(rid, 'cloud:github-actions', 'deploys_to')
for sid, *_ in SERVICES:
    link('cloud:datadog', sid, 'monitors')
    if rng.random() < 0.6: link('cloud:sentry', sid, 'monitors')

# --- groups (compound layouts) ----------------------------------------------------------------
groups = []
for rid, label, language, stars, team in REPOS:
    members = [f'file:{rid.split(":")[1]}/{p}' for p, _ in FILES[rid]]
    groups.append({'id': f'group:{rid}', 'kind': 'repo', 'label': label, 'color': TYPE_COLORS['repo'],
                   'parent': rid, 'members': members})
for t, (label, color) in TEAMS.items():
    members = team_people[t] + [s[0] for s in SERVICES if s[3] == t] + [r[0] for r in REPOS if r[4] == t]
    groups.append({'id': f'group:team-{t}', 'kind': 'team', 'label': f'{label} team', 'color': color, 'members': members})

degree = {}
for l in links:
    degree[l['source']] = degree.get(l['source'], 0) + 1; degree[l['target']] = degree.get(l['target'], 0) + 1
for n in nodes: n['degree'] = degree.get(n['id'], 0)
ids = {n['id'] for n in nodes}
for l in links: assert l['source'] in ids and l['target'] in ids, l
counts = {}
for n in nodes: counts[n['type']] = counts.get(n['type'], 0) + 1
rel_counts = {}
for l in links: rel_counts[l['relation']] = rel_counts.get(l['relation'], 0) + 1

out = {'meta': {'name': 'Northwind Labs — system map', 'seed': SEED, 'asset_root': '../../shared/assets/',
                'type_colors': TYPE_COLORS, 'type_frames': TYPE_FRAMES, 'type_models': TYPE_MODELS,
                'relation_styles': RELATION_STYLES, 'ext_icons': EXT_ICONS,
                'teams': {t: {'label': l, 'color': c} for t, (l, c) in TEAMS.items()},
                'counts': {'nodes': len(nodes), 'links': len(links), 'groups': len(groups),
                           'by_type': counts, 'by_relation': rel_counts}},
       'nodes': nodes, 'links': links, 'groups': groups}
path = os.path.join(HERE, 'system.json')
with open(path, 'w') as f: json.dump(out, f, indent=1)
print(f'wrote {path}: {len(nodes)} nodes, {len(links)} links, {len(groups)} groups')
print(counts); print(rel_counts)
