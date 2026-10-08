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
  salt_mg_cl: {
    en: 'Magnesium chloride MgCl₂ is a white ionic salt (Mg²⁺ and Cl⁻ ions) that dissolves well in water; its solution is an electrolyte. It occurs in seawater; metallic magnesium is made by electrolysis of molten MgCl₂. It forms when magnesium burns in chlorine: Mg + Cl₂ → MgCl₂.',
    uz: 'Magniy xlorid MgCl₂ — oq ionli tuz (Mg²⁺ va Cl⁻ ionlari), suvda yaxshi eriydi; eritmasi elektrolit. Dengiz suvida uchraydi; suyuqlantirilgan MgCl₂ ni elektroliz qilib metall magniy olinadi. Magniy xlorda yonganda hosil boʻladi: Mg + Cl₂ → MgCl₂.',
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
    uz: 'Is gazi — to\'liq bo\'lmagan yonishdan hosil bo\'ladigan hidsiz zaharli gaz. Gemoglobinga kisloroddan kuchliroq bog\'lanadi — yomon shamollatishda xavfli. Darslarda CO₂ bilan solishtiriladi.',
  },
  so2: {
    en: 'Colourless gas with the pungent smell of a burning match; dissolves in water forming acidic solution. Used industrially for sulfuric acid; food preservative in trace amounts. School demos cover solubility and redox of sulfur.',
    uz: 'Yonayotgan gugurt hidiga oʻxshash keskin hidli rangsiz gaz, suvda erib kislota muhit hosil qiladi. Sanoatda oltingugurt kislotasi uchun; oz miqdorda konservant. Maktabda eruvchanlik va oltingugurt OKV jarayonlari ko\'rsatiladi.',
  },
  so3: {
    en: 'Strong acidic oxide; reacts vigorously with water to form sulfuric acid. Key step in the contact process. Handled with extreme care in the lab.',
    uz: 'Kuchli kislota oksidi; suv bilan issiqlik ajratib oltingugurt kislotasini hosil qiladi. Kontakt jarayonining asosiy bosqichi. Laboratoriyada juda ehtiyotkorlik bilan ishlatiladi.',
  },
  no: {
    en: 'Colourless non-salt-forming gas; in air it is quickly oxidized to brown NO₂ (2NO + O₂ → 2NO₂). Role in nitric acid synthesis and nitrogen redox series NO → NO₂ → HNO₃.',
    uz: 'Rangsiz, tuz hosil qilmaydigan gaz; havoda tez qoʻngʻir NO₂ gacha oksidlanadi (2NO + O₂ → 2NO₂). Azot kislotasi sintezi va NO → NO₂ → HNO₃ zanjirida muhim.',
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
  sro: { en: 'Basic strontium oxide; gives red flame color in pyrotechnics. Compared with CaO and MgO.', uz: 'Stronsiyning asosiy oksidi; pirotexnikada qizil alanga. CaO va MgO bilan solishtiriladi.' },
  al2o3: { en: 'Corundum in gems; amphoteric oxide used as abrasive and catalyst. Reacts with acids and alkalis.', uz: 'Qimmatbaho toshlarda korund; amfoter oksid, abraziv va katalizator. Kislota va ishqorlar bilan reaksiyaga kirishadi.' },
  feo: { en: 'Iron(II) oxide unstable in air; links to Fe²⁺ valency and oxidation of Fe(OH)₂.', uz: 'Temir(II) oksidi havoda beqaror; Fe²⁺ valentligi va Fe(OH)₂ oksidlanishi bilan bog\'liq.' },
  fe2o3: { en: 'Hematite and rust pigment; basic (weakly amphoteric) oxide used in metallurgy and paints.', uz: 'Gematit va zang pigmenti; metallurgiya va bo\'yovlarda amfoter oksid.' },
  fe3o4: { en: 'Magnetite — magnetic iron ore with mixed oxidation states. Discussed as FeO·Fe₂O₃.', uz: 'Magnitit — aralash oksidlanish darajali magnit temir ruda. FeO·Fe₂O₃ sifatida tushuntiriladi.' },
  cuo: { en: 'Black copper(II) oxide — oxidizer reduced by hydrogen or ammonia. Used in ceramics glazes.', uz: 'Qora mis(II) oksidi — vodorod yoki ammiak bilan qaytariladi. Keramika glazurlarida ishlatiladi.' },
  cu2o: { en: 'Red cuprite; semiconductor and pigment. Compared with CuO and Cu⁺ disproportionation.', uz: 'Qizil kuprit; yarimo\'tkazgich va pigment. CuO va Cu⁺ disproportsiyalanishi bilan solishtiriladi.' },
  zno: { en: 'White amphoteric oxide in ointments, rubber, and cosmetics. Made by burning zinc.', uz: 'Oq amfoter oksid — malham, rezina va kosmetikada. Rux yonishidan olinadi.' },
  ago: { en: 'Dark brown unstable silver oxide Ag₂O that decomposing to silver on heating. Links to Ag⁺ qualitative tests.', uz: 'Qorong\'i beqaror kumush(I) oksidi qizdirganda parchalanadi. Ag⁺ sifatli reaksiyalari bilan bog\'liq.' },
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
  hi: { en: 'Very strong acid and reducing agent; iodide oxidized by concentrated oxidizers.', uz: 'Juda kuchli kislota va qaytaruvchi; yodid konsentrlangan oksidlovchilar bilan oksidlanadi.' },
  hf: { en: 'Weak but hazardous acid dissolving glass and silica. Etching and passivation — fume hood only.', uz: 'Sust lekin xavfli kislota — shisha va kremniy eritadi. Faqat tortma shkafda ishlanadi.' },
  h2s: { en: 'Rotten-egg gas; weak dibasic acid and poison. Made from FeS and HCl; S²⁻ qualitative test.', uz: 'Chirigan tuxum hidi; sust ikki asosli kislota va zahar. FeS va HCl dan olinadi; S²⁻ sifatli reaksiya.' },
  h2so4: { en: 'King of mineral acids — dehydrating, oxidizing when concentrated. Batteries, fertilizers, school electrolyte studies.', uz: 'Mineral kislotalar qiroli — qurituvchi, konsentrlanganda oksidlovchi. Akkumulyatorlar, o\'g\'itlar, elektrolit darslari.' },
  h2so3: { en: 'Unstable acid in equilibrium with dissolved SO₂; food preservative topic. Linked to sulfurous gas.', uz: 'SO₂ bilan muvozanatdagi beqaror kislota; oziq-ovqat konservanti mavzusi. Oltingugurt dioksidi bilan bog\'liq.' },
  hno3: { en: 'Strong acid and oxidizer; passivates Al and Fe, dissolves copper with NO₂. Fertilizers and analytics — dilute only in class.', uz: 'Kuchli kislota va oksidlovchi; Al va Fe passivatsiya, mis NO₂ bilan eriydi. Maktabda faqat suyultirilgan eritma.' },
  hno2: { en: 'Unstable weak acid oxidizing to nitric acid. Nitrite ion and nitrogen redox pairs.', uz: 'Beqaror sust kislota, azot kislotasiga oksidlanadi. Nitrit ioni va azot OKV juftlari.' },
  h3po4: { en: 'Triprotic acid — food additive and fertilizer component. Buffers and phosphates in biochemistry.', uz: 'Uch asosli kislota — oziq-ovqat qo\'shimchasi va o\'g\'it komponenti. Buferlar va fosfatlar biokimyoda.' },
  h3po3: { en: 'Phosphorous acid with reducing P(III) character. Compared with H₃PO₄.', uz: 'Fosfit kislota, qaytaruvchi P(III) xususiyatli. H₃PO₄ bilan solishtiriladi.' },
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
  sr_oh_2: { en: 'Strong base giving red flame; compares alkaline earth hydroxides.', uz: 'Qizil alanga beradigan kuchli asos; ishqoriy yer metall gidroksidlari bilan solishtiriladi.' },
  mg_oh_2: { en: 'Milk of magnesia — antacid and laxative; precipitated from Mg²⁺ and base.', uz: 'Magnesiya suvi — antatsid va surgi; Mg²⁺ va asosdan cho\'kma.' },
  cu_oh_2: { en: 'Blue precipitate heating to black CuO; amphoteric dissolution in excess alkali. [Cu(NH₃)₄]²⁺ demo.', uz: 'Ko\'k cho\'kma qizdirganda qora CuO; ortiqcha ishqorda amfoter erish. [Cu(NH₃)₄]²⁺ namoyishi.' },
  fe_oh_2: { en: 'Gray-green precipitate darkening in air — Fe²⁺ oxidation to Fe(OH)₃.', uz: 'Kulrang-yashil cho\'kma havoda qorayadi — Fe²⁺ dan Fe(OH)₃ ga oksidlanish.' },
  fe_oh_3: { en: 'Brown rust gel; sorbent and pigment. From Fe³⁺ and alkali; hydrolysis of iron salts.', uz: 'Jigarrang zang geli; sorbent va pigment. Fe³⁺ va ishqordan; temir tuzlari gidrolizi.' },
  al_oh_3: { en: 'White amphoteric hydroxide — antacid and water treatment coagulant. Central school example of amphoterism.', uz: 'Oq amfoter gidroksid — antatsid va suv tozalash koagulyanti. Maktabda amfoterlikning asosiy misoli.' },
  zn_oh_2: { en: 'White amphoteric precipitate dissolving in excess alkali as zincates.', uz: 'Oq amfoter cho\'kma ortiqcha ishqorda sinkatlar sifatida eriydi.' },
  nh3_h2o: { en: 'Aqueous ammonia — weak base and complexing agent with sharp odor. Cleansers and Cu(OH)₂ dissolution demos.', uz: 'Suvli ammiak — sust asos va kompleks hosil qiluvchi, keskin hid. Tozalovchilar va Cu(OH)₂ eritish namoyishlari.' },
  // Простые вещества, аммиак и вещества учебников из каталога 200 (раньше — общий fallback по классу).
  tb_h2: { en: 'Hydrogen — the lightest gas; diatomic molecules with a non-polar covalent bond. Burns to water and reduces metals from their oxides.', uz: 'Vodorod — eng yengil gaz; qutbsiz kovalent bog\'li ikki atomli molekulalar. Yonib suv hosil qiladi, metallarni oksidlaridan qaytaradi.' },
  tb_o2: { en: 'Oxygen — colourless, odourless gas that supports combustion and respiration. In the lab it is made by decomposing KMnO₄, H₂O₂ or KClO₃ and collected over water.', uz: 'Kislorod — rangsiz, hidsiz gaz, yonish va nafas olishni ta\'minlaydi. Laboratoriyada KMnO₄, H₂O₂ yoki KClO₃ parchalanishidan olinadi.' },
  tb_o3: { en: 'Ozone — an allotrope of oxygen, a pungent gas and strong oxidizer. The ozone layer absorbs the Sun\'s ultraviolet radiation.', uz: 'Ozon — kislorodning allotropik shakli, o\'tkir hidli gaz va kuchli oksidlovchi. Ozon qatlami Quyoshning ultrabinafsha nurlarini ushlab qoladi.' },
  tb_n2: { en: 'Nitrogen — the main component of air (78 % by volume). The N≡N triple bond is very strong, so nitrogen is inert under ordinary conditions.', uz: 'Azot — havoning asosiy tarkibiy qismi (hajm bo\'yicha 78 %). N≡N uch bog\' juda mustahkam, shuning uchun azot oddiy sharoitda kam faol.' },
  tb_f2: { en: 'Fluorine — pale yellow toxic gas, the strongest oxidizer among simple substances; in compounds it is always −1.', uz: 'Ftor — och sariq zaharli gaz, oddiy moddalar ichida eng kuchli oksidlovchi; birikmalarda doimo −1.' },
  tb_cl2: { en: 'Chlorine — yellow-green toxic gas with a sharp smell; reacts with metals and hydrogen. Used to disinfect water; made in the lab from MnO₂ and HCl.', uz: 'Xlor — sariq-yashil, o\'tkir hidli zaharli gaz; metallar va vodorod bilan reaksiyaga kirishadi. Suvni zararsizlantirishda ishlatiladi; laboratoriyada MnO₂ va HCl dan olinadi.' },
  tb_br2: { en: 'Bromine — heavy red-brown liquid with a sharp smell, the only liquid non-metal at room temperature. Bromine water is decolourized by unsaturated compounds.', uz: 'Brom — og\'ir, qizg\'ish-qo\'ng\'ir, o\'tkir hidli suyuqlik, oddiy sharoitda yagona suyuq metallmas. Brom suvi to\'yinmagan birikmalar bilan rangsizlanadi.' },
  tb_i2: { en: 'Iodine — dark violet crystals that sublime on heating. Alcohol solution is an antiseptic; with starch it gives a blue colour.', uz: 'Yod — to\'q binafsha kristallar, qizdirilganda sublimatlanadi. Spirtli eritmasi antiseptik; kraxmal bilan ko\'k rang beradi.' },
  tb_s8: { en: 'Rhombic sulfur — yellow crystals built of ring S₈ molecules, the stable allotrope at room temperature. Burns with a blue flame to SO₂.', uz: 'Rombik oltingugurt — halqasimon S₈ molekulalaridan tuzilgan sariq kristallar, oddiy sharoitda barqaror allotropik shakl. Ko\'k alanga bilan yonib SO₂ beradi.' },
  tb_p4: { en: 'White phosphorus — tetrahedral P₄ molecules; poisonous, glows in the dark and ignites in air, so it is stored under water.', uz: 'Oq fosfor — tetraedrik P₄ molekulalari; zaharli, qorong\'ida shu\'lalanadi va havoda o\'z-o\'zidan yonadi, shuning uchun suv ostida saqlanadi.' },
  nh3: { en: 'Ammonia — colourless gas with a sharp smell, a weak base in water (NH₃·H₂O). Made in the lab from NH₄Cl and Ca(OH)₂, in industry by the Haber process; used for fertilizers and nitric acid.', uz: 'Ammiak — o\'tkir hidli rangsiz gaz, suvda kuchsiz asos (NH₃·H₂O). Laboratoriyada NH₄Cl va Ca(OH)₂ dan, sanoatda Gaber usulida olinadi; o\'g\'itlar va nitrat kislota uchun ishlatiladi.' },
  fes2: { en: 'Pyrite ("fool\'s gold") — yellow mineral FeS₂ with the disulfide ion S₂²⁻; roasting it (4FeS₂ + 11O₂ → 2Fe₂O₃ + 8SO₂) is the first step of sulfuric acid production.', uz: 'Pirit («ahmoqlar oltini») — S₂²⁻ disulfid ionli sariq mineral FeS₂; uni kuydirish (4FeS₂ + 11O₂ → 2Fe₂O₃ + 8SO₂) sulfat kislota ishlab chiqarishning birinchi bosqichi.' },
  tb_cuso4_5h2o: { en: 'Blue vitriol — blue crystals of the pentahydrate; on heating it loses water and turns white, and the white powder turns blue again with water (a test for water).', uz: 'Mis kuporosi — pentagidratning ko\'k kristallari; qizdirilganda suvini yo\'qotib oqaradi, oq kukun esa suv bilan yana ko\'karadi (suvga sifat reaksiyasi).' },
  tb_ca3po42: { en: 'Calcium phosphate — white insoluble solid, the basis of phosphorite, apatite and bone; raw material for phosphorus, phosphoric acid and superphosphate.', uz: 'Kalsiy fosfati — oq, erimaydigan modda, fosforit, apatit va suyak asosi; fosfor, fosfat kislota va superfosfat uchun xom ashyo.' },
  tb_cac2: { en: 'Calcium carbide — grey solid; with water it gives acetylene (CaC₂ + 2H₂O → Ca(OH)₂ + C₂H₂↑). Made from lime and coke in an electric furnace.', uz: 'Kalsiy karbidi — kulrang qattiq modda; suv bilan asetilen beradi (CaC₂ + 2H₂O → Ca(OH)₂ + C₂H₂↑). Elektr pechda ohak va koksdan olinadi.' },
  tb_cah2: { en: 'Calcium hydride — white ionic solid (H⁻); reacts vigorously with water releasing hydrogen — a portable hydrogen source.', uz: 'Kalsiy gidridi — oq ionli modda (H⁻); suv bilan shiddatli reaksiyaga kirishib vodorod ajratadi — ko\'chma vodorod manbai.' },
  tb_hgo: { en: 'Mercury(II) oxide — red (or yellow) powder; on heating it decomposes into mercury and oxygen (2HgO → 2Hg + O₂) — Priestley\'s discovery of oxygen. Toxic.', uz: 'Simob(II) oksidi — qizil (yoki sariq) kukun; qizdirilganda simob va kislorodga parchalanadi (2HgO → 2Hg + O₂) — Pristli kislorodni shunday kashf etgan. Zaharli.' },
  tb_cuoh2co3: { en: 'Malachite — green mineral, a basic copper(II) salt; on heating it decomposes into black CuO, water and CO₂. The green patina on copper is the same salt.', uz: 'Malaxit — yashil mineral, mis(II)ning asosli tuzi; qizdirilganda qora CuO, suv va CO₂ ga parchalanadi. Misdagi yashil qatlam (patina) ham shu tuz.' },
  tb_ag3po4: { en: 'Silver phosphate — yellow precipitate (3AgNO₃ + Na₃PO₄ → Ag₃PO₄↓ + 3NaNO₃), the qualitative test for the phosphate ion; dissolves in nitric acid.', uz: 'Kumush fosfati — sariq cho\'kma (3AgNO₃ + Na₃PO₄ → Ag₃PO₄↓ + 3NaNO₃), fosfat ioniga sifat reaksiyasi; nitrat kislotada eriydi.' },
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
    uz: 'To\'q sariq-qizil xrom(VI) kuchli oksidlovchi kristallari. Organik oksidlanish va charm ishlov; qaytaruvchilardan alohida saqlang.',
  },
  // Вещества учебников из каталога 200, у которых EN/UZ было общим fallback по классу (аудит g1, 08.10).
  // Перевод по смыслу descriptionRu (compounds.ts / catalogCardOverrides200.ts), без новых фактов; UZ — латиница, o‘/g‘.
  tb_al4c3: {
    en: 'Aluminum carbide — yellow crystals; with water it releases methane (Al₄C₃ + 12H₂O → 4Al(OH)₃ + 3CH₄↑), a laboratory way to make methane. Made from Al₂O₃ and carbon in an electric furnace.',
    uz: 'Alyuminiy karbidi — sariq kristallar; suv bilan metan ajratadi (Al₄C₃ + 12H₂O → 4Al(OH)₃ + 3CH₄↑) — metanni laboratoriyada olish usuli. Elektr pechda Al₂O₃ va ko‘mirdan olinadi.',
  },
  tb_aucl3: {
    en: 'Gold(III) chloride — red-brown crystals formed when gold dissolves in aqua regia (a mixture of HNO₃ and HCl); neither of these acids dissolves gold on its own.',
    uz: 'Oltin(III) xloridi — qizg‘ish-qo‘ng‘ir kristallar; oltin «shoh arog‘i»da (HNO₃ va HCl aralashmasi) eriganda hosil bo‘ladi, bu kislotalarning har biri alohida oltinni eritmaydi.',
  },
  tb_bao2: {
    en: 'Barium peroxide — white powder with the peroxide anion O₂²⁻; formed when BaO is heated in air (~500 °C). With dilute sulfuric acid it gives hydrogen peroxide: BaO₂ + H₂SO₄ → BaSO₄↓ + H₂O₂.',
    uz: 'Bariy peroksidi — oq kukun (O₂²⁻ anioni); BaO havoda ~500 °C da qizdirilganda hosil bo‘ladi. Suyultirilgan sulfat kislota bilan vodorod peroksid beradi: BaO₂ + H₂SO₄ → BaSO₄↓ + H₂O₂.',
  },
  tb_beo: {
    en: 'Beryllium oxide — white refractory powder, an amphoteric oxide like ZnO and Al₂O₃; it does not react with water. Beryllium compounds are poisonous.',
    uz: 'Berilliy oksidi — oq, qiyin suyuqlanadigan kukun, ZnO va Al₂O₃ kabi amfoter oksid; suv bilan reaksiyaga kirishmaydi. Berilliy birikmalari zaharli.',
  },
  tb_ca3p2: {
    en: 'Calcium phosphide — red-brown solid; with water it releases poisonous, spontaneously flammable phosphine: Ca₃P₂ + 6H₂O → 3Ca(OH)₂ + 2PH₃↑.',
    uz: 'Kalsiy fosfidi — qizg‘ish-qo‘ng‘ir modda; suv bilan zaharli, o‘z-o‘zidan alangalanadigan fosfin ajratadi: Ca₃P₂ + 6H₂O → 3Ca(OH)₂ + 2PH₃↑.',
  },
  tb_cah2po42: {
    en: 'Calcium dihydrogen phosphate — a soluble acid salt, the active ingredient of superphosphate: simple superphosphate is a mixture of Ca(H₂PO₄)₂ with CaSO₄, double superphosphate is pure Ca(H₂PO₄)₂.',
    uz: 'Kalsiy digidrofosfati — eriydigan nordon tuz, superfosfatning asosiy moddasi: oddiy superfosfat — Ca(H₂PO₄)₂ va CaSO₄ aralashmasi, qo‘sh superfosfat — sof Ca(H₂PO₄)₂.',
  },
  tb_cahpo4: {
    en: 'Calcium hydrogen phosphate (precipitate) — a white, sparingly soluble acid salt used as a phosphorus fertilizer; made by neutralizing phosphoric acid with milk of lime in a 1 : 1 ratio.',
    uz: 'Kalsiy gidrofosfati (pretsipitat) — oq, kam eriydigan nordon tuz, fosforli o‘g‘it; fosfat kislotani ohak suti bilan 1 : 1 nisbatda neytrallab olinadi.',
  },
  tb_caocl2: {
    en: 'Bleaching powder — white powder smelling of chlorine, a mixed salt (Ca²⁺ cation, Cl⁻ and ClO⁻ anions); a strong oxidizer used for disinfection and bleaching. Made by passing chlorine through slaked lime.',
    uz: 'Xlorli ohak — xlor hidli oq kukun, aralash tuz (Ca²⁺ kationi, Cl⁻ va ClO⁻ anionlari); kuchli oksidlovchi — dezinfeksiya va oqartirishda ishlatiladi. O‘chirilgan ohak orqali xlor o‘tkazib olinadi.',
  },
  tb_caso4_2h2o: {
    en: 'Gypsum — white mineral, the crystal hydrate of calcium sulfate; heated to 150–180 °C it turns into plaster of Paris (CaSO₄)₂·H₂O, which sets back into gypsum when mixed with water.',
    uz: 'Gips — oq mineral, kalsiy sulfatining kristallogidrati; 150–180 °C gacha qizdirilganda alebastrga (CaSO₄)₂·H₂O aylanadi, alebastr suv bilan qorilganda yana gipsga aylanib qotadi.',
  },
  tb_cl2o7: {
    en: 'Chlorine(VII) oxide — colourless oily liquid, the anhydride of perchloric acid (Cl₂O₇ + H₂O → 2HClO₄); explosive. It is the higher oxide of chlorine, with chlorine in the +7 oxidation state.',
    uz: 'Xlor(VII) oksidi — rangsiz moysimon suyuqlik, perxlorat kislotaning angidridi (Cl₂O₇ + H₂O → 2HClO₄); portlovchi. Xlorning yuqori oksidi — xlorning oksidlanish darajasi +7.',
  },
  tb_crcl2: {
    en: 'Chromium(II) chloride — colourless crystals giving a blue solution; a strong reducing agent that is quickly oxidized in air to chromium(III) compounds.',
    uz: 'Xrom(II) xloridi — rangsiz kristallar, eritmasi ko‘k; kuchli qaytaruvchi, havoda tezda Cr³⁺ birikmalarigacha oksidlanadi.',
  },
  tb_cro: {
    en: 'Chromium(II) oxide — black powder, a basic oxide; a strong reducing agent that is oxidized in air to Cr₂O₃.',
    uz: 'Xrom(II) oksidi — qora kukun, asosli oksid; kuchli qaytaruvchi, havoda Cr₂O₃ gacha oksidlanadi.',
  },
  tb_croh2: {
    en: 'Chromium(II) hydroxide — yellow precipitate, a typical base; it is quickly oxidized by atmospheric oxygen to grey-green Cr(OH)₃.',
    uz: 'Xrom(II) gidroksidi — sariq cho‘kma, tipik asos; havo kislorodi ta’sirida tezda kulrang-yashil Cr(OH)₃ gacha oksidlanadi.',
  },
  tb_croh3: {
    en: 'Chromium(III) hydroxide — grey-green gelatinous precipitate; amphoteric: it dissolves both in acids and in alkalis.',
    uz: 'Xrom(III) gidroksidi — kulrang-yashil iviqsimon cho‘kma; amfoter: kislotalarda ham, ishqorlarda ham eriydi.',
  },
  tb_cs2: {
    en: 'Carbon disulfide — colourless, volatile, poisonous liquid, a solvent for sulfur, fats and rubber; made by passing sulfur vapour over red-hot coal at 900–1000 °C. Linear S=C=S molecule.',
    uz: 'Uglerod disulfidi — rangsiz, uchuvchan, zaharli suyuqlik; oltingugurt, yog‘ va kauchukni eritadi. Oltingugurt bug‘ini 900–1000 °C da cho‘g‘langan ko‘mir ustidan o‘tkazib olinadi; molekulasi chiziqli S=C=S.',
  },
  tb_cu2s: {
    en: 'Copper(I) sulfide — chalcocite (copper glance), a grey-black mineral and an important copper ore; formed when copper burns in sulfur vapour: 2Cu + S → Cu₂S.',
    uz: 'Mis(I) sulfidi — xalkozin (mis yaltirog‘i), kulrang-qora mineral, muhim mis rudasi; mis oltingugurt bug‘ida yonganda hosil bo‘ladi: 2Cu + S → Cu₂S.',
  },
  tb_feso4_7h2o: {
    en: 'Green vitriol — greenish crystals of iron(II) sulfate heptahydrate; it turns brown in air as Fe²⁺ is oxidized to Fe³⁺. Used against plant pests and to control moss.',
    uz: 'Temir kuporosi — temir(II) sulfat kristallogidratining yashilroq kristallari; havoda Fe²⁺ ning Fe³⁺ gacha oksidlanishi tufayli qo‘ng‘ir tusga kiradi. O‘simlik zararkunandalari va moxga qarshi ishlatiladi.',
  },
  tb_h4p2o7: {
    en: 'Pyrophosphoric (diphosphoric) acid — colourless glassy substance formed by heating orthophosphoric acid: 2H₃PO₄ → H₄P₂O₇ + H₂O. It is a tetrabasic acid.',
    uz: 'Pirofosfat (difosfat) kislota — rangsiz shishasimon modda; ortofosfat kislota qizdirilganda hosil bo‘ladi: 2H₃PO₄ → H₄P₂O₇ + H₂O. To‘rt asosli kislota.',
  },
  tb_hpo3: {
    en: 'Metaphosphoric acid — glassy mass (HPO₃)ₙ formed when P₂O₅ reacts with cold water; on boiling the solution it turns into orthophosphoric acid H₃PO₄.',
    uz: 'Metafosfat kislota — shishasimon massa (HPO₃)ₙ; P₂O₅ sovuq suv bilan reaksiyaga kirishganda hosil bo‘ladi, eritma qaynatilganda ortofosfat kislota H₃PO₄ ga aylanadi.',
  },
  tb_k2mno4: {
    en: 'Potassium manganate — dark green crystals (manganese +6) formed when permanganate decomposes: 2KMnO₄ → K₂MnO₄ + MnO₂ + O₂↑. In water the green manganate turns into purple permanganate and brown MnO₂.',
    uz: 'Kaliy manganati — to‘q yashil kristallar (marganets +6); permanganat parchalanganda hosil bo‘ladi: 2KMnO₄ → K₂MnO₄ + MnO₂ + O₂↑. Suvda yashil manganat binafsha permanganat va qo‘ng‘ir MnO₂ ga aylanadi.',
  },
  tb_k2o2: {
    en: 'Potassium peroxide — yellow solid (oxygen −1), formed together with the superoxide KO₂ when potassium burns. With water it releases oxygen and forms KOH.',
    uz: 'Kaliy peroksidi — sariq modda (kislorod −1); kaliy yonganda KO₂ nadperoksidi bilan birga hosil bo‘ladi. Suv bilan kislorod ajratadi va KOH hosil qiladi.',
  },
  tb_kcl_mgcl2_6h2o: {
    en: 'Carnallite — a natural mineral, the double salt crystal hydrate KCl·MgCl₂·6H₂O; raw material for magnesium (by electrolysis of the melt) and for potash fertilizers.',
    uz: 'Karnallit — tabiiy mineral, KCl·MgCl₂·6H₂O qo‘sh tuz-kristallogidrati; magniy (suyuqlanmani elektroliz qilib) va kaliyli o‘g‘itlar olish uchun xom ashyo.',
  },
  tb_kcl_mgso4_3h2o: {
    en: 'Kainite — a natural mineral, the double salt KCl·MgSO₄·3H₂O, used as a potassium–magnesium fertilizer.',
    uz: 'Kainit — tabiiy mineral, KCl·MgSO₄·3H₂O qo‘sh tuzi; kaliy-magniyli o‘g‘it sifatida ishlatiladi.',
  },
  tb_kcl_nacl: {
    en: 'Sylvinite — a natural intergrowth of KCl and NaCl crystals (two lattices, not one compound) and the main potassium ore; KCl for fertilizers is extracted from it.',
    uz: 'Silvinit — KCl va NaCl kristallarining tabiiy qo‘shilmasi (bitta birikma emas, ikki panjara), asosiy kaliy rudasi; undan o‘g‘itlar uchun KCl ajratib olinadi.',
  },
  tb_kclo: {
    en: 'Potassium hypochlorite — salt of hypochlorous acid (chlorine +1) that exists in solution (“Javel water”); a strong oxidizer and bleach. Formed when chlorine is passed into a cold KOH solution.',
    uz: 'Kaliy gipoxloriti — gipoxlorit kislota tuzi (xlor +1), eritmada mavjud («javel suvi»); kuchli oksidlovchi va oqartiruvchi. Sovuq KOH eritmasiga xlor o‘tkazilganda hosil bo‘ladi.',
  },
  tb_kh: {
    en: 'Potassium hydride — an ionic hydride K⁺H⁻ formed when potassium is heated in hydrogen; it reacts violently with water, releasing hydrogen.',
    uz: 'Kaliy gidridi — K⁺H⁻ ionli gidrid; kaliy vodorodda qizdirilganda hosil bo‘ladi, suv bilan shiddatli reaksiyaga kirishib vodorod ajratadi.',
  },
  tb_ko2: {
    en: 'Potassium superoxide — orange-yellow solid (O₂⁻ anion, oxygen −½) formed when potassium burns: K + O₂ → KO₂. It absorbs CO₂ and releases oxygen, regenerating air in gas masks.',
    uz: 'Kaliy nadperoksidi — to‘q sariq-sariq modda (O₂⁻ anioni, kislorod −½); kaliy yonganda hosil bo‘ladi: K + O₂ → KO₂. CO₂ ni yutib kislorod ajratadi — gazniqoblarda havoni qayta tiklash uchun.',
  },
  tb_mg3po42: {
    en: 'Magnesium phosphate — white insoluble precipitate obtained by exchange in solution: 3MgSO₄ + 2Na₃PO₄ → Mg₃(PO₄)₂↓ + 3Na₂SO₄. It is part of bone tissue.',
    uz: 'Magniy fosfati — oq, erimaydigan cho‘kma; eritmada almashinish reaksiyasi bilan olinadi: 3MgSO₄ + 2Na₃PO₄ → Mg₃(PO₄)₂↓ + 3Na₂SO₄. Suyak to‘qimasi tarkibiga kiradi.',
  },
  tb_mn2o3: {
    en: 'Manganese(III) oxide — brown-black powder formed when MnO₂ is calcined: 4MnO₂ → 2Mn₂O₃ + O₂↑. A basic oxide.',
    uz: 'Marganets(III) oksidi — qo‘ng‘ir-qora kukun; MnO₂ qattiq qizdirilganda hosil bo‘ladi: 4MnO₂ → 2Mn₂O₃ + O₂↑. Asosli oksid.',
  },
  tb_mn2o7: {
    en: 'Manganese(VII) oxide — greenish-brown oily liquid, the anhydride of permanganic acid HMnO₄; an extremely strong oxidizer that explodes on heating. Formed by the action of concentrated H₂SO₄ on KMnO₄.',
    uz: 'Marganets(VII) oksidi — yashilroq-qo‘ng‘ir moysimon suyuqlik, permanganat kislota HMnO₄ angidridi; juda kuchli oksidlovchi, qizdirilganda portlaydi. Konsentrlangan H₂SO₄ ning KMnO₄ ga ta’siridan hosil bo‘ladi.',
  },
  tb_mn3o4: {
    en: 'Manganese(II,III) oxide — brown-black mixed oxide MnO·Mn₂O₃ (the mineral hausmannite), formed by strong calcination of MnO₂.',
    uz: 'Marganets(II,III) oksidi — qo‘ng‘ir-qora aralash oksid MnO·Mn₂O₃ (gausmanit minerali); MnO₂ kuchli qizdirilganda hosil bo‘ladi.',
  },
  tb_mno: {
    en: 'Manganese(II) oxide — green powder, a basic oxide; with acids it gives Mn²⁺ salts.',
    uz: 'Marganets(II) oksidi — yashil kukun, asosli oksid; kislotalar bilan Mn²⁺ tuzlarini hosil qiladi.',
  },
  tb_n2o3: {
    en: 'Nitrogen(III) oxide — dark blue liquid, stable only below −4 °C; the anhydride of nitrous acid (N₂O₃ + H₂O → 2HNO₂). At room temperature it decomposes into NO and NO₂.',
    uz: 'Azot(III) oksidi — to‘q ko‘k suyuqlik, faqat −4 °C dan past haroratda barqaror; nitrit kislota angidridi (N₂O₃ + H₂O → 2HNO₂). Xona haroratida NO va NO₂ ga parchalanadi.',
  },
  tb_n2o4: {
    en: 'Dinitrogen tetroxide (nitrogen(IV) oxide dimer) — colourless dimer of brown NO₂: on cooling the equilibrium 2NO₂ ⇄ N₂O₄ shifts to the right (below 21 °C it is a colourless liquid), and on heating the gas turns brown again — a classic example of equilibrium shift.',
    uz: 'Diazot tetraoksidi (azot(IV) oksidi dimeri) — qo‘ng‘ir NO₂ ning rangsiz dimeri: sovutilganda 2NO₂ ⇄ N₂O₄ muvozanati o‘ngga siljiydi (21 °C dan past — rangsiz suyuqlik), qizdirilganda gaz yana qo‘ng‘ir tusga kiradi. Kimyoviy muvozanat siljishining klassik misoli.',
  },
  tb_na2so4_10h2o: {
    en: 'Glauber’s salt — colourless crystals of sodium sulfate decahydrate that effloresce (lose water) in air; used as a laxative and as raw material for glass and soda.',
    uz: 'Glauber tuzi — natriy sulfat dekagidratining rangsiz kristallari, havoda nuraydi (suvini yo‘qotadi); surgi dori, shisha va soda uchun xom ashyo.',
  },
  tb_na2zno2: {
    en: 'Sodium zincate — white salt formed by fusing ZnO or Zn(OH)₂ with alkali, which shows the amphoteric nature of zinc. In aqueous solution it exists as Na₂[Zn(OH)₄].',
    uz: 'Natriy sinkati — oq tuz; ZnO yoki Zn(OH)₂ ni ishqor bilan suyuqlantirib olinadi — ruxning amfoterligini ko‘rsatadi. Suvli eritmada Na₂[Zn(OH)₄] holida bo‘ladi.',
  },
  tb_na2znoh4: {
    en: 'Sodium tetrahydroxozincate — a complex salt with the [Zn(OH)₄]²⁻ anion, formed when Zn(OH)₂ or zinc dissolves in an alkali solution.',
    uz: 'Natriy tetragidroksosinkati — [Zn(OH)₄]²⁻ anionli kompleks tuz; Zn(OH)₂ yoki rux ishqor eritmasida eriganda hosil bo‘ladi.',
  },
  tb_na3po4: {
    en: 'Sodium phosphate — white soluble salt whose solution is strongly alkaline (hydrolysis); it softens water by precipitating Ca²⁺ and Mg²⁺. With AgNO₃ it gives a yellow Ag₃PO₄ precipitate — the test for the phosphate ion.',
    uz: 'Natriy fosfati — oq, eriydigan tuz, eritmasi kuchli ishqoriy (gidroliz); Ca²⁺ va Mg²⁺ ni cho‘ktirib suvni yumshatadi. AgNO₃ bilan sariq Ag₃PO₄ cho‘kmasini beradi — fosfat ioniga sifat reaksiyasi.',
  },
  tb_naalo2: {
    en: 'Sodium metaaluminate — white salt formed by fusing Al₂O₃ or Al(OH)₃ with alkali, which shows the amphoteric nature of aluminum. In aqueous solution it exists as Na[Al(OH)₄].',
    uz: 'Natriy metaalyuminati — oq tuz; Al₂O₃ yoki Al(OH)₃ ni ishqor bilan suyuqlantirib olinadi — alyuminiyning amfoterligini ko‘rsatadi. Suvli eritmada Na[Al(OH)₄] holida bo‘ladi.',
  },
  tb_nah: {
    en: 'Sodium hydride — white ionic solid with hydrogen in the −1 oxidation state; made by heating sodium in hydrogen. With water it releases H₂ and forms an alkali.',
    uz: 'Natriy gidridi — oq ionli modda, vodorodning oksidlanish darajasi −1; natriyni vodorodda qizdirib olinadi. Suv bilan H₂ ajratadi va ishqor hosil qiladi.',
  },
  tb_nahso4: {
    en: 'Sodium hydrogen sulfate — an acid salt of sulfuric acid (one hydrogen atom remains in the acid residue); white crystals with an acidic solution. Formed with excess acid (NaOH + H₂SO₄ → NaHSO₄ + H₂O) and when NaCl is heated with concentrated H₂SO₄.',
    uz: 'Natriy gidrosulfati — sulfat kislotaning nordon tuzi (kislota qoldig‘ida bitta vodorod atomi qolgan); oq kristallar, eritmasi nordon. Kislota ortiqcha bo‘lganda (NaOH + H₂SO₄ → NaHSO₄ + H₂O) va NaCl konsentrlangan H₂SO₄ bilan qizdirilganda hosil bo‘ladi.',
  },
  tb_nh42hpo4: {
    en: 'Diammonium hydrogen phosphate — white soluble salt, a component of the compound fertilizer ammophos (it supplies both nitrogen and phosphorus); made by neutralizing phosphoric acid with ammonia.',
    uz: 'Ammoniy gidrofosfati — oq, eriydigan tuz, ammofos kompleks o‘g‘itining tarkibiy qismi (ham azot, ham fosfor beradi); fosfat kislotani ammiak bilan neytrallab olinadi.',
  },
  tb_p4o10: {
    en: 'Phosphorus(V) oxide — white hygroscopic powder built of real P₄O₁₀ molecules (simplest formula P₂O₅); a very powerful drying agent that gives phosphoric acids with water.',
    uz: 'Fosfor(V) oksidi — oq gigroskopik kukun, haqiqiy P₄O₁₀ molekulalaridan iborat (eng oddiy formulasi P₂O₅); juda kuchli quritgich, suv bilan fosfat kislotalarni hosil qiladi.',
  },
  tb_ph3: {
    en: 'Phosphine — colourless poisonous gas smelling of garlic; it ignites spontaneously in air (the “will-o’-the-wisp” over marshes). Made by hydrolysis of calcium phosphide.',
    uz: 'Fosfin — sarimsoq hidli rangsiz zaharli gaz; havoda o‘z-o‘zidan alangalanadi. Kalsiy fosfidining gidrolizidan olinadi.',
  },
  tb_sif4: {
    en: 'Silicon tetrafluoride — colourless gas formed when glass is etched with hydrofluoric acid: SiO₂ + 4HF → SiF₄↑ + 2H₂O. The molecule is tetrahedral.',
    uz: 'Kremniy ftoridi (SiF₄) — rangsiz gaz; shisha ftorid kislota bilan yedirilganda hosil bo‘ladi: SiO₂ + 4HF → SiF₄↑ + 2H₂O. Molekulasi tetraedrik.',
  },
  tb_sih4: {
    en: 'Silane — colourless gas, the silicon analogue of methane; it ignites spontaneously in air (SiH₄ + 2O₂ → SiO₂ + 2H₂O). Made by the action of acid on magnesium silicide.',
    uz: 'Silan — rangsiz gaz, metanning kremniyli analogi; havoda o‘z-o‘zidan alangalanadi (SiH₄ + 2O₂ → SiO₂ + 2H₂O). Magniy silitsidiga kislota ta’sir ettirib olinadi.',
  },
  tb_v2o5: {
    en: 'Vanadium(V) oxide — orange-yellow powder, an acidic oxide; the catalyst for oxidizing SO₂ to SO₃ in the contact process for sulfuric acid.',
    uz: 'Vanadiy(V) oksidi — to‘q sariq-sariq kukun, kislotali oksid; sulfat kislota ishlab chiqarishning kontakt usulida SO₂ ni SO₃ ga oksidlash katalizatori.',
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
