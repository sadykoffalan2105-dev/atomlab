"""Органика v2 · примеры общих схем ровно с веществами реактора лаборатории.

Учебник пишет общую схему (жир + вода, RONa + R′Cl), реактор показывает её на своём примере
(тристеарин; C₂H₅ONa + CH₃Cl), а данные v2 — на другом (триацетин; CH₃ONa + C₂H₅Cl). Мост реактора
(src/lab/organicV2Bridge.ts) берёт реакцию v2 ровно с веществами реактора, если она есть, — этот скрипт её добавляет,
чтобы 3D совпадало с уравнением реактора.

Запуск (из корня репозитория; идемпотентно — заменяет реакции с теми же id):
  python scripts/organic-v2/add_reactor_examples.py
  npx tsx scripts/organic-v2/fix-mechanisms.mts
build_reactions.py при импорте читает .tmp/ov2r/book-species.json — здесь карточки учебника не нужны (подменяется пустым списком).
"""
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)

_open = io.open


def _no_book(path, *a, **k):
    if str(path).replace('\\', '/').endswith('.tmp/ov2r/book-species.json'):
        return io.StringIO('[]')
    return _open(path, *a, **k)


io.open = _no_book
import build_reactions as B  # noqa: E402
io.open = _open

S = B.SMILES

# id → (уравнение, карточка учебника-образец (тип, страница, условия), исходные, продукты)
EXAMPLES = {
    'gen-tristearin-hydrolysis': (
        '(C₁₇H₃₅COO)₃C₃H₅ + 3H₂O ⇌ C₃H₅(OH)₃ + 3C₁₇H₃₅COOH',
        'g10-c3-s03-r4',
        [('tristearin', S['tristearin'], None)] + [('inorg:H2O', 'O', None)] * 3,
        [('glycerol', S['glycerol'], None)] + [('stearic-acid', S['stearic-acid'], None)] * 3,
    ),
    'gen-ethoxide-chloromethane': (
        'C₂H₅ONa + CH₃Cl → C₂H₅OCH₃ + NaCl',
        'g10-c3-s08-r1',
        [('new:CC[O][Na]', 'CC[O][Na]', 'этилат натрия'), ('chloromethane', S['chloromethane'], None)],
        [('methoxyethane', S['methoxyethane'], None), ('inorg:NaCl', '[Na+].[Cl-]', None)],
    ),
}


def main():
    path = os.path.join(ROOT, 'src', 'data', 'organicV2', 'reactions.json')
    data = json.load(_open(path, encoding='utf-8'))
    by_id = {r['id']: r for r in data['reactions']}
    for rid, (eq, model_id, lhs, rhs) in EXAMPLES.items():
        res, why = B.build_reaction_from_smiles(lhs, rhs)
        if res is None:
            raise SystemExit(f'{rid}: {why}')
        species, changes = res
        model = by_id[model_id]
        r = {'id': rid, 'equation': eq, 'type': model['type'],
             'source': {'grade': 10, 'page': model['source']['page']},
             'species': species, 'changes': changes, 'generic': True}
        if model.get('typeRu'):
            r['typeRu'] = model['typeRu']
        if model.get('conditions'):
            r['conditions'] = model['conditions']
        if rid in by_id:
            data['reactions'][data['reactions'].index(by_id[rid])] = r
        else:
            data['reactions'].append(r)
        by_id[rid] = r
        for s in species:
            if s['ref'] not in S:
                continue
            table = data['routes'] if s['side'] == 'R' else data['uses']
            ids = table.setdefault(s['ref'], [])
            if rid not in ids:
                ids.append(rid)
        print(f'{rid}: {len(species)} участников, {sum(len(s["atoms"]) for s in species)} атомов, изменений связей {len(changes)}')
    s = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    _open(path, 'w', encoding='utf-8', newline='\n').write(s)


if __name__ == '__main__':
    main()
