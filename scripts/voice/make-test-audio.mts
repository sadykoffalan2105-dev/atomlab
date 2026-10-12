#!/usr/bin/env node
/**
 * Тестовое аудио «Голос» (ru / uz / en) голосами Edge Neural TTS.
 *
 *   1) синтез mp3 через Edge Read-Aloud (msedge-tts — тот же протокол, что learnMsEdgeTts.ts), кэш по хешу
 *      «голос|текст» в .tmp/voice-audio/cache/*.mp3 — повторный запуск сеть не трогает;
 *   2) декодирование mp3 → PCM в Chromium из Playwright (decodeAudioData в OfflineAudioContext сразу на 16 и 48 кГц;
 *      ffmpeg из Playwright собран без аудио-декодеров, ставить системный ffmpeg не нужно);
 *   3) варианты: clean, snr20 / snr10 (белый шум), class (два других голоса на −12 дБ + шипение SNR 20), quiet (−18 дБ),
 *      padded (1,5 с тишины до, 2 с после); особые: <lang>-long (склейка ≥ 45 с, с разметкой фраз),
 *      sil-* (тишина 5 с), noise-* (только шум 5 с), echo-* (фраза учителя ru-Dmitry как вход микрофона);
 *   4) .tmp/voice-audio/<lang>/<id>-<variant>.wav (16 кГц — для /stt) и <lang>/48k/… (48 кГц — фейковый микрофон Chrome)
 *      + manifest.json; --fixtures — ещё и короткие клипы в scripts/voice/fixtures (16 кГц, ≤ 1,5 МБ).
 *
 * Запуск: npm run voice:audio [-- --out=.tmp/voice-audio] [--only=ru,uz] [--concurrency=4] [--all48] [--fixtures] [--force]
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'
import { chromium } from 'playwright'
import { CHECK_PHRASE, FIXTURE_IDS, PHRASES, TEACHER_PHRASES, VOICES, type Phrase, type PhraseCat, type VoiceLang } from './phrases.mts'
import { activeRms, babble, mixAtSnr, pinkNoise, roomEcho, seedOf, whiteNoise } from './noise.mts'
import { concat, encodeWav, gainDb, sha1, silence, speechBounds } from './wavio.mts'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? '1']
  }),
)
const OUT = join(ROOT, args.out ?? join('.tmp', 'voice-audio'))
const CACHE = join(OUT, 'cache')
const FIXTURES = join(HERE, 'fixtures')
const ONLY = args.only ? new Set(args.only.split(',')) : null
const CONCURRENCY = Math.max(1, Number(args.concurrency ?? 4))
/** Версия правил генерации: меняется — кэш WAV пересобирается (mp3 остаются). */
const GEN_VERSION = 3
const FIXTURE_LIMIT_BYTES = 1_500_000

export type Variant = 'clean' | 'snr20' | 'snr10' | 'class' | 'quiet' | 'padded' | 'long' | 'silence' | 'noise' | 'echo'

export interface ManifestEntry {
  id: string
  phrase: string
  lang: VoiceLang | 'none'
  text: string
  voice: string
  cat: PhraseCat | 'silence' | 'noise'
  variant: Variant
  snr: number | null
  seconds: number
  /** WAV 16 кГц относительно папки манифеста */
  file16: string
  /** WAV 48 кГц (фейковый микрофон Chrome), если сделан */
  file48?: string
  /** sha1 всего файла 16 кГц — мок-сервер узнаёт клип по телу запроса */
  sha1: string
  /** границы речи в клипе, мс */
  speech: { startMs: number; endMs: number } | null
  /** для склеек: где какая фраза (мс от начала клипа) */
  segments?: { startMs: number; endMs: number; text: string; phrase: string }[]
}

export interface Manifest {
  version: number
  buildKey: string
  createdAt: string
  rates: number[]
  entries: ManifestEntry[]
}

type Pcm = { 16000: Float32Array; 48000: Float32Array }

/* ------------------------------------------------------------ синтез */

