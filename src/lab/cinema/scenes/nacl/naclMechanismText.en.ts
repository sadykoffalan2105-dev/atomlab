import type { NaclMechanismText } from './naclMechanismText'

export const NACL_TEXT_EN: NaclMechanismText = {
  intro: {
    title: 'Ionic bond',
    speak: 'Let us watch sodium and chlorine become table salt: an electron moves from one atom to another.',
  },
  steps: {
    reactants: {
      title: 'Starting substances',
      body:
        'On the left is a piece of sodium metal: Na atoms sit in a body-centred cubic lattice (BCC, Im-3m), each with eight nearest neighbours 371.6 pm away. ' +
        'On the right is a chlorine molecule Cl₂: two atoms held by one shared electron pair, bond length 198.8 pm. ' +
        'The radius of a sodium atom in the metal is 186 pm, the covalent radius of a chlorine atom 102 pm (half the Cl–Cl bond length is 99 pm — the difference is within the reference spread). At 25 °C chlorine is a gas and sodium a solid metal.',
      equation: '2 Na (s) + Cl₂ (g)',
      note: 'Chlorine enters the reaction as the MOLECULE Cl₂, not as separate atoms: there are no lone chlorine atoms in the cylinder.',
      speak: 'Sodium metal on the left, a chlorine molecule on the right. Chlorine is always diatomic.',
    },
    sublimation: {
      title: 'Sublimation and dissociation',
      body:
        'Before anything can react the particles must be set free. A sodium atom leaves the metal lattice, which costs 107.3 kJ per mole (sublimation). ' +
        'The Cl–Cl bond breaks homolytically: the shared pair splits evenly, one electron to each atom. Half a mole of Cl₂ takes 121.7 kJ. ' +
        'Both stages are endothermic, so the energy ladder goes up.',
      equation: 'Na (s) → Na (g);  ½ Cl₂ (g) → Cl (g)',
      note: 'Only a nine-atom fragment of the metal is drawn; a real piece of sodium holds about 10²³ atoms.',
      speak: 'A sodium atom leaves the metal and the chlorine bond splits in half. Both stages need energy.',
    },
    transfer: {
      title: 'Giving and taking the electron',
      body:
        'The single outer electron of sodium (3s¹) moves to a chlorine atom; removing it costs 495.8 kJ/mol (the ionisation energy). ' +
        'Sodium loses a whole electron shell and shrinks from 186 to 102 pm — it is now the cation Na⁺. ' +
        'Chlorine completes its octet and swells from 102 to 181 pm: the anion Cl⁻ is about 1.8 times larger than Na⁺. Adding the electron releases 349 kJ/mol.',
      equation: 'Na⁰ − 1e⁻ → Na⁺  (×2);  Cl₂⁰ + 2e⁻ → 2 Cl⁻',
      note: 'The arc the electron flies along and the glowing ring around sodium are conventions: the transfer is a quantum jump, and the ring only marks where the outer electron is.',
      speak: 'Sodium gives away one electron and gets smaller. Chlorine takes it and gets bigger.',
    },
    attraction: {
      title: 'Electrostatic attraction',
      body:
        'Opposite charges attract by Coulomb’s law: the force falls with the square of the distance between them. ' +
        'Na⁺ and Cl⁻ come together until attraction is balanced by the repulsion of their filled electron shells — at 282 pm. ' +
        'That is the ionic bond: not a shared pair, but the attraction of whole charges.',
      equation: 'Na⁺ + Cl⁻ → Na⁺Cl⁻,  d = 282 pm',
      note: 'The field lines are drawn as dots to show the direction of the pull; of course there are no real threads between the ions.',
      speak: 'Plus and minus attract and settle two hundred eighty-two picometres apart.',
    },
    lattice: {
      title: 'The crystal lattice',
      body:
        'One pair is not the end: every ion attracts all its neighbours. The ions stack into the rock-salt lattice — space group Fm-3m, two face-centred cubic sublattices, cell edge 564.0 pm, Z = 4, density 2.165 g/cm³. ' +
        'Charges alternate strictly, so ions of the same sign are never neighbours. ' +
        'Each Na⁺ has exactly six Cl⁻ at the corners of an octahedron and each Cl⁻ six Na⁺: the coordination number is 6. Building the lattice releases 786 kJ/mol.',
      equation: 'Na⁺ (g) + Cl⁻ (g) → NaCl (s),  U = −786 kJ/mol',
      note: 'The frame shows a 4×4×4 fragment — 64 ions. A salt grain one millimetre across holds about 10¹⁹.',
      speak: 'The ions build a cubic lattice. Every ion has six neighbours of the opposite sign.',
    },
    energy: {
      title: 'The energy balance',
      body:
        'Add up the Born–Haber cycle: +107.3 (sublimation) + 121.7 (dissociation) + 495.8 (ionisation) − 348.6 (electron affinity) − 787.0 (lattice) = −411 kJ per mole of NaCl. ' +
        'Without the lattice energy the first four steps would add to +376 kJ/mol, and the process would absorb heat instead. ' +
        'It is the lattice energy that makes the reaction exothermic: sodium burns in chlorine with a bright yellow flame.',
      equation: '2 Na (s) + Cl₂ (g) → 2 NaCl (s),  ΔH = −822 kJ',
      note: 'The yellow flame is light from excited sodium atoms (the D line, 589 nm), not the colour of the salt itself.',
      speak: 'The result is minus four hundred eleven kilojoules per mole. The lattice supplies the energy.',
    },
  },
  legend: {
    electron: 'The blue dot with a trail is the electron being transferred.',
    orbitalPhase: 'The glowing ring around sodium is a schematic mark for the outer 3s¹ electron, not the shape of the orbital.',
  },
  safety: 'Chlorine is poisonous and sodium catches fire on contact with water. Only a teacher may show sodium burning in chlorine, in a fume hood — never repeat it yourself.',
  energy: {
    title: 'Born–Haber cycle',
    unit: 'kJ/mol',
    caption: 'Costs (up) and gains (down) per mole of NaCl; the sum of the steps is the enthalpy of formation.',
    stages: {
      sublimation: 'Na (s) → Na (g)',
      dissociation: '½ Cl₂ → Cl',
      ionization: 'Na → Na⁺ + e⁻',
      affinity: 'Cl + e⁻ → Cl⁻',
      lattice: 'Na⁺ + Cl⁻ → NaCl (s)',
      total: 'Total: ΔH°f',
    },
    summary: 'Born–Haber cycle for NaCl: the steps add up to {dH} kJ/mol',
    sources: 'Reference values: NIST-JANAF, CRC Handbook (lattice energy from the Born–Haber cycle).',
  },
}
