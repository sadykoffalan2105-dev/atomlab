# Органика v2 — покрытие реакций с атомным соответствием

Сгенерировано `scripts/organic-v2/build_reactions.py` (RDKit) → `src/data/organicV2/reactions.json`.

## Итог

- Органических реакций в учебниках 10–11 (участник — органика): **312** (10 кл. 300, 11 кл. 12).
- Чистые схемы (CnH2n…, n/2, R без примера): 0.
- В файле с атомным соответствием: **307** из 312 без чистых схем (**98.4 %**); из них общих схем, показанных на примере: 17.
- Школьные пути по общим схемам учебника (generic, «не из учебника дословно»): **228**.
- Молекул реестра с маршрутом получения: **329 / 329**.

## Типы реакций

| Тип | Кол-во |
|---|---|
| hydrogenation | 85 |
| substitution | 62 |
| oxidation | 62 |
| dehydrogenation | 51 |
| esterification | 34 |
| dehydration | 33 |
| hydrolysis | 26 |
| substitutionRadical | 23 |
| other | 22 |
| combustion | 17 |
| acidBase | 16 |
| hydration | 13 |
| metal | 12 |
| polymerization | 10 |
| halogenation | 8 |
| reduction | 8 |
| wurtz | 8 |
| hydrohalogenation | 7 |
| dehydrohalogenation | 7 |
| polycondensation | 5 |
| addition | 5 |
| cracking | 4 |
| trimerization | 4 |
| isomerization | 3 |
| nitration | 3 |
| fermentation | 3 |
| elimination | 2 |
| sulfonation | 2 |

## Маршруты по классам

| Класс | Молекул | Есть реакция учебника | Только общая схема | Без маршрута |
|---|---|---|---|---|
| acid | 32 | 10 | 22 | 0 |
| alcohol | 22 | 9 | 13 | 0 |
| aldehyde | 7 | 3 | 4 | 0 |
| alkadiene | 13 | 1 | 12 | 0 |
| alkane | 44 | 7 | 37 | 0 |
| alkene | 21 | 6 | 15 | 0 |
| alkyne | 16 | 1 | 15 | 0 |
| arene | 15 | 5 | 10 | 0 |
| carb | 18 | 6 | 12 | 0 |
| cycloalkane | 15 | 2 | 13 | 0 |
| ester | 30 | 11 | 19 | 0 |
| ether | 10 | 4 | 6 | 0 |
| halo | 36 | 24 | 12 | 0 |
| ketone | 9 | 1 | 8 | 0 |
| nitrogen | 13 | 3 | 10 | 0 |
| phenol | 14 | 4 | 10 | 0 |
| polyol | 14 | 4 | 10 | 0 |

## Не вошли (реакции учебника)

| Кл. | с. | Уравнение | Причина |
|---|---|---|---|
| 10 | 46 | CH₃CH₂-Br + Br-CH₃ + Na → CH₃CH₂CH₃ + CH₃CH₃ + CH₃CH₂CH₂CH₃ | не уравнено: {'Br': 2, 'Na': 1} | {'C': 6, 'H': 16} |
| 10 | 69 | (-CH₂-C(CH₃)=CH-CH₂-)n + nS → (C₅H₈S)n | не распознано (C5H8S)n |
| 11 | 59 | CH₃COO⁻ + Na⁺ + H₂O ⇌ CH₃COOH + Na⁺ + OH⁻ | ионное уравнение |
| 11 | 59 | CH₃COO⁻ + H₂O ⇌ CH₃COOH + OH⁻ | ионное уравнение |
| 11 | 59 | CH₃COO⁻ + NH₄⁺ + H₂O ⇌ CH₃COOH + NH₄OH | ионное уравнение |

## Молекулы без маршрута

— нет

## Вещества вне реестра (ref `new:<SMILES>`)

