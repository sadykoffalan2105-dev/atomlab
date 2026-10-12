/**
 * npx tsx src/learn/brain/remote/feedbackClient.selftest.ts — «Сообщить об ошибке» без сети (подменный fetch):
 * тело запроса (поля, длины, класс, метка), адрес /kb/feedback, заголовок сессии, исходы sent / rate / offline / error.
 */
import { FEEDBACK_LIMITS, feedbackBody, reportBrainAnswer } from './feedbackClient'
import { BRAIN_SESSION_HEADER } from './brainClient'

let failed = 0
let passed = 0
const check = (what: string, cond: boolean, extra = '') => {
  if (cond) passed++
  else failed++
  console.log(`${cond ? '  ✓' : '  ✗'} ${what}${extra ? ' — ' + extra : ''}`)
}

const b = feedbackBody({ question: '  Что такое моль? ', answer: 'x'.repeat(9000), comment: 'к'.repeat(5000), lang: 'uz', gradeId: '8', route: 'LLM!' })
check('длины подрезаются под лимиты сервера', b.answer.length === FEEDBACK_LIMITS.answer && b.comment.length === FEEDBACK_LIMITS.comment && b.question === 'Что такое моль?')
check('язык, класс g8, метка маршрута [a-z]', b.lang === 'uz' && b.grade === 'g8' && b.route === 'llm' && b.reason === 'other')
check('без имени, адреса и сессии в теле', Object.keys(b).every((k) => ['question', 'answer', 'comment', 'reason', 'lang', 'grade', 'route'].includes(k)))
check('пустой класс не отправляется', !('grade' in feedbackBody({ question: 'q', answer: 'a', gradeId: '' })))

type Call = { url: string; init: RequestInit }
const calls: Call[] = []
const fakeFetch =
  (status: number): typeof fetch =>
  async (url, init) => {
    calls.push({ url: String(url), init: init ?? {} })
    return new Response(JSON.stringify({ ok: status === 200 }), { status })
  }
const ok = await reportBrainAnswer({ question: 'q', answer: 'a', comment: 'c' }, { fetchImpl: fakeFetch(200), baseUrl: 'https://brain.test' })
const last = calls[calls.length - 1]!
const hdr = last.init.headers as Record<string, string>
check('POST {мозг}/kb/feedback, JSON, заголовок сессии (только для лимитов)', ok === 'sent' && last.url === 'https://brain.test/kb/feedback' && last.init.method === 'POST' && hdr['Content-Type'] === 'application/json' && /^s-/.test(hdr[BRAIN_SESSION_HEADER] ?? ''))
check('429 → rate', (await reportBrainAnswer({ question: 'q', answer: 'a' }, { fetchImpl: fakeFetch(429), baseUrl: 'https://brain.test' })) === 'rate')
check('404 (старый мозг) → offline', (await reportBrainAnswer({ question: 'q', answer: 'a' }, { fetchImpl: fakeFetch(404), baseUrl: 'https://brain.test' })) === 'offline')
check('400 → error', (await reportBrainAnswer({ question: 'q', answer: 'a' }, { fetchImpl: fakeFetch(400), baseUrl: 'https://brain.test' })) === 'error')
check('мозг не найден → offline без запроса', (await reportBrainAnswer({ question: 'q', answer: 'a' }, { fetchImpl: fakeFetch(200), baseUrl: null })) === 'offline')
const thrown: typeof fetch = async () => {
  throw new TypeError('network')
}
check('сеть оборвалась → offline', (await reportBrainAnswer({ question: 'q', answer: 'a' }, { fetchImpl: thrown, baseUrl: 'https://brain.test' })) === 'offline')
check('пустой ответ → error без запроса', (await reportBrainAnswer({ question: 'q', answer: '  ' }, { fetchImpl: fakeFetch(200), baseUrl: 'https://brain.test' })) === 'error')

console.log(`\n[feedbackClient] ${passed} ✓, ${failed} ✗`)
process.exit(failed ? 1 : 0)
