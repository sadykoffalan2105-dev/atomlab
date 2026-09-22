import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject } from 'react'
import { createPortal } from 'react-dom'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { ATOMIC_DATA, type ElementSymbol } from '../../chemistry/data'
import { schoolValencyRoman } from '../../data/elementValencySchool'
import { useT } from '../../i18n/useT'
import { createAtomPool, createBondPool, type AtomPool, type BondPool } from '../../lab/cinema/core/pools'
import { createSafeArea, measureSafeArea, SAFE_AREA_EVERY } from '../../lab/cinema/core/safeArea'
import { damp, springStep, type SpringState } from '../../lab/cinema/core/spring'
import { InstancedAtoms } from '../../lab/cinema/react/InstancedAtoms'
import { InstancedBonds } from '../../lab/cinema/react/InstancedBonds'
import { commitPool, cpkHex, speciesLabel, writeAtom, writeBond } from '../../lab/cinema/scenes/kit/cpkAtoms'
import { materialFor, type AtomSurface } from '../../lab/cinema/scenes/kit/materials'
import { valenceDots, VALENCE_MAX_DOTS } from '../../lab/cinema/scenes/kit/valence'
import { localizeLabelText, toSceneLocale, useSceneRuntime } from '../../lab/cinema/scenes/kit/sceneKit'
import {
  electronRole,
  type ReactorParticle,
  type ReactorParticleSet,
} from '../../lab/reactorParticles'
import { PREVIEW_ATOM_SCALE } from './reactorPreviewLayout'

/**
 * Поле частиц реактора (этап балансировки) — тот же визуальный язык, что у сцен:
 * InstancedAtoms / InstancedBonds из src/lab/cinema, материалы kit/materials
 * (металл / ион / ковалентный / газ), радиусы и длины из ядра через reactorParticles.
 *
 * Пулы фиксированной ёмкости, React в кадре не участвует, ремаунта по ± нет:
 * новая частица влетает из-за края кластера и проявляется, убранная улетает и
 * гаснет — пружина из core/spring (~0,45 с), без аллокаций в useFrame.
 *
 * Контракт запуска синтеза: слот-группы atomGroupRefs (пустые, без шаров) стоят в
 * центрах частиц, пока идёт балансировка (syncSlots); во время полёта (follow)
 * частицы, наоборот, следуют за слотами, которые двигает SynthesisConvergeStreams.
 */

/** Ёмкость пулов: частиц, атомов, связей. Больше — рисуем первые (как lite-tier). */
const LIVE_CAP = 160
const ATOM_CAP = 480
const BOND_CAP = 640
/** Пружина прилёта/улёта: критически задемпфирована, оседает за ~0,45 с. */
const SPRING_OMEGA = 11
const SPRING_ZETA = 1
/** Гашение ниже этого — частица удаляется из живых. */
const ALPHA_EPS = 0.02
/** Толщина σ-связи в долях радиуса меньшего атома (визуальное правило, не химия). */
const BOND_RADIUS_K = 0.22
/** Предел увеличения ряда при вписывании: крупнее — атомы «лезут в камеру». */
const FIT_MAX = 1.7
/** Скорость вписывания в кадр, 1/с. */
const FIT_LAMBDA = 6
/** Цвет точек валентных электронов (нейтральный, не CPK: это электрон, а не атом). */
const ELECTRON_HEX = 0xeaf6ff

type Live = {
  used: boolean
  key: string
  particle: ReactorParticle | null
  flat: number
  surface: AtomSurface
  leaving: boolean
  tx: number
  ty: number
  tz: number
  x: SpringState
  y: SpringState
  z: SpringState
  a: SpringState
  targetA: number
}

function createLive(): Live {
  return {
    used: false,
    key: '',
    particle: null,
    flat: -1,
    surface: materialFor('default'),
    leaving: false,
    tx: 0,
    ty: 0,
    tz: 0,
    x: { x: 0, v: 0 },
    y: { x: 0, v: 0 },
    z: { x: 0, v: 0 },
    a: { x: 0, v: 0 },
    targetA: 1,
  }
}

type Hover = { key: string; atom: number; particle: ReactorParticle; x: number; y: number; pinned: boolean }

const _v = new THREE.Vector3()
const _w = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _m = new THREE.Matrix4()
const _o = new THREE.Vector3()
const _ox = new THREE.Vector3()

