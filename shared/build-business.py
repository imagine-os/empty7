#!/usr/bin/env python3
"""Graph Gallery — business-model dataset for the sunburst-business demo (stdlib only, deterministic).

Northwind Labs -> 4 business units -> product lines / departments -> products -> sub-products -> offerings
(regions, segments, channels, revenue streams, features, services). Every node carries KPIs; parents
aggregate their children. Writes shared/business.json.

    python3 shared/build-business.py
"""
import json, os, random

SEED = 11
rng = random.Random(SEED)

# Department names + hues mirror shared/org.json / hud.js DEPT_HUES (eng, design, mkt, sales, ops, fin).
DEPT_HUES = {'Engineering': '#ff7a45', 'Design': '#ffd166', 'Marketing': '#4fd1c5',
             'Sales': '#5ec8ff', 'Operations': '#b48cff', 'Finance': '#ff5f8f'}
TYPE_COLORS = {'company': '#ffffff', 'unit': '#f5b642', 'line': '#ff5f8f', 'department': '#ffd166',
               'product': '#5ec8ff', 'subproduct': '#8dff9e', 'offering': '#e6c3ff', 'team': '#b48cff', 'service': '#4fd1c5'}
STAGE_COLORS = {'core': '#5ec8ff', 'growth': '#8dff9e', 'incubate': '#e6c3ff', 'sunset': '#ff7a45'}
FIRST = ['Amara', 'Bea', 'Chidi', 'Dana', 'Elin', 'Farid', 'Grace', 'Hiro', 'Ines', 'Jonas', 'Kavya', 'Leo', 'Maya', 'Nico',
         'Olu', 'Priya', 'Quinn', 'Rosa', 'Sven', 'Tomás', 'Uma', 'Vik', 'Wren', 'Ximena', 'Yusuf', 'Zoe']
LAST = ['Okafor', 'Lindqvist', 'Moreau', 'Tanaka', 'Haddad', 'Novak', 'Reyes', 'Bauer', 'Iyer', 'Costa', 'Sato', 'Dlamini',
        'Kowalski', 'Nakamura', 'Fischer', 'Abara', 'Petrov', 'Silva', 'Chen', 'Mensah']
owner = lambda: f'{rng.choice(FIRST)} {rng.choice(LAST)}'

# Offering kinds: sub-products drill into one kind of split each (a CEO drills product -> edition -> region).
KINDS = {
  'region':  ['North America', 'EMEA', 'APAC', 'LATAM', 'UK & Ireland', 'Nordics', 'Middle East', 'Japan', 'India', 'ANZ'],
  'segment': ['Enterprise', 'Mid-market', 'SMB', 'Public sector', 'Startups', 'Education', 'Healthcare', 'Financial services'],
  'channel': ['Direct sales', 'Partner resellers', 'Cloud marketplace', 'Self-serve web', 'OEM bundles', 'Retail'],
  'stream':  ['Subscriptions', 'Usage fees', 'Perpetual licences', 'Premium support', 'Training', 'Add-ons', 'Advertising'],
  'feature': ['Analytics', 'Automation', 'API access', 'SSO & governance', 'Mobile', 'Integrations', 'AI assistant', 'Offline mode'],
  'service': ['Onboarding', 'Migration', 'Health checks', 'Custom builds', 'Escalation desk', 'Architecture review', 'Certification'],
}
KIND_WEIGHTS = [('region', 5), ('segment', 4), ('channel', 3), ('stream', 4), ('feature', 3), ('service', 2)]
SUBS = {'edition': ['Starter', 'Professional', 'Business', 'Enterprise', 'Ultimate'],
        'module': ['Core', 'Insights', 'Connect', 'Secure', 'Scale', 'Studio', 'Ops', 'Vault'],
        'tier': ['Essentials', 'Plus', 'Premium', 'Elite'],
        'gen': ['Gen 1', 'Gen 2', 'Gen 3', 'Lite', 'Max', 'Mini']}

