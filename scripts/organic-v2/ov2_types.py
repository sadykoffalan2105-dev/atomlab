"""Органика v2: школьный тип реакции (Kimyo 10). Источник — ручные таблицы docs/textbook/g10-*.md (колонка «Тип»),
иначе — по участникам реакции."""
import io
import os
import re

from rdkit import Chem

SUB = str.maketrans('₀₁₂₃₄₅₆₇₈₉ₙ', '0123456789n')


def norm_eq(s):
    s = (s or '').translate(SUB)
    s = s.replace('→', '->').replace('⇄', '<=>').replace('⇌', '<=>').replace('=', '=')
    s = re.sub(r'[\s↑↓]', '', s)
    s = re.sub(r'[–—−]', '-', s)
    s = s.replace('·', '*')
    s = re.sub(r'\(спирт\.?\)|\(водн\.?\)|\(конц\.?\)|\(р-р\)', '', s)
    return s


def md_type_key(page, eq):
    return f'{page}|{norm_eq(eq)}'


def md_types(folder):
    out = {}
    for fn in os.listdir(folder):
        if not (fn.startswith('g10-') and fn.endswith('.md')):
            continue
        for line in io.open(os.path.join(folder, fn), encoding='utf-8'):
            cells = [c.strip() for c in line.strip().strip('|').split('|')]
            if len(cells) < 4 or not cells[0].isdigit():
                continue
            out.setdefault(md_type_key(int(cells[0]), cells[3]), cells[2])
    return out


RU = [('дегидрогалоген', 'dehydrohalogenation'), ('гидрогалоген', 'hydrohalogenation'), ('дегидратац', 'dehydration'),
      ('гидратац', 'hydration'), ('кучеров', 'hydration'), ('дегидрир', 'dehydrogenation'), ('гидрир', 'hydrogenation'),
      ('брожен', 'fermentation'), ('крекинг', 'cracking'), ('пиролиз', 'cracking'), ('изомериз', 'isomerization'),
      ('вюрц', 'wurtz'), ('тримериз', 'trimerization'), ('зелинск', 'trimerization'), ('поликонденс', 'polycondensation'),
      ('полимериз', 'polymerization'), ('этерифик', 'esterification'), ('омылен', 'hydrolysis'), ('гидролиз', 'hydrolysis'),
      ('нитрован', 'nitration'), ('сульфир', 'sulfonation'), ('горен', 'combustion'), ('восстанов', 'reduction'),
      ('окислен', 'oxidation'), ('нейтрализ', 'acidBase'), ('кислотн', 'acidBase'), ('с металл', 'metal'),
      ('радикальн', 'substitutionRadical'), ('галогенир', 'HAL'), ('хлорир', 'HAL'), ('бромир', 'HAL'), ('присоедин', 'addition'), ('замещ', 'substitution')]

OXIDANTS = {'KMnO4', 'O', '[O]', '[Ag(NH3)2]OH', 'Ag2O', 'Cu(OH)2', 'CuO', 'K2Cr2O7', 'H2O2', 'O3'}
HHAL = {'HCl', 'HBr', 'HI'}
HAL2 = {'Cl2', 'Br2', 'I2'}
BASES = {'NaOH', 'KOH', 'Ca(OH)2', 'Ba(OH)2', 'NH3', 'NaHCO3', 'Na2CO3', 'K2CO3', 'CaCO3', 'MgO', 'CaO', 'Cu(OH)2', 'NH4OH', 'Mg(OH)2'}
METALS = {'Na', 'K', 'Li', 'Mg', 'Ca', 'Zn', 'Fe'}

P_UNSAT = Chem.MolFromSmarts('[#6]=,#[#6;!a]')
P_HAL = Chem.MolFromSmarts('[#6][Cl,Br,I]')
P_ESTER = Chem.MolFromSmarts('[CX3](=O)[OX2][#6]')
P_ACID = Chem.MolFromSmarts('C(=O)[OH]')
P_OH = Chem.MolFromSmarts('[#6][OH]')
P_AMIDE = Chem.MolFromSmarts('C(=O)[NX3;H2,H1]')
P_SULFATE = Chem.MolFromSmarts('[#6;!a]OS(=O)(=O)[OX2H1]')
P_CO = Chem.MolFromSmarts('[#6]C(=O)[#1,#6]')
P_NITRATE = Chem.MolFromSmarts('[#6]O[N+](=O)[O-]')


def _m(s):
    m = Chem.MolFromSmiles(s['smiles'])
    return m


def _has(spp, patt):
    return any((m := _m(s)) is not None and m.HasSubstructMatch(patt) for s in spp)


