"""Органика v2 — реакции учебников Kimyo 10–11 с атомным соответствием (контракт src/data/organicV2/types.ts).

Запуск (из корня репозитория):
  npx tsx scripts/organic-v2/dump-book-species.mts .tmp/ov2r/book-species.json
  python scripts/organic-v2/build_reactions.py [--mol-src .tmp/organic-v2]
Выход: src/data/organicV2/reactions.json, docs/plans/organic-v2-reactions-coverage.md

Участники: органика — id реестра (распознаватель реактора: изомеры по записи, подсказка страницы), иначе
'new:<SMILES>'; неорганика — 'inorg:<формула>'. Коэффициент 2 → две копии. Полимер — три звена (polymer: true).
3D: молекулы реестра — из molecules-v0.json (атомы в порядке RDKit AddHs по SMILES реестра), остальные — RDKit.
"""
import io
import json
import math
import os
import re
import sys
import time
from collections import Counter, defaultdict

from rdkit import Chem, RDLogger
from rdkit.Chem import AllChem, rdDepictor, rdMolDescriptors

sys.path.insert(0, os.path.dirname(__file__))
from ov2_mapper import bond_changes, map_reaction  # noqa: E402
from ov2_types import classify, md_types, md_type_key, type_ru  # noqa: E402
from ov2_routes import generic_routes  # noqa: E402

RDLogger.DisableLog('rdApp.*')
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
MOLSRC = sys.argv[sys.argv.index('--mol-src') + 1] if '--mol-src' in sys.argv else 'C:/Users/Первый/Desktop/химия/.tmp/organic-v2'
T0 = time.time()

SMILES = json.load(io.open(os.path.join(MOLSRC, 'smiles.json'), encoding='utf-8'))
SMILES['sucrose'] = 'OC[C@H]1O[C@@](CO)(O[C@H]2O[C@H](CO)[C@@H](O)[C@H](O)[C@H]2O)[C@@H](O)[C@@H]1O'
MV0 = json.load(io.open(os.path.join(MOLSRC, 'molecules-v0.json'), encoding='utf-8'))
GRAPHS = {g['id']: g for g in json.load(io.open(os.path.join(MOLSRC, 'graphs.json'), encoding='utf-8'))}
BOOK = json.load(io.open(os.path.join(ROOT, '.tmp', 'ov2r', 'book-species.json'), encoding='utf-8'))

