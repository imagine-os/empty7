#!/usr/bin/env python3
"""Graph Gallery — structured group dataset generator (stdlib only, deterministic).

Company -> 6 departments -> 2–4 projects each -> typed leaves (skill / agent / template / tool),
plus typed leaves hanging directly off each department. Writes shared/org.json.

    python3 shared/build-org.py
"""
import json, os, random, re

SEED = 7
rng = random.Random(SEED)

TYPE_COLORS = {'company': '#ffffff', 'department': '#f5b642', 'project': '#ff5f8f',
               'skill': '#5ec8ff', 'agent': '#8dff9e', 'template': '#e6c3ff', 'tool': '#4fd1c5'}
TYPE_SHAPES = {'company': 'circle', 'department': 'hexagon', 'project': 'square',
               'skill': 'circle', 'agent': 'diamond', 'template': 'triangle', 'tool': 'wrench-or-star'}
AGENT_STATUS = ['live', 'pilot', 'idea']

# slug, label, projects, pools per type ------------------------------------------------------
DEPTS = [
  ('eng', 'Engineering',
   ['Platform', 'Mobile App', 'Data Pipeline', 'Developer Tools'],
   {'skill': ['Rust', 'TypeScript', 'Go', 'Kubernetes', 'Distributed systems', 'SQL tuning', 'Observability',
              'Swift', 'Kotlin', 'GraphQL', 'Stream processing', 'Security review'],
    'agent': ['Code review agent', 'Incident triage agent', 'Flaky test hunter', 'Dependency upgrader',
              'Release notes agent', 'On-call summariser', 'Migration assistant'],
    'template': ['Incident runbook template', 'RFC template', 'Postmortem template', 'Service README template',
                 'API changelog template', 'Architecture decision record'],
    'tool': ['Terraform', 'GitHub Actions', 'Grafana', 'Datadog', 'Docker', 'Xcode', 'dbt', 'Kafka', 'Sentry']}),
  ('design', 'Design',
   ['Design System', 'Onboarding Redesign', 'Brand Refresh'],
   {'skill': ['Interaction design', 'Motion design', 'Typography', 'Accessibility', 'User research',
              'Prototyping', 'Illustration', 'Design tokens'],
    'agent': ['Accessibility audit agent', 'Copy polish agent', 'Component doc generator', 'Icon variant agent',
              'Research synthesis agent'],
    'template': ['Component spec template', 'Usability test script', 'Design review checklist', 'Handoff template',
                 'Persona template'],
    'tool': ['Figma', 'Storybook', 'Framer', 'Lottie', 'Maze', 'Zeroheight']}),
  ('mkt', 'Marketing',
   ['Q4 Campaign', 'Content Engine', 'Product Launch', 'Community'],
   {'skill': ['SEO', 'Copywriting', 'Brand strategy', 'Paid social', 'Analytics', 'Video editing',
              'Email marketing', 'Event production', 'Partnerships', 'Lifecycle marketing'],
    'agent': ['Campaign planner agent', 'Social scheduler agent', 'Headline tester', 'Newsletter drafter',
              'Competitor watch agent', 'Webinar follow-up agent'],
    'template': ['Brand voice template', 'Campaign brief template', 'Launch checklist', 'Case study template',
                 'Press release template', 'Landing page template'],
    'tool': ['HubSpot', 'Figma', 'Google Analytics', 'Webflow', 'Ahrefs', 'Mailchimp', 'Descript', 'Notion']}),
  ('sales', 'Sales',
   ['Enterprise Pipeline', 'SMB Self-serve', 'Partner Channel'],
   {'skill': ['Discovery calls', 'Negotiation', 'Solution demos', 'Account planning', 'Forecasting',
              'Objection handling', 'Procurement navigation'],
    'agent': ['Lead scoring agent', 'Call summary agent', 'Proposal drafter', 'Renewal risk agent',
              'Meeting prep agent'],
    'template': ['Discovery call template', 'Proposal template', 'Mutual action plan', 'Security questionnaire pack',
                 'QBR deck template'],
    'tool': ['Salesforce', 'Gong', 'Outreach', 'LinkedIn Sales Navigator', 'DocuSign', 'Clari']}),
  ('ops', 'Operations',
   ['Vendor Management', 'Office & Remote', 'Compliance Program', 'People Ops'],
   {'skill': ['Process mapping', 'Vendor negotiation', 'SOC 2 controls', 'Change management', 'Facilities',
              'Onboarding design', 'Risk assessment', 'Procurement'],
    'agent': ['Ticket router agent', 'Policy Q&A agent', 'Onboarding buddy agent', 'Access review agent',
              'Vendor renewal agent', 'Travel booking agent'],
    'template': ['SOP template', 'Vendor scorecard', 'Onboarding checklist', 'Policy template',
                 'Audit evidence template', 'Offsite planning template'],
    'tool': ['Jira Service Management', 'Okta', 'Vanta', 'Rippling', 'Zapier', 'Envoy', 'Notion']}),
  ('fin', 'Finance',
   ['Annual Plan', 'Billing Platform', 'Board Reporting'],
   {'skill': ['FP&A modelling', 'Revenue recognition', 'Cash forecasting', 'Tax', 'Audit readiness',
              'Unit economics', 'Treasury'],
    'agent': ['Invoice matcher agent', 'Variance explainer agent', 'Expense policy agent', 'Close checklist agent',
              'Board deck drafter'],
    'template': ['Budget template', 'Month-end close checklist', 'Board pack template', 'Investment memo template',
                 'Headcount plan template'],
    'tool': ['NetSuite', 'Stripe', 'Anaplan', 'Brex', 'Google Sheets', 'Carta']}),
]

