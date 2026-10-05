"""Органика v2: школьный путь получения для молекул реестра, у которых в учебнике нет своей реакции.

Общие схемы Kimyo 10 (этерификация, гидролиз галогеналканов, окисление спиртов CuO, окисление альдегидов Ag₂O,
реакция Зинина, нитрование, сульфирование, галогенирование, межмолекулярная дегидратация, гидрирование,
дегидратация спиртов, дегидрирование, алкилирование бензола, аминирование, фотосинтез для природных веществ)
применяются «назад» к целевой молекуле (RDKit-шаблоны); из вариантов берётся тот, где исходные вещества есть
в реестре. Реакция помечается generic: true — это не уравнение со страницы учебника, а его общая схема.
"""
from collections import Counter

from rdkit import Chem
from rdkit.Chem import AllChem, rdMolDescriptors

# (ключ, ретро-шаблон «цель>>предшественники», реагенты слева, побочные справа, тип, тип в учебнике, условия)
TEMPLATES = [
    ('ester', '[C:1](=[O:2])-[O:3]-[#6:4]>>[C:1](=[O:2])O.[O:3]-[#6:4]', [], ['O'], 'esterification', 'этерификация', 'H₂SO₄ (конц.), t'),
    ('nitrate', '[#6:1]-[O:2]-[N+:3](=[O:4])[O-:5]>>[#6:1]-[O:2].O[N+:3](=[O:4])[O-:5]', [], ['O'], 'esterification', 'этерификация (азотная кислота)', 'H₂SO₄ (конц.)'),
    ('anil', '[c:1]-[NH2:2]>>[c:1]-[N+:2](=O)[O-]', ['[H][H]'] * 3, ['O', 'O'], 'reduction', 'восстановление (реакция Зинина)', 'кат., t'),
    ('nitro', '[c:1]-[N+:2](=[O:3])[O-:4]>>[c:1]', ['O[N+](=O)[O-]'], ['O'], 'nitration', 'нитрование', 'H₂SO₄ (конц.)'),
    ('sulfo', '[c:1]-[S:2](=O)(=O)[OH]>>[c:1]', ['OS(=O)(=O)O'], ['O'], 'sulfonation', 'сульфирование', 't'),
    ('carbonyl', '[CX3;!$(C(=O)[O,N]):1]=[O:2]>>[C:1]-[O:2]', ['[Cu]=O'], ['[Cu]', 'O'], 'oxidation', 'окисление спирта (CuO)', 't'),
    ('acid', '[#6,#1;!$([OH]):4][C:1](=[O:2])[OH]>>[*:4][C:1]=[O:2]', ['[Ag]O[Ag]'], ['[Ag]', '[Ag]'], 'oxidation', 'окисление альдегида («серебряное зеркало»)', 'NH₃·H₂O, t'),
    ('formic', '[CH1:1](=[O:2])[OH]>>[CH2:1]=[O:2]', ['[Ag]O[Ag]'], ['[Ag]', '[Ag]'], 'oxidation', 'окисление альдегида («серебряное зеркало»)', 'NH₃·H₂O, t'),
    ('alcohol', '[C;X4:1]-[OH:2]>>[C:1]Cl', ['[Na+].[OH-]'], ['[Na+].[Cl-]'], 'substitution', 'гидролиз галогеналкана (водн. NaOH)', 'H₂O, t'),
    ('hydration', '[C;X4;!H0:1]-[C;X4:2]-[OH:3]>>[C:1]=[C:2].[O:3]', [], [], 'hydration', 'гидратация', 'H₂SO₄ или H₃PO₄, t, p'),
    ('reduce', '[C;X4;H1,H2:1]-[OH:2]>>[C:1]=[O:2]', ['[H][H]'], [], 'reduction', 'восстановление (гидрирование) карбонильного соединения', 'Ni, t'),
    ('phenol', '[c:1]-[OH:2]>>[c:1]Cl', ['[Na+].[OH-]'], ['[Na+].[Cl-]'], 'substitution', 'получение фенола из хлорбензола', 't, p'),
    ('amine', '[C;X4:1]-[N;X3;!$(N=*);!$(N-a);!$(N-C=O):2]>>[C:1]Cl.[N:2]', [], ['Cl'], 'substitution', 'алкилирование аммиака/амина', 't'),
    ('amide', '[C:1](=[O:2])-[NH2:3]>>[C:1](=[O:2])O.[N:3]', [], ['O'], 'other', 'получение амида (кислота + NH₃)', 't'),
    ('rcl', '[C;X4:1]-[Cl:2]>>[C:1].[Cl:2]Cl', [], ['Cl'], 'substitutionRadical', 'хлорирование (радикальное замещение)', 'hν'),
    ('rbr', '[C;X4:1]-[Br:2]>>[C:1].[Br:2]Br', [], ['Br'], 'substitutionRadical', 'бромирование (радикальное замещение)', 'hν'),
    ('ri', '[C;X4:1]-[I:2]>>[C:1].[I:2]I', [], ['I'], 'substitutionRadical', 'иодирование', 'hν'),
    ('arcl', '[c:1]-[Cl:2]>>[c:1].[Cl:2]Cl', [], ['Cl'], 'substitution', 'хлорирование бензола', 'FeCl₃'),
    ('arbr', '[c:1]-[Br:2]>>[c:1].[Br:2]Br', [], ['Br'], 'substitution', 'бромирование бензола', 'FeBr₃'),
    ('ether', '[C;X4:1]-[O;X2:2]-[C;X4:3]>>[C:1]-[O:2].[C:3]O', [], ['O'], 'dehydration', 'межмолекулярная дегидратация спиртов', 'H₂SO₄ (конц.), t < 140 °C'),
    ('alkylar', '[c:1]-[C;X4:2]>>[c:1].[C:2]Cl', [], ['Cl'], 'substitution', 'алкилирование бензола', 'AlCl₃'),
    ('hydrog', '[C;X4;!H0:1]-[C;X4;!H0:2]>>[C:1]=[C:2]', ['[H][H]'], [], 'hydrogenation', 'гидрирование', 'Ni (Pt), t'),
    ('dehydr', '[C;!a:1]=[C;!a;!H0:2]>>[C:1]-[C:2]O', [], ['O'], 'dehydration', 'внутримолекулярная дегидратация спирта', 'H₂SO₄ (конц.), t > 140 °C'),
    ('dehyd2', '[C;!a:1]=[C;!a:2]>>[C:1]-[C:2]', [], ['[H][H]'], 'dehydrogenation', 'дегидрирование', 'кат., t'),
    ('alkyne', '[C:1]#[C:2]>>[C:1]=[C:2]', [], ['[H][H]'], 'dehydrogenation', 'дегидрирование', 'кат., t'),
]
PAGE_HINT = {}

