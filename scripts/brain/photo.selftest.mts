/**
 * npx tsx scripts/brain/photo.selftest.mts — «сфотографируй задачу» без настоящей Ollama (входит в brain:server-selftest):
 *   1) проверка фото до конвейера: число, размер после декодирования, сигнатура JPEG/PNG/WebP, «data:»-префикс;
 *      подпись «ничего не спрашивает» (только фото, «привет», «реши»);
 *   2) поддельная Ollama на 127.0.0.1:8796 (BRAIN_PHOTO_SELFTEST_PORT; занят — свободный порт): /api/tags, /api/show
 *      (capabilities с 'vision' или без), /api/chat пишет тела запросов. Фото доходят до /api/chat ТОЛЬКО у модели
 *      со зрением; без зрения — честная фраза на языке ученика (reason 'no_vision') и ответ на текст подписи;
 *   3) mock-LLM: картинки доходят до «модели» со зрением, класс длины normal/long, подсказка «ФОТО: …»;
 *   4) журнал диалогов: флаг hasImage, самих картинок нет.
 * Код выхода 1, если хоть одна проверка не прошла.
 */
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

const PORT = Number(process.env.BRAIN_PHOTO_SELFTEST_PORT || 8796)
const dataDir = path.join(os.tmpdir(), `atomlab-brain-photo-selftest-${process.pid}`)
process.env.BRAIN_DATA_DIR = dataDir
process.env.BRAIN_NO_WARM = '1'
delete process.env.BRAIN_PROFILE
delete process.env.BRAIN_NO_DIALOG_LOG

const { DEFAULT_CONFIG, FILES, loadConfig } = await import('../../brain/config.ts')
const { createBrainLazy } = await import('../../brain/server.ts')
const { OllamaClient } = await import('../../brain/llm/ollama.ts')
const { MockLlm } = await import('../../brain/llm/mock.ts')
const { checkChatImages, imageKind, photoLimits } = await import('../../brain/http/photo.ts')
const { runChat } = await import('../../brain/pipeline/chat.ts')
const { isBarePhotoText, NO_VISION_REPLY } = await import('../../brain/pipeline/photo.ts')
type ChatRequest = import('../../brain/pipeline/chat.ts').ChatRequest
type DoneEvent = import('../../brain/pipeline/chat.ts').DoneEvent
type MetaEvent = import('../../brain/pipeline/chat.ts').MetaEvent
type BrainDeps = import('../../brain/pipeline/chat.ts').BrainDeps

let failed = 0
let passed = 0
const ok = (cond: boolean, what: string, extra = '') => {
  if (cond) passed++
  else failed++
  console.log(`${cond ? '  ✓' : '  ✗'} ${what}${extra ? ' — ' + extra : ''}`)
}

// «фото»: сигнатура JPEG + немного байт (содержимое Ollama-подделке не важно)
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]), Buffer.alloc(300, 7)]).toString('base64')
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]).toString('base64')
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x10, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(40, 2)]).toString('base64')
const gif = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(64, 3)]).toString('base64')

// ——— 1) проверка фото
console.log('1) проверка фото до конвейера')
const lim = photoLimits({})
const body = (images: unknown) => ({ messages: [{ role: 'user', content: 'реши', images }] })
ok(imageKind(Buffer.from(jpeg, 'base64')) === 'jpeg' && imageKind(Buffer.from(png, 'base64')) === 'png' && imageKind(Buffer.from(webp, 'base64')) === 'webp', 'сигнатуры JPEG / PNG / WebP')
ok(imageKind(Buffer.from(gif, 'base64')) === null, 'GIF и прочее — не принимается')
const c1 = checkChatImages(body([jpeg, png]), lim)
ok(c1.ok && c1.images.length === 2, 'два фото — можно')
const c3 = checkChatImages(body([jpeg, png, webp]), lim)
ok(!c3.ok && c3.status === 400 && c3.code === 'too_many_images', 'три фото — 400')
const huge = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(lim.maxImageBytes, 1)]).toString('base64')
const cH = checkChatImages(body([huge]), lim)
ok(!cH.ok && cH.status === 413, 'фото больше 1,5 МБ — 413')
const cG = checkChatImages(body([gif]), lim)
ok(!cG.ok && cG.status === 415, 'не JPEG/PNG/WebP (GIF) — 415')
const cD = checkChatImages(body([`data:image/jpeg;base64,${jpeg}`]), lim)
ok(cD.ok && cD.images[0] === jpeg, '«data:image/jpeg;base64,» снимается')
const cB = checkChatImages(body(['@@@не base64@@@']), lim)
ok(!cB.ok && cB.status === 400, 'не base64 — 400')
ok(checkChatImages({ messages: [{ role: 'user', content: 'моль' }] }, lim).ok && (checkChatImages({ messages: [{ role: 'user', content: 'моль' }] }, lim) as { images: string[] }).images.length === 0, 'без фото — обычный вопрос (старые клиенты)')
ok(isBarePhotoText('') && isBarePhotoText('Объясни задачу') && isBarePhotoText('Объясни задачу на фото') && isBarePhotoText('привет') && isBarePhotoText('реши пожалуйста'), 'подпись без вопроса: пусто / «Объясни задачу» / «привет» / «реши»')
ok(!isBarePhotoText('Найди массу 2 моль NaCl') && !isBarePhotoText('объясни, почему кислота реагирует с металлом'), 'подпись с вопросом по химии — вопрос')