# неорганика: запись учебника → SMILES (соли и щёлочи — ионами, как в школьной теории строения)
INORG = {
    'H2O': 'O', 'H2': '[H][H]', 'O2': 'O=O', 'O3': 'O=[O+][O-]', 'CO2': 'O=C=O', 'CO': '[C-]#[O+]', 'C': '[C]',
    'HCl': 'Cl', 'HBr': 'Br', 'HI': 'I', 'HF': 'F', 'Cl2': 'ClCl', 'Br2': 'BrBr', 'I2': 'II',
    'Na': '[Na]', 'K': '[K]', 'Li': '[Li]', 'Mg': '[Mg]', 'Ca': '[Ca]', 'Zn': '[Zn]', 'Fe': '[Fe]', 'Cu': '[Cu]', 'Ag': '[Ag]',
    'NaOH': '[Na+].[OH-]', 'KOH': '[K+].[OH-]', 'Ca(OH)2': '[Ca+2].[OH-].[OH-]', 'Ba(OH)2': '[Ba+2].[OH-].[OH-]',
    'Cu(OH)2': 'O[Cu]O', 'CuOH': 'O[Cu]', 'Mg(OH)2': '[Mg+2].[OH-].[OH-]', 'NH4OH': '[NH4+].[OH-]',
    'NaCl': '[Na+].[Cl-]', 'KCl': '[K+].[Cl-]', 'NaBr': '[Na+].[Br-]', 'KBr': '[K+].[Br-]', 'NaI': '[Na+].[I-]',
    'NH4Cl': '[NH4+].[Cl-]', 'CaCl2': '[Ca+2].[Cl-].[Cl-]', 'MgCl2': '[Mg+2].[Cl-].[Cl-]',
    'ZnCl2': 'Cl[Zn]Cl', 'ZnBr2': 'Br[Zn]Br', 'FeCl3': 'Cl[Fe](Cl)Cl', 'FeBr3': 'Br[Fe](Br)Br', 'AlCl3': 'Cl[Al](Cl)Cl',
    'H2SO4': 'OS(=O)(=O)O', 'HNO3': 'O[N+](=O)[O-]', 'H3PO4': 'OP(O)(O)=O', 'H2CO3': 'OC(O)=O',
    'NaHSO4': '[Na+].OS(=O)(=O)[O-]', 'Na2SO4': '[Na+].[Na+].[O-]S(=O)(=O)[O-]', 'K2SO4': '[K+].[K+].[O-]S(=O)(=O)[O-]',
    'MnSO4': '[Mn+2].[O-]S(=O)(=O)[O-]', 'CuSO4': '[Cu+2].[O-]S(=O)(=O)[O-]', 'BaSO4': '[Ba+2].[O-]S(=O)(=O)[O-]',
    'Na2CO3': '[Na+].[Na+].[O-]C([O-])=O', 'K2CO3': '[K+].[K+].[O-]C([O-])=O', 'NaHCO3': '[Na+].OC([O-])=O',
    'CaCO3': '[Ca+2].[O-]C([O-])=O', 'NaNO3': '[Na+].[O-][N+](=O)[O-]', 'NaNO2': '[Na+].[O-]N=O',
    'KMnO4': '[K+].[O-][Mn](=O)(=O)=O', 'MnO2': 'O=[Mn]=O', 'K2MnO4': '[K+].[K+].[O-][Mn](=O)(=O)[O-]',
    'K2Cr2O7': '[K+].[K+].[O-][Cr](=O)(=O)O[Cr](=O)(=O)[O-]', 'Cr2(SO4)3': '[Cr+3].[Cr+3].[O-]S(=O)(=O)[O-].[O-]S(=O)(=O)[O-].[O-]S(=O)(=O)[O-]',
    'CuO': '[Cu]=O', 'Cu2O': '[Cu]O[Cu]', 'Ag2O': '[Ag]O[Ag]', 'CaO': '[Ca+2].[O-2]', 'MgO': '[Mg+2].[O-2]', 'Al2O3': '[Al+3].[Al+3].[O-2].[O-2].[O-2]',
    'NH3': 'N', 'N2': 'N#N', 'NO': '[N]=O', 'NO2': 'O=[N][O]' , 'SO2': 'O=S=O', 'SO3': 'O=S(=O)=O', 'H2O2': 'OO', 'S': '[S]',
    'H2S': 'S', '[O]': '[O]', '[H]': '[H]', 'Na2SO3': '[Na+].[Na+].[O-]S([O-])=O', 'Al(OH)3': '[Al+3].[OH-].[OH-].[OH-]',
    '[Ag(NH3)2]OH': '[Ag+].[OH-].N.N', 'NH4NO3': '[NH4+].[O-][N+](=O)[O-]', 'CaSO3': '[Ca+2].[O-]S([O-])=O', 'CaC2': '[Ca+2].[C-]#[C-]', 'Al4C3': '[Al+3].[Al+3].[Al+3].[Al+3].[C-4].[C-4].[C-4]',
    'H': '[H]', 'Cl': '[Cl]', 'Br': '[Br]', 'O': '[O]', 'OH': '[OH]', 'P': '[P]', 'Pb': '[Pb]', 'Hg': '[Hg]',
    'HgSO4': '[Hg+2].[O-]S(=O)(=O)[O-]', 'NaHSO3': '[Na+].OS([O-])=O', 'CaSO4': '[Ca+2].[O-]S(=O)(=O)[O-]',
    'NaCN': '[Na+].[C-]#N', 'HCN': 'C#N', 'SiO2': 'O=[Si]=O', 'P2O5': 'O=P(=O)OP(=O)=O', 'PCl5': 'ClP(Cl)(Cl)(Cl)Cl',
}

