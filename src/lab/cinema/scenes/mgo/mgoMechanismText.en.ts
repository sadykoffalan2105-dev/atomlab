import type { MgoMechanismText } from './mgoMechanismText'

export const MGO_TEXT_EN: MgoMechanismText = {
  intro: {
    title: 'Ionic bond: two electrons',
    speak: 'Let us watch magnesium burn: every atom hands oxygen two electrons at once.',
  },
  steps: {
    reactants: {
      title: 'Starting substances',
      body:
        'On the left is a piece of magnesium metal: Mg atoms in a hexagonal close-packed lattice (HCP, P6₃/mmc), each with twelve nearest neighbours about 320 pm away. ' +
        'On the right is an oxygen molecule O₂: the atoms are held by a DOUBLE bond, 120.8 pm long and worth 498 kJ/mol — twice as strong as the Cl–Cl bond. ' +
        'A magnesium atom in the metal has a radius of 160 pm, the covalent radius of an oxygen atom is only 66 pm. At 25 °C oxygen is a gas and magnesium a silvery metal.',
      equation: '2 Mg (s) + O₂ (g)',
      note: 'Oxygen enters the reaction as the MOLECULE O₂, never as single atoms; the frame shows 13 metal atoms, while a real magnesium ribbon holds about 10²¹.',
      speak: 'Magnesium metal on the left, an oxygen molecule with a double bond on the right.',
    },
    ignition: {
      title: 'Ignition',
      body:
        'The reaction does not start by itself: the ribbon is covered by an oxide film and the O=O bond has to be broken. A match or a burner gives the first push — after that magnesium burns on its own, releasing so much heat that the flame reaches about 3100 K and shines almost white. ' +
        'A magnesium atom leaves the metal lattice, which costs 147.1 kJ per mole (sublimation). ' +
        'The O=O double bond breaks homolytically, into equal halves: 249.2 kJ per half mole of O₂. Both steps are endothermic — the energy ladder goes up.',
      equation: 'Mg (s) → Mg (g);  ½ O₂ (g) → O (g)',
      note: 'The white flame is drawn as a glow and a flash. Real burning magnesium also emits strong ultraviolet — never look at it without a dark filter.',
      speak: 'One spark and magnesium burns with a blinding white flame. The bond inside the oxygen molecule splits in half.',
    },
    transfer: {
      title: 'Two electrons from every atom',
      body:
        'Magnesium has two electrons in its outer shell (3s²) and gives up both. The first costs 737.7 kJ/mol, the second 1450.7: it is pulled away from an already positive Mg⁺ ion, so it costs twice as much. ' +
        'Magnesium loses a whole electron shell and shrinks from 160 to 72 pm — that is the cation Mg²⁺. Oxygen completes its octet and swells from 66 to 140 pm: the anion O²⁻ is 1.94 times larger than Mg²⁺. ' +
        'Here is the key point: oxygen gains 141 kJ/mol when it takes the first electron, but the second one COSTS 744 kJ/mol, because the O⁻ ion is already negative and repels the next electron.',
      equation: 'Mg⁰ − 2e⁻ → Mg²⁺  (×2);  O₂⁰ + 4e⁻ → 2 O²⁻',
      note: 'The arc flown by the electron and the glowing rings around magnesium are conventions: the transfer is a quantum jump, and the rings only say that there are two outer electrons.',
      speak: 'Magnesium gives away two electrons and shrinks sharply. Oxygen takes two and doubles in size.',
    },
    attraction: {
      title: 'Four times the attraction',
      body:
        'Opposite charges attract by Coulomb’s law: the force is proportional to the product of the charges and inversely proportional to the square of the distance. ' +
        'Here the charges are ±2 instead of ±1, so their product is four times larger than in table salt — the attraction is four times stronger. ' +
        'Mg²⁺ and O²⁻ come together until attraction is balanced by the repulsion of the filled shells, at 210.6 pm (282 pm in NaCl).',
      equation: 'Mg²⁺ + O²⁻ → Mg²⁺O²⁻,  d = 210.6 pm',
      note: 'The field lines are drawn with dots to show the direction of attraction; there are of course no real threads between the ions.',
      speak: 'Double the charges and a shorter distance make the attraction four times stronger than in table salt.',
    },
    lattice: {
      title: 'The lattice and why MgO is refractory',
      body:
        'The ions build the same lattice type as rock salt: space group Fm-3m, two face-centred cubic sublattices, cell edge 421.1 pm, Z = 4, density 3.58 g/cm³. ' +
        'The charges alternate strictly, so ions of the same sign are never neighbours; every Mg²⁺ has exactly six O²⁻ neighbours and vice versa — coordination number 6. ' +
        'Building the lattice releases 3789 kJ/mol, almost five times more than NaCl (787). That is why MgO is refractory: melting it takes 2852 °C against 801 °C for table salt, and furnaces are lined with it.',
      equation: 'Mg²⁺ (g) + O²⁻ (g) → MgO (s),  U = −3789 kJ/mol',
      note: 'The frame shows a 4×4×4 fragment — 64 ions. A periclase grain one millimetre across holds about 10¹⁹.',
      speak: 'The same lattice as salt, but with double charges — and magnesium oxide melts only at 2852 degrees.',
    },
    energy: {
      title: 'The energy balance',
      body:
        'Add up the Born–Haber cycle: +147.1 (sublimation) + 249.2 (dissociation) + 737.7 (IE₁) + 1450.7 (IE₂) − 141.0 (EA₁) + 744.0 (EA₂) − 3789.0 (lattice) = −601 kJ per mole of MgO. The tabulated enthalpy of formation is −601.6 — they agree. ' +
        'Without the lattice energy the first six steps would add up to +3188 kJ/mol and the process would never happen. ' +
        'Everything rests on the lattice energy: it turns this reaction into one of the brightest in school chemistry.',
      equation: '2 Mg (s) + O₂ (g) → 2 MgO (s),  ΔH = −1202 kJ',
      note: 'The second electron affinity of oxygen is not measured directly — it is extracted from the Born–Haber cycle, so handbooks give it between +744 and +844 kJ/mol and the lattice energy between −3789 and −3850. We use the consistent pair that closes the cycle against the tabulated ΔH°f.',
      speak: 'The result is minus six hundred and one kilojoules per mole of oxide. The lattice supplies all of it.',
    },
  },
  legend: {
    electron: 'The blue dot with a trail is a transferring electron; there are four of them, two from each magnesium atom.',
    orbitalPhase: 'The two glowing rings around magnesium schematically mark its two outer 3s² electrons, not the shape of the orbital.',
  },
  safety:
    'Never look straight at burning magnesium: the flame gives not only blinding light but also ultraviolet that damages the eyes. Only a teacher may run the demonstration, through a dark filter; burning magnesium must never be put out with water, because it decomposes water.',
  energy: {
    title: 'Born–Haber cycle',
    unit: 'kJ/mol',
    caption: 'Costs (up) and gains (down) per mole of MgO; the sum of the steps is the enthalpy of formation.',
    stages: {
      sublimation: 'Mg (s) → Mg (g)',
      dissociation: '½ O₂ → O',
      ionization1: 'Mg → Mg⁺ + e⁻',
      ionization2: 'Mg⁺ → Mg²⁺ + e⁻',
      affinity1: 'O + e⁻ → O⁻',
      affinity2: 'O⁻ + e⁻ → O²⁻',
      lattice: 'Mg²⁺ + O²⁻ → MgO (s)',
      total: 'Total: ΔH°f',
    },
    summary: 'Born–Haber cycle for MgO: the steps add up to {dH} kJ/mol',
    sources: 'Reference values: NIST-JANAF, CRC Handbook (lattice energy and EA₂ from the Born–Haber cycle).',
  },
}
