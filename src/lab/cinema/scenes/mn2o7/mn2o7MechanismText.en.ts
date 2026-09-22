import type { Mn2o7MechanismText } from './mn2o7MechanismText'

export const MN2O7_TEXT_EN: Mn2o7MechanismText = {
  intro: {
    title: 'Highest manganese oxide',
    speak: 'Let us see how potassium permanganate and sulfuric acid give manganese seven oxide — and why it is so dangerous to handle.',
  },
  steps: {
    reactants: {
      title: 'Starting substances',
      body:
        'On the left are two formula units of potassium permanganate KMnO₄: K⁺ ions and MnO₄⁻ tetrahedra. In the permanganate ion manganese is in its highest oxidation state +7: all seven valence electrons are shifted towards oxygen (3d⁰), the four Mn–O bonds are equivalent, 162.9 pm long, with an O–Mn–O angle of 109.5°. ' +
        'On the right is a molecule of anhydrous sulfuric acid H₂SO₄: two S=O bonds of 142.2 pm and two S–OH bonds of 157.4 pm. ' +
        'At 25 °C KMnO₄ is a dark violet crystalline solid and H₂SO₄ an oily liquid.',
      equation: '2 KMnO₄ (s) + H₂SO₄ (conc.)',
      note:
        'The KMnO₄ crystal is not drawn: the frame shows two formula units — each K⁺ next to its MnO₄⁻ (the distance is a sketch from the sum of the Shannon radii of K⁺ and O²⁻). The K⁺ radius is 138 pm after Shannon (CN 6; in the crystal potassium has more neighbours), while the Mn, O, S and H atoms are drawn with Cordero covalent radii — the ion ball and the balls of covalent particles are not directly comparable. ' +
        'The Mn–O bonds of MnO₄⁻ have an average order of 1.75: one σ bond plus a share of π, so their π lobes are paler than on a double bond. The dotted arcs between K⁺ and MnO₄⁻ sketch the electrostatic attraction. The O=S=O and HO–S–OH planes of the acid are drawn perpendicular — a simplification.',
      speak: 'On the left potassium permanganate: potassium ions and permanganate tetrahedra, manganese in oxidation state plus seven. On the right sulfuric acid.',
    },
    protonation: {
      title: 'Protonating the permanganate ion',
      body:
        'Concentrated sulfuric acid is a source of protons. Its OH group approaches an oxygen atom of MnO₄⁻ to hydrogen-bond distance, and the proton moves along that bond: MnO₄⁻ becomes permanganic acid HMnO₄ and H₂SO₄ becomes the HSO₄⁻ ion. ' +
        'The second proton goes to the second MnO₄⁻, leaving the sulfate ion SO₄²⁻ — a regular tetrahedron with equal S–O bonds of 147 pm. ' +
        'The two K⁺ ions move over to the sulfate — that is where the textbook equation gets its K₂SO₄.',
      equation: '2 MnO₄⁻ + H₂SO₄ → 2 HMnO₄ + SO₄²⁻;  2 K⁺ + SO₄²⁻ → K₂SO₄',
      note:
        'There is no free H⁺ either in the frame or in the solution: the proton is always bound to one of two oxygen atoms and hops along the hydrogen bond (dashed line); the H⁺ label only marks the moment of transfer. The charges of the particles change in that same frame, and the total charge stays zero. ' +
        'The Mn–O–H angle of HMnO₄ is not in the data core — the oxoacid angle ∠S–O–H 108.5° is used instead, and the Mn–OH bond is drawn with the permanganate length: this is a sketch. The intermediate HSO₄⁻ is shown without rearranging. The average S–O bond order in sulfate is 1.5. ' +
        'In reality, in concentrated sulfuric acid the second proton stays with the acid and potassium hydrogen sulfate KHSO₄ forms, not K₂SO₄; the textbook writes the equation with K₂SO₄.',
      speak: 'Sulfuric acid gives away protons, and the permanganate ion turns into permanganic acid.',
    },
    condensation: {
      title: 'Splitting off water',
      body:
        'Two HMnO₄ molecules approach each other with their OH groups. The proton of one OH group moves to the oxygen of the other, and that group leaves as a water molecule. ' +
        'The oxygen that gave up its proton stays on its own manganese and bonds to the second manganese atom — the two tetrahedra are joined by a shared corner. ' +
        'This is why Mn₂O₇ is called the anhydride of permanganic acid: it is HMnO₄ without water.',
      equation: '2 HMnO₄ → Mn₂O₇ + H₂O',
      note:
        'The condensation is shown as a single act. In sulfuric acid it runs through protonation of an OH group and loss of water, and the concentrated acid binds that water. As it leaves, the water takes its own geometry: O–H 95.8 pm, H–O–H angle 104.5°. ' +
        'The oxidation state of manganese does not change — +7 both in HMnO₄ and in Mn₂O₇: forming Mn₂O₇ is not a redox reaction.',
      speak: 'Two permanganic acid molecules split off water and join through a shared oxygen atom.',
    },
    molecule: {
      title: 'The Mn₂O₇ molecule',
      body:
        'O₃Mn–O–MnO₃ — two MnO₄ tetrahedra sharing a corner. The six terminal Mn=O bonds are short — 158.5 pm, the two bridging Mn–O bonds longer — 177 pm, and the Mn–O–Mn angle is 120.7°. ' +
        'The terminal bond is shorter than in MnO₄⁻ (162.9 pm): it carries more π bonding, while the bridging oxygen shares its electrons between two manganese atoms. ' +
        'Here manganese shows its highest valence VII — a topic of two textbook years: grade 7 — valence, grade 9 — manganese and its compounds.',
      equation: 'Mn₂O₇:  Mn +7,  O −2',
      note:
        'The lengths and the angle come from an X-ray study of the crystal at low temperature (Simon et al.). The O–Mn–O angle of Mn₂O₇ is not in the data core — the terminal atoms sit at the tetrahedral angle 109.5°; the twist of the two O triplets relative to each other is a sketch. ' +
        'The π lobes are a conventional picture of Mn=O π bonding: manganese uses its d orbitals in it.',
      speak: 'Here is the molecule of manganese seven oxide: two tetrahedra sharing one oxygen atom.',
    },
    liquid: {
      title: 'A dichroic liquid',
      body:
        'At 25 °C Mn₂O₇ is a heavy oily liquid. Its colour depends on the light: in transmitted light it is dark red-brown, in reflected light green with a metallic lustre — this is dichroism. ' +
        'The colour comes from charge transfer: light moves an electron from oxygen into the empty 3d orbitals of manganese(VII). ' +
        'The enthalpy of formation of liquid Mn₂O₇ is about −743 kJ/mol, but this is an estimate.',
      equation: '2 Mn (s) + 7/2 O₂ (g) → Mn₂O₇ (l),  ΔH°f ≈ −743 kJ/mol',
      note:
        'The drop is the macroscopic substance, drawn next to the molecule and not to scale; its colours show the dichroism in a conventional way, and the liquid has no glow of its own. ' +
        'ΔH°f(Mn₂O₇) is absent from the CRC and NIST-JANAF tables: the value comes from a secondary source (Lidin) and is flagged in the data core as an estimate, so the ladder does not claim agreement with primary tables.',
      speak: 'Manganese seven oxide is an oily liquid: red-brown in transmitted light, green in reflected light.',
    },
    energy: {
      title: 'Energy and danger',
      body:
        'By Hess’s law: (+1674.4) + (+814.0) + (−1437.8) + (−285.8) + (−743) = +21.8 kJ for the textbook equation. The first two steps break 2 KMnO₄ (2 × 837.2) and H₂SO₄ into elements, the next three form K₂SO₄, water and Mn₂O₇. ' +
        'The total is close to zero and is an estimate: the Mn₂O₇ term comes from a secondary source. ' +
        'The decomposition of Mn₂O₇ itself, however, is strongly exothermic: 2 Mn₂O₇ → 4 MnO₂ + 3 O₂, ΔH ≈ −594 kJ. The liquid decomposes slowly already at 25 °C, and explosively on heating.',
      equation: '2 Mn₂O₇ (l) → 4 MnO₂ (s) + 3 O₂ (g),  ΔH ≈ −594 kJ',
      note:
        'Written the way it runs in concentrated acid — 2 KMnO₄ + 2 H₂SO₄ → Mn₂O₇ + 2 KHSO₄ + H₂O — the reaction gives ΔH ≈ −47.6 kJ; all these values are estimates because of ΔH°f(Mn₂O₇). ' +
        'On decomposition manganese is reduced from +7 to +4 and oxygen oxidised from −2 to 0 — this is a redox reaction, and the released O₂ supports combustion. The explosion and flash are not drawn in 3D.',
      speak: 'Manganese seven oxide decomposes giving off oxygen, explosively on heating. This experiment is done only virtually.',
    },
  },
  legend: {
    electron: 'The white ball labelled H⁺ at the moment of transfer is a proton: it hops along the hydrogen bond (dashed line) and is never free.',
    orbitalPhase: 'Lobes above and below a bond show π bonding: bright on Mn=O, paler on MnO₄⁻ (bond order 1.75) and on sulfate (1.5).',
  },
  safety:
    'Mn₂O₇ is explosive: it decomposes explosively on heating and on impact, and ignites alcohol and other organic substances on contact. The mixture of potassium permanganate with concentrated sulfuric acid is NOT prepared at school — the experiment is shown only virtually or on video.',
  energy: {
    title: 'Hess’s law',
    unit: 'kJ',
    caption: 'The reactants break into elements (up), the products are built from them (down); the sum is the heat of the textbook equation. Estimate: ΔH°f(Mn₂O₇) comes from a secondary source.',
    stages: {
      kmno4: '2 KMnO₄ → 2 K + 2 Mn + 4 O₂',
      h2so4: 'H₂SO₄ → H₂ + S + 2 O₂',
      k2so4: '2 K + S + 2 O₂ → K₂SO₄',
      h2o: 'H₂ + ½ O₂ → H₂O (l)',
      mn2o7: '2 Mn + 7/2 O₂ → Mn₂O₇ (l), estimate',
      total: 'Total: reaction ΔH (estimate)',
    },
    summary: 'Hess ladder for making Mn₂O₇: sum {dH} kJ',
    sources: 'ΔH°f: CRC Handbook (KMnO₄, H₂SO₄, K₂SO₄, H₂O); Mn₂O₇ — Lidin R. A. et al., “Constants of Inorganic Substances” (estimate).',
  },
}