# органика, которую распознаватель реактора не строит (ионы, оксоний, вещества без H)
ORG_EXTRA = {
    'CCl4': 'ClC(Cl)(Cl)Cl', 'CS2': 'S=C=S', 'CH3COONH4': 'CC(=O)[O-].[NH4+]',
    '[(C2H5)2OH]HSO4': 'CC[OH+]CC.OS(=O)(=O)[O-]', 'CH2OH(CHOH)4COONH4': 'OCC(O)C(O)C(O)C(O)C(=O)[O-].[NH4+]',
}

HYB = {Chem.HybridizationType.SP: 'sp', Chem.HybridizationType.SP2: 'sp2', Chem.HybridizationType.SP3: 'sp3'}
EMB_CACHE = {}


def mol_from_skeleton(sk, units=1):
    """Скелет записи (атомы с числом H, связи) → RDKit-молекула; звено полимера — `units` звеньев цепочкой."""
    rw = Chem.RWMol()
    n = len(sk['atoms'])
    heads = []
    for u in range(units):
        base = rw.GetNumAtoms()
        for a in sk['atoms']:
            at = Chem.Atom(a['el'])
            at.SetNoImplicit(True)
            at.SetNumExplicitHs(a['h'])
            rw.AddAtom(at)
        for a, b, o in sk['bonds']:
            rw.AddBond(base + a, base + b, {1: Chem.BondType.SINGLE, 2: Chem.BondType.DOUBLE, 3: Chem.BondType.TRIPLE}[o])
        # нитрогруппа записью «NO₂» (N пятивалентный) → N⁺ и O⁻
        for i in range(base, rw.GetNumAtoms()):
            at = rw.GetAtomWithIdx(i)
            val = sum(b.GetBondTypeAsDouble() for b in at.GetBonds()) + at.GetNumExplicitHs()
            if at.GetSymbol() == 'N' and val in (4, 5) and at.GetNumExplicitHs() == 0:
                at.SetFormalCharge(1)
                for b in at.GetBonds():
                    o = b.GetOtherAtom(at)
                    if o.GetSymbol() != 'O':
                        continue
                    if val == 5 and b.GetBondType() == Chem.BondType.DOUBLE:
                        b.SetBondType(Chem.BondType.SINGLE)
                        o.SetFormalCharge(-1)
                        break
                    if val == 4 and b.GetBondType() == Chem.BondType.SINGLE and o.GetDegree() == 1 and o.GetNumExplicitHs() == 0:
                        o.SetFormalCharge(-1)
                        break
        heads.append(base)
    op = sk.get('open') or []
    if units > 1 and len(op) == 2:
        for u in range(units - 1):
            rw.AddBond(heads[u] + op[1], heads[u + 1] + op[0], Chem.BondType.SINGLE)
    if op:
        ends = [heads[0] + op[0], heads[-1] + op[-1]] if units > 1 and len(op) == 2 else [h + o for h in heads for o in op]
        for e in ends:
            a = rw.GetAtomWithIdx(e)
            a.SetNumRadicalElectrons(a.GetNumRadicalElectrons() + 1)
    m = rw.GetMol()
    Chem.SanitizeMol(m)
    # явные H — атомами; дальше обычная валентность (чистый SMILES без [O], [CH2])
    m = Chem.AddHs(m)
    for a in m.GetAtoms():
        if a.GetNumRadicalElectrons() == 0:
            a.SetNoImplicit(False)
            a.SetNumExplicitHs(0)
    Chem.SanitizeMol(m)
    return m