# Unit -> hue, lines (name, scale $M per offering, margin, growth, stage, products), departments.
# scale = median annual revenue per offering ($M); margin/growth are targets that leaves scatter around.
UNITS = [
  ('Platform', '#5ec8ff', [
    ('Core Infrastructure', 5.0, .62, .06, 'core', ['Compute Grid', 'Object Storage', 'Northwind Network', 'Edge Runtime'], 'gen'),
    ('Data Cloud', 3.2, .48, .28, 'growth', ['Lakehouse', 'Streaming Engine', 'Query Service', 'ML Workbench'], 'module'),
    ('Developer Platform', 1.6, .55, .18, 'growth', ['Northwind CLI & SDKs', 'CI Runners', 'Observability Suite'], 'edition'),
  ], ['Engineering']),
  ('Consumer', '#ff5f8f', [
    ('Northwind Home', 2.4, .34, .09, 'core', ['Hub Speaker', 'Smart Thermostat', 'Home Camera', 'Mesh Router'], 'gen'),
    ('Northwind Mobile', 1.4, .58, .22, 'growth', ['Notes App', 'Wallet', 'Fitness Coach'], 'tier'),
    ('Aurora Wearables', 0.9, -.85, .95, 'incubate', ['Aurora Glasses', 'Aurora Band'], 'gen'),
  ], ['Design', 'Marketing']),
  ('Enterprise', '#ffd166', [
    ('Northwind Suite', 3.4, .52, .16, 'core', ['Workspace', 'CRM', 'People', 'Finance Cloud'], 'edition'),
    ('Legacy On-Prem Suite', 2.0, .71, -.31, 'sunset', ['Server Edition 9', 'Classic Connector', 'Maintenance Contracts'], 'tier'),
    ('Industry Solutions', 1.8, .41, .33, 'growth', ['Health Records', 'Public Sector Cloud', 'Retail Ops', 'Fintech Rails'], 'module'),
  ], ['Sales']),
  ('Services', '#4fd1c5', [
    ('Professional Services', 1.1, .19, .07, 'core', ['Implementation', 'Advisory', 'Custom Engineering'], 'tier'),
    ('Managed Services', 1.5, .27, .24, 'growth', ['Managed Cloud', 'Managed Security', 'Managed Data'], 'tier'),
    ('Support & Success', 0.8, .36, .11, 'core', ['Premier Support', 'Customer Success', 'Academy'], 'tier'),
  ], ['Operations', 'Finance']),
]
TEAMS = {'Engineering': ['Platform Engineering', 'Site Reliability', 'Security'], 'Design': ['Product Design', 'Research', 'Brand'],
         'Marketing': ['Growth Marketing', 'Product Marketing', 'Events'], 'Sales': ['Field Sales', 'Inside Sales', 'Partnerships'],
         'Operations': ['Supply Chain', 'IT', 'Facilities'], 'Finance': ['FP&A', 'Accounting', 'Procurement']}
SERVICES = ['Shared tooling', 'On-call rota', 'Compliance audits', 'Vendor management', 'Internal training', 'Reporting',
            'Hiring pipeline', 'Design system', 'Campaign ops', 'Deal desk', 'Logistics', 'Payroll', 'Forecasting', 'Budgeting']

counter = {'n': 0}
def nid(t):
  counter['n'] += 1; return f'{t}:{counter["n"]}'

def series(rev, growth):
  # 12 monthly points that trend with growth (month 12 vs month 1 ≈ 1 + growth) plus mild seasonality/noise.
  pts = []
  for i in range(12):
    trend = 1 + growth * (i - 5.5) / 11
    season = 1 + 0.07 * (1 if i in (2, 5, 8, 11) else -0.35)
    pts.append(round(max(0.01, rev / 12 * trend * season * rng.uniform(.9, 1.1)), 3))
  return pts

def leaf(label, kind, scale, margin, growth, stage, ltype='offering'):
  rev = round(scale * rng.lognormvariate(0, .55), 2)
  m = max(-3.0, min(.92, margin + rng.gauss(0, .07)))
  g = growth + rng.gauss(0, .08)
  if kind == 'region' and label == 'APAC': g += .32       # the fast-growing region story
  cost = round(rev * (1 - m), 2)
  health = int(max(5, min(99, 62 + m * 30 + g * 40 + rng.gauss(0, 8))))
  cust = int(rev * rng.choice([12, 40, 180, 900]) * rng.uniform(.6, 1.6)) + 3
  return {'id': nid(ltype), 'type': ltype, 'kind': kind, 'label': label, 'stage': stage, 'owner': owner(),
          'revenue': rev, 'cost': cost, 'headcount': max(1, int(cost / rng.uniform(.18, .32))), 'customers': cust,
          'health': health, 'growth': round(g * 100, 1), 'series': series(rev, g)}

def aggregate(n):
  kids = n.get('children')
  if not kids: n['margin'] = round((n['revenue'] - n['cost']) / n['revenue'] * 100, 1); return n
  for k in kids: aggregate(k)
  for key in ('revenue', 'cost', 'headcount', 'customers'): n[key] = round(sum(k[key] for k in kids), 2)
  rev = n['revenue'] or 1
  n['margin'] = round((n['revenue'] - n['cost']) / rev * 100, 1)
  n['growth'] = round(sum(k['growth'] * k['revenue'] for k in kids) / rev, 1)
  n['health'] = int(round(sum(k['health'] * k['revenue'] for k in kids) / rev))
  n['series'] = [round(sum(k['series'][i] for k in kids), 3) for i in range(12)]
  by_stage = {}
  for k in kids: by_stage[k['stage']] = by_stage.get(k['stage'], 0) + k['revenue']
  n.setdefault('stage', max(by_stage, key=by_stage.get))
  kids.sort(key=lambda k: -k['revenue'])
  return n

