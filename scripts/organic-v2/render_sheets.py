"""
Органика v2 — контрольные листы для глаз (не для сайта): 40 молекул разных классов из molecules.json.
  python scripts/organic-v2/render_sheets.py  →  .smoke/organic-v2-data/sheet-2d.png, sheet-3d.png
2D — наши координаты p2 (RDKit CoordGen) через MolDraw2DCairo; 3D — наши p (ETKDGv3 + MMFF94) простой проекцией
«шарики и палочки» в OpenCV (атомы по глубине, CPK-цвета).
"""
import io
import json
import math
import os

import cv2
import numpy as np
from PIL import Image
from rdkit import Chem
from rdkit.Chem.Draw import rdMolDraw2D
from rdkit.Geometry import Point3D

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, '.smoke', 'organic-v2-data')
M = json.load(io.open(os.path.join(ROOT, 'src', 'data', 'organicV2', 'molecules.json'), encoding='utf-8'))
IDS = [
    '2-2-dimethylbutane', 'cyclohexane', 'benzene', 'adamantane', 'naphthalene', 'anthracene', 'cis-but-2-ene',
    'trans-but-2-ene', 'acetylene', 'propyne', 'isoprene', 'beta-carotene', 'ethanol', 'glycerol', 'phenol',
    'acetone', 'acetic-acid', 'ethyl-acetate', 'oleic-acid', 'linoleic-acid', 'triolein', 'tristearin',
    'glucose-open', 'alpha-glucopyranose', 'glucose-pyranose', 'fructofuranose', 'ribose', 'sucrose', 'maltose',
    'lactose', 'amylose-fragment', 'cellulose-fragment', 'amylopectin-fragment', 'cysteine', 'glycine', 'adrenaline',
    'aniline', 'nitrobenzene', '2-4-6-trinitrotoluene', 'urea',
]
CPK = {'H': (235, 235, 235), 'C': (70, 70, 70), 'O': (40, 40, 220), 'N': (220, 90, 40), 'S': (40, 200, 230),
       'Cl': (60, 200, 60), 'Br': (40, 40, 150), 'I': (150, 0, 120)}  # BGR
RAD = {'H': 0.25, 'C': 0.38, 'O': 0.36, 'N': 0.37, 'S': 0.48, 'Cl': 0.46, 'Br': 0.5, 'I': 0.55}
BT = {1: Chem.BondType.SINGLE, 2: Chem.BondType.DOUBLE, 3: Chem.BondType.TRIPLE}


def mol_of(rec, two_d):
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
        conf.SetAtomPosition(i, Point3D(a['p2'][0], a['p2'][1], 0) if two_d else Point3D(*a['p']))
    m.AddConformer(conf, assignId=True)
    return m


def tile_2d(rec, w=360, h=300):
    m3 = mol_of(rec, False)
    Chem.AssignStereochemistryFrom3D(m3)  # метки клиньев — из настоящей 3D
    m = mol_of(rec, True)
    for a, a3 in zip(m.GetAtoms(), m3.GetAtoms()):
        a.SetChiralTag(a3.GetChiralTag())
    for b, b3 in zip(m.GetBonds(), m3.GetBonds()):
        b.SetStereo(b3.GetStereo())
        if b3.GetStereo() != Chem.BondStereo.STEREONONE:
            b.SetStereoAtoms(*list(b3.GetStereoAtoms()))
    m = Chem.RemoveHs(m)
    Chem.WedgeMolBonds(m, m.GetConformer())
    d = rdMolDraw2D.MolDraw2DCairo(w, h)
    o = d.drawOptions()
    o.addStereoAnnotation = True
    o.legendFontSize = 15
    d.DrawMolecule(m, legend=f'{rec["id"]}  {rec["formula"]}')
    d.FinishDrawing()
    return np.array(Image.open(io.BytesIO(d.GetDrawingText())).convert('RGB'))[:, :, ::-1]