def heuristic(res):
    sp = res['species']
    inL = {s['ref'][6:] for s in sp if s['side'] == 'L' and s['ref'].startswith('inorg:')}
    inR = {s['ref'][6:] for s in sp if s['side'] == 'R' and s['ref'].startswith('inorg:')}
    oL = [s for s in sp if s['side'] == 'L' and not s['ref'].startswith('inorg:')]
    oR = [s for s in sp if s['side'] == 'R' and not s['ref'].startswith('inorg:')]
    refsL = {s['ref'] for s in oL}
    if 'O2' in inL and not oR and inR <= {'CO2', 'H2O', 'CO', 'C', 'N2', 'SO2'}:
        return 'combustion'
    if res.get('polymer') and 'H2O' in inL:
        return 'hydrolysis'
    # цепная стадия радикального замещения (R-H + Cl• → R• + HCl, R• + Cl₂ → R-Cl + Cl•)
    if (inL | inR) & {'Cl', 'Br'} and (inL | inR) & (HAL2 | HHAL):
        return 'substitutionRadical'
    # вытеснение слабой органической кислоты (фенола) сильной кислотой из соли
    if inL & {'H2SO4', 'HCl'} and inR & {'NaHSO4', 'Na2SO4', 'NaCl', 'KHSO4', 'K2SO4', 'KCl'} and not inL & OXIDANTS:
        return 'acidBase'
    # простой эфир: алкоголят/фенолят + галогеналкан (RONa + R′Cl), этилсерная кислота + спирт
    if _has(oL, P_HAL) and inR & {'NaCl', 'NaBr', 'KCl', 'KBr'} and any('Na' in s['smiles'] or 'K' in s['smiles'] for s in oL):
        return 'substitution'
    if 'H2SO4' in inR and _has(oL, P_SULFATE):
        return 'substitution'
    # электролиз солей карбоновых кислот (Кольбе)
    if 'H2O' in inL and {'CO2', 'H2'} <= inR and inR & {'NaOH', 'KOH'}:
        return 'other'
    if 'H2O' in inL and not oR:
        return 'other'
    if 'Cu(OH)2' in inL and not inR & {'Cu2O', 'CuOH', 'Cu'}:
        return 'other'
    if res.get('polymer'):
        return 'polycondensation' if inR else 'polymerization'
    if 'HNO3' in inL:
        return 'esterification' if _has(oR, P_NITRATE) else 'nitration'
    if 'H2SO4' in inL and _has(oR, P_SULFATE):
        return 'esterification'
    if 'H2SO4' in inL and any('S' in s['smiles'] for s in oR):
        return 'sulfonation'
    if inL & METALS:
        if _has(oL, P_HAL) and (inR & {'NaCl', 'NaBr', 'KCl', 'KBr', 'NaI', 'ZnCl2', 'ZnBr2'}) and 'Zn' not in inL:
            return 'wurtz'
        if 'Zn' in inL and _has(oL, P_HAL):
            return 'dehydrohalogenation'
        return 'metal'
    if 'H2' in inL or 'H' in inL or '[H]' in inL:
        return 'reduction' if _has(oL, P_CO) or 'H' in inL or '[H]' in inL or any('N' in s['smiles'] for s in oL) else 'hydrogenation'
    if inL & OXIDANTS or ('O2' in inL):
        return 'oxidation'
    if inL & HHAL:
        return 'hydrohalogenation' if _has(oL, P_UNSAT) else 'substitution'
    if inL & HAL2:
        if inR & HHAL:
            arom = any((m := _m(s)) is not None and any(a.GetIsAromatic() for a in m.GetAtoms()) for s in oL)
            return 'substitution' if arom else 'substitutionRadical'
        return 'halogenation'
    if inL & {'NaOH', 'KOH'} and inR & {'Na2CO3', 'K2CO3'}:
        return 'elimination'  # декарбоксилирование: сплавление соли с щёлочью (Дюма)
    if inL & {'NaOH', 'KOH'} and 'Na2SO3' in inR:
        return 'substitution'  # щелочное плавление сульфоната → фенолят
    if 'NH3' in inL and 'H2O' in inR and _has(oR, P_AMIDE):
        return 'other'  # амид из кислоты и аммиака
    if inL & {'NaOH', 'KOH'}:
        if _has(oL, P_ESTER):
            return 'hydrolysis'
        if _has(oL, P_HAL):
            return 'dehydrohalogenation' if 'H2O' in inR and _has(oR, P_UNSAT) else 'substitution'
        return 'acidBase'
    if inL & BASES:
        return 'acidBase'
    if 'H2O' in inL:
        if len(oR) == 1 and _has(oL, P_UNSAT) and len(oL) == 1:
            return 'hydration'
        return 'hydrolysis'
    if 'H2' in inR and len(refsL) == 1 and not inL:
        return 'dehydrogenation'
    if 'H2O' in inR and not inL:
        if _has(oL, P_ACID) and len(refsL) >= 2 and _has(oR, P_ESTER):
            return 'esterification'
        return 'dehydration'
    if not inL and not inR and len(oL) == 2 and len(oR) == 1 and _has(oL, P_UNSAT) and \
            any((m := _m(s)) is not None and any(a.GetIsAromatic() for a in m.GetAtoms()) for s in oL):
        return 'addition'  # алкилирование бензола алкеном / алкином
    if len(refsL) == 1 and not inL:
        lid = next(iter(refsL))
        if lid.startswith('glucose') or lid in ('fructose',):
            return 'fermentation'
        if 'CO2' in inR:
            return 'fermentation' if any(s['ref'] == 'ethanol' for s in oR) else 'other'
        if len(oL) == 3 and len(oR) == 1 and lid in ('acetylene', 'propyne'):
            return 'trimerization'
        if len(oR) >= 2 and all(set(a['el'] for a in s['atoms']) <= {'C', 'H'} for s in oL + oR):
            return 'cracking'
        if len(oR) == 1 and len(oL) == 1:
            return 'isomerization'
    return 'other'


