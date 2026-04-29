import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Atom3D } from '../src/types/chemistry'

type PubChemGeometry = {
  atoms: Atom3D[]
  bonds: Array<[number, number]>
  source: {
    cid: number
    recordType: '3d'
    query: string
  }
}

type Report = {
  total: number
  ok3d: number
  cidNotFound: number
  geometryNotFound: number
  failures: Array<{ id: string; nameRu: string; formulaUnicode: string; reason: string }>
}

const PUBCHEM = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug'

function formulaUnicodeToAscii(s: string): string {
  const map: Record<string, string> = {
    '₀': '0',
    '₁': '1',
    '₂': '2',
    '₃': '3',
    '₄': '4',
    '₅': '5',
    '₆': '6',
    '₇': '7',
    '₈': '8',
    '₉': '9',
  }
  return s
    .replaceAll('·', '.') // hydrate dot
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .replaceAll('(', '')
    .replaceAll(')', '')
}

function formulaToCounts(formula: string): Record<string, number> {
  // Accepts strings like "Fe3O4", "H2O", "CaH2C2O6", "CuSO4.5H2O".
  // Dots/hydrates are treated as sum of parts; leading multipliers are supported (e.g. "5H2O").
  const out: Record<string, number> = {}
  const parts = formula.split('.').filter(Boolean)
  for (const raw of parts) {
    const m = raw.match(/^(\d+)(.*)$/)
    const mult = m ? Number.parseInt(m[1]!, 10) : 1
    const s = (m ? m[2]! : raw).trim()
    const re = /([A-Z][a-z]?)(\d*)/g
    let mm: RegExpExecArray | null
    while ((mm = re.exec(s))) {
      const el = mm[1]!
      const n = mm[2] ? Number.parseInt(mm[2]!, 10) : 1
      out[el] = (out[el] ?? 0) + n * mult
    }
  }
  return out
}

function countsKey(counts: Record<string, number>): string {
  return Object.keys(counts)
    .filter((k) => (counts[k] ?? 0) > 0)
    .sort((a, b) => a.localeCompare(b))
    .map((k) => `${k}${counts[k]}`)
    .join('')
}

function normalizeFormulaForCompare(formula: string): string {
  // Canonicalize to a sorted element-count signature for robust matching.
  return countsKey(formulaToCounts(formulaUnicodeToAscii(formula)))
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}

