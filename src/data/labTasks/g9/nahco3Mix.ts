/**
 * Kimyo 9, с. 174, пример 7: при сильном накаливании 60 г смеси Na₂CO₃ и NaHCO₃ выделилось 2,7 г воды — массовые доли.
 * Опыт 1:10 — 6,00 г смеси в пробирке (на весах, тара), U-трубка с CaCl₂ взвешена (m₁); пробирка в лапке отверстием
 * чуть вниз, пробка с газоотводной трубкой → U-трубка → трубка в известковую воду; нагрев спиртовкой: капли воды у
 * отверстия, гранулы CaCl₂ влажнеют, известковая вода мутнеет (CO₂); по ТБ — сначала трубку из известковой воды, потом
 * гасить; U-трубка на весы (m₂: вода, честно меньше — часть капель осталась в пробирке и трубке); остывшая пробирка на
 * весы — убыль массы (H₂O + CO₂). Ответ — по убыли массы (точнее), проверка — по воде в U-трубке.
 */
import type { LabLang } from '../../../components/lab3d/labContract'
import { fmtNum } from '../../../components/lab3d/measure/instruments'
import { quantize } from '../../../components/lab3d/measure/quantities'
import { L, tr, type LabTask, type LabTaskValues } from '../labTaskTypes'

/** 2NaHCO₃ (2 · 84 = 168 г) теряет H₂O + CO₂ (18 + 44 = 62 г). */
const M2 = 168
const LOSS = 62
const W_BOOK = 0.42

const n = (x: number, d: number, lang: LabLang) => fmtNum(x, d, lang)
/** Масса NaHCO₃ по убыли массы пробирки (г) и её доля, %. */
const mBicarb = (v: LabTaskValues) => (v.dm! * M2) / LOSS
const wBicarb = (v: LabTaskValues) => (mBicarb(v) / v.mMix!) * 100

