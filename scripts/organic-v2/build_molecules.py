"""
Органика v2 — конвейер данных молекул (офлайн, RDKit; на сайт не попадает).

  npx tsx scripts/organic-v2/dump-graphs.mts          # графы реестра → .tmp/organic-v2/graphs-src.json
  python scripts/organic-v2/build_molecules.py        # → src/data/organicV2/molecules.json + molecules3d.json

Граф реестра → RDKit (N⁺/O⁻ по валентности) → изомерный SMILES (стереохимия — stereo_table.py) →
3D: ETKDGv3 + MMFF94, N конформеров, минимум энергии (длинные цепи — вытянутый зигзаг) →
2D скелетной формулы (CoordGen), гибридизация, заряды Гастайгера, CIP, E/Z, кольца, функциональные группы.
Порядок атомов = порядок графа реестра (если граф верный), чтобы индексы совпадали со старым набором атомов.
Все проверки стереохимии (CIP, E/Z, гидролиз сахаров до эталонных моносахаридов, InChIKey) — здесь же, падают громко.
"""
import io
import json
import math
import os
import re
import sys
import time
from collections import Counter

from rdkit import Chem, RDLogger
from rdkit.Chem import AllChem, rdCIPLabeler, rdDepictor, rdMolDescriptors, rdMolTransforms
from rdkit.Chem.EnumerateStereoisomers import EnumerateStereoisomers, StereoEnumerationOptions

sys.path.insert(0, os.path.dirname(__file__))
from stereo_table import MONO, MONO_KEYS, STEREO  # noqa: E402

RDLogger.DisableLog('rdApp.*')
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, '.tmp', 'organic-v2', 'graphs-src.json')
GRADE_TS = os.path.join(ROOT, 'src', 'data', 'curriculum', 'compoundGradeMap.generated.ts')
OUT = os.path.join(ROOT, 'src', 'data', 'organicV2', 'molecules.json')
OUT3D = os.path.join(ROOT, 'src', 'data', 'organicV2', 'molecules3d.json')
ONLY = set(sys.argv[1:])

HYB = {Chem.HybridizationType.SP: 'sp', Chem.HybridizationType.SP2: 'sp2', Chem.HybridizationType.SP3: 'sp3'}
BT = {1: Chem.BondType.SINGLE, 2: Chem.BondType.DOUBLE, 3: Chem.BondType.TRIPLE}
SUB = str.maketrans('₀₁₂₃₄₅₆₇₈₉', '0123456789')

# ── функциональные группы (ключи OV2GroupKey); якоря — индексы атомов в шаблоне ──
GROUPS = [
    ('carboxyl', '[CX3](=O)[OX2H1]', None),
    ('ester', '[#6][CX3](=O)[OX2][#6]', (1, 2, 3)),
    ('ester', '[#1][CX3](=O)[OX2][#6]', (1, 2, 3)),
    ('amide', '[CX3](=O)[NX3]', None),
    ('carbonylAldehyde', '[CX3;!$(C[O,N;X2,X3;!$(*=*)])](=O)[#1]', (0, 1)),
    ('carbonylKetone', '[#6][CX3](=O)[#6]', (1, 2)),
    ('nitrate', '[OX2][N+](=O)[O-]', None),
    ('nitro', '[#6][N+](=O)[O-]', (1, 2, 3)),
    ('sulfo', '[SX4](=O)(=O)[OX2H1]', None),
    ('nitrile', '[CX2]#[NX1]', None),
    ('phenolOH', 'c[OX2][#1]', (1, 2)),
    ('hydroxyl', '[#6;!a;!$(C=O)][OX2][#1]', (1, 2)),
    ('ether', '[OX2;!$(O[#1])]([#6;!$(C=O);!$([N+])])[#6;!$(C=O)]', (0,)),
    ('amino', '[NX3;!a;!$(N[C,S]=[O,S,N]);!$([N+])]', None),
    ('halogen', '[#6][F,Cl,Br,I]', (1,)),
    ('alkene', '[C;!a]=[C;!a]', None),
    ('alkyne', '[C]#[C]', None),
]
GROUP_PATTS = [(k, Chem.MolFromSmarts(s), anc) for k, s, anc in GROUPS]