async function fetchJson(url: string): Promise<unknown> {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), 15000)
  const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: ac.signal })
  clearTimeout(t)
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`)
  return await r.json()
}

function extractCidList(j: unknown): number[] {
  if (!j || typeof j !== 'object') return []
  const root = j as Record<string, unknown>
  const ident = root['IdentifierList']
  if (!ident || typeof ident !== 'object') return []
  const cid = (ident as Record<string, unknown>)['CID']
  if (!Array.isArray(cid)) return []
  return cid.filter((x): x is number => typeof x === 'number')
}

function extractMolecularFormula(j: unknown): string | null {
  if (!j || typeof j !== 'object') return null
  const root = j as Record<string, unknown>
  const pt = root['PropertyTable']
  if (!pt || typeof pt !== 'object') return null
  const props = (pt as Record<string, unknown>)['Properties']
  if (!Array.isArray(props) || props.length === 0) return null
  const p0 = props[0]
  if (!p0 || typeof p0 !== 'object') return null
  const mf = (p0 as Record<string, unknown>)['MolecularFormula']
  return typeof mf === 'string' && mf.trim() ? mf.trim() : null
}

async function fetchText(url: string): Promise<string> {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), 20000)
  const r = await fetch(url, { headers: { Accept: 'chemical/x-mdl-sdfile,text/plain,*/*' }, signal: ac.signal })
  clearTimeout(t)
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`)
  return await r.text()
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function withRetry<T>(fn: () => Promise<T>, opts: { tries: number; baseDelayMs: number }): Promise<T> {
  let lastErr: unknown = null
  for (let i = 0; i < opts.tries; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      const backoff = opts.baseDelayMs * Math.pow(2, i)
      await sleep(backoff + Math.floor(Math.random() * 120))
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('retry failed')
}

async function resolveCidsByFormula(formulaAscii: string): Promise<number[]> {
  const q = encodeURIComponent(formulaAscii)
  const urlFast = `${PUBCHEM}/compound/fastformula/${q}/cids/JSON`
  const urlSlow = `${PUBCHEM}/compound/formula/${q}/cids/JSON`
  const tryUrl = async (url: string) => {
    const j = await withRetry(() => fetchJson(url), { tries: 3, baseDelayMs: 250 })
    return extractCidList(j)
  }
  try {
    const c1 = await tryUrl(urlFast)
    if (c1.length) return c1
  } catch {
    // ignore
  }
  try {
    const c2 = await tryUrl(urlSlow)
    return c2
  } catch {
    return []
  }
}

async function resolveCidByName(query: string): Promise<number[]> {
  const q = encodeURIComponent(query)
  const url = `${PUBCHEM}/compound/name/${q}/cids/JSON`
  try {
    const j = await withRetry(() => fetchJson(url), { tries: 3, baseDelayMs: 250 })
    return extractCidList(j)
  } catch {
    return []
  }
}

async function fetchMolecularFormula(cid: number): Promise<string | null> {
  const url = `${PUBCHEM}/compound/cid/${cid}/property/MolecularFormula/JSON`
  try {
    const j = await withRetry(() => fetchJson(url), { tries: 3, baseDelayMs: 250 })
    return extractMolecularFormula(j)
  } catch {
    return null
  }
}

async function pickCidByFormulaValidation(
  candidates: number[],
  expectedFormulaUnicode: string,
): Promise<number | null> {
  if (!candidates.length) return null
  const expectedKey = normalizeFormulaForCompare(expectedFormulaUnicode)
  for (let i = 0; i < Math.min(24, candidates.length); i++) {
    const cid = candidates[i]!
    const f = await fetchMolecularFormula(cid)
    if (!f) continue
    const gotKey = normalizeFormulaForCompare(f)
    if (gotKey === expectedKey) return cid
  }
  // If no exact composition match, at least reject obvious mismatches by returning null.
  return null
}

async function resolveCid(compound: { id: string; formulaUnicode: string; nameRu: string }): Promise<{ cid: number; query: string } | null> {
  const q1 = formulaUnicodeToAscii(compound.formulaUnicode)
  if (q1) {
    const cids = await resolveCidsByFormula(q1)
    const picked = await pickCidByFormulaValidation(cids, compound.formulaUnicode)
    if (picked) return { cid: picked, query: q1 }
  }

  const cids2 = await resolveCidByName(compound.id)
  const picked2 = await pickCidByFormulaValidation(cids2, compound.formulaUnicode)
  if (picked2) return { cid: picked2, query: compound.id }

  const cids3 = await resolveCidByName(compound.nameRu)
  const picked3 = await pickCidByFormulaValidation(cids3, compound.formulaUnicode)
  if (picked3) return { cid: picked3, query: compound.nameRu }

  return null
}

function parseSdf(sdf: string): { atoms: Atom3D[]; bonds: Array<[number, number]> } | null {
  const lines = sdf.replaceAll('\r\n', '\n').split('\n')
  if (lines.length < 5) return null
  const counts = lines[3]
  if (!counts) return null
  const na = Number.parseInt(counts.slice(0, 3).trim(), 10)
  const nb = Number.parseInt(counts.slice(3, 6).trim(), 10)
  if (!Number.isFinite(na) || !Number.isFinite(nb) || na <= 0) return null
  const atomStart = 4
  const bondStart = atomStart + na
  if (lines.length < bondStart + nb) return null

  const atoms: Atom3D[] = []
  for (let i = 0; i < na; i++) {
    const ln = lines[atomStart + i] ?? ''
    const x = Number.parseFloat(ln.slice(0, 10).trim())
    const y = Number.parseFloat(ln.slice(10, 20).trim())
    const z = Number.parseFloat(ln.slice(20, 30).trim())
    const sym = ln.slice(31, 34).trim()
    if (!sym) return null
    atoms.push({ symbol: sym, pos: [x, y, z] })
  }

  const bonds: Array<[number, number]> = []
  for (let i = 0; i < nb; i++) {
    const ln = lines[bondStart + i] ?? ''
    const a = Number.parseInt(ln.slice(0, 3).trim(), 10) - 1
    const b = Number.parseInt(ln.slice(3, 6).trim(), 10) - 1
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0) continue
    const i0 = Math.min(a, b)
    const j0 = Math.max(a, b)
    if (i0 === j0) continue
    bonds.push([i0, j0])
  }

  // de-dup
  const seen = new Set<string>()
  const uniq: Array<[number, number]> = []
  for (const [a, b] of bonds) {
    const k = `${a},${b}`
    if (seen.has(k)) continue
    seen.add(k)
    uniq.push([a, b])
  }

  return { atoms, bonds: uniq }
}

