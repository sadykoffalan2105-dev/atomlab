/**
 * Взаимодействие лучом (VR-контроллер или эмуляция мышью): каждый кадр Raycaster от луча по кэш-списку
 * интерактивных объектов сцены (обход сцены раз в 500 мс: меш с userData.labTarget | userData.interactive |
 * обработчиками R3F onClick/onPointerDown). Синтетическое событие повторяет поля события R3F, которые читают
 * обработчики лаборатории, и несёт xr: { hand, ray(), onEnd(cb), onFrame(cb) } — так установка ведёт жест
 * (перетащить/провести) по лучу, а не по мыши.
 *
 * В VR и в эмуляции собственные события R3F выключены (setEvents({ enabled: false })) — иначе мышь в эмуляции
 * нажимала бы дважды.
 */
import * as THREE from 'three'

export type XrHand = 'left' | 'right' | 'none'

type Handler = (e: XrSyntheticEvent) => void
interface R3FInstance {
  handlers?: Partial<Record<'onClick' | 'onPointerDown' | 'onPointerUp' | 'onPointerOver' | 'onPointerOut' | 'onPointerEnter' | 'onPointerLeave' | 'onDoubleClick', Handler>>
}

export interface XrSyntheticEvent {
  readonly type: string
  readonly object: THREE.Object3D
  eventObject: THREE.Object3D
  readonly point: THREE.Vector3
  readonly distance: number
  readonly ray: THREE.Ray
  readonly camera: THREE.Camera
  readonly intersections: THREE.Intersection[]
  readonly delta: number
  readonly button: number
  readonly pointerId: number
  readonly clientX: number
  readonly clientY: number
  readonly nativeEvent: { readonly pointerType: 'xr'; readonly hand: XrHand }
  readonly xr: XrEventInfo
  stopped: boolean
  stopPropagation(): void
}

export interface XrEventInfo {
  readonly hand: XrHand
  /** Текущий луч контроллера (обновляется каждый кадр). */
  ray(): THREE.Ray
  /** Вызвать cb, когда кнопка отпущена (selectend). */
  onEnd(cb: () => void): void
  /** Вызывать cb каждый кадр, пока кнопка нажата. */
  onFrame(cb: (ray: THREE.Ray) => void): void
}

const handlersOf = (o: THREE.Object3D): R3FInstance['handlers'] | undefined => (o as unknown as { __r3f?: R3FInstance }).__r3f?.handlers

/** drei <Html> рендерит DOM — его обёртки в VR не нажимаются (и не перехватывают луч). */
function isHtmlWrapper(o: THREE.Object3D): boolean {
  let n: THREE.Object3D | null = o
  for (let i = 0; n && i < 3; i++, n = n.parent) if ((n.userData as { isHtml?: boolean }).isHtml) return true
  return false
}

function interactive(o: THREE.Object3D): boolean {
  const u = o.userData as { labTarget?: string; interactive?: boolean }
  if (u.labTarget || u.interactive) return true
  const h = handlersOf(o)
  return !!(h && (h.onClick || h.onPointerDown || h.onPointerOver))
}

function visibleChain(o: THREE.Object3D): boolean {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) if (!n.visible) return false
  return true
}

export interface XrPointerState {
  readonly hand: XrHand
  readonly ray: THREE.Ray
  /** Точка попадания (если есть) и нормаль — для курсора. */
  hit: THREE.Intersection | null
  /** Объект с обработчиком, над которым луч (для подсветки и хаптики). */
  hover: THREE.Object3D | null
  pressed: boolean
  downPoint: THREE.Vector3 | null
  downObject: THREE.Object3D | null
  endCbs: (() => void)[]
  frameCbs: ((ray: THREE.Ray) => void)[]
}

export function makePointer(hand: XrHand): XrPointerState {
  return { hand, ray: new THREE.Ray(), hit: null, hover: null, pressed: false, downPoint: null, downObject: null, endCbs: [], frameCbs: [] }
}

export class XrRayInput {
  private list: THREE.Object3D[] = []
  private lastScan = -1e9
  private readonly caster = new THREE.Raycaster()
  /** Объекты, которые не должны ловить луч (сам луч, курсор, площадки — у них свои проверки). */
  readonly ignore = new Set<THREE.Object3D>()

  private readonly scene: THREE.Scene
  private readonly camera: () => THREE.Camera
  private readonly canvas: () => HTMLCanvasElement

  constructor(scene: THREE.Scene, camera: () => THREE.Camera, canvas: () => HTMLCanvasElement) {
    this.scene = scene
    this.camera = camera
    this.canvas = canvas
    this.caster.far = 3
  }

