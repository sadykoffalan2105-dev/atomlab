/**
 * Настоящие фото образцов 118 элементов (Wikimedia Commons) → src/data/elementPhotos.json.
 *
 *   npx tsx scripts/build-element-photos.mts           — собрать и проверить
 *   npx tsx scripts/build-element-photos.mts --check   — только проверить готовый JSON
 *
 * Картинки в репозиторий НЕ скачиваются: храним ссылку на уменьшенную копию Commons
 * (thumburl ~500 px), страницу файла, автора и лицензию (требование CC BY / BY-SA).
 *
 * Выбор файлов: снимок САМОГО простого вещества (металл, кристаллы, жидкость, газ
 * в ампуле или разрядной трубке), в основном серия «Images of elements»
 * (Heinrich Pniok / Alchemist-hp) и снимки из инфобоксов статей Википедии.
 * null — фото образца нет (сверхтяжёлые синтетические, Fr, Rn и т. п.).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outFile = path.join(root, "src/data/elementPhotos.json");

const UA =
  "ATOMLAB-element-photos/1.0 (educational app; https://github.com/sadykoffalan2105-dev)";
/** Шаг ширины миниатюр Commons (стандартный размер — кэшируется на CDN). */
const THUMB_WIDTH = 500;
/** Копия для экранов высокой плотности (телефон, фото во всю ширину). */
const THUMB_2X_WIDTH = 960;