function typicalValence(sym: string): number {
  const s = sym.toUpperCase()
  if (s === 'H') return 1
  if (s === 'F' || s === 'CL' || s === 'BR' || s === 'I') return 1
  if (s === 'O') return 2
  if (s === 'N') return 3
  if (s === 'C') return 4
  if (s === 'P') return 5
  if (s === 'S') return 6
  // metals / common centers
  if (['NA', 'K', 'LI', 'CS', 'AG'].includes(s)) return 1
  if (['MG', 'CA', 'BA', 'SR', 'ZN', 'CU', 'FE', 'PB', 'SN', 'MN', 'NI', 'CO', 'AL', 'CR'].includes(s)) return 4
  return 3
}

function ensureConnectedBonds(atoms: Atom3D[], bonds: Array<[number, number]>): Array<[number, number]> {
  const n = atoms.length
  if (n <= 1) return bonds
  if (bonds.length > 0) return bonds

  // Build a simple valence-capped MST by Euclidean distance.
  const deg = new Array<number>(n).fill(0)
  const cap = atoms.map((a) => typicalValence(a.symbol))
  const edges: Array<{ a: number; b: number; d: number }> = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const p = atoms[i]!.pos
      const q = atoms[j]!.pos
      const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
      edges.push({ a: i, b: j, d })
    }
  }
  edges.sort((e1, e2) => e1.d - e2.d)

  const parent = new Array<number>(n).fill(0).map((_, i) => i)
  const find = (x: number): number => {
    let r = x
    while (parent[r] !== r) r = parent[r]!
    // path compress
    let y = x
    while (parent[y] !== y) {
      const p = parent[y]!
      parent[y] = r
      y = p
    }
    return r
  }
  const unite = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[rb] = ra
  }

  const out: Array<[number, number]> = []
  for (const e of edges) {
    if (out.length >= n - 1) break
    if (find(e.a) === find(e.b)) continue
    if (deg[e.a]! >= cap[e.a]!) continue
    if (deg[e.b]! >= cap[e.b]!) continue
    out.push([e.a, e.b])
    deg[e.a]++
    deg[e.b]++
    unite(e.a, e.b)
  }

  // If valence caps prevented full connectivity, relax caps greedily.
  if (out.length < n - 1) {
    for (const e of edges) {
      if (out.length >= n - 1) break
      if (find(e.a) === find(e.b)) continue
      out.push([e.a, e.b])
      unite(e.a, e.b)
    }
  }

  return out
}

function centerAndNormalize(atoms: Atom3D[], targetRadius: number): Atom3D[] {
  if (atoms.length === 0) return atoms
  let cx = 0, cy = 0, cz = 0
  for (const a of atoms) {
    cx += a.pos[0]; cy += a.pos[1]; cz += a.pos[2]
  }
  cx /= atoms.length; cy /= atoms.length; cz /= atoms.length
  let m = 0
  const out = atoms.map((a) => {
    const x = a.pos[0] - cx
    const y = a.pos[1] - cy
    const z = a.pos[2] - cz
    m = Math.max(m, Math.hypot(x, y, z))
    return { symbol: a.symbol, pos: [x, y, z] as const }
  })
  if (m < 1e-8) return out
  const s = targetRadius / m
  return out.map((a) => ({ symbol: a.symbol, pos: [a.pos[0] * s, a.pos[1] * s, a.pos[2] * s] as const }))
}

