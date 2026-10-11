/**
 * Фильтр запроса картинки по категориям закона ЗРУ-444 от 08.09.2017 «О защите детей от информации, наносящей вред
 * их здоровью», ст. 16 (порнография, насилие и жестокость, побуждение к самоубийству, наркотики/алкоголь/табак/
 * азартные игры, экстремизм, нецензурная брань — её ловит moderation.ts) + реальные люди, оружие, ужасы.
 * Это первый слой (быстрый, без модели); второй — проверка Gemma (prompt.ts), третий — классификатор готовой картинки.
 *
 * Корни сравниваются с НАЧАЛОМ слова (как в moderation.ts): «спирт», «этанол», «кислота», «серная», «нитрат»,
 * «закон» (uz «qonun») не задевают; латинские двойники кириллицы («пopнo» латинскими o) снимаются.
 */

export type ImageFilterCategory = 'sexual' | 'gore' | 'selfharm' | 'drugs' | 'extremism' | 'persons' | 'weapons' | 'horror'
export type ImageFilterResult = { ok: true } | { ok: false; category: ImageFilterCategory }

/** Корни (начало слова) и точные формы — по словам; ru / uz / en. */
const WORD_RULES: Record<ImageFilterCategory, RegExp[]> = {
  sexual: [
    /^голая$|^голые$|^голых$|^голый$|^голую$|^голышом/, /^обнаж/, /^секс/, /^порн/, /^эрот/, /^интим/, /^раздет/, /^стриптиз/, /^бикини/,
    /^nude/, /^naked/, /^nsfw/, /^sex(?:y|ual|$)/, /^porn/, /^erotic/, /^lingerie/, /^stripper/, /^topless/,
    /^yalangoch/, /^jinsiy/, /^shahvon/, /^yechingan/,
  ],
  gore: [
    /^кров(?:ь|и|ью|ав|ищ|опрол|опийц)/, /^труп/, /^расчлен/, /^казн(?:ь|и|ит|ён|ен)/, /^пытк/, /^пыта(?:ть|ют|ли|ет)$/, /^убий/, /^убит/, /^зарез/, /^отрублен/, /^резня/, /^мясорубк/,
    /^gore$|^gory$/, /^corpse/, /^torture/, /^blood/, /^murder/, /^dismember/, /^behead/, /^decapitat/, /^massacre/,
    /^qon(?:$|li|ga|da|ni|ning|lar|ini)$/, /^jasad/, /^qiynoq/, /^qotil/, /^olik(?:$|lar|ni)/,
  ],
  selfharm: [
    /^суицид/, /^самоубий/, /^самоповрежд/, /^повесил/, /^повеситься/, /^повешен/, /^селфхарм/,
    /^suicid/, /^selfharm/, /^self-harm/, /^hanged$/, /^noose/,
    /^osilib/,
  ],
  drugs: [
    /^героин/, /^кокаин/, /^метамфетамин/, /^мефедрон/, /^амфетамин/, /^марихуан/, /^гашиш/, /^конопл/, /^спайс/, /^косяк/, /^шприц/, /^наркот/, /^нарком/,
    /^водк/, /^пьян/, /^алкогол/, /^пив(?:о|а|ом)$/, /^сигарет/, /^табак/, /^курени/, /^кальян/, /^вейп/, /^казино/, /^ставк(?:а|и|у)$/, /^ставок$/, /^рулетк/, /^букмекер/,
    /^heroin/, /^cocain/, /^cocaine/, /^methamphetamin/, /^meth$/, /^marijuana/, /^cannabis/, /^weed$/, /^lsd$/, /^ecstasy$/, /^syringe/,
    /^vodka/, /^beer/, /^wine$/, /^whisk/, /^drunk/, /^cigar/, /^tobacco/, /^vape/, /^vaping/, /^casino/, /^gambl/, /^poker/,
    /^giyohvand/, /^narkotik/, /^aroq/, /^sigaret/, /^tamaki/, /^qimor/, /^nasha$/, /^kazino/, /^pivo$/, /^mast$/,
  ],
  extremism: [
    /^свастик/, /^нацис/, /^нацизм/, /^фашис/, /^фашизм/, /^игил/, /^террор/, /^экстрем/, /^джихад/, /^шахид/, /^теракт/,
    /^swastika/, /^nazi/, /^fascis/, /^isis$/, /^terror/, /^extremis/, /^jihad/, /^hitler/,
    /^ekstrem/, /^terror/, /^fashist/, /^natsist/,
  ],
  persons: [
    /^президент/, /^политик/, /^мирзиёев/, /^мирзияев/, /^путин/, /^трамп(?:$|а|у|ом|е)$/, /^байден/, /^зеленск/, /^знаменитост/, /^селебрит/, /^актёр/, /^актер/, /^актрис/, /^певец/, /^певиц/, /^рэпер/, /^блогер/, /^футболист/,
    /^president/, /^politician/, /^celebrit/, /^trump$/, /^putin$/, /^biden$/, /^mirziyoyev/, /^actor/, /^actress/, /^singer/, /^rapper/, /^blogger/, /^footballer/,
    /^prezident/, /^siyosatchi/, /^aktyor/, /^xonanda/, /^bloger/,
  ],
  weapons: [
    /^пистолет/, /^автомат(?:$|а|ы|ом|у|ов|чик)$/, /^винтовк/, /^граната$|^гранаты$|^гранату$|^гранатой$|^гранатомет/, /^бомб(?:а|ы|у|ой|ами|ить|ят|ёж|еж)?$/, /^оружи/, /^ружь/, /^пулемет/, /^пулемёт/, /^снайпер/, /^взрывчат/,
    /^gun$|^guns$|^gunfire|^gunman/, /^rifle/, /^grenade/, /^bomb(?:s|ing|er)?$/, /^weapon/, /^pistol/, /^firearm/, /^sniper/, /^explosive/, /^missile/,
    /^qurol/, /^bomba(?:$|lar|ni|ga)/, /^avtomat(?:$|lar|ni|dan)$/, /^miltiq/, /^portlovchi/, /^granata/,
  ],
  horror: [
    /^ужас(?:$|н|ы|ов|ом|ающ)/, /^монстр/, /^хоррор/, /^зомби/, /^страшн/, /^жутк/, /^демон(?:$|ы|а|ов|ом|ами|у)$|^демоническ/, /^призрак/, /^чудовищ/, /^вампир/,
    /^horror/, /^zombie/, /^monster/, /^scary/, /^creepy/, /^demon(?:s|ic)?$/, /^ghost/, /^vampire/, /^gruesome/,
    /^dahshat/, /^maxluq/, /^qorqinchli/, /^arvoh/, /^vahshiy/,
  ],
}