def three_d(mol, smi_key):
    """3D + 2D + заряды для молекулы с явными H (кэш по SMILES)."""
    if smi_key in EMB_CACHE:
        return EMB_CACHE[smi_key]
    m = Chem.Mol(mol)
    ps = AllChem.ETKDGv3()
    ps.randomSeed = 7
    ok = AllChem.EmbedMolecule(m, ps)
    if ok != 0:
        ps.useRandomCoords = True
        ok = AllChem.EmbedMolecule(m, ps)
    if ok == 0:
        try:
            if AllChem.MMFFHasAllMoleculeParams(m):
                AllChem.MMFFOptimizeMolecule(m, maxIters=2000)
            else:
                AllChem.UFFOptimizeMolecule(m, maxIters=2000)
        except Exception:
            pass
    m2 = Chem.Mol(mol)
    rdDepictor.Compute2DCoords(m2)
    c2 = m2.GetConformer()
    if ok == 0:
        c3 = m.GetConformer()
        P = [(c3.GetAtomPosition(i).x, c3.GetAtomPosition(i).y, c3.GetAtomPosition(i).z) for i in range(m.GetNumAtoms())]
    else:  # одиночные атомы и ионы: 2D в плоскости
        P = [(c2.GetAtomPosition(i).x, c2.GetAtomPosition(i).y, 0.0) for i in range(m.GetNumAtoms())]
    P2 = [(c2.GetAtomPosition(i).x, c2.GetAtomPosition(i).y) for i in range(m.GetNumAtoms())]
    try:
        AllChem.ComputeGasteigerCharges(m)
        Q = [float(a.GetProp('_GasteigerCharge')) for a in m.GetAtoms()]
        Q = [q if math.isfinite(q) else 0.0 for q in Q]
    except Exception:
        Q = [0.0] * m.GetNumAtoms()
    EMB_CACHE[smi_key] = (P, P2, Q)
    return EMB_CACHE[smi_key]


def atoms_bonds(mol, ref):
    """OV2Atom[] и OV2Bond[] (кратность Кекуле)."""
    if ref in MV0 and MV0[ref]['atoms'] and len(MV0[ref]['atoms']) == mol.GetNumAtoms() and \
            all(MV0[ref]['atoms'][i]['el'] == a.GetSymbol() for i, a in enumerate(mol.GetAtoms())):
        atoms = [dict(a) for a in MV0[ref]['atoms']]
        for a in atoms:
            if not math.isfinite(a.get('q', 0.0)):
                a['q'] = 0.0
    else:
        key = Chem.MolToSmiles(mol)
        P, P2, Q = three_d(mol, key)
        atoms = []
        for a in mol.GetAtoms():
            i = a.GetIdx()
            atoms.append({'el': a.GetSymbol(), 'p': [round(v, 3) for v in P[i]], 'p2': [round(v, 3) for v in P2[i]],
                          'hyb': HYB.get(a.GetHybridization(), '') if a.GetSymbol() not in ('H', 'F', 'Cl', 'Br', 'I') else '',
                          'q': round(Q[i], 3), 'ch': a.GetFormalCharge(), 'ar': a.GetIsAromatic()})
    kek = Chem.Mol(mol)
    try:
        Chem.Kekulize(kek, clearAromaticFlags=False)
    except Exception:
        pass
    bonds = []
    for b in kek.GetBonds():
        o = {Chem.BondType.SINGLE: 1, Chem.BondType.DOUBLE: 2, Chem.BondType.TRIPLE: 3}.get(b.GetBondType(), 1)
        e = {'a': b.GetBeginAtomIdx(), 'b': b.GetEndAtomIdx(), 'o': o}
        if mol.GetBondWithIdx(b.GetIdx()).GetIsAromatic():
            e['ar'] = True
        bonds.append(e)
    return atoms, bonds


def reg_mol(rid):
    return Chem.AddHs(Chem.MolFromSmiles(SMILES[rid]))


INCHI_REG = {}
for rid, smi in SMILES.items():
    m = Chem.MolFromSmiles(smi)
    if m is not None:
        INCHI_REG.setdefault(Chem.MolToInchiKey(m), rid)


def ref_for_mol(mol, fallback):
    """id реестра по InChIKey (стереохимия — без учёта: первый блок) или fallback."""
    k = Chem.MolToInchiKey(Chem.RemoveHs(mol))
    if k in INCHI_REG:
        return INCHI_REG[k]
    k1 = k.split('-')[0]
    for kk, rid in INCHI_REG.items():
        if kk.split('-')[0] == k1:
            return rid
    return fallback


