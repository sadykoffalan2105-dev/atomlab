import type { H2oMechanismText } from './h2oMechanismText'

/** English text of the «2 H₂ + O₂ → 2 H₂O» lesson. Numbers are identical to the Russian version. */
export const H2O_TEXT_EN: H2oMechanismText = {
  intro: {
    title: 'The polar covalent bond',
    speak: 'Let us watch hydrogen burn in oxygen: the electron pairs become shared, and water appears.',
  },
  steps: {
    reactants: {
      title: 'Detonating gas',
      body:
        'On the left are two hydrogen molecules H₂, on the right a single oxygen molecule O₂. At 25 °C both elements are gases made of DIATOMIC molecules — there are no lone H or O atoms in the cylinder. ' +
        'In H₂ the atoms share one electron pair and the nuclei sit 74.14 pm apart; in O₂ the bond is double and shorter, 120.8 pm. ' +
        'Two volumes of hydrogen with one volume of oxygen are called detonating gas: the mixture can stand for years, yet a single spark sets it off instantly.',
      equation: '2 H₂ (g) + O₂ (g)',
      note: 'The spheres use covalent radii — H 31 pm, O 66 pm — which is why hydrogen looks half the size of oxygen.',
      speak: 'Hydrogen and oxygen are diatomic gases. Two volumes of hydrogen to one of oxygen is detonating gas.',
    },
    spark: {
      title: 'The spark: bonds break',
      body:
        'The mixture does not ignite by itself: the reaction needs activation energy — a spark, a flame or a catalyst. ' +
        'The spark breaks the bonds HOMOLYTICALLY: the shared pair splits evenly and each fragment keeps one electron, giving free radicals H· and O· with unpaired electrons. ' +
        'Breaking bonds is endothermic: two H–H bonds and one O=O bond cost 2 · 436 + 498 = 1370 kJ. On the energy ladder these are the steps going UP.',
      equation: '2 H₂ → 4 H· (+872 kJ);  O₂ → 2 O· (+498 kJ)',
      note: 'Real hydrogen combustion is a radical chain reaction (H· + O₂ → ·OH + O· and so on). What you see is the simplified «break everything, then build everything» picture — exactly the one the bond-energy calculation assumes, and by Hess’s law the total comes out the same.',
      speak: 'A spark is needed. Bonds split in half into radicals, and that costs energy.',
    },
    bonds: {
      title: 'New O–H bonds',
      body:
        'Radicals live for a tiny fraction of a second and immediately rearrange: every oxygen atom grabs two hydrogen atoms. ' +
        'The H atom supplies one electron, the O atom the other, and this PAIR becomes SHARED — that is what a covalent bond is. The O–H bond length is 95.8 pm. ' +
        'The pair is not shared equally: the electronegativity of oxygen is 3.44 against 2.20 for hydrogen, so the electron cloud is pulled toward oxygen. Such a bond is called POLAR covalent.',
      equation: '4 H· + 2 O· → 2 H₂O (g);  4 · (−463 kJ)',
      note: 'The glowing dot flying from hydrogen to oxygen is a convention. In a covalent bond no electron is handed over for good: the pair stays shared, its cloud is merely displaced. A full transfer would make the bond ionic, as in NaCl.',
      speak: 'Each oxygen takes two hydrogens. The electron pair is shared but pulled toward oxygen.',
    },
    molecule: {
      title: 'A bent molecule',
      body:
        'The water molecule is not straight but bent: the H–O–H angle is 104.45°. Oxygen carries four electron pairs — two bonding and TWO LONE pairs, drawn here as translucent lobes. ' +
        'Four pairs repel each other and aim for a tetrahedron (109.5°), but the lone pairs are «fatter» than the bonding ones and squeeze the bond angle down to 104.45°. This state of oxygen is called sp³ hybridisation. ' +
        'That angle is why water is a bent shape rather than a straight rod — and nearly all of its chemistry follows from it.',
      equation: 'H₂O: ∠H–O–H = 104.45°, d(O–H) = 95.8 pm',
      note: 'Only the H–O–H angle is measured. Experiment does not give the direction of the lone pairs directly, so the lobes are drawn at the ideal tetrahedral angle of 109.47° — a model, not a measurement.',
      speak: 'The angle is one hundred and four and a half degrees. Two lone pairs squeeze the bonds together.',
    },
    polarity: {
      title: 'Polarity and the hydrogen bond',
      body:
        'Because the electrons are displaced, oxygen carries a partial negative charge δ− and the hydrogens a partial positive δ+. These are not ions: the charge is FRACTIONAL, about −0.66 e on oxygen and +0.33 e on each hydrogen. ' +
        'The molecule is bent, so the charges do not cancel — the result is a dipole with a moment of 1.85 D. That is why water dissolves salts: its dipoles surround the ions and pull the lattice apart. ' +
        'The hydrogen of one molecule is attracted to the oxygen of its neighbour — the hydrogen bond, H···O ≈ 185 pm (about 280 pm between the oxygen nuclei). It is more than twenty times weaker than an ordinary O–H bond, yet it is the reason water boils at 100 °C instead of minus eighty.',
      equation: 'H₂O: δ−(O) ≈ −0.66 e, δ+(H) ≈ +0.33 e, μ = 1.85 D',
      note: 'The partial charges are computed from the dipole moment in the simplest point-charge model: μ = 2·q·d·cos(θ/2). More refined models give different numbers — δ depends on the method and is not a measurable quantity.',
      speak: 'Minus on the oxygen, plus on the hydrogens. That is why molecules cling to each other through hydrogen bonds.',
    },
    energy: {
      title: 'The energy balance',
      body:
        'Breaking the bonds cost 1370 kJ, while forming four O–H bonds returned 1852 kJ. The gain is 482 kJ for two molecules, that is 241 kJ per mole of water. ' +
        'The tabulated enthalpy of formation of water VAPOUR is −241.8 kJ/mol, so the bond-energy estimate agrees. Condensing the vapour into liquid releases another 44 kJ/mol, giving ΔH°f = −285.8 kJ/mol for liquid water. ' +
        'The minus sign means energy is released: hydrogen burns with a pale hot flame, and droplets of water settle at once on any cold surface.',
      equation: '2 H₂ (g) + O₂ (g) → 2 H₂O (g), ΔH = −482 kJ',
      note: 'The scene shows VAPOUR: bond energies refer to gas-phase molecules. The value −285.8 kJ/mol is for liquid water, and the 44 kJ/mol difference is the heat of condensation.',
      speak: 'The total is minus two hundred forty-two kilojoules per mole of vapour, minus two hundred eighty-six for liquid water.',
    },
  },
  legend: {
    electron: 'A blue dot with a trail — an electron joining the shared pair.',
    orbitalPhase: 'Translucent lobes on oxygen — the two lone electron pairs (drawn from a model).',
    water: 'The thin dotted line between molecules is a hydrogen bond, not a covalent one.',
  },
  safety:
    'Mixtures of hydrogen and oxygen are explosive over a wide range. The detonating-gas demonstration is done by the teacher only, with a tiny volume of gas and safety goggles — never prepare such a mixture yourself.',
  energy: {
    title: 'Energy from bond enthalpies (Hess’s law)',
    unit: 'kJ/mol',
    caption: 'Cost (up) and gain (down) per mole of H₂O vapour; the sum of the steps is the enthalpy of formation.',
    stages: {
      dissocHH: 'H₂ → 2 H',
      dissocOO: '½ O₂ → O',
      bond1: 'H + O → HO',
      bond2: 'H + HO → H₂O',
      total: 'Total: ΔH°f',
    },
    summary: 'Bond-enthalpy estimate for H₂O: the steps sum to {dH} kJ/mol',
    sources: 'Reference values: CRC Handbook, NIST-JANAF (bond enthalpies, enthalpies of formation); H–O–H angle from microwave spectroscopy.',
  },
}
