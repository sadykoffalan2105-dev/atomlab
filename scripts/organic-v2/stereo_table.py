"""
Органика v2 — таблица стереохимии (проверено по химии; названия — как в Kimyo 10).

smiles  — изомерный SMILES, который становится данными молекулы (заменяет «плоский» граф реестра);
expect  — ожидаемые метки, которые build_molecules.py СВЕРЯЕТ после построения 3D:
          'Z'/'E' — геометрия всех стерео-двойных связей; 'cip' — CIP-метки по номерам атомов SMILES (порядок
          атомов в строке, считая только тяжёлые); 'hydrolysis' — какие моносахариды получатся при гидролизе
          гликозидных и сложноэфирных связей (канонические SMILES из MONO ниже).
Правило для связей C=C без указания в учебнике (бутен-2, пентен-2 …): SMILES остаётся без стерео,
а 3D строится для E-изомера (более устойчивый) — см. build_molecules.py.
"""

# Эталонные моносахариды (PubChem, CIP проверяется в build_molecules.py → MONO_CIP).
MONO = {
    'a-D-Glc': 'OC[C@H]1O[C@H](O)[C@H](O)[C@@H](O)[C@@H]1O',
    'b-D-Glc': 'OC[C@H]1O[C@@H](O)[C@H](O)[C@@H](O)[C@@H]1O',
    'b-D-Gal': 'OC[C@H]1O[C@@H](O)[C@H](O)[C@@H](O)[C@H]1O',
    'b-D-Fru': 'OC[C@H]1O[C@](O)(CO)[C@@H](O)[C@@H]1O',
}
# Эталоны сверены по InChIKey PubChem: α-D-Glc …-DVKNGEFBSA-N, β-D-Glc …-VFUOTHLCSA-N,
# β-D-Gal …-FPRJBGLDSA-N, β-D-Fru(f) RFSUNEUAIZKAJO-ARQDHWQXSA-N (2R,3S,4S,5R).
MONO_KEYS = {
    'a-D-Glc': 'WQZGKKKJIJFFOK-DVKNGEFBSA-N',
    'b-D-Glc': 'WQZGKKKJIJFFOK-VFUOTHLCSA-N',
    'b-D-Gal': 'WQZGKKKJIJFFOK-FPRJBGLDSA-N',
    'b-D-Fru': 'RFSUNEUAIZKAJO-ARQDHWQXSA-N',
}