def species_mols(sp, n_units):
    """RDKit-молекула участника (явные H) и ref; None — не разобрано."""
    if sp['electron'] or sp['charge']:
        return None, None, 'ион/электрон'
    if sp['organic']:
        if sp['formula'] in ORG_EXTRA:
            m = Chem.AddHs(Chem.MolFromSmiles(ORG_EXTRA[sp['formula']]))
            return m, ref_for_mol(m, 'new:' + ORG_EXTRA[sp['formula']]), None
        if sp['registryId'] and sp['registryId'] in SMILES and not sp['polymer']:
            return reg_mol(sp['registryId']), sp['registryId'], None
        if sp['skeleton']:
            try:
                m = mol_from_skeleton(sp['skeleton'], n_units if sp['polymer'] else 1)
            except Exception as e:  # noqa: BLE001
                return None, None, f'скелет {sp["formula"]}: {e}'
            m = Chem.AddHs(m)
            if sp['polymer']:
                return m, 'polymer:' + sp['formula'], None
            return m, ref_for_mol(m, 'new:' + Chem.MolToSmiles(Chem.RemoveHs(m))), None
        if sp['registryId'] and sp['polymer']:
            return None, None, f'полимер без звена {sp["formula"]}'
        if sp['formula'] in ORG_EXTRA:
            m = Chem.AddHs(Chem.MolFromSmiles(ORG_EXTRA[sp['formula']]))
            return m, ref_for_mol(m, 'new:' + ORG_EXTRA[sp['formula']]), None
        return None, None, f'не распознано {sp["formula"]}'
    f = sp['formula']
    if f in ORG_EXTRA:
        m = Chem.AddHs(Chem.MolFromSmiles(ORG_EXTRA[f]))
        return m, ref_for_mol(m, 'new:' + ORG_EXTRA[f]), None
    if f in INORG:
        m = Chem.MolFromSmiles(INORG[f])
        return Chem.AddHs(m), 'inorg:' + f, None
    return None, None, f'нет неорганики {f}'


def counts_of(mols):
    c = Counter()
    for m in mols:
        for a in m.GetAtoms():
            c[a.GetSymbol()] += 1
    return c


def align_kekule(species):
    """Кольцо, оставшееся ароматическим, рисуется справа той же формой Кекуле, что слева (без «прыжка» двойных связей)."""
    left = {}
    for sp in species:
        if sp['side'] != 'L':
            continue
        for b in sp['bonds']:
            if b.get('ar'):
                x, y = sp['map'][b['a']], sp['map'][b['b']]
                left[(min(x, y), max(x, y))] = b['o']
    if not left:
        return
    for sp in species:
        if sp['side'] != 'R' or not any(b.get('ar') for b in sp['bonds']):
            continue
        new = []
        for b in sp['bonds']:
            o = b['o']
            if b.get('ar'):
                x, y = sp['map'][b['a']], sp['map'][b['b']]
                o = left.get((min(x, y), max(x, y)), o)
            new.append(o)
        # проверка: у каждого ароматического C ровно одна двойная связь кольца
        dbl = Counter()
        arom_atoms = set()
        for b, o in zip(sp['bonds'], new):
            if b.get('ar'):
                arom_atoms.update((b['a'], b['b']))
                if o == 2:
                    dbl[b['a']] += 1
                    dbl[b['b']] += 1
        if all(dbl[a] == 1 for a in arom_atoms if sp['atoms'][a]['el'] == 'C'):
            for b, o in zip(sp['bonds'], new):
                b['o'] = o