function addSaltInterIonBonds(
  atoms: Atom3D[],
  bonds: Array<[number, number]>,
): Array<[number, number]> {
  const isCation = (sym: string) => {
    const s = sym.toUpperCase()
    return ['NA','K','LI','CS','AG','MG','CA','BA','SR','ZN','CU','FE','PB','SN','MN','NI','CO','AL','CR','NH4'].includes(s)
  }
  const isAnchor = (sym: string) => {
    const s = sym.toUpperCase()
    return s === 'O' || s === 'N' || s === 'S' || s === 'F' || s === 'CL' || s === 'BR' || s === 'I' || s === 'P'
  }

  const cations: number[] = []
  const anchors: number[] = []
  for (let i = 0; i < atoms.length; i++) {
    const sym = atoms[i]!.symbol
    if (isCation(sym)) cations.push(i)
    if (isAnchor(sym)) anchors.push(i)
  }
  if (cations.length === 0 || anchors.length === 0) return bonds

  const seen = new Set(bonds.map(([a, b]) => `${a},${b}`))
  const out = [...bonds]
  for (const ci of cations) {
    const p = atoms[ci]!.pos
    const scored = anchors
      .filter((ai) => ai !== ci)
      .map((ai) => {
        const q = atoms[ai]!.pos
        const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
        return { ai, d }
      })
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
    for (const { ai } of scored) {
      const a = Math.min(ci, ai)
      const b = Math.max(ci, ai)
      const k = `${a},${b}`
      if (seen.has(k)) continue
      seen.add(k)
      out.push([a, b])
    }
  }
  return out
}

