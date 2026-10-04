#!/usr/bin/env node
/**
 * Эхо-петля учителя: распознанное эхо колонок отбрасывается, реплики ученика проходят.
 *   • 50 пар «произнесено → распознано» (эхо с искажениями STT) + 30 настоящих реплик ученика;
 *   • таймлайн DuplexVoiceSession на фейковых часах: эхо во время речи и в окне 800 мс после —
 *     не становится репликой; реплика ученика после окна — становится; жёсткая пауза без VAD.
 *
 * Запуск: npx tsx scripts/test-voice-echo.mts
 */
import assert from 'node:assert/strict'
import { SpokenPhraseLog, echoVerdict } from '../src/learn/brain/speech/echoGuard.ts'
import { DuplexVoiceSession, type RecognitionLike } from '../src/learn/brain/voice/duplexVoiceSession.ts'
import { LiveSpeechOutput, type LiveSpeechBackend } from '../src/learn/brain/voice/liveSpeechOutput.ts'
import type { TimingScheduler } from '../src/learn/brain/voice/conversationTiming.ts'
import type { LearnSpeechController } from '../src/learn/learnSpeech.ts'

let passed = 0
let failed = 0
function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++
      console.log(`  ok  ${name}`)
    })
    .catch((e) => {
      failed++
      console.error(`  FAIL ${name}\n       ${(e as Error).stack ?? e}`)
    })
}

/** prepared-текст (как произносится) → что услышал STT с искажениями. */
const ECHO_CASES: [string, string][] = [
  ['аш два о это вода', 'аш два о это вода'],
  ['аш два о это вода', 'аш два о это вада'],
  ['молярная масса серной кислоты девяносто восемь грамм на моль', 'молярная масса девяносто восемь'],
  ['молярная масса серной кислоты девяносто восемь грамм на моль', 'масса серной кислоты 98 грамм на моль'],
  ['оксиды это сложные вещества из двух элементов один из которых кислород', 'оксиды это сложные вещества из двух элементов'],
  ['оксиды это сложные вещества из двух элементов один из которых кислород', 'из двух элементов один из которых кислород'],
  ['кислоты меняют цвет лакмуса на красный', 'кислоты меняют цвет лакмуса на красный'],
  ['кислоты меняют цвет лакмуса на красный', 'кислоты меняют цвет лакмус'],
  ['валентность это способность атома присоединять определённое число других атомов', 'валентность это способность атома присоединять'],
  ['валентность это способность атома присоединять определённое число других атомов', 'способность атома присоединять определённое число'],
  ['давай разберём реакцию натрия с водой', 'давай разберём реакцию натрия с водой'],
  ['давай разберём реакцию натрия с водой', 'разберём реакцию натрия'],
  ['эн а о аш это гидроксид натрия щёлочь', 'na o h это гидроксид натрия щёлочь'],
  ['эн а о аш это гидроксид натрия щёлочь', 'это гидроксид натрия щелочь'],
  ['число авогадро шесть целых ноль два на десять в двадцать третьей', 'число авогадро шесть целых ноль два'],
  ['число авогадро шесть целых ноль два на десять в двадцать третьей', 'на десять в двадцать третьей'],
  ['периодическая система менделеева состоит из периодов и групп', 'периодическая система менделеева состоит'],
  ['периодическая система менделеева состоит из периодов и групп', 'система менделеева состоит из периодов и групп'],
  ['молодец это правильный ответ', 'молодец это правильный ответ'],
  ['молодец это правильный ответ', 'молодец правильный ответ'],
  ['а теперь скажи какая валентность у кислорода', 'теперь скажи какая валентность у кислорода'],
  ['а теперь скажи какая валентность у кислорода', 'скажи какая валентность у кислорода'],
  ['це о два это углекислый газ он не поддерживает горение', 'co2 это углекислый газ он не поддерживает горение'],
  ['це о два это углекислый газ он не поддерживает горение', 'углекислый газ он не поддерживает'],
  ['реакция замещения это когда простое вещество вытесняет элемент из сложного', 'реакция замещения это когда простое вещество'],
  ['реакция замещения это когда простое вещество вытесняет элемент из сложного', 'вытесняет элемент из сложного'],
  ['щёлочи это растворимые в воде основания', 'щелочи это растворимые в воде основания'],
  ['щёлочи это растворимые в воде основания', 'растворимые в воде основания'],
  ['смотри сначала считаем массу потом количество вещества', 'сначала считаем массу потом количество вещества'],
  ['смотри сначала считаем массу потом количество вещества', 'считаем массу потом количество'],
  ['соляная кислота это аш це эль растворённый в воде', 'соляная кислота это hcl растворенный в воде'],
  ['соляная кислота это аш це эль растворённый в воде', 'кислота это аш це эль'],
  ['ионная связь образуется между металлом и неметаллом', 'ионная связь образуется между металлом и неметаллом'],
  ['ионная связь образуется между металлом и неметаллом', 'связь образуется между металлом'],
  ['один моль любого газа занимает двадцать две целых четыре литра', 'один моль любого газа занимает'],
  ['один моль любого газа занимает двадцать две целых четыре литра', 'занимает двадцать две целых четыре литра'],
  ['электролиты проводят ток в растворе потому что распадаются на ионы', 'электролиты проводят ток в растворе'],
  ['электролиты проводят ток в растворе потому что распадаются на ионы', 'потому что распадаются на ионы'],
  ['хорошо попробуй ещё раз подумай', 'хорошо попробуй еще раз подумай'],
  ['хорошо попробуй ещё раз подумай', 'попробуй ещё раз подумай'],
  ['катион это положительный ион а анион отрицательный', 'катион это положительный ион а анион отрицательный'],
  ['катион это положительный ион а анион отрицательный', 'положительный ион а анион'],
  ['окислитель принимает электроны восстановитель отдаёт', 'окислитель принимает электроны восстановитель отдает'],
  ['окислитель принимает электроны восстановитель отдаёт', 'принимает электроны восстановитель'],
  ['степень окисления кислорода в оксидах минус два', 'степень окисления кислорода в оксидах минус два'],
  ['степень окисления кислорода в оксидах минус два', 'окисления кислорода в оксидах'],
  ['индикатор фенолфталеин в щёлочи становится малиновым', 'индикатор фенолфталеин в щелочи становится малиновым'],
  ['индикатор фенолфталеин в щёлочи становится малиновым', 'фенолфталеин в щёлочи становится'],
  ['water is h two o two hydrogen atoms and one oxygen', 'water is h2o two hydrogen atoms and one oxygen'],
  ['suv bu ha ikki o ikkita vodorod va bitta kislorod', 'suv bu h2o ikkita vodorod va bitta kislorod'],
]

