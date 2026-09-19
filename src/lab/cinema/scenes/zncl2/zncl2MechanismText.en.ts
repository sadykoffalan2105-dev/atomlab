import type { Zncl2MechanismText } from './zncl2MechanismText'

/** Lesson text «Preparing hydrogen: Zn + 2 HCl → ZnCl₂ + H₂↑» — English. */
export const ZNCL2_TEXT_EN: Zncl2MechanismText = {
  intro: {
    title: 'Preparing hydrogen',
    speak: 'Let us watch zinc displace hydrogen from hydrochloric acid — the standard school way to make H₂.',
  },
  steps: {
    acid: {
      title: 'Zinc in hydrochloric acid',
      body:
        'On the left is a plate of zinc metal: the atoms sit in a hexagonal close packing (hcp, P6₃/mmc) with six nearest neighbours in the layer at 266.5 pm and six more in the neighbouring layers at about 291 pm. ' +
        'On the right is the solution. Hydrochloric acid is strong and dissociates completely in water, so there are no HCl molecules in the beaker at all — only H⁺ and Cl⁻ ions. ' +
        'A bare proton cannot survive in water: it attaches to a water molecule at once and exists as the hydronium ion H₃O⁺. The chloride ion is large, 181 pm, and simply drifts past.',
      equation: 'HCl (aq) → H⁺ (aq) + Cl⁻ (aq);  H⁺ + H₂O → H₃O⁺',
      note: 'The frame holds exactly one portion of the reaction: one zinc atom, two protons and two chloride ions, so the charge balances. A real drop of the solution holds about 10²¹ particles.',
      speak: 'There are no HCl molecules in the acid: only hydronium and chloride ions. The zinc is waiting for a proton.',
    },
    contact: {
      title: 'The proton takes electrons',
      body:
        'A hydronium ion reaches the metal surface and hands its proton over, turning back into an ordinary water molecule. ' +
        'The electrons in a metal are shared by the whole piece, so a current of electrons runs through the plate to the spot where the proton has landed. ' +
        'Each proton takes one electron and becomes a neutral hydrogen atom still held on the surface: 2 H⁺ + 2e⁻ → 2 H. The zinc gives away exactly two electrons.',
      equation: '2 H₃O⁺ + 2e⁻ → 2 H (adsorbed) + 2 H₂O',
      note: 'H⁺ is a bare nucleus: its radius is about a hundred thousand times smaller than an atom, so it cannot be drawn to scale and is shown as a small glowing dot. The arc the electron follows is a convention too — shared metal electrons have no individual trajectory.',
      speak: 'A proton lands on the metal and takes an electron. Electrons flow through the whole piece of zinc.',
    },
    hydrogen: {
      title: 'A hydrogen molecule is born',
      body:
        'Two neighbouring hydrogen atoms on the surface find each other and put their electrons into one shared pair — a non-polar covalent bond 74.14 pm long. ' +
        'Breaking that bond costs 436 kJ/mol, so the H₂ molecule is very stable and does not stay in solution. ' +
        'The molecules gather into a bubble, the bubble leaves the plate and floats up: these are the bubbles you see in a Kipp apparatus.',
      equation: '2 H → H₂ (g)↑,  d(H–H) = 74.14 pm,  E(H–H) = 436 kJ/mol',
      note: 'The bubble is drawn as rings of dots. A real millimetre bubble holds some 10¹⁷ hydrogen molecules.',
      speak: 'Two hydrogen atoms join into a molecule. The bubble breaks away and rises.',
    },
    dissolve: {
      title: 'Zinc goes into solution',
      body:
        'Having given away two electrons, the zinc atom is no longer held by the lattice and moves into the water as a Zn²⁺ ion. ' +
        'It loses both outer 4s electrons and shrinks from 134 to 74 pm — almost by half: a cation is always smaller than its atom. ' +
        'A bare ion does not exist in water: six water molecules turn their oxygen (which carries a partial negative charge) towards it and build the octahedral aqua complex [Zn(H₂O)₆]²⁺ with a Zn–O distance of 208 pm.',
      equation: 'Zn⁰ − 2e⁻ → Zn²⁺;  Zn²⁺ + 6 H₂O → [Zn(H₂O)₆]²⁺',
      note: 'While the zinc is still in the metal it is too early to say "the atom became an ion": the electrons there are shared. It is the atom that has left the lattice that becomes Zn²⁺. The lines between the ion and the water mark ion–dipole attraction; there are no threads there.',
      speak: 'Zinc leaves as an ion. It is almost twice smaller now and wears a coat of six water molecules.',
    },
    spectators: {
      title: 'Spectator ions and the ZnCl₂ solution',
      body:
        'The chloride ions did not change at all: Cl⁻ before, Cl⁻ after. Such particles are called spectator ions and are left out of the net ionic equation. ' +
        'The beaker now holds a solution of zinc chloride: the Zn²⁺ and Cl⁻ ions are separated by water and not bonded to each other. ' +
        'Evaporate the solution and white ZnCl₂ is left: a tetragonal crystal, space group I-42d, a = 539.8 pm, c = 1033 pm, where zinc is surrounded not by six water molecules but by four chlorides (Zn–Cl 229 pm).',
      equation: 'Zn + 2 H⁺ → Zn²⁺ + H₂↑  (Cl⁻ is a spectator)',
      note: 'In concentrated hydrochloric acid the picture is more complex: chloride ions push the water out and chloro complexes such as [ZnCl₄]²⁻ appear. The scene shows a dilute solution, where zinc stays an aqua complex.',
      speak: 'The chloride ions are unchanged — they are spectators. The beaker holds zinc chloride solution.',
    },
    energy: {
      title: 'Energy and safety',
      body:
        'The reaction is exothermic: ΔH = −153.9 kJ per mole of zinc, and the tube warms up noticeably. Break it down with Hess’s law: the zinc has to be vaporised (+130.4), two electrons torn off (+906.4 and +1733.3) and the protons pulled out of the water (+2182) — while the gain comes from the protons taking the electrons (−2624), the H₂ molecule forming (−436) and the zinc ion being hydrated (−2046). ' +
        'The shortest answer to "why does it go at all" is the activity series: E°(Zn²⁺/Zn) = −0.76 V, E°(2H⁺/H₂) = 0.00 V, so the cell potential is +0.76 V > 0. ' +
        'For copper E° = +0.34 V and the cell potential comes out as −0.34 V — which is why copper does not dissolve in hydrochloric acid and does not release hydrogen from it.',
      equation: 'Zn (s) + 2 HCl (aq) → ZnCl₂ (aq) + H₂ (g)↑,  ΔH = −153.9 kJ/mol',
      note: 'The individual rungs use the scale where the hydration enthalpy of the proton is taken as −1091 kJ/mol: the choice cancels out in a charge-balanced equation, but a single rung must not be compared with a number from another compilation.',
      speak: 'The reaction gives off heat: minus one hundred and fifty four kilojoules. Zinc is more active than hydrogen; copper is not.',
    },
  },
  legend: {
    electron: 'A blue dot with a trail is an electron travelling through the metal to a proton.',
    orbitalPhase: 'The shimmer inside the plate marks the free electrons of the metal — not their trajectories.',
    water: 'A red sphere with two white ones is a water molecule: O–H 95.8 pm, H–O–H angle 104.45°.',
  },
  safety:
    'Hydrogen mixed with air is explosive and a single spark is enough, so it is collected over water and always tested for purity before being lit. Hydrochloric acid burns skin and eyes: wear goggles and gloves, and always add the acid to the water, never the other way round.',
  energy: {
    title: 'Reaction energy (Hess cycle)',
    unit: 'kJ/mol',
    caption: 'Costs (up) and gains (down) per mole of zinc; the sum of the rungs is the heat of the reaction.',
    stages: {
      sublimation: 'Zn (s) → Zn (g)',
      ionization1: 'Zn → Zn⁺ + e⁻',
      ionization2: 'Zn⁺ → Zn²⁺ + e⁻',
      dehydration: '2 H⁺ (aq) → 2 H⁺ (g)',
      neutralization: '2 H⁺ + 2e⁻ → 2 H',
      recombination: '2 H → H₂ (g)',
      hydration: 'Zn²⁺ (g) → Zn²⁺ (aq)',
      total: 'Total: ΔH of the reaction',
    },
    summary: 'Hess cycle for Zn + 2H⁺ → Zn²⁺ + H₂: the rungs add up to {dH} kJ/mol',
    sources: 'Reference values: CRC Handbook, NIST-JANAF; hydration enthalpies on the ΔH(H⁺) = −1091 kJ/mol scale (Smith, 1977).',
  },
}
