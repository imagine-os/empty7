#!/usr/bin/env python3
"""Build shared/data.json from the film-studio seed (graph-app/seed.sql).

Node id scheme: "<type>:<pk>"  e.g. film:13, person:4, studio:5, genre:3, award:1
Link relation types: produced_by, director, writer, actor, composer, producer,
                     genre, nominated, won, nominee
"""
import json, sqlite3, sys, os
from collections import Counter

here = os.path.dirname(os.path.abspath(__file__))
seed = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, '..', '..', 'graph-app', 'seed.sql')
out = os.path.join(here, 'data.json')

con = sqlite3.connect(':memory:')
con.executescript(open(seed).read())
q = lambda s: con.execute(s).fetchall()

nodes, links = [], []

for id_, name, founded, country in q('select id,name,founded,country from studios'):
    nodes.append(dict(id=f'studio:{id_}', type='studio', label=name, founded=founded, country=country))

for id_, title, year, rt, budget, gross, sid in q('select id,title,year,runtime_min,budget_musd,gross_musd,studio_id from films'):
    nodes.append(dict(id=f'film:{id_}', type='film', label=title, year=year, runtime_min=rt,
                      budget_musd=budget, gross_musd=gross,
                      roi=round(gross / budget, 2) if budget else None))
    if sid is not None:
        links.append(dict(source=f'film:{id_}', target=f'studio:{sid}', relation='produced_by'))

for id_, name, born, nat in q('select id,name,born,nationality from people'):
    nodes.append(dict(id=f'person:{id_}', type='person', label=name, born=born, nationality=nat))

for id_, name in q('select id,name from genres'):
    nodes.append(dict(id=f'genre:{id_}', type='genre', label=name))

for id_, name, cat in q('select id,name,category from awards'):
    nodes.append(dict(id=f'award:{id_}', type='award', label=f'{name} – {cat}', award=name, category=cat))

for fid, pid, role, character in q('select film_id,person_id,role,character from credits'):
    l = dict(source=f'person:{pid}', target=f'film:{fid}', relation=role)
    if character:
        l['character'] = character
    links.append(l)

for fid, gid in q('select film_id,genre_id from film_genres'):
    links.append(dict(source=f'film:{fid}', target=f'genre:{gid}', relation='genre'))

for nid, aid, fid, pid, year, won in q('select id,award_id,film_id,person_id,year,won from nominations'):
    links.append(dict(source=f'film:{fid}', target=f'award:{aid}', relation='won' if won else 'nominated', year=year))
    if pid is not None:
        links.append(dict(source=f'person:{pid}', target=f'award:{aid}', relation='nominee', year=year, won=bool(won)))

# derived numeric attributes: degree, plus per-person film count and wins
deg = Counter()
for l in links:
    deg[l['source']] += 1; deg[l['target']] += 1
wins = Counter(l['source'] for l in links if l['relation'] == 'nominee' and l['won'])
films_by_person = Counter(l['source'] for l in links if l['source'].startswith('person:') and l['target'].startswith('film:'))
for n in nodes:
    n['degree'] = deg[n['id']]
    if n['type'] == 'person':
        n['film_count'] = films_by_person[n['id']]
        n['wins'] = wins[n['id']]
    if n['type'] == 'film':
        n['wins'] = sum(1 for l in links if l['source'] == n['id'] and l['relation'] == 'won')

meta = dict(
    source='graph-app/seed.sql (fictional film-studio universe)',
    node_types={t: c for t, c in sorted(Counter(n['type'] for n in nodes).items())},
    relation_types={r: c for r, c in sorted(Counter(l['relation'] for l in links).items())},
    type_colors=dict(studio='#f5b642', film='#ff5f8f', person='#5ec8ff', genre='#8dff9e', award='#e6c3ff'),
)
json.dump(dict(meta=meta, nodes=nodes, links=links), open(out, 'w'), indent=1, ensure_ascii=False)
print(f'wrote {out}: {len(nodes)} nodes, {len(links)} links'); print(json.dumps(meta, indent=1))