export type ReactorParticleFieldProps = {
  set: ReactorParticleSet
  /** Показывать поле (реактор открыт, продукт не владеет экраном). */
  visible: boolean
  lowPower?: boolean
  /** Балансировка: слот-группы ставятся в центры частиц. Иначе (полёт) частицы следуют за слотами. */
  syncSlots: boolean
  atomGroupRefs: MutableRefObject<(THREE.Group | null)[]>
  atomScaleGroupRefs: MutableRefObject<(THREE.Group | null)[]>
  showLabels: boolean
  interactive: boolean
}

export function ReactorParticleField({
  set,
  visible,
  lowPower = false,
  syncSlots,
  atomGroupRefs,
  atomScaleGroupRefs,
  showLabels,
  interactive,
}: ReactorParticleFieldProps) {
  const { gl, camera, size } = useThree()
  const { t, locale } = useT()
  const fieldRef = useRef<THREE.Group>(null)
  const hitRef = useRef<THREE.InstancedMesh>(null)
  // Рантайм поля создаётся один раз и дальше пишется в кадре (как мир сцены — useSceneRuntime).
  const { atoms, bonds, dots, lives, safe, hitLive, hitAtom, dotBuf } = useSceneRuntime(() => ({
    atoms: createAtomPool(ATOM_CAP) as AtomPool,
    bonds: createBondPool(BOND_CAP) as BondPool,
    dots: createAtomPool(VALENCE_MAX_DOTS) as AtomPool,
    lives: Array.from({ length: LIVE_CAP }, createLive),
    safe: createSafeArea(),
    /** Отображение instanceId хит-меша → живая частица и атом. */
    hitLive: new Int32Array(ATOM_CAP),
    hitAtom: new Int16Array(ATOM_CAP),
    dotBuf: new Float32Array(VALENCE_MAX_DOTS * 3),
  }))
  const timeRef = useRef(0)
  const byKey = useRef(new Map<string, Live>())
  /** Пары живых частиц со связью фрагмента (графит, S₈): [a, b, order]. */
  const linksRef = useRef<Array<[Live, Live, number]>>([])
  const firstSetRef = useRef(true)
  const fitRef = useRef({ s: 1, px: 0, py: 0, ready: false })
  const dotCountRef = useRef(0)
  const [hover, setHover] = useState<Hover | null>(null)
  const hoverRef = useRef<Hover | null>(null)
  useLayoutEffect(() => {
    hoverRef.current = hover
  }, [hover])
  const labelAnchors = useRef<(THREE.Group | null)[]>([])
  const labelDivs = useRef<(HTMLDivElement | null)[]>([])
  const labelsHostVisible = useRef(true)

  const hitGeo = useMemo(() => new THREE.SphereGeometry(1, 10, 8), [])
  const hitMat = useMemo(() => {
    const m = new THREE.MeshBasicMaterial()
    // Невидимая оболочка для наведения: рендерер её пропускает, raycast работает.
    m.visible = false
    return m
  }, [])
  useEffect(
    () => () => {
      hitGeo.dispose()
      hitMat.dispose()
    },
    [hitGeo, hitMat],
  )

  // ── Смена набора частиц: пружины живых получают новые цели, новые влетают, убранные улетают.
  useLayoutEffect(() => {
    const map = byKey.current
    const first = firstSetRef.current
    firstSetRef.current = false
    const seen = new Set<string>()
    const alloc = (): Live | null => {
      for (const l of lives) if (!l.used) return l
      return null
    }
    set.particles.forEach((p, idx) => {
      if (idx >= LIVE_CAP) return
      seen.add(p.key)
      const cl = set.clusters[p.termIndex]!
      let L = map.get(p.key) ?? null
      const fresh = !L
      if (!L) {
        L = alloc()
        if (!L) return
        L.used = true
        L.key = p.key
        map.set(p.key, L)
      }
      L.particle = p
      L.flat = idx
      L.surface = materialFor(cl.kind)
      L.leaving = false
      L.targetA = 1
      L.tx = p.center[0]
      L.ty = p.center[1]
      L.tz = p.center[2]
      if (fresh) {
        if (first) {
          L.x.x = L.tx
          L.y.x = L.ty
          L.z.x = L.tz
          L.a.x = 1
        } else {
          // Влёт из-за края кластера: по лучу от центра кластера (или сверху, если частица в центре).
          let dx = L.tx - cl.center[0]
          let dy = L.ty - cl.center[1]
          const len = Math.hypot(dx, dy)
          if (len < 1e-4) {
            dx = 0
            dy = 1
          } else {
            dx /= len
            dy /= len
          }
          const out = Math.max(cl.halfExtent[0], cl.halfExtent[1]) + 0.9
          L.x.x = L.tx + dx * out
          L.y.x = L.ty + dy * out
          L.z.x = L.tz + 0.4
          L.a.x = 0
        }
        L.x.v = 0
        L.y.v = 0
        L.z.v = 0
        L.a.v = 0
      }
    })
    for (const [key, L] of map) {
      if (seen.has(key)) continue
      if (!L.leaving) {
        // Улёт: наружу от центра ряда и вверх, одновременно гаснет.
        const dx = L.x.x >= 0 ? 1 : -1
        L.tx = L.x.x + dx * 0.9
        L.ty = L.y.x + 0.7
        L.tz = L.z.x + 0.3
        L.targetA = 0
        L.leaving = true
      }
    }
    const links: Array<[Live, Live, number]> = []
    for (const cl of set.clusters) {
      for (const ln of cl.links) {
        const pa = set.particles[cl.particles[ln.pa]!]
        const pb = set.particles[cl.particles[ln.pb]!]
        const la = pa ? map.get(pa.key) : undefined
        const lb = pb ? map.get(pb.key) : undefined
        if (la && lb) links.push([la, lb, ln.order])
      }
    }
    linksRef.current = links
    const h = hoverRef.current
    if (h && !seen.has(h.key)) setHover(null)
  }, [set, lives])

  // Точки валентного слоя наведённого атома — раскладка Льюиса считается один раз на наведение.
  useEffect(() => {
    if (!hover) {
      dotCountRef.current = 0
      return
    }
    const a = hover.particle.atoms[hover.atom]
    if (!a) {
      dotCountRef.current = 0
      return
    }
    const n = Math.max(0, ATOMIC_DATA[a.el].valenceElectrons - a.charge)
    dotCountRef.current = valenceDots(n, a.radius * 1.5, dotBuf)
  }, [hover, dotBuf])

  useFrame((state, delta) => {
    const field = fieldRef.current
    if (!field) return
    const dt = Math.min(0.05, Math.max(0, delta))
    timeRef.current += dt
    const root = field.parent

    // Поле выровнено по осям мира (корень превью могут вращать снаружи): ряд читается слева направо.
    if (root) {
      root.getWorldQuaternion(_q)
      field.quaternion.copy(_q).invert()
    }

    // ── Вписывание в свободную область холста (панели реактора и урока не перекрывают).
    if (syncSlots && root) {
      if (safe.counter++ % SAFE_AREA_EVERY === 0) measureSafeArea(safe, gl.domElement)
      root.getWorldPosition(_w)
      _o.copy(_w).project(camera)
      _ox.copy(_w).add(_v.set(1, 0, 0)).project(camera)
      const ppu = Math.abs(_ox.x - _o.x) * 0.5 * size.width
      if (ppu > 1e-3) {
        const left = safe.ready ? safe.left : 0
        const right = safe.ready ? safe.right : size.width
        const top = safe.ready ? safe.top : 0
        const bottom = safe.ready ? safe.bottom : size.height
        const freeW = Math.max(40, right - left)
        const freeH = Math.max(40, bottom - top)
        const labelPx = showLabels ? 34 : 0
        const w = Math.max(0.3, set.halfExtent[0] * 2)
        const h = Math.max(0.3, set.halfExtent[1] * 2)
        const sW = (freeW * 0.8) / (w * ppu)
        const sH = Math.max(0.05, freeH * 0.78 - labelPx) / (h * ppu)
        const s = Math.min(FIT_MAX, sW, sH)
        // Центр свободной области → мировая точка на глубине корня.
        const ndcX = ((left + right) / 2 / size.width) * 2 - 1
        const ndcY = -((((top + bottom) / 2 - labelPx / 2) / size.height) * 2 - 1)
        _v.set(ndcX, ndcY, _o.z).unproject(camera)
        const fit = fitRef.current
        if (!fit.ready) {
          fit.s = s
          fit.px = _v.x
          fit.py = _v.y
          fit.ready = true
        } else {
          fit.s = damp(fit.s, s, FIT_LAMBDA, dt)
          fit.px = damp(fit.px, _v.x, FIT_LAMBDA, dt)
          fit.py = damp(fit.py, _v.y, FIT_LAMBDA, dt)
        }
        // Мировой центр ряда = (px, py, z корня) минус центр набора в масштабе.
        _v.set(fit.px - set.center[0] * fit.s, fit.py - set.center[1] * fit.s, _w.z)
        root.worldToLocal(_v)
        field.position.copy(_v)
        field.scale.setScalar(fit.s)
      }
    }

    // ── Пружины живых частиц / следование за слотами полёта.
    let atomN = 0
    let bondN = 0
    const cap = atoms.capacity
    for (let li = 0; li < LIVE_CAP; li++) {
      const L = lives[li]!
      if (!L.used || !L.particle) continue
      const p = L.particle
      let scale = 1
      if (!syncSlots && !L.leaving && L.flat >= 0) {
        const g = atomGroupRefs.current[L.flat]
        if (g) {
          g.getWorldPosition(_v)
          field.worldToLocal(_v)
          L.x.x = _v.x
          L.y.x = _v.y
          L.z.x = _v.z
          const sg = atomScaleGroupRefs.current[L.flat]
          if (sg) scale = Math.max(0, Math.min(1.2, sg.scale.x / PREVIEW_ATOM_SCALE))
        }
      } else {
        springStep(L.x, L.tx, SPRING_OMEGA, SPRING_ZETA, dt)
        springStep(L.y, L.ty, SPRING_OMEGA, SPRING_ZETA, dt)
        springStep(L.z, L.tz, SPRING_OMEGA, SPRING_ZETA, dt)
      }
      springStep(L.a, L.targetA, SPRING_OMEGA, SPRING_ZETA, dt)
      const alpha = Math.max(0, Math.min(1, L.a.x))
      if (L.leaving && alpha < ALPHA_EPS) {
        L.used = false
        L.particle = null
        byKey.current.delete(L.key)
        continue
      }
      // Появление: шар растёт от 0,55 до 1 вместе с прозрачностью.
      const s = scale * (0.55 + 0.45 * alpha)
      const base = atomN
      for (let ai = 0; ai < p.atoms.length && atomN < cap; ai++) {
        const a = p.atoms[ai]!
        _v.set(L.x.x + a.pos[0] * s, L.y.x + a.pos[1] * s, L.z.x + a.pos[2] * s)
        writeAtom(atoms, atomN, {
          pos: _v,
          radius: a.radius * s,
          colorHex: cpkHex(a.el),
          charge: a.charge > 0 ? 1 : a.charge < 0 ? -1 : 0,
          emissive: 0.06,
          opacity: alpha,
          surface: a.charge !== 0 ? materialFor('ion') : L.surface,
        })
        hitLive[atomN] = li
        hitAtom[atomN] = ai
        atomN++
      }
      for (let bi = 0; bi < p.bonds.length && bondN < bonds.capacity; bi++) {
        const b = p.bonds[bi]!
        const A = p.atoms[b.a]
        const B = p.atoms[b.b]
        if (!A || !B || base + b.b >= atomN || base + b.a >= atomN) continue
        _v.set(L.x.x + A.pos[0] * s, L.y.x + A.pos[1] * s, L.z.x + A.pos[2] * s)
        _w.set(L.x.x + B.pos[0] * s, L.y.x + B.pos[1] * s, L.z.x + B.pos[2] * s)
        writeBond(bonds, bondN++, {
          a: _v,
          b: _w,
          radius: Math.min(A.radius, B.radius) * BOND_RADIUS_K * s,
          colorA: cpkHex(A.el),
          colorB: cpkHex(B.el),
          order: b.order,
          opacity: alpha,
        })
      }
    }
    // Связи фрагмента между частицами (графит, S₈, Si): обе частицы живы.
    for (const [la, lb, order] of linksRef.current) {
      if (!la.used || !lb.used || !la.particle || !lb.particle || bondN >= bonds.capacity) continue
      const A = la.particle.atoms[0]!
      const B = lb.particle.atoms[0]!
      const alpha = Math.min(la.a.x, lb.a.x)
      if (alpha < ALPHA_EPS) continue
      _v.set(la.x.x, la.y.x, la.z.x)
      _w.set(lb.x.x, lb.y.x, lb.z.x)
      writeBond(bonds, bondN++, {
        a: _v,
        b: _w,
        radius: Math.min(A.radius, B.radius) * BOND_RADIUS_K,
        colorA: cpkHex(A.el),
        colorB: cpkHex(B.el),
        order,
        opacity: Math.max(0, Math.min(1, alpha)),
      })
    }
    const show = visible && atomN > 0
    commitPool(atoms, show ? atomN : 0)
    commitPool(bonds, show ? bondN : 0)
    field.visible = show

    // ── Точки валентного слоя у наведённого атома.
    let dotN = 0
    const h = hoverRef.current
    if (show && h && syncSlots) {
      const L = byKey.current.get(h.key)
      const a = L?.particle?.atoms[h.atom]
      if (L && a) {
        const n = dotCountRef.current
        for (let k = 0; k < n; k++) {
          _v.set(L.x.x + a.pos[0] + dotBuf[k * 3]!, L.y.x + a.pos[1] + dotBuf[k * 3 + 1]!, L.z.x + a.pos[2] + dotBuf[k * 3 + 2]!)
          writeAtom(dots, dotN++, { pos: _v, radius: a.radius * 0.14, colorHex: ELECTRON_HEX, emissive: 0.6 })
        }
      }
    }
    commitPool(dots, dotN)

    // ── Хит-оболочки для наведения/касания.
    const hit = hitRef.current
    if (hit) {
      const n = interactive && show && syncSlots ? atomN : 0
      for (let i = 0; i < n; i++) {
        const o = i * 3
        const r = atoms.radius[i]! * 1.2
        _m.makeScale(r, r, r).setPosition(atoms.position[o]!, atoms.position[o + 1]!, atoms.position[o + 2]!)
        hit.setMatrixAt(i, _m)
      }
      hit.count = n
      if (n > 0) {
        hit.instanceMatrix.needsUpdate = true
        hit.computeBoundingSphere()
      }
    }

    // ── Слоты полёта стоят в центрах частиц (контракт запуска синтеза).
    if (syncSlots) {
      for (let li = 0; li < LIVE_CAP; li++) {
        const L = lives[li]!
        if (!L.used || L.leaving || L.flat < 0) continue
        const g = atomGroupRefs.current[L.flat]
        if (!g || !g.parent) continue
        _v.set(L.tx, L.ty, L.tz)
        field.localToWorld(_v)
        g.parent.worldToLocal(_v)
        g.position.copy(_v)
      }
    }

    // ── Подписи кластеров: следуют за частицами, прячутся вместе с корнем превью.
    let hostVisible = show && showLabels
    for (let o: THREE.Object3D | null = field; o && hostVisible; o = o.parent) if (!o.visible) hostVisible = false
    if (hostVisible !== labelsHostVisible.current) {
      labelsHostVisible.current = hostVisible
      for (const d of labelDivs.current) if (d) d.style.visibility = hostVisible ? 'visible' : 'hidden'
    }
    for (let ci = 0; ci < set.clusters.length; ci++) {
      const anchor = labelAnchors.current[ci]
      const cl = set.clusters[ci]!
      if (!anchor) continue
      let sx = 0
      let sy = 0
      let n = 0
      for (const pi of cl.particles) {
        const L = byKey.current.get(set.particles[pi]!.key)
        if (!L || L.leaving) continue
        sx += L.x.x - L.tx
        sy += L.y.x - L.ty
        n++
      }
      const ox = n > 0 ? sx / n : 0
      const oy = n > 0 ? sy / n : 0
      anchor.position.set(cl.labelPos[0] + ox, cl.labelPos[1] + oy, cl.labelPos[2])
    }
    void state
  })

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive || e.instanceId == null) return
    e.stopPropagation()
    const li = hitLive[e.instanceId]
    const ai = hitAtom[e.instanceId]
    const L = li != null ? lives[li] : undefined
    if (!L || !L.used || ai == null) return
    const cur = hoverRef.current
    if (cur?.pinned) return
    if (cur && cur.key === L.key && cur.atom === ai) return
    if (!L.particle) return
    setHover({ key: L.key, atom: ai, particle: L.particle, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, pinned: false })
  }
  const onOut = () => {
    const cur = hoverRef.current
    if (cur && !cur.pinned) setHover(null)
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!interactive || e.instanceId == null) return
    e.stopPropagation()
    const li = hitLive[e.instanceId]
    const ai = hitAtom[e.instanceId]
    const L = li != null ? lives[li] : undefined
    if (!L || !L.used || ai == null) return
    const cur = hoverRef.current
    if (cur && cur.pinned && cur.key === L.key && cur.atom === ai) {
      setHover(null)
      return
    }
    if (!L.particle) return
    setHover({ key: L.key, atom: ai, particle: L.particle, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, pinned: true })
  }

  const partners = useMemo(() => {
    const out: ElementSymbol[] = []
    for (const p of set.particles) for (const a of p.atoms) if (!out.includes(a.el)) out.push(a.el)
    return out
  }, [set])

  const cardModel = hover ? atomCardModel(hover.particle, hover.atom, partners, t, locale) : null

  return (
    <group ref={fieldRef} visible={false} frustumCulled={false}>
      <InstancedAtoms pool={atoms} mode={lowPower ? 'mesh' : 'impostor'} />
      <InstancedBonds pool={bonds} time={timeRef} lite={lowPower} />
      <InstancedAtoms pool={dots} mode={lowPower ? 'mesh' : 'impostor'} renderOrder={2} />
      <instancedMesh
        ref={hitRef}
        args={[hitGeo, hitMat, ATOM_CAP]}
        count={0}
        frustumCulled={false}
        onPointerMove={onMove}
        onPointerOut={onOut}
        onClick={onClick}
      />
      {showLabels
        ? set.clusters.map((cl, ci) => (
            <group
              key={cl.termId}
              ref={(g) => {
                labelAnchors.current[ci] = g
              }}
              position={cl.labelPos}
            >
              <Html center zIndexRange={[12, 0]} style={{ pointerEvents: 'none' }}>
                <div
                  ref={(d) => {
                    labelDivs.current[ci] = d
                  }}
                  style={LABEL_STYLE}
                  data-reactor-particle-label=""
                >
                  <span style={{ ...COEFF_STYLE, opacity: cl.coeff === 1 ? 0.45 : 1 }}>{cl.coeff}</span>
                  <span>{localizeParticleState(cl.label, locale)}</span>
                </div>
              </Html>
            </group>
          ))
        : null}
      {hover && cardModel ? (
        // Html даёт отдельный DOM-корень react-dom: внутри него портал в body законен
        // (в дереве R3F DOM-элементы недопустимы). Строки считаются здесь — контекст
        // локали в корень Html не передаётся.
        <Html position={[0, 0, 0]} zIndexRange={[60, 0]} style={{ pointerEvents: 'none' }}>
          <ReactorAtomCardDom model={cardModel} x={hover.x} y={hover.y} pinned={hover.pinned} onClose={() => setHover(null)} />
        </Html>
      ) : null}
    </group>
  )
}