def build_reaction(rx, sp_override=None):
    """Одна реакция → OV2Reaction или (None, причина)."""
    species = sp_override or rx['species']
    if not species:
        return None, 'не разобрано'
    if any(s['counts'] is None for s in species):
        return None, 'общая формула (CnH2n…)'
    poly = any(s['polymer'] or s['perUnit'] for s in species)
    units = 3
    items = []  # (side, mol, ref, nameRu)
    for s in species:
        m, ref, why = species_mols(s, units)
        if m is None:
            return None, why
        has_poly = any(x['polymer'] for x in species)
        copies = s['coeff'] * units if (s['perUnit'] or has_poly) else s['coeff']
        if s['polymer']:
            copies = max(1, s['coeff'])
        if abs(copies - round(copies)) > 1e-9:
            return None, f'дробный коэффициент {s["coeff"]}'
        for _ in range(int(round(copies))):
            items.append((s['side'], m, ref, s.get('nameRu')))
    Lm = [m for side, m, _, _ in items if side == 'L']
    Rm = [m for side, m, _, _ in items if side == 'R']
    if not Lm or not Rm:
        return None, 'одна сторона пуста'
    cl, cr = counts_of(Lm), counts_of(Rm)
    if cl != cr:
        return None, f'не уравнено: {dict(cl - cr)} | {dict(cr - cl)}'
    if sum(cl.values()) > 900:
        return None, 'слишком много атомов'
    L, R, inv = map_reaction(Lm, Rm)
    fwd = {r: l for l, r in inv.items()}
    # номера соответствия: 1..N по атомам слева
    mapno_L = [i + 1 for i in range(L.n)]
    mapno_R = [fwd[r] + 1 for r in range(R.n)]
    out_species = []
    li = ri = 0
    for side, m, ref, name in items:
        atoms, bonds = atoms_bonds(m, ref)
        n = m.GetNumAtoms()
        if side == 'L':
            mp = mapno_L[li:li + n]
            li += n
        else:
            mp = mapno_R[ri:ri + n]
            ri += n
        e = {'ref': ref, 'smiles': Chem.MolToSmiles(Chem.RemoveHs(m)), 'side': side, 'atoms': atoms, 'bonds': bonds, 'map': mp}
        if name and not ref.startswith(('inorg:',)) and ref not in SMILES:
            e['nameRu'] = name
        out_species.append(e)
    align_kekule(out_species)
    ch = [{'a': a + 1, 'b': b + 1, 'from': f, 'to': t} for a, b, f, t in bond_changes(L, R, inv)]
    return {'species': out_species, 'changes': ch, 'polymer': poly}, None


def main():
    mdt = md_types(os.path.join(ROOT, 'docs', 'textbook'))
    reactions, skipped = [], []
    organic_book = [r for r in BOOK if r['species'] and any(s['organic'] for s in r['species'])]
    seen_ids = Counter()
    for rx in organic_book:
        if rx['isIonic'] or any(s['electron'] or s['charge'] for s in rx['species']):
            skipped.append((rx, 'ионное уравнение'))
            continue
        res, why = build_reaction(rx)
        if res is None:
            skipped.append((rx, why))
            continue
        typeRu = mdt.get(md_type_key(rx['page'], rx['equationAscii']))
        t = classify(rx, res, typeRu)
        typeRu = type_ru(t, typeRu, res)
        rid = f"g{rx['grade']}-{rx['unitId']}-{rx['id']}"
        seen_ids[rid] += 1
        if seen_ids[rid] > 1:
            rid += f'-{seen_ids[rid]}'
        r = {'id': rid, 'equation': rx['equation'], 'type': t,
             'source': {'grade': rx['grade'], **({'page': rx['page']} if rx['page'] else {}), 'section': rx['section'], 'bookId': rx['id']},
             'species': res['species'], 'changes': res['changes']}
        if rx['conditions']:
            r['conditions'] = rx['conditions']
        if typeRu:
            r['typeRu'] = typeRu
        if rx['generic']:
            r['generic'] = True
            r['example'] = rx['concrete']
        if res['polymer']:
            r['polymer'] = True
        reactions.append(r)
        print(f"  {rid:28s} {t:20s} {rx['equationAscii'][:60]}  ch={len(res['changes'])}", flush=True)
    print('book reactions:', len(reactions), 'skipped:', len(skipped), round(time.time() - T0, 1), 's', flush=True)

    # маршруты
    routes, uses = defaultdict(list), defaultdict(list)

    def index(r):
        for s in r['species']:
            if s['ref'] in SMILES:
                (routes if s['side'] == 'R' else uses)[s['ref']].append(r['id'])

    def page_of(r):
        return (r['source']['grade'], r['source'].get('page') or 999, 1 if r.get('generic') else 0)

    for r in sorted(reactions, key=page_of):
        index(r)
    # общие схемы учебника для молекул без реакции получения
    missing = [rid for rid in GRAPHS if rid not in routes]
    pages = {}
    for r in reactions:
        if r['source']['grade'] == 10 and r['source'].get('page') and not r.get('generic'):
            pages[r['type']] = min(pages.get(r['type'], 999), r['source']['page'])
    gen, gen_fail = generic_routes(missing, SMILES, build_reaction_from_smiles, pages)
    for r in gen:
        reactions.append(r)
        for s in r['species']:
            if s['ref'] in SMILES and s['side'] == 'R':
                if r['id'] not in routes[s['ref']]:
                    routes[s['ref']].append(r['id'])
            elif s['ref'] in SMILES and s['side'] == 'L':
                if r['id'] not in uses[s['ref']]:
                    uses[s['ref']].append(r['id'])
    for k in routes:
        routes[k] = list(dict.fromkeys(routes[k]))
    for k in uses:
        uses[k] = list(dict.fromkeys(uses[k]))
    out = {'reactions': reactions, 'routes': dict(sorted(routes.items())), 'uses': dict(sorted(uses.items()))}
    s = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
    io.open(os.path.join(ROOT, 'src', 'data', 'organicV2', 'reactions.json'), 'w', encoding='utf-8', newline='\n').write(s)
    print('reactions.json', round(len(s.encode()) / 1e6, 2), 'MB; total reactions', len(reactions), 'generic routes', len(gen),
          'no route', len([g for g in GRAPHS if g not in routes]), round(time.time() - T0, 1), 's')
    # школьные механизмы (ацил–O, Вюрц, полимеризация…) — правка соответствия и типов, правила в mechanisms.mts
    import subprocess
    subprocess.run('npx tsx scripts/organic-v2/fix-mechanisms.mts', cwd=ROOT, shell=True, check=True)
    write_report(reactions, skipped, routes, gen_fail, organic_book)


