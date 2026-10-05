"""Органика v2: атомное соответствие реакции (какой атом слева стал каким справа).

Способ (школьный механизм ≈ минимум изменённых связей):
  1) тяжёлые атомы — повторный поиск наибольшей общей подструктуры (RDKit FMCS: элементы + кратность) между
     ещё не сопоставленными частями исходных и продуктов; остаток — жадно по элементу и соседям;
  2) водороды — сначала «свой» H того же тяжёлого атома, остаток — любой;
  3) улучшение обменами атомов одного элемента, пока падает «стоимость» изменений связей. Веса склоняют к
     школьному механизму: C–C рвётся неохотно, связь O с алкильным C (не карбонильным) — тоже (этерификация:
     O спирта остаётся в эфире, вода — из OH кислоты и H спирта; гидролиз — обратно).
"""
from rdkit import Chem
from rdkit.Chem import rdFMCS

KEK = {Chem.BondType.SINGLE: 1, Chem.BondType.DOUBLE: 2, Chem.BondType.TRIPLE: 3}


class Side:
    """Все участники одной стороны как один граф (копии коэффициентов — отдельные молекулы)."""

    def __init__(self, mols):
        self.el = []
        self.owner = []  # номер молекулы
        self.bonds = {}  # (i, j) i<j -> (кратность Кекуле, ароматическая)
        self.adj = []
        self.carbonyl = []  # C с двойной связью к O (карбонил/карбоксил)
        self.mols = mols
        self.offsets = []
        off = 0
        for k, m in enumerate(mols):
            self.offsets.append(off)
            kek = Chem.Mol(m)
            try:
                Chem.Kekulize(kek, clearAromaticFlags=False)
            except Exception:
                pass
            for a in m.GetAtoms():
                self.el.append(a.GetSymbol())
                self.owner.append(k)
                self.adj.append([])
                self.carbonyl.append(False)
            for b in kek.GetBonds():
                i, j = b.GetBeginAtomIdx() + off, b.GetEndAtomIdx() + off
                o = KEK.get(b.GetBondType(), 1)
                ar = m.GetBondWithIdx(b.GetIdx()).GetIsAromatic()
                self.bonds[(min(i, j), max(i, j))] = (o, ar)
                self.adj[i].append(j)
                self.adj[j].append(i)
            off += m.GetNumAtoms()
        for (i, j), (o, ar) in self.bonds.items():
            if o == 2 and not ar:
                if self.el[i] == 'C' and self.el[j] == 'O':
                    self.carbonyl[i] = True
                if self.el[j] == 'C' and self.el[i] == 'O':
                    self.carbonyl[j] = True
        self.n = len(self.el)

    def bond(self, i, j):
        return self.bonds.get((min(i, j), max(i, j)))


def _heavy_sub(side, atoms):
    """Подграф тяжёлых атомов `atoms` (глобальные номера) как RDKit-молекула для FMCS + обратная карта."""
    rw = Chem.RWMol()
    back = []
    loc = {}
    for g in atoms:
        a = Chem.Atom(side.el[g])
        a.SetNoImplicit(True)
        loc[g] = rw.AddAtom(a)
        back.append(g)
    for g in atoms:
        for h in side.adj[g]:
            if h in loc and g < h:
                o, ar = side.bond(g, h)
                bt = Chem.BondType.AROMATIC if ar else {1: Chem.BondType.SINGLE, 2: Chem.BondType.DOUBLE, 3: Chem.BondType.TRIPLE}[o]
                rw.AddBond(loc[g], loc[h], bt)
                if ar:
                    rw.GetBondWithIdx(rw.GetNumBonds() - 1).SetIsAromatic(True)
                    rw.GetAtomWithIdx(loc[g]).SetIsAromatic(True)
                    rw.GetAtomWithIdx(loc[h]).SetIsAromatic(True)
    m = rw.GetMol()
    m.UpdatePropertyCache(strict=False)
    Chem.FastFindRings(m)
    return m, back


def _components(side, atoms):
    left = set(atoms)
    comps = []
    while left:
        s = left.pop()
        comp = [s]
        stack = [s]
        while stack:
            x = stack.pop()
            for y in side.adj[x]:
                if y in left:
                    left.remove(y)
                    comp.append(y)
                    stack.append(y)
        comps.append(sorted(comp))
    return comps


def change_cost(L, R, inv, la, lb):
    """Стоимость пары атомов L (la, lb) при отображении inv: L-атом -> R-атом."""
    bl = L.bond(la, lb)
    br = R.bond(inv[la], inv[lb])
    fo = bl[0] if bl else 0
    to = br[0] if br else 0
    if bl and br and bl[1] and br[1]:
        return 0.0
    if fo == to:
        return 0.0
    c = 1.0
    if to == 0:
        e = {L.el[la], L.el[lb]}
        if e == {'C'}:
            c += 0.5
        elif e == {'C', 'O'}:
            cc = la if L.el[la] == 'C' else lb
            if not L.carbonyl[cc]:
                c += 0.2
        elif e == {'C', 'H'}:
            c += 0.05
    return c


def total_cost(L, R, inv):
    fwd = {r: l for l, r in inv.items()}
    pairs = set(L.bonds.keys())
    for (i, j) in R.bonds.keys():
        a, b = fwd[i], fwd[j]
        pairs.add((min(a, b), max(a, b)))
    return sum(change_cost(L, R, inv, a, b) for a, b in pairs)


def _local_pairs(L, R, inv, fwd, ls):
    pairs = set()
    for l in ls:
        for m in L.adj[l]:
            pairs.add((min(l, m), max(l, m)))
        r = inv[l]
        for s in R.adj[r]:
            m = fwd[s]
            pairs.add((min(l, m), max(l, m)))
    return pairs


