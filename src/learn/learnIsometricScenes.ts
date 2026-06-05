import { learnAllSections } from '../data/learnCurriculumUz'
import { messagesRu } from '../i18n/messagesRu'
import { parseTopicSceneId } from './learnTopicScenes'

export type IsoPropDef = {
  type: string
  position: [number, number, number]
  color?: string
  scale?: number
}

export type IsoPanelDef = {
  title: string
  platformPos: [number, number, number]
  titlePos: [number, number, number]
  platformSize?: [number, number, number]
  platformColor?: string
  props: IsoPropDef[]
  labels: { text: string; position: [number, number, number] }[]
}

export type IsometricSceneDef = {
  sceneId: string
  accent: string
  centerTitle?: string
  centerProp?: IsoPropDef
  panels: IsoPanelDef[]
}

function t(key: string): string {
  const v = messagesRu[key as keyof typeof messagesRu]
  return typeof v === 'string' ? v.replace(/^§\d+\.\s*/, '') : key
}

/** Устарело: §1 использует cyber-дашборд. Оставлено для промптов/миграции. */
export const ISO_HERO_G7_C1_S01_LEGACY: IsometricSceneDef = {
  sceneId: 'topic_g7_c1_s01',
  accent: '#3dffec',
  centerTitle: 'ХИМИЯ КАК НАУКА\nИ ЕЁ ЗАДАЧИ',
  centerProp: { type: 'dna', position: [0, 0.55, 0], scale: 1.15 },
  panels: [
    {
      title: 'ИЗУЧЕНИЕ ВЕЩЕСТВ',
      platformPos: [-1.55, 0, -1.35],
      titlePos: [-1.55, 0.95, -1.35],
      props: [
        { type: 'flask', position: [-1.7, 0.15, -1.2], color: '#ff6b9d' },
        { type: 'beaker', position: [-1.35, 0.08, -1.45] },
        { type: 'crystal', position: [-1.85, 0.12, -1.55], color: '#5ecbff' },
        { type: 'atom', position: [-1.45, 0.2, -1.05] },
      ],
      labels: [
        { text: 'Состав', position: [-1.85, 0.55, -1.0] },
        { text: 'Свойства', position: [-1.2, 0.5, -1.65] },
        { text: 'Строение', position: [-1.95, 0.45, -1.35] },
      ],
    },
    {
      title: 'ПОЛУЧЕНИЕ НОВЫХ\nМАТЕРИАЛОВ',
      platformPos: [1.55, 0, -1.35],
      titlePos: [1.55, 0.95, -1.35],
      props: [
        { type: 'robot', position: [1.45, 0.1, -1.25] },
        { type: 'polymer', position: [1.75, 0.12, -1.5], color: '#66aaff' },
        { type: 'crystal', position: [1.65, 0.1, -1.05], color: '#88ddff', scale: 0.8 },
      ],
      labels: [
        { text: 'Синтез', position: [1.25, 0.5, -1.15] },
        { text: 'Полимеры', position: [1.9, 0.48, -1.45] },
        { text: 'Свойства на заказ', position: [1.55, 0.42, -1.7] },
      ],
    },
    {
      title: 'ПРИМЕНЕНИЕ\nВ ЖИЗНИ',
      platformPos: [-1.55, 0, 1.35],
      titlePos: [-1.55, 0.95, 1.35],
      props: [
        { type: 'medical', position: [-1.65, 0.08, 1.45] },
        { type: 'solar', position: [-1.35, 0.05, 1.25] },
        { type: 'flask', position: [-1.85, 0.1, 1.3], color: '#ffaa66', scale: 0.85 },
      ],
      labels: [
        { text: 'Медицина', position: [-1.9, 0.48, 1.55] },
        { text: 'Энергия', position: [-1.15, 0.45, 1.15] },
        { text: 'Продукты', position: [-1.55, 0.42, 1.65] },
      ],
    },
    {
      title: 'ОХРАНА ОКРУЖАЮЩЕЙ\nСРЕДЫ',
      platformPos: [1.55, 0, 1.35],
      titlePos: [1.55, 0.95, 1.35],
      props: [{ type: 'factory', position: [1.55, 0.05, 1.35] }],
      labels: [
        { text: 'Экология', position: [1.25, 0.48, 1.55] },
        { text: 'Очистка', position: [1.85, 0.45, 1.2] },
        { text: 'Переработка', position: [1.55, 0.42, 1.7] },
      ],
    },
  ],
}

const QUAD_POSITIONS: [number, number, number][] = [
  [-1.55, 0, -1.35],
  [1.55, 0, -1.35],
  [-1.55, 0, 1.35],
  [1.55, 0, 1.35],
]