const LABEL_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '0.3em',
  marginTop: '1.1em',
  whiteSpace: 'nowrap',
  userSelect: 'none',
  fontFamily: 'inherit',
  fontSize: '15px',
  fontWeight: 650,
  lineHeight: 1,
  color: '#eaf2ff',
  textShadow: '0 0 6px rgba(4, 10, 24, 0.95), 0 1px 2px rgba(0, 0, 0, 0.9)',
}

const COEFF_STYLE: CSSProperties = { fontSize: '19px', fontWeight: 800, color: '#ffffff' }

type AtomCardModel = {
  title: string
  color: string
  sub: string
  dots: number
  lines: string[]
  role: string | null
  closeLabel: string
}

/**
 * Карточка атома: валентные электроны (точками — и в 3D вокруг атома), ЭО,
 * радиус с типом, кто отдаёт / принимает электроны, школьная валентность.
 * Все числа — из ядра (ATOMIC_DATA, reactorParticles.electronRole).
 */
function atomCardModel(
  particle: ReactorParticle,
  atomIdx: number,
  partners: readonly ElementSymbol[],
  t: ReturnType<typeof useT>['t'],
  locale: string,
): AtomCardModel | null {
  const a = particle.atoms[atomIdx]
  if (!a) return null
  const d = ATOMIC_DATA[a.el]
  const decimal = locale === 'en' ? '.' : ','
  const num = (v: number) => String(v).replace('.', decimal)
  const role = electronRole(a.el, partners)
  const kind =
    a.radiusKind === 'metallic'
      ? t('reactor.card.radiusMetallic')
      : a.radiusKind === 'ionic'
        ? t('reactor.card.radiusIonic')
        : t('reactor.card.radiusCovalent')
  const roleText =
    role.kind === 'donor'
      ? t('reactor.card.donor', { n: role.electrons, ion: speciesLabel(a.el, role.electrons) })
      : role.kind === 'acceptor'
        ? t('reactor.card.acceptor', { n: role.electrons, ion: speciesLabel(a.el, -role.electrons) })
        : role.kind === 'shares'
          ? t('reactor.card.shares')
          : null
  const valency = schoolValencyRoman(d.z)
  const valence = Math.max(0, d.valenceElectrons - a.charge)
  const lines = [t('reactor.card.valence', { n: valence })]
  if (d.electronegativity != null) lines.push(t('reactor.card.en', { v: num(d.electronegativity) }))
  lines.push(t('reactor.card.radius', { r: num(a.radiusPm), kind }))
  if (valency) lines.push(t('reactor.card.valency', { v: valency }))
  return {
    title: speciesLabel(a.el, a.charge),
    color: `#${cpkHex(a.el).toString(16).padStart(6, '0')}`,
    sub: t('reactor.card.inParticle', { label: particle.label }),
    dots: valence,
    lines,
    role: roleText,
    closeLabel: t('reactor.card.close'),
  }
}

