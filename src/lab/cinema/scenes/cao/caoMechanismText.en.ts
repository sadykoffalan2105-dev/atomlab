import type { CaoMechanismText } from './caoMechanismText'

/** Lime burning CaCO₃ → CaO + CO₂ — lesson text, English. */
export const CAO_TEXT_EN: CaoMechanismText = {
  intro: {
    title: 'Burning limestone',
    speak: 'Let us see how a kiln turns limestone into quicklime and carbon dioxide.',
  },
  steps: {
    calcite: {
      title: 'Calcite: layers and triangles',
      body:
        'Limestone is calcite CaCO₃ — space group R3̄c, Z = 6, density 2.711 g/cm³. ' +
        'Layers of Ca²⁺ ions alternate with layers of flat CO₃²⁻ triangles: neighbouring calcium layers are c/6 = 284.4 pm apart, and inside a layer the nearest Ca²⁺ ions are 499 pm apart. ' +
        'All three C–O bonds of the carbonate ion are identical, 128.4 pm, with O–C–O angles of exactly 120°: the −2 charge is spread over three oxygens, so the bond order is 1⅓, not "one double and two single". ' +
        'Every Ca²⁺ is surrounded by six oxygen atoms at 235.9 pm.',
      equation: 'CaCO₃ (s): Ca²⁺ + CO₃²⁻',
      note: 'The mutual stacking of the layers is schematic — the real rhombohedral cell is more complex; the interlayer distances and the geometry of the CO₃²⁻ group itself are real.',
      speak: 'Limestone is built in layers: calcium, then flat carbonate triangles, then calcium again.',
    },
    heating: {
      title: 'The kiln: temperature is vibration',
      body:
        'Ions in a crystal always vibrate, even at room temperature; heating only increases the amplitude of that vibration. ' +
        'A lime kiln takes limestone to 900…1000 °C, and the C–O bonds inside the carbonate ion stretch more and more. ' +
        'The energy ladder goes UP on this step: decomposing limestone is endothermic, it will not happen on its own.',
      equation: 'CaCO₃ (s) + Q → …,  kiln 900…1000 °C',
      note: 'The vibration amplitude is exaggerated several times over: a real ion moves about 10–15 pm, which would be invisible on screen.',
      speak: 'The hotter it gets, the harder the ions shake. A kiln runs at nine hundred degrees.',
    },
    release: {
      title: 'Carbon dioxide leaves',
      body:
        'One C–O bond breaks and the shared electron pair stays entirely with the oxygen: CO₃²⁻ splits into O²⁻ and CO₂. ' +
        'That oxygen turns from a bonded atom into a free oxide ion and swells from 66 to 140 pm — more than twice as large. ' +
        'The two remaining bonds do the opposite: they shorten from 128.4 to 116 pm and the angle opens from 120° to 180°, giving the linear CO₂ molecule that escapes from the crystal as a gas. ' +
        'No oxidation state changes: Ca stays +2, carbon +4, oxygen −2 — this is NOT a redox reaction.',
      equation: 'CO₃²⁻ → O²⁻ + CO₂ ↑',
      note: 'The glowing pair of dots moving onto the oxygen stands for the bonding electron pair; its "flight" is drawn so the heterolytic split can be seen.',
      speak: 'The bond breaks, the electron pair stays on the oxygen, and carbon dioxide flies away.',
    },
    rocksalt: {
      title: 'A new lattice: quicklime',
      body:
        'The remaining Ca²⁺ and O²⁻ rearrange into the rock-salt lattice — space group Fm-3m, cell edge 481.1 pm, nearest Ca–O distance 240.5 pm, Z = 4. ' +
        'Every Ca²⁺ has six O²⁻ neighbours and every O²⁻ has six Ca²⁺: coordination number 6 to 6, and like charges are never neighbours. ' +
        'The charges here are ±2 rather than ±1 as in table salt: at the same distance the attraction would be four times stronger, and the ions also sit closer (240.5 against 282.0 pm). The lattice energy of CaO is −3400 kJ/mol against −787 for NaCl. ' +
        'Hence the refractoriness: lime melts only at 2572 °C, while table salt melts at 801 °C. With the carbonate groups gone the crystal is denser: 3.34 against 2.711 g/cm³.',
      equation: 'Ca²⁺ + O²⁻ → CaO (s),  d = 240.5 pm, CN 6 : 6',
      note: 'The frame shows a 4 × 2 × 2 fragment — two unit cells, 16 ions. A grain of lime the size of a sand grain holds about 10¹⁹ of them.',
      speak: 'Calcium and oxygen stack into the cubic lattice of lime. Every ion has six neighbours.',
    },
    classroom: {
      title: 'What happens to it next',
      body:
        'Quicklime is slaked with water, and that step is exothermic: a bucket of lime starts to boil. The mechanism is simple — the oxide ion takes a proton from water: O²⁻ + H₂O → 2 OH⁻, giving calcium hydroxide Ca(OH)₂ and releasing 64.5 kJ/mol. ' +
        'A solution of Ca(OH)₂ is limewater, the school test for carbon dioxide: bubble CO₂ through it and it turns milky, because the very calcium carbonate we started from precipitates (another 114.7 kJ/mol). ' +
        'The circle closes: CaCO₃ → CaO → Ca(OH)₂ → CaCO₃.',
      equation: 'CaO + H₂O → Ca(OH)₂ + 64.5 kJ;  Ca(OH)₂ + CO₂ → CaCO₃ ↓ + H₂O',
      note: 'Both reactions are played out on a single CaO formula unit brought to the front so that the crystal stays whole in the frame; a beaker holds myriads of particles.',
      speak: 'Lime is slaked with water, and limewater turns milky with carbon dioxide.',
    },
    energy: {
      title: 'Why it needs such strong heating',
      body:
        'Hess’s law from the enthalpies of formation: −634.9 (CaO) − 393.5 (CO₂) + 1207.6 (CaCO₃) = +179.2 kJ per mole. ' +
        'The plus sign means energy has to be PUT IN — that is what sets lime burning apart from burning sodium or magnesium. ' +
        'But a gas is released and the disorder jumps: ΔS° = +160.2 J/(mol·K). In ΔG = ΔH − TΔS the TΔS term wins as temperature rises, and at T = 179 200 / 160.2 ≈ 1119 K (846 °C) ΔG becomes zero. Above that the reaction runs — which is why kilns are held at 900…1000 °C. ' +
        'Quicklime means cement, mortar, and the removal of sulfur and phosphorus from steel; burning limestone is one of the largest-scale reactions on Earth.',
      equation: 'CaCO₃ (s) → CaO (s) + CO₂ (g),  ΔH = +179.2 kJ/mol',
      note:
        '1119 K is an ESTIMATE from ΔH° and ΔS° measured at 298 K, that is, on the assumption that neither depends on temperature. ' +
        'The actual experiment reaches p(CO₂) = 1 atm at 898 °C (1171 K) — the 52 K gap is the price of that assumption. Below 898 °C the decomposition only runs if the CO₂ is carried away continuously, as it is in a kiln.',
      speak: 'Plus one hundred and seventy-nine kilojoules. It only runs in a kiln — but it gives us cement and lime.',
    },
  },
  legend: {
    electron: 'The blue pair of dots is the C–O bonding electron pair: when the bond breaks it stays entirely with the oxygen.',
    vibration: 'The trembling of the lattice sites is thermal motion; the hotter it is, the wider the swing.',
    water: 'White spheres are hydrogen atoms; the water molecule is drawn with its real H–O–H angle of 104.5°.',
  },
  safety:
    'Quicklime CaO burns skin and is especially dangerous for the eyes, and slaking makes the water boil and spatter. Work only in goggles and gloves, and always add lime to water, never the other way round.',
  energy: {
    title: 'Hess cycle',
    unit: 'kJ/mol',
    caption: 'Steps through the elements: limestone falling apart (up) and CaO and CO₂ forming (down). The total is positive — the reaction is endothermic.',
    stages: {
      decompose: 'CaCO₃ → Ca + C + 3/2 O₂',
      co2: 'C + O₂ → CO₂',
      cao: 'Ca + ½ O₂ → CaO',
      total: 'Total: ΔH of the reaction',
    },
    summary: 'Hess cycle for lime burning: the steps sum to {dH} kJ/mol',
    sources: 'Reference values: CRC Handbook (ΔH°f and S°), ICSD (lattice parameters), Shannon (ionic radii).',
  },
}