GLC_A = MONO['a-D-Glc']
STEREO = {
    # ── цис/транс-изомеры учебника (organicBuildCatalogG10ch2.ts, поле stereo) ──
    'cis-but-2-ene': {'smiles': 'C/C=C\\C', 'expect': {'ez': 'Z'}},
    'trans-but-2-ene': {'smiles': 'C/C=C/C', 'expect': {'ez': 'E'}},
    'cis-penta-1-3-diene': {'smiles': 'C=C/C=C\\C', 'expect': {'ez': 'Z'}},
    'trans-penta-1-3-diene': {'smiles': 'C=C/C=C/C', 'expect': {'ez': 'E'}},
    # ── ненасыщенные жирные кислоты: природные — цис (Z) ──
    'palmitoleic-acid': {'smiles': 'OC(=O)CCCCCCC/C=C\\CCCCCC', 'expect': {'ez': 'Z'}},  # (9Z)-гексадец-9-еновая
    'oleic-acid': {'smiles': 'OC(=O)CCCCCCC/C=C\\CCCCCCCC', 'expect': {'ez': 'Z'}},  # (9Z)-октадец-9-еновая
    'linoleic-acid': {'smiles': 'OC(=O)CCCCCCC/C=C\\C/C=C\\CCCCC', 'expect': {'ez': 'Z'}},  # 9Z,12Z
    'linolenic-acid': {'smiles': 'OC(=O)CCCCCCC/C=C\\C/C=C\\C/C=C\\CC', 'expect': {'ez': 'Z'}},  # 9Z,12Z,15Z
    # ── жиры с остатками олеиновой кислоты ──
    'triolein': {
        'smiles': 'CCCCCCCC/C=C\\CCCCCCCC(=O)OCC(OC(=O)CCCCCCC/C=C\\CCCCCCCC)COC(=O)CCCCCCC/C=C\\CCCCCCCC',
        'expect': {'ez': 'Z'},
    },
    'dioleoyl-stearoyl-glycerol': {  # 1,3-диолеоил-2-стеароилглицерин
        'smiles': 'CCCCCCCC/C=C\\CCCCCCCC(=O)OCC(OC(=O)CCCCCCCCCCCCCCCCC)COC(=O)CCCCCCC/C=C\\CCCCCCCC',
        'expect': {'ez': 'Z'},
    },
    'stearopalmitolein': {  # 1-олеоил-2-пальмитоил-3-стеароилглицерин (C2 природной конфигурации учебник не задаёт)
        'smiles': 'CCCCCCCC/C=C\\CCCCCCCC(=O)OCC(OC(=O)CCCCCCCCCCCCCCC)COC(=O)CCCCCCCCCCCCCCCCC',
        'expect': {'ez': 'Z'},
    },
    # ── полиены: природный β-каротин — полностью транс (все E) ──
    'beta-carotene': {
        'smiles': 'CC1=C(/C=C/C(C)=C/C=C/C(C)=C/C=C/C=C(C)/C=C/C=C(C)/C=C/C2=C(C)CCCC2(C)C)C(C)(C)CCC1',
        'expect': {'ez': 'E'},
    },
    'cinnamyl-alcohol': {'smiles': 'OC/C=C/c1ccccc1', 'expect': {'ez': 'E'}},  # природный (E)-коричный спирт
    # ── углеводы (D-ряд) ──
    'glucose-open': {  # D-глюкоза, открытая (альдегидная) форма: (2R,3S,4R,5R)
        'smiles': 'O=C[C@H](O)[C@@H](O)[C@H](O)[C@H](O)CO',
        'expect': {'cip': 'RSRR'},
    },
    'glyceraldehyde': {  # D-глицериновый альдегид — (R), эталон D/L-ряда сахаров
        'smiles': 'O=C[C@H](O)CO',
        'expect': {'cip': 'R', 'inchikey': 'MNQZXJOMYWMBOU-VKHMYHEASA-N'},
    },
    'alpha-glucopyranose': {'smiles': GLC_A, 'expect': {'mono': 'a-D-Glc'}},
    'glucose-pyranose': {'smiles': MONO['b-D-Glc'], 'expect': {'mono': 'b-D-Glc'}},  # β-D-глюкопираноза (как в названии)
    'fructose-open': {  # D-фруктоза, открытая (кето) форма: (3S,4R,5R)
        'smiles': 'OCC(=O)[C@@H](O)[C@H](O)[C@H](O)CO',
        'expect': {'cip': 'SRR'},
    },
    'fructose': {'smiles': 'OCC(=O)[C@@H](O)[C@H](O)[C@H](O)CO', 'expect': {'cip': 'SRR'}},  # учебная открытая форма
    'fructofuranose': {'smiles': MONO['b-D-Fru'], 'expect': {'mono': 'b-D-Fru'}},  # β-D-фруктофураноза
    'ribose': {  # D-рибоза, открытая форма: (2R,3R,4R)
        'smiles': 'O=C[C@H](O)[C@H](O)[C@H](O)CO',
        'expect': {'cip': 'RRR'},
    },
    'methyl-glucoside': {  # метил-α-D-глюкопиранозид
        'smiles': 'CO[C@H]1O[C@H](CO)[C@@H](O)[C@H](O)[C@H]1O',
        'expect': {'hydrolysis': ['a-D-Glc', 'CO']},
    },
    'glucose-pentaacetate': {  # пентаацетат β-D-глюкопиранозы
        'smiles': 'CC(=O)OC[C@H]1O[C@@H](OC(C)=O)[C@H](OC(C)=O)[C@@H](OC(C)=O)[C@@H]1OC(C)=O',
        'expect': {'hydrolysis': ['b-D-Glc', 'CC(=O)O', 'CC(=O)O', 'CC(=O)O', 'CC(=O)O', 'CC(=O)O']},
    },
    'gluconic-acid': {  # D-глюконовая кислота: (2R,3S,4R,5R)
        'smiles': 'OC(=O)[C@H](O)[C@@H](O)[C@H](O)[C@H](O)CO',
        'expect': {'cip': 'RSRR'},
    },
    'sorbitol': {  # D-сорбит (D-глюцит): (2R,3R,4R,5S) по ИЮПАК
        'smiles': 'OC[C@H](O)[C@@H](O)[C@H](O)[C@H](O)CO',
        'expect': {'cip': 'SRRR', 'inchikey': 'FBPFZTCFMRRESA-JGWLITMVSA-N'},
    },
    # сахароза: α-D-глюкопиранозил-(1→2)-β-D-фруктофуранозид
    'sucrose-structure': {
        'smiles': 'OC[C@H]1O[C@H](O[C@]2(CO)O[C@H](CO)[C@@H](O)[C@@H]2O)[C@H](O)[C@@H](O)[C@@H]1O',
        'expect': {'hydrolysis': ['a-D-Glc', 'b-D-Fru'], 'inchikey': 'CZMRCDWAGMRECN-UGDNZRGBSA-N'},
    },
    'sucrose': {
        'smiles': 'OC[C@H]1O[C@H](O[C@]2(CO)O[C@H](CO)[C@@H](O)[C@@H]2O)[C@H](O)[C@@H](O)[C@@H]1O',
        'expect': {'hydrolysis': ['a-D-Glc', 'b-D-Fru'], 'inchikey': 'CZMRCDWAGMRECN-UGDNZRGBSA-N'},
    },
    # мальтоза: α-D-Glc-(1→4)-α-D-Glc (α-аномер восстанавливающего звена)
    'maltose': {
        'smiles': 'OC[C@H]1O[C@H](O[C@H]2[C@H](O)[C@@H](O)[C@@H](O)O[C@@H]2CO)[C@H](O)[C@@H](O)[C@@H]1O',
        'expect': {'hydrolysis': ['a-D-Glc', 'a-D-Glc']},
    },
    # лактоза: β-D-Gal-(1→4)-β-D-Glc
    'lactose': {
        'smiles': 'OC[C@H]1O[C@@H](O[C@H]2[C@H](O)[C@@H](O)[C@H](O)O[C@@H]2CO)[C@H](O)[C@@H](O)[C@H]1O',
        'expect': {'hydrolysis': ['b-D-Gal', 'b-D-Glc']},
    },
    # амилоза (3 звена): α-1,4
    'amylose-fragment': {
        'smiles': 'OC[C@H]1O[C@H](O[C@H]2[C@H](O)[C@@H](O)[C@@H](O[C@H]3[C@H](O)[C@@H](O)[C@@H](O)O[C@@H]3CO)O[C@@H]2CO)[C@H](O)[C@@H](O)[C@@H]1O',
        'expect': {'hydrolysis': ['a-D-Glc', 'a-D-Glc', 'a-D-Glc']},
    },
    # целлюлоза (3 звена): β-1,4
    'cellulose-fragment': {
        'smiles': 'OC[C@H]1O[C@@H](O[C@H]2[C@H](O)[C@@H](O)[C@H](O[C@H]3[C@H](O)[C@@H](O)[C@H](O)O[C@@H]3CO)O[C@@H]2CO)[C@H](O)[C@@H](O)[C@@H]1O',
        'expect': {'hydrolysis': ['b-D-Glc', 'b-D-Glc', 'b-D-Glc']},
    },
    # амилопектин: звено B несёт α-1,4 (C) и ветвь α-1,6 (A) — как граф реестра
    'amylopectin-fragment': {
        'smiles': 'OC[C@H]1O[C@H](OC[C@H]2O[C@H](O)[C@H](O)[C@@H](O)[C@@H]2O[C@H]2O[C@H](CO)[C@@H](O)[C@H](O)[C@H]2O)[C@H](O)[C@@H](O)[C@@H]1O',
        'expect': {'hydrolysis': ['a-D-Glc', 'a-D-Glc', 'a-D-Glc']},
    },
    # ── L-аминокислоты и др. ──
    'cysteine': {'smiles': 'N[C@@H](CS)C(=O)O', 'expect': {'cip': 'R', 'inchikey': 'XUJNEKJLAYXESH-REOHCLBHSA-N'}},  # L-цистеин — R по CIP (из-за S)
    'adrenaline': {'smiles': 'CNC[C@H](O)c1ccc(O)c(O)c1', 'expect': {'cip': 'R'}},  # (R)-адреналин
    'malic-acid': {'smiles': 'OC(=O)C[C@H](O)C(=O)O', 'expect': {'cip': 'S'}},  # L-яблочная (S)
    'ascorbic-acid': {  # L-аскорбиновая: (5R)-5-[(1S)-1,2-дигидроксиэтил]
        'smiles': 'OC[C@H](O)[C@H]1OC(=O)C(O)=C1O',
        'expect': {'cip': 'SR'},
    },
}