def pick_kind():
  return rng.choices([k for k, _ in KIND_WEIGHTS], [w for _, w in KIND_WEIGHTS])[0]

def build():
  root = {'id': 'company:root', 'type': 'company', 'label': 'Northwind Labs', 'owner': 'Justin Hale (CEO)', 'children': []}
  for uname, hue, lines, depts in UNITS:
    unit = {'id': nid('unit'), 'type': 'unit', 'label': uname, 'hue': hue, 'owner': owner(), 'children': []}
    for lname, scale, margin, growth, stage, products, subkind in lines:
      line = {'id': nid('line'), 'type': 'line', 'label': lname, 'stage': stage, 'owner': owner(), 'children': []}
      for pi, pname in enumerate(products):
        pstage, pm, pg, ps = stage, margin, growth, scale
        if lname == 'Core Infrastructure' and pname == 'Compute Grid': pm, pg, ps = .74, .03, scale * 1.6   # the cash cow
        if lname == 'Northwind Home' and pname == 'Home Camera': pstage, pg = 'growth', .27
        if lname == 'Northwind Suite' and pname == 'Finance Cloud': pstage, pg, pm = 'incubate', .6, .05
        if lname == 'Data Cloud' and pname == 'ML Workbench': pstage, pm, pg = 'incubate', -.2, .7
        prod = {'id': nid('product'), 'type': 'product', 'label': pname, 'stage': pstage, 'owner': owner(), 'children': []}
        subs = rng.sample(SUBS[subkind], rng.randint(2, min(4, len(SUBS[subkind]))))
        for si, sname in enumerate(subs):
          kind = pick_kind()
          sub = {'id': nid('subproduct'), 'type': 'subproduct', 'label': f'{pname} {sname}' if subkind == 'gen' else sname,
                 'stage': pstage, 'owner': owner(), 'children': []}
          names = rng.sample(KINDS[kind], rng.randint(2, 3))
          sub['children'] = [leaf(nm, kind, ps * (1.6 if si == 0 else 1) * rng.uniform(.5, 1.4), pm, pg, pstage) for nm in names]
          prod['children'].append(sub)
        line['children'].append(prod)
      unit['children'].append(line)
    for dname in depts:  # cost centres: small internal chargeback revenue, larger cost -> negative margin
      dept = {'id': nid('department'), 'type': 'department', 'label': dname, 'hue_dept': DEPT_HUES[dname], 'stage': 'core',
              'owner': owner(), 'children': []}
      for tname in TEAMS[dname]:
        team = {'id': nid('team'), 'type': 'team', 'label': tname, 'stage': 'core', 'owner': owner(), 'children': [
          leaf(s, 'service', 0.9, -.9, .04, 'core', 'service') for s in rng.sample(SERVICES, rng.randint(2, 3))]}
        dept['children'].append(team)
      unit['children'].append(dept)
    root['children'].append(unit)
  return aggregate(root)

root = build()
counts, by_level, by_type = {}, {}, {}
def walk(n, depth=0):
  by_level[depth] = by_level.get(depth, 0) + 1; by_type[n['type']] = by_type.get(n['type'], 0) + 1
  for k in n.get('children', []): walk(k, depth + 1)
walk(root)
meta = {
  'source': f'shared/build-business.py (fictional Northwind Labs business model, seed {SEED})',
  'type_colors': TYPE_COLORS, 'stage_colors': STAGE_COLORS, 'department_hues': DEPT_HUES,
  'unit_hues': {u['label']: u['hue'] for u in root['children']},
  'levels': ['company', 'unit', 'line / department', 'product / team', 'sub-product / service', 'offering'],
  'kpis': {
    'revenue': {'label': 'Revenue', 'unit': '$M', 'format': 'money'}, 'cost': {'label': 'Cost', 'unit': '$M', 'format': 'money'},
    'margin': {'label': 'Margin', 'unit': '%', 'format': 'pct'}, 'growth': {'label': 'Growth YoY', 'unit': '%', 'format': 'pct_signed'},
    'headcount': {'label': 'Headcount', 'unit': 'FTE', 'format': 'int'}, 'customers': {'label': 'Customers', 'unit': '', 'format': 'int'},
    'health': {'label': 'Health', 'unit': '/100', 'format': 'int'}, 'stage': {'label': 'Stage', 'unit': '', 'format': 'text'},
    'owner': {'label': 'Owner', 'unit': '', 'format': 'text'}},
  'thresholds': {'company_margin': root['margin'], 'margin_range': 45, 'company_growth': root['growth'], 'growth_range': 40,
                 'health_range': [30, 95]},
  'counts': {'nodes': sum(by_level.values()), 'by_level': by_level, 'by_type': by_type},
}
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'business.json')
json.dump({'meta': meta, 'tree': root}, open(out, 'w'), separators=(',', ':'))
print(json.dumps(meta['counts']), 'revenue', root['revenue'], 'margin', root['margin'], 'growth', root['growth'], 'hc', root['headcount'])
