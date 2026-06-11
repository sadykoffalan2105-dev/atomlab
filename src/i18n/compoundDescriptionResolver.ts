import { hash32 } from '../chemistry/placeholderMolecule'
import type { CompoundCategory } from '../types/chemistry'
import type { AppLocale } from './types'
import { resolveCompoundName } from './compoundNameResolver'

type Loc = 'en' | 'uz'

function pick(id: string, a: string, b: string, c: string): string {
  return [a, b, c][hash32(id) % 3]!
}

function saltDesc(id: string, title: string, anKey: string, loc: Loc): string {
  const hal = anKey === 'cl' || anKey === 'br' || anKey === 'i' || anKey === 'f'
  if (hal) {
    if (loc === 'en') {
      return pick(
        id,
        `${title} is a simple ionic halide salt, usually soluble in water. In school labs it is used for exchange reactions, ion tests, and electrolysis demonstrations. In industry such salts are starting materials for acids, bases, and other compound classes.`,
        `${title} dissociates into ions in solution, which makes it useful for teaching electrolytes and solubility tables. Lessons often include precipitating silver halides and metal–salt activity series. Table salt (sodium chloride) is the most familiar example.`,
        `${title} illustrates a crystalline ionic lattice. Lab work compares metal activity, corrosion, and precipitation. It appears in school kits and in production of other chemical classes from halides.`,
      )
    }
    return pick(
      id,
      `${title} — oddiy ionli galogenid tuzi, odatda suvda yaxshi eriydi. Maktab tajribalarida almashtirish reaksiyalari, ionlarni aniqlash va elektroliz uchun ishlatiladi. Sanoatda bunday tuzlar boshqa birikmalarni olish uchun xom ashyo hisoblanadi.`,
      `${title} eritmada ionlarga parchalanadi — bu elektrolitlar va eruvchanlik jadvalini tushuntirish uchun qulay. Darslarda kumush galogenidini cho'ktirish va metall faolligi zanjiri ko'rsatiladi. Kundalik hayotda eng yaqin misol — osh tuzi (natriy xloridi).`,
      `${title} — kristall ionli panjara namunasi. Laboratoriyada metall faolligi, korroziya va cho'ktirish solishtiriladi. Maktab to'plamlari va galogenidlardan kislotalar olishda qo'llaniladi.`,
    )
  }
  if (anKey === 'no3' || anKey === 'no2') {
    if (loc === 'en') {
      return pick(
        id,
        `${title} is a nitrate or nitrite salt and a strong electrolyte in water. Demonstrations use it with metals, copper and zinc compounds, and when discussing nitrogen oxides. Nitrates are important in fertilizers; at school level the focus is nitrogen redox chemistry.`,
        `${title} dissolves readily and gives ions quickly — useful for equilibrium shifts and anion tests. Nitrates appear in fertilizers and pyrotechnics; lessons emphasize nitrogen oxidation states and equations.`,
        `${title} occurs as crystals or concentrated solution. It is used in reaction chains with hydroxides and silver salts. The nitrate ion participates in many industrial cycles.`,
      )
    }
    return pick(
      id,
      `${title} — nitrat yoki nitrit anioni tuzi, suvda kuchli elektrolit. Namoyishlarda metallar, mis va rux birikmalari, shuningdek azot oksidlari bilan ishlatiladi. Nitratlar o'g'itlarda muhim; maktab kursida azotning OKV jarayonlari muhokama qilinadi.`,
      `${title} tez eriydi va ionlar beradi — muvozanat siljishi va anionni aniqlash uchun qulay. Nitratlar o'g'it va pirotexnikada uchraydi; darslarda azotning oksidlanish darajalari o'rganiladi.`,
      `${title} kristall yoki qalin eritma ko'rinishida bo'ladi. Gidroksidlar va kumush tuzlari bilan reaksiya zanjirlarida qo'llaniladi.`,
    )
  }
  if (anKey === 'mno4' || anKey === 'clo3' || anKey === 'clo4' || anKey === 'cro4') {
    if (loc === 'en') {
      return pick(
        id,
        `${title} is a salt of a strong oxidizing anion. In analytics and school demos it shows characteristic colors and redox behavior. Handle oxidizers with care and follow teacher instructions.`,
        `${title} dissolves to give an oxidizing ion used in titrations and qualitative tests. Lessons link it to the activity series and electron transfer.`,
        `${title} appears in laboratory reagent sets and industrial oxidizing processes. School work focuses on writing half-reactions and safety rules.`,
      )
    }
    return pick(
      id,
      `${title} — kuchli oksidlovchi anion tuzi. Analitikada va maktab namoyishlarida rang va OKV xatti-harakati ko'rsatiladi. Oksidlovchilarni ehtiyotkorlik bilan ishlating.`,
      `${title} eriyganda oksidlovchi ion beradi — titrlash va sifatli reaksiyalar uchun ishlatiladi. Darslarda faollik qatori va elektron uzatish o'rganiladi.`,
      `${title} laboratoriya reagentlari va sanoat oksidlovchi jarayonlarida uchraydi. Maktabda yarim reaksiyalar va xavfsizlik qoidalari muhokama qilinadi.`,
    )
  }
  if (anKey === 'so4' || anKey === 'so3') {
    if (loc === 'en') {
      return pick(
        id,
        `${title} is a sulfate or sulfite salt. Sulfates are common in minerals, detergents, and qualitative analysis (barium sulfate precipitate). Lessons cover solubility rules and sulfur oxidation states.`,
        `${title} in solution provides sulfate or sulfite ions for exchange reactions and precipitation. Industrial uses include paper, glass, and water treatment.`,
        `${title} is a typical ionic salt for studying dissociation, solubility, and reactions with barium and lead ions in school chemistry.`,
      )
    }
    return pick(
      id,
      `${title} — sulfat yoki sulfit tuzi. Sulfatlar minerallar, yuvish vositalari va sifatli analizda (bariy sulfat cho'kmasi) keng tarqalgan. Darslarda eruvchanlik qoidalari va oltingugurt oksidlanish darajalari o'rganiladi.`,
      `${title} eritmada sulfat yoki sulfit ionlari beradi — almashtirish va cho'ktirish reaksiyalari uchun. Qog'oz, shisha va suv tozalashda qo'llaniladi.`,
      `${title} — dissotsiatsiya, eruvchanlik va bariy/qo'rg'oshin ionlari bilan reaksiyalarni o'rganish uchun tipik ionli tuz.`,
    )
  }
  if (anKey === 'co3') {
    if (loc === 'en') {
      return pick(
        id,
        `${title} is a carbonate salt. Carbonates react with acids to release carbon dioxide — a classic school test. They appear in limestone, baking soda derivatives, and water hardness chemistry.`,
        `${title} illustrates hydrolysis and precipitation with calcium and barium ions. Many carbonates are sparingly soluble; lessons use solubility tables.`,
        `${title} connects to the carbon cycle, lime water tests, and preparation of carbon dioxide in the lab.`,
      )
    }
    return pick(
      id,
      `${title} — karbonat tuzi. Karbonatlar kislotalar bilan reaksiyada karbonat angidrid ajratadi — klassik maktab sinovi. Ohaktosh, pishirish soda hosilalari va suv qattiqligida uchraydi.`,
      `${title} gidroliz va kalsiy/bariy ionlari bilan cho'ktirishni ko'rsatadi. Ko'p karbonatlar kam eriydi; darslarda eruvchanlik jadvali ishlatiladi.`,
      `${title} — uglerod aylanishi, ohak suvi sinovi va laboratoriyada CO₂ olish bilan bog'liq.`,
    )
  }
  if (anKey === 'po4') {
    if (loc === 'en') {
      return pick(
        id,
        `${title} is a phosphate salt important in fertilizers, detergents, and biochemistry. In school it illustrates complex salts and phosphorus oxidation states.`,
        `${title} dissolves to give phosphate ions used in buffer systems and precipitation tests. Environmental chemistry discusses phosphate runoff.`,
        `${title} appears in agricultural and industrial chemistry; lessons link it to phosphoric acid and bone minerals.`,
      )
    }
    return pick(
      id,
      `${title} — fosfat tuzi, o'g'itlar, yuvish vositalari va biokimyoda muhim. Maktabda murakkab tuzlar va fosfor oksidlanish darajalarini ko'rsatadi.`,
      `${title} fosfat ionlari beradi — bufer tizimlari va cho'ktirish sinovlarida ishlatiladi. Ekologiyada fosfat oqimlari muhokama qilinadi.`,
      `${title} — qishloq xo'jaligi va sanoat kimyosida; fosfor kislotasi va suyak minerallari bilan bog'lanadi.`,
    )
  }
  if (loc === 'en') {
    return `${title} is an ionic inorganic salt studied in school chemistry for solubility, dissociation, and exchange reactions.`
  }
  return `${title} — maktab kimyosida eruvchanlik, dissotsiatsiya va almashtirish reaksiyalari uchun o'rganiladigan ionli tuz.`
}

