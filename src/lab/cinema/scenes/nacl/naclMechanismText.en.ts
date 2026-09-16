import type { NaclMechanismText } from './naclMechanismText'

export const NACL_TEXT_EN: NaclMechanismText = {
  intro: {
    title: 'Ionic bond',
    speak: 'Let us watch sodium and chlorine become table salt: an electron moves from one atom to another.',
  },
  steps: {
    approach: {
      title: 'Atoms approach',
      body:
        'Left and right are sodium atoms: each has a single outer electron (3s¹) that it gives away easily. ' +
        'In the middle is a chlorine molecule Cl₂: two atoms share one electron pair, and each is one electron short of a stable octet. ' +
        'Atomic radius of Na is 1.86 Å, of Cl 0.99 Å.',
      equation: '2 Na + Cl₂',
      speak: 'Sodium atoms approach the chlorine molecule. Sodium has one outer electron; chlorine is one electron short of eight.',
    },
    homolysis: {
      title: 'The Cl–Cl bond breaks',
      body:
        'Next to sodium the chlorine molecule becomes unstable: the shared pair splits evenly, one electron to each chlorine atom. ' +
        'This is called homolytic cleavage. The result is two chlorine atoms with seven outer electrons each.',
      equation: 'Cl₂ → 2 Cl',
      note: 'In reality sodium burns in chlorine — the stages take a fraction of a second; here they are slowed down.',
      speak: 'The bond between the chlorine atoms splits in half. Two chlorine atoms form.',
    },
    transfer: {
      title: 'Electron transfer',
      body:
        'The single outer electron of sodium jumps to a chlorine atom. Sodium became the cation Na⁺ — it lost a whole electron shell and is about half the size (1.02 Å). ' +
        'Chlorine accepted the electron, completed its octet and became the anion Cl⁻ — noticeably larger than the atom (1.81 Å). The ion charges are labelled.',
      equation: 'Na − e⁻ → Na⁺ ;  Cl + e⁻ → Cl⁻',
      note: 'The glow around sodium is a schematic highlight of the 3s orbital; the electron does not “fly” — it is redistributed between the atoms.',
      speak: 'The sodium electron moves to chlorine. Sodium becomes a positive ion and shrinks; chlorine becomes a negative ion and grows.',
    },
    attraction: {
      title: 'Ions attract',
      body:
        'Opposite charges attract: the cation Na⁺ and the anion Cl⁻ move together until their electron shells touch. ' +
        'This is the ionic bond — electrostatic attraction between ions. It has no direction: an ion attracts neighbours from every side.',
      equation: 'Na⁺ + Cl⁻ → Na⁺Cl⁻',
      speak: 'Positive and negative ions attract each other. This is the ionic bond.',
    },
    lattice: {
      title: 'Crystal lattice',
      body:
        'Salt contains no separate NaCl molecules: the ions build a cubic lattice in which every Na⁺ is surrounded by six Cl⁻ and every Cl⁻ by six Na⁺. ' +
        'The Na–Cl distance in the crystal is 2.82 Å. First a cube of eight ions forms, then neighbours attach to it and a 4×4×4 lattice fragment (64 ions) grows. At the end one Na⁺ and its six Cl⁻ neighbours are highlighted: coordination number 6.',
      equation: '2 Na + Cl₂ → 2 NaCl',
      note: 'The formula NaCl gives the 1 : 1 ratio of ions, not a molecule.',
      speak: 'The ions settle into a cubic lattice: plus, minus, plus, minus. There are no separate salt molecules.',
    },
    energy: {
      title: 'Energy release',
      body:
        'The reaction is strongly exothermic: 411 kJ is released per mole of NaCl — sodium burns in chlorine with a bright yellow flame. ' +
        'Most of the energy comes from assembling the lattice (−787 kJ/mol); it more than pays for removing the electron from sodium and breaking Cl₂.',
      equation: '2 Na + Cl₂ → 2 NaCl,  ΔH° = −822 kJ (−411 kJ per mole of NaCl)',
      speak: 'A lot of heat and light is released. The energy comes from building the ionic lattice.',
    },
  },
  legend: {
    electron: 'Glowing dot — the 3s¹ electron of sodium; the trail shows its path to chlorine',
    orbitalPhase: 'Blue ring — the outer (3s) orbital of sodium just before it gives up the electron',
  },
  safety:
    'Sodium and chlorine are dangerous: the metal reacts explosively with water, chlorine is a toxic gas. The experiment is shown only in a fume hood.',
  energy: {
    title: 'Where the energy comes from: Born–Haber cycle',
    unit: 'kJ/mol',
    caption: 'Costs (up) and gains (down) per 1 mol NaCl; the sum of the steps is the enthalpy of formation.',
    stages: {
      sublimation: 'Na (s) → Na (g)',
      ionization: 'Na → Na⁺ + e⁻',
      dissociation: '½ Cl₂ → Cl',
      affinity: 'Cl + e⁻ → Cl⁻',
      lattice: 'Na⁺ + Cl⁻ → NaCl (s)',
      total: 'Total: ΔH°f',
    },
    summary: 'Born–Haber cycle for NaCl: the steps add up to {dH} kJ/mol',
    sources: 'Reference values: NIST-JANAF, CRC Handbook (lattice energy from the Born–Haber cycle).',
  },
}