def classify(rx, res, typeRu):
    if typeRu:
        low = typeRu.lower()
        for key, t in RU:
            if key in low:
                h0 = heuristic(res)
                if t in ('polymerization', 'polycondensation', 'oxidation', 'hydrolysis') and h0 in ('hydrolysis', 'other', 'combustion'):
                    return h0
                if t == 'HAL':
                    h = heuristic(res)
                    return h if h in ('substitution', 'substitutionRadical', 'halogenation') else 'halogenation'
                return t
    return heuristic(res)


# школьное название типа, если в ручных таблицах учебника его нет (или там только «получение»)
TYPE_RU = {
    'combustion': 'горение', 'substitutionRadical': 'замещение (радикальное)', 'substitution': 'замещение',
    'addition': 'присоединение', 'hydrogenation': 'гидрирование', 'halogenation': 'галогенирование (присоединение)',
    'hydrohalogenation': 'гидрогалогенирование', 'hydration': 'гидратация', 'elimination': 'отщепление',
    'dehydration': 'дегидратация', 'dehydrogenation': 'дегидрирование', 'dehydrohalogenation': 'дегидрогалогенирование',
    'esterification': 'этерификация', 'hydrolysis': 'гидролиз', 'polymerization': 'полимеризация',
    'polycondensation': 'поликонденсация', 'oxidation': 'окисление', 'reduction': 'восстановление',
    'nitration': 'нитрование', 'sulfonation': 'сульфирование', 'fermentation': 'брожение', 'cracking': 'крекинг',
    'isomerization': 'изомеризация', 'wurtz': 'реакция Вюрца', 'acidBase': 'кислотно-основная (нейтрализация)',
    'metal': 'замещение водорода активным металлом', 'trimerization': 'тримеризация', 'other': 'другое',
}


def type_ru(t, typeRu, res):
    sp = res['species']
    inL = {s['ref'][6:] for s in sp if s['side'] == 'L' and s['ref'].startswith('inorg:')}
    inR = {s['ref'][6:] for s in sp if s['side'] == 'R' and s['ref'].startswith('inorg:')}
    if typeRu and 'кольбе' in typeRu.lower():
        return 'электролиз (реакция Кольбе)'
    if typeRu and not typeRu.lower().startswith('получение'):
        return typeRu
    if t == 'other' and 'H2O' in inL and {'CO2', 'H2'} <= inR:
        return 'электролиз (реакция Кольбе)'
    if t == 'other' and inL == {'H2O'} and inR >= {'CO', 'H2'}:
        return 'конверсия метана водяным паром'
    if t == 'elimination' and inR & {'Na2CO3', 'K2CO3'}:
        return 'декарбоксилирование: сплавление соли с щёлочью (реакция Дюма)'
    if t == 'substitution' and 'Na2SO3' in inR:
        return 'щелочное плавление сульфоната (SO₃Na → ONa)'
    if t == 'other' and 'NH3' in inL and 'H2O' in inR:
        return 'получение амида (кислота + NH₃, t)'
    if t == 'other' and inL == {'CO2'} and inR >= {'CO', 'H2'}:
        return 'конверсия метана углекислым газом'
    if t == 'other' and 'Cu(OH)2' in inL:
        return 'качественная реакция на многоатомные спирты (ярко-синий раствор с Cu(OH)₂)'
    if t == 'other' and not inL and not inR:
        return 'конденсация'
    if t == 'oxidation' and '[Ag(NH3)2]OH' in inL:
        return 'окисление (реакция «серебряного зеркала»)'
    if t == 'substitution' and 'H2SO4' in inR:
        return 'образование простого эфира (2-я стадия, через этилсерную кислоту)'
    if t == 'substitution' and inR & {'NaCl', 'NaBr', 'KCl', 'KBr'} and not inL:
        return 'получение простого эфира (RONa + R′Hal)'
    if t == 'acidBase' and inL & {'H2SO4', 'HCl'}:
        return 'вытеснение слабой кислоты сильной кислотой из соли'
    if t == 'addition' and not inL and not inR:
        return 'алкилирование бензола (присоединение к кратной связи)'
    if t == 'substitutionRadical' and (inL | inR) & {'Cl', 'Br'}:
        return 'радикальное замещение (стадия цепи)'
    return TYPE_RU.get(t, 'другое')
