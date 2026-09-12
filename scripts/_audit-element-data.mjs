import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const raw = JSON.parse(fs.readFileSync(path.join(root, 'src/data/periodicTableRaw.json'), 'utf8'))
const { ELEMENTS } = await import(path.join(root, 'src/data/elements.ts').href).catch(() => ({}))

// Compare z/symbol between raw and elements if possible
const issues = []

for (const e of raw) {
  const fn = `${String(e.atomicNumber).padStart(3, '0')}-${e.symbol}.webp`
  const fp = path.join(root, 'public/learn/elements', fn)
  if (!fs.existsSync(fp)) issues.push(`missing webp: ${fn}`)
  const stat = fs.statSync(fp)
  if (stat.size < 500) issues.push(`tiny webp: ${fn} (${stat.size}b)`)
}

// Check neutron estimate sanity via mass
for (const e of raw) {
  if (e.atomicMass == null || e.atomicMass <= 0) issues.push(`bad mass: ${e.symbol}`)
  if (!e.symbol || e.symbol.length > 3) issues.push(`bad symbol: ${e.atomicNumber}`)
  if (!e.nameRu) issues.push(`missing nameRu: ${e.symbol}`)
}

console.log('elements', raw.length)
console.log('issues', issues.length)
for (const i of issues.slice(0, 30)) console.log(' ', i)