// ——— 2) поддельная Ollama
console.log('2) поддельная Ollama: фото — только модели со зрением')
type ChatBody = { model: string; stream?: boolean; messages: { role: string; content: string; images?: string[] }[] }
const seen: ChatBody[] = []
let models: { name: string; caps: string[] }[] = []
const fake = http.createServer((req, res) => {
  const chunks: Buffer[] = []
  req.on('data', (c: Buffer) => chunks.push(c))
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8')
    const j = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    const send = (status: number, o: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(o))
    }
    if (req.url === '/api/tags') return send(200, { models: models.map((m) => ({ name: m.name })) })
    if (req.url === '/api/ps') return send(200, { models: [] })
    if (req.url === '/api/show') {
      const m = models.find((x) => x.name === j.model)
      return m ? send(200, { capabilities: m.caps }) : send(404, { error: 'not found' })
    }
    if (req.url === '/api/chat') {
      const b = j as unknown as ChatBody
      seen.push(b)
      const photo = b.messages.some((m) => m.images?.length)
      const text = photo
        ? 'На фото задача: дано 2 моль хлорида натрия, найти массу. Решение: m = n·M = 2 · 58,5 = 117 г. Ответ: масса 117 г — молярная масса берётся из таблицы Менделеева.'
        : 'Масса вещества равна количеству вещества, умноженному на молярную массу: m = n·M. Для хлорида натрия молярная масса 58,5 г/моль, поэтому считаем по формуле и пишем ответ с единицами.'
      if (b.stream === false) return send(200, { message: { role: 'assistant', content: 'chemistry' }, done: true })
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
      for (const w of text.match(/\S+\s*/g) ?? []) res.write(JSON.stringify({ message: { role: 'assistant', content: w }, done: false }) + '\n')
      res.end(JSON.stringify({ message: { role: 'assistant', content: '' }, done: true, prompt_eval_count: 42, prompt_eval_duration: 1e6 }) + '\n')
      return
    }
    send(404, { error: 'not found' })
  })
})
const port = await new Promise<number>((resolve, reject) => {
  fake.once('listening', () => resolve((fake.address() as { port: number }).port))
  fake.once('error', (err: NodeJS.ErrnoException) => {
    if (err.code !== 'EADDRINUSE') return reject(err)
    console.log(`  (порт ${PORT} занят — беру свободный)`)
    fake.once('error', reject)
    fake.listen(0, '127.0.0.1')
  })
  fake.listen(PORT, '127.0.0.1')
})
console.log(`  поддельная Ollama: 127.0.0.1:${port}`)

const base = loadConfig()
const cfgFor = (model: string) => ({ ...base, ollamaUrl: `http://127.0.0.1:${port}`, chatModels: [model], fastModels: [model], dialog: { ...base.dialog, profile: 'laptop' as const } })
const brainV = createBrainLazy({ llm: new OllamaClient(cfgFor('gemma4:12b')), config: cfgFor('gemma4:12b') })
await brainV.ready
const depsOf = (llm: BrainDeps['llm'], noJournal = true): BrainDeps => ({ ...brainV.deps, llm, noJournal })