def map_reaction(lmols, rmols, timeout=2):
    """Возвращает (L, R, inv) — inv[номер атома слева] = номер атома справа."""
    L = Side(lmols)
    R = Side(rmols)
    if sorted(L.el) != sorted(R.el):
        raise ValueError('элементы слева и справа не совпадают')
    inv = {}
    usedL, usedR = set(), set()
    heavyL = [i for i in range(L.n) if L.el[i] != 'H']
    heavyR = [i for i in range(R.n) if R.el[i] != 'H']
    # 1) FMCS по тяжёлым атомам
    for _ in range(40):
        lc = _components(L, [i for i in heavyL if i not in usedL])
        rc = _components(R, [i for i in heavyR if i not in usedR])
        best = None
        for la in lc:
            if len(la) < 2:
                continue
            lm, lback = _heavy_sub(L, la)
            for ra in rc:
                if len(ra) < 2:
                    continue
                if not set(L.el[i] for i in la) & set(R.el[i] for i in ra):
                    continue
                rm, rback = _heavy_sub(R, ra)
                res = rdFMCS.FindMCS([lm, rm], atomCompare=rdFMCS.AtomCompare.CompareElements,
                                     bondCompare=rdFMCS.BondCompare.CompareOrder, ringMatchesRingOnly=False,
                                     completeRingsOnly=False, matchValences=False, timeout=timeout)
                if res.numAtoms < 2:
                    continue
                key = (res.numBonds, res.numAtoms, -abs(len(la) - len(ra)))
                if best is None or key > best[0]:
                    best = (key, res.smartsString, lm, lback, rm, rback)
        if best is None:
            break
        q = Chem.MolFromSmarts(best[1])
        ml = best[2].GetSubstructMatch(q)
        mr = best[4].GetSubstructMatch(q)
        if not ml or not mr:
            break
        for a, b in zip(ml, mr):
            gl, gr = best[3][a], best[5][b]
            inv[gl] = gr
            usedL.add(gl)
            usedR.add(gr)
    # 2) остаток тяжёлых — жадно по элементу и согласованным соседям
    fwd = {r: l for l, r in inv.items()}
    restR = [i for i in heavyR if i not in usedR]
    restL = [i for i in heavyL if i not in usedL]
    while restR:
        def score_r(r):
            return sum(1 for s in R.adj[r] if s in fwd)
        restR.sort(key=score_r, reverse=True)
        r = restR.pop(0)
        cands = [l for l in restL if L.el[l] == R.el[r]]
        def score_l(l):
            return sum(1 for s in R.adj[r] if s in fwd and fwd[s] in L.adj[l])
        l = max(cands, key=score_l)
        restL.remove(l)
        inv[l] = r
        fwd[r] = l
    # 3) водороды
    freeL = set(i for i in range(L.n) if L.el[i] == 'H')
    restRH = []
    for r in range(R.n):
        if R.el[r] != 'H':
            continue
        heavy = [s for s in R.adj[r] if R.el[s] != 'H']
        got = None
        if heavy and heavy[0] in fwd:
            l0 = fwd[heavy[0]]
            for m in L.adj[l0]:
                if m in freeL:
                    got = m
                    break
        if got is None:
            restRH.append(r)
        else:
            freeL.discard(got)
            inv[got] = r
            fwd[r] = got
    # пары H–H (H₂ справа) — сначала из H₂ слева
    fl = sorted(freeL)
    for r in restRH:
        l = fl.pop(0)
        inv[l] = r
        fwd[r] = l
    # 4) улучшение обменами
    byEl = {}
    for l in range(L.n):
        byEl.setdefault(L.el[l], []).append(l)
    for _ in range(8):
        improved = False
        bad = set()
        for (a, b) in set(L.bonds.keys()) | set((min(fwd[i], fwd[j]), max(fwd[i], fwd[j])) for (i, j) in R.bonds.keys()):
            if change_cost(L, R, inv, a, b) > 0:
                bad.add(a)
                bad.add(b)
        for l1 in sorted(bad):
            for l2 in byEl[L.el[l1]]:
                if l2 == l1:
                    continue
                ps = _local_pairs(L, R, inv, fwd, (l1, l2))
                before = sum(change_cost(L, R, inv, a, b) for a, b in ps)
                r1, r2 = inv[l1], inv[l2]
                inv[l1], inv[l2] = r2, r1
                fwd[r1], fwd[r2] = l2, l1
                ps2 = ps | _local_pairs(L, R, inv, fwd, (l1, l2))
                after = sum(change_cost(L, R, inv, a, b) for a, b in ps2)
                inv[l1], inv[l2] = r1, r2
                fwd[r1], fwd[r2] = l1, l2
                before2 = sum(change_cost(L, R, inv, a, b) for a, b in ps2)
                if after < before2 - 1e-9:
                    inv[l1], inv[l2] = r2, r1
                    fwd[r1], fwd[r2] = l2, l1
                    improved = True
        if not improved:
            break
    return L, R, inv


def bond_changes(L, R, inv):
    """Список изменений связей в номерах L-атомов: (la, lb, from, to)."""
    fwd = {r: l for l, r in inv.items()}
    pairs = set(L.bonds.keys())
    for (i, j) in R.bonds.keys():
        a, b = fwd[i], fwd[j]
        pairs.add((min(a, b), max(a, b)))
    out = []
    for a, b in sorted(pairs):
        bl = L.bond(a, b)
        br = R.bond(inv[a], inv[b])
        if bl and br and bl[1] and br[1]:
            continue
        fo = bl[0] if bl else 0
        to = br[0] if br else 0
        if fo != to:
            out.append((a, b, fo, to))
    return out