/** Реплики ученика (в т. ч. близкие по теме к фразам учителя выше) — должны пройти. */
const STUDENT_CASES: [string, string][] = [
  ['аш два о это вода', 'а почему вода жидкая'],
  ['молярная масса серной кислоты девяносто восемь грамм на моль', 'а как посчитать молярную массу соли'],
  ['оксиды это сложные вещества из двух элементов один из которых кислород', 'а пероксиды тоже оксиды'],
  ['кислоты меняют цвет лакмуса на красный', 'а щёлочи в какой цвет красят'],
  ['валентность это способность атома присоединять определённое число других атомов', 'не понял объясни проще'],
  ['давай разберём реакцию натрия с водой', 'а калий тоже так реагирует'],
  ['эн а о аш это гидроксид натрия щёлочь', 'а ка о аш это что'],
  ['число авогадро шесть целых ноль два на десять в двадцать третьей', 'зачем нужно это число'],
  ['периодическая система менделеева состоит из периодов и групп', 'сколько всего периодов'],
  ['молодец это правильный ответ', 'давай следующий вопрос'],
  ['а теперь скажи какая валентность у кислорода', 'валентность два'],
  ['а теперь скажи какая валентность у кислорода', 'у кислорода валентность два'],
  ['це о два это углекислый газ он не поддерживает горение', 'а почему тогда магний горит в углекислом газе'],
  ['реакция замещения это когда простое вещество вытесняет элемент из сложного', 'приведи пример реакции обмена'],
  ['щёлочи это растворимые в воде основания', 'а нерастворимые основания как называются'],
  ['смотри сначала считаем массу потом количество вещества', 'я не понял как считать количество'],
  ['соляная кислота это аш це эль растворённый в воде', 'а серная кислота сильнее'],
  ['ионная связь образуется между металлом и неметаллом', 'а ковалентная связь это как'],
  ['один моль любого газа занимает двадцать две целых четыре литра', 'это при любой температуре'],
  ['электролиты проводят ток в растворе потому что распадаются на ионы', 'а сахар электролит'],
  ['хорошо попробуй ещё раз подумай', 'мне кажется ответ оксид меди'],
  ['катион это положительный ион а анион отрицательный', 'повтори пожалуйста'],
  ['окислитель принимает электроны восстановитель отдаёт', 'подожди стоп'],
  ['степень окисления кислорода в оксидах минус два', 'а во фториде кислорода'],
  ['индикатор фенолфталеин в щёлочи становится малиновым', 'что такое метилоранж'],
  ['water is h two o two hydrogen atoms and one oxygen', 'what is heavy water'],
  ['suv bu ha ikki o ikkita vodorod va bitta kislorod', 'kislorod qanday olinadi'],
  ['молодец это правильный ответ', 'да'],
  ['давай разберём реакцию натрия с водой', 'хорошо давай'],
  ['а теперь скажи какая валентность у кислорода', 'три'],
]

