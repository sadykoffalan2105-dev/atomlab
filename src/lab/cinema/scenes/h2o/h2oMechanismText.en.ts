import type { SchoolLessonText } from '../school/schoolSpec'

/** English lesson text: 2H₂ + O₂ → 2H₂O (school version, grade 7). Numbers match the Russian text. */
export const H2O_TEXT_EN: SchoolLessonText = {
  intro: {
    title: 'How hydrogen and oxygen make water',
    speak: 'Let us see how hydrogen and oxygen atoms join through shared electron pairs to form a water molecule.',
  },
  steps: {
    reactants: {
      title: 'Hydrogen and oxygen',
      body:
        'Hydrogen H₂ and oxygen O₂ are colourless, odourless gases made of two-atom molecules. ' +
        'A mixture of two volumes of hydrogen with one volume of oxygen is called oxyhydrogen: a spark makes it explode. ' +
        'In H₂ the atoms are held by one shared electron pair (H–H), in O₂ by two (O=O).',
      equation: '2H₂ + O₂  (oxyhydrogen, 2 : 1)',
      note: 'O=O is the school notation. In fact the O₂ molecule has two unpaired electrons, which is why liquid oxygen is attracted by a magnet; in grade 7 we use O=O.',
      speak: 'Hydrogen and oxygen are gases of two-atom molecules. Two volumes of hydrogen to one of oxygen make oxyhydrogen.',
    },
    atoms: {
      title: 'Structure of the atoms',
      body:
        'A hydrogen atom has one electron: H +1 )1. An oxygen atom has eight electrons in two shells: O +8 )2 )6, six electrons in the outer shell, two of them unpaired. ' +
        'That is why O₂ has two shared pairs between the atoms, and each O atom keeps two lone pairs. ' +
        'The cloud around an atom is its outer electron shell; the dots are the electrons of that shell.',
      equation: 'H +1 )1     O +8 )2 )6',
      note: 'Clouds and dots are the school model: electrons do not sit still; the dots show how many there are and how they are grouped into pairs.',
      speak: 'Hydrogen has one electron; oxygen has six in its outer shell, and two of them are unpaired.',
    },
    breaking: {
      title: 'Bonds break',
      body:
        'The mixture is ignited by a spark. The bonds in H₂ and O₂ break: each shared pair splits and one electron returns to each atom. ' +
        'We get atoms: hydrogen with one unpaired electron, oxygen with two unpaired electrons and two lone pairs.',
      equation: '2H₂ + O₂ → 4H· + 2·O·',
      note: 'In reality the reaction is a chain through H, O and OH particles, and not all bonds break at once. The picture "bonds break — atoms join" shows where the new shared pairs come from; the number of electrons does not change.',
      speak: 'Bonds break: each pair splits, one electron back to each atom.',
    },
    pairs: {
      title: 'Shared pairs form',
      body:
        'An oxygen atom joins two hydrogen atoms. The outer-shell clouds overlap and the unpaired electrons meet in pairs: one electron from the H atom and one from the O atom form a shared pair between the nuclei. ' +
        'Each O atom gets two shared pairs. Now hydrogen has 2 electrons in its outer shell and oxygen has 8: the shells are complete.',
      equation: 'H· + ·O· + ·H → H : O : H',
      note: 'Oxygen attracts electrons more strongly than hydrogen, so the shared pairs are shifted towards the O atom — the O–H bond is polar covalent.',
      speak: 'One electron from hydrogen, one from oxygen — and a shared pair appears between the nuclei.',
    },
    molecule: {
      title: 'The water molecule',
      body:
        'Each shared pair is an O–H bond; in a structural formula it is drawn as a dash: H–O–H. Oxygen in water has valency II (two dashes), hydrogen has valency I. ' +
        'The molecule is bent: the H–O–H angle is 104.5°, the O–H bond length is 95.8 pm. The oxygen atom keeps two lone pairs.',
      equation: 'H–O–H,  ∠HOH = 104.5°',
      note: 'The bent shape comes from the lone pairs of oxygen: they push the O–H bonds together. Polar bonds plus the bent shape make the water molecule polar.',
      speak: 'Two O–H bonds at one hundred and four and a half degrees, and two lone pairs on oxygen.',
    },
    result: {
      title: 'Result: water',
      body:
        'Two hydrogen molecules and one oxygen molecule have formed two water molecules. Each element has as many atoms after the reaction as before: 4 H atoms and 2 O atoms. ' +
        'The reaction is explosive and releases heat; water vapour condenses as droplets on the cold wall of the vessel.',
      equation: '2H₂ + O₂ → 2H₂O',
      note: 'Six atoms on screen are a model; in the experiment huge numbers of molecules react in the same 2 : 1 ratio.',
      speak: 'Two molecules of hydrogen and one of oxygen give two molecules of water. Atoms do not vanish — they rearrange.',
    },
  },
  legend: {
    electron: 'outer-shell electron',
    sharedPair: 'shared electron pair — a bond (dash)',
    lonePair: 'lone electron pair',
    unpaired: 'unpaired electron',
  },
  safety: 'Oxyhydrogen is explosive: only the teacher shows this experiment, behind a safety screen. Hydrogen is tested for purity before ignition.',
}
