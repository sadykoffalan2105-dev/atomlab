import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Stars } from '@react-three/drei'
import { useAppTheme, type AppThemeId } from '../../theme/appTheme'

/** Спокойная сине-фиолетовая пустота idle-лаборатории (тёмная тема). */
export const LAB_IDLE_COSMIC_BG = '#07061a'
/** Светлая тема: холодный дневной воздух, в тон `body` (rgb(238,242,249)). */
export const LAB_IDLE_LIGHT_BG = '#e8eef8'

/**
 * Фон лаборатории: чистая пустота + движущиеся звёзды.
 * Без туманностей, колец и пыли — чтобы не спорили с атомом.
 *
 * ТЕМА. До второго круга фон был жёстко тёмным в обеих темах: шапка светлела,
 * а сцена под ней оставалась ночной, и на границе шапки был резкий стык.
 * Теперь фон, туман и «звёзды» идут от темы приложения:
 *   • тёмная  — прежний #07061a и аддитивные белые звёзды drei;
 *   • светлая — #e8eef8 и СВОИ точки: звёзды drei рисуются аддитивно, то есть
 *     на светлом фоне их не существует в принципе (белое + белое = белое).
 *     Вместо них — тёмно-синие пылинки обычным блендингом, та же глубина.
 *
 * Тема читается ЗДЕСЬ, а не приходит пропом: LabScene рендерит этот компонент
 * без пропсов и по условиям задачи не меняется. `scene.background` выставляется
 * императивно и подтверждается в кадре — LabSceneClearSync ставит свой clear
 * в layout-эффекте, и порядок эффектов между соседями не гарантирован.
 */

function bgHexOf(theme: AppThemeId): string {
  return theme === 'light' ? LAB_IDLE_LIGHT_BG : LAB_IDLE_COSMIC_BG
}

/**
 * Фон и туман сцены + цвет CSS-подложки канваса.
 * CSS правится и на самом канвасе: в LaboratoryPage.module.css он прибит
 * `!important` к тёмному, и в светлой теме любой пропущенный кадр мигал бы
 * ночным прямоугольником под уже светлой шапкой.
 */
function LabIdleBackgroundSync({ theme }: { theme: AppThemeId }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const color = useMemo(() => new THREE.Color(bgHexOf(theme)), [theme])

  useEffect(() => {
    const canvas = gl.domElement
    const hex = bgHexOf(theme)
    // Красится не только канвас, но и обёртки под ним: ночной цвет прибит
    // `!important` в LaboratoryPage.module.css сразу нескольким слоям
    // (.canvasWrap, .canvasFallback), и в светлой теме любая непокрытая полоса
    // читается как резкий стык с уже светлой шапкой. Выше <main> не поднимаемся:
    // это уже оболочка приложения, у неё свой фон.
    const painted: { el: HTMLElement; value: string; priority: string }[] = []
    let node: HTMLElement | null = canvas
    for (let depth = 0; node && depth < 5; depth++) {
      if (node.tagName === 'MAIN' || node.tagName === 'BODY') break
      painted.push({
        el: node,
        value: node.style.getPropertyValue('background-color'),
        priority: node.style.getPropertyPriority('background-color'),
      })
      node.style.setProperty('background-color', hex, 'important')
      node = node.parentElement
    }
    const fog = new THREE.Fog(color, 18, 42)
    scene.fog = fog
    scene.background = color
    gl.setClearColor(color, 1)
    return () => {
      for (const p of painted) p.el.style.setProperty('background-color', p.value, p.priority)
      if (scene.fog === fog) scene.fog = null
    }
  }, [gl, scene, color, theme])

  // Соседний LabSceneClearSync ставит свой фон в layout-эффекте; сверяемся в кадре.
  useFrame(() => {
    const bg = scene.background
    if (bg instanceof THREE.Color && !bg.equals(color)) {
      scene.background = color
      gl.setClearColor(color, 1)
    }
  })

  return null
}

/** Геометрия и материал пылинок живут весь сеанс — как и прочие ресурсы сцены. */
let moteGeometry: THREE.BufferGeometry | null = null
let moteMaterial: THREE.PointsMaterial | null = null

function getMotes(): { geometry: THREE.BufferGeometry; material: THREE.PointsMaterial } {
  if (!moteGeometry) {
    const count = 520
    const pos = new Float32Array(count * 3)
    // Детерминированный разброс по сфере: одинаковый кадр при каждом входе.
    const golden = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2
      const r = Math.sqrt(Math.max(0, 1 - y * y))
      const a = i * golden
      const d = 46 + ((i * 37) % 53)
      pos[i * 3] = Math.cos(a) * r * d
      pos[i * 3 + 1] = y * d
      pos[i * 3 + 2] = Math.sin(a) * r * d
    }
    moteGeometry = new THREE.BufferGeometry()
    moteGeometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  }
  if (!moteMaterial) {
    moteMaterial = new THREE.PointsMaterial({
      color: 0x8fa3c8,
      size: 0.42,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    })
  }
  return { geometry: moteGeometry, material: moteMaterial }
}

/** Светлая тема: холодные пылинки обычным блендингом — аддитивные были бы не видны. */
const LabIdleMotes = memo(function LabIdleMotes({ lite }: { lite: boolean }) {
  const res = useMemo(() => getMotes(), [])
  const points = useRef<THREE.Points>(null)
  useFrame((_, delta) => {
    const p = points.current
    if (!p) return
    p.rotation.y += (lite ? 0.004 : 0.008) * (delta > 0.05 ? 0.05 : delta)
  })
  return <points ref={points} geometry={res.geometry} material={res.material} frustumCulled={false} />
})

/**
 * Фон лаборатории: чистая пустота + движущиеся звёзды.
 * Без туманностей, колец и пыли — чтобы не спорили с атомом.
 */
export const LabIdleCosmicBackdrop = memo(function LabIdleCosmicBackdrop({
  lite = false,
}: {
  lite?: boolean
}) {
  const { theme } = useAppTheme()
  const light = theme === 'light'
  return (
    <>
      <LabIdleBackgroundSync theme={theme} />
      {light ? (
        <LabIdleMotes lite={lite} />
      ) : (
        <>
          <Stars
            radius={140}
            depth={80}
            count={lite ? 500 : 900}
            factor={lite ? 2.6 : 3.2}
            saturation={0.28}
            fade={false}
            speed={lite ? 0.35 : 0.55}
          />
          {!lite ? (
            <Stars radius={70} depth={36} count={160} factor={4.2} saturation={0.2} fade={false} speed={0.22} />
          ) : null}
        </>
      )}
    </>
  )
})