def build_reaction_from_smiles(lhs, rhs):
    """lhs/rhs: [(ref, smiles, nameRu)] → (species, changes) для общей схемы."""
    items = []
    for side, arr in (('L', lhs), ('R', rhs)):
        for ref, smi, name in arr:
            m = Chem.MolFromSmiles(smi)
            if m is None:
                return None, f'SMILES {smi}'
            m = Chem.AddHs(m)
            if ref is None:
                ref = ref_for_mol(m, 'new:' + Chem.MolToSmiles(Chem.RemoveHs(m)))
            items.append((side, m, ref, name))
    Lm = [m for side, m, _, _ in items if side == 'L']
    Rm = [m for side, m, _, _ in items if side == 'R']
    if counts_of(Lm) != counts_of(Rm):
        return None, f'не уравнено {dict(counts_of(Lm) - counts_of(Rm))} | {dict(counts_of(Rm) - counts_of(Lm))}'
    L, R, inv = map_reaction(Lm, Rm)
    fwd = {r: l for l, r in inv.items()}
    out_species = []
    li = ri = 0
    for side, m, ref, name in items:
        atoms, bonds = atoms_bonds(m, ref)
        n = m.GetNumAtoms()
        if side == 'L':
            mp = list(range(li + 1, li + n + 1))
            li += n
        else:
            mp = [fwd[r] + 1 for r in range(ri, ri + n)]
            ri += n
        e = {'ref': ref, 'smiles': Chem.MolToSmiles(Chem.RemoveHs(m)), 'side': side, 'atoms': atoms, 'bonds': bonds, 'map': mp}
        if name and ref not in SMILES and not ref.startswith('inorg:'):
            e['nameRu'] = name
        out_species.append(e)
    align_kekule(out_species)
    ch = [{'a': a + 1, 'b': b + 1, 'from': f, 'to': t} for a, b, f, t in bond_changes(L, R, inv)]
    return (out_species, ch), None