def parse_formula(s):
    """Состав из записи формулы реестра (брутто или сокращённая структурная: C₆H₅–COOH, C(C₂H₅)₄)."""
    s = s.translate(SUB)
    s = re.sub(r'[–\-=≡·\s]', '', s)

    def p(i):
        c = Counter()
        while i < len(s):
            ch = s[i]
            if ch in '([':
                inner, i = p(i + 1)
                m = re.match(r'\d+', s[i:])
                k = int(m.group()) if m else 1
                i += len(m.group()) if m else 0
                for e, n in inner.items():
                    c[e] += n * k
            elif ch in ')]':
                return c, i + 1
            else:
                m = re.match(r'([A-Z][a-z]?)(\d*)', s[i:])
                if not m:
                    i += 1
                    continue
                c[m.group(1)] += int(m.group(2) or 1)
                i += len(m.group())
        return c, i

    return p(0)[0]


def read_grade_map():
    """ORGANIC_GRADE_MAP из compoundGradeMap.generated.ts → {id: [классы]}."""
    txt = io.open(GRADE_TS, encoding='utf-8').read()
    i = txt.index('export const ORGANIC_GRADE_MAP')
    body = txt[txt.index('{', txt.index('=', i)):]
    depth = 0
    for j, ch in enumerate(body):
        depth += ch == '{'
        depth -= ch == '}'
        if depth == 0:
            body = body[: j + 1]
            break
    body = re.sub(r',(\s*[}\]])', r'\1', body)
    return {k: v.get('grades', []) for k, v in json.loads(body).items()}


def mol_from_graph(m):
    rw = Chem.RWMol()
    idx = {}
    for a in m['atoms']:
        at = Chem.Atom(a['el'])
        v = a['v']
        if v is not None:
            if a['el'] == 'N' and v == 4:
                at.SetFormalCharge(1)
            if a['el'] == 'O' and v == 1:
                at.SetFormalCharge(-1)
        at.SetNoImplicit(True)
        idx[a['id']] = rw.AddAtom(at)
    for a, b, o in m['bonds']:
        rw.AddBond(idx[a], idx[b], BT[o])
    mol = rw.GetMol()
    Chem.SanitizeMol(mol)
    return mol


def composition(mol):
    c = Counter()
    for a in mol.GetAtoms():
        c[a.GetSymbol()] += 1
        c['H'] += a.GetTotalNumHs()
    return c


# ── проверки стереохимии ──
def cip_labels(mol):
    m = Chem.Mol(mol)
    rdCIPLabeler.AssignCIPLabels(m)
    atoms = {a.GetIdx(): a.GetProp('_CIPCode') for a in m.GetAtoms() if a.HasProp('_CIPCode')}
    bonds = {b.GetIdx(): b.GetProp('_CIPCode') for b in m.GetBonds() if b.HasProp('_CIPCode')}
    return atoms, bonds


def hydrolyze(mol):
    """Гидролиз гликозидных (C_аномерный–O–C) и сложноэфирных (C(=O)–O–C) связей → канонические SMILES кусков."""
    mol = Chem.RemoveHs(mol)
    ri = mol.GetRingInfo()
    cut = []
    used_o = set()
    for b in mol.GetBonds():
        a1, a2 = b.GetBeginAtom(), b.GetEndAtom()
        for c, o in ((a1, a2), (a2, a1)):
            if c.GetSymbol() != 'C' or o.GetSymbol() != 'O' or b.GetBondType() != Chem.BondType.SINGLE:
                continue
            if ri.NumAtomRings(o.GetIdx()) or o.GetDegree() != 2 or o.GetIdx() in used_o:
                continue
            other = [n for n in o.GetNeighbors() if n.GetIdx() != c.GetIdx()][0]
            if other.GetSymbol() != 'C':
                continue
            acyl = any(n.GetSymbol() == 'O' and mol.GetBondBetweenAtoms(c.GetIdx(), n.GetIdx()).GetBondType() == Chem.BondType.DOUBLE for n in c.GetNeighbors())
            anomeric = c.IsInRing() and any(n.GetSymbol() == 'O' and ri.NumAtomRings(n.GetIdx()) and n.GetIdx() != o.GetIdx() for n in c.GetNeighbors())
            if acyl or anomeric:
                cut.append((b.GetIdx(), c.GetIdx(), o.GetIdx()))
                used_o.add(o.GetIdx())
    if not cut:
        return [Chem.MolToSmiles(mol)]
    frag = Chem.FragmentOnBonds(mol, [x[0] for x in cut], addDummies=True)
    rw = Chem.RWMol(frag)
    for a in rw.GetAtoms():
        if a.GetAtomicNum() == 0:
            nb = a.GetNeighbors()[0]
            a.SetAtomicNum(1 if nb.GetSymbol() == 'O' else 8)
            a.SetIsotope(0)
    m2 = rw.GetMol()
    Chem.SanitizeMol(m2)
    m2 = Chem.RemoveHs(m2)
    return sorted(Chem.MolToSmiles(f) for f in Chem.GetMolFrags(m2, asMols=True))