function quadPanels(
  titles: [string, string, string, string],
  propSets: IsoPropDef[][],
  labelSets: { text: string; position: [number, number, number] }[][],
): IsoPanelDef[] {
  return titles.map((title, i) => {
    const base = QUAD_POSITIONS[i]!
    return {
      title,
      platformPos: base,
      titlePos: [base[0], base[1] + 0.95, base[2]],
      props: propSets[i] ?? [],
      labels: labelSets[i] ?? [],
    }
  })
}

function buildFromTemplate(sceneId: string, topic: string, chapterKey: string): IsometricSceneDef {
  const accent = '#3dffec'
  const short = topic.slice(0, 42)

  if (chapterKey.includes('c1') && /безопасн|посуд|лаборатор/i.test(topic)) {
    return {
      sceneId,
      accent: '#ffcc66',
      centerTitle: topic.toUpperCase(),
      panels: [
        {
          title: 'ТЕХНИКА БЕЗОПАСНОСТИ',
          platformPos: [0, 0, 0],
          titlePos: [0, 1.0, 0],
          props: [
            { type: 'glass', position: [-0.35, 0.12, 0.1] },
            { type: 'burner', position: [0.4, 0.05, -0.15] },
            { type: 'beaker', position: [0.1, 0.08, 0.25] },
          ],
          labels: [
            { text: 'Очки и халат', position: [-0.75, 0.55, 0.35] },
            { text: 'Вытяжка', position: [0.75, 0.5, -0.35] },
            { text: 'Не пробовать на вкус', position: [0, 0.42, 0.75] },
          ],
        },
      ],
    }
  }

  if (/атом|элемент|строение|изотоп|молекул|валентн|моль/i.test(topic)) {
    return {
      sceneId,
      accent: '#aa66ff',
      centerTitle: topic.toUpperCase(),
      centerProp: { type: 'atom', position: [0, 0.45, 0], scale: 1.3 },
      panels: quadPanels(
        ['СОСТАВ', 'СВОЙСТВА', 'МОДЕЛЬ', 'РАСЧЁТЫ'],
        [
          [{ type: 'crystal', position: [-1.65, 0.12, -1.35] }],
          [{ type: 'atom', position: [1.55, 0.2, -1.25] }],
          [{ type: 'polymer', position: [-1.5, 0.12, 1.4] }],
          [{ type: 'flask', position: [1.65, 0.12, 1.35], color: '#88ccff' }],
        ],
        [
          [{ text: 'Ядро + электроны', position: [-1.85, 0.5, -1.15] }],
          [{ text: 'Валентность', position: [1.3, 0.48, -1.55] }],
          [{ text: 'Молекула', position: [-1.2, 0.45, 1.65] }],
          [{ text: 'Моль · Mr', position: [1.85, 0.42, 1.15] }],
        ],
      ),
    }
  }

  if (/озон/i.test(topic)) {
    return {
      sceneId,
      accent: '#66ddff',
      centerTitle: 'ОЗОН\nO₃',
      centerProp: { type: 'atom', position: [0, 0.45, 0], scale: 1.1, color: '#44aaff' },
      panels: quadPanels(
        ['СОСТАВ', 'СВОЙСТВА', 'РОЛЬ', 'ЗАЩИТА'],
        [
          [{ type: 'atom', position: [-1.55, 0.2, -1.3], color: '#44aaff' }],
          [{ type: 'crystal', position: [1.5, 0.12, -1.35], color: '#88ddff' }],
          [{ type: 'solar', position: [-1.5, 0.05, 1.35] }],
          [{ type: 'factory', position: [1.55, 0.05, 1.35] }],
        ],
        [
          [{ text: '3 атома O', position: [-1.85, 0.5, -1.15] }],
          [{ text: 'Голубой газ', position: [1.25, 0.48, -1.55] }],
          [{ text: 'Солнце → O₃', position: [-1.2, 0.45, 1.65] }],
          [{ text: 'Озоновый слой', position: [1.75, 0.42, 1.15] }],
        ],
      ),
    }
  }

  if (/воздух|горен|кислород|водород|вода|раствор/i.test(topic)) {
    return {
      sceneId,
      accent: '#66bbff',
      centerTitle: topic.toUpperCase(),
      panels: quadPanels(
        ['РЕАГЕНТЫ', 'РЕАКЦИЯ', 'ПРОДУКТ', 'ПРИМЕНЕНИЕ'],
        [
          [{ type: 'beaker', position: [-1.6, 0.1, -1.3] }],
          [{ type: 'burner', position: [1.5, 0.08, -1.35] }],
          [{ type: 'flask', position: [-1.55, 0.12, 1.4], color: '#44aaff' }],
          [{ type: 'solar', position: [1.6, 0.05, 1.3] }],
        ],
        [
          [{ text: 'O₂ · N₂', position: [-1.9, 0.48, -1.1] }],
          [{ text: 'Тепло', position: [1.2, 0.5, -1.55] }],
          [{ text: 'H₂O', position: [-1.15, 0.45, 1.65] }],
          [{ text: 'Экология', position: [1.85, 0.42, 1.15] }],
        ],
      ),
    }
  }

  if (/оксид|кислот|основан|сол|металл|неметалл|галоген|овр|электролиз|скорост|равновес/i.test(topic)) {
    return {
      sceneId,
      accent: '#ff8844',
      centerTitle: topic.toUpperCase(),
      panels: quadPanels(
        ['КЛАСС ВЕЩЕСТВ', 'РЕАКЦИЯ', '3D-МОДЕЛЬ', 'ЛАБОРАТОРИЯ'],
        [
          [{ type: 'crystal', position: [-1.65, 0.12, -1.35], color: '#ffaa44' }],
          [{ type: 'flask', position: [1.55, 0.12, -1.3], color: '#ff6644' }],
          [{ type: 'atom', position: [-1.5, 0.18, 1.35] }],
          [{ type: 'burner', position: [1.5, 0.05, 1.35] }],
        ],
        [
          [{ text: 'Состав', position: [-1.85, 0.5, -1.15] }],
          [{ text: 'Уравнение', position: [1.25, 0.48, -1.55] }],
          [{ text: 'Связи', position: [-1.2, 0.45, 1.65] }],
          [{ text: 'Опыт', position: [1.75, 0.42, 1.15] }],
        ],
      ),
    }
  }

  if (/органическ|углерод|кремни/i.test(topic)) {
    return {
      sceneId,
      accent: '#66ff99',
      centerTitle: topic.toUpperCase(),
      centerProp: { type: 'polymer', position: [0, 0.35, 0], scale: 1.2 },
      panels: quadPanels(
        ['УГЛЕРОД', 'ЦЕПИ', 'ФУНКЦИИ', 'ПРИМЕНЕНИЕ'],
        [
          [{ type: 'crystal', position: [-1.6, 0.1, -1.3], color: '#333' }],
          [{ type: 'polymer', position: [1.55, 0.12, -1.35] }],
          [{ type: 'medical', position: [-1.55, 0.08, 1.35] }],
          [{ type: 'factory', position: [1.55, 0.05, 1.35] }],
        ],
        [
          [{ text: 'C — основа', position: [-1.85, 0.48, -1.1] }],
          [{ text: 'Связи C–C', position: [1.2, 0.5, -1.55] }],
          [{ text: 'Биохимия', position: [-1.15, 0.45, 1.65] }],
          [{ text: 'Промышленность', position: [1.8, 0.42, 1.15] }],
        ],
      ),
    }
  }

  return {
    sceneId,
    accent,
    centerTitle: short.toUpperCase(),
    centerProp: { type: 'dna', position: [0, 0.5, 0], scale: 0.9 },
    panels: quadPanels(
      ['ТЕОРИЯ', 'ПРИМЕР', '3D', 'ПРАКТИКА'],
      [
        [{ type: 'flask', position: [-1.65, 0.12, -1.35] }],
        [{ type: 'crystal', position: [1.55, 0.12, -1.3] }],
        [{ type: 'atom', position: [-1.5, 0.18, 1.35] }],
        [{ type: 'glass', position: [1.55, 0.12, 1.35] }],
      ],
      [
        [{ text: 'Определение', position: [-1.85, 0.5, -1.15] }],
        [{ text: 'Из жизни', position: [1.25, 0.48, -1.55] }],
        [{ text: 'Модель', position: [-1.2, 0.45, 1.65] }],
        [{ text: 'ATOMLAB', position: [1.75, 0.42, 1.15] }],
      ],
    ),
  }
}

const REGISTRY = new Map<string, IsometricSceneDef>()

/** §1 — cyber-дашборд (HTML), не изометрия в WebGL */
const CYBER_DASHBOARD_SCENES = new Set(['topic_g7_c1_s01'])

for (const sec of learnAllSections()) {
  const sceneId = `topic_${sec.gradeId}_${sec.chapterId}_${sec.id}`
  if (REGISTRY.has(sceneId) || CYBER_DASHBOARD_SCENES.has(sceneId)) continue
  const title = t(sec.titleKey)
  const chapterKey = `${sec.gradeId}-${sec.chapterId}`
  REGISTRY.set(sceneId, buildFromTemplate(sceneId, title, chapterKey))
}

export function getIsometricSceneDef(sceneId: string): IsometricSceneDef | null {
  return REGISTRY.get(sceneId) ?? null
}

export function hasIsometricScene(sceneId: string): boolean {
  return REGISTRY.has(sceneId)
}

export function getIsometricSceneTitle(sceneId: string): string {
  const parsed = parseTopicSceneId(sceneId)
  if (!parsed) return sceneId
  const key = `learn.${parsed.gradeId}.${parsed.chapterId}.${parsed.sectionId}.title`
  return t(key)
}