/** DOM карточки (портал в body, фиксированная позиция у курсора/пальца). */
function ReactorAtomCardDom({
  model,
  x,
  y,
  pinned,
  onClose,
}: {
  model: AtomCardModel
  x: number
  y: number
  pinned: boolean
  onClose: () => void
}) {
  if (typeof document === 'undefined') return null
  const vw = window.innerWidth
  const vh = window.innerHeight
  const left = Math.max(8, Math.min(vw - 290, x + 16))
  const top = Math.max(8, Math.min(vh - 230, y + 16))
  return createPortal(
    <div role="dialog" aria-live="polite" style={{ ...CARD_STYLE, left, top, pointerEvents: pinned ? 'auto' : 'none' }} data-reactor-atom-card="">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: model.color, textShadow: '0 0 2px #000, 0 0 1px #fff' }}>{model.title}</span>
        <span style={{ opacity: 0.75, fontSize: 12 }}>{model.sub}</span>
        {pinned ? (
          <button type="button" onClick={onClose} aria-label={model.closeLabel} style={CLOSE_STYLE}>
            ×
          </button>
        ) : null}
      </div>
      <div style={{ display: 'flex', gap: 3, margin: '6px 0 4px', flexWrap: 'wrap' }} aria-hidden>
        {Array.from({ length: model.dots }, (_, i) => (
          <span key={i} style={DOT_STYLE} />
        ))}
      </div>
      {model.lines.map((l) => (
        <div key={l}>{l}</div>
      ))}
      {model.role ? <div style={{ color: '#9fe8ff', fontWeight: 650 }}>{model.role}</div> : null}
    </div>,
    document.body,
  )
}