  /** Обход сцены не чаще раза в 500 мс: список мешей, у которых (или у предков) есть обработчики. */
  private scan(now: number) {
    if (now - this.lastScan < 500) return
    this.lastScan = now
    const out: THREE.Object3D[] = []
    this.scene.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh && !(o as THREE.Sprite).isSprite) return
      if (this.ignore.has(o) || isHtmlWrapper(o)) return
      for (let n: THREE.Object3D | null = o; n; n = n.parent) {
        if (interactive(n)) {
          out.push(o)
          return
        }
      }
    })
    this.list = out
  }

  /** Первое попадание луча в видимый интерактивный меш. */
  cast(ray: THREE.Ray, now: number): THREE.Intersection[] {
    this.scan(now)
    this.caster.ray.copy(ray)
    const hits = this.caster.intersectObjects(this.list, false)
    return hits.filter((h) => visibleChain(h.object))
  }

  private screen(point: THREE.Vector3): [number, number] {
    const r = this.canvas().getBoundingClientRect()
    const p = point.clone().project(this.camera())
    return [r.left + ((p.x + 1) / 2) * r.width, r.top + ((1 - p.y) / 2) * r.height]
  }

  private makeEvent(type: string, ptr: XrPointerState, hit: THREE.Intersection, hits: THREE.Intersection[]): XrSyntheticEvent {
    const [cx, cy] = this.screen(hit.point)
    const e: XrSyntheticEvent = {
      type,
      object: hit.object,
      eventObject: hit.object,
      point: hit.point.clone(),
      distance: hit.distance,
      ray: ptr.ray.clone(),
      camera: this.camera(),
      intersections: hits,
      delta: 0,
      button: 0,
      pointerId: ptr.hand === 'left' ? 11 : 12,
      clientX: cx,
      clientY: cy,
      nativeEvent: { pointerType: 'xr', hand: ptr.hand },
      xr: {
        hand: ptr.hand,
        ray: () => ptr.ray,
        onEnd: (cb) => ptr.endCbs.push(cb),
        onFrame: (cb) => ptr.frameCbs.push(cb),
      },
      stopped: false,
      stopPropagation() {
        this.stopped = true
      },
    }
    return e
  }

  /** Как в R3F: по попаданиям от ближнего к дальнему, у каждого — вверх по предкам, пока не stopPropagation. */
  private dispatch(name: keyof NonNullable<R3FInstance['handlers']>, ptr: XrPointerState, hits: THREE.Intersection[]): boolean {
    let called = false
    for (const hit of hits) {
      const e = this.makeEvent(name, ptr, hit, hits)
      for (let n: THREE.Object3D | null = hit.object; n; n = n.parent) {
        const fn = handlersOf(n)?.[name]
        if (!fn) continue
        e.eventObject = n
        try {
          fn(e)
        } catch (err) {
          console.warn('[xr] обработчик', name, err)
        }
        called = true
        if (e.stopped) return true
      }
    }
    return called
  }

  /** Объект, который получит наведение: первый предок попадания с обработчиком наведения/нажатия. */
  private hoverTarget(hits: THREE.Intersection[]): THREE.Object3D | null {
    for (const h of hits) {
      for (let n: THREE.Object3D | null = h.object; n; n = n.parent) {
        const hd = handlersOf(n)
        if (hd && (hd.onPointerOver || hd.onClick || hd.onPointerDown)) return n
        if ((n.userData as { labTarget?: string }).labTarget) return n
      }
    }
    return null
  }

  /** Кадр: луч обновлён снаружи. Возвращает true, если объект под лучом сменился (для хаптики). */
  update(ptr: XrPointerState, now: number): boolean {
    const hits = this.cast(ptr.ray, now)
    ptr.hit = hits[0] ?? null
    for (const cb of ptr.frameCbs) cb(ptr.ray)
    const next = this.hoverTarget(hits)
    if (next === ptr.hover) return false
    const prev = ptr.hover
    ptr.hover = next
    if (prev) {
      const fn = handlersOf(prev)?.onPointerOut
      if (fn && hits.length >= 0) {
        try {
          fn(this.makeEvent('onPointerOut', ptr, { object: prev, point: prev.getWorldPosition(new THREE.Vector3()), distance: 0 } as THREE.Intersection, []))
        } catch {
          /* не важно */
        }
      }
    }
    if (next && hits[0]) {
      const fn = handlersOf(next)?.onPointerOver
      if (fn) {
        try {
          fn(this.makeEvent('onPointerOver', ptr, hits[0], hits))
        } catch {
          /* не важно */
        }
      }
    }
    return next != null
  }

  selectStart(ptr: XrPointerState, now: number) {
    const hits = this.cast(ptr.ray, now)
    ptr.pressed = true
    ptr.downPoint = hits[0]?.point.clone() ?? null
    ptr.downObject = hits[0]?.object ?? null
    ptr.endCbs = []
    ptr.frameCbs = []
    if (hits.length) this.dispatch('onPointerDown', ptr, hits)
  }

  /** Отпускание: onPointerUp; onClick — если луч за время нажатия ушёл от точки нажатия меньше чем на 2 см. */
  selectEnd(ptr: XrPointerState, now: number): boolean {
    const hadGesture = ptr.endCbs.length > 0
    const cbs = ptr.endCbs
    ptr.endCbs = []
    ptr.frameCbs = []
    ptr.pressed = false
    for (const cb of cbs) cb()
    const hits = this.cast(ptr.ray, now)
    if (hits.length) this.dispatch('onPointerUp', ptr, hits)
    const still = ptr.downPoint != null && ptr.ray.distanceToPoint(ptr.downPoint) < 0.02
    let clicked = false
    if (!hadGesture && still && hits.length) clicked = this.dispatch('onClick', ptr, hits)
    ptr.downPoint = null
    ptr.downObject = null
    return clicked || hadGesture
  }
}
