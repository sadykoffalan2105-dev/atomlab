import type { PboMechanismText } from './pboMechanismText'

export const PBO_TEXT_EN: PboMechanismText = {
  intro: {
    title: 'Lead(II) oxide',
    speak: 'Let us watch lead combine with oxygen and see why lead oxide has a layered lattice.',
  },
  steps: {
    reactants: {
      title: 'Starting substances',
      body:
        'On the left is one unit cell of lead metal: a face-centred cubic lattice (FCC, Fm-3m), cell edge a = 495.1 pm, every atom with 12 nearest neighbours 350.1 pm away. ' +
        'On the right is an oxygen molecule O₂: a double bond (σ and π), equilibrium length rₑ = 120.75 pm; the molecule has two unpaired electrons. ' +
        'The metallic radius of lead is 175 pm, the covalent radius of oxygen 66 pm. This is how the substances look in their standard state, at 25 °C: lead is a soft metal (it melts at 327.5 °C) and oxygen a gas.',
      equation: '2 Pb (s) + O₂ (g)',
      note: 'Solid FCC lead is the standard state at 25 °C from which the reaction energy is counted (step 6), not lead at the moment of oxidation: massicot is made above 489 °C, where lead is already molten (it melts at 327.5 °C). Oxygen reacts as the MOLECULE O₂ — there are no lone oxygen atoms in air. The pale threads in the lead cell are a sketch of metallic bonding (electrons shared by the whole crystal), not separate bonds between pairs of atoms; the lobes above and below the O=O axis are the π bond.',
      speak: 'A cell of lead metal on the left, an oxygen molecule with a double bond on the right.',
    },
    sublimation: {
      title: 'Sublimation and dissociation',
      body:
        'Let us split the change into imaginary steps — a convenient way to count the energy. First, a lead atom leaves the metal, which costs 195.2 kJ per mole (sublimation). ' +
        'The O=O double bond breaks homolytically: the bonding electrons are shared out evenly between the atoms. Half a mole of O₂ takes 249.2 kJ — the enthalpy of formation of atomic oxygen, ΔH°f(O, g), at 298 K — and a whole mole of O₂ takes 498.4 kJ. ' +
        'Both stages are endothermic, so the energy ladder goes up.',
      equation: 'Pb (s) → Pb (g);  ½ O₂ (g) → O (g)',
      note: 'This is an IMAGINARY path for counting energy (the Born–Haber cycle), not the reaction mechanism: lead does not evaporate when it is oxidised — its vapour pressure is negligible, and there are no free atoms or gas-phase ions in the real reaction. In reality O₂ settles on the surface of the metal or melt and splits into atoms right there, and the oxide grows as a layer. By Hess’s law the energy does not depend on the path, so the imaginary steps give the right total. Only one cell of the metal is drawn: two atoms go on to react and the rest leave the frame — a real piece of lead holds about 10²³ atoms. At the end of the step the valence dots appear: four on Pb (the 6s² pair and two single 6p), six on O — two pairs and two unpaired electrons, the O(³P) atom.',
      speak: 'Let us take the substances apart in our heads: a lead atom leaves the metal and the double bond in the oxygen molecule breaks. Both steps need energy.',
    },
    transfer: {
      title: 'Two electrons',
      body:
        'Each lead atom gives away two electrons, both 6p: the first costs 715.6 kJ/mol, the second 1450.5 kJ/mol (ionisation energies). The 6s² pair stays on the Pb²⁺ ion — it will matter later. ' +
        'Oxygen takes the first electron with a release of energy (−141.0 kJ/mol) and the second at a cost: +744 kJ/mol, because the electron is forced onto an ion that is already negative, O⁻. ' +
        'The lead ball in the frame changes from 175 pm (metallic radius) to 98 pm (ionic radius of Pb²⁺), the oxygen ball from 66 pm (covalent radius) to 138 pm (ionic radius of O²⁻): the cation is smaller than the atom, the anion larger.',
      equation: 'Pb⁰ − 2e⁻ → Pb²⁺  (×2);  O⁰ + 2e⁻ → O²⁻  (×2)',
      note: 'The dots count valence electrons (four on Pb, two on Pb²⁺, six on O, eight on O²⁻); they are not positions. The flight along an arc and the slowed-down time are conventions. The charge changes in the frame each electron leaves or arrives (Pb → Pb⁺ → Pb²⁺, O → O⁻ → O²⁻), the size of the ball when the ion is complete: Shannon lists no radii for Pb⁺ and O⁻. The Pb²⁺ and O²⁻ radii are taken for CN 4 — the surroundings of both ions in PbO; at CN 6 Pb²⁺ would be 119 pm. The radii 175, 66 and 98, 138 pm are defined differently: metallic — half the Pb–Pb distance in the metal, covalent — from bond lengths (Cordero), ionic — Shannon’s conventional scale tied to the radius of O²⁻; a free Pb atom has no metallic radius, the Pb (g) ball is simply drawn at that size. So the “shrinks — grows” comparison is qualitative. The O²⁻ ion does not exist in the gas: EA₂ is not measured but derived from Born–Haber cycles; gas-phase Pb²⁺ and O²⁻ are steps of the imaginary cycle, the real reaction has none.',
      speak: 'Lead gives away two electrons and gets smaller; the six-s pair stays. Oxygen takes two electrons and gets bigger.',
    },
    massicot: {
      title: 'Massicot',
      body:
        'In the real reaction the oxide grows as a layer on the surface of the lead. When molten lead (it melts at 327.5 °C) is oxidised in air above 489 °C, yellow massicot, β-PbO, forms on the surface of the melt: an orthorhombic lattice Pbcm, a = 589.3, b = 549.0, c = 475.3 pm, Z = 4, density 9.64 g/cm³. ' +
        'Every Pb²⁺ has four O²⁻ neighbours at unequal distances (the shortest 222.1 pm), every O²⁻ four Pb²⁺: CN 4:4. ' +
        'Massicot is stable from 489 °C up to the melting point of PbO, 888 °C.',
      equation: '2 Pb (l) + O₂ (g) → 2 PbO (s, massicot, β),  t > 489 °C',
      note: 'The frame shows a fragment of 2×2×2 unit cells — 64 ions; the pale lines are cell edges, not bonds. The lattice balls are drawn at 0.5 of the radius so that the edges show through the fragment. The ion-by-ion assembly continues the imaginary cycle and is a strongly slowed-down convention: there are no gas-phase Pb²⁺ and O²⁻ ions in the reaction — O₂ is chemisorbed and dissociates on the surface of the melt, the oxide layer grows from the surface, and the Pb–O bond is largely covalent. The yellow frame round the fragment is the colour of the substance (massicot is yellow); the red balls are the CPK colour of the O atom, not the colour of the oxide. The cell is from Hill’s neutron data (1985); in Kay (1961) the edges differ by fractions of a picometre.',
      speak: 'Hot lead oxide crystallises as yellow massicot.',
    },
    litharge: {
      title: 'Litharge',
      body:
        'On slow cooling massicot rearranges into red litharge, α-PbO — the form stable at 25 °C: a tetragonal lattice P4/nmm, a = 397.5, c = 502.3 pm, Z = 2, density 9.34 g/cm³. ' +
        'Each Pb²⁺ sits at the apex of a square pyramid PbO₄: four Pb–O bonds of 232.1 pm point to one side, towards a layer of O²⁻, and on the other side the 6s² pair remains. The layers are stacked so that the pairs face the gap between layers: Pb²⁺ ions across the gap are 384.7 pm apart. ' +
        'ΔH°f of litharge is −219.0 kJ/mol, of massicot −217.3: the yellow form is metastable at 25 °C, lying 1.7 kJ/mol above litharge.',
      equation: 'β-PbO (yellow) → α-PbO (red),  ΔH = −1.7 kJ/mol',
      note: 'The fragment is 2×2×2 cells, 63 ions; at the edges of the frame there are more O²⁻ than Pb²⁺ (39 and 24), while the infinite crystal is exactly PbO. The dotted lines at one Pb²⁺ are its coordination pyramid, not bond sticks. The dots of the 6s² pair above the ion are the school picture of a "protruding pair": according to calculations by Walsh et al. (2011) the asymmetry comes from antibonding mixing of Pb 6s with O 2p, stabilised by an admixture of Pb 6p. Like ions Pb²⁺ are neighbours across the gap here — normal for a layered structure: every ion is still surrounded only by counter-ions. The massicot-to-litharge rearrangement is shown as a convention — one fragment falls apart and the other grows. The red frame is the colour of litharge; the red of the balls is the CPK colour of the O atom, and yellow massicot would have it too. The cell is from Wyckoff (1963); in other studies a differs by tenths of a picometre; the 384.7 pm gap is recalculated from this cell and z(Pb).',
      speak: 'On cooling red litharge forms: layers, with six-s pairs between them.',
    },
    energy: {
      title: 'Energy balance',
      body:
        'Add up the steps of the Born–Haber cycle: +195.2 (sublimation) + 249.2 (dissociation) + 715.6 + 1450.5 (ionisation) − 141.0 + 744.0 (adding two electrons) − 3432.5 (lattice) = −219.0 kJ per mole of PbO — the tabulated enthalpy of formation of litharge. ' +
        'Without the lattice step the sum would be +3213.5 kJ/mol. The equation 2 Pb + O₂ releases 438.0 kJ. ' +
        'PbO is an amphoteric oxide: it dissolves both in acids (PbO + 2 HNO₃ → Pb(NO₃)₂ + H₂O) and in alkalis (PbO + 2 NaOH + H₂O → Na₂[Pb(OH)₄]).',
      equation: '2 Pb (s) + O₂ (g) → 2 PbO (s, litharge),  ΔH = −438.0 kJ',
      note: 'Lattice energy is not measured directly for any substance, not even for NaCl: it is derived from a cycle. So here too the step −3432.5 kJ/mol comes from the cycle itself, and the sum matches the table by construction. The cycle for PbO is FORMAL for another reason: the Pb–O bond is largely covalent, the ionic formulas (Born–Landé, Kapustinskii) disagree with the cycle, and the “lattice” step here is conventional. Reference tables (CRC) give a noticeably larger lattice energy for PbO — the difference comes almost entirely from the choice of EA₂(O). The value EA₂(O) = +744 is consistent with the MgO and CaO lattices; noticeably larger values also appear in the literature, and the lattice step drifts with them. The total refers to 298 K — solid lead and litharge; the real synthesis runs in the melt above 489 °C, where the heat effect is slightly different, but ΔH° at 298 K is a state function and does not depend on the path. The textbook makes PbO not by burning lead but by decomposing lead nitrate: 2 Pb(NO₃)₂ → 2 PbO + 4 NO₂ + O₂, ΔH = +598.6 kJ — the reaction is endothermic and runs only on strong heating.',
      speak: 'The result: minus two hundred and nineteen kilojoules per mole of lead oxide.',
    },
  },
  legend: {
    electron: 'The light-blue dot with a trail and the label e⁻ is the electron being transferred.',
    orbitalPhase: 'Light-blue dots at an atom are valence electrons: the 6s² pair and two 6p on Pb, six on O; Pb²⁺ keeps the 6s² pair, O²⁻ has eight. They count electrons, not the shape of an orbital.',
  },
  safety: 'Lead and all its compounds are poisonous: they accumulate in the body and damage the nervous system. Lead oxide dust and fumes are especially dangerous, and decomposing lead nitrate gives off poisonous NO₂. The experiment is shown only virtually.',
  energy: {
    title: 'Formal Born–Haber cycle',
    unit: 'kJ/mol',
    caption: 'Costs (up) and gains (down) per 1 mol of PbO; the cycle is formal — bonding in PbO is largely covalent.',
    stages: {
      sublimation: 'Pb (s) → Pb (g)',
      dissociation: '½ O₂ → O',
      ionization1: 'Pb → Pb⁺ + e⁻',
      ionization2: 'Pb⁺ → Pb²⁺ + e⁻',
      affinity1: 'O + e⁻ → O⁻',
      affinity2: 'O⁻ + e⁻ → O²⁻',
      lattice: 'Pb²⁺ + O²⁻ → PbO (s)',
      total: 'Result: ΔH°f',
    },
    summary: 'Formal Born–Haber cycle for PbO: sum of steps {dH} kJ/mol',
    sources: 'Reference values: NIST-JANAF, CRC Handbook; the lattice step is derived from the cycle.',
  },
}