type Run = { done: DoneEvent; meta: MetaEvent | null; text: string }
async function run(deps: BrainDeps, content: string, images?: string[], extra: Partial<ChatRequest> = {}): Promise<Run> {
  let meta: MetaEvent | null = null
  let text = ''
  const req: ChatRequest = {
    sessionId: 'photo-selftest',
    studentId: 'photo-selftest',
    lang: 'ru',
    stream: true,
    messages: [{ role: 'user', content }],
    context: { gradeId: 'g8', mode: 'chat', detail: 'brief' },
    ...(images ? { images, hasImage: true } : {}),
    ...extra,
  }
  const done = await runChat(req, deps, { meta: (m) => (meta ??= m), delta: (t) => (text += t), done: () => {}, error: () => {} })
  return { done, meta, text }
}

// модель со зрением
models = [{ name: 'gemma4:12b', caps: ['completion', 'vision'] }]
const vis = new OllamaClient(cfgFor('gemma4:12b'))
await vis.refresh()
ok((await vis.ensureCapabilities()) === true && vis.status().vision === true, '/api/show capabilities ∋ vision → status().vision', JSON.stringify(vis.status().vision))
seen.length = 0
const rv = await run(depsOf(vis), 'Объясни задачу', [jpeg])
const answerReq = seen.find((b) => b.stream !== false)
const lastMsg = answerReq?.messages[answerReq.messages.length - 1]
ok(lastMsg?.role === 'user' && lastMsg.images?.length === 1 && lastMsg.images[0] === jpeg, 'фото ушло в /api/chat у реплики ученика (base64 без «data:»)')
ok(seen.every((b) => b.messages.slice(0, -1).every((m) => !m.images)), 'фото — только у последней реплики')
ok(/^ФОТО: на фото задача\/тетрадь ученика: прочитай условие, перепиши его кратко, реши по шагам по школьной программе Kimyo 8 класса/.test(lastMsg?.content ?? ''), 'подсказка «ФОТО: … Kimyo 8 класса» первой строкой', (lastMsg?.content ?? '').slice(0, 90))
ok(rv.done.route === 'llm' && rv.done.plan?.lengthClass === 'normal' && rv.meta?.intent === 'homework' && /117 г/.test(rv.done.text), 'ответ модели: route llm, класс normal, решение по шагам', `${rv.done.route}/${rv.done.plan?.lengthClass}`)
const rvMore = await run(depsOf(vis), 'Объясни задачу', [jpeg], { context: { gradeId: 'g9', mode: 'chat', detail: 'more' } })
ok(rvMore.done.plan?.lengthClass === 'long', '«подробнее» (detail more) → класс long')
const rvUz = await run(depsOf(vis), '', [jpeg], { lang: 'uz' })
const uzMsg = seen.filter((b) => b.stream !== false).at(-1)?.messages.at(-1)
ok(/^RASM: rasmda/.test(uzMsg?.content ?? '') && uzMsg?.images?.length === 1, 'uz: подсказка RASM и фото', (uzMsg?.content ?? '').slice(0, 40))
void rvUz

// подпись с матом: R2 — первой фразой, и с фото
const rvRude = await run(depsOf(vis), 'бля, реши задачу', [jpeg])
ok(rvRude.done.text.startsWith('Пожалуйста, выражайтесь корректно') && rvRude.meta?.moderated === true, 'мат в подписи: R2 первой фразой', rvRude.done.text.slice(0, 60))
// правило владельца — дословно, фото не мешает
const rvOwner = await run(depsOf(vis), 'Чем органическая химия отличается от неорганической?', [jpeg])
ok(rvOwner.done.route === 'rule' && rvOwner.done.text.startsWith('Извините, но в соответствии с внутренним регламентом'), 'правило владельца — дословно и с фото')