MONO_CAN = {k: Chem.MolToSmiles(Chem.MolFromSmiles(v)) for k, v in MONO.items()}
for k, v in MONO.items():
    assert Chem.MolToInchiKey(Chem.MolFromSmiles(v)) == MONO_KEYS[k], k


def check_expect(mid, mol_out, exp, problems):
    """mol_out — итоговая молекула со стереохимией, назначенной ИЗ 3D (проверяем то, что реально в координатах)."""
    atoms_cip, bonds_cip = cip_labels(mol_out)
    if 'ez' in exp:
        vals = set(bonds_cip.values())
        if vals != {exp['ez']}:
            problems.append(f'{mid}: E/Z {sorted(vals)} ≠ {exp["ez"]}')
    if 'cip' in exp:
        got = ''.join(atoms_cip[i] for i in sorted(atoms_cip, key=lambda i: smiles_rank(mol_out, i)))
        if got != exp['cip']:
            problems.append(f'{mid}: CIP {got} ≠ {exp["cip"]}')
    if 'mono' in exp:
        if Chem.MolToInchiKey(mol_out) != MONO_KEYS[exp['mono']]:
            problems.append(f'{mid}: не {exp["mono"]}')
    if 'hydrolysis' in exp:
        want = sorted(MONO_CAN[x] if x in MONO_CAN else Chem.MolToSmiles(Chem.MolFromSmiles(x)) for x in exp["hydrolysis"])
        got = hydrolyze(mol_out)
        if got != want:
            problems.append(f'{mid}: гидролиз {got} ≠ {want}')
    if 'inchikey' in exp and Chem.MolToInchiKey(mol_out) != exp['inchikey']:
        problems.append(f'{mid}: InChIKey {Chem.MolToInchiKey(mol_out)} ≠ {exp["inchikey"]}')


_RANK = {}


def smiles_rank(mol, i):
    return _RANK.get(i, i)


# ── 3D ──
def heavy_branch_size(mol, start, exclude):
    seen = {exclude, start}
    stack = [start]
    n = 0
    while stack:
        a = stack.pop()
        n += 1
        for nb in mol.GetAtomWithIdx(a).GetNeighbors():
            j = nb.GetIdx()
            if j not in seen and nb.GetAtomicNum() > 1:
                seen.add(j)
                stack.append(j)
    return n


def zigzag_torsions(mol):
    """Торсии главной цепи для вытянутой конформации: C(sp³)–C(sp³) и C–O эфира/спирта вне колец, анти между крупнейшими ветвями."""
    out = []
    for b in mol.GetBonds():
        if b.IsInRing() or b.GetBondType() != Chem.BondType.SINGLE:
            continue
        x, y = b.GetBeginAtom(), b.GetEndAtom()
        if x.GetAtomicNum() == 1 or y.GetAtomicNum() == 1:
            continue
        if x.GetHybridization() != Chem.HybridizationType.SP3 or y.GetHybridization() != Chem.HybridizationType.SP3:
            continue
        hx = [n for n in x.GetNeighbors() if n.GetAtomicNum() > 1 and n.GetIdx() != y.GetIdx()]
        hy = [n for n in y.GetNeighbors() if n.GetAtomicNum() > 1 and n.GetIdx() != x.GetIdx()]
        if not hx or not hy:
            continue
        a = max(hx, key=lambda n: heavy_branch_size(mol, n.GetIdx(), x.GetIdx())).GetIdx()
        d = max(hy, key=lambda n: heavy_branch_size(mol, n.GetIdx(), y.GetIdx())).GetIdx()
        out.append((a, x.GetIdx(), y.GetIdx(), d))
    return out