async function synth(voice: string, text: string): Promise<Buffer> {
  const key = sha1(`${voice}|${text}`)
  const file = join(CACHE, `${key}.mp3`)
  if (existsSync(file) && statSync(file).size > 1000) return readFileSync(file)
  let lastErr: unknown = null
  // Edge Read-Aloud иногда закрывает поток пустым (~2,5 с; 12.10.2026 — до половины запросов на одну и ту же
  // фразу) — повторяем; на нечётных попытках та же фраза с заглавной буквой и точкой (звучит так же, WER не меняет).
  for (let attempt = 0; attempt < 14; attempt++) {
    try {
      const tts = new MsEdgeTTS()
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, { voiceLocale: voice.slice(0, 5) })
      const said = attempt % 2 ? `${text.charAt(0).toUpperCase()}${text.slice(1)}${/[.?!]$/.test(text) ? '' : '.'}` : text
      const { audioStream } = tts.toStream(said)
      const chunks: Buffer[] = []
      const timer = setTimeout(() => audioStream.destroy(new Error('timeout')), 20_000)
      for await (const c of audioStream) chunks.push(Buffer.from(c as Uint8Array))
      clearTimeout(timer)
      tts.close()
      const mp3 = Buffer.concat(chunks)
      if (mp3.length < 1000) throw new Error(`пустой ответ Edge TTS (${mp3.length} байт)`)
      writeFileSync(file, mp3)
      return mp3
    } catch (e) {
      lastErr = e
      await new Promise((r) => setTimeout(r, Math.min(2000, 300 * (attempt + 1))))
    }
  }
  throw new Error(`Edge TTS не синтезировал «${text}» (${voice}): ${String(lastErr)}`)
}

async function pool<T, R>(items: T[], n: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i], i)
      }
    }),
  )
  return out
}

/* ------------------------------------------------------------ декодирование в Chromium */

