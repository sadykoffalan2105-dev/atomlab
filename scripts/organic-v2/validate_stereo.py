"""
Органика v2 — независимая проверка стереохимии ГОТОВЫХ данных (molecules.json), без конвейера сборки.
  python scripts/organic-v2/validate_stereo.py
Для каждой молекулы: граф atoms/bonds + 3D-координаты → RDKit → стереохимия из 3D → сверка:
  - состав = formula; связность = SMILES записи (InChIKey без стерео-слоя);
  - если SMILES записи со стереохимией — InChIKey из 3D (только заданные в SMILES центры/связи) = inchikey записи;
  - метки cip у атомов и ez у связей = CIP, посчитанному заново из 3D.
"""
import io
import json
import os
import sys

from rdkit import Chem, RDLogger
from rdkit.Chem import rdCIPLabeler, rdMolDescriptors
from rdkit.Geometry import Point3D

RDLogger.DisableLog('rdApp.*')
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
M = json.load(io.open(os.path.join(ROOT, 'src', 'data', 'organicV2', 'molecules.json'), encoding='utf-8'))
BT = {1: Chem.BondType.SINGLE, 2: Chem.BondType.DOUBLE, 3: Chem.BondType.TRIPLE}


def from_record(rec):
    rw = Chem.RWMol()
    for a in rec['atoms']:
        at = Chem.Atom(a['el'])
        at.SetFormalCharge(a['ch'])
        at.SetNoImplicit(True)
        rw.AddAtom(at)
    for b in rec['bonds']:
        rw.AddBond(b['a'], b['b'], BT[b['o']])
    m = rw.GetMol()
    Chem.SanitizeMol(m)
    conf = Chem.Conformer(m.GetNumAtoms())
    for i, a in enumerate(rec['atoms']):
        conf.SetAtomPosition(i, Point3D(*a['p']))
    m.AddConformer(conf, assignId=True)
    Chem.AssignStereochemistryFrom3D(m)
    return m


def main():
    bad = []
    n_st = n_cip = n_ez = 0
    for mid, rec in M.items():
        m = from_record(rec)
        if rdMolDescriptors.CalcMolFormula(m) != rec['formula']:
            bad.append(f'{mid}: формула')
        ref = Chem.MolFromSmiles(rec['smiles'])
        if Chem.MolToInchiKey(m).split('-')[0] != rec['inchikey'].split('-')[0]:
            bad.append(f'{mid}: связность ≠ SMILES')
        has_stereo = '@' in rec['smiles'] or '/' in rec['smiles'] or '\\' in rec['smiles']
        if has_stereo:
            n_st += 1
            # оставляем только стереоэлементы, заданные в SMILES записи (сопоставление по подструктуре)
            refh = Chem.AddHs(ref)
            match = m.GetSubstructMatch(refh)
            if len(match) != m.GetNumAtoms():
                bad.append(f'{mid}: не сопоставить с SMILES')
                continue
            keep_atoms = {match[i] for i, a in enumerate(refh.GetAtoms()) if a.GetChiralTag() != Chem.ChiralType.CHI_UNSPECIFIED}
            keep_bonds = set()
            for b in refh.GetBonds():
                if b.GetStereo() != Chem.BondStereo.STEREONONE:
                    keep_bonds.add(frozenset((match[b.GetBeginAtomIdx()], match[b.GetEndAtomIdx()])))
            mc = Chem.Mol(m)
            for a in mc.GetAtoms():
                if a.GetIdx() not in keep_atoms:
                    a.SetChiralTag(Chem.ChiralType.CHI_UNSPECIFIED)
            for b in mc.GetBonds():
                if frozenset((b.GetBeginAtomIdx(), b.GetEndAtomIdx())) not in keep_bonds:
                    b.SetStereo(Chem.BondStereo.STEREONONE)
            mc.RemoveAllConformers()
            Chem.AssignStereochemistry(mc, cleanIt=True, force=True)
            if Chem.MolToInchiKey(mc) != rec['inchikey']:
                bad.append(f'{mid}: стереохимия 3D {Chem.MolToInchiKey(mc)} ≠ {rec["inchikey"]}')
        mm = Chem.Mol(m)
        rdCIPLabeler.AssignCIPLabels(mm)
        for a, ra in zip(mm.GetAtoms(), rec['atoms']):
            if 'cip' in ra:
                n_cip += 1
                if not a.HasProp('_CIPCode') or a.GetProp('_CIPCode') != ra['cip']:
                    bad.append(f'{mid}: CIP атома {a.GetIdx()}')
        for b, rb in zip(mm.GetBonds(), rec['bonds']):
            if 'ez' in rb:
                n_ez += 1
                if not b.HasProp('_CIPCode') or b.GetProp('_CIPCode') != rb['ez']:
                    bad.append(f'{mid}: E/Z связи {b.GetIdx()}')
    print(f'молекул {len(M)}; со стереохимией в SMILES {n_st}; меток CIP {n_cip}; E/Z {n_ez}')
    for x in bad[:50]:
        print('BAD', x)
    if bad:
        sys.exit(1)
    print('OK — стереохимия данных = 3D-координатам')


if __name__ == '__main__':
    main()