class FakeScheduler implements TimingScheduler {
  t = 0
  private seq = 0
  private timers = new Map<number, { at: number; fn: () => void }>()
  now() {
    return this.t
  }
  setTimeout(fn: () => void, ms: number): unknown {
    const id = ++this.seq
    this.timers.set(id, { at: this.t + ms, fn })
    return id
  }
  clearTimeout(h: unknown) {
    this.timers.delete(h as number)
  }
  advance(ms: number, step = 10) {
    const end = this.t + ms
    while (this.t < end) {
      this.t = Math.min(end, this.t + step)
      for (const [id, tm] of [...this.timers].sort((a, b) => a[1].at - b[1].at)) {
        if (tm.at <= this.t && this.timers.has(id)) {
          this.timers.delete(id)
          tm.fn()
        }
      }
    }
  }
}

/** Фейковая озвучка: prepare превращает H₂O → «аш два о»; говорит, пока не скажут finish(). */
function fakeOutput(s: FakeScheduler) {
  let finish: (() => void) | null = null
  const backend: LiveSpeechBackend = {
    ready: async () => {},
    environment: () => ({ electronAvailable: false, edgeAvailable: false, puterAvailable: false, browserSupported: true }),
    prepare: (text) =>
      text
        .replace(/H₂O/g, 'аш два о')
        .replace(/CO₂/g, 'це о два')
        .replace(/NaOH/g, 'эн а о аш')
        .replace(/98/g, 'девяносто восемь'),
    synthesize: async () => null,
    playAudio: async () => {},
    speakBrowser: (_text, _lang, onStart) => {
      onStart()
      const done = new Promise<void>((r) => {
        finish = r
      })
      return { done, cancel: () => finish?.() }
    },
    hardStop: () => finish?.(),
  } as unknown as LiveSpeechBackend
  const output = new LiveSpeechOutput({ lang: 'ru', backend, path: 'browser' })
  void s
  return { output, finish: () => finish?.() }
}

class FakeRecognition implements RecognitionLike {
  session: { committed: string } | null = null
  onUpdate: ((full: string, interim: string) => void) | null = null
  started = 0
  paused = 0
  resumed = 0
  start(_l: unknown, session: { committed: string }, onUpdate: (f: string, i: string) => void) {
    this.session = session
    this.onUpdate = onUpdate
    this.started++
    return true
  }
  stop() {}
  pause() {
    this.paused++
  }
  resume() {
    this.resumed++
  }
  final(text: string) {
    if (!this.session || !this.onUpdate) return
    this.session.committed = `${this.session.committed}${text} `
    this.onUpdate(this.session.committed.trim(), '')
  }
}