/** symbol → имя файла на Commons (без «File:») или null — честно «фото нет». */
const SOURCES: Readonly<Record<string, string | null>> = {
  H: "Hydrogen_discharge_tube.jpg",
  He: "Helium_discharge_tube.jpg",
  Li: "Purified_lithium_in_an_ampoule_under_argon,_dark_background.png",
  Be: "Be-140g.jpg",
  B: "Boron_R105.jpg",
  C: "Graphite-and-diamond-with-scale.jpg",
  N: "Fluessiger_Stickstoff.jpg",
  O: "Liquid_oxygen_in_a_beaker_(cropped_and_retouched).jpg",
  F: "Fluoro_liquido_a_-196°C_1.jpg",
  Ne: "Neon_discharge_tube.jpg",
  Na: "Na_(Sodium).jpg",
  Mg: "CSIRO_ScienceImage_2893_Crystalised_magnesium.jpg",
  Al: "Aluminium-4.jpg",
  Si: "A_piece_of_zone_refined_silicon.JPG",
  P: "Phosphor_rot.jpg",
  S: "Sulfur-sample.jpg",
  Cl: "Chlorine_liquid_in_an_ampoule.jpg",
  Ar: "Argon_discharge_tube.jpg",
  K: "Potassium-2.jpg",
  Ca: "Calcium_crystals_in_ampoule_cropped.jpg",
  Sc: "Scandium_sublimed_dendritic_and_1cm3_cube.jpg",
  Ti: "Titan-crystal_bar.JPG",
  V: "Vanadium_crystal_bar_and_1cm3_cube.jpg",
  Cr: "Chromium_crystals_and_1cm3_cube.jpg",
  Mn: "Manganese_electrolytic_and_1cm3_cube.jpg",
  Fe: "Iron_electrolytic_and_1cm3_cube.jpg",
  Co: "Kobalt_electrolytic_and_1cm3_cube.jpg",
  Ni: "Nickel_electrolytic_and_1cm3_cube.jpg",
  Cu: "NatCopper.jpg",
  Zn: "Zinc_fragment_sublimed_and_1cm3_cube.jpg",
  Ga: "Gallium_bar_cracked_open_to_show_crystal_structure_with_scale_1.png",
  Ge: "Polycrystalline-germanium.jpg",
  As: "Arsen_1a.jpg",
  Se: "SeBlackRed.jpg",
  Br: "Bromine_vial_in_acrylic_cube.jpg",
  Kr: "Krypton_discharge_tube.jpg",
  Rb: "Rb5.JPG",
  Sr: "Strontium_destilled_crystals.jpg",
  Y: "Yttrium_sublimed_dendritic_and_1cm3_cube.jpg",
  Zr: "Zirconium_crystal_bar_and_1cm3_cube.jpg",
  Nb: "Niobium_crystals_and_1cm3_cube.jpg",
  Mo: "Molybdenum_crystaline_fragment_and_1cm3_cube.jpg",
  Tc: "Technetium-sample-cropped.jpg",
  Ru: "Ruthenium_a_half_bar.jpg",
  Rh: "Rhodium_powder_pressed_melted.jpg",
  Pd: "Palladium_(46_Pd).jpg",
  Ag: "Silver_crystal.jpg",
  Cd: "Cadmium-crystal_bar.jpg",
  In: "Indium.jpg",
  Sn: "Sn-Alpha-Beta.jpg",
  Sb: "Antimony-4.jpg",
  Te: "Tellurium2.jpg",
  I: "Sample_of_iodine.jpg",
  Xe: "Xenon_discharge_tube.jpg",
  Cs: "Cesium.jpg",
  Ba: "Barium_unter_Argon_Schutzgas_Atmosphäre.jpg",
  La: "Lanthanum-2.jpg",
  Ce: "Cerium2.jpg",
  Pr: "Praseodymium.jpg",
  Nd: "Ultrapure_neodymium_under_argon,_5_grams.jpg",
  // Металлический Pm на Commons не снят (есть только раствор соли Pm³⁺ — это соединение).
  Pm: null,
  Sm: "Samarium-2.jpg",
  Eu: "Europium.jpg",
  Gd: "Gadolinium-4.jpg",
  Tb: "Terbium-2.jpg",
  Dy: "Dy_chips.jpg",
  Ho: "Holmium2.jpg",
  Er: "Erbium_(68_Er).jpg",
  Tm: "Thulium_sublimed_dendritic_and_1cm3_cube.jpg",
  Yb: "Ytterbium-3.jpg",
  Lu: "Lutetium_sublimed_dendritic_and_1cm3_cube.jpg",
  Hf: "Hafnium_crystal.jpg",
  Ta: "Tantalum_single_crystal_and_1cm3_cube.jpg",
  W: "Wolfram_evaporated_crystals_and_1cm3_cube.jpg",
  Re: "Rhenium_single_crystal_bar_and_1cm3_cube.jpg",
  Os: "Osmium_crystals.jpg",
  Ir: "Iridium_(77_Ir)_(cropped).jpg",
  Pt: "Platinum_crystals.jpg",
  Au: "Gold-crystals.jpg",
  Hg: "Pouring_liquid_mercury_bionerd.jpg",
  Tl: "Thallium_pieces_in_ampoule.jpg",
  Pb: "Lead_electrolytic_and_1cm3_cube.jpg",
  Bi: "Bismuth_crystals_and_1cm3_cube.jpg",
  Po: "Polonium_on_brass_sheet.jpg",
  At: "Glow_from_a_sample_of_astatine_(cropped).jpg",
  // Бесцветный радиоактивный газ — «увидеть» нечего.
  Rn: null,
  // Весомого образца франция никто не получал (T½ ≈ 22 мин).
  Fr: null,
  Ra: "Radium226.jpg",
  Ac: "Actinium_sample_(31481701837).png",
  Th: "Thorium_sample_0.1g.jpg",
  Pa: "Protactinium_(Element_-_91)_2.jpg",
  U: "HEUraniumC.jpg",
  Np: "Neptunium_(Element_-_93)_3.jpg",
  Pu: "Plutonium_ring.jpg",
  Am: "Americium_microscope.jpg",
  // Свободной фотографии металлического кюрия на Commons нет.
  Cm: null,
  Bk: "Berkelium_metal.jpg",
  Cf: "Californium.jpg",
  Es: "Einsteinium.jpg",
  // Fm и тяжелее — пикограммы или считанные атомы: видимого образца не было.
  Fm: null,
  Md: null,
  No: null,
  Lr: null,
  Rf: null,
  Db: null,
  Sg: null,
  Bh: null,
  Hs: null,
  Mt: null,
  Ds: null,
  Rg: null,
  Cn: null,
  Nh: null,
  Fl: null,
  Mc: null,
  Lv: null,
  Ts: null,
  Og: null,
};