# Молекулы, для которых ретро-шаблоны не дают школьного пути, а «фотосинтез» химически неверен:
# цель → (ключ, исходные SMILES, продукты SMILES (цель первой), тип, тип словами, условия)
SPECIAL = {
    'neopentane': ('wurtz', ['CC(C)(C)Cl', 'CCl', '[Na]', '[Na]'], ['CC(C)(C)C', '[Na+].[Cl-]', '[Na+].[Cl-]'], 'wurtz',
                   'реакция Вюрца (перекрёстная; на практике получается смесь алканов)', 't'),
    'biphenyl': ('wurtz', ['Brc1ccccc1', 'Brc1ccccc1', '[Na]', '[Na]'], ['c1ccc(-c2ccccc2)cc1', '[Na+].[Br-]', '[Na+].[Br-]'],
                 'wurtz', 'реакция Вюрца–Фиттига (арилгалогенид + Na)', 't'),
    'naphthalene': ('dehydr', ['C1CCC2CCCCC2C1'], ['c1ccc2ccccc2c1'] + ['[H][H]'] * 5, 'dehydrogenation',
                    'дегидрирование циклоалкана (как циклогексан → бензол)', 'Pt, 300 °C'),
    'anthracene': ('dehydr', ['C1CCC2CC3CCCCC3CC2C1'], ['c1ccc2cc3ccccc3cc2c1'] + ['[H][H]'] * 7, 'dehydrogenation',
                   'дегидрирование циклоалкана (как циклогексан → бензол)', 'Pt, 300 °C'),
    'anisole': ('williamson', ['[Na]Oc1ccccc1', 'CCl'], ['COc1ccccc1', '[Na+].[Cl-]'], 'substitution',
                'получение простого эфира: фенолят натрия + галогеналкан (RONa + R′Cl)', 't'),
    'pyridine': ('cycl', ['C#C', 'C#C', 'C#N'], ['c1ccncc1'], 'trimerization',
                 'циклизация ацетилена с HCN (как тримеризация ацетилена в бензол)', 't, кат.'),
    'pyrrole': ('cycl', ['C#C', 'C#C', 'N'], ['c1cc[nH]c1', '[H][H]'], 'other', 'циклизация ацетилена с аммиаком', 't, кат.'),
    'hexamine': ('cond', ['C=O'] * 6 + ['N'] * 4, ['C1N2CN3CN1CN(C2)C3'] + ['O'] * 6, 'other',
                 'конденсация формальдегида с аммиаком (А. М. Бутлеров, 1859)', '—'),
}