async function main() {
  console.log('\n# Эхо-страж: пары')
  await test(`${ECHO_CASES.length} эхо-пар отбрасываются`, () => {
    const bad: string[] = []
    for (const [spoken, heard] of ECHO_CASES) {
      const log = new SpokenPhraseLog()
      log.push(spoken, spoken, 0)
      if (!log.isEcho(heard, 100, true)) bad.push(`${spoken} → ${heard} ${JSON.stringify(echoVerdict(heard, spoken))}`)
    }
    assert.deepEqual(bad, [])
  })
  await test(`${STUDENT_CASES.length} реплик ученика проходят`, () => {
    const bad: string[] = []
    for (const [spoken, heard] of STUDENT_CASES) {
      const log = new SpokenPhraseLog()
      log.push(spoken, spoken, 0)
      if (log.isEcho(heard, 100, true)) bad.push(`${spoken} → ${heard} ${JSON.stringify(echoVerdict(heard, spoken))}`)
    }
    assert.deepEqual(bad, [])
  })
  await test('журнал хранит 8 фраз и окно 800 мс', () => {
    const log = new SpokenPhraseLog()
    for (let i = 0; i < 12; i++) log.push(`фраза номер ${i} про оксиды и кислоты`, `фраза номер ${i} про оксиды и кислоты`, i)
    assert.equal(log.recent().length, 8)
    log.closeAll(1000)
    assert.equal(log.isEcho('фраза номер 11 про оксиды и кислоты', 1700, false), true)
    assert.equal(log.isEcho('фраза номер 11 про оксиды и кислоты', 1900, false), false)
  })

  console.log('\n# Таймлайн DuplexVoiceSession (мягкий режим, VAD есть)')
  await test('эхо во время речи и в окне 800 мс не становится репликой; ученик после — да', async () => {
    const s = new FakeScheduler()
    const { output, finish } = fakeOutput(s)
    const rec = new FakeRecognition()
    const utterances: string[] = []
    const session = new DuplexVoiceSession({
      lang: 'ru',
      controller: {} as LearnSpeechController,
      speechOutput: output,
      recognition: rec,
      scheduler: s,
      listenWhileSpeaking: 'soft_echo_filter',
      createVad: () => ({ attach: async () => true, detach() {} }),
      onUserUtterance: (t) => utterances.push(t),
    })
    await session.begin({} as MediaStream)
    const turn = session.beginTeacherTurn()
    turn.push('H₂O — это вода, молярная масса 98 грамм.')
    turn.end()
    await Promise.resolve()
    s.advance(300)
    assert.equal(session.isAiSpeaking(), true)
    rec.final('аш два о это вода')
    rec.final('молярная масса девяносто восемь')
    s.advance(100)
    finish()
    await turn.done
    s.advance(50)
    assert.equal(session.isAiSpeaking(), false)
    // хвост эха через 400 мс после конца речи
    rec.final('это вода молярная масса')
    s.advance(1000)
    assert.deepEqual(utterances, [])
    // настоящая реплика после окна
    s.advance(1000)
    rec.final('а почему вода жидкая')
    s.advance(1000)
    assert.deepEqual(utterances, ['а почему вода жидкая'])
  })

  console.log('\n# Жёсткая пауза (без VAD / Chrome)')
  await test('без VAD распознавание ставится на паузу на время речи и возобновляется после', async () => {
    const s = new FakeScheduler()
    const { output, finish } = fakeOutput(s)
    const rec = new FakeRecognition()
    const session = new DuplexVoiceSession({
      lang: 'ru',
      controller: {} as LearnSpeechController,
      speechOutput: output,
      recognition: rec,
      scheduler: s,
      createVad: () => ({ attach: async () => false, detach() {} }),
      onUserUtterance: () => {},
    })
    await session.begin({} as MediaStream)
    assert.equal(session.getListenMode(), 'hard_pause')
    const turn = session.beginTeacherTurn()
    turn.push('Оксиды — это сложные вещества.')
    turn.end()
    await Promise.resolve()
    s.advance(100)
    assert.equal(rec.paused, 1)
    finish()
    await turn.done
    s.advance(50)
    assert.equal(rec.resumed, 1)
  })
  await test('в Chrome режим hard_pause даже с VAD, в Edge — мягкий', async () => {
    const { browserVoiceProfile } = await import('../src/learn/brain/speech/browserProfile.ts')
    const chrome = browserVoiceProfile('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36')
    const edge = browserVoiceProfile('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0')
    assert.equal(chrome.isChrome && chrome.listenWhileSpeaking === 'hard_pause', true)
    assert.equal(edge.isEdge && edge.listenWhileSpeaking === 'soft_echo_filter', true)
    assert.deepEqual(chrome.supportedLocales, ['ru', 'en'])
    assert.equal(edge.supportedLocales.includes('uz'), true)
  })

  console.log('\n# «Нажми и говори» и контекст распознавания')
  await test('«нажми и говори» во время речи учителя: учитель замолкает, реплика ученика уходит сразу после отпускания', async () => {
    const s = new FakeScheduler()
    const { output } = fakeOutput(s)
    const rec = new FakeRecognition()
    const utterances: string[] = []
    const session = new DuplexVoiceSession({
      lang: 'ru',
      controller: {} as LearnSpeechController,
      speechOutput: output,
      recognition: rec,
      scheduler: s,
      listenWhileSpeaking: 'soft_echo_filter',
      createVad: () => ({ attach: async () => true, detach() {} }),
      onUserUtterance: (t) => utterances.push(t),
    })
    await session.begin({} as MediaStream)
    const turn = session.beginTeacherTurn()
    turn.push('Оксиды — это сложные вещества из двух элементов.')
    turn.end()
    await Promise.resolve()
    s.advance(200)
    assert.equal(session.isAiSpeaking(), true)
    assert.equal(session.holdToTalk(true), true)
    assert.equal(session.isAiSpeaking(), false, 'учитель замолчал в момент нажатия')
    assert.equal(await turn.done, 'interrupted')
    rec.final('а оксид кальция')
    s.advance(2000)
    assert.deepEqual(utterances, [], 'пока зажато — не коммитим')
    rec.final('это основный оксид')
    session.holdToTalk(false)
    s.advance(300)
    assert.deepEqual(utterances, ['а оксид кальция это основный оксид'])
    session.end()
  })
  await test('Chrome (жёсткая пауза): нажатие сразу возобновляет распознавание, без 500 мс', async () => {
    const s = new FakeScheduler()
    const { output } = fakeOutput(s)
    const rec = new FakeRecognition()
    const session = new DuplexVoiceSession({
      lang: 'ru',
      controller: {} as LearnSpeechController,
      speechOutput: output,
      recognition: rec,
      scheduler: s,
      listenWhileSpeaking: 'hard_pause',
      createVad: () => ({ attach: async () => true, detach() {} }),
      onUserUtterance: () => {},
    })
    await session.begin({} as MediaStream)
    const turn = session.beginTeacherTurn()
    turn.push('Кислоты — это сложные вещества.')
    turn.end()
    await Promise.resolve()
    s.advance(100)
    assert.equal(rec.paused, 1)
    session.holdToTalk(true)
    assert.ok(rec.resumed >= 1, 'resume вызван в момент нажатия')
    session.end()
  })
  await test('слова учителя становятся контекстом выбора альтернатив (а эхо всё равно отсекается)', async () => {
    const { contextScore, resetRecognitionContext } = await import('../src/learn/brain/speech/chemTranscript.ts')
    resetRecognitionContext()
    const s = new FakeScheduler()
    const { output, finish } = fakeOutput(s)
    const rec = new FakeRecognition()
    const utterances: string[] = []
    const session = new DuplexVoiceSession({
      lang: 'ru',
      controller: {} as LearnSpeechController,
      speechOutput: output,
      recognition: rec,
      scheduler: s,
      listenWhileSpeaking: 'soft_echo_filter',
      createVad: () => ({ attach: async () => true, detach() {} }),
      onUserUtterance: (t) => utterances.push(t),
    })
    await session.begin({} as MediaStream)
    assert.equal(contextScore('аллотропия озон'), 0)
    const turn = session.beginTeacherTurn()
    turn.push('Озон — аллотропная модификация кислорода.')
    turn.end()
    await Promise.resolve()
    s.advance(200)
    rec.final('аллотропная модификация кислорода')
    finish()
    await turn.done
    s.advance(1500)
    assert.deepEqual(utterances, [], 'эхо не стало репликой')
    assert.ok(contextScore('а озон ядовит') > 0, 'озон теперь в контексте')
    resetRecognitionContext()
    session.end()
  })

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed ? 1 : 0)
}

void main()