/** Подпись автора вручную, когда в метаданных Commons только ссылка/«Unspecified». */
const AUTHOR_OVERRIDES: Readonly<Record<string, string>> = {
  U: "U.S. Department of Energy",
};

export type ElementPhoto = {
  thumb: string;
  /** ~960 px — только если оригинал шире; для srcset */
  thumb2x?: string;
  page: string;
  author: string;
  license: string;
  licenseUrl?: string;
};

const stripHtml = (s?: string) =>
  (s ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Скрытые (display:none) дубли подписи Commons — выбрасываем до снятия тегов. */
const dropHidden = (s?: string) =>
  (s ?? "").replace(/<span[^>]*display:\s*none[^>]*>.*?<\/span>/gi, "");

/**
 * Читаемый автор: «Alchemist-hp (talk) (…)» → «Alchemist-hp (…)», без «Contact email»,
 * без префикса исходного файла «X.jpg: …». Серия images-of-elements.com — Heinrich Pniok.
 */
function cleanAuthor(
  artistHtml: string | undefined,
  creditHtml: string | undefined,
): string {
  let s = stripHtml(dropHidden(artistHtml));
  const credit = stripHtml(creditHtml);
  if (
    (/^unknown author$/i.test(s) ||
      /Hi-Res Images of Chemical Elements/i.test(s)) &&
    /images-of-elements\.com/i.test(credit)
  ) {
    return "Heinrich Pniok (images-of-elements.com)";
  }
  if (/^(unknown author|unspecified)$/i.test(s) && credit) s = credit;
  s = s
    .replace(/\s*Contact email:.*$/i, "")
    .replace(/^(?:the )?original uploader was (\S+) at ([^.]+)\.?$/i, "$1 ($2)")
    .replace(/^[^:]{3,80}\.(jpe?g|png|gif|tiff?):\s*/i, "")
    .replace(/\s*\((talk|обс\.?|Diskussion)\)\s*/gi, " ")
    .replace(/[“”"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > 90 ? `${s.slice(0, 87).trimEnd()}…` : s;
}

/** Убираем utm-хвост, который API добавляет к ссылкам миниатюр. */
const cleanUrl = (u: string) => u.replace(/\?utm_source=.*$/, "");

async function fetchJson(url: string): Promise<any> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) return res.json();
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  throw new Error(`HTTP error: ${url}`);
}

/** imageinfo пачками по 40 файлов: ключ — имя файла как в SOURCES. */
async function fetchImageInfo(
  files: string[],
  width: number,
): Promise<Map<string, any>> {
  const out = new Map<string, any>();
  for (let i = 0; i < files.length; i += 40) {
    const batch = files
      .slice(i, i + 40)
      .map((f) => `File:${f.replace(/_/g, " ")}`);
    const url =
      "https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2" +
      `&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=${width}` +
      `&titles=${encodeURIComponent(batch.join("|"))}`;
    const j = await fetchJson(url);
    const norm = new Map<string, string>();
    for (const n of j.query?.normalized ?? []) norm.set(n.to, n.from);
    for (const p of j.query?.pages ?? []) {
      const key = (norm.get(p.title) ?? p.title)
        .replace(/^File:/, "")
        .replace(/ /g, "_");
      const ii = p.imageinfo?.[0];
      if (ii) out.set(key, ii);
    }
  }
  return out;
}

async function queryCommons(
  files: string[],
): Promise<Map<string, ElementPhoto>> {
  const out = new Map<string, ElementPhoto>();
  const base = await fetchImageInfo(files, THUMB_WIDTH);
  const big = await fetchImageInfo(files, THUMB_2X_WIDTH);
  for (const [key, ii] of base) {
    const m = ii.extmetadata ?? {};
    const author =
      cleanAuthor(m.Artist?.value, m.Credit?.value) || "Wikimedia Commons";
    const license = stripHtml(m.LicenseShortName?.value) || "see file page";
    const licenseUrl = stripHtml(m.LicenseUrl?.value) || undefined;
    const ii2 = big.get(key);
    const thumb2x =
      ii2 && ii2.width > THUMB_2X_WIDTH && ii2.thumburl
        ? cleanUrl(ii2.thumburl)
        : undefined;
    out.set(key, {
      thumb: cleanUrl(ii.thumburl ?? ii.url),
      ...(thumb2x ? { thumb2x } : {}),
      page: cleanUrl(ii.descriptionurl),
      author,
      license,
      ...(licenseUrl ? { licenseUrl } : {}),
    });
  }
  return out;
}

/** HTTP 200 + image/* — иначе ошибка. */
async function checkImage(url: string): Promise<string | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    const type = res.headers.get("content-type") ?? "";
    await res.arrayBuffer().catch(() => null);
    if (res.status === 200 && type.startsWith("image/")) return null;
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    return `HTTP ${res.status} ${type}`;
  }
  return "HTTP retry limit";
}

