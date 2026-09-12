/**
 * Resolve best Wikimedia photo URL per element (with fallbacks).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const raw = JSON.parse(fs.readFileSync(path.join(root, 'src/data/periodicTableRaw.json'), 'utf8'))

const CANDIDATES = {
  Tc: ['Technetium-sample.jpg', 'Technetium (Element - 43).jpg', 'Technetium on gold foil.jpg'],
  Pm: ['Promethium (Element - 61) 1.jpg', 'Promethium (Element - 61) 2.jpg'],
  Bk: ['Berkelium (Element - 97) 1.jpg', 'Berkelium metal.jpg', 'Berkelium.jpg'],
  Cf: ['Californium (Element - 98) 1.jpg', 'Californium.jpg'],
  Es: ['Einsteinium (Element - 99) 1.jpg'],
  Fm: ['Fermium-Ytterbium Alloy.jpg'],
  Md: ['Mendelevium.svg'],
  No: ['Nobelium.svg'],
  Lr: ['Lawrencium.svg'],
  Rf: ['Electron shell 104 rutherfordium.png'],
  Db: ['Electron shell 105 dubnium.png'],
  Sg: ['Electron shell 106 seaborgium.png'],
  Bh: ['Electron shell 107 bohrium.png'],
  Hs: ['Electron shell 108 hassium.png'],
  Mt: ['Electron shell 109 meitnerium.png'],
  Ds: ['Electron shell 110 darmstadtium.png'],
  Rg: ['Electron shell 111 roentgenium.png'],
  Cn: ['Electron shell 112 copernicium.png'],
  Nh: ['Electron shell 113 nihonium.png'],
  Fl: ['Electron shell 114 flerovium.png'],
  Mc: ['Electron shell 115 moscovium.png'],
  Lv: ['Electron shell 116 livermorium.png'],
  Ts: ['Electron shell 117 tennessine.png'],
  Og: ['Electron shell 118 oganesson.png', 'Ununoctium-294 nuclear.png'],
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function resolveFileUrl(filename) {
  const api = new URL('https://commons.wikimedia.org/w/api.php')
  api.searchParams.set('action', 'query')
  api.searchParams.set('format', 'json')
  api.searchParams.set('titles', `File:${filename}`)
  api.searchParams.set('prop', 'imageinfo')
  api.searchParams.set('iiprop', 'url|mime')
  const res = await fetch(api, { headers: { 'User-Agent': 'ATOMLAB/1.0 (education)' } })
  const text = await res.text()
  if (!text.startsWith('{')) throw new Error(text.slice(0, 80))
  const data = JSON.parse(text)
  const page = Object.values(data.query?.pages ?? {})[0]
  if (page?.missing) return null
  const info = page?.imageinfo?.[0]
  if (!info?.url) return null
  if (info.mime === 'image/svg+xml') return null
  return info.url
}

const results = {}
for (const sym of Object.keys(CANDIDATES)) {
  for (const fn of CANDIDATES[sym]) {
    await sleep(1500)
    try {
      const url = await resolveFileUrl(fn)
      if (url) {
        results[sym] = url
        console.log(`${sym}: ${fn}`)
        break
      }
    } catch (e) {
      console.warn(`${sym}: ${e.message}`)
      await sleep(5000)
    }
  }
  if (!results[sym]) console.log(`${sym}: NONE`)
}

console.log('\n---')
for (const [sym, url] of Object.entries(results)) {
  console.log(`  ${sym}: '${url}',`)
}
