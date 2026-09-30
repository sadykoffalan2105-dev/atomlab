/**
 * Фокус-урок: одна сцена + панель инструментов.
 * npx tsx scripts/test-learn-focus-layout.mts
 */
import assert from 'node:assert/strict'

// Простое localStorage в памяти — модуль читает его в try/catch.
const mem = new Map<string, string>()
;(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
}

const ws = await import('../src/components/learn/studio/studioWorkspaces.ts')
const { messagesRu } = await import('../src/i18n/messagesRu.ts')
const { messagesEn } = await import('../src/i18n/messagesEn.ts')
const { messagesUz } = await import('../src/i18n/messagesUz.ts')

let ok = 0
const check = (name: string, fn: () => void) => {
  fn()
  ok++
  console.log('✓', name)
}

check('сцена режима не дублируется во вкладках панели', () => {
  for (const w of ws.STUDIO_WORKSPACES) {
    assert.ok(!ws.FOCUS_TOOLS[w].includes(ws.FOCUS_STAGE[w]), w)
  }
})

check('в каждом режиме доступны тест/класс, 3D-каталог и рабочая зона', () => {
  for (const w of ws.STUDIO_WORKSPACES) {
    const all = new Set([ws.FOCUS_STAGE[w], ...ws.FOCUS_TOOLS[w]])
    for (const t of ['cockpit', '3d', 'work'] as const) assert.ok(all.has(t), `${w}: нет ${t}`)
  }
})

check('сцены: Урок → 3D, Доска → рабочая зона, ИИ → ИИ-учитель', () => {
  assert.deepEqual(ws.FOCUS_STAGE, { teach: '3d', board: 'work', ai: 'assistant' })
})

check('панель по умолчанию: урок и ИИ — «Тест и класс», доска — скрыта', () => {
  mem.clear()
  assert.deepEqual(ws.readFocusPanelPrefs(), { teach: 'cockpit', board: null, ai: 'cockpit' })
})

check('панель запоминает вкладку и отбрасывает чужие/битые значения', () => {
  mem.clear()
  ws.writeFocusPanelPrefs({ teach: 'work', board: '3d', ai: null })
  assert.deepEqual(ws.readFocusPanelPrefs(), { teach: 'work', board: '3d', ai: null })
  mem.set('atomlab-learn-focus-panel-v1', JSON.stringify({ teach: '3d', board: 'bogus', ai: 'work' }))
  // '3d' — сцена «Урока», во вкладках её нет → значение по умолчанию
  assert.deepEqual(ws.readFocusPanelPrefs(), { teach: 'cockpit', board: null, ai: 'work' })
  mem.set('atomlab-learn-focus-panel-v1', '{oops')
  assert.deepEqual(ws.readFocusPanelPrefs(), ws.FOCUS_PANEL_DEFAULTS)
})

check('«Запомнить выбор»: урок без своего режима берёт запомненный, иначе спрашивает', () => {
  mem.clear()
  assert.equal(ws.initialLessonWorkspace('g7/c1/s01'), null)
  ws.writeDefaultWorkspace('board')
  assert.equal(ws.initialLessonWorkspace('g7/c1/s01'), 'board')
  ws.writeLessonWorkspace('g7/c1/s01', 'ai')
  assert.equal(ws.initialLessonWorkspace('g7/c1/s01'), 'ai')
  ws.writeDefaultWorkspace(null)
  assert.equal(ws.readDefaultWorkspace(), null)
  assert.equal(ws.initialLessonWorkspace('g7/c1/s02'), null)
})

check('тексты фокус-урока есть на ru / en / uz', () => {
  const keys = Object.keys(messagesRu).filter((k) => k.startsWith('learn.focus.'))
  assert.ok(keys.length >= 25, `мало ключей: ${keys.length}`)
  for (const k of keys) {
    const key = k as keyof typeof messagesRu
    assert.ok(messagesEn[key]?.trim(), `en: ${k}`)
    assert.ok(messagesUz[key]?.trim(), `uz: ${k}`)
  }
})

console.log(`\nOK: ${ok} проверок`)
