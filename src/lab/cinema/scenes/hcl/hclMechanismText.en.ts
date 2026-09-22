import type { HclMechanismText } from './hclMechanismText'

/** English lesson text for the chain reaction H₂ + Cl₂ → 2 HCl. */
export const HCL_TEXT_EN: HclMechanismText = {
  intro: {
    title: 'Chain reaction',
    speak: 'Let us see how hydrogen and chlorine make hydrogen chloride: one spark of light is picked up by a whole chain of steps.',
  },
  steps: {
    mixture: {
      title: 'The mixture in the dark',
      body:
        'The vessel holds two elements: hydrogen molecules H₂ (bond length 74.1 pm) and chlorine molecules Cl₂ (198.8 pm). Both are gases at 25 °C and both are diatomic — there are no free atoms here. ' +
        'In the dark the mixture can sit for years: breaking the Cl–Cl bond costs 243 kJ per mole, and room-temperature heat is nowhere near enough. ' +
        'Note the sizes: the covalent radius of hydrogen is 31 pm and of chlorine 102 pm — hydrogen is three times smaller.',
      equation: 'H₂ (g) + Cl₂ (g) — nothing happens in the dark',
      note: 'A few molecules are drawn; one litre of gas at ordinary conditions holds about 2.7 · 10²² of them.',
      speak: 'The vessel holds hydrogen and chlorine. In the dark they do not react: there is not enough energy to break a bond.',
    },
    initiation: {
      title: 'A quantum of light: initiation',
      body:
        'A single quantum of light with a wavelength of at most 492 nm — blue or violet — is enough to break the Cl–Cl bond. ' +
        'The break is HOMOLYTIC: the shared pair splits evenly, one electron to each atom. The result is two Cl• radicals, particles with an unpaired electron and very reactive. ' +
        'This is the initiation step, and it happens only once for the whole reaction.',
      equation: 'Cl₂ + hν → 2 Cl•,  D(Cl–Cl) = 243 kJ/mol',
      note: 'The unpaired electron is drawn as one dot on a glowing shell — a symbol, not an orbit: the electron is smeared around the nucleus.',
      speak: 'A quantum of blue light splits the chlorine molecule in half. Two radicals appear — atoms with an unpaired electron.',
    },
    propagation1: {
      title: 'The first link of the chain',
      body:
        'The Cl• radical strikes a hydrogen molecule and pulls one atom away: the first HCl molecule is born and the second hydrogen atom is left as an H• radical. ' +
        'The H–Cl bond, 127.5 pm long, is POLAR COVALENT: the shared pair is pulled towards chlorine, whose electronegativity is higher (3.16 against 2.20, a difference of 0.96). Chlorine carries δ− and hydrogen δ+; the bond is only about 18 % ionic, and there are no ions in the gas. ' +
        'This step is slightly endothermic, ΔH = +4 kJ/mol, and it is the slowest link in the chain.',
      equation: 'Cl• + H₂ → HCl + H•,  ΔH = +4 kJ/mol',
      note: 'The shift of electron density towards chlorine is EXAGGERATED threefold in the picture: the real 18 % would be almost invisible.',
      speak: 'The chlorine radical pulls a hydrogen atom away. Hydrogen chloride forms, and a new hydrogen radical appears.',
    },
    propagation2: {
      title: 'The second link — and the chain runs',
      body:
        'The H• radical crashes into the next Cl₂ molecule: a second HCl molecule forms and a Cl• radical appears again — exactly the one that started everything. ' +
        'This step releases 189 kJ per mole, so the mixture heats itself. The restored radical immediately attacks a fresh hydrogen molecule and the loop repeats. ' +
        'Add the two propagation steps: (+4) + (−189) = −185 kJ — it matches the tabulated −184.6 within the rounding of the reference bond energies. The quantum was spent ONCE, while the gain comes on every loop.',
      equation: 'H• + Cl₂ → HCl + Cl•,  ΔH = −189 kJ/mol',
      note: 'Four ready-made HCl molecules stand for the deeper links of the chain; in reality one absorbed quantum yields of the order of 10⁶ molecules — an order-of-magnitude estimate.',
      speak: 'The hydrogen radical breaks a chlorine molecule. The chlorine radical comes back and the chain goes round again.',
    },
    termination: {
      title: 'Termination',
      body:
        'The chain lives as long as radicals are around. It ends when two radicals meet and join: Cl• + Cl• → Cl₂, releasing 243 kJ per mole — exactly what the quantum spent on the break. ' +
        'The wall of the vessel plays the same role: a radical hands it the excess energy and dies. That is why the reaction is slower in a narrow tube than in a wide one. ' +
        'Initiation and termination cancel each other out, so they do not enter the heat of the reaction.',
      equation: 'Cl• + Cl• → Cl₂,  ΔH = −243 kJ/mol',
      note: 'Two atoms can only recombine with a third body (the wall or another molecule) to carry the excess energy away; it is not drawn here.',
      speak: 'Two radicals meet and become a chlorine molecule again. The chain is broken.',
    },
    energy: {
      title: 'The energy balance',
      body:
        'Count the heat from bond energies: break H–H (+435.8) and Cl–Cl (+243), build two H–Cl bonds (−2 · 431 = −862). The total is −183.2 kJ. ' +
        'Independently, from heats of formation: 2 · ΔH°f(HCl) = 2 · (−92.3) = −184.6 kJ. Two different routes give almost the same number — that is Hess’s law. ' +
        'This is why the mixture explodes in bright sunlight yet barely reacts in the dark: what matters is not the heat of the reaction but who breaks the first Cl–Cl bond.',
      equation: 'H₂ (g) + Cl₂ (g) → 2 HCl (g),  ΔH = −184.6 kJ',
      note: 'The 1.6 kJ gap between the two routes is the usual price of AVERAGE bond energies: they are tabulated as averages, while heats of formation are measured directly.',
      speak: 'The result: minus one hundred and eighty-five kilojoules. In sunlight the mixture explodes; in the dark it barely reacts.',
    },
  },
  legend: {
    electron: 'A blue dot is the unpaired electron of a radical, or the shared pair of a new bond.',
    orbitalPhase: 'The glowing ring around an atom is a symbol for the outer electron shell, not the shape of an orbital.',
  },
  safety:
    'A hydrogen–chlorine mixture explodes on bright light or a flash. Chlorine is poisonous and hydrogen chloride burns the airways. Only a teacher may run this experiment, in a fume hood behind a safety screen — never repeat it yourself.',
  energy: {
    title: 'Bond energies',
    unit: 'kJ',
    caption: 'Bonds broken (up) and bonds made (down) for H₂ + Cl₂ → 2 HCl; the sum is the heat of the reaction.',
    stages: {
      bondClCl: 'Cl₂ → 2 Cl•',
      bondHH: 'H₂ → 2 H•',
      bondHCl: '2 H• + 2 Cl• → 2 HCl',
      total: 'Total: ΔH of reaction',
    },
    summary: 'Bond energies for H₂ + Cl₂ → 2 HCl: the steps sum to {dH} kJ',
    sources: 'Reference values: bond energies and lengths — CRC Handbook; heats of formation — NIST-JANAF.',
  },
}
