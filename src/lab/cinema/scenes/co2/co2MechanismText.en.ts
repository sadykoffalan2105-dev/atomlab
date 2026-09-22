import type { Co2MechanismText } from './co2MechanismText'

/** English text of the lesson «burning carbon: C (graphite) + O₂ → CO₂». Numbers — the same as ru, in the same order. */
export const CO2_TEXT_EN: Co2MechanismText = {
  intro: {
    title: 'Burning carbon: the polar covalent bond',
    speak: 'Let us see how coal really burns: oxygen sits down on the edge of a graphite sheet, and carbon leaves into the gas already bound to oxygen.',
  },
  steps: {
    reactants: {
      title: 'Graphite and oxygen',
      body:
        'On the left are two sheets of graphite, the standard form of carbon. Inside a sheet the carbon atoms form regular hexagons: each has three neighbours 142.1 pm away, and the bonds are covalent. ' +
        'The sheets lie on top of each other 335.45 pm apart (half of the cell parameter c = 670.9 pm) and are held only by weak intermolecular attraction — that is why graphite is soft and leaves a mark on paper. ' +
        'On the right is an oxygen molecule O₂: two atoms joined by a double bond (σ + π) 120.75 pm long.',
      equation: 'C (graphite, s) + O₂ (g)',
      note:
        'The thin lines are the edges of the graphite unit cell (space group P6₃/mmc, a = 246.1 pm), not bonds. A cut of two sheets is shown; a grain of coal holds many orders of magnitude more sheets and atoms. ' +
        'The balls are drawn at 0.5 of the covalent radius so that bonds and π lobes stay visible. O₂ is a triplet with two unpaired electrons: the simple formula O=O does not show this. Graphite is the standard state of carbon, its ΔH°f is defined as zero.',
      speak: 'Graphite on the left is layered carbon, on the right is a diatomic oxygen molecule.',
    },
    chemisorption: {
      title: 'Oxygen lands on the edge of the sheet',
      body:
        'Inside a sheet every bond of carbon is taken, so oxygen reacts only with the edge. The O₂ molecule lands on two neighbouring edge atoms: the O=O double bond breaks at the very moment the two carbon–oxygen bonds close. ' +
        'The edge now carries surface complexes C(O) — carbonyl groups with a bond length of about 122 pm. No free oxygen atoms appear on the way.',
      equation: 'O₂ (g) + 2 C (sheet edge) → 2 C(O)',
      note:
        'The bond length in the C(O) complex is taken as that of a ketone carbonyl C=O (122 pm): surface groups are close to it, but the value depends on the edge structure. A sheet edge has «zigzag» and «armchair» parts — one case is shown here. ' +
        'The O=O rupture on the surface is drawn as a bond stretching and fading; the step itself is quantum and runs much faster than on screen.',
      speak: 'Oxygen lands on the edge of the sheet. The O=O bond breaks only together with the forming of two carbon–oxygen bonds.',
    },
    desorption: {
      title: 'Carbon monoxide CO leaves the edge',
      body:
        'The edge carbon atom that holds the oxygen loses both of its C–C bonds and leaves the sheet together with the oxygen — as a CO molecule. ' +
        'The bond in CO becomes triple (σ and two π) and shortens to 112.8 pm; it is one of the strongest bonds in chemistry — 1072 kJ/mol. ' +
        'This step gives −110.5 kJ per mole of CO — the heat of formation of carbon monoxide. A free carbon atom never appears, not even for an instant.',
      equation: 'C (graphite) + ½ O₂ (g) → CO (g),  ΔH = −110.5 kJ/mol',
      note:
        'Why not «a C atom flies out of graphite»: atomising graphite costs 716.7 kJ/mol — 323.2 kJ more than the whole reaction releases per mole of CO₂. So atomisation appears only in the energy ladder, as a formal step of Hess’s law, not as a stage of burning. ' +
        'The second C(O) complex also leaves as a CO molecule — one is shown in the frame. The sheet edge is «eaten» atom by atom — that is how coal burns.',
      speak: 'A carbon monoxide molecule leaves the edge of the sheet. There is no free carbon atom.',
    },
    oxidation: {
      title: 'CO + ·OH → CO₂ + H·',
      body:
        'Dry carbon monoxide hardly burns in oxygen: in a flame it is finished off by ·OH radicals, which appear wherever there are even traces of water. ' +
        'The ·OH radical sits down with its oxygen atom on the free end of CO: the second C=O bond closes and the hydrogen atom leaves as an H· radical; the step releases 102.3 kJ/mol. ' +
        'Overall CO + ½ O₂ → CO₂ gives −283.0 kJ per mole of CO, and the whole path from graphite: −110.5 + (−283.0) = −393.5 kJ per mole of CO₂ — the heat of formation of CO₂.',
      equation: 'CO (g) + ·OH (g) → CO₂ (g) + H· (g),  ΔH = −102.3 kJ/mol',
      note:
        'The H· radical does not vanish: meeting O₂ it gives ·OH again — this is a chain reaction, as in burning hydrogen. In reality CO and ·OH pass through a short-lived HOCO complex; it is not drawn here. ' +
        'The O–H bond length in the radical is drawn from water — the lesson data have no separate value for ·OH. One of the two π bonds of CO moves into the new C=O bond, which is why the two π bonds of CO₂ lie in perpendicular planes.',
      speak: 'The OH radical finishes off carbon monoxide: the second carbon–oxygen bond closes, the hydrogen atom leaves.',
    },
    structure: {
      title: 'Structure of CO₂: polar bonds, non-polar molecule',
      body:
        'The CO₂ molecule is linear: the O–C–O angle is 180°, both C=O bonds are the same, 116.0 pm long. Each bond is σ + π, and the two π bonds lie in mutually perpendicular planes. ' +
        'The electronegativity of oxygen is 3.44, of carbon 2.55, the difference 0.89 — so each bond is polar: δ+ on carbon, δ− on the oxygens. ' +
        'But the two equal vectors point in opposite directions and cancel: the dipole moment of the molecule is zero.',
      equation: 'O=C=O,  ∠O–C–O = 180°,  d(C=O) = 116.0 pm,  Σμ = 0',
      note:
        'The lobes above and below the axis are a sketch of π bonds, not an isosurface of the wave function; halfway through the step they fold into the familiar two-stripe notation of a double bond. The dotted arrows are the textbook sign of bond dipole vectors. ' +
        'Oxidation states +4 on carbon and −2 on oxygen are formal bookkeeping: there are no C⁴⁺ and O²⁻ ions in the molecule. The C=O bond in CO₂ is shorter and stronger than in aldehydes and ketones (122 pm, 745 kJ/mol): the mean bond energy in CO₂ is 799 kJ/mol, while the Hess cycle gives 804.3 per bond.',
      speak: 'The bonds are polar, the molecule is not: two equal dipoles point in opposite directions and cancel.',
    },
    solid: {
      title: 'Dry ice',
      body:
        'On cooling, CO₂ becomes a solid — dry ice. It is a molecular lattice: space group Pa-3, cubic cell edge a = 562.4 pm at 150 K. ' +
        'The molecular centres sit on the nodes of a face-centred lattice, every molecule has 12 nearest neighbours, and the cell holds Z = 4 molecules. ' +
        'Inside a molecule the bonds are strong and covalent, between molecules there is only weak intermolecular attraction — so at atmospheric pressure dry ice turns into gas without melting (it sublimes).',
      equation: 'CO₂ (g) → CO₂ (s);  a = 562.4 pm,  Z = 4,  CN 12',
      note:
        'One unit cell and 13 whole molecules are shown: the central one (the molecule formed in the scene) and 12 neighbours at the edge midpoints — together 1 + 12·¼ = 4 molecules per cell. The molecular axes run along four different body diagonals of the cube. ' +
        'In the crystal the C=O bond is slightly shorter — 115.4 pm (X-ray data at 150 K) against 116.0 pm in the gas. The density computed from the cell at 150 K is 1.643 g/cm³. At 25 °C and 1 atm CO₂ is a gas.',
      speak: 'CO₂ molecules gather into a crystal of dry ice: every molecule has twelve neighbours.',
    },
  },
  legend: {
    electron: 'The dotted arrows above the molecule are bond dipole vectors: from δ+ to δ−; their sum is zero.',
    orbitalPhase: 'The lobes above and below a bond axis are π bonds; the two colours are the sign of the p-orbital phase, not a charge.',
  },
  safety:
    'Carbon monoxide CO has neither colour nor smell and is deadly poisonous: it binds tightly to blood haemoglobin and stops it carrying oxygen. ' +
    'Never close a stove until the coals have burnt out completely; burning experiments are done only by the teacher in a fume hood.',
  energy: {
    title: 'Energy by Hess’s law',
    unit: 'kJ/mol',
    caption:
      'Costs (up) and gain (down) per mole of CO₂: +716.7 + 498.4 − 1608.6 = −393.5 kJ/mol. The path through free atoms is formal: atomising graphite is not a physical stage, but by Hess’s law the result does not depend on the path.',
    stages: {
      atomization: 'C (graphite) → C (g) — not a physical stage',
      dissociation: 'O₂ → 2 O',
      bonds: 'C + 2 O → CO₂',
      total: 'Total: ΔH°f',
    },
    summary: 'Hess cycle for CO₂: sum of the steps {dH} kJ/mol',
    sources: 'Reference data: NIST-JANAF, CRC Handbook; bond energies are table averages.',
  },
}