/** Карточка лежит поверх тёмной 3D-сцены (сцена тёмная в обеих темах) — цвета заданы явно. */
const CARD_STYLE: CSSProperties = {
  position: 'fixed',
  zIndex: 60,
  width: 270,
  padding: '10px 12px',
  borderRadius: 12,
  border: '1px solid rgba(148, 170, 230, 0.35)',
  background: 'rgba(10, 15, 32, 0.94)',
  boxShadow: '0 12px 30px -12px rgba(0, 0, 0, 0.7)',
  color: '#e8efff',
  fontSize: 13,
  lineHeight: 1.45,
}

const DOT_STYLE: CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: '50%',
  background: '#eaf6ff',
  boxShadow: '0 0 4px rgba(170, 220, 255, 0.9)',
}

const CLOSE_STYLE: CSSProperties = {
  marginLeft: 'auto',
  width: 32,
  height: 32,
  border: 0,
  borderRadius: 8,
  background: 'rgba(148, 170, 230, 0.16)',
  color: '#e8efff',
  fontSize: 18,
  lineHeight: 1,
  cursor: 'pointer',
}

/**
 * Агрегатное состояние в подписи частицы — теми же токенами, что в 3D-сценах (решение 8):
 * «Na (s)» → «Na (тв.)» на ru, «Cl₂ (g)» → «Cl₂ (g)» на en. Один язык в реакторе и в уроке.
 */
function localizeParticleState(label: string, locale: string): string {
  const m = /^(.*) \((s|g|l|aq)\)$/.exec(label)
  if (!m) return label
  return localizeLabelText(`${m[1]} ({${m[2]}})`, toSceneLocale(locale))
}
