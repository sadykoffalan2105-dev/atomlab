import type { Co2MechanismText } from './co2MechanismText'

/** English text of the lesson «burning carbon: C (graphite) + O₂ → CO₂». */
export const CO2_TEXT_EN: Co2MechanismText = {
  intro: {
    title: 'Polar covalent bond',
    speak: 'Let us watch coal burn: carbon and oxygen do not hand over electrons, they share them — almost evenly.',
  },
  steps: {
    reactants: {
      title: 'Coal and oxygen',
      body:
        'On the left is a grain of graphite. Its carbon atoms sit in flat sheets of regular hexagons: inside a sheet every atom has three neighbours 141.8 pm away. ' +
        'The sheets themselves lie 335 pm apart and are held together only by weak intermolecular attraction — that is why graphite is soft and leaves a mark on paper. ' +
        'On the right are oxygen molecules O₂: two atoms joined by a DOUBLE bond 120.8 pm long. Coal has to be made red hot before it burns: charcoal catches fire near 300 °C, coke and graphite only at 600–700 °C.',
      equation: 'C (graphite) + O₂ (g)',
      note:
        'A fragment of two sheets of 24 atoms is shown; a grain of coal holds more than 10²⁰ of them. Ignition temperatures depend on the form of the carbon and the grain size, so they are given as orders of magnitude. ' +
        'Graphite is the standard state of carbon: its ΔH°f is defined as zero (diamond is +1.9 kJ/mol).',
      speak: 'Graphite on the left is layered carbon, on the right are diatomic oxygen molecules. The coal has to be heated first.',
    },
    erosion: {
      title: 'An atom leaves the sheet',
      body:
        'A carbon atom leaves the edge of the glowing sheet: the two C–C bonds that held it to its neighbours break. ' +
        'Tearing one mole of atoms out of graphite costs 716.7 kJ — the enthalpy of atomisation, the most expensive step of the whole reaction. ' +
        'That is why coal never lights by itself: until you supply heat, the atoms do not have enough energy to leave the lattice.',
      equation: 'C (graphite) → C (g),  ΔH = +716.7 kJ/mol',
      note:
        'THE FREE CARBON ATOM IS A STEP OF THE CALCULATION under Hess’s law, not a particle of the flame. Coal really burns at the surface: oxygen reacts with the atoms at the edge of the sheet directly. ' +
        'Hess’s law lets us take any path — the heat of reaction does not depend on it.',
      speak: 'A carbon atom leaves the sheet. This is the most expensive step: seven hundred and sixteen kilojoules per mole.',
    },
    firstBond: {
      title: 'The first C=O bond',
      body:
        'An oxygen molecule comes up to the carbon atom. The O=O double bond breaks HOMOLYTICALLY: the shared pairs split evenly, each atom keeps its own half, and that takes 498 kJ per mole of O₂. ' +
        'The first oxygen atom settles on the carbon and the C=O bond closes. ' +
        'Oxygen is more electronegative than carbon, so the shared electron density is pulled towards it: the bond is POLAR COVALENT, not ionic — the electrons stay shared.',
      equation: 'O₂ (g) → 2 O (g), ΔH = +498 kJ/mol;  C + O → C=O',
      note:
        'The first bond is already drawn the way it will look in the finished CO₂. If there is enough oxygen the second atom joins almost at once; ' +
        'if there is not, the carbon stops at carbon monoxide CO, where the bond is TRIPLE (step 6).',
      speak: 'The bond in the oxygen molecule splits in half and the first oxygen atom settles on the carbon.',
    },
    linear: {
      title: 'The molecule straightens out',
      body:
        'The second oxygen atom comes in from the side, and for a moment the particle is BENT — about 155°. But the carbon here has only two regions of electron density and no lone pairs, ' +
        'so they push each other as far apart as possible: the molecule straightens to exactly 180°. ' +
        'The carbon in CO₂ is sp hybridised — two sp orbitals hold the σ bonds along the axis, and the two remaining p orbitals give TWO π bonds in perpendicular planes. ' +
        'Each C=O bond is σ + π: 116.0 pm long, 799 kJ/mol, shorter and stronger than the ordinary C=O double bond of aldehydes (122 pm, 745 kJ/mol).',
      equation: 'O=C=O,  ∠O–C–O = 180°,  d(C=O) = 116.0 pm',
      note:
        'The violet clouds above and below the axis are a schematic sign of the π bonds, and the blue “drops” on the carbon are an equally schematic picture of the sp hybrid orbitals. ' +
        'These are NOT isosurfaces of a wavefunction, only a marker for a region of raised electron density.',
      speak: 'The second bond closes and the molecule straightens into a line. The carbon is sp hybridised and the two pi bonds lie in perpendicular planes.',
    },
    polarity: {
      title: 'Polar bonds, non-polar molecule',
      body:
        'The electronegativity of oxygen is 3.44 and of carbon 2.55: the difference is 0.89. So every C=O bond is polar — δ+ on the carbon, δ− on the oxygens. ' +
        'But the molecule is linear and symmetric: two identical vectors point in exactly opposite directions and add up to zero. The dipole moment of the whole CO₂ is therefore 0 D — polar bonds, non-polar molecule. ' +
        'Carbon dioxide still dissolves in water, and a small part of the dissolved CO₂ turns into carbonic acid H₂CO₃ — that is where the sharp taste of fizzy water comes from.',
      equation: 'μ(C=O) ≠ 0, but Σμ = 0;  CO₂ + H₂O ⇌ H₂CO₃',
      note:
        'The oxidation states +4 for carbon and −2 for oxygen are a FORMAL count: there are no real C⁴⁺ and O²⁻ ions in the molecule, the electrons are only shifted towards oxygen. ' +
        'Less than one per cent of the dissolved CO₂ becomes H₂CO₃, which is why the equation carries an equilibrium sign rather than an arrow.',
      speak: 'The bonds are polar but the molecule is not: two identical dipoles point opposite ways and cancel out.',
    },
    energy: {
      title: 'Energy: heat, light and carbon monoxide',
      body:
        'Add the steps under Hess’s law: +716.7 kJ to atomise the graphite, +498.4 to break the O₂ and −1608.6 to form the two C=O bonds. The total is −393.5 kJ per mole of CO₂ — that is the heat and light one mole of burning carbon gives. ' +
        'A simpler estimate from MEAN bond enthalpies gives −383 kJ: the ≈ 10 kJ gap appears because the tabulated 799 kJ/mol is an average, while in CO₂ itself the bond is a little stronger, 804 kJ/mol. ' +
        'And when oxygen runs short, carbon monoxide CO forms instead of CO₂: three times less heat (−110.5 kJ/mol) and a deadly poisonous gas.',
      equation: 'C (graphite) + O₂ (g) → CO₂ (g),  ΔH°f = −393.5 kJ/mol;  2 C + O₂ → 2 CO,  ΔH°f(CO) = −110.5 kJ/mol',
      note: 'The ladder follows the atomisation route: it is a way to CALCULATE with Hess’s law, not the mechanism of burning.',
      speak: 'Minus three hundred and ninety three and a half kilojoules per mole. And when oxygen runs short you get poisonous carbon monoxide.',
    },
  },
  legend: {
    electron: 'The orange-and-blue arrow is the dipole moment of a bond: it points from δ+ to δ−.',
    orbitalPhase: 'The blue “drops” are schematic sp hybrid orbitals of the carbon; the violet clouds above and below the axis are the two π bonds in perpendicular planes.',
  },
  safety:
    'Carbon monoxide CO has no colour and no smell and is deadly poisonous: it binds to haemoglobin roughly 200 times more strongly than oxygen. ' +
    'A stove must never be closed until the embers have burnt out, and combustion experiments are run only by the teacher in a fume hood.',
  energy: {
    title: 'Energy by Hess’s law',
    unit: 'kJ/mol',
    caption: 'Cost (up) and gain (down) per mole of CO₂; the sum of the steps is the heat of formation. This is a CALCULATION route, not the mechanism of burning.',
    stages: {
      atomization: 'C (graphite) → C (gas)',
      dissociation: 'O₂ → 2 O',
      bonds: 'C + 2 O → CO₂',
      total: 'Total: ΔH°f',
    },
    summary: 'Hess cycle for CO₂: the steps add up to {dH} kJ/mol',
    sources: 'Reference values: NIST-JANAF, CRC Handbook; bond enthalpies are tabulated averages.',
  },
}
