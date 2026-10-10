/**
 * npm run brain:smoke — живая проверка сервера мозга по контракту v1 (без настоящей Ollama):
 *   1) сервер на свободном порту, отдельная временная папка данных; /health за ≤ 5 с, пока знания догружаются;
 *   2) CORS: OPTIONS с Origin GitHub Pages → 204, чужой Origin → 403;
 *   3) /chat SSE без LLM: химия, беседа, мат (R2 дословно), правило орг/неорг (R1 дословно), 400 на пустой запрос;
 *   4) /kb/append (дубликат → kind:dup), /kb/stats;
 *   5) появляется «Ollama» (поддельная, на этом же процессе) → без перезапуска ответы идут через llm;
 *   6) brain:embed против поддельной Ollama: векторы считаются и повторный запуск ничего не пересчитывает;
 *   7) обрыв клиента → сервер прерывает генерацию.
 * Код выхода 1, если хоть одна проверка не прошла.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const dataDir = process.env.BRAIN_SMOKE_DIR || path.join(os.tmpdir(), `atomlab-brain-smoke-${process.pid}`)
process.env.BRAIN_DATA_DIR = dataDir
const ORIGIN = 'https://sadykoffalan2105-dev.github.io'

const { loadConfig } = await import('../../brain/config.ts')
const { createBrainLazy, createServer } = await import('../../brain/server.ts')
const { MockLlm } = await import('../../brain/llm/mock.ts')
const { R1 } = await import('../../brain/pipeline/ownerRule.ts')
const { R2 } = await import('../../brain/pipeline/moderation.ts')

let failed = 0
const ok = (cond: boolean, what: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ✓' : '  ✗'} ${what}${extra ? ' — ' + extra : ''}`)
}

// ——— поддельная Ollama: /api/tags, /api/chat (NDJSON поток), /api/embed (векторы-хеши 1024)
const mock = new MockLlm({ tokenDelayMs: 2 })
let aborts = 0
const fakeOllama = http.createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', async () => {
    if (req.url === '/api/tags') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ models: [{ name: 'qwen2.5:7b-instruct' }, { name: 'qwen2.5:3b-instruct' }, { name: 'bge-m3:latest' }] }))
    }
    const j = body ? JSON.parse(body) : {}
    if (req.url === '/api/embed') {
      const vec = (s: string) => {
        const v = new Array<number>(1024).fill(0)
        for (const w of s.toLowerCase().split(/[^\p{L}\p{N}]+/u)) if (w) v[[...w].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % 1024]! += 1
        return v
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ embeddings: (j.input as string[]).map(vec) }))
    }
    if (req.url === '/api/chat') {
      const text = mock.compose(j.messages)
      if (!j.stream) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ message: { content: /Classify/.test(j.messages[0]?.content ?? '') ? 'chemistry' : text }, done: true }))
      }
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
      let closed = false
      res.on('close', () => {
        if (!res.writableEnded) {
          closed = true
          aborts++
        }
      })
      const slow = /МЕДЛЕННО/.test(JSON.stringify(j.messages))
      for (const tok of text.match(/\S+\s*/g) ?? []) {
        if (closed) return
        res.write(JSON.stringify({ message: { content: tok }, done: false }) + '\n')
        await new Promise((r) => setTimeout(r, slow ? 150 : 2))
      }
      res.end(JSON.stringify({ message: { content: '' }, done: true }) + '\n')
      return
    }
    res.writeHead(404)
    res.end()
  })
})
const listen = (srv: http.Server, port = 0) => new Promise<number>((r) => srv.listen(port, '127.0.0.1', () => r((srv.address() as { port: number }).port)))
// порт поддельной Ollama занимаем и сразу освобождаем: сначала «Ollama нет»
const probe = http.createServer()
const ollamaPort = await listen(probe)
await new Promise((r) => probe.close(r))
const ollamaUrl = `http://127.0.0.1:${ollamaPort}`

console.log(`[brain:smoke] данные: ${dataDir}`)
const t0 = performance.now()
const config = { ...loadConfig(), ollamaUrl, pollMs: 500 }
const brain = createBrainLazy({ config })
const server = createServer(brain)
const port = await listen(server)
brain.ollama?.start()
const base = `http://127.0.0.1:${port}`