def _sub(n):
    return str(n).translate(str.maketrans('0123456789', '₀₁₂₃₄₅₆₇₈₉'))


def _formula(smi):
    m = Chem.MolFromSmiles(smi)
    f = rdMolDescriptors.CalcMolFormula(m)
    f = f.replace('+', '').replace('-', '')
    return ''.join(_sub(c) if c.isdigit() else c for c in f)


# школьная запись (не формула Хилла) для неорганики и солей общих схем
SCHOOL = {'[Na+].[Cl-]': 'NaCl', '[Na+].[Br-]': 'NaBr', 'N': 'NH₃', 'C#N': 'HCN', '[Na]Oc1ccccc1': 'C₆H₅ONa',
          '[Na+].[OH-]': 'NaOH', 'OS(=O)(=O)O': 'H₂SO₄', 'O[N+](=O)[O-]': 'HNO₃', '[Ag]O[Ag]': 'Ag₂O', '[Cu]=O': 'CuO',
          'CC(C)(C)Cl': '(CH₃)₃CCl', 'Brc1ccccc1': 'C₆H₅Br', 'C=O': 'HCHO'}


def _side(smis):
    c = Counter(smis)
    return ' + '.join((f'{n}' if n > 1 else '') + SCHOOL.get(s, _formula(s)) for s, n in c.items())


def _registry_keys(SMILES):
    keys = {}
    for rid, smi in SMILES.items():
        m = Chem.MolFromSmiles(smi)
        if m is not None:
            keys.setdefault(Chem.MolToInchiKey(m).split('-')[0], rid)
    return keys


