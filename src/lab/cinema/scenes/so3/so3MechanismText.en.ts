import type { So3MechanismText } from './so3MechanismText'

export const SO3_TEXT_EN: So3MechanismText = {
  intro: {
    title: 'Contact process: SO₃',
    speak: 'Let us watch sulfur dioxide turn into sulfur trioxide on a catalyst, and see why this reaction is reversible.',
  },
  steps: {
    reactants: {
      title: 'Starting substances',
      body:
        'On the left and on the right are molecules of sulfur(IV) oxide SO₂: bent, the O–S–O angle is 119.5°, both S–O bonds are the same, 143.1 pm, and the molecule is polar (μ = 1.63 D). ' +
        'In the middle is an oxygen molecule O₂ with a bond length of 120.75 pm. ' +
        'Sulfur in SO₂ has the oxidation state +4 and can still be oxidised to +6. Burning sulfur gives no appreciable SO₃: sulfur burns mostly to SO₂ — in the hot flame the equilibrium lies to the left, and without a catalyst the oxidation is slow; so SO₃ is made from ready SO₂ in the second stage of the contact process for sulfuric acid.',
      equation: '2 SO₂ (g) + O₂ (g)',
      note:
        'The O₂ molecule is a triplet: its two electrons in the antibonding π* orbitals are unpaired, which is why oxygen is paramagnetic. The double band is the school bond order of two, not a picture of those electrons. ' +
        'The S–O bonds in SO₂ are drawn as a band with a dashed line: the π electrons are delocalised over both bonds, and in the simplified count each bond order is one and a half, not two as in the school formula O=S=O; bond order is not a measured quantity, it depends on the model. ' +
        'The angle 119.5° and the length 143.1 pm are reference values without a stated geometry type. The equilibrium rₑ geometry gives a slightly smaller angle.',
      speak: 'Two bent sulfur dioxide molecules at the sides, an oxygen molecule in the middle. Their sulfur can be oxidised further.',
    },
    equilibrium: {
      title: 'Reversibility and Le Chatelier’s principle',
      body:
        'The reaction 2 SO₂ + O₂ ⇌ 2 SO₃ is reversible and exothermic: ΔH = 2·(−395.7) − 2·(−296.8) = −197.8 kJ per equation, that is −98.9 kJ per mole of SO₃. ' +
        'By Le Chatelier’s principle heating shifts the equilibrium to the left, back to the reactants, while raising the pressure shifts it to the right: three gas molecules become two. ' +
        'Without a catalyst SO₂ is oxidised negligibly slowly even with strong heating: the barrier is high, and heating also shifts the equilibrium to the left. The vanadium catalyst becomes active only at about 400 °C, and the yield of SO₃ falls as the temperature rises, so the process is run at 400–450 °C — a compromise between rate and yield.',
      equation: '2 SO₂ (g) + O₂ (g) ⇌ 2 SO₃ (g)  (V₂O₅, 400–450 °C),  ΔH = −197.8 kJ',
      note:
        'One collision of one pair of molecules is shown, in slow motion. In a gas at 25 °C every molecule hits its neighbours billions of times a second, but only a tiny share of collisions ends in reaction: there is not enough energy to rearrange the bonds.',
      speak: 'The reaction is reversible and gives out heat. Without a catalyst it hardly goes even when heated, and strong heating lowers the yield.',
    },
    catalyst: {
      title: 'The V₂O₅ catalyst: oxygen from vanadium',
      body:
        'The catalyst is vanadium(V) oxide. In the school scheme an SO₂ molecule takes an oxygen atom from the catalyst: V₂O₅ + SO₂ → V₂O₄ + SO₃. ' +
        'Sulfur is oxidised from +4 to +6 and gives away two electrons, vanadium is reduced from +5 to +4 — one electron for each of the two atoms. ' +
        'On its own this stage is endothermic: +24.9 kJ per mole of SO₂. Once it leaves the surface for the gas, the SO₃ molecule becomes flat: all three S–O bonds are the same.',
      equation: 'V₂O₅ (s) + SO₂ (g) → V₂O₄ (s) + SO₃ (g)  (×2)',
      note:
        'This is a SCHEME. The real contact-process catalyst is molten V₂O₅ in potassium pyrosulfate K₂S₂O₇ on porous silica; the V(V)/V(IV) redox cycle runs through sulfato-vanadate complexes in the melt, not through solid V₂O₄. ' +
        'The catalyst surface is drawn as a grid of dots and vanadium atoms are not shown: their positions in the frame would be invented. The numbers next to sulfur are formal oxidation states: the S–O bonds are covalent, there are no sulfur ions. ' +
        'While the molecule is bound to the catalyst through an oxygen atom it is not flat (a sulfate-like species on vanadium); SO₃ becomes flat only in the gas, but in the frame it straightens already at the surface — a convention. ' +
        'The catalyst oxygen atom is drawn with the same Cordero covalent radius as in SO₃: the V–O bonds in V₂O₅ are largely covalent, so no O²⁻ ion is drawn here; the oxygen atoms appear together with the surface grid as one sketch.',
      speak: 'A sulfur dioxide molecule takes an oxygen atom from the catalyst and becomes sulfur trioxide.',
    },
    reoxidation: {
      title: 'Oxygen returns to the catalyst',
      body:
        'An O₂ molecule lands on the reduced catalyst, the O=O bond breaks and each oxygen atom takes a vacant place: V₂O₄ + ½ O₂ → V₂O₅. ' +
        'Oxygen takes four electrons — exactly the ones sulfur gave to vanadium. This stage is strongly exothermic: −123.8 kJ per mole of V₂O₅. ' +
        'The catalyst is back where it started: the oxygen passed through vanadium, and vanadium itself did not enter the product.',
      equation: 'V₂O₄ (s) + ½ O₂ (g) → V₂O₅ (s)  (×2)',
      note:
        'The stages add up per equation to 2 × (+24.9) + 2 × (−123.8) = −197.8 kJ — the same as the direct reaction: a catalyst changes neither ΔH nor the position of equilibrium, it opens a path with a lower activation energy. ' +
        'The oxygen atoms in the products used to belong to the catalyst, while the oxygen from O₂ stayed in the catalyst: that is how the scheme shows oxygen “travelling” through vanadium. The splitting of O₂ on the surface and the slowed-down time are conventions.',
      speak: 'Oxygen from the air gives the catalyst back the atoms it lost. The catalyst is ready for the next round.',
    },
    product: {
      title: 'SO₃: a flat triangle',
      body:
        'The SO₃ molecule is a regular flat triangle with D₃h symmetry: all three S–O bonds are the same, 141.98 pm, and all O–S–O angles are 120°. ' +
        'Three equal bond-polarity vectors cancel, so the molecule is non-polar: μ = 0, whereas bent SO₂ has a dipole moment of 1.63 D. ' +
        'The S–O bond in SO₃ is slightly shorter than in SO₂ (143.1 pm): the S–O bonds are strongly polar, and sulfur in SO₃ carries a larger positive charge and pulls the oxygen closer.',
      equation: 'SO₃ (g): S–O = 141.98 pm, ∠O–S–O = 120°, μ = 0',
      note:
        'The school formula gives sulfur +6 three double bonds S=O. In fact the three bonds are equivalent: the π electron density is delocalised over the whole molecule, so each bond is drawn as a band with a short dashed line — its order is more than single but less than double. ' +
        'The drawn multiplicity is a simplified count (one π pair over three bonds, over two in SO₂), so SO₃ is drawn with a lower one than SO₂ although its bond is shorter: the length is set not only by this count but also by the bond polarity, and bond order itself depends on the chosen model. ' +
        'The length is the equilibrium rₑ of the gas molecule. The molecule turns so that you can see all four atoms lie in one plane.',
      speak: 'Sulfur trioxide is a flat triangle. The three bonds are the same, and the molecule is non-polar.',
    },
    condensed: {
      title: 'SO₃ in the plant and in condensed form',
      body:
        'SO₃ reacts violently with water: SO₃ + H₂O → H₂SO₄, ΔH = −132.5 kJ/mol. ' +
        'The plant absorbs SO₃ not in water but in 98 % sulfuric acid, giving oleum, a solution of SO₃ in H₂SO₄: over water SO₃ meets its vapour and forms a persistent mist of fine acid droplets that is hardly captured, while over 98 % H₂SO₄ the vapour pressure of both water and SO₃ is lowest. ' +
        'SO₃ has three solid forms: γ — ice-like crystals of cyclic trimers S₃O₉ (m.p. 16.8 °C, b.p. 44.8 °C), β — helical chains (m.p. 32.5 °C) and α — chains cross-linked into layers (m.p. 62.3 °C). ' +
        'So at 25 °C SO₃ is a liquid (molten γ form, where trimers are in equilibrium with SO₃ molecules) or the solid polymers β and α.',
      equation: 'SO₃ (g) + H₂O (l) → H₂SO₄ (l),  ΔH = −132.5 kJ/mol',
      note:
        'In the S₃O₉ trimer every sulfur is an SO₄ tetrahedron: two terminal S=O bonds (140 pm) and two bridging S–O bonds in the ring (162 pm). The lengths come from the γ-SO₃ crystal (the trimer survives in the liquid), while the angles at all ring atoms are built from the ideal tetrahedron (109.5°) — this is a scheme: the bridging oxygen is not tetrahedral at all, in the real ring the S–O–S angle is noticeably larger and the ring O–S–O angle smaller than tetrahedral. ' +
        'The trimer is shown whole next to the SO₃ molecule only for comparison — it is not assembled in the frame from that molecule; neighbouring molecules are not drawn.',
      speak: 'With water sulfur trioxide gives a mist of sulfuric acid, so it is absorbed in concentrated sulfuric acid. Sulfur trioxide molecules can join in threes into a ring.',
    },
  },
  legend: {
    electron: 'The numbers next to sulfur are formal oxidation states: +4 before the oxygen transfer, +6 after it.',
    orbitalPhase: 'A band with a dashed line is a delocalised bond: its order is more than single but less than double. The grid of dots is a sketch of the V₂O₅ catalyst surface.',
  },
  safety: 'SO₂ and SO₃ are toxic and corrode the airways; SO₃ forms a mist of sulfuric acid with moist air and reacts with water with boiling and spattering. The experiment is virtual only, or done by the teacher in a fume hood.',
  energy: {
    title: 'Energy by catalytic stage',
    unit: 'kJ',
    caption: 'The two stages of the school scheme per equation 2 SO₂ + O₂ → 2 SO₃: a rise in the first, a big drop in the second; the sum is the ΔH of the reaction.',
    stages: {
      reduction: 'V₂O₅ + SO₂ → V₂O₄ + SO₃',
      reoxidation: 'V₂O₄ + ½ O₂ → V₂O₅',
      total: 'Total: ΔH',
    },
    summary: 'Energy of SO₂ oxidation by catalytic stage: sum {dH} kJ',
    sources: 'Reference ΔH°f values: CRC Handbook, NIST-JANAF (298 K).',
  },
}