/** Фразы целиком (после нормализации; апострофы uz сняты). */
const PHRASE_RULES: Record<ImageFilterCategory, RegExp[]> = {
  sexual: [/\bбез одежды\b/, /\bwithout clothes\b/],
  gore: [],
  selfharm: [/\bвскры\S* вен/, /\bпокончить с собой/, /\bkill (?:my|him|her|them)sel/, /\boz joniga qasd/, /\bself harm/],
  drugs: [/\balcoholic drinks?\b/, /\bspirtli ichimlik/],
  extremism: [],
  persons: [],
  weapons: [],
  horror: [],
}

/** Химия, похожая на запрещённое: «бомбовый калориметр», «bomb calorimeter», «калориметрическая бомба». */
const CHEM_OK = /калориметр|calorimet/

/** Латинские двойники кириллицы (как в moderation.ts): «пopнo» с латинскими o/p → «порно». */
const LAT2CYR: Record<string, string> = { a: 'а', e: 'е', o: 'о', p: 'р', c: 'с', x: 'х', y: 'у', k: 'к', m: 'м', t: 'т', b: 'в', h: 'н' }

/** Нормализация: NFC, нижний регистр, ё→е, апострофы uz сняты, слова со смесью алфавитов — в кириллицу. */
export function filterForm(text: string): string {
  const t = text
    .normalize('NFC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[ʻʼ‘’'`´]/g, '')
  return t
    .split(/(\s+)/)
    .map((w) => (/[а-я]/.test(w) && /[a-z]/.test(w) ? [...w].map((ch) => LAT2CYR[ch] ?? ch).join('') : w))
    .join('')
}

export function imageFilter(text: string): ImageFilterResult {
  const t = filterForm(text)
  const words = t.split(/[^\p{L}\p{N}-]+/u).filter(Boolean)
  // «o‘z joniga» — одно правило на слитые слова (после снятия апострофа «oz joniga»)
  const joined = t.replace(/\s+/g, ' ')
  const chemOk = CHEM_OK.test(joined)
  for (const cat of Object.keys(WORD_RULES) as ImageFilterCategory[]) {
    if (PHRASE_RULES[cat].some((re) => re.test(joined))) return { ok: false, category: cat }
    for (const w of words) {
      const core = w.replace(/^-+|-+$/g, '')
      if (!core) continue
      if (cat === 'weapons' && chemOk && /^(бомб|bomb)/.test(core)) continue
      if (WORD_RULES[cat].some((re) => re.test(core))) return { ok: false, category: cat }
    }
  }
  return { ok: true }
}

/** Слова фильтра (для проверки, что prompt_en пресетов «чистые»). */
export function filterHits(text: string): ImageFilterCategory | null {
  const r = imageFilter(text)
  return r.ok ? null : r.category
}