def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

nodes, links = [], []
seen = set()

def add(node, parent):
    assert node['id'] not in seen, node['id']
    seen.add(node['id'])
    nodes.append(node)
    if parent is not None:
        links.append({'source': parent['id'], 'target': node['id'], 'relation': 'child'})
    return node

def leaf(t, label, dept_slug, parent, depth):
    n = {'id': f'{t}:{dept_slug}-{slug(label)}', 'type': t, 'label': label,
         'department': f'dept:{dept_slug}', 'parent': parent['id'], 'depth': depth}
    if t == 'skill': n['level'] = rng.randint(1, 5)
    if t == 'agent': n['status'] = rng.choices(AGENT_STATUS, weights=[4, 3, 2])[0]
    return add(n, parent)

company = add({'id': 'company:root', 'type': 'company', 'label': 'Northwind Labs',
               'department': None, 'parent': None, 'depth': 0}, None)

for dslug, dlabel, projects, pools in DEPTS:
    dept = add({'id': f'dept:{dslug}', 'type': 'department', 'label': dlabel,
                'department': f'dept:{dslug}', 'parent': company['id'], 'depth': 1}, company)
    projs = [add({'id': f'proj:{dslug}-{slug(p)}', 'type': 'project', 'label': p,
                  'department': dept['id'], 'parent': dept['id'], 'depth': 2}, dept) for p in projects]
    for t, names in pools.items():
        names = list(names); rng.shuffle(names)
        # ~1/3 of each pool hangs directly off the department; the rest are spread over projects
        n_direct = max(1, round(len(names) / 3))
        for name in names[:n_direct]: leaf(t, name, dslug, dept, 2)
        for i, name in enumerate(names[n_direct:]): leaf(t, name, dslug, projs[(i + rng.randint(0, 1)) % len(projs)], 3)

# nested tree ------------------------------------------------------------------------------
kids = {}
for l in links: kids.setdefault(l['source'], []).append(l['target'])
by_id = {n['id']: n for n in nodes}
def build(nid):
    n = by_id[nid]
    out = {'id': nid, 'type': n['type'], 'label': n['label']}
    for k in ('level', 'status'):
        if k in n: out[k] = n[k]
    if nid in kids: out['children'] = [build(c) for c in kids[nid]]
    return out
tree = build(company['id'])

counts = {}
for n in nodes: counts[n['type']] = counts.get(n['type'], 0) + 1
counts = dict(sorted(counts.items()))
meta = {'source': 'shared/build-org.py (fictional company, seed %d)' % SEED,
        'type_colors': TYPE_COLORS, 'type_shapes': TYPE_SHAPES,
        'counts': {**counts, 'nodes': len(nodes), 'links': len(links)},
        'departments': [f'dept:{d[0]}' for d in DEPTS]}

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'org.json')
with open(out, 'w') as f:
    json.dump({'meta': meta, 'tree': tree, 'nodes': nodes, 'links': links}, f, indent=1)
print(json.dumps(meta['counts']))
print('wrote', out)