- `new:CC(=O)[O][Na]` — 15
- `new:[Na][O]c1ccccc1` — 12
- `new:CC[O][Na]` — 7
- `new:CCCCCCCCCCCCCCCCCC(=O)[O][Na]` — 5
- `new:CC(O)CO` — 4
- `new:CCCC(=O)[O][Na]` — 4
- `new:O=C([O][K])C(=O)[O][K]` — 3
- `new:O=C([O][K])c1ccccc1` — 3
- `new:CCCCCCCCCCCCCCCC(=O)[O][Na]` — 3
- `new:[CH3]` — 2
- `new:CCC(=O)[O][Na]` — 2
- `new:[Na][O]CC(C[O][Na])[O][Na]` — 2
- `new:OCC(O)C[O][Cu][O]CC(O)CO` — 2
- `new:O=S(=O)([O][Na])c1ccccc1` — 2
- `new:Cc1ccccc1[O][K]` — 2
- `new:[K][O]c1ccccc1` — 2
- `new:CC(=O)[O][Mg][O]C(C)=O` — 2
- `new:OCC1OC(OC2(CO)OC(CO)C(O)C2O)C(O)C(O)C1O.[O]=[Ca]` — 2
- `new:O=C[O][Na]` — 1
- `new:CC(Cl)CCl` — 1
- `new:[Na][O]CC[O][Na]` — 1
- `new:OCC[O][Cu][O]CCO` — 1
- `new:[Cl].[Cl].[Cl].c1ccc([OH]->[Fe](<-[OH]c2ccccc2)(<-[OH]c2ccccc2)(<-[OH]c2ccccc2)(<-[OH]c2ccccc2)<-[OH]c2ccccc2)cc1` — 1
- `new:c1ccc([O][Fe]([O]c2ccccc2)[O]c2ccccc2)cc1` — 1
- `new:C[O][Na]` — 1
- `new:CC[OH+]CC.OS(=O)(=O)[O-]` — 1
- `new:C[CH2][Na]` — 1
- `new:CC(=O)[O][Ca][O]C(C)=O` — 1
- `new:OCC1OC(O)C2[O][Cu][O]C2C1O` — 1
- `new:OCC(O)C(O)C(O)C(O)C(=O)[O-].[NH4+]` — 1
- `new:OCC1OC(O)C([O][Cu][O]C2C(O)OC(CO)C(O)C2O)C(O)C1O` — 1
- `new:CC(=O)[O-].[NH4+]` — 1
- `new:CC(C)(C)Cl` — 1
- `new:C=CC(C)CC` — 1
- `new:C1=CC1` — 1
- `new:C1=CCC1` — 1
- `new:C1=C2CC3CC1CC(C2)C3` — 1
- `new:O=Cc1ccc(C(=O)O)cc1` — 1
- `new:NC(C=O)CS` — 1
- `new:CCCC(C)CCC` — 1
- `new:C=C(C)CC(C)(C)C` — 1
- `new:C=CCCC(C)C` — 1
- `new:C=CC(C)C(CC)CC` — 1
- `new:C=C(C)CC(C)C(C)C` — 1
- `new:C=CCC(C)CC` — 1
- `new:C=C(C)CC(C)C` — 1
- `new:C=CC(CC)CC` — 1
- `new:C=C(C)C(C)(C)C` — 1
- `new:C=C1CC1` — 1
- `new:C=C1CCC1C` — 1
- `new:C=CC1CCC(C)C1` — 1
- `new:C=C1CCC1` — 1
- `new:CC1(C)C=C1` — 1
- `new:C=C1CC1C` — 1
- `new:C=CC1CC1` — 1
- `new:CCCCCBr` — 1
- `new:C=CCC=CC(C)(C)C` — 1
- `new:C=CC=C(C)C=C` — 1
- `new:C=C(Cl)C(C)O` — 1
- `new:CC#CC=CCC` — 1
- `new:C=CC#CCCC` — 1
- `new:C#CC(=C)CCC` — 1
- `new:ClC(c1ccccc1)c1ccccc1` — 1
- `new:C1CCC2CCCCC2C1` — 1
- `new:C1CCC2CC3CCCCC3CC2C1` — 1
- `new:C=C1CCCCC1` — 1
- `new:C=CCC(C)C(C)C` — 1
- `new:CCCC(CC)CC(C)(Cl)C(Cl)CC` — 1
- `new:CCC=CC(=O)O` — 1
- `new:CCC(Cl)CO` — 1
- `new:OCCCCCl` — 1
- `new:CC(O)C(C)Cl` — 1
- `new:CC(C)(Cl)CO` — 1
- `new:CC(CO)CCl` — 1
- `new:OCC(O)CCCl` — 1
- `new:CCC(Cl)CC(C)(O)C(C)CC` — 1
- `new:CC(Cl)CO` — 1
- `new:CCCC(O)Cl` — 1
- `new:CC(C)(O)CCl` — 1
- `new:Oc1ccccc1Cl` — 1
- `new:Oc1cccc(Cl)c1` — 1
- `new:Oc1ccc(Cl)cc1` — 1
- `new:Oc1cccc(Cl)c1O` — 1
- `new:Oc1cc(O)cc(Cl)c1` — 1
- `new:Cc1cccc(C)c1O` — 1
- `new:C=COC(C)O` — 1
- `new:CC(C)CO` — 1
- `new:CCC(O)CC` — 1
- `new:CCCC(C)O` — 1
- `new:CCCCCC=O` — 1
- `new:CCCCCCCCCCCCCCCCC=O` — 1
- `new:CCC(C)C=O` — 1
- `new:CC(C)C(=O)O` — 1
- `new:CC(C)CCO` — 1
- `new:CCCCCCCCCCCCCCCC(=O)OCC(CO)OC(=O)CCCCCCCCCCCCCCC` — 1
- `new:OCC1(O)OC(CCl)C(O)C1O` — 1
- `new:C=CCCCCCCCCCCCCCCCCCCCCC` — 1
- `new:C=CC(C)=CC(=C)C` — 1
- `new:CC#CC(=CC)C(C)(C)C(C)C` — 1
- `new:C=CCCCCCC` — 1
- `new:C=CCCCCCCC` — 1
- `new:C=CCCCCCCCC` — 1
- `new:C=CCCCCCCCCC` — 1
- `new:C=CCCCCCCCCCC` — 1
- `new:C=CCCCCCCCCCCC` — 1
- `new:C=CCCCCCCCCCCCC` — 1
- `new:C=CCCCCCCCCCCCCCC` — 1
- `new:C=CCCCCCCCCCCCCCCCC` — 1
- `new:C=CCCCCCCCCCCCCCCCCC` — 1
- `new:C=CCCCCCCCCCCCCCCCCCCCCCCC` — 1
- `new:C=CCCCCCCCCCCCCCCCCCCCCCCCCCC` — 1
- `new:C=CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC` — 1
- `new:C=CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC` — 1
- `new:C=CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC` — 1
- `new:C=CC(CC)(CC)CC` — 1
- `new:C=CCCC(C)(C)CCCC` — 1
- `new:C=C1CCCC1C` — 1
- `new:C1=CCCCCCCCC1` — 1
- `new:C=Cc1ccc(C(C)O)cc1` — 1
- `new:CC(C=CC=C(C)C=CC1=C(C)C=CCC1(C)C)=CC=CC=C(C)C=CC=C(C)C=CC1=C(C)CCCC1(C)C` — 1
- `new:OCC(CO)(CO)CCl` — 1
- `new:COc1ccccc1Cl` — 1
- `new:C=CCCl` — 1
- `new:O=C1OC(Cl)(c2ccc(O)cc2)c2ccccc21` — 1
- `new:OC(c1ccccc1)c1ccccc1` — 1
- `new:CC(=O)C(C)O` — 1
- `new:CC(=O)CC(C)O` — 1
- `new:CC(C)CC=O` — 1
- `new:CC(C)(C)C=O` — 1
- `new:O=CC(=O)O` — 1
- `new:O=CCCC(=O)O` — 1
- `new:O=CCCCCC(=O)O` — 1
- `new:O=CCC(O)C(=O)O` — 1
- `new:O=CCC(O)(CC(=O)O)C(=O)O` — 1
- `new:CC(O)CCC(=O)O` — 1
- `new:O=Cc1ccccc1O` — 1
- `new:O=C1OC(C(Cl)CO)C(O)=C1O` — 1
- `new:NC(=O)O` — 1
- `new:CC(O)C#N` — 1
- `new:NCC(O)c1ccc(O)c(O)c1` — 1

## Метод и проверка

- Соответствие атомов: FMCS тяжёлых атомов (4 варианта: с учётом кратности связей и без, с обменами тяжёлых атомов
  одного элемента и без) → водороды по соседям → обмены по стоимости; берётся вариант с наименьшей «ценой» изменений
  (разрыв C–C дороже, разрыв C–O у карбонильного C дешевле — этерификация/гидролиз идут по ацильной связи, как в учебнике).
- Ароматическое кольцо справа получает ту же форму Кекуле, что слева (сдвиг двойных связей не показывается как изменение).
- Проверка: `npx tsx scripts/validate-organic-v2-reactions.mts` — сохранение атомов по map (⇒ уравнено), заряды,
  changes = разница связей, routes/uses, маршрут у каждой молекулы реестра, покрытие учебника ≥ 95 %.