async function verify(
  data: Record<string, ElementPhoto | null>,
): Promise<string[]> {
  const errors: string[] = [];
  const entries = Object.entries(data).filter(
    (e): e is [string, ElementPhoto] => e[1] != null,
  );
  let done = 0;
  for (const [sym, photo] of entries) {
    for (const url of [photo.thumb, photo.thumb2x].filter(
      (u): u is string => !!u,
    )) {
      const err = await checkImage(url);
      if (err) errors.push(`${sym}: ${err} — ${url}`);
    }
    if (!photo.page.startsWith("https://commons.wikimedia.org/wiki/File:"))
      errors.push(`${sym}: page ${photo.page}`);
    if (!photo.author || !photo.license)
      errors.push(`${sym}: нет автора/лицензии`);
    done++;
    if (done % 20 === 0) console.log(`  проверено ${done}/${entries.length}`);
  }
  return errors;
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const symbols = (
    JSON.parse(
      fs.readFileSync(
        path.join(root, "src/data/periodicTableRaw.json"),
        "utf8",
      ),
    ) as {
      symbol: string;
    }[]
  ).map((e) => e.symbol);
  if (symbols.length !== 118)
    throw new Error(`ожидалось 118 элементов, получено ${symbols.length}`);

  let data: Record<string, ElementPhoto | null>;
  if (checkOnly) {
    data = JSON.parse(fs.readFileSync(outFile, "utf8"));
  } else {
    const files = symbols
      .map((s) => SOURCES[s])
      .filter((f): f is string => typeof f === "string");
    const info = await queryCommons(files);
    data = {};
    const missing: string[] = [];
    for (const sym of symbols) {
      if (!(sym in SOURCES)) throw new Error(`нет записи SOURCES для ${sym}`);
      const file = SOURCES[sym];
      if (file == null) {
        data[sym] = null;
        continue;
      }
      const photo = info.get(file);
      if (!photo) missing.push(`${sym}: ${file}`);
      data[sym] = photo
        ? { ...photo, author: AUTHOR_OVERRIDES[sym] ?? photo.author }
        : null;
    }
    if (missing.length)
      throw new Error(`файлы не найдены на Commons:\n${missing.join("\n")}`);
    fs.writeFileSync(outFile, `${JSON.stringify(data, null, 1)}\n`);
    console.log(`записано ${outFile}`);
  }

  const keys = Object.keys(data);
  if (keys.length !== 118)
    throw new Error(`в JSON ${keys.length} записей, нужно 118`);
  const withPhoto = keys.filter((k) => data[k] != null).length;
  console.log(`фото: ${withPhoto}, без фото: ${118 - withPhoto}`);
  const errors = await verify(data);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  console.log("все миниатюры отвечают 200 и это изображения");
}

await main();
