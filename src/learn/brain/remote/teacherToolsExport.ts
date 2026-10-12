/**
 * Экспорт инструментов учителя: Word (.doc — HTML, который Word открывает как документ; библиотеки DOCX
 * в проекте нет), Excel (.xlsx — xlsxLite, без зависимостей) и CSV для теста, печать через скрытый iframe.
 * Все функции сборки — чистые (тестируются в teacherTools.selftest.ts); скачивание/печать — только в браузере.
 */
import type { GradeResult, LessonPlan, TeacherTest, TestScaleRow } from './teacherTools'
import { buildXlsx, colName, type XlsxCell } from './xlsxLite'

/** Подписи для документа на языке учителя (передаёт панель из своего словаря). */
export interface ExportLabels {
  lang: 'ru' | 'uz' | 'en'
  objectives: string
  stages: string
  minutes: string
  questions: string
  problems: string
  solution: string
  answer: string
  links: string
  keys: string
  points: string
  total: string
  scale: string
  mark: string
  range: string
  unit: string
  studentLine: string
  criterion: string
  max: string
  comment: string
  note: string
  recommendation: string
  type: string
  question: string
  options: string
  no: string
  student: string
  percent: string
  sheetTest: string
  sheetScale: string
  sheetJournal: string
  ladder: string
  generatedBy: string
  typeNames: Record<string, string>
}

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
/** Метка порядка байтов: Word и Excel по ней узнают UTF-8 (кириллица и узбекская ʻ без «кракозябр»). */
const BOM = String.fromCharCode(0xfeff)
const pts = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
/** Ссылка сайта (#/vr-lab) → полный адрес, чтобы она работала из Word; внешние http(s) — как есть; прочее — без ссылки. */
export function absoluteHref(href: string, origin: string): string | null {
  if (/^https?:\/\//i.test(href)) return href
  if (href.startsWith('#/')) return `${origin}${href}`
  if (href.startsWith('/')) return `${origin}#${href}`
  return null
}

/* ------------------------------------------------------------------ HTML-фрагменты */

export function planHtml(p: LessonPlan, L: ExportLabels, origin = ''): string {
  const out: string[] = [`<h1>${escapeHtml(p.title)}</h1>`]
  if (p.objectives.length) out.push(`<h2>${escapeHtml(L.objectives)}</h2><ul>${p.objectives.map((o) => `<li>${escapeHtml(o)}</li>`).join('')}</ul>`)
  if (p.stages.length) {
    const total = p.stages.reduce((a, s) => a + s.minutes, 0)
    out.push(
      `<h2>${escapeHtml(L.stages)}${total ? ` (${total} ${escapeHtml(L.minutes)})` : ''}</h2><table class="tbl"><tbody>${p.stages
        .map(
          (s, i) =>
            `<tr><td class="n">${i + 1}</td><td><strong>${escapeHtml(s.name)}</strong>${
              s.activities.length ? `<ul>${s.activities.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul>` : ''
            }</td><td class="m">${s.minutes ? `${s.minutes} ${escapeHtml(L.minutes)}` : ''}</td></tr>`,
        )
        .join('')}</tbody></table>`,
    )
  }
  if (p.questions.length) out.push(`<h2>${escapeHtml(L.questions)}</h2><ol>${p.questions.map((q) => `<li>${escapeHtml(q)}</li>`).join('')}</ol>`)
  if (p.problems.length)
    out.push(
      `<h2>${escapeHtml(L.problems)}</h2><ol>${p.problems
        .map(
          (x) =>
            `<li><p>${escapeHtml(x.text)}</p>${x.solution ? `<p><em>${escapeHtml(L.solution)}:</em> ${escapeHtml(x.solution)}</p>` : ''}${
              x.answer ? `<p><strong>${escapeHtml(L.answer)}:</strong> ${escapeHtml(x.answer)}</p>` : ''
            }</li>`,
        )
        .join('')}</ol>`,
    )
  if (p.links.length)
    out.push(
      `<h2>${escapeHtml(L.links)}</h2><ul>${p.links
        .map((l) => {
          const href = absoluteHref(l.href, origin)
          return `<li>${href ? `<a href="${escapeHtml(href)}">${escapeHtml(l.title)}</a>` : escapeHtml(l.title)}</li>`
        })
        .join('')}</ul>`,
    )
  return out.join('\n')
}

function scaleTable(scale: TestScaleRow[], L: ExportLabels): string {
  return `<table class="tbl"><thead><tr><th>${escapeHtml(L.mark)}</th><th>${escapeHtml(L.range)}</th></tr></thead><tbody>${scale
    .map((r) => `<tr><td>${escapeHtml(r.mark)}</td><td>${pts(r.from)}–${pts(r.to)}</td></tr>`)
    .join('')}</tbody></table>`
}

/** Лист ученика (без ответов) и, при withKeys, разрыв страницы + ключи и шкала. */
export function testHtml(t: TeacherTest, L: ExportLabels, withKeys: boolean): string {
  const out: string[] = [`<h1>${escapeHtml(t.title)}</h1>`, `<p class="student">${escapeHtml(L.studentLine)}</p>`]
  out.push(
    `<ol class="items">${t.items
      .map((it) => {
        const opts = it.options?.length ? `<ol class="opts" type="A">${it.options.map((o) => `<li>${escapeHtml(o)}</li>`).join('')}</ol>` : ''
        return `<li><p>${escapeHtml(it.q)} <span class="pts">(${pts(it.points)} ${escapeHtml(L.points)})</span></p>${opts}</li>`
      })
      .join('')}</ol>`,
    `<p><strong>${escapeHtml(L.total)}: ${pts(t.totalPoints)} ${escapeHtml(L.points)}</strong></p>`,
  )
  if (withKeys) {
    out.push(
      `<div class="pb"></div><h2>${escapeHtml(L.keys)}</h2><table class="tbl"><thead><tr><th>${escapeHtml(L.no)}</th><th>${escapeHtml(L.answer)}</th><th>${escapeHtml(
        L.points,
      )}</th><th>${escapeHtml(L.unit)}</th></tr></thead><tbody>${t.items
        .map((it, i) => `<tr><td class="n">${i + 1}</td><td>${escapeHtml(it.answer)}</td><td>${pts(it.points)}</td><td>${escapeHtml(it.unit)}</td></tr>`)
        .join('')}</tbody></table>`,
      `<h2>${escapeHtml(L.scale)}</h2>${scaleTable(t.scale, L)}`,
      `<p class="muted">${escapeHtml(L.ladder)}: ${escapeHtml(sorLadder(t))}</p>`,
    )
  }
  return out.join('\n')
}

export function gradeHtml(g: GradeResult, L: ExportLabels, title: string): string {
  return [
    `<h1>${escapeHtml(title)}</h1>`,
    `<p class="warn">${escapeHtml(L.recommendation)}</p>`,
    `<table class="tbl"><thead><tr><th>${escapeHtml(L.criterion)}</th><th>${escapeHtml(L.points)}</th><th>${escapeHtml(L.max)}</th><th>${escapeHtml(
      L.comment,
    )}</th></tr></thead><tbody>${g.criteria
      .map((c) => `<tr><td>${escapeHtml(c.name)}</td><td>${pts(c.points)}</td><td>${pts(c.max)}</td><td>${escapeHtml(c.comment)}</td></tr>`)
      .join('')}<tr><td><strong>${escapeHtml(L.total)}</strong></td><td><strong>${pts(g.total)}</strong></td><td><strong>${pts(g.max)}</strong></td><td></td></tr></tbody></table>`,
    g.note ? `<p><em>${escapeHtml(L.note)}:</em> ${escapeHtml(g.note)}</p>` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

const DOC_CSS = `body{font-family:'Times New Roman',serif;font-size:12pt;line-height:1.35;color:#000}
h1{font-size:16pt;margin:0 0 8pt}h2{font-size:13pt;margin:12pt 0 4pt}
.tbl{border-collapse:collapse;width:100%}.tbl td,.tbl th{border:1px solid #444;padding:3pt 5pt;vertical-align:top;text-align:left}
.tbl th{background:#eee}.n{width:24pt;text-align:center}.m{width:56pt;white-space:nowrap}
.pts{color:#444;font-size:10pt}.student{margin:0 0 10pt}.muted{color:#555;font-size:10pt}
.warn{border:1px solid #b45309;padding:4pt 6pt;background:#fff7ed}
.opts{margin:2pt 0 6pt}.items>li{margin-bottom:6pt}
.pb{page-break-before:always;break-before:page}.foot{margin-top:14pt;color:#666;font-size:9pt}`

/** Документ Word: HTML с пространствами имён Office — Word открывает его как обычный документ (.doc). */
export function wordDocument(title: string, bodyHtml: string, L: ExportLabels): string {
  return `${BOM}<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40" lang="${L.lang}">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>@page{size:A4;margin:2cm 1.5cm 2cm 2cm}${DOC_CSS}</style></head>
<body>${bodyHtml}<p class="foot">${escapeHtml(L.generatedBy)}</p></body></html>`
}

/** Страница для печати (тот же вид, без шапки сайта). */
export function printDocument(title: string, bodyHtml: string, L: ExportLabels): string {
  return `<!doctype html><html lang="${L.lang}"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>@page{size:A4;margin:15mm}${DOC_CSS}</style></head><body>${bodyHtml}<p class="foot">${escapeHtml(L.generatedBy)}</p></body></html>`
}

/* ------------------------------------------------------------------ тест → таблицы */

/** Разбаловка в формате «Отчёты СОР/СОЧ» (задания через «; »): «1; 2; 2; 3». */
export function sorLadder(t: TeacherTest): string {
  return t.items.map((it) => pts(it.points)).join('; ')
}

function optionsText(o: string[] | undefined): string {
  return o?.length ? o.map((x, i) => `${LETTERS[i] ?? i + 1}) ${x}`).join('\n') : ''
}

const csvCell = (v: string | number) => {
  const s = String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV для Excel (ru/uz: разделитель «;», UTF-8 с BOM). */
export function testCsv(t: TeacherTest, L: ExportLabels): string {
  const head = [L.no, L.type, L.question, L.options, L.answer, L.points, L.unit]
  const rows = t.items.map((it, i) => [i + 1, L.typeNames[it.type] ?? it.type, it.q, optionsText(it.options), it.answer, pts(it.points), it.unit])
  rows.push(['', '', L.total, '', '', pts(t.totalPoints), ''])
  return BOM + [head, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n') + '\r\n'
}

/** Excel-книга: «Тест» (вопросы + ключи), «Шкала» (+ разбаловка для СОР/СОЧ), «Журнал» на 30 учеников с формулами. */
export function testXlsx(t: TeacherTest, L: ExportLabels, students = 30): Uint8Array {
  const testRows: XlsxCell[][] = [[L.no, L.type, L.question, L.options, L.answer, L.points, L.unit]]
  t.items.forEach((it, i) =>
    testRows.push([i + 1, L.typeNames[it.type] ?? it.type, { v: it.q, wrap: true }, { v: optionsText(it.options), wrap: true }, { v: it.answer, wrap: true }, it.points, it.unit]),
  )
  testRows.push(['', '', { v: L.total, bold: true }, '', '', { v: t.totalPoints, bold: true }, ''])

  const scaleRows: XlsxCell[][] = [[L.mark, L.range, '', '']]
  for (const r of t.scale) scaleRows.push([r.mark, r.from, r.to, ''])
  scaleRows.push([])
  scaleRows.push([{ v: L.ladder, bold: true }, sorLadder(t)])

  // Журнал: № | Ученик | 1..n | Итого | % | Оценка; строка 2 — максимум за задание
  const n = t.items.length
  const first = colName(2)
  const last = colName(2 + n - 1)
  const cTotal = colName(2 + n)
  const head: XlsxCell[] = [L.no, L.student, ...t.items.map((_, i) => i + 1), L.total, L.percent, L.mark]
  const maxRow: XlsxCell[] = ['', { v: L.max, bold: true }, ...t.items.map((it) => it.points), { f: `SUM(${first}2:${last}2)` }, '', '']
  const scaleDesc = [...t.scale].sort((a, b) => b.from - a.from)
  const journal: XlsxCell[][] = [head, maxRow]
  for (let s = 0; s < students; s++) {
    const r = s + 3
    const tot = `${cTotal}${r}`
    // отметка по шкале: IF(tot>=from5,"5",IF(tot>=from4,"4",…))
    const markF = scaleDesc.reduceRight<string>((acc, row) => `IF(${tot}>=${row.from},"${row.mark.replace(/"/g, '')}",${acc})`, '""')
    journal.push([
      s + 1,
      '',
      ...t.items.map(() => null),
      { f: `IF(COUNT(${first}${r}:${last}${r})=0,"",SUM(${first}${r}:${last}${r}))` },
      { f: `IF(${tot}="","",ROUND(${tot}/${cTotal}$2*100,0))` },
      { f: `IF(${tot}="","",${markF})` },
    ])
  }
  return buildXlsx([
    { name: L.sheetTest, rows: testRows, widths: [5, 12, 60, 40, 30, 8, 10], freezeHeader: true, boldHeader: true },
    { name: L.sheetScale, rows: scaleRows, widths: [24, 14, 10, 4], boldHeader: true },
    { name: L.sheetJournal, rows: journal, widths: [5, 28, ...t.items.map(() => 5), 8, 7, 8], freezeHeader: true, boldHeader: true },
  ])
}

/* ------------------------------------------------------------------ браузер: скачать / печать */

export function safeFileName(s: string): string {
  return (
    s
      // eslint-disable-next-line no-control-regex
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'atomlab'
  )
}

export function downloadBlob(name: string, data: BlobPart, mime: string): void {
  const blob = new Blob([data], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export const MIME = {
  doc: 'application/msword',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv;charset=utf-8',
} as const

/** Печать без всплывающего окна: скрытый iframe с готовой страницей. */
export function printHtml(html: string): void {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.tabIndex = -1
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  document.body.appendChild(frame)
  const win = frame.contentWindow
  const doc = win?.document
  if (!win || !doc) {
    frame.remove()
    return
  }
  doc.open()
  doc.write(html)
  doc.close()
  const cleanup = () => setTimeout(() => frame.remove(), 1_000)
  win.addEventListener('afterprint', cleanup, { once: true })
  setTimeout(() => {
    try {
      win.focus()
      win.print()
    } finally {
      // afterprint есть не везде (старый Safari) — запасная уборка
      setTimeout(() => frame.remove(), 60_000)
    }
  }, 150)
}