def tile_3d(rec, w=360, h=300):
    P = np.array([a['p'] for a in rec['atoms']], float)
    # вид: длинная ось по x (данные уже выровнены), небольшой наклон для объёма
    rx, ry = math.radians(-25), math.radians(20)
    Rx = np.array([[1, 0, 0], [0, math.cos(rx), -math.sin(rx)], [0, math.sin(rx), math.cos(rx)]])
    Ry = np.array([[math.cos(ry), 0, math.sin(ry)], [0, 1, 0], [-math.sin(ry), 0, math.cos(ry)]])
    Q = P @ Ry.T @ Rx.T
    span = max(np.ptp(Q[:, 0]) + 1.2, (np.ptp(Q[:, 1]) + 1.2) * w / (h - 30))
    s = w / span
    cx, cy = Q[:, 0].mean(), Q[:, 1].mean()
    xy = np.stack([(Q[:, 0] - cx) * s + w / 2, -(Q[:, 1] - cy) * s + (h - 30) / 2], 1)
    img = np.full((h, w, 3), 255, np.uint8)
    order = np.argsort(Q[:, 2])
    lw = max(1, int(round(0.12 * s)))
    items = [(Q[i, 2], 'a', i) for i in order] + [((Q[b['a'], 2] + Q[b['b'], 2]) / 2 - 0.01, 'b', k) for k, b in enumerate(rec['bonds'])]
    for _, kind, i in sorted(items):
        if kind == 'b':
            b = rec['bonds'][i]
            pa, pb = xy[b['a']], xy[b['b']]
            d = pb - pa
            n = np.array([-d[1], d[0]]) / (np.linalg.norm(d) + 1e-9)
            offs = [0] if b['o'] == 1 else [-1, 1] if b['o'] == 2 else [-1.6, 0, 1.6]
            for t in offs:
                o = n * t * lw * 1.3
                cv2.line(img, tuple(int(v) for v in pa + o), tuple(int(v) for v in pb + o), (120, 120, 120), lw, cv2.LINE_AA)
        else:
            a = rec['atoms'][i]
            r = max(2, int(RAD.get(a['el'], 0.4) * s * 0.75))
            c = tuple(int(v) for v in xy[i])
            cv2.circle(img, c, r, CPK.get(a['el'], (180, 80, 180)), -1, cv2.LINE_AA)
            cv2.circle(img, c, r, (30, 30, 30), 1, cv2.LINE_AA)
    cv2.putText(img, f'{rec["id"]}  {rec["formula"]}', (6, h - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (20, 20, 20), 1, cv2.LINE_AA)
    return img


def sheet(tiles, cols=5):
    rows = [np.hstack(tiles[i:i + cols] + [np.full_like(tiles[0], 255)] * (cols - len(tiles[i:i + cols]))) for i in range(0, len(tiles), cols)]
    return np.vstack(rows)


def save(name, img):
    """cv2.imwrite не пишет по путям с кириллицей на Windows — кодируем в память."""
    ok, buf = cv2.imencode('.png', img)
    assert ok
    io.open(os.path.join(OUT, name), 'wb').write(buf.tobytes())


def main():
    os.makedirs(OUT, exist_ok=True)
    recs = [M[i] for i in IDS]
    save('sheet-2d.png', sheet([tile_2d(r) for r in recs]))
    save('sheet-3d.png', sheet([tile_3d(r) for r in recs]))
    # крупно: сравнения пар, которые старый граф не различал
    pairs = ['maltose', 'lactose', 'amylose-fragment', 'cellulose-fragment', 'alpha-glucopyranose', 'glucose-pyranose',
             'cis-but-2-ene', 'trans-but-2-ene', 'oleic-acid', 'triolein']
    save('pairs-2d.png', sheet([tile_2d(M[i], 520, 420) for i in pairs], 2))
    save('pairs-3d.png', sheet([tile_3d(M[i], 520, 420) for i in pairs], 2))
    print('листы →', OUT, len(recs), 'молекул')


if __name__ == '__main__':
    main()