// модель без зрения
models = [{ name: 'qwen2.5:14b-instruct', caps: ['completion', 'tools'] }]
const txt = new OllamaClient(cfgFor('qwen2.5:14b-instruct'))
await txt.refresh()
ok((await txt.ensureCapabilities()) === false && txt.status().vision === false, 'без vision в capabilities → status().vision false')
seen.length = 0
const rn = await run(depsOf(txt), 'Объясни задачу', [jpeg])
ok(rn.done.text === NO_VISION_REPLY.ru && rn.done.reason === 'no_vision' && rn.meta?.reason === 'no_vision' && rn.done.route === 'fallback', 'только фото: честная фраза «фото не читаю», reason no_vision, route fallback', rn.done.text.slice(0, 60))
ok(seen.length === 0, 'только фото без зрения — модель не вызывается вовсе')
seen.length = 0
const rnText = await run(depsOf(txt), 'Найди массу 2 моль NaCl', [jpeg])
ok(rnText.done.text.startsWith(NO_VISION_REPLY.ru) && rnText.done.text.length > NO_VISION_REPLY.ru.length + 30 && rnText.done.reason === 'no_vision', 'подпись с вопросом: сначала честная фраза, потом ответ на текст', rnText.done.text.slice(NO_VISION_REPLY.ru.length, NO_VISION_REPLY.ru.length + 80))
ok(rnText.text.startsWith(NO_VISION_REPLY.ru), 'поток: фраза о фото — первым куском')
ok(seen.length > 0 && seen.every((b) => b.messages.every((m) => !m.images)), 'модели без зрения картинки не уходят ни в одном запросе', `${seen.length} запросов`)
const rnEn = await run(depsOf(txt), 'Explain the task', [jpeg], { lang: 'en' })
ok(rnEn.done.text === NO_VISION_REPLY.en, 'en: фраза на языке ученика')
// защита в клиенте Ollama: даже если фото дошли до chatStream, модели без зрения они не уходят
seen.length = 0
await txt.chatStream({ model: 'qwen2.5:14b-instruct', messages: [{ role: 'user', content: 'x', images: [jpeg] }], temperature: 0, numPredict: 5, numCtx: 2048, firstTokenMs: 3000, totalMs: 5000, onToken: () => {} })
ok(seen.length === 1 && !seen[0]!.messages[0]!.images, 'OllamaClient.chatStream снимает images для модели без зрения')

// ——— 3) mock-LLM
console.log('3) mock-LLM (--mock-llm): картинки доходят только до «модели со зрением»')
const mv = new MockLlm({ vision: true })
const rm = await run(depsOf(mv), 'Объясни задачу', [jpeg, png])
ok(mv.lastImages?.length === 2 && mv.lastImages[0] === jpeg && /^На фото \(2\)/.test(rm.done.text), 'mock со зрением: два фото дошли, ответ «На фото (2)…»', rm.done.text.slice(0, 60))
const mn = new MockLlm({ vision: false })
const rmn = await run(depsOf(mn), 'Объясни задачу', [jpeg])
ok(mn.calls === 0 && rmn.done.reason === 'no_vision', 'mock без зрения: модель не вызвана, reason no_vision')
const off = new MockLlm({ available: false })
const roff = await run(depsOf(off), 'Объясни задачу', [jpeg])
ok(roff.done.reason === 'llm_unavailable' && /ИИ-модель занята или недоступна/.test(roff.done.text), 'модели нет — честно «занята или недоступна», reason llm_unavailable')

// ——— 4) журнал
console.log('4) журнал диалогов: только флаг hasImage')
const lines0 = fs.existsSync(FILES.dialogs) ? fs.readFileSync(FILES.dialogs, 'utf8').split('\n').filter(Boolean).length : 0
await run(depsOf(mv, false), 'Объясни задачу', [jpeg])
await run(depsOf(mn, false), 'Найди массу 2 моль NaCl', [jpeg])
const log = fs.readFileSync(FILES.dialogs, 'utf8')
const tail = log.split('\n').filter(Boolean).slice(lines0).map((l) => JSON.parse(l) as Record<string, unknown>)
ok(tail.length === 2 && tail.every((l) => l.hasImage === true), 'обе реплики с фото помечены hasImage (и прочитанная, и «без зрения»)', `${tail.length} строк`)
ok(!log.includes(jpeg.slice(0, 40)) && !/"images":\s*\[/.test(log), 'картинок (base64) в журнале нет')
ok(DEFAULT_CONFIG.server.photo.perMin === 3 && DEFAULT_CONFIG.server.photo.perDay === 30 && DEFAULT_CONFIG.server.photo.maxImages === 2, 'умолчания: 2 фото, 3 в минуту, 30 в сутки')

fake.close()
fake.closeAllConnections?.()
try {
  fs.rmSync(dataDir, { recursive: true, force: true })
} catch {
  /* временная папка — не страшно */
}
console.log(`\n[brain:photo-selftest] ${passed} ✓, ${failed} ✗`)
process.exit(failed ? 1 : 0)