async function main() {
  // Prevent any in-repo debug instrumentation from stalling this script.
  // Some modules emit fetch logs to localhost; here we short-circuit those.
  const realFetch = globalThis.fetch.bind(globalThis)
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input instanceof Request
            ? input.url
            : ''
    if (typeof url === 'string' && url.startsWith('http://127.0.0.1:7401/')) {
      return Promise.resolve(new Response(''))
    }
    return realFetch(input, init)
  }

  const { compoundById } = await import('../src/data/compounds')

  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const outJsonPath = path.resolve(__dirname, '..', 'src', 'data', 'pubchemGeometryById.json')
  const outReportPath = path.resolve(__dirname, '..', 'src', 'data', 'pubchemGeometryReport.json')
  const outQualityPath = path.resolve(__dirname, '..', 'src', 'data', 'pubchemGeometryQualityReport.json')

  const ids = Object.keys(compoundById).sort()
  const report: Report = { total: ids.length, ok3d: 0, cidNotFound: 0, geometryNotFound: 0, failures: [] }

  const out: Record<string, PubChemGeometry> = {}
  const quality: Record<
    string,
    {
      id: string
      formulaUnicode: string
      expectedKey: string
      source: 'pubchem3d' | 'missing'
      cid?: number
      query?: string
      molecularFormula?: string
      gotKey?: string
      atoms?: number
      bonds?: number
      bondsRecovered?: boolean
      formulaMatch?: boolean
      reason?: string
    }
  > = {}

  for (let idx = 0; idx < ids.length; idx++) {
    const id = ids[idx]!
    const c = compoundById[id]!
    try {
      if (idx % 5 === 0) {
        console.log(`[${idx}/${ids.length}] processing ${id} (${c.formulaUnicode})`)
      }

      const expectedKey = normalizeFormulaForCompare(c.formulaUnicode)
      const resolved = await resolveCid({ id: c.id, formulaUnicode: c.formulaUnicode, nameRu: c.nameRu })
      if (!resolved) {
        report.cidNotFound++
        report.failures.push({ id, nameRu: c.nameRu, formulaUnicode: c.formulaUnicode, reason: 'CID not found' })
        quality[id] = { id, formulaUnicode: c.formulaUnicode, expectedKey, source: 'missing', reason: 'CID not found' }
        continue
      }

      const cid = resolved.cid
      const mf = await fetchMolecularFormula(cid)
      const gotKey = mf ? normalizeFormulaForCompare(mf) : null
      let sdf: string | null = null
      try {
        sdf = await withRetry(() => fetchText(`${PUBCHEM}/compound/cid/${cid}/SDF?record_type=3d`), { tries: 3, baseDelayMs: 400 })
      } catch {
        sdf = null
      }
      if (!sdf) {
        report.geometryNotFound++
        report.failures.push({ id, nameRu: c.nameRu, formulaUnicode: c.formulaUnicode, reason: `3D SDF not found for CID ${cid}` })
        quality[id] = { id, formulaUnicode: c.formulaUnicode, expectedKey, source: 'missing', cid, query: resolved.query, molecularFormula: mf ?? undefined, gotKey: gotKey ?? undefined, reason: `3D SDF not found for CID ${cid}` }
        continue
      }

      const parsed = parseSdf(sdf)
      if (!parsed) {
        report.geometryNotFound++
        report.failures.push({ id, nameRu: c.nameRu, formulaUnicode: c.formulaUnicode, reason: `SDF parse failed for CID ${cid}` })
        quality[id] = { id, formulaUnicode: c.formulaUnicode, expectedKey, source: 'missing', cid, query: resolved.query, molecularFormula: mf ?? undefined, gotKey: gotKey ?? undefined, reason: `SDF parse failed for CID ${cid}` }
        continue
      }

      const atoms = centerAndNormalize(parsed.atoms, 0.92)
      const hadBonds = parsed.bonds.length > 0
      let bonds = ensureConnectedBonds(atoms, parsed.bonds)
      if (c.category === 'salt') bonds = addSaltInterIonBonds(atoms, bonds)

      out[id] = {
        atoms,
        bonds,
        source: { cid, recordType: '3d', query: resolved.query },
      }
      report.ok3d++
      quality[id] = {
        id,
        formulaUnicode: c.formulaUnicode,
        expectedKey,
        source: 'pubchem3d',
        cid,
        query: resolved.query,
        molecularFormula: mf ?? undefined,
        gotKey: gotKey ?? undefined,
        atoms: atoms.length,
        bonds: bonds.length,
        bondsRecovered: !hadBonds && bonds.length > 0,
        formulaMatch: !!(gotKey && gotKey === expectedKey),
      }
    } catch (e) {
      report.failures.push({
        id,
        nameRu: c.nameRu,
        formulaUnicode: c.formulaUnicode,
        reason: `Unexpected error: ${errMsg(e)}`,
      })
      quality[id] = {
        id,
        formulaUnicode: c.formulaUnicode,
        expectedKey: normalizeFormulaForCompare(c.formulaUnicode),
        source: 'missing',
        reason: `Unexpected error: ${errMsg(e)}`,
      }
    }

    // progress every 25
    if (idx % 25 === 0) {
      console.log(`[${idx}/${ids.length}] ok3d=${report.ok3d} cidMiss=${report.cidNotFound} geomMiss=${report.geometryNotFound}`)
    }

    // Be polite to PubChem (rate limiting)
    await sleep(80)
  }

  await fs.writeFile(outJsonPath, JSON.stringify(out, null, 2), 'utf8')
  await fs.writeFile(outReportPath, JSON.stringify(report, null, 2), 'utf8')
  await fs.writeFile(outQualityPath, JSON.stringify(quality, null, 2), 'utf8')

  console.log(`Wrote ${Object.keys(out).length} geometries to ${outJsonPath}`)
  console.log(`Wrote report to ${outReportPath}`)
  console.log(`Wrote quality report to ${outQualityPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})