METHOD_NOTES = ['\n## Метод и проверка\n', '- Соответствие атомов: FMCS тяжёлых атомов (4 варианта: с учётом кратности связей и без, с обменами тяжёлых атомов', '  одного элемента и без) → водороды по соседям → обмены по стоимости; берётся вариант с наименьшей «ценой» изменений', '  (разрыв C–C дороже, разрыв C–O у карбонильного C дешевле — этерификация/гидролиз идут по ацильной связи, как в учебнике).', '- Ароматическое кольцо справа получает ту же форму Кекуле, что слева (сдвиг двойных связей не показывается как изменение).', '- Проверка: `npx tsx scripts/validate-organic-v2-reactions.mts` — сохранение атомов по map (⇒ уравнено), заряды,', '  changes = разница связей, routes/uses, маршрут у каждой молекулы реестра, покрытие учебника ≥ 95 %.']


def write_report(reactions, skipped, routes, gen_fail, organic_book):
    book = [r for r in reactions if not r['id'].startswith('gen-')]
    gen = [r for r in reactions if r['id'].startswith('gen-')]
    schemes = [s for s in skipped if s[1].startswith('общая формула')]
    denom = len(organic_book) - len(schemes)
    by_class = defaultdict(lambda: [0, 0, 0])
    for gid, g in GRAPHS.items():
        c = g.get('classId') or '?'
        by_class[c][0] += 1
        rs = routes.get(gid, [])
        if any(not x.startswith('gen-') for x in rs):
            by_class[c][1] += 1
        elif rs:
            by_class[c][2] += 1
    new_refs = Counter(s['ref'] for r in reactions for s in r['species'] if s['ref'].startswith('new:'))
    types = Counter(r['type'] for r in reactions)
    L = []
    L.append('# Органика v2 — покрытие реакций с атомным соответствием\n')
    L.append('Сгенерировано `scripts/organic-v2/build_reactions.py` (RDKit) → `src/data/organicV2/reactions.json`.\n')
    L.append('## Итог\n')
    L.append(f'- Органических реакций в учебниках 10–11 (участник — органика): **{len(organic_book)}** '
             f'(10 кл. {sum(1 for r in organic_book if r["grade"] == 10)}, 11 кл. {sum(1 for r in organic_book if r["grade"] == 11)}).')
    L.append(f'- Чистые схемы (CnH2n…, n/2, R без примера): {len(schemes)}.')
    L.append(f'- В файле с атомным соответствием: **{len(book)}** из {denom} без чистых схем '
             f'(**{100 * len(book) / max(1, denom):.1f} %**); из них общих схем, показанных на примере: {sum(1 for r in book if r.get("generic"))}.')
    L.append(f'- Школьные пути по общим схемам учебника (generic, «не из учебника дословно»): **{len(gen)}**.')
    L.append(f'- Молекул реестра с маршрутом получения: **{sum(1 for g in GRAPHS if routes.get(g))} / {len(GRAPHS)}**.\n')
    L.append('## Типы реакций\n')
    L.append('| Тип | Кол-во |\n|---|---|')
    for k, v in types.most_common():
        L.append(f'| {k} | {v} |')
    L.append('\n## Маршруты по классам\n')
    L.append('| Класс | Молекул | Есть реакция учебника | Только общая схема | Без маршрута |\n|---|---|---|---|---|')
    for c, (n, b, g) in sorted(by_class.items()):
        L.append(f'| {c} | {n} | {b} | {g} | {n - b - g} |')
    L.append('\n## Не вошли (реакции учебника)\n')
    L.append('| Кл. | с. | Уравнение | Причина |\n|---|---|---|---|')
    for rx, why in skipped:
        L.append(f'| {rx["grade"]} | {rx["page"]} | {rx["equation"]} | {why} |')
    nr = [g for g in GRAPHS if not routes.get(g)]
    L.append('\n## Молекулы без маршрута\n')
    L.append(', '.join(f'`{g}`' + (f' ({gen_fail.get(g)})' if gen_fail.get(g) else '') for g in nr) or '— нет')
    L.append('\n## Вещества вне реестра (ref `new:<SMILES>`)\n')
    for k, v in new_refs.most_common():
        L.append(f'- `{k}` — {v}')
    L.extend(METHOD_NOTES)
    io.open(os.path.join(ROOT, 'docs', 'plans', 'organic-v2-reactions-coverage.md'), 'w', encoding='utf-8', newline='\n').write('\n'.join(L) + '\n')


if __name__ == '__main__':
    main()