type Sse = { status: number; events: { ev: string; data: Record<string, unknown> }[]; text: string; done: Record<string, unknown> | null; meta: Record<string, unknown> | null }
async function chat(q: string, headers: Record<string, string> = {}, signal?: AbortSignal): Promise<Sse> {
  const res = await fetch(`${base}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...headers },
    body: JSON.stringify({ sessionId: 'smoke', studentId: 'smoke', lang: 'auto', stream: true, messages: q ? [{ role: 'user', content: q }] : [], context: { gradeId: 'g8', mode: 'chat', detail: 'brief' } }),
    signal,
  })
  const raw = await res.text()
  const events = raw
    .split(/\n\n/)
    .map((b) => ({ ev: b.match(/^event: ?(.+)$/m)?.[1]?.trim() ?? '', data: b.match(/^data: ?(.*)$/m)?.[1] }))
    .filter((x) => x.ev && x.data !== undefined)
    .map((x) => ({ ev: x.ev, data: JSON.parse(x.data!) as Record<string, unknown> }))
  const text = events.filter((e) => e.ev === 'delta').map((e) => e.data.text as string).join('')
  return { status: res.status, events, text, done: events.find((e) => e.ev === 'done')?.data ?? null, meta: events.find((e) => e.ev === 'meta')?.data ?? null }
}

console.log('1) старт и /health')
const h0 = await (await fetch(`${base}/health`)).json()
const startMs = Math.round(performance.now() - t0)
ok(h0.ok === true && h0.service === 'atomlab-brain' && h0.contract === 1, '/health отвечает по контракту', `${startMs} мс от старта, loading=${!!h0.loading}`)
ok(startMs <= 5000, 'сервер слушает и отвечает ≤ 5 с')
ok(h0.llm?.available === false, 'без Ollama: llm.available=false')
await brain.ready

console.log('2) CORS')
const opt = await fetch(`${base}/chat`, { method: 'OPTIONS', headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST' } })
ok(opt.status === 204 && opt.headers.get('access-control-allow-origin') === ORIGIN, 'OPTIONS с Origin GitHub Pages → 204 + Allow-Origin')
const loc = await fetch(`${base}/health`, { headers: { Origin: 'http://localhost:5173' } })
ok(loc.status === 200 && loc.headers.get('access-control-allow-origin') === 'http://localhost:5173', 'Origin http://localhost:* разрешён')
const evil = await fetch(`${base}/health`, { headers: { Origin: 'https://evil.example' } })
ok(evil.status === 403, 'чужой Origin → 403')

console.log('3) /chat без LLM')
const c1 = await chat('Что такое моль?')
ok(c1.status === 200 && c1.meta?.route === 'fallback' && !!c1.done && c1.text.trim() === String(c1.done.text).trim() && /моль/i.test(c1.text), 'химия: meta → delta… → done, запасной путь', String(c1.done?.text ?? '').slice(0, 90))
const c2 = await chat('Привет! Как дела?')
ok(c2.meta?.intent === 'smalltalk' && !!c2.text, 'беседа: smalltalk', c2.text.slice(0, 80))
const c3 = await chat('бл*ть, что такое оксид?')
ok(c3.text.startsWith(R2.ru) && c3.meta?.moderated === true && /оксид/i.test(c3.text), 'мат: R2 дословно + ответ по сути')
const c4 = await chat('Чем отличается органическая химия от неорганической?')
ok(c4.done?.text === R1 && c4.done?.source === 'rule', 'орг/неорг: R1 дословно, source=rule')
const c5 = await chat('Уравняй Fe + O2 = Fe2O3')
ok(/4Fe \+ 3O₂ → 2Fe₂O₃/.test(c5.text) && c5.meta?.route === 'tool', 'расчёт: уравнивание инструментом')
const c6 = await chat('')
ok(c6.status === 400, 'пустой messages → 400')

console.log('4) база: только дописывание')
const s0 = await (await fetch(`${base}/kb/stats`)).json()
const a1 = await (await fetch(`${base}/kb/append`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'correction', lang: 'ru', title: 'Проверка smoke', text: 'Правка учителя: оксид меди(II) CuO — чёрный порошок.', tags: ['smoke'] }) })).json()
const a2 = await (await fetch(`${base}/kb/append`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'correction', lang: 'ru', text: 'Правка учителя: оксид меди(II) CuO — чёрный порошок.' }) })).json()
const s1 = await (await fetch(`${base}/kb/stats`)).json()
ok(a1.ok && /^j-[0-9A-Z]{26}$/.test(a1.id) && a2.ok && a2.dup === true && s1.journalLines === s0.journalLines + 2, '/kb/append: запись + дубликат (kind:dup), журнал +2 строки', `${s0.journalLines} → ${s1.journalLines}`)
const bad = await fetch(`${base}/kb/append`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'delete', text: 'x' }) })
ok(bad.status === 400, 'неизвестный kind → 400 (удаления нет)')

console.log('5) появилась Ollama — без перезапуска')
await listen(fakeOllama, ollamaPort)
let h1: { llm?: { available?: boolean; chatModel?: string; embedModel?: string } } = {}
for (let i = 0; i < 30; i++) {
  h1 = await (await fetch(`${base}/health`)).json()
  if (h1.llm?.available) break
  await new Promise((r) => setTimeout(r, 200))
}
ok(!!h1.llm?.available && h1.llm.chatModel === 'qwen2.5:7b-instruct' && h1.llm.embedModel === 'bge-m3:latest', '/health: llm.available=true, модели найдены опросом', JSON.stringify(h1.llm))
const c7 = await chat('Что такое валентность?')
ok(c7.meta?.route === 'llm' && c7.done?.source === 'llm' && /валентн/i.test(c7.text), 'химия идёт через LLM', c7.text.slice(0, 90))
const c8 = await chat('Вычисли молярную массу H2SO4')
ok(c8.meta?.route === 'llm' && /98[,.]0[78]/.test(c8.text), 'расчёт через LLM: число из инструмента на месте')
const c9 = await chat('What is the difference between organic and inorganic chemistry?')
ok(c9.done?.text === R1, 'правило владельца важнее LLM (R1 дословно)')

console.log('6) brain:embed против поддельной Ollama')
const runEmbed = () =>
  new Promise<string>((resolve) => {
    const p = spawn(process.execPath, [path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'), path.join(ROOT, 'scripts', 'brain', 'embed.mts')], { env: { ...process.env, BRAIN_DATA_DIR: dataDir, OLLAMA_URL: ollamaUrl }, cwd: ROOT })
    let out = ''
    p.stdout.on('data', (d) => (out += d))
    p.stderr.on('data', (d) => (out += d))
    p.on('close', () => resolve(out))
  })
const e1 = await runEmbed()
const e2 = await runEmbed()
ok(/готово: \+\d+ векторов/.test(e1) && /всё уже посчитано/.test(e2), 'эмбеддинги посчитаны, повторный запуск ничего не пересчитывает', e1.trim().split('\n').pop())

console.log('7) обрыв клиента')
const ac = new AbortController()
const before = aborts
const pending = chat('МЕДЛЕННО: расскажи подробно, что такое кислоты', {}, ac.signal).catch(() => null)
await new Promise((r) => setTimeout(r, 900))
ac.abort()
await pending
await new Promise((r) => setTimeout(r, 500))
ok(aborts > before, 'сервер прервал генерацию Ollama после обрыва клиента')

console.log('8) журнал только растёт')
const src = fs.readdirSync(path.join(ROOT, 'brain'), { recursive: true }).filter((f) => String(f).endsWith('.ts')).map((f) => fs.readFileSync(path.join(ROOT, 'brain', String(f)), 'utf8'))
const danger = src.some((s) => /\bfs\.(unlink|rm|rmdir|truncate|ftruncate)(Sync)?\(/.test(s) || /\bfs\.writeFileSync\([^)]*(journal|students|kbJournal|dialogs)/.test(s))
ok(!danger, 'в brain/** нет удаления/усечения файлов')
const lines = fs.readFileSync(path.join(dataDir, 'journal', 'dialogs.jsonl'), 'utf8').trim().split('\n').length
ok(lines >= 8, `journal/dialogs.jsonl дописан (${lines} строк)`)

brain.ollama?.stop()
server.close()
fakeOllama.close()
console.log(`\n[brain:smoke] ${failed ? `ПРОВАЛ: ${failed}` : 'всё прошло'} · данные проверки: ${dataDir}`)
process.exit(failed ? 1 : 0)