async function makeDecoder() {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.setContent('<!doctype html><title>decode</title>')
  const decode = async (mp3: Buffer): Promise<Pcm> => {
    const res = await page.evaluate(async (b64: string) => {
      const bin = atob(b64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const out: Record<number, string> = {}
      for (const rate of [16000, 48000]) {
        const ctx = new OfflineAudioContext(1, 1, rate)
        const ab = await ctx.decodeAudioData(bytes.buffer.slice(0))
        const ch = ab.getChannelData(0)
        const f32 = new Uint8Array(ch.buffer.slice(0))
        let s = ''
        for (let i = 0; i < f32.length; i += 0x8000) s += String.fromCharCode(...f32.subarray(i, i + 0x8000))
        out[rate] = btoa(s)
      }
      return out
    }, mp3.toString('base64'))
    const f = (b64: string) => {
      const b = Buffer.from(b64, 'base64')
      return new Float32Array(b.buffer, b.byteOffset, b.length / 4).slice()
    }
    return { 16000: f(res[16000]), 48000: f(res[48000]) }
  }
  return { decode, close: () => browser.close() }
}

/* ------------------------------------------------------------ варианты */

const RATES = [16000, 48000] as const

function variantPcm(v: Variant, base: Pcm, others: Pcm[], seed: number): Pcm {
  const out = {} as Pcm
  for (const rate of RATES) {
    const x = base[rate]
    const sr = activeRms(x, rate) || 0.05
    if (v === 'clean') out[rate] = x
    else if (v === 'snr20' || v === 'snr10') out[rate] = mixAtSnr(x, whiteNoise(x.length, 1, seed + rate), v === 'snr20' ? 20 : 10, sr)
    else if (v === 'class') {
      const b = babble(x.length, others.map((o) => o[rate]), sr * 10 ** (-12 / 20), seed + 7)
      const withB = x.map((s, i) => s + b[i])
      out[rate] = mixAtSnr(withB, whiteNoise(x.length, 1, seed + 11 + rate), 20, sr)
    } else if (v === 'quiet') out[rate] = gainDb(x, -18)
    else if (v === 'padded') out[rate] = concat([silence(1.5, rate), x, silence(2, rate)])
    else out[rate] = x
  }
  return out
}

const PHRASE_VARIANTS: Variant[] = ['clean', 'snr20', 'snr10', 'class', 'quiet', 'padded']
const SNR: Partial<Record<Variant, number>> = { snr20: 20, snr10: 10, class: 12 }
/** 48 кГц нужны фейковому микрофону (e2e/--live): по умолчанию только для них, --all48 — для всех. */
const NEED48 = new Set<Variant>(['clean', 'padded', 'long', 'silence', 'noise', 'echo'])

/* ------------------------------------------------------------ main */

async function main(): Promise<void> {
  const phrases = PHRASES.filter((p) => !ONLY || ONLY.has(p.lang))
  const extra: Phrase[] = [...TEACHER_PHRASES, CHECK_PHRASE]
  const all48 = args.all48 === '1'
  const buildKey = sha1(
    JSON.stringify({ v: GEN_VERSION, p: [...phrases, ...extra].map((p) => [p.id, p.voice, p.text]), all48 }),
  )
  const manifestFile = join(OUT, 'manifest.json')
  if (!args.force && existsSync(manifestFile)) {
    try {
      const old = JSON.parse(readFileSync(manifestFile, 'utf8')) as Manifest
      const complete = old.entries.every((e) => existsSync(join(OUT, e.file16)) && (!e.file48 || existsSync(join(OUT, e.file48))))
      if (old.buildKey === buildKey && complete && !args.fixtures) {
        console.log(`кэш: ${old.entries.length} клипов уже готовы (${relative(ROOT, manifestFile)}); --force — пересобрать`)
        return
      }
    } catch {
      /* битый манифест — пересобираем */
    }
  }
  mkdirSync(CACHE, { recursive: true })

  const t0 = Date.now()
  const todo = [...phrases, ...extra]
  let fromCache = 0
  console.log(`синтез: ${todo.length} фраз, ${CONCURRENCY} параллельно…`)
  const mp3s = await pool(todo, CONCURRENCY, async (p) => {
    const cached = existsSync(join(CACHE, `${sha1(`${p.voice}|${p.text}`)}.mp3`))
    if (cached) fromCache++
    return synth(p.voice, p.text)
  })
  console.log(`  готово за ${((Date.now() - t0) / 1000).toFixed(1)} с (из кэша ${fromCache}/${todo.length})`)

  const dec = await makeDecoder()
  const pcm = new Map<string, Pcm>()
  try {
    for (let i = 0; i < todo.length; i++) pcm.set(todo[i].id, await dec.decode(mp3s[i]))
  } finally {
    await dec.close()
  }

  const entries: ManifestEntry[] = []
  const write = (
    meta: Omit<ManifestEntry, 'file16' | 'file48' | 'sha1' | 'seconds' | 'speech'>,
    data: Pcm,
    dir: string,
  ): ManifestEntry => {
    const name = `${meta.id}.wav`
    const rel16 = join(dir, name).replace(/\\/g, '/')
    mkdirSync(join(OUT, dir), { recursive: true })
    const wav16 = encodeWav(data[16000], 16000)
    writeFileSync(join(OUT, rel16), wav16)
    let rel48: string | undefined
    if (all48 || NEED48.has(meta.variant)) {
      rel48 = join(dir, '48k', name).replace(/\\/g, '/')
      mkdirSync(join(OUT, dir, '48k'), { recursive: true })
      writeFileSync(join(OUT, rel48), encodeWav(data[48000], 48000))
    }
    const e: ManifestEntry = {
      ...meta,
      seconds: Math.round((data[16000].length / 16000) * 100) / 100,
      file16: rel16,
      ...(rel48 ? { file48: rel48 } : {}),
      sha1: sha1(wav16),
      speech: meta.text ? speechBounds(data[16000], 16000) : null,
    }
    entries.push(e)
    return e
  }

  // фразы × варианты
  for (const p of phrases) {
    const base = pcm.get(p.id)!
    // «класс»: две другие фразы того же языка другим голосом (и ещё одна — своим)
    const pool2 = phrases.filter((q) => q.lang === p.lang && q.id !== p.id && q.cat !== 'command')
    const s = seedOf(p.id)
    const others = [pool2[s % pool2.length], pool2[(s >>> 8) % pool2.length]].map((q) => pcm.get(q.id)!)
    for (const v of PHRASE_VARIANTS) {
      write(
        { id: `${p.id}-${v}`, phrase: p.id, lang: p.lang, text: p.text, voice: p.voice, cat: p.cat, variant: v, snr: SNR[v] ?? null },
        variantPcm(v, base, others, s),
        p.lang,
      )
    }
  }

  // длинная речь ≥ 45 с по языку (паузы 0,8 с — сегментатор должен резать по ним); сервер обязан ответить 413
  for (const lang of Object.keys(VOICES) as VoiceLang[]) {
    const list = phrases.filter((p) => p.lang === lang && p.cat !== 'command')
    if (!list.length) continue
    const data = {} as Pcm
    const segments: NonNullable<ManifestEntry['segments']> = []
    for (const rate of RATES) {
      const parts: Float32Array[] = [silence(0.5, rate)]
      let len = parts[0].length
      for (let i = 0; len < 45.5 * rate; i++) {
        const p = list[i % list.length]
        const x = pcm.get(p.id)![rate]
        if (rate === 16000) {
          const b = speechBounds(x, rate)
          const start = (len / rate) * 1000
          segments.push({
            startMs: Math.round(start + (b?.startMs ?? 0)),
            endMs: Math.round(start + (b?.endMs ?? x.length / 16)),
            text: p.text,
            phrase: p.id,
          })
        }
        parts.push(x, silence(0.8, rate))
        len += x.length + Math.round(0.8 * rate)
      }
      data[rate] = concat(parts)
    }
    write(
      {
        id: `${lang}-long`,
        phrase: `${lang}-long`,
        lang,
        text: segments.map((s) => s.text).join(' '),
        voice: VOICES[lang].join('+'),
        cat: 'everyday',
        variant: 'long',
        snr: null,
        segments,
      },
      data,
      lang,
    )
  }

  // тишина и шум без речи (5 с): сервер должен вернуть пустой текст
  const quietSets: { id: string; cat: 'silence' | 'noise'; make: (len: number, rate: number) => Float32Array }[] = [
    { id: 'sil-zero', cat: 'silence', make: (len) => new Float32Array(len) },
    { id: 'sil-floor', cat: 'silence', make: (len, rate) => whiteNoise(len, 0.001, 101 + rate) },
    { id: 'sil-hiss', cat: 'silence', make: (len, rate) => whiteNoise(len, 0.003, 102 + rate) },
    { id: 'noise-white', cat: 'noise', make: (len, rate) => whiteNoise(len, 0.02, 201 + rate) },
    { id: 'noise-pink', cat: 'noise', make: (len, rate) => pinkNoise(len, 0.03, 202 + rate) },
    { id: 'noise-room', cat: 'noise', make: (len, rate) => pinkNoise(len, 0.015, 203 + rate).map((v, i) => v + Math.sin((2 * Math.PI * 50 * i) / rate) * 0.01) },
    { id: 'noise-fan', cat: 'noise', make: (len, rate) => pinkNoise(len, 0.05, 204 + rate) },
  ]
  for (const q of quietSets) {
    const data = { 16000: q.make(5 * 16000, 16000), 48000: q.make(5 * 48000, 48000) } as Pcm
    write({ id: q.id, phrase: q.id, lang: 'none', text: '', voice: '', cat: q.cat, variant: q.cat === 'silence' ? 'silence' : 'noise', snr: null }, data, 'none')
  }

  // эхо: фраза учителя из динамика, услышанная микрофоном
  for (const p of TEACHER_PHRASES) {
    const base = pcm.get(p.id)!
    const data = { 16000: roomEcho(base[16000], 16000), 48000: roomEcho(base[48000], 48000) } as Pcm
    write({ id: `${p.id}-echo`, phrase: p.id, lang: 'ru', text: p.text, voice: p.voice, cat: 'teacher', variant: 'echo', snr: null }, data, 'ru')
    write({ id: `${p.id}-clean`, phrase: p.id, lang: 'ru', text: p.text, voice: p.voice, cat: 'teacher', variant: 'clean', snr: null }, base, 'ru')
  }
  write(
    { id: `${CHECK_PHRASE.id}-clean`, phrase: CHECK_PHRASE.id, lang: 'ru', text: CHECK_PHRASE.text, voice: CHECK_PHRASE.voice, cat: 'check', variant: 'clean', snr: null },
    pcm.get(CHECK_PHRASE.id)!,
    'ru',
  )

  const manifest: Manifest = { version: GEN_VERSION, buildKey, createdAt: new Date().toISOString(), rates: [16000, 48000], entries }
  writeFileSync(manifestFile, JSON.stringify(manifest, null, 1) + '\n')
  const byVariant = new Map<string, number>()
  for (const e of entries) byVariant.set(e.variant, (byVariant.get(e.variant) ?? 0) + 1)
  console.log(
    `манифест: ${entries.length} клипов (${phrases.length} фраз) → ${relative(ROOT, manifestFile)}\n  ` +
      [...byVariant].map(([k, v]) => `${k} ${v}`).join(', '),
  )

  if (args.fixtures) writeFixtures(entries)
  console.log(`всё за ${((Date.now() - t0) / 1000).toFixed(1)} с`)
}

/** Короткие клипы для e2e без сети: scripts/voice/fixtures/<phrase>.wav (16 кГц) + manifest.json. */
function writeFixtures(entries: ManifestEntry[]): void {
  mkdirSync(FIXTURES, { recursive: true })
  const out: ManifestEntry[] = []
  let bytes = 0
  for (const id of FIXTURE_IDS) {
    const e = entries.find((x) => x.phrase === id && x.variant === 'clean')
    if (!e) throw new Error(`fixtures: нет клипа ${id}`)
    const wav = readFileSync(join(OUT, e.file16))
    bytes += wav.length
    writeFileSync(join(FIXTURES, `${id}.wav`), wav)
    const { file48: _drop, ...rest } = e
    void _drop
    out.push({ ...rest, file16: `${id}.wav` })
  }
  if (bytes > FIXTURE_LIMIT_BYTES) throw new Error(`fixtures: ${bytes} байт > ${FIXTURE_LIMIT_BYTES}`)
  const m = { version: GEN_VERSION, note: 'Короткие клипы Edge Neural TTS (16 кГц PCM16 моно) для e2e-voice без сети; пересборка: npm run voice:audio -- --fixtures', entries: out }
  writeFileSync(join(FIXTURES, 'manifest.json'), JSON.stringify(m, null, 1) + '\n')
  console.log(`fixtures: ${out.length} клипов, ${(bytes / 1024).toFixed(0)} КБ → ${relative(ROOT, FIXTURES)}`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