export const NAHCO3_MIX: LabTask = {
  id: 'task-g9-nahco3-mix',
  grade: 9,
  page: 174,
  source: L('Kimyo 9 · с. 174, пример 7', 'Kimyo 9 · p. 174, example 7', 'Kimyo 9 · 174-bet, 7-misol'),
  bookKind: 'example',
  title: L('Состав смеси соды и питьевой соды', 'Composition of a soda and baking soda mixture', 'Soda va ichimlik sodasi aralashmasi tarkibi'),
  statement: L(
    'При сильном накаливании 60 г смеси карбоната натрия и гидрокарбоната натрия выделилось 2,7 г воды. Определите массовые доли карбоната и гидрокарбоната натрия в составе смеси.',
    'When 60 g of a mixture of sodium carbonate and sodium hydrogen carbonate was strongly heated, 2.7 g of water were released. Find the mass fractions of sodium carbonate and sodium hydrogen carbonate in the mixture.',
    '60 g natriy karbonat va natriy gidrokarbonat aralashmasi kuchli qizdirilganda 2,7 g suv ajraldi. Aralashma tarkibidagi natriy karbonat va natriy gidrokarbonatning massa ulushlarini aniqlang.',
  ),
  equation: '2NaHCO₃ → Na₂CO₃ + H₂O + CO₂↑',
  kind: 'decomposition',
  type: 'mixture',
  difficulty: 3,
  answers: [
    {
      key: 'wCarb',
      label: 'w(Na₂CO₃)',
      what: L('массовая доля карбоната натрия', 'mass fraction of sodium carbonate', 'natriy karbonatning massa ulushi'),
      unit: L('%', '%', '%'),
      book: 58,
      decimals: 0,
      fromRun: (v) => 100 - wBicarb(v),
    },
    {
      key: 'wBicarb',
      label: 'w(NaHCO₃)',
      what: L('массовая доля гидрокарбоната натрия', 'mass fraction of sodium hydrogen carbonate', 'natriy gidrokarbonatning massa ulushi'),
      unit: L('%', '%', '%'),
      book: 42,
      decimals: 0,
      fromRun: wBicarb,
    },
  ],
  labScale: {
    factor: 10,
    note: L(
      'Опыт в 10 раз меньше задачи: 6 г смеси вместо 60 г; воды выделится 0,27 г вместо 2,7 г. Массовые доли от масштаба не зависят.',
      'The experiment is 10 times smaller: 6 g of mixture instead of 60 g, giving 0.27 g of water instead of 2.7 g. Mass fractions do not depend on scale.',
      'Tajriba masaladan 10 marta kichik: 60 g o‘rniga 6 g aralashma; 2,7 g o‘rniga 0,27 g suv ajraladi. Massa ulushlari miqyosga bog‘liq emas.',
    ),
  },
  instruments: ['scales'],
  equipment: [
    L('Двое электронных весов (0,01 г)', 'Two electronic balances (0.01 g)', 'Ikkita elektron tarozi (0,01 g)'),
    L('Пробирка в подставке, штатив с лапкой, пробка с газоотводной трубкой', 'Test tube in a holder, stand with clamp, stopper with a delivery tube', 'Tagliklagi probirka, qisqichli shtativ, gaz o‘tkazgich nayli tiqin'),
    L('U-образная трубка с безводным CaCl₂ на подставке', 'U-tube with anhydrous CaCl₂ on a stand', 'Taglikdagi suvsiz CaCl₂ li U-simon nay'),
    L('Стаканчик с известковой водой, спиртовка, спички', 'Beaker of limewater, spirit lamp, matches', 'Ohakli suvli stakancha, spirt lampa, gugurt'),
    L('Смесь Na₂CO₃ и NaHCO₃, шпатель', 'Na₂CO₃ + NaHCO₃ mixture, spatula', 'Na₂CO₃ va NaHCO₃ aralashmasi, shpatel'),
  ],
  safety: [
    L('Очки обязательны: при нагревании возможен выброс горячего порошка.', 'Goggles are a must: hot powder may spurt when heated.', 'Ko‘zoynak shart: qizdirishda issiq kukun otilishi mumkin.'),
    L('Пробирку закрепляют отверстием чуть вниз, отверстием — от себя и соседей.', 'Clamp the tube with its mouth slightly down and pointing away from people.', 'Probirkani teshigi biroz pastga va odamlardan teskari qilib qisting.'),
    L('Сначала вынуть трубку из известковой воды, потом гасить спиртовку — иначе вода засосётся в горячую пробирку.', 'First take the tube out of the limewater, then put out the lamp — otherwise water is sucked into the hot tube.', 'Avval nayni ohakli suvdan chiqaring, keyin spirt lampani o‘chiring — aks holda suv issiq probirkaga so‘riladi.'),
  ],
  gear: ['goggles'],
  place: 'bench',
  steps: [
    {
      id: 'gear',
      target: 'ppe',
      gesture: { kind: 'tap' },
      seconds: 1.6,
      instruction: L('Наденьте защитные очки.', 'Put on safety goggles.', 'Himoya ko‘zoynagini taqing.'),
      observation: L('Очки надеты — можно нагревать.', 'Goggles on — you can heat.', 'Ko‘zoynak taqildi — qizdirish mumkin.'),
      how: L('Нажмите на поднос с очками.', 'Tap the tray with the goggles.', 'Ko‘zoynakli patnisni bosing.'),
      teacher: L('Сухой порошок при сильном нагреве «стреляет»: выделяющиеся пары воды и CO₂ подбрасывают крупинки — глаза защищаем заранее.', 'A dry powder “spits” when strongly heated: escaping steam and CO₂ throw grains up — protect your eyes beforehand.', 'Quruq kukun kuchli qizdirilganda «otadi»: chiqayotgan bug‘ va CO₂ donachalarni otib yuboradi — ko‘zni oldindan himoya qilamiz.'),
    },
    {
      id: 'tube',
      target: 'tube',
      gesture: { kind: 'drag', from: [-0.56, 0.1, -0.02], to: [-0.42, 0.16, 0.13], lead: 0.6 },
      seconds: 3,
      instruction: L('Поставьте сухую пробирку в подставку на весах.', 'Put a dry test tube into the holder on the balance.', 'Quruq probirkani tarozidagi taglikka qo‘ying.'),
      observation: L('Весы показывают массу пробирки с подставкой.', 'The balance shows the tube with its holder.', 'Tarozi probirka va taglik massasini ko‘rsatadi.'),
      how: L('Перетащите пробирку из штатива в подставку на весах.', 'Drag the tube from the rack into the holder on the balance.', 'Probirkani shtativdan tarozidagi taglikka torting.'),
      teacher: L('Пробирка не стоит сама — её взвешивают в подставке; подставка останется на весах до конца опыта.', 'A test tube cannot stand on its own, so it is weighed in a holder; the holder stays on the balance till the end.', 'Probirka o‘zi turmaydi — u taglikda tortiladi; taglik tajriba oxirigacha tarozida qoladi.'),
    },
    {
      id: 'tare',
      target: 'tare',
      gesture: { kind: 'tap' },
      seconds: 1.4,
      instruction: L('Нажмите «T» — обнулите весы.', 'Press “T” to zero the balance.', '«T» ni bosib, tarozini nolga keltiring.'),
      observation: L('На дисплее 0.00 g и «→0←».', 'The display reads 0.00 g with “→0←”.', 'Displeyda 0.00 g va «→0←».'),
      how: L('Нажмите кнопку «T» на весах.', 'Tap the “T” button on the balance.', 'Tarozidagi «T» tugmasini bosing.'),
      teacher: L('Тара запомнит пробирку с подставкой: в конце, когда остывшую пробирку вернут на место, весы сразу покажут массу остатка.', 'The tare remembers the tube and holder: at the end, when the cooled tube is put back, the balance shows the residue directly.', 'Tara probirka va taglikni eslab qoladi: oxirida sovigan probirka joyiga qaytarilganda tarozi darhol qoldiq massasini ko‘rsatadi.'),
      mistake: L('Нажать «T» ещё раз до конца опыта — пропадёт «точка отсчёта» для убыли массы.', 'Pressing “T” again before the end — the reference for the mass loss is lost.', 'Tajriba oxirigacha «T» ni yana bosish — massa kamayishi uchun «hisob nuqtasi» yo‘qoladi.'),
    },
    {
      id: 'mix',
      target: 'spatula',
      gesture: { kind: 'swipe', from: [-0.3, 0.03, 0.26], to: [-0.42, 0.22, 0.13], lead: 0.3 },
      seconds: 6.5,
      instruction: L('Насыпьте в пробирку шпателем 6,00 г смеси.', 'Add 6.00 g of the mixture into the tube with the spatula.', 'Probirkaga shpatel bilan 6,00 g aralashma soling.'),
      observation: L('Белый порошок на дне пробирки (столбик ≈3 см); дисплей останавливается около 6,00 г.', 'White powder at the bottom of the tube (a ≈3 cm column); the display stops near 6.00 g.', 'Probirka tubida oq kukun (≈3 sm ustun); displey 6,00 g atrofida to‘xtaydi.'),
      how: L('Проведите шпателем от банки к пробирке; последние порции — по чуть-чуть.', 'Swipe the spatula from the jar to the tube; add the last portions little by little.', 'Shpatelni bankadan probirkaga suring; oxirgi ulushlarni oz-ozdan soling.'),
      teacher: L('Na₂CO₃ и NaHCO₃ — оба белые порошки, на вид их не различить; узнать долю каждого можно только по тому, что произойдёт при нагревании.', 'Na₂CO₃ and NaHCO₃ are both white powders and look alike; only heating tells how much of each there is.', 'Na₂CO₃ va NaHCO₃ — ikkalasi ham oq kukun, ko‘rinishda farqlanmaydi; har birining ulushini faqat qizdirishda bilish mumkin.'),
      mistake: L('Сыпать на стенки у отверстия — порошок прилипнет и попадёт в пробку.', 'Spilling on the walls near the mouth — the powder sticks and gets into the stopper.', 'Teshik yonidagi devorlarga sochish — kukun yopishib, tiqinga tushadi.'),
    },
    {
      id: 'utube1',
      target: 'utube',
      gesture: { kind: 'drag', from: [0.02, 0.08, -0.06], to: [0.3, 0.12, 0.11], lead: 0.6 },
      seconds: 3,
      instruction: L('Взвесьте U-трубку с хлоридом кальция.', 'Weigh the U-tube with calcium chloride.', 'Kalsiy xloridli U-simon nayni torting.'),
      observation: L('Вторые весы показывают m₁ — массу U-трубки с подставкой (≈60 г).', 'The second balance shows m₁ — the U-tube with its stand (≈60 g).', 'Ikkinchi tarozi m₁ ni — taglikli U-simon nay massasini (≈60 g) ko‘rsatadi.'),
      how: L('Перетащите U-трубку на чашу вторых весов.', 'Drag the U-tube onto the second balance.', 'U-simon nayni ikkinchi tarozi pallasiga torting.'),
      teacher: L('Безводный CaCl₂ жадно связывает воду (CaCl₂·6H₂O), а CO₂ пропускает: прибавка массы трубки — это только вода.', 'Anhydrous CaCl₂ greedily binds water (CaCl₂·6H₂O) but lets CO₂ through: the gain in mass is water only.', 'Suvsiz CaCl₂ suvni ochko‘zlik bilan bog‘laydi (CaCl₂·6H₂O), CO₂ ni esa o‘tkazadi: nay massasining ortishi — faqat suv.'),
      mistake: L('Взвешивать со шлангами — их масса и натяжение исказят показание.', 'Weighing with the hoses on — their weight and pull distort the reading.', 'Shlanglar bilan tortish — ularning massasi va tortilishi ko‘rsatkichni buzadi.'),
    },
    {
      id: 'clamp',
      target: 'tube',
      gesture: { kind: 'drag', from: [-0.42, 0.16, 0.13], to: [-0.2, 0.14, -0.06], lead: 0.55 },
      seconds: 4.5,
      instruction: L('Закрепите пробирку в лапке отверстием чуть вниз и закройте пробкой с газоотводной трубкой.', 'Clamp the tube with its mouth slightly down and close it with the stopper and delivery tube.', 'Probirkani teshigi biroz pastga qilib qisqichga mahkamlang va gaz o‘tkazgich nayli tiqin bilan yoping.'),
      observation: L('Порошок лёг вдоль нижней стенки; лапка — ближе к отверстию; весы без пробирки показывают «минус массу стекла».', 'The powder lies along the lower wall; the clamp is near the mouth; without the tube the balance shows “minus the glass”.', 'Kukun pastki devor bo‘ylab yotdi; qisqich — teshikka yaqin; probirkasiz tarozi «minus shisha massasi»ni ko‘rsatadi.'),
      how: L('Перетащите пробирку из подставки в лапку штатива.', 'Drag the tube from the holder into the stand clamp.', 'Probirkani tagliqdan shtativ qisqichiga torting.'),
      teacher: L('Вода, которая выделится, конденсируется у холодного отверстия; если оно смотрит вверх, капли стекут на раскалённое дно — стекло лопнет.', 'The released water condenses at the cool mouth; if the mouth pointed up, drops would run onto the red-hot bottom and crack the glass.', 'Ajralgan suv sovuq teshik yonida kondensatlanadi; teshik yuqoriga qarasa, tomchilar qizigan tubga oqib, shisha yorilib ketadi.'),
      mistake: L('Пробирка отверстием вверх — конденсат стечёт на горячее дно.', 'Tube mouth up — condensate runs back onto the hot bottom.', 'Probirka teshigi yuqoriga — kondensat issiq tubga oqadi.'),
    },
    {
      id: 'assemble',
      target: 'utube',
      gesture: { kind: 'drag', from: [0.3, 0.12, 0.11], to: [0.02, 0.1, -0.06], lead: 0.5 },
      seconds: 5,
      instruction: L('Присоедините U-трубку к газоотводной трубке, а конец выходной трубки опустите в известковую воду.', 'Connect the U-tube to the delivery tube and dip the outlet tube into the limewater.', 'U-simon nayni gaz o‘tkazgich nayga ulang, chiqish nayi uchini ohakli suvga tushiring.'),
      observation: L('Прибор собран: пробирка → U-трубка с CaCl₂ → известковая вода; соединения — резиновыми муфтами.', 'The apparatus is assembled: tube → CaCl₂ U-tube → limewater; joints are rubber sleeves.', 'Asbob yig‘ildi: probirka → CaCl₂ li U-simon nay → ohakli suv; ulanishlar — rezina muftalar.'),
      how: L('Перетащите U-трубку с весов к пробирке в штативе.', 'Drag the U-tube from the balance to the clamped tube.', 'U-simon nayni tarozidan shtativdagi probirkaga torting.'),
      teacher: L('Газы идут по цепочке: сначала CaCl₂ задерживает пары воды, потом CO₂ попадает в известковую воду — так два продукта разделяются.', 'The gases go down the line: CaCl₂ traps the steam first, then the CO₂ reaches the limewater — the two products are separated.', 'Gazlar zanjir bo‘ylab o‘tadi: avval CaCl₂ suv bug‘ini ushlaydi, keyin CO₂ ohakli suvga yetadi — ikki mahsulot ajratiladi.'),
    },
    {
      id: 'heat',
      target: 'lamp',
      gesture: { kind: 'tap' },
      seconds: 9,
      instruction: L('Зажгите спиртовку и сильно нагрейте смесь, пока не перестанут идти пузырьки.', 'Light the spirit lamp and heat the mixture strongly until bubbling stops.', 'Spirt lampani yoqing va pufakchalar to‘xtaguncha aralashmani kuchli qizdiring.'),
      observation: L('У отверстия пробирки — капли воды, гранулы CaCl₂ влажнеют; из трубки идут пузырьки, известковая вода мутнеет. Потом пузырьки прекращаются.', 'Water drops form at the tube mouth, CaCl₂ grains get damp; bubbles leave the tube and the limewater turns milky. Then the bubbling stops.', 'Probirka teshigida suv tomchilari, CaCl₂ donachalari namlanadi; naydan pufakchalar chiqadi, ohakli suv loyqalanadi. Keyin pufakchalar to‘xtaydi.'),
      how: L('Нажмите на спиртовку — колпачок снимут, фитиль зажгут спичкой.', 'Tap the spirit lamp — the cap comes off and a match lights the wick.', 'Spirt lampani bosing — qalpoq olinadi, pilik gugurt bilan yoqiladi.'),
      teacher: L('Выше 100 °C ионы HCO₃⁻ распадаются: 2HCO₃⁻ → CO₃²⁻ + H₂O + CO₂. Na₂CO₃ при этом не меняется — вся вода и весь CO₂ приходят только из гидрокарбоната.', 'Above 100 °C the HCO₃⁻ ions break up: 2HCO₃⁻ → CO₃²⁻ + H₂O + CO₂. Na₂CO₃ does not change — all the water and CO₂ come from the hydrogen carbonate only.', '100 °C dan yuqorida HCO₃⁻ ionlari parchalanadi: 2HCO₃⁻ → CO₃²⁻ + H₂O + CO₂. Na₂CO₃ o‘zgarmaydi — barcha suv va CO₂ faqat gidrokarbonatdan keladi.'),
      mistake: L('Греть только одно место — пробирку сначала прогревают целиком, потом нагревают порошок.', 'Heating one spot only — warm the whole tube first, then heat the powder.', 'Faqat bir joyni qizdirish — avval butun probirka isitiladi, keyin kukun qizdiriladi.'),
    },
    {
      id: 'stop',
      target: 'outlet',
      gesture: { kind: 'drag', from: [0.13, 0.06, -0.06], to: [0.13, 0.22, 0.02], lead: 0.4 },
      seconds: 4.6,
      instruction: L('Выньте трубку из известковой воды и только потом погасите спиртовку колпачком.', 'Take the tube out of the limewater and only then put out the lamp with its cap.', 'Nayni ohakli suvdan chiqaring va shundan keyingina spirt lampani qalpoq bilan o‘chiring.'),
      observation: L('Трубка вынута, спиртовка погашена; известковая вода осталась мутной.', 'The tube is out, the lamp is out; the limewater stays milky.', 'Nay chiqarildi, spirt lampa o‘chirildi; ohakli suv loyqaligicha qoldi.'),
      how: L('Перетащите выходную трубку вверх из стаканчика.', 'Drag the outlet tube up out of the beaker.', 'Chiqish nayini stakanchadan yuqoriga torting.'),
      teacher: L('Остывая, газ в пробирке сжимается; если трубка в воде, давление снаружи загонит известковую воду внутрь, и горячее стекло лопнет.', 'As it cools the gas in the tube contracts; with the tube still in water, outside pressure would push the limewater in and the hot glass would crack.', 'Sovuganda probirkadagi gaz siqiladi; nay suvda bo‘lsa, tashqi bosim ohakli suvni ichkariga haydaydi va issiq shisha yoriladi.'),
      mistake: L('Погасить спиртовку раньше — известковая вода «засосётся» в пробирку.', 'Putting out the lamp first — the limewater is sucked back into the tube.', 'Spirt lampani avval o‘chirish — ohakli suv probirkaga «so‘riladi».'),
    },
    {
      id: 'utube2',
      target: 'utube',
      gesture: { kind: 'drag', from: [0.02, 0.08, -0.06], to: [0.3, 0.12, 0.11], lead: 0.55 },
      seconds: 3.6,
      instruction: L('Отсоедините U-трубку и взвесьте её снова.', 'Disconnect the U-tube and weigh it again.', 'U-simon nayni ajrating va qayta torting.'),
      observation: L('m₂ больше m₁ примерно на четверть грамма — это вода, задержанная CaCl₂.', 'm₂ exceeds m₁ by about a quarter of a gram — the water trapped by CaCl₂.', 'm₂ m₁ dan taxminan chorak grammga ko‘p — bu CaCl₂ ushlagan suv.'),
      how: L('Перетащите U-трубку на чашу вторых весов.', 'Drag the U-tube onto the second balance.', 'U-simon nayni ikkinchi tarozi pallasiga torting.'),
      teacher: L('Часть пара успела осесть каплями у отверстия пробирки и в трубке до CaCl₂, поэтому U-трубка «поймала» чуть меньше воды, чем выделилось.', 'Part of the steam condensed as drops at the tube mouth and in the tubing before the CaCl₂, so the U-tube “caught” slightly less water than was released.', 'Bug‘ning bir qismi probirka teshigida va CaCl₂ gacha naychada tomchi bo‘lib qoldi, shuning uchun U-simon nay ajralgan suvdan biroz kamini «tutdi».'),
    },
    {
      id: 'residue',
      target: 'tube',
      gesture: { kind: 'drag', from: [-0.2, 0.14, -0.06], to: [-0.42, 0.16, 0.13], lead: 0.55 },
      seconds: 4.6,
      instruction: L('Выньте пробку, дайте пробирке остыть и поставьте её обратно в подставку на весах.', 'Remove the stopper, let the tube cool and put it back into the holder on the balance.', 'Tiqinni oling, probirkani sovuting va tarozidagi taglikka qaytaring.'),
      observation: L('Весы показывают массу остатка — меньше 6 г примерно на 0,9 г: столько ушло H₂O и CO₂.', 'The balance shows the residue — about 0.9 g less than 6 g: that much H₂O and CO₂ left.', 'Tarozi qoldiq massasini ko‘rsatadi — 6 g dan taxminan 0,9 g kam: shuncha H₂O va CO₂ chiqib ketdi.'),
      how: L('Перетащите пробирку из лапки в подставку на весах.', 'Drag the tube from the clamp into the holder on the balance.', 'Probirkani qisqichdan tarozidagi taglikka torting.'),
      teacher: L('Горячую пробирку не взвешивают: восходящий от неё тёплый воздух «приподнимает» чашу, и весы показывают меньше.', 'A hot tube is never weighed: warm air rising from it lifts the pan and the balance reads low.', 'Issiq probirka tortilmaydi: undan ko‘tarilayotgan iliq havo pallani «ko‘taradi», tarozi kam ko‘rsatadi.'),
      mistake: L('Нажать «T» перед этим взвешиванием — потеряется тара пробирки, и убыль не посчитать.', 'Pressing “T” before this weighing — the tube tare is lost and the loss cannot be found.', 'Bu tortishdan oldin «T» ni bosish — probirka tarasi yo‘qoladi, kamayishni hisoblab bo‘lmaydi.'),
    },
  ],
  focus: [
    { from: 3.72, to: 3.98, point: [-0.42, 0.03, 0.24], dist: 0.26 },
    { from: 4.72, to: 4.98, point: [0.3, 0.03, 0.22], dist: 0.26 },
    { from: 7.3, to: 7.94, point: [-0.08, 0.1, -0.06], dist: 0.55 },
    { from: 9.74, to: 9.98, point: [0.3, 0.03, 0.22], dist: 0.26 },
    { from: 10.74, to: 10.99, point: [-0.42, 0.03, 0.24], dist: 0.26 },
  ],
  labels: [
    { at: 7.42, pos: [-0.13, 0.17, -0.06], text: L('капли воды у отверстия', 'water drops at the mouth', 'teshik yonida suv tomchilari') },
    { at: 7.55, pos: [0.02, 0.2, -0.06], text: L('CaCl₂ поглощает воду', 'CaCl₂ absorbs the water', 'CaCl₂ suvni yutadi') },
    { at: 7.7, pos: [0.15, 0.1, -0.06], text: L('известковая вода мутнеет — CO₂', 'limewater turns milky — CO₂', 'ohakli suv loyqalanadi — CO₂') },
    { at: 8.2, pos: [0.1, 0.24, -0.02], text: L('сначала трубку из воды, потом гасить', 'tube out of the water first, then put out', 'avval nayni suvdan, keyin o‘chirish') },
  ],
  measurements: [
    { key: 'mMix', label: 'm(смесь)', what: L('масса смеси в пробирке', 'mass of the mixture in the tube', 'probirkadagi aralashma massasi'), instrument: 'scales', afterStep: 3 },
    { key: 'm1', label: 'm₁(U)', what: L('U-трубка с CaCl₂ до опыта', 'CaCl₂ U-tube before the run', 'tajribadan oldin CaCl₂ li U-simon nay'), instrument: 'scales', afterStep: 4 },
    { key: 'm2', label: 'm₂(U)', what: L('U-трубка после опыта', 'U-tube after the run', 'tajribadan keyin U-simon nay'), instrument: 'scales', afterStep: 9 },
    { key: 'dU', label: 'm(H₂O)', what: L('вода в U-трубке: m₂ − m₁', 'water in the U-tube: m₂ − m₁', 'U-simon naydagi suv: m₂ − m₁'), instrument: 'scales', afterStep: 9, derived: true },
    { key: 'mRes', label: 'm(остаток)', what: L('масса остатка после прокаливания', 'mass of the residue after heating', 'qizdirishdan keyingi qoldiq massasi'), instrument: 'scales', afterStep: 10 },
    { key: 'dm', label: 'Δm', what: L('убыль массы: H₂O + CO₂', 'mass loss: H₂O + CO₂', 'massa kamayishi: H₂O + CO₂'), instrument: 'scales', afterStep: 10, derived: true },
  ],
  simulate: (rng) => {
    const f = rng.between(0.417, 0.423)
    const mMix = rng.weigh(6, 0.04)
    const nB = (mMix * f) / 84
    const water = (nB / 2) * 18
    const co2 = (nB / 2) * 44
    // разложение почти полное: чуть-чуть NaHCO₃ в глубине порошка может не прогреться
    const lost = (water + co2) * rng.between(0.995, 1)
    const mRes = quantize(mMix - lost, 0.01)
    const mU = quantize(rng.between(58.5, 64.5), 0.01)
    // часть пара оседает каплями у отверстия пробирки и в трубке до CaCl₂ — U-трубка ловит 93–97 % воды
    const m2 = quantize(mU + water * rng.between(0.93, 0.97), 0.01)
    const mGlass = quantize(rng.between(8.6, 9.6), 0.01)
    const mBlock = quantize(rng.between(14.2, 16.8), 0.01)
    const r2 = (x: number) => Math.round(x * 100) / 100
    return { mMix, m1: mU, m2, dU: r2(m2 - mU), mRes, dm: r2(mMix - mRes), mGlass, mBlock }
  },
  given: (v, lang) => [
    tr(lang, `m(смеси) = ${n(v.mMix!, 2, lang)} г (в задаче — в 10 раз больше: 60 г)`, `m(mixture) = ${n(v.mMix!, 2, lang)} g (10 times more in the problem: 60 g)`, `m(aralashma) = ${n(v.mMix!, 2, lang)} g (masalada 10 marta ko‘p: 60 g)`),
    tr(lang, `U-трубка: m₁ = ${n(v.m1!, 2, lang)} г → m₂ = ${n(v.m2!, 2, lang)} г; m(H₂O) = ${n(v.dU!, 2, lang)} г`, `U-tube: m₁ = ${n(v.m1!, 2, lang)} g → m₂ = ${n(v.m2!, 2, lang)} g; m(H₂O) = ${n(v.dU!, 2, lang)} g`, `U-simon nay: m₁ = ${n(v.m1!, 2, lang)} g → m₂ = ${n(v.m2!, 2, lang)} g; m(H₂O) = ${n(v.dU!, 2, lang)} g`),
    tr(lang, `Остаток: ${n(v.mRes!, 2, lang)} г → убыль Δm = ${n(v.dm!, 2, lang)} г (H₂O + CO₂)`, `Residue: ${n(v.mRes!, 2, lang)} g → loss Δm = ${n(v.dm!, 2, lang)} g (H₂O + CO₂)`, `Qoldiq: ${n(v.mRes!, 2, lang)} g → kamayish Δm = ${n(v.dm!, 2, lang)} g (H₂O + CO₂)`),
    'M(NaHCO₃) = 84, M(H₂O) = 18, M(CO₂) = 44 ' + tr(lang, 'г/моль', 'g/mol', 'g/mol'),
  ],
  solution: (v, lang) => {
    const mb = mBicarb(v)
    const wb = wBicarb(v)
    const mbW = (v.dU! * M2) / 18
    return [
      tr(lang, '1) 2NaHCO₃ → Na₂CO₃ + H₂O + CO₂↑: из 2 · 84 = 168 г NaHCO₃ уходят 18 + 44 = 62 г; Na₂CO₃ не разлагается', '1) 2NaHCO₃ → Na₂CO₃ + H₂O + CO₂↑: 2 · 84 = 168 g of NaHCO₃ lose 18 + 44 = 62 g; Na₂CO₃ does not decompose', '1) 2NaHCO₃ → Na₂CO₃ + H₂O + CO₂↑: 2 · 84 = 168 g NaHCO₃ dan 18 + 44 = 62 g chiqadi; Na₂CO₃ parchalanmaydi'),
      tr(lang, `2) По убыли массы: m(NaHCO₃) = ${n(v.dm!, 2, lang)} · 168 / 62 = ${n(mb, 2, lang)} г`, `2) From the mass loss: m(NaHCO₃) = ${n(v.dm!, 2, lang)} · 168 / 62 = ${n(mb, 2, lang)} g`, `2) Massa kamayishi bo‘yicha: m(NaHCO₃) = ${n(v.dm!, 2, lang)} · 168 / 62 = ${n(mb, 2, lang)} g`),
      `3) w(NaHCO₃) = ${n(mb, 2, lang)} / ${n(v.mMix!, 2, lang)} · 100 % = ${n(wb, 1, lang)} %; w(Na₂CO₃) = 100 − ${n(wb, 1, lang)} = ${n(100 - wb, 1, lang)} %`,
      tr(lang, `4) По воде в U-трубке: m(NaHCO₃) = ${n(v.dU!, 2, lang)} · 168 / 18 = ${n(mbW, 2, lang)} г → ${n((mbW / v.mMix!) * 100, 1, lang)} % — меньше: часть воды осталась каплями до CaCl₂`, `4) From the water in the U-tube: m(NaHCO₃) = ${n(v.dU!, 2, lang)} · 168 / 18 = ${n(mbW, 2, lang)} g → ${n((mbW / v.mMix!) * 100, 1, lang)} % — lower: some water stayed as drops before the CaCl₂`, `4) U-simon naydagi suv bo‘yicha: m(NaHCO₃) = ${n(v.dU!, 2, lang)} · 168 / 18 = ${n(mbW, 2, lang)} g → ${n((mbW / v.mMix!) * 100, 1, lang)} % — kam: suvning bir qismi CaCl₂ gacha tomchi bo‘lib qoldi`),
      tr(lang, '5) Задача: 2,7 г воды → m(NaHCO₃) = 2,7 · 168 / 18 = 25,2 г из 60 г; m(Na₂CO₃) = 34,8 г', '5) The problem: 2.7 g of water → m(NaHCO₃) = 2.7 · 168 / 18 = 25.2 g of 60 g; m(Na₂CO₃) = 34.8 g', '5) Masala: 2,7 g suv → m(NaHCO₃) = 2,7 · 168 / 18 = 25,2 g (60 g dan); m(Na₂CO₃) = 34,8 g'),
      tr(lang, `Ответ: w(Na₂CO₃) ≈ ${n(100 - wb, 0, lang)} %, w(NaHCO₃) ≈ ${n(wb, 0, lang)} %`, `Answer: w(Na₂CO₃) ≈ ${n(100 - wb, 0, lang)} %, w(NaHCO₃) ≈ ${n(wb, 0, lang)} %`, `Javob: w(Na₂CO₃) ≈ ${n(100 - wb, 0, lang)} %, w(NaHCO₃) ≈ ${n(wb, 0, lang)} %`),
    ]
  },
  compare: [
    {
      label: L('вода в U-трубке', 'water in the U-tube', 'U-simon naydagi suv'),
      unit: 'g',
      decimals: 2,
      measured: (v) => v.dU!,
      predicted: (v) => (v.dm! * 18) / LOSS,
      book: 0.27,
      tolerancePct: 10,
    },
    {
      label: L('убыль массы пробирки', 'mass loss of the tube', 'probirka massasining kamayishi'),
      unit: 'g',
      decimals: 2,
      measured: (v) => v.dm!,
      predicted: (v) => (v.mMix! * W_BOOK * LOSS) / M2,
      book: 0.93,
      tolerancePct: 2,
    },
  ],
  reconcile: L(
    'Воду можно найти двумя способами. U-трубка честно показывает меньше (≈0,25 г вместо 0,27 г): часть пара оседает каплями у холодного отверстия пробирки и в газоотводной трубке, не доходя до CaCl₂, а прибавка в четверть грамма считается как разность двух показаний по ±0,01 г — это ±4 %. Убыль массы пробирки точнее: в ней сразу и H₂O, и CO₂ (≈0,93 г — в 3,4 раза больше), капли внутри пробирки не мешают — их выпаривают при прокаливании, а относительная погрешность весов втрое меньше. Поэтому ответ считают по убыли, а воду в U-трубке — как проверку. Ещё одна поправка: остывшую пробирку взвешивают, горячая «легче».',
    'Water can be found two ways. The U-tube honestly shows less (≈0.25 g instead of 0.27 g): some steam condenses as drops at the cool tube mouth and in the delivery tube before reaching the CaCl₂, and a quarter-gram gain is the difference of two readings of ±0.01 g each — ±4 %. The mass loss of the tube is more accurate: it includes both H₂O and CO₂ (≈0.93 g — 3.4 times more), drops inside the tube do not matter as they are driven off by the heating, and the relative balance error is three times smaller. So the answer is based on the loss, with the U-tube water as a check. One more point: the tube is weighed cool — a hot tube reads light.',
    'Suvni ikki usulda topish mumkin. U-simon nay halol ravishda kam ko‘rsatadi (0,27 g o‘rniga ≈0,25 g): bug‘ning bir qismi probirkaning sovuq teshigida va gaz o‘tkazgich nayda CaCl₂ ga yetmay tomchi bo‘lib qoladi, chorak grammlik ortish esa har biri ±0,01 g bo‘lgan ikki ko‘rsatkich farqi — bu ±4 %. Probirka massasining kamayishi aniqroq: unda H₂O ham, CO₂ ham bor (≈0,93 g — 3,4 marta ko‘p), probirka ichidagi tomchilar xalaqit bermaydi — ular qizdirishda bug‘lanadi, tarozining nisbiy xatosi esa uch marta kichik. Shuning uchun javob kamayish bo‘yicha hisoblanadi, U-simon naydagi suv — tekshiruv. Yana bir tuzatish: probirka sovigach tortiladi — issig‘i «yengil» chiqadi.',
  ),
  conclusion: L(
    'При накаливании разлагается только NaHCO₃: 2NaHCO₃ → Na₂CO₃ + H₂O + CO₂↑. По 2,7 г воды (в опыте — 0,27 г, или по убыли массы 0,93 г) в 60 г смеси было 25,2 г NaHCO₃ — 42 %, остальное — Na₂CO₃ (58 %).',
    'Only NaHCO₃ decomposes on heating: 2NaHCO₃ → Na₂CO₃ + H₂O + CO₂↑. From 2.7 g of water (0.27 g in the run, or 0.93 g of mass loss) 60 g of the mixture contained 25.2 g of NaHCO₃ — 42 %, the rest is Na₂CO₃ (58 %).',
    'Qizdirilganda faqat NaHCO₃ parchalanadi: 2NaHCO₃ → Na₂CO₃ + H₂O + CO₂↑. 2,7 g suv bo‘yicha (tajribada 0,27 g yoki massa kamayishi 0,93 g) 60 g aralashmada 25,2 g NaHCO₃ bor edi — 42 %, qolgani Na₂CO₃ (58 %).',
  ),
  story: {
    equation: '2HCO₃⁻ → CO₃²⁻ + H₂O + CO₂↑',
    text: L(
      'В кристаллах гидрокарбоната ионы HCO₃⁻ связаны водородными связями. При нагревании два таких иона обмениваются протоном: один становится карбонат-ионом CO₃²⁻, а другой распадается на молекулы воды и углекислого газа, которые улетают. Карбонат натрия устойчив — его ионы CO₃²⁻ и Na⁺ остаются в пробирке, поэтому масса уменьшается только за счёт NaHCO₃.',
      'In hydrogen carbonate crystals the HCO₃⁻ ions are held by hydrogen bonds. On heating two such ions exchange a proton: one becomes a carbonate ion CO₃²⁻ and the other falls apart into water and carbon dioxide molecules that escape. Sodium carbonate is stable — its CO₃²⁻ and Na⁺ ions stay in the tube, so the mass falls only because of NaHCO₃.',
      'Gidrokarbonat kristallarida HCO₃⁻ ionlari vodorod bog‘lari bilan bog‘langan. Qizdirilganda ikkita shunday ion proton almashadi: biri karbonat-ion CO₃²⁻ ga aylanadi, ikkinchisi esa uchib ketadigan suv va karbonat angidrid molekulalariga parchalanadi. Natriy karbonat barqaror — uning CO₃²⁻ va Na⁺ ionlari probirkada qoladi, shuning uchun massa faqat NaHCO₃ hisobiga kamayadi.',
    ),
  },
  quiz: [
    {
      id: 'sign',
      q: L('Что показало, что выделился именно CO₂?', 'What showed that CO₂ was released?', 'Aynan CO₂ ajralganini nima ko‘rsatdi?'),
      options: [
        L('Известковая вода помутнела', 'The limewater turned milky', 'Ohakli suv loyqalandi'),
        L('Гранулы CaCl₂ стали влажными', 'The CaCl₂ grains got damp', 'CaCl₂ donachalari namlandi'),
        L('Порошок почернел', 'The powder turned black', 'Kukun qoraydi'),
        L('Появился резкий запах', 'A sharp smell appeared', 'O‘tkir hid paydo bo‘ldi'),
      ],
      correct: 0,
      why: L('CO₂ + Ca(OH)₂ → CaCO₃↓ + H₂O: нерастворимый мел даёт муть. Влажный CaCl₂ — признак воды, а не CO₂.', 'CO₂ + Ca(OH)₂ → CaCO₃↓ + H₂O: insoluble chalk makes it cloudy. Damp CaCl₂ signals water, not CO₂.', 'CO₂ + Ca(OH)₂ → CaCO₃↓ + H₂O: erimaydigan bo‘r loyqa beradi. Nam CaCl₂ — suv belgisi, CO₂ emas.'),
    },
    {
      id: 'type',
      q: L('Какая это реакция и что в смеси в ней участвует?', 'What reaction is this and which part of the mixture takes part?', 'Bu qanday reaksiya va aralashmaning qaysi qismi qatnashadi?'),
      options: [
        L('Разложение — разлагается только NaHCO₃', 'Decomposition — only NaHCO₃ breaks down', 'Parchalanish — faqat NaHCO₃ parchalanadi'),
        L('Разложение — разлагаются обе соли', 'Decomposition — both salts break down', 'Parchalanish — ikkala tuz ham parchalanadi'),
        L('Соединение с кислородом воздуха', 'Combination with oxygen from the air', 'Havo kislorodi bilan birikish'),
      ],
      correct: 0,
      why: L('Из одного вещества получаются три; Na₂CO₃ выдерживает нагрев спиртовкой, поэтому вся убыль массы — от гидрокарбоната.', 'One substance gives three; Na₂CO₃ withstands a spirit lamp, so all the mass loss comes from the hydrogen carbonate.', 'Bitta moddadan uchta hosil bo‘ladi; Na₂CO₃ spirt lampa qizdirishiga chidaydi, shuning uchun butun massa kamayishi gidrokarbonatdan.'),
    },
    {
      id: 'product',
      q: L('Что осталось в пробирке после прокаливания?', 'What is left in the tube after heating?', 'Qizdirishdan keyin probirkada nima qoldi?'),
      options: [
        L('Только Na₂CO₃ — бывший и образовавшийся', 'Only Na₂CO₃ — the original and the newly formed', 'Faqat Na₂CO₃ — avvalgi va hosil bo‘lgan'),
        L('Смесь Na₂CO₃ и NaHCO₃ в прежнем составе', 'Na₂CO₃ and NaHCO₃ in the same proportions', 'Avvalgi tarkibdagi Na₂CO₃ va NaHCO₃ aralashmasi'),
        L('Na₂O и вода', 'Na₂O and water', 'Na₂O va suv'),
      ],
      correct: 0,
      why: L('Гидрокарбонат весь превратился в карбонат; масса остатка = масса смеси − (H₂O + CO₂).', 'All the hydrogen carbonate became carbonate; residue mass = mixture mass − (H₂O + CO₂).', 'Gidrokarbonat to‘liq karbonatga aylandi; qoldiq massasi = aralashma massasi − (H₂O + CO₂).'),
    },
  ],
  sideEquations: ['CO₂ + Ca(OH)₂ → CaCO₃↓ + H₂O', 'CaCl₂ + 6H₂O → CaCl₂·6H₂O'],
}
