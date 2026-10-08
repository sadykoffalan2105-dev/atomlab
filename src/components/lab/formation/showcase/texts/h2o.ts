/**
 * Тексты showcase H₂O (RU / EN / UZ): подписи этапов панели и HUD-карточки фактов.
 * Факты — Kimyo 8–9 и стандартный справочник: ковалентная полярная связь, ΔЭО(O−H) = 3,44 − 2,20 = 1,24,
 * O–H 0,96 Å, ∠HOH 104,5°, ΔH°(H₂O ж) = −286 кДж/моль, водородная связь, t кип 100 °C, лёд легче воды (0,92 г/см³),
 * наибольшая плотность воды при 4 °C.
 */
import type { ShowcaseTexts } from './index'

export const H2O_TEXTS: ShowcaseTexts = {
  stages: {
    reagents: {
      main: ['2H₂ + O₂ — гремучий газ', '2H₂ + O₂ — oxyhydrogen', '2H₂ + O₂ — qaldiroq gaz'],
      sub: [
        'Две молекулы водорода и одна кислорода. В H₂ — σ-связь из 1s-облаков, в O₂ — двойная: σ и π из боковых p-гантелей. Смесь взрывается от искры.',
        'Two hydrogen molecules and one oxygen. H₂ has a σ bond from 1s clouds; O₂ a double bond: σ plus a π from side-on p lobes. The mixture explodes from a spark.',
        'Ikki vodorod va bitta kislorod molekulasi. H₂ da 1s bulutlardan σ-bogʻ, O₂ da qoʻsh bogʻ: σ va yon p-gantellardan π. Aralashma uchqundan portlaydi.',
      ],
    },
    break: {
      main: ['Искра — связи рвутся', 'A spark — bonds break', 'Uchqun — bogʻlar uziladi'],
      sub: [
        'Искра даёт первым молекулам энергию: H–H и O=O рвутся, атомы свободны. Дальше реакция греет сама себя — это взрыв гремучего газа.',
        'The spark gives the first molecules energy: H–H and O=O break, atoms are free. Then the reaction heats itself — the oxyhydrogen explosion.',
        'Uchqun dastlabki molekulalarga energiya beradi: H–H va O=O uziladi, atomlar erkin. Keyin reaksiya oʻzini oʻzi qizdiradi — qaldiroq gaz portlashi.',
      ],
    },
    approach: {
      main: ['O и два H находят друг друга', 'O and two H find each other', 'O va ikki H bir-birini topadi'],
      sub: [
        'К атому кислорода подходят два атома водорода: у O не хватает двух электронов до восьми, у каждого H — одного до двух.',
        'Two hydrogen atoms approach an oxygen atom: O is two electrons short of eight, each H is one short of two.',
        'Kislorod atomiga ikki vodorod atomi yaqinlashadi: O ga sakkizgacha ikki elektron, har bir H ga ikkigacha bitta elektron yetishmaydi.',
      ],
    },
    valence: {
      main: ['O: 2s²2p⁴ · H: 1s¹', 'O: 2s²2p⁴ · H: 1s¹', 'O: 2s²2p⁴ · H: 1s¹'],
      sub: [
        'У кислорода шесть валентных электронов: две пары (2s² и одна гантель 2p²) и два неспаренных в p-гантелях под 90°. У водорода — один электрон в 1s-облаке.',
        'Oxygen has six valence electrons: two pairs (2s² and one 2p² lobe) and two unpaired ones in p lobes at 90°. Hydrogen has one electron in its 1s cloud.',
        'Kislorodda oltita valent elektron: ikki juft (2s² va bitta 2p² gantel) hamda 90° ostidagi p-gantellarda ikkita juftlashmagan. Vodorodda 1s bulutida bitta elektron.',
      ],
    },
    pairs: {
      main: ['Две общие пары — к кислороду', 'Two shared pairs — pulled to oxygen', 'Ikki umumiy juft — kislorod tomon'],
      sub: [
        '1s-облако H перекрывается с p-гантелью O: электроны объединяются в общую пару. Кислород электроотрицательнее (3,44 против 2,20), пара смещена к нему — связь полярная: δ− на O, δ+ на H.',
        'The H 1s cloud overlaps an O p lobe: the electrons join into a shared pair. Oxygen is more electronegative (3.44 vs 2.20), so the pair shifts toward it — a polar bond: δ− on O, δ+ on H.',
        'H ning 1s buluti O ning p-gantel bilan qoplanadi: elektronlar umumiy juftga birlashadi. Kislorod elektrmanfiyroq (3,44 va 2,20), juft u tomon siljiydi — bogʻ qutbli: O da δ−, H da δ+.',
      ],
    },
    bonds: {
      main: ['Угол раскрывается: 90° → 104,5°', 'The angle opens: 90° → 104.5°', 'Burchak ochiladi: 90° → 104,5°'],
      sub: [
        'Связи растут вдоль p-гантелей, но две неподелённые пары кислорода отталкивают их — угол H–O–H становится 104,5°. Образование каждой связи выделяет энергию.',
        'Bonds grow along the p lobes, but the two lone pairs of oxygen push them apart — the H–O–H angle becomes 104.5°. Forming each bond releases energy.',
        'Bogʻlar p-gantellar boʻylab oʻsadi, lekin kislorodning ikki boʻlinmagan jufti ularni itaradi — H–O–H burchagi 104,5° boʻladi. Har bir bogʻ hosil boʻlganda energiya ajraladi.',
      ],
    },
    assemble: {
      main: ['Уголок-диполь · O–H 0,96 Å', 'A bent dipole · O–H 0.96 Å', 'Burchakli dipol · O–H 0,96 Å'],
      sub: [
        'Молекула угловая, поэтому заряды δ− и δ+ не гасят друг друга: вода — диполь. Рядом из второго атома O и второй H₂ собирается вторая молекула: 2H₂ + O₂ → 2H₂O.',
        'The molecule is bent, so the δ− and δ+ charges do not cancel: water is a dipole. Next to it a second molecule forms from the other O atom and the second H₂: 2H₂ + O₂ → 2H₂O.',
        'Molekula burchakli, shuning uchun δ− va δ+ zaryadlar bir-birini yoʻqotmaydi: suv — dipol. Yonida ikkinchi O atomi va ikkinchi H₂ dan ikkinchi molekula yigʻiladi: 2H₂ + O₂ → 2H₂O.',
      ],
    },
    final: {
      main: ['H₂O: водородные связи', 'H₂O: hydrogen bonds', 'H₂O: vodorod bogʻlari'],
      sub: [
        'Диполи притягиваются: H одной молекулы тянется к O соседней — это водородная связь. Из-за неё вода кипит при 100 °C, а в кристалле льда молекулы образуют шестиугольные кольца с пустотами — лёд легче воды.',
        'Dipoles attract: the H of one molecule reaches for the O of a neighbour — a hydrogen bond. Because of it water boils at 100 °C, and in ice the molecules form hexagonal rings with voids — ice is lighter than water.',
        'Dipollar tortishadi: bir molekulaning H si qoʻshni molekulaning O siga intiladi — bu vodorod bogʻi. Shu sababli suv 100 °C da qaynaydi, muz kristallida esa molekulalar boʻshliqli olti burchakli halqalar hosil qiladi — muz suvdan yengil.',
      ],
    },
  },
  hud: [
    {
      stage: 'reagents',
      from: 0.1,
      to: 1,
      title: ['Гремучий газ', 'Oxyhydrogen', 'Qaldiroq gaz'],
      lines: [
        ['2H₂ + O₂ → 2H₂O', '2H₂ + O₂ → 2H₂O', '2H₂ + O₂ → 2H₂O'],
        ['ΔH = −286 кДж на 1 моль H₂O', 'ΔH = −286 kJ per mole of H₂O', 'ΔH = −286 kJ (1 mol H₂O ga)'],
        ['взрыв от искры', 'explodes from a spark', 'uchqundan portlaydi'],
      ],
      tone: 'route',
    },
    {
      stage: 'valence',
      from: 0.15,
      to: 1,
      title: ['Валентные электроны', 'Valence electrons', 'Valent elektronlar'],
      lines: [
        ['O: 2s²2p⁴ — 6 e⁻, 2 неспаренных', 'O: 2s²2p⁴ — 6 e⁻, 2 unpaired', 'O: 2s²2p⁴ — 6 e⁻, 2 ta juftlashmagan'],
        ['H: 1s¹ — 1 e⁻', 'H: 1s¹ — 1 e⁻', 'H: 1s¹ — 1 e⁻'],
        ['валентность O = II, H = I', 'valence O = II, H = I', 'valentlik O = II, H = I'],
      ],
      tone: 'check',
    },
    {
      stage: 'pairs',
      from: 0.25,
      to: 1,
      title: ['Полярная ковалентная связь', 'Polar covalent bond', 'Qutbli kovalent bogʻ'],
      lines: [
        ['ЭО: O 3,44 · H 2,20 · Δ = 1,24', 'EN: O 3.44 · H 2.20 · Δ = 1.24', 'EM: O 3,44 · H 2,20 · Δ = 1,24'],
        ['пара смещена к O: δ− O, δ+ H', 'pair shifted to O: δ− O, δ+ H', 'juft O tomon siljigan: δ− O, δ+ H'],
      ],
      tone: 'route',
    },
    {
      stage: 'bonds',
      from: 0.1,
      to: 1,
      title: ['Геометрия H₂O', 'H₂O geometry', 'H₂O geometriyasi'],
      lines: [
        ['∠ H–O–H = 104,5°', '∠ H–O–H = 104.5°', '∠ H–O–H = 104,5°'],
        ['две неподелённые пары отталкивают связи', 'two lone pairs push the bonds apart', 'ikki boʻlinmagan juft bogʻlarni itaradi'],
        ['O–H 0,96 Å', 'O–H 0.96 Å', 'O–H 0,96 Å'],
      ],
      tone: 'check',
    },
    {
      stage: 'assemble',
      from: 0.1,
      to: 1,
      title: ['Диполь', 'Dipole', 'Dipol'],
      lines: [
        ['угловая молекула → полярная', 'bent molecule → polar', 'burchakli molekula → qutbli'],
        ['растворяет соли, кислоты, щёлочи', 'dissolves salts, acids, alkalis', 'tuz, kislota, ishqorlarni eritadi'],
      ],
      tone: 'route',
    },
    {
      stage: 'final',
      from: 0.08,
      to: 0.47,
      title: ['Водородная связь', 'Hydrogen bond', 'Vodorod bogʻi'],
      lines: [
        ['O–H···O между молекулами', 'O–H···O between molecules', 'molekulalar orasida O–H···O'],
        ['t кип = 100 °C', 'boiling point 100 °C', 'qaynash t = 100 °C'],
        ['наибольшая плотность при 4 °C', 'densest at 4 °C', 'eng zich — 4 °C da'],
      ],
      tone: 'route',
    },
    {
      stage: 'final',
      from: 0.5,
      to: 0.85,
      title: ['Лёд', 'Ice', 'Muz'],
      lines: [
        ['шестиугольные кольца, пустоты', 'hexagonal rings with voids', 'olti burchakli halqalar, boʻshliqlar'],
        ['ρ льда 0,92 г/см³ — лёд плавает', 'ice ρ 0.92 g/cm³ — ice floats', 'muz ρ 0,92 g/sm³ — muz suzadi'],
      ],
      tone: 'check',
    },
  ],
}