def longest_acyclic_chain(mol):
    heavy = [a.GetIdx() for a in mol.GetAtoms() if a.GetAtomicNum() > 1 and not a.IsInRing()]
    hs = set(heavy)
    best = 0
    for s in heavy:
        dist = {s: 0}
        q = [s]
        while q:
            a = q.pop(0)
            for nb in mol.GetAtomWithIdx(a).GetNeighbors():
                j = nb.GetIdx()
                if j in hs and j not in dist:
                    dist[j] = dist[a] + 1
                    q.append(j)
        best = max(best, max(dist.values()) + 1)
    return best


def elongation(conf, idxs):
    import numpy as np
    xyz = np.array([[conf.GetAtomPosition(i).x, conf.GetAtomPosition(i).y, conf.GetAtomPosition(i).z] for i in idxs])
    xyz -= xyz.mean(0)
    ev = sorted(np.linalg.eigvalsh(xyz.T @ xyz / len(xyz)), reverse=True)
    return ev[0] / max(ev[1], 1e-6)


def embed_3d(mol, long_chain, fat):
    n = mol.GetNumAtoms()
    nconf = 16 if n < 40 else 10 if n < 90 else 8 if n < 130 else 6
    if fat:
        nconf = 24
    ps = AllChem.ETKDGv3()
    ps.randomSeed = 2026
    ps.pruneRmsThresh = 0.1 if n < 90 else -1
    cids = list(AllChem.EmbedMultipleConfs(mol, numConfs=nconf, params=ps))
    if not cids:
        ps.useRandomCoords = True
        cids = list(AllChem.EmbedMultipleConfs(mol, numConfs=max(4, nconf // 2), params=ps))
    if not cids:
        raise RuntimeError('embed failed')
    props = AllChem.MMFFGetMoleculeProperties(mol)
    tors = zigzag_torsions(mol) if long_chain else []
    res = []
    for cid in cids:
        conf = mol.GetConformer(cid)
        for a, b, c, d in tors:
            try:
                rdMolTransforms.SetDihedralDeg(conf, a, b, c, d, 180.0)
            except Exception:
                pass
        ff = AllChem.MMFFGetMoleculeForceField(mol, props, confId=cid)
        ff.Minimize(maxIts=8000)
        res.append((cid, ff.CalcEnergy()))
    emin = min(e for _, e in res)
    if fat or long_chain:
        heavy = [a.GetIdx() for a in mol.GetAtoms() if a.GetAtomicNum() > 1]
        window = 25.0 if fat else 6.0
        cand = [(cid, e) for cid, e in res if e - emin <= window]
        best = max(cand, key=lambda t: elongation(mol.GetConformer(t[0]), heavy) - 0.02 * (t[1] - emin))
    else:
        best = min(res, key=lambda t: t[1])
    return best[0], best[1]


def align_principal(mol, conf):
    """Центр в начало координат, длинная ось молекулы → x, вторая → y (поворот без отражения — хиральность цела)."""
    import numpy as np
    from rdkit.Geometry import Point3D
    n = mol.GetNumAtoms()
    xyz = np.array([[conf.GetAtomPosition(i).x, conf.GetAtomPosition(i).y, conf.GetAtomPosition(i).z] for i in range(n)])
    heavy = [a.GetIdx() for a in mol.GetAtoms() if a.GetAtomicNum() > 1] or list(range(n))
    c = xyz[heavy].mean(0)
    h = xyz[heavy] - c
    w, v = np.linalg.eigh(h.T @ h)
    v = v[:, ::-1]
    if np.linalg.det(v) < 0:
        v[:, 2] = -v[:, 2]
    out = (xyz - c) @ v
    for i in range(n):
        conf.SetAtomPosition(i, Point3D(*map(float, out[i])))


def compute_2d(mol):
    """2D скелетной формулы по тяжёлым атомам (CoordGen), H — по направлениям (AddHs addCoords); единица = связь."""
    heavy = Chem.RemoveHs(mol, implicitOnly=False, updateExplicitCount=True, sanitize=True)
    try:
        rdDepictor.SetPreferCoordGen(True)
    except Exception:
        pass
    rdDepictor.Compute2DCoords(heavy)
    # тяжёлые атомы RemoveHs сохраняют порядок: k-й тяжёлый в mol = k-й в heavy
    hidx = [a.GetIdx() for a in mol.GetAtoms() if a.GetAtomicNum() > 1]
    withh = Chem.AddHs(heavy, addCoords=True)
    c2 = withh.GetConformer()
    lens = [(c2.GetAtomPosition(b.GetBeginAtomIdx()) - c2.GetAtomPosition(b.GetEndAtomIdx())).Length() for b in heavy.GetBonds()]
    unit = sorted(lens)[len(lens) // 2] if lens else 1.5
    p2 = [None] * mol.GetNumAtoms()
    for k, i in enumerate(hidx):
        q = c2.GetAtomPosition(k)
        p2[i] = (q.x / unit, q.y / unit)
    # H: у каждого тяжёлого атома — его H в withh по порядку
    for k, i in enumerate(hidx):
        hs_new = [n.GetIdx() for n in withh.GetAtomWithIdx(k).GetNeighbors() if n.GetAtomicNum() == 1]
        hs_old = [n.GetIdx() for n in mol.GetAtomWithIdx(i).GetNeighbors() if n.GetAtomicNum() == 1]
        for ho, hn in zip(hs_old, hs_new):
            q = c2.GetAtomPosition(hn)
            # H короче связи — 0,6 единицы от атома (подписи не налезают)
            px, py = p2[i]
            dx, dy = q.x / unit - px, q.y / unit - py
            L = math.hypot(dx, dy) or 1
            p2[ho] = (px + 0.6 * dx / L, py + 0.6 * dy / L)
    for i, v in enumerate(p2):
        if v is None:  # изолированный H (H₂) — не бывает в реестре
            p2[i] = (0.0, 0.0)
    return p2


def groups_of(mol):
    out = []
    seen = set()
    taken_o = set()
    for key, patt, anc in GROUP_PATTS:
        for match in mol.GetSubstructMatches(patt):
            atoms = tuple(match[i] for i in anc) if anc else tuple(match)
            if key in ('hydroxyl', 'phenolOH', 'ether') and atoms[0] in taken_o:
                continue
            if key == 'amino' and any(a in taken_o for a in atoms):
                continue
            sig = (key, tuple(sorted(atoms)))
            if sig in seen:
                continue
            seen.add(sig)
            if key in ('carboxyl', 'ester', 'nitrate', 'sulfo', 'amide', 'nitro'):
                taken_o.update(atoms)
            out.append({'key': key, 'atoms': sorted(atoms)})
    ri = mol.GetRingInfo()
    for ring in ri.AtomRings():
        if all(mol.GetAtomWithIdx(i).GetIsAromatic() for i in ring):
            out.append({'key': 'arene', 'atoms': list(ring)})
    return out


def all_e_variant(mol):
    """Если у C=C стереохимия не задана — для 3D берём E-изомер (SMILES остаётся без стерео)."""
    si = [s for s in Chem.FindPotentialStereo(mol) if s.type == Chem.StereoType.Bond_Double and s.specified == Chem.StereoSpecified.Unspecified]
    if not si:
        return mol
    opts = StereoEnumerationOptions(onlyUnassigned=True, unique=True, maxIsomers=4096)
    for iso in EnumerateStereoisomers(mol, options=opts):
        _, bcip = cip_labels(iso)
        if bcip and set(bcip.values()) == {'E'}:
            return iso
    return mol


def r(x, n=3):
    v = round(x, n)
    return 0.0 if v == 0 else v


def main():
    t0 = time.time()
    graphs = json.load(io.open(SRC, encoding='utf-8'))
    grade_map = read_grade_map()
    out, out3d, problems, notes = {}, {}, [], []
    for m in graphs:
        mid = m['id']
        if ONLY and mid not in ONLY:
            continue
        reg_comp = Counter(a['el'] for a in m['atoms'])
        fcomp = parse_formula(m['formula'])
        try:
            gmol = mol_from_graph(m)
        except Exception as e:  # noqa: BLE001
            gmol = None
            notes.append(f'{mid}: граф реестра не проходит валентность ({str(e)[:60]}) — взят SMILES таблицы')
        st = STEREO.get(mid)
        smi = st['smiles'] if st else Chem.MolToSmiles(Chem.RemoveHs(gmol))
        rmol = Chem.AddHs(Chem.MolFromSmiles(smi))
        if composition(rmol) != fcomp:
            problems.append(f'{mid}: состав SMILES {dict(composition(rmol))} ≠ formula {m["formula"]} {dict(fcomp)}')
        same_graph = gmol is not None and composition(gmol) == composition(rmol)
        if same_graph:
            match = rmol.GetSubstructMatch(gmol)
            if len(match) == gmol.GetNumAtoms():
                rmol = Chem.RenumberAtoms(rmol, list(match))
            else:
                same_graph = False
                notes.append(f'{mid}: граф реестра ≠ правильной молекуле — порядок атомов новый')
        elif gmol is not None:
            notes.append(f'{mid}: состав графа реестра {dict(reg_comp)} ≠ правильному — граф заменён')
        if gmol is not None and same_graph and reg_comp != fcomp:
            problems.append(f'{mid}: граф ≠ formula')
        # ранги атомов в исходной строке SMILES (для сверки CIP по порядку записи)
        _RANK.clear()
        ref = Chem.MolFromSmiles(smi)
        ref_h = Chem.AddHs(ref)
        mm = rmol.GetSubstructMatch(ref_h, useChirality=False)
        for k, i in enumerate(mm):
            _RANK[i] = k
        emb = all_e_variant(rmol)
        chain = longest_acyclic_chain(emb)
        fat = m['classId'] == 'ester' and smi.count('C(=O)O') >= 3 and chain >= 12
        long_chain = chain >= 7
        cid, energy = embed_3d(emb, long_chain, fat)
        conf = emb.GetConformer(cid)
        align_principal(emb, conf)
        # стереохимия — из 3D (проверяем то, что реально в координатах)
        m3 = Chem.Mol(emb, confId=cid) if False else Chem.Mol(emb)
        m3.RemoveAllConformers()
        m3.AddConformer(Chem.Conformer(conf), assignId=True)
        Chem.AssignStereochemistryFrom3D(m3)
        if st:
            check_expect(mid, m3, st['expect'], problems)
            want = Chem.MolToInchiKey(Chem.MolFromSmiles(smi))
            m3c = Chem.Mol(m3)  # сверяем только стерео, заданную в SMILES (C2 глицерина и т. п. не задан)
            for a in m3c.GetAtoms():
                if rmol.GetAtomWithIdx(a.GetIdx()).GetChiralTag() == Chem.ChiralType.CHI_UNSPECIFIED:
                    a.SetChiralTag(Chem.ChiralType.CHI_UNSPECIFIED)
            for b in m3c.GetBonds():
                if rmol.GetBondWithIdx(b.GetIdx()).GetStereo() == Chem.BondStereo.STEREONONE:
                    b.SetStereo(Chem.BondStereo.STEREONONE)
            m3c.RemoveAllConformers()  # иначе InChI берёт стерео из 3D-координат
            Chem.AssignStereochemistry(m3c, cleanIt=True, force=True)
            if Chem.MolToInchiKey(m3c) != want:
                problems.append(f'{mid}: 3D потеряло стереохимию SMILES')
        atoms_cip, bonds_cip = cip_labels(m3) if st else ({}, {})
        if not st:  # E/Z показываем и там, где учебник изомер не задаёт (3D построено для E)
            _, bonds_cip = cip_labels(m3)
        AllChem.ComputeGasteigerCharges(emb)
        p2 = compute_2d(emb)
        kek = Chem.Mol(emb)
        Chem.Kekulize(kek, clearAromaticFlags=False)
        atoms = []
        for a in emb.GetAtoms():
            i = a.GetIdx()
            p = conf.GetAtomPosition(i)
            q = float(a.GetProp('_GasteigerCharge'))
            if math.isnan(q):
                q = 0.0
            hyb = '' if a.GetAtomicNum() == 1 or a.GetSymbol() in ('Cl', 'Br', 'I', 'F') else HYB.get(a.GetHybridization(), '')
            at = {'el': a.GetSymbol(), 'p': [r(p.x), r(p.y), r(p.z)], 'p2': [r(p2[i][0]), r(p2[i][1])], 'hyb': hyb,
                  'q': r(q), 'ch': a.GetFormalCharge(), 'ar': a.GetIsAromatic()}
            if i in atoms_cip and atoms_cip[i] in ('R', 'S'):
                at['cip'] = atoms_cip[i]
            atoms.append(at)
        bonds = []
        for b in kek.GetBonds():
            o = {Chem.BondType.SINGLE: 1, Chem.BondType.DOUBLE: 2, Chem.BondType.TRIPLE: 3}[b.GetBondType()]
            bd = {'a': b.GetBeginAtomIdx(), 'b': b.GetEndAtomIdx(), 'o': o}
            if b.GetIsAromatic():
                bd['ar'] = True
            if b.GetIdx() in bonds_cip and bonds_cip[b.GetIdx()] in ('E', 'Z'):
                bd['ez'] = bonds_cip[b.GetIdx()]
            bonds.append(bd)
        iso_smiles = Chem.MolToSmiles(Chem.MolFromSmiles(smi))
        grades = grade_map.get(mid) or ([11] if m.get('textbookGrade') == 'g11' else [10])
        rec = {
            'id': mid,
            'smiles': iso_smiles,
            'inchikey': Chem.MolToInchiKey(Chem.MolFromSmiles(smi)),
            'formula': rdMolDescriptors.CalcMolFormula(emb),
            'atoms': atoms,
            'bonds': bonds,
            'groups': groups_of(emb),
            'rings': [list(x) for x in emb.GetRingInfo().AtomRings()],
            'grades': sorted(set(grades)),
            'energy': r(energy, 2),
        }
        out[mid] = rec
        out3d[mid] = {
            'el': ''.join(f'{a["el"]},' for a in atoms)[:-1],
            'p': [v for a in atoms for v in (round(a['p'][0], 2), round(a['p'][1], 2), round(a['p'][2], 2))],
            'b': [v for b in bonds for v in (b['a'], b['b'], b['o'])],
        }
        if time.time() - t0 > 0 and len(out) % 40 == 0:
            print(f'  {len(out)} … {round(time.time() - t0)} с', flush=True)
    # уникальность InChIKey
    by_key = {}
    for mid, rec in out.items():
        by_key.setdefault(rec['inchikey'], []).append(mid)
    dups = {k: v for k, v in by_key.items() if len(v) > 1}
    for n in notes:
        print('NOTE', n)
    print('дубли InChIKey (одно и то же вещество под разными id):', json.dumps(dups, ensure_ascii=False))
    for p in problems:
        print('PROBLEM', p)
    if ONLY:
        print('частичный прогон — файлы не пишем')
        return
    if problems:
        print('ОШИБКИ — файлы не записаны')
        sys.exit(1)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    ordered = {m['id']: out[m['id']] for m in graphs}
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write(json.dumps(ordered, ensure_ascii=False, separators=(',', ':')))
    io.open(OUT3D, 'w', encoding='utf-8', newline='\n').write(json.dumps({k: out3d[k] for k in ordered}, separators=(',', ':')))
    print('molecules', len(ordered), 'за', round(time.time() - t0, 1), 'с;',
          'molecules.json', round(os.path.getsize(OUT) / 1024), 'КБ; molecules3d.json', round(os.path.getsize(OUT3D) / 1024), 'КБ')


if __name__ == '__main__':
    main()