const MANUAL_DESC: Record<string, { en: string; uz: string }> = {
  h2o: {
    en: 'Polar molecule and universal solvent. Essential for life, acid–base chemistry, and hydrolysis. In ATOMLAB the bent shape and hydrogen bonds are shown in 3D.',
    uz: 'Polyar molekula va universal erituvchi. Hayot, kislota–asos kimyosi va gidroliz uchun zarur. ATOMLABda buklangan shakl va vodorod bog\'lari 3D ko\'rsatiladi.',
  },
  co2: {
    en: 'Linear molecule of carbon dioxide — product of respiration and combustion. Dissolves in water forming carbonic acid; studied with lime water and the carbon cycle.',
    uz: 'Karbonat angidrid — nafas olish va yonish mahsuloti. Suvda erib uglerod kislotasini hosil qiladi; ohak suvi va uglerod aylanishi bilan o\'rganiladi.',
  },
  nacl: {
    en: 'Classic ionic salt (table salt). Crystalline lattice dissociates in water; used for electrolysis, exchange reactions, and everyday chemistry.',
    uz: 'Klassik ionli tuz (osh tuzi). Kristall panjara suvda parchalanadi; elektroliz, almashtirish reaksiyalari va kundalik kimyoda qo\'llaniladi.',
  },
  co: {
    en: 'Colorless, odorless toxic gas from incomplete combustion. Binds hemoglobin stronger than oxygen — a household hazard with poor ventilation. Compared with CO₂ in lessons.',
    uz: 'To\'liq bo\'lmagan yonishdan hosil bo\'ladigan hidsiz zaharli gaz. Gemoglobinga kisloroddan kuchliroq bog\'lanadi — yomon shamollatishda xavfli. Darslarda CO₂ bilan solishtiriladi.',
  },
  so2: {
    en: 'Pungent gas that dissolves in water forming acidic solution. Used industrially for sulfuric acid; food preservative in trace amounts. School demos cover solubility and redox of sulfur.',
    uz: 'Keskin hidli gaz, suvda erib kislota muhit hosil qiladi. Sanoatda oltingugurt kislotasi uchun; oz miqdorda konservant. Maktabda eruvchanlik va oltingugurt OKV jarayonlari ko\'rsatiladi.',
  },
  so3: {
    en: 'Strong acidic oxide; reacts vigorously with water to form sulfuric acid. Key step in the contact process. Handled with extreme care in the lab.',
    uz: 'Kuchli kislota oksidi; suv bilan issiqlik ajratib oltingugurt kislotasini hosil qiladi. Kontakt jarayonining asosiy bosqichi. Laboratoriyada juda ehtiyotkorlik bilan ishlatiladi.',
  },
  no: {
    en: 'Neutral gas that quickly oxidizes in air to NO₂. Role in nitric acid synthesis and nitrogen redox series NO → NO₂ → HNO₃.',
    uz: 'Neytral gaz, havoda tez NO₂ ga oksidlanadi. Azot kislotasi sintezi va NO → NO₂ → HNO₃ zanjirida muhim.',
  },
  no2: {
    en: 'Red-brown toxic gas involved in smog and acid rain. Made in school by copper and nitric acid. Used to study equilibrium 2NO₂ ⇌ N₂O₄.',
    uz: 'Qizg\'ish-jigarrang zaharli gaz, smog va kislota yomgʻirida ishtirok etadi. Maktabda mis va azot kislotasidan olinadi. 2NO₂ ⇌ N₂O₄ muvozanati o\'rganiladi.',
  },
  n2o: {
    en: 'Sweet-smelling gas used medically as an anesthetic and industrially as an oxidizer. Compared with CO₂ for composition and nitrogen oxidation state +1.',
    uz: 'Shirin hidli gaz — tibbiyotda narkoz va sanoatda oksidlovchi. Tarkibi va azot +1 oksidlanish darajasi bo\'yicha CO₂ bilan solishtiriladi.',
  },
  n2o5: {
    en: 'White hygroscopic solid forming nitric acid in water. Illustrates acidic oxides and nitrogen +5 oxidation state.',
    uz: 'Oq gigroskopik modda, suvda azot kislotasiga aylanadi. Kislota oksidlari va azot +5 darajasini ko\'rsatadi.',
  },
  p2o5: {
    en: 'Strong dehydrating acidic oxide; reacts violently with water to form phosphoric acid. Used in organic synthesis and linked to fertilizers.',
    uz: 'Kuchli qurituvchi kislota oksidi; suv bilan fosfor kislotasini hosil qiladi. Organik sintez va o\'g\'itlar bilan bog\'liq.',
  },
  sio2: {
    en: 'Basis of sand, quartz, and glass. Chemically resistant to most acids except HF. Discussed in lessons on silicates and ceramics.',
    uz: 'Qum, kvarts va shisha asosi. Ko\'p kislotalarga chidamli (HF dan tashqari). Silikatlar va keramika darslarida o\'rganiladi.',
  },
  li2o: { en: 'Basic oxide of lithium forming LiOH with water. Important in batteries; compared with Na₂O and K₂O.', uz: 'Litiyning asosiy oksidi, suv bilan LiOH hosil qiladi. Batareyalarda muhim; Na₂O va K₂O bilan solishtiriladi.' },
  na2o: { en: 'Theoretical partner of NaOH; hygroscopic basic oxide. Helps understand the Na → Na₂O → NaOH → salts chain.', uz: 'NaOH ning nazariy hamkori; gigroskopik asosiy oksid. Na → Na₂O → NaOH → tuzlar zanjirini tushuntiradi.' },
  k2o: { en: 'Basic potassium oxide forming KOH with water. Important plant nutrient element; compared with sodium analogs.', uz: 'Kaliyning asosiy oksidi, suv bilan KOH hosil qiladi. O\'simliklar uchun muhim; natriy analoglari bilan solishtiriladi.' },
  mgo: { en: 'White magnesia powder — antacid and refractory material. Classic demo: burning magnesium in oxygen.', uz: 'Oq magnesiya kukuni — antatsid va olovga chidamli material. Magniyning kisloroddagi yonishi namoyishi.' },
  cao: { en: 'Quicklime — slakes vigorously with water (slaking lime demo). Used in construction and gas drying.', uz: 'O\'chilmagan ohak — suv bilan kuchli reaksiya (ohak o\'chirish tajribasi). Qurilish va gaz quritishda qo\'llaniladi.' },
  bao: { en: 'Strong basic oxide; toxic barium compounds. School emphasis on Ba²⁺ qualitative test.', uz: 'Kuchli asosiy oksid; bariy birikmalari zaharli. Maktabda Ba²⁺ sifatli reaksiyasi muhim.' },
  sro: { en: 'Basic strontium oxide; gives red flame color in pyrotechnics. Compared with CaO and MgO.', uz: 'Stronsiyning asosiy oksidi; pirotexnikada qizil plama. CaO va MgO bilan solishtiriladi.' },
  al2o3: { en: 'Corundum in gems; amphoteric oxide used as abrasive and catalyst. Reacts with acids and alkalis.', uz: 'Qimmatbaho toshlarda korund; amfoter oksid, abraziv va katalizator. Kislota va ishlolar bilan reaksiyalaydi.' },
  feo: { en: 'Iron(II) oxide unstable in air; links to Fe²⁺ valency and oxidation of Fe(OH)₂.', uz: 'Temir(II) oksidi havoda beqaror; Fe²⁺ valentligi va Fe(OH)₂ oksidlanishi bilan bog\'liq.' },
  fe2o3: { en: 'Hematite and rust pigment; amphoteric oxide in metallurgy and paints.', uz: 'Gematit va zang pigmenti; metallurgiya va bo\'yovlarda amfoter oksid.' },
  fe3o4: { en: 'Magnetite — magnetic iron ore with mixed oxidation states. Discussed as FeO·Fe₂O₃.', uz: 'Magnitit — aralash oksidlanish darajali magnit temir ruda. FeO·Fe₂O₃ sifatida tushuntiriladi.' },
  cuo: { en: 'Black copper(II) oxide — oxidizer reduced by hydrogen or ammonia. Used in ceramics glazes.', uz: 'Qora mis(II) oksidi — vodorod yoki ammiak bilan qoplanadi. Keramika glazurlarida ishlatiladi.' },
  cu2o: { en: 'Red cuprite; semiconductor and pigment. Compared with CuO and Cu⁺ disproportionation.', uz: 'Qizil kuprit; yarimo\'tkazgich va pigment. CuO va Cu⁺ disproportsiyalanishi bilan solishtiriladi.' },
  zno: { en: 'White amphoteric oxide in ointments, rubber, and cosmetics. Made by burning zinc.', uz: 'Oq amfoter oksid — malham, rezina va kosmetikada. Rux yonishidan olinadi.' },
  ago: { en: 'Dark unstable silver(I) oxide decomposing to silver on heating. Links to Ag⁺ qualitative tests.', uz: 'Qorong\'i beqaror kumush(I) oksidi qizdirganda parchalanadi. Ag⁺ sifatli reaksiyalari bilan bog\'liq.' },
  pbo: { en: 'Lead(II) oxide — toxic amphoteric oxide used historically in glass; safety emphasized in school.', uz: 'Qo\'rg\'oshin(II) oksidi — zaharli amfoter oksid, tarixan shishada; maktabda xavfsizlik muhim.' },
  pbo2: { en: 'Strong oxidizer in lead-acid batteries and organic oxidations. Pb⁴⁺/Pb²⁺ redox pair.', uz: 'Qo\'rg\'oshin akkumulyatorlarida kuchli oksidlovchi. Pb⁴⁺/Pb²⁺ OKV jufti.' },
  mno2: { en: 'Black catalyst for H₂O₂ decomposition and dry cells. Classic oxygen foam demonstration.', uz: 'H₂O₂ parchalanish katalizatori va quruq elementlarda qora kukun. Klassik kislorod ko\'pigi namoyishi.' },
  cr2o3: { en: 'Stable green chrome oxide pigment. Amphoteric; linked to CrO₃ and chromium oxidation states.', uz: 'Barqaror yashil xrom oksidi pigmenti. Amfoter; CrO₃ va xrom oksidlanish darajalari bilan bog\'liq.' },
  cro3: { en: 'Red hygroscopic strong oxidizer forming chromic acid in water. Toxic — demos only with ventilation.', uz: 'Qizil gigroskopik kuchli oksidlovchi, suvda xrom kislotasini hosil qiladi. Zaharli — faqat shamollatishda.' },
  sno2: { en: 'Cassiterite ore; conductor and catalyst in electronics and enamels.', uz: 'Kassiterit ruda; elektronika va emallarda o\'tkazgich va katalizator.' },
  h2o2: { en: 'Antiseptic and bleach solution; decomposes to water and oxygen with catalysts. MnO₂ foam demo.', uz: 'Antiseptik va oqartiruvchi; katalizator bilan suv va kislorodga parchalanadi. MnO₂ ko\'pigi namoyishi.' },
  li2o2: { en: 'Lithium peroxide — oxygen source and CO₂ absorbent in special applications.', uz: 'Litiy peroksidi — maxsus ilovalarda kislorod manbai va CO₂ yutgich.' },
  na2o2: { en: 'Sodium peroxide reacts vigorously with water releasing oxygen. Bleaching and absorbent uses.', uz: 'Natriy peroksidi suv bilan kuchli reaksiya, kislorod ajratadi. Oqartirish va yutishda qo\'llaniladi.' },
  clo2: { en: 'Yellow-green strong oxidizer and water disinfectant. Explosive when concentrated — industrial handling only.', uz: 'Sariq-yashil kuchli oksidlovchi va suv dezinfektanti. Qalin konsentratda portlovchi — faqat sanoatda.' },
  hcl: { en: 'Strong mineral acid — full dissociation in dilute solution. Metal cleaning, salt synthesis, indicator demos.', uz: 'Kuchli mineral kislota — suyuq eritmada to\'liq dissotsiatsiya. Metall tozalash, tuz sintezi, indikator namoyishlari.' },
  hbr: { en: 'Strong acid similar to HCl; bromide ion in redox reactions. Compared in halogen activity series.', uz: 'HCl ga o\'xshash kuchli kislota; bromid ioni OKV reaksiyalarida. Galogenlar faolligi qatorida solishtiriladi.' },
  hi: { en: 'Very strong acid and reducing agent; iodide oxidized by concentrated oxidizers.', uz: 'Juda kuchli kislota va qoplovchi; yodid konsentrlangan oksidlovchilar bilan oksidlanadi.' },
  hf: { en: 'Weak but hazardous acid dissolving glass and silica. Etching and passivation — fume hood only.', uz: 'Sust lekin xavfli kislota — shisha va kremniy eritadi. Faqat chiqish shaffofida ishlash kerak.' },
  h2s: { en: 'Rotten-egg gas; weak dibasic acid and poison. Made from FeS and HCl; S²⁻ qualitative test.', uz: 'Chirigan tuxum hidi; sust ikki asosli kislota va zahar. FeS va HCl dan olinadi; S²⁻ sifatli reaksiya.' },
  h2so4: { en: 'King of mineral acids — dehydrating, oxidizing when concentrated. Batteries, fertilizers, school electrolyte studies.', uz: 'Mineral kislotalar qiroli — qurituvchi, konsentrlanganda oksidlovchi. Akkumulyatorlar, o\'g\'itlar, elektrolit darslari.' },
  h2so3: { en: 'Unstable acid in equilibrium with dissolved SO₂; food preservative topic. Linked to sulfurous gas.', uz: 'SO₂ bilan muvozanatdagi beqaror kislota; oziq-ovqat konservanti mavzusi. Oltingugurt dioksidi bilan bog\'liq.' },
  hno3: { en: 'Strong acid and oxidizer; passivates Al and Fe, dissolves copper with NO₂. Fertilizers and analytics — dilute only in class.', uz: 'Kuchli kislota va oksidlovchi; Al va Fe passivatsiya, mis NO₂ bilan eriydi. Faqat suyuq eritma maktabda.' },
  hno2: { en: 'Unstable weak acid oxidizing to nitric acid. Nitrite ion and nitrogen redox pairs.', uz: 'Beqaror sust kislota, azot kislotasiga oksidlanadi. Nitrit ioni va azot OKV juftlari.' },
  h3po4: { en: 'Triprotic acid — food additive and fertilizer component. Buffers and phosphates in biochemistry.', uz: 'Uch asosli kislota — oziq-ovqat qo\'shimchasi va o\'g\'it komponenti. Buferlar va fosfatlar biokimyoda.' },
  h3po3: { en: 'Phosphorous acid with reducing P(III) character. Compared with H₃PO₄.', uz: 'Fosforist kislota, qoplovchi P(III) xususiyatli. H₃PO₄ bilan solishtiriladi.' },
  h2co3: { en: 'Unstable acid from CO₂ and water; carbonated drinks and blood buffer. Lime water and limestone lessons.', uz: 'CO₂ va suvdan beqaror kislota; gazlangan ichimliklar va qon buferi. Ohak suvi va ohaktosh darslari.' },
  h2sio3: { en: 'Silicic acid gel from silicates and acid — growing stalactite demo with Na₂SiO₃ + HCl.', uz: 'Silikat va kislota reaksiyasida kremniy kislotasi geli — Na₂SiO₃ + HCl o\'suvchi muzlablar namoyishi.' },
  hclo4: { en: 'One of the strongest acids; concentrated solutions explosive with organics. Dilute use in analytics.', uz: 'Eng kuchli kislotalardan biri; konsentrat organika bilan portlovchi. Analitikada suyuq eritma.' },
  hclo3: { en: 'Strong acid; chlorates in matches and pyrotechnics. Linked to KClO₃ catalytic decomposition.', uz: 'Kuchli kislota; xloratlar g\'ishtak va pirotexnikada. KClO₃ katalitik parchalanishi bilan bog\'liq.' },
  hclo: { en: 'Weak unstable acid; hypochlorite bleaches and disinfects water. Chlorine oxidation state series.', uz: 'Sust beqaror kislota; gipoxlorit oqartiradi va suvni dezinfeksiya qiladi. Xlor oksidlanish qatori.' },
  hmno4: { en: 'Strong acid giving purple permanganate ion. Titrant and antiseptic KMnO₄ solutions.', uz: 'Binafsha permanganat ioni beradigan kuchli kislota. Titrlash va KMnO₄ antiseptik eritmalari.' },
  h2cro4: { en: 'Chromium(VI) solutions — strong oxidizer in chromic mixture for glass cleaning. Toxicity and ecology discussed.', uz: 'Xrom(VI) eritmalari — shisha tozalash xrom aralashmasida kuchli oksidlovchi. Toksiklik va ekologiya muhokama qilinadi.' },
  naoh: { en: 'Caustic soda — strong base dissolving fats and organic matter. Soap, paper industry; standard titrant in class.', uz: 'Kaustik soda — yog\' va organikani eritadigan kuchli asos. Sovun, qog\'oz; maktabda standart titrant.' },
  koh: { en: 'Caustic potash like NaOH but more hygroscopic. Liquid soap and CO₂ absorption.', uz: 'Kaustik potash — NaOH ga o\'xshash, lekin ko\'proq gigroskopik. Suyuq sovun va CO₂ yutish.' },
  lioh: { en: 'Strong base in lithium batteries and CO₂ scrubbers in space technology.', uz: 'Litiy batareyalari va kosmos texnikasida CO₂ yutgichlarda kuchli asos.' },
  csoh: { en: 'Among the strongest alkali metal hydroxides; illustrates basicity trend down the group.', uz: 'Sho\'rlilik metall gidroksidlari orasida eng kuchlilardan; guruhdan pastga asoslik o\'sishi.' },
  ba_oh_2: { en: 'Strong base with toxic Ba²⁺; drying gases and BaSO₄ qualitative precipitate test.', uz: 'Zaharli Ba²⁺ li kuchli asos; gaz quritish va BaSO₄ sifatli cho\'kma sinovi.' },
  ca_oh_2: { en: 'Slaked lime — whitewash, disinfection, phenolphthalein demo in limewater.', uz: 'O\'chirilgan ohak — oqash, dezinfeksiya, ohak suvida fenolftalein namoyishi.' },
  sr_oh_2: { en: 'Strong base giving red flame; compares alkaline earth hydroxides.', uz: 'Qizil plama beradigan kuchli asos; ishqoriy yer metall gidroksidlari bilan solishtiriladi.' },
  mg_oh_2: { en: 'Milk of magnesia — antacid and laxative; precipitated from Mg²⁺ and base.', uz: 'Magnesiya suvi — antatsid va suzishga qarshi; Mg²⁺ va asosdan cho\'kma.' },
  cu_oh_2: { en: 'Blue precipitate heating to black CuO; amphoteric dissolution in excess alkali. [Cu(NH₃)₄]²⁺ demo.', uz: 'Ko\'k cho\'kma qizdirganda qora CuO; ortiqcha ishloda amfoter erish. [Cu(NH₃)₄]²⁺ namoyishi.' },
  fe_oh_2: { en: 'Gray-green precipitate darkening in air — Fe²⁺ oxidation to Fe(OH)₃.', uz: 'Kulrang-yashil cho\'kma havoda qorayadi — Fe²⁺ dan Fe(OH)₃ ga oksidlanish.' },
  fe_oh_3: { en: 'Brown rust gel; sorbent and pigment. From Fe³⁺ and alkali; hydrolysis of iron salts.', uz: 'Jigarrang zang geli; sorbent va pigment. Fe³⁺ va ishlodan; temir tuzlari gidrolizi.' },
  al_oh_3: { en: 'White amphoteric hydroxide — antacid and water treatment coagulant. Central school example of amphoterism.', uz: 'Oq amfoter gidroksid — antatsid va suv tozalash koagulyanti. Maktabda amfoterlikning asosiy misoli.' },
  zn_oh_2: { en: 'White amphoteric precipitate dissolving in excess alkali as zincates.', uz: 'Oq amfoter cho\'kma ortiqcha ishloda sinkatlar sifatida eriydi.' },
  nh3_h2o: { en: 'Aqueous ammonia — weak base and complexing agent with sharp odor. Cleansers and Cu(OH)₂ dissolution demos.', uz: 'Suvli ammiak — sust asos va kompleks hosil qiluvchi, keskin hid. Tozalovchilar va Cu(OH)₂ eritish namoyishlari.' },
  salt_nh4_3_po4: {
    en: 'Ammonium phosphate — fertilizer and buffer salt with NH₄⁺ and PO₄³⁻ in 3:1 ratio. Linked to phosphorus nutrition and complex salt stoichiometry.',
    uz: 'Ammoniy fosfati — NH₄⁺ va PO₄³⁻ 3:1 nisbatidagi o\'g\'it va bufer tuzi. Fosfor oziqlanishi va murakkab tuz stehiometriyasi bilan bog\'liq.',
  },
  salt_nahco3: {
    en: 'Sodium bicarbonate — baking soda, antacid, and CO₂ source with acids. Classic volcano demo.',
    uz: 'Natriy gidrokarbonati — pishirish sodasi, antatsid va kislotalar bilan CO₂ manbai. Vulkan namoyishi.',
  },
  salt_khco3: {
    en: 'Potassium bicarbonate — similar to NaHCO₃, used in food and fire extinguishers.',
    uz: 'Kaliy gidrokarbonati — NaHCO₃ ga o\'xshash, oziq-ovqat va o\'t o\'chirgichlarda.',
  },
  salt_ca_hco3_2: {
    en: 'Calcium bicarbonate — temporary water hardness, decomposes on heating to carbonate and CO₂.',
    uz: 'Kalsiy gidrokarbonati — vaqtinchalik suv qattiqligi, qizdirganda karbonat va CO₂ ga parchalanadi.',
  },
  salt_k2cr2o7: {
    en: 'Orange-red crystals of strong chromium(VI) oxidizer. Organic oxidations and leather tanning; store away from reducers.',
    uz: 'To\'q sariq-qizil xrom(VI) kuchli oksidlovchi kristallari. Organik oksidlanish va charm ishlov; qoplovchilardan alohida saqlang.',
  },
}

function saltAnKeyFromId(id: string): string | null {
  const m = id.match(/^salt_[^_]+_(.+)$/)
  return m ? m[1]! : null
}

export function resolveCompoundDescription(
  id: string,
  category: CompoundCategory,
  locale: AppLocale,
  fallback: (formula: string, categoryLabel: string) => string,
  formula: string,
  categoryLabel: string,
): string {
  if (locale === 'ru') return ''
  const loc: Loc = locale === 'en' ? 'en' : 'uz'

  const manual = MANUAL_DESC[id]
  if (manual) return manual[loc]

  if (category === 'salt' && id.startsWith('salt_')) {
    const anKey = saltAnKeyFromId(id)
    const title = resolveCompoundName(id, locale) ?? formula
    if (anKey) return saltDesc(id, title, anKey, loc)
  }

  return fallback(formula, categoryLabel)
}