def generic_routes(missing, SMILES, builder, pages=None):
    pages = pages or {}
    keys = _registry_keys(SMILES)
    rxs = [(k, AllChem.ReactionFromSmarts(t), lr, rr, ty, ru, cond) for k, t, lr, rr, ty, ru, cond in TEMPLATES]
    out, fails = [], {}
    for tid in missing:
        smi = SMILES.get(tid)
        target = Chem.MolFromSmiles(smi) if smi else None
        if target is None:
            fails[tid] = 'нет SMILES'
            continue
        cands = []
        if tid in SPECIAL:
            k, ls, rs, ty, ru, cond = SPECIAL[tid]
            ref_of = lambda x: keys.get(Chem.MolToInchiKey(Chem.MolFromSmiles(x)).split('-')[0]) if ('C' in x or 'c' in x) and x != 'C#N' else None  # noqa: E731
            lhs = [(ref_of(x) or _inorg_ref(x), SMILES[ref_of(x)] if ref_of(x) else x, None) for x in ls]
            rhs = [(tid, smi, None)] + [(ref_of(x) or _inorg_ref(x), SMILES[ref_of(x)] if ref_of(x) else x, None) for x in rs[1:]]
            res, why = builder(lhs, rhs)
            if res is not None:
                cands = []
                special = (k, res, ty, ru, cond, lhs, rhs)
            else:
                fails[tid] = why
                special = None
        else:
            special = None
        for order, (k, rxn, lr, rr, ty, ru, cond) in enumerate(rxs if special is None else []):
            try:
                outs = rxn.RunReactants((target,))
            except Exception:  # noqa: BLE001
                continue
            seen = set()
            for prods in outs:
                pre = []
                ok = True
                for p in prods:
                    try:
                        p = Chem.Mol(p)
                        Chem.SanitizeMol(p)
                        s = Chem.MolToSmiles(p)
                        if Chem.MolFromSmiles(s) is None:
                            ok = False
                        pre.append(s)
                    except Exception:  # noqa: BLE001
                        ok = False
                if not ok:
                    continue
                key = tuple(sorted(pre))
                if key in seen:
                    continue
                seen.add(key)
                regs = [keys.get(Chem.MolToInchiKey(Chem.MolFromSmiles(s)).split('-')[0]) for s in pre]
                org = [s for s in pre if 'C' in s or 'c' in s]
                in_reg = sum(1 for s, r in zip(pre, regs) if r and ('C' in s or 'c' in s))
                score = (in_reg == len(org), in_reg, -order)
                cands.append((score, k, pre, regs, lr, rr, ty, ru, cond))
        built = special
        for score, k, pre, regs, lr, rr, ty, ru, cond in sorted(cands, key=lambda c: c[0], reverse=True)[:4]:
            lhs = [(r if r else _inorg_ref(s), SMILES[r] if r else s, None) for s, r in zip(pre, regs)]
            lhs += [(_inorg_ref(s), s, None) for s in lr]
            rhs = [(tid, smi, None)] + [(_inorg_ref(s), s, None) for s in rr]
            res, why = builder(lhs, rhs)
            if res is None:
                fails[tid] = why
                continue
            built = (k, res, ty, ru, cond, lhs, rhs)
            break
        if built is None:
            built = _photosynthesis(tid, smi, builder, fails)
        if built is None:
            fails.setdefault(tid, 'нет подходящей схемы')
            continue
        k, (species, changes), ty, ru, cond, lhs, rhs = built
        eq = _side([s for _, s, _ in lhs]) + ' → ' + _side([s for _, s, _ in rhs])
        r = {'id': f'gen-{tid}-{k}', 'equation': eq, 'type': ty, 'typeRu': ru,
             'source': {'grade': 10, **({'page': pages[ty]} if pages.get(ty) else {})},
             'generic': True, 'species': species, 'changes': changes}
        if cond:
            r['conditions'] = cond
        out.append(r)
        fails.pop(tid, None)
    return out, fails


def _inorg_ref(smi):
    names = {'O': 'H2O', '[H][H]': 'H2', 'Cl': 'HCl', 'Br': 'HBr', 'I': 'HI', 'ClCl': 'Cl2', 'BrBr': 'Br2', 'II': 'I2',
             '[Na]': 'Na', '[Na+].[Br-]': 'NaBr', 'C#N': 'HCN', '[Cu]=O': 'CuO', '[Cu]': 'Cu', '[Ag]O[Ag]': 'Ag2O', '[Ag]': 'Ag', '[Na+].[OH-]': 'NaOH', '[Na+].[Cl-]': 'NaCl',
             'O[N+](=O)[O-]': 'HNO3', 'OS(=O)(=O)O': 'H2SO4', 'N': 'NH3', 'O=C=O': 'CO2', 'O=O': 'O2'}
    return 'inorg:' + names[smi] if smi in names else None


def _photosynthesis(tid, smi, builder, fails):
    """Природные вещества из C, H, O (и N): «образуются в растениях» — суммарно из CO₂, H₂O (и NH₃), выделяется O₂."""
    m = Chem.AddHs(Chem.MolFromSmiles(smi))
    c = Counter(a.GetSymbol() for a in m.GetAtoms())
    if set(c) - {'C', 'H', 'O', 'N'}:
        return None
    C, H, O, N = c['C'], c['H'], c['O'], c['N']
    h_left = H - 3 * N
    if h_left < 0 or h_left % 2:
        return None
    w = h_left // 2
    o2x2 = 2 * C + w - O
    if o2x2 < 0:
        return None
    mult = 1 if o2x2 % 2 == 0 else 2
    if C * mult > 45:
        return None
    lhs = [('inorg:CO2', 'O=C=O', None)] * (C * mult) + [('inorg:H2O', 'O', None)] * (w * mult) + [('inorg:NH3', 'N', None)] * (N * mult)
    rhs = [(tid, smi, None)] * mult + [('inorg:O2', 'O=O', None)] * (o2x2 * mult // 2)
    res, why = builder(lhs, rhs)
    if res is None:
        fails[tid] = why
        return None
    return ('photo', res, 'other', 'образуется в природе (суммарно, фотосинтез)', 'hν, хлорофилл', lhs, rhs)
