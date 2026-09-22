#!/usr/bin/env node
/**
 * ATOMLAB Cinema kit — единый визуальный язык сцен (OPUS-3D-FORMATION-11).
 *
 * Проверяется то, что можно проверить данными, без WebGL:
 *   • материалы по типу вещества: materialFor различает типы, writeAtom пишет
 *     aSurface, упаковка в буфер шейдера, умолчание = прежний материал;
 *   • валентные электроны: valenceDots даёт ровно N точек на радиусе, раскладка
 *     Льюиса (пары после четырёх), drawValenceCloud рисует N точек;
 *   • octetSnap: радиус меняется в один кадр ровно в момент прихода электрона;
 *   • sampleElectronJump: признак arrived, дуга в плоскости экрана при view;
 *   • вид связи: double → 2 лепестка на связь (по одной p-записи на атом),
 *     triple → 4, ionic — без трубки и с дугами поля, hbond — нейтральный
 *     неподвижный пунктир;
 *   • камера: pitch применяется ригом ('YXZ', при pitch = 0 — как раньше),
 *     shotTrack/orbitTrack гладкие, assertCameraContinuity ловит прыжок;
 *   • safe area: сглаживание не зависит от частоты кадров; подписи зажимаются в
 *     свободную область и не пересекаются;
 *   • VSEPR: плоский треугольник, двугранный угол, мостик — числа аргументами;
 *   • ноль аллокаций в горячих функциях: повтор не меняет длины пулов и буферов.
 *
 * Запуск: npx tsx scripts/test-cinema-kit.mts
 */
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  ATOM_SURFACE_GAS_FLAG,
  ATOM_SURFACE_STRIDE,
  packAtomSurfaces,
} from '../src/lab/cinema/core/atomImpostorShader.ts'
import { createLabelLayoutBuffers, labelsOverlap, layoutLabels } from '../src/lab/cinema/core/labelLayout.ts'
import { createAtomPool, createBondPool, LobeKind } from '../src/lab/cinema/core/pools.ts'
import { applyCameraToRig, createSafeArea, writeSafeRect } from '../src/lab/cinema/core/safeArea.ts'
import { applyRigRotation, createCameraRigState } from '../src/lab/cinema/core/states.ts'
import { sampleScalar } from '../src/lab/cinema/core/tracks.ts'
import {
  createBridgedFrame,
  measureAngle,
  measureDihedral,
  writeBridged,
  writeDihedral,
  writeTrigonalPlanar,
} from '../src/lab/cinema/core/vsepr.ts'
import { bondVisualLobeCount, drawFieldLines, HBOND_COLOR, resetBondVisuals, writeBondVisual } from '../src/lab/cinema/scenes/kit/bondVisual.ts'
import { assertCameraContinuity, orbitTrack, sampleShot, shotTrack, type CameraSample } from '../src/lab/cinema/scenes/kit/camera.ts'
import { commitPool, cpkHex, pmToScene, writeAtom, writeBond } from '../src/lab/cinema/scenes/kit/cpkAtoms.ts'
import { createElectronJump, sampleElectronJump } from '../src/lab/cinema/scenes/kit/electronFx.ts'
import { materialFor, surfaceKindAt, type SubstanceKind } from '../src/lab/cinema/scenes/kit/materials.ts'
import {
  buildSceneWorld,
  createSceneCamera,
  localizeLabelText,
} from '../src/lab/cinema/scenes/kit/sceneKit.ts'
import {
  assertSnapAt,
  drawValenceCloud,
  octetSnap,
  VALENCE_MAX_DOTS,
  valenceDots,
} from '../src/lab/cinema/scenes/kit/valence.ts'
import type { GlowPointsHandle } from '../src/lab/cinema/react/CinemaGlowPoints.tsx'
import { BOND_ANGLES, BOND_DATA, BORN_HABER, bondLengthPm, CRYSTAL_IDS, getCrystal } from '../src/chemistry/data/index.ts'
import {
  cellEdges,
  cellMatrix,
  coordinationShell,
  createEdgePool,
  latticeCaption,
  latticeFragment,
  periodicNeighbors,
  setCellEdgesAmount,
  writeCellEdges,
  type LatticeFragment,
  type Vec3,
} from '../src/lab/cinema/scenes/kit/lattice.ts'
import { buildBornHaberLadder, formatStageFactor } from '../src/lab/cinema/scenes/kit/energyLadderData.ts'

let passed = 0
let checks = 0
function test(name: string, fn: () => void): void {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}
function ok(cond: unknown, msg: string): void {
  checks++
  assert.ok(cond, msg)
}
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps

/** Пул точек без WebGL: считает push и хранит последние координаты. */
function fakePoints(cap = 512): GlowPointsHandle & { n: number; xyz: Float32Array } {
  const xyz = new Float32Array(cap * 3)
  const h = {
    n: 0,
    xyz,
    begin() {
      h.n = 0
    },
    push(x: number, y: number, z: number) {
      if (h.n >= cap) return
      xyz[h.n * 3] = x
      xyz[h.n * 3 + 1] = y
      xyz[h.n * 3 + 2] = z
      h.n++
    },
    end() {},
  }
  return h
}

console.log('test-cinema-kit')

// ─── 1. Материалы по типу вещества ───────────────────────────────────────────
test('materialFor различает типы вещества', () => {
  const kinds: SubstanceKind[] = ['metal', 'ion', 'covalent', 'polar', 'gas', 'default']
  const sig = new Set(kinds.map((k) => {
    const m = materialFor(k)
    return `${m.metalness}|${m.roughness}|${m.anisotropy}|${m.rimSoftness}|${m.translucent}`
  }))
  ok(sig.size === kinds.length, 'у каждого типа свой набор параметров')
  const metal = materialFor('metal')
  const ion = materialFor('ion')
  const cov = materialFor('covalent')
  const gas = materialFor('gas')
  ok(metal.metalness > 0.5 && metal.anisotropy > 0, 'металл: металлический блеск и анизотропия')
  ok(ion.metalness === 0 && ion.roughness > cov.roughness && ion.rimSoftness > cov.rimSoftness, 'ион матовее ковалентного, ободок мягче')
  ok(cov.roughness < 0.35, 'ковалентный — глянец')
  ok(gas.translucent && gas.opacityScale < 1 && gas.lighten > 0, 'газ светлее и прозрачнее')
  ok(materialFor('default').roughness === 0, 'умолчание = прежний материал (roughness 0)')
  ok(materialFor('metal') === materialFor('metal'), 'materialFor не аллоцирует — общий объект')
})

test('writeAtom пишет aSurface; без surface слот сбрасывается в прежний материал', () => {
  const pool = createAtomPool(4)
  ok(pool.surface.length === 4 * ATOM_SURFACE_STRIDE, 'surface: 4 float на атом')
  const pos = new THREE.Vector3()
  writeAtom(pool, 0, { pos, radius: 1, colorHex: cpkHex('Na'), surface: materialFor('metal') })
  writeAtom(pool, 1, { pos, radius: 1, colorHex: cpkHex('Cl'), surface: materialFor('ion') })
  writeAtom(pool, 2, { pos, radius: 1, colorHex: cpkHex('O'), surface: materialFor('gas'), opacity: 1 })
  writeAtom(pool, 3, { pos, radius: 1, colorHex: cpkHex('H') })
  commitPool(pool, 4)
  ok(surfaceKindAt(pool, 0) === 'metal', 'атом 0 — металл')
  ok(surfaceKindAt(pool, 1) === 'ion', 'атом 1 — ион')
  ok(surfaceKindAt(pool, 2) === 'gas', 'атом 2 — газ')
  ok(pool.surface[2 * 4 + 3]! >= ATOM_SURFACE_GAS_FLAG, 'газ помечен флагом смешивания')
  ok(near(pool.opacity[2]!, materialFor('gas').opacityScale), 'газ: непрозрачность × opacityScale')
  ok(surfaceKindAt(pool, 3) === 'default', 'атом без surface — прежний материал')
  // Сброс: тот же слот без surface
  writeAtom(pool, 0, { pos, radius: 1, colorHex: cpkHex('Na') })
  ok(surfaceKindAt(pool, 0) === 'default' && pool.surface[0] === 0, 'слот сброшен')
  // Газ осветлён: линейный цвет O у газа светлее, чем у иона O
  const p2 = createAtomPool(2)
  writeAtom(p2, 0, { pos, radius: 1, colorHex: cpkHex('O'), surface: materialFor('gas') })
  writeAtom(p2, 1, { pos, radius: 1, colorHex: cpkHex('O'), surface: materialFor('ion') })
  ok(p2.color[1]! > p2.color[4]!, 'газ светлее того же элемента в ионе')
})

test('packAtomSurfaces: только первые count, нули за ними', () => {
  const pool = createAtomPool(3)
  const pos = new THREE.Vector3()
  writeAtom(pool, 0, { pos, radius: 1, colorHex: 0xffffff, surface: materialFor('covalent') })
  writeAtom(pool, 1, { pos, radius: 1, colorHex: 0xffffff, surface: materialFor('metal') })
  commitPool(pool, 2)
  const out = new Float32Array(3 * ATOM_SURFACE_STRIDE).fill(-5)
  const n = packAtomSurfaces(pool, out)
  ok(n === 2, 'упаковано 2')
  ok(near(out[1]!, materialFor('covalent').roughness), 'roughness атома 0')
  ok(near(out[4]!, materialFor('metal').metalness), 'metalness атома 1')
  ok(out[8] === -5, 'за count не пишется')
})

// ─── 2. Валентные электроны ──────────────────────────────────────────────────
test('valenceDots: ровно N точек на радиусе, пары после четырёх', () => {
  const out = new Float32Array(VALENCE_MAX_DOTS * 3)
  const r = 0.37
  for (let n = 0; n <= VALENCE_MAX_DOTS; n++) {
    const m = valenceDots(n, r, out)
    ok(m === n, `N=${n}: записано ${m}`)
    for (let k = 0; k < m; k++) {
      const d = Math.hypot(out[k * 3]!, out[k * 3 + 1]!, out[k * 3 + 2]!)
      ok(near(d, r, 1e-5), `N=${n}, точка ${k}: |r| = ${d}`)
    }
    // Все точки различны
    for (let a = 0; a < m; a++)
      for (let b = a + 1; b < m; b++) {
        const dd = Math.hypot(out[a * 3]! - out[b * 3]!, out[a * 3 + 1]! - out[b * 3 + 1]!, out[a * 3 + 2]! - out[b * 3 + 2]!)
        ok(dd > 0.05 * r, `N=${n}: точки ${a} и ${b} не совпадают`)
      }
  }
  // Льюис: у O (6) — две пары и два неспаренных; пара = две близкие точки.
  const pairsOf = (n: number) => {
    valenceDots(n, 1, out)
    let pairs = 0
    for (let a = 0; a < n; a++)
      for (let b = a + 1; b < n; b++) {
        const dd = Math.hypot(out[a * 3]! - out[b * 3]!, out[a * 3 + 1]! - out[b * 3 + 1]!, out[a * 3 + 2]! - out[b * 3 + 2]!)
        if (dd < 0.8) pairs++
      }
    return pairs
  }
  ok(pairsOf(1) === 0 && pairsOf(4) === 0, 'Na (1), C (4): без пар')
  ok(pairsOf(5) === 1, 'N (5): одна пара')
  ok(pairsOf(6) === 2, 'O (6): две пары + два неспаренных, O(³P)')
  ok(pairsOf(7) === 3, 'Cl (7): три пары + один')
  ok(pairsOf(8) === 4, 'октет: четыре пары')
  ok(valenceDots(40, 1, out) === VALENCE_MAX_DOTS, 'сверх предела — не больше VALENCE_MAX_DOTS')
})

test('drawValenceCloud: N отдельных точек (не кольцо из 28), skip прячет улетевший', () => {
  const gp = fakePoints()
  const c = new THREE.Vector3(1, 2, 3)
  for (const n of [1, 6, 7, 8]) {
    gp.begin()
    drawValenceCloud(gp, c, 0.5, n, 1, 0.7)
    ok(gp.n === n, `${n} электронов → ${gp.n} точек`)
    for (let k = 0; k < gp.n; k++) {
      const d = Math.hypot(gp.xyz[k * 3]! - c.x, gp.xyz[k * 3 + 1]! - c.y, gp.xyz[k * 3 + 2]! - c.z)
      ok(near(d, 0.5, 1e-5), 'точка на радиусе облака')
    }
  }
  gp.begin()
  drawValenceCloud(gp, c, 0.5, 1, 1, 0, { skip: 1 })
  ok(gp.n === 0, 'электрон Na улетел — облако донора пусто')
  gp.begin()
  drawValenceCloud(gp, c, 0.5, 8, 0, 0)
  ok(gp.n === 0, 'amount 0 — ничего')
})

test('octetSnap: радиус меняется в один кадр ровно в момент прихода', () => {
  const tArrive = 9.35
  const rNa = 1.34
  const rNaPlus = 0.73
  const track = octetSnap(tArrive, rNa, rNaPlus)
  assertSnapAt(track, tArrive, rNa, rNaPlus)
  checks++
  // На сетке 60 Гц: ровно один переход между соседними кадрами, без промежуточных значений.
  let changes = 0
  let prev = sampleScalar(track, 0)
  for (let f = 1; f < 60 * 20; f++) {
    const v = sampleScalar(track, f / 60)
    ok(near(v, rNa) || near(v, rNaPlus), `кадр ${f}: радиус ${v} — только «до» или «после»`)
    if (!near(v, prev)) changes++
    prev = v
  }
  ok(changes === 1, `смен радиуса ${changes}, ожидалась 1`)
  assert.throws(() => assertSnapAt([{ t: tArrive - 0.3, v: rNa }, { t: tArrive + 0.3, v: rNaPlus }], tArrive, rNa, rNaPlus))
  checks++
})

test('sampleElectronJump: arrived в кадр прихода; дуга в плоскости экрана при view', () => {
  const el = createElectronJump('e')
  const spec = {
    donor: new THREE.Vector3(-1, 0, 0),
    acceptor: new THREE.Vector3(1, 0, 0.5),
    shellRadius: 0.4,
    acceptorRadius: 0.5,
    leave: 5,
    arrive: 6,
  }
  ok(sampleElectronJump(el, 5.99, spec) === false && !el.arrived, 'до прихода — false')
  ok(sampleElectronJump(el, 6, spec) === true && el.arrived, 'в момент прихода — true')
  // Прежнее поведение без view: перпендикуляр через ось Z.
  sampleElectronJump(el, 5.5, spec)
  const dir = spec.acceptor.clone().sub(spec.donor).normalize()
  ok(near(el.perp.dot(dir), 0, 1e-6) && near(el.perp.z, 0, 1e-6), 'без view — как раньше (⟂ Z)')
  // Риг повёрнут: зритель смотрит вдоль −X рига → view = (1, 0, 0) в системе рига.
  const view = new THREE.Vector3(0.2, 1, 0.1)
  sampleElectronJump(el, 5.5, { ...spec, view })
  ok(near(el.perp.dot(dir), 0, 1e-6), 'дуга ⟂ линии переноса')
  ok(near(el.perp.dot(view.clone().normalize()), 0, 1e-6), 'дуга ⟂ лучу зрения — лежит в плоскости экрана')
  // Перенос прямо на зрителя: перпендикуляр всё равно определён.
  sampleElectronJump(el, 5.5, { ...spec, view: dir.clone() })
  ok(near(el.perp.length(), 1, 1e-6) && near(el.perp.dot(dir), 0, 1e-6), 'вырожденный случай — устойчиво')
  // До ухода электрон на оболочке донора — на её радиусе.
  sampleElectronJump(el, 4.5, { ...spec, view })
  ok(near(el.pos.distanceTo(spec.donor), spec.shellRadius, 0.021), 'на оболочке донора (± сдвиг 0.02 к зрителю)')
})

// ─── 3. Вид связи ────────────────────────────────────────────────────────────
test('writeBondVisual: double = σ + 2 p-лепестка (по одному на атом), triple = 4', () => {
  const world = buildSceneWorld({ atoms: 4, bonds: 4, glows: [] })
  const a = new THREE.Vector3(0, 0, 0)
  const b = new THREE.Vector3(1.2, 0, 0)
  const plane = new THREE.Vector3(0, 0, 1)
  resetBondVisuals(world)
  const n = writeBondVisual(world, 0, a, b, 'double', 2, 1, plane, { colorA: cpkHex('O'), colorB: cpkHex('C') })
  ok(n === 2 && world.lobes.count === 2, `double: записей лепестков ${n}`)
  ok(bondVisualLobeCount('double') === 2 && bondVisualLobeCount('triple') === 4 && bondVisualLobeCount('sigma') === 0, 'счётчик по виду')
  for (let i = 0; i < 2; i++) {
    ok(world.lobes.kind[i] === LobeKind.p, 'лепесток — p (две доли ±ось: над и под σ-осью)')
    const ax = new THREE.Vector3(world.lobes.axis[i * 3]!, world.lobes.axis[i * 3 + 1]!, world.lobes.axis[i * 3 + 2]!)
    ok(near(Math.abs(ax.dot(plane)), 1, 1e-6), 'ось π = нормаль плоскости')
    ok(near(ax.dot(b.clone().sub(a).normalize()), 0, 1e-6), 'π ⟂ оси связи')
  }
  const c0 = new THREE.Vector3(world.lobes.center[0]!, world.lobes.center[1]!, world.lobes.center[2]!)
  const c1 = new THREE.Vector3(world.lobes.center[3]!, world.lobes.center[4]!, world.lobes.center[5]!)
  ok(c0.distanceTo(a) < 1e-6 && c1.distanceTo(b) < 1e-6, 'по одной p-записи на каждом атоме')
  ok(world.bonds.order[0] === 1, 'трубка — только σ (кратность 1), π — лепестки')
  // triple: две перпендикулярные π
  resetBondVisuals(world)
  const m = writeBondVisual(world, 1, a, b, 'triple', 3, 1)
  ok(m === 4 && world.lobes.count === 4, 'triple: 4 записи')
  const n1 = new THREE.Vector3(world.lobes.axis[0]!, world.lobes.axis[1]!, world.lobes.axis[2]!)
  const n2 = new THREE.Vector3(world.lobes.axis[6]!, world.lobes.axis[7]!, world.lobes.axis[8]!)
  ok(near(n1.dot(n2), 0, 1e-6), 'две π взаимно перпендикулярны')
  // Без аллокаций / без роста: повтор кадра даёт то же число записей.
  for (let k = 0; k < 50; k++) {
    resetBondVisuals(world)
    writeBondVisual(world, 0, a, b, 'double', 2, 1, plane)
  }
  ok(world.lobes.count === 2, 'повтор кадра не накапливает лепестки')
  ok(world.lobes.center.length === world.lobes.capacity * 3, 'длина пула лепестков не меняется')
})

test('writeBondVisual: ionic — без трубки, 3–5 дуг поля; hbond — нейтральный неподвижный пунктир', () => {
  const world = buildSceneWorld({ atoms: 4, bonds: 4, glows: [] })
  const a = new THREE.Vector3(-1, 0, 0)
  const b = new THREE.Vector3(1, 0, 0)
  const gp = fakePoints()
  gp.begin()
  const n = writeBondVisual(world, 0, a, b, 'ionic', 1, 1, undefined, { gp, elapsed: 0.3, fieldLines: 4 })
  ok(n === 0 && world.bonds.opacity[0] === 0, 'ionic: трубка невидима, лепестков нет')
  ok(gp.n > 0 && gp.n % 4 === 0, `ionic: точки поля по 4 дугам (${gp.n})`)
  // Дуги: середина линии смещена от оси (не прямая «палочка»).
  let off = 0
  for (let k = 0; k < gp.n; k++) off = Math.max(off, Math.hypot(gp.xyz[k * 3 + 1]!, gp.xyz[k * 3 + 2]!))
  ok(off > 0.2, 'линии поля выгнуты дугой')
  gp.begin()
  drawFieldLines(gp, a, b, 1, 0, { lines: 9 })
  const per = gp.n / 5
  ok(Number.isInteger(per), 'больше пяти дуг не бывает (зажим 3…5)')
  // hbond
  writeBondVisual(world, 1, a, b, 'hbond', 1, 1, undefined, { colorA: cpkHex('O'), colorB: cpkHex('H') })
  ok(world.bonds.dashStatic[1] === 1, 'hbond: штрих неподвижен')
  ok(world.bonds.order[1]! < 1, 'hbond: пунктир (кратность < 1)')
  const ref = createBondPool(1)
  writeBond(ref, 0, { a, b, radius: 1, colorA: HBOND_COLOR, colorB: HBOND_COLOR })
  ok(near(world.bonds.colorA[3]!, ref.colorA[0]!) && near(world.bonds.colorB[5]!, ref.colorB[2]!), 'hbond: нейтральный цвет, не CPK')
  // Обычная связь в том же слоте снимает флаг неподвижного штриха.
  writeBondVisual(world, 1, a, b, 'sigma', 1.5, 1)
  ok(world.bonds.dashStatic[1] === 0 && near(world.bonds.order[1]!, 1.5), 'σ 1.5 — ползущий пунктир делокализации')
})

// ─── 4. Камера ───────────────────────────────────────────────────────────────
test('pitch применяется ригом: YXZ, при pitch = 0 — прежний поворот', () => {
  const rig = createCameraRigState()
  ok(rig.pitch === 0, 'по умолчанию наклона нет')
  const g = new THREE.Object3D()
  const legacy = new THREE.Object3D()
  rig.yaw = 0.7
  rig.roll = 0.1
  applyRigRotation(g, rig)
  legacy.rotation.set(0, 0.7, 0.1)
  g.updateMatrix()
  legacy.updateMatrix()
  for (let i = 0; i < 16; i++) ok(near(g.matrix.elements[i]!, legacy.matrix.elements[i]!, 1e-12), 'pitch 0 = прежняя матрица')
  rig.yaw = 0
  rig.roll = 0
  rig.pitch = 0.5
  applyRigRotation(g, rig)
  const v = new THREE.Vector3(0, 0, 1).applyEuler(g.rotation)
  ok(near(v.y, -Math.sin(0.5), 1e-9) && near(v.z, Math.cos(0.5), 1e-9), 'наклон вокруг горизонтали')
  ok(g.rotation.order === 'YXZ', "порядок 'YXZ'")
  // applyCameraToRig переносит pitch из камеры кадра в риг.
  const cam = createSceneCamera()
  cam.pitch = 0.33
  const safe = createSafeArea()
  safe.counter = 1 // не мерить DOM в Node
  const fakeCanvas = {} as HTMLCanvasElement
  applyCameraToRig(rig, safe, cam, { canvas: fakeCanvas, camera: new THREE.PerspectiveCamera(), width: 800, height: 600 })
  ok(near(rig.pitch, 0.33), 'rig.pitch = camera.pitch')
})

test('shotTrack / orbitTrack гладкие; assertCameraContinuity ловит прыжок', () => {
  const track = shotTrack([
    { t: 0, zoom: 1, yaw: 0, pitch: 0, target: [0, 0, 0] },
    { t: 4, zoom: 1.6, target: [0.5, 0.2, 0] },
    ...orbitTrack(8, 16, 0, Math.PI * 0.6, 0.35, 1.3),
  ])
  const cam = createSceneCamera()
  const sample = (t: number): CameraSample => sampleShot(track, t, cam)
  assertCameraContinuity(sample, 16)
  checks++
  sampleShot(track, 12, cam)
  ok(near(cam.pitch, 0.35), 'облёт держит наклон')
  sampleShot(track, 2, cam)
  ok(cam.offset.x < 0 && cam.offset.x > -0.5, 'наезд: мир едет навстречу цели')
  // Прыжок: yaw за один кадр на 0.5 рад
  const jumpy = shotTrack([{ t: 0, yaw: 0 }, { t: 5, yaw: 0 }, { t: 5.01, yaw: 0.5 }])
  assert.throws(() => assertCameraContinuity((t) => sampleShot(jumpy, t, cam), 8), /yaw прыгнул/)
  checks++
  const jumpOffset = shotTrack([{ t: 0, target: [0, 0, 0] }, { t: 3, target: [0, 0, 0] }, { t: 3.02, target: [2, 0, 0] }])
  assert.throws(() => assertCameraContinuity((t) => sampleShot(jumpOffset, t, cam), 5), /offset прыгнул/)
  checks++
  assert.throws(() => shotTrack([{ t: 1 }, { t: 1 }]), /по возрастанию/)
  checks++
})

test('safe area: сглаживание сдвига не зависит от частоты кадров; границы хранятся', () => {
  const run = (fps: number) => {
    const safe = createSafeArea()
    writeSafeRect(safe, 800, 600, 300, 800, 0, 600) // панель слева 300 px
    safe.counter = 1
    const rig = createCameraRigState()
    const cam = createSceneCamera()
    const camera = new THREE.PerspectiveCamera(45, 800 / 600, 0.1, 100)
    camera.position.set(0, 0, 8)
    camera.updateMatrixWorld()
    const view = { canvas: {} as HTMLCanvasElement, camera, width: 800, height: 600, dt: 1 / fps }
    const frames = Math.round(fps * 0.5)
    for (let f = 0; f < frames; f++) {
      safe.counter = 1
      applyCameraToRig(rig, safe, cam, view)
    }
    return safe.ox
  }
  ok(run(60) > 0.01, 'сцена сдвигается вправо, в свободную область')
  ok(near(run(60), run(30), 0.02 * Math.abs(run(60))), `30 и 60 Гц дают один сдвиг за 0.5 с (${run(30)} / ${run(60)})`)
  const s = createSafeArea()
  writeSafeRect(s, 800, 600, 300, 800, 50, 500)
  ok(s.left === 300 && s.right === 800 && s.top === 50 && s.bottom === 500 && s.cx === 550 && s.cy === 275, 'границы и центр')
})

test('подписи: зажим в свободную область и разнос пересечений', () => {
  const b = createLabelLayoutBuffers(4)
  const rect = { left: 300, right: 800, top: 40, bottom: 560 }
  const put = (i: number, x: number, y: number, w = 80, h = 17) => {
    b.on[i] = 1
    b.x[i] = x
    b.y[i] = y
    b.w[i] = w
    b.h[i] = h
  }
  put(0, 100, 300) // под панелью слева
  put(1, 500, 300)
  put(2, 505, 305) // почти поверх 1
  put(3, 520, 590) // под нижним краем
  const lenBefore = b.x.length
  layoutLabels(b, 4, rect)
  for (let i = 0; i < 4; i++) {
    ok(b.x[i]! - b.w[i]! / 2 >= rect.left - 1e-3 && b.x[i]! + b.w[i]! / 2 <= rect.right + 1e-3, `подпись ${i} по x в области`)
    ok(b.y[i]! - b.h[i]! / 2 >= rect.top - 1e-3 && b.y[i]! + b.h[i]! / 2 <= rect.bottom + 1e-3, `подпись ${i} по y в области`)
  }
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) ok(!labelsOverlap(b, i, j), `подписи ${i} и ${j} не пересекаются`)
  ok(b.x.length === lenBefore, 'буферы не пересоздаются')
})

test('localizeLabelText: кэш по локали без склейки строк, повтор — тот же объект строки', () => {
  const raw = 'Cl₂ ({g}) · 198.8 {pm}'
  const ru1 = localizeLabelText(raw, 'ru')
  const ru2 = localizeLabelText(raw, 'ru')
  const en = localizeLabelText(raw, 'en')
  ok(ru1 === ru2, 'повтор из кэша')
  ok(ru1.includes('пм') && en.includes('pm'), 'единицы в соглашении учебника языка')
  ok(!/\{\w+\}/.test(ru1) && !/\{\w+\}/.test(en), 'токены подставлены')
  ok(localizeLabelText('Na⁺', 'uz') === 'Na⁺', 'формулы не переводятся')
})

// ─── 5. VSEPR ────────────────────────────────────────────────────────────────
test('VSEPR: плоский треугольник, двугранный угол, мостик — числа аргументами', () => {
  const o = new THREE.Vector3(0.3, -0.2, 0.1)
  const tri = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  writeTrigonalPlanar(tri, o, 1.42, 0.4, 0.3, 0.2)
  for (let i = 0; i < 3; i++) {
    ok(near(tri[i]!.distanceTo(o), 1.42, 1e-9), 'длина лиганда')
    ok(near(measureAngle(tri[i]!, o, tri[(i + 1) % 3]!), 120, 1e-6), '120° между лигандами')
  }
  const nrm = tri[1]!.clone().sub(o).cross(tri[2]!.clone().sub(o)).normalize()
  ok(near(nrm.dot(tri[0]!.clone().sub(o)), 0, 1e-9), 'все три в одной плоскости (D₃h)')

  // Двугранный угол: цепочка a–b–c–d, как H–O–O–H; числа — произвольные аргументы теста.
  const a = new THREE.Vector3(0.9, 0.3, 0)
  const bb = new THREE.Vector3(0, 0, 0)
  const c = new THREE.Vector3(0, 0, 1.47)
  const d = new THREE.Vector3()
  for (const dih of [-150, -90, 0, 37, 90, 111.5, 179]) {
    writeDihedral(a, bb, c, d, 0.95, 94.8, dih)
    ok(near(d.distanceTo(c), 0.95, 1e-9), 'длина c–d')
    ok(near(measureAngle(bb, c, d), 94.8, 1e-6), '∠b–c–d')
    ok(near(measureDihedral(a, bb, c, d), dih, 1e-6), `двугранный ${dih}° → ${measureDihedral(a, bb, c, d)}`)
  }

  // Мостик O₃X–O–XO₃
  const fr = createBridgedFrame(3)
  writeBridged(fr, o, 1.709, 118.6, 1.405, 115.2, 0, 0.3, 0.2, 0.1)
  ok(near(fr.x0.distanceTo(fr.bridge), 1.709, 1e-9) && near(fr.x1.distanceTo(fr.bridge), 1.709, 1e-9), 'мостиковые длины')
  ok(near(measureAngle(fr.x0, fr.bridge, fr.x1), 118.6, 1e-6), '∠X–O–X')
  for (const [x, ts] of [[fr.x0, fr.t0], [fr.x1, fr.t1]] as const) {
    for (let i = 0; i < 3; i++) {
      ok(near(ts[i]!.distanceTo(x), 1.405, 1e-9), 'концевая длина')
      ok(near(measureAngle(ts[i]!, x, ts[(i + 1) % 3]!), 115.2, 1e-6), '∠O–X–O концевые')
    }
  }
  const frT = createBridgedFrame(3)
  writeBridged(frT, o, 1, 120, 1)
  ok(near(measureAngle(frT.bridge, frT.x0, frT.t0[0]!), 109.4712206, 1e-5), 'умолчание — тетраэдр у X')
})

// ─── 8. Решётка из базиса ядра (kit/lattice) ─────────────────────────────────
// Всё пересчитывается из CrystalDatum.basis и ячейки; литералы — только допуски и 231.8 ± 0.5 документа.

/** Узлы элемента, чьи дроби лежат во «внутренней» ячейке [lo, hi) по каждой оси — их окружение полное. */
function innerSites(f: LatticeFragment, el: string, lo = 1, hi = 2): number[] {
  const out: number[] = []
  f.sites.forEach((s, i) => {
    if (s.el === el && s.frac.every((v) => v >= lo - 1e-9 && v < hi - 1e-9)) out.push(i)
  })
  return out
}
function angleAt(p: Readonly<Vec3>, c: Readonly<Vec3>, q: Readonly<Vec3>): number {
  const u = [p[0] - c[0], p[1] - c[1], p[2] - c[2]] as const
  const v = [q[0] - c[0], q[1] - c[1], q[2] - c[2]] as const
  const d = u[0] * v[0] + u[1] * v[1] + u[2] * v[2]
  return (Math.acos(d / (Math.hypot(...u) * Math.hypot(...v))) * 180) / Math.PI
}
const len = (p: Readonly<Vec3>, q: Readonly<Vec3>) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
/** Ключ точки с округлением до 1e-5 и без «−0» (иначе «-0.00000» ≠ «0.00000»). */
const pointKey = (xyz: readonly number[]) => xyz.map((x) => (Math.round(x * 1e5) / 1e5 + 0).toFixed(5)).join(',')
const midKey = (p: Readonly<Vec3>, q: Readonly<Vec3>) => pointKey([0, 1, 2].map((c) => (p[c]! + q[c]!) / 2))

test('решётка: первая сфера однозначна, КЧ из базиса = crystalData.coordination', () => {
  for (const id of CRYSTAL_IDS) {
    const cr = getCrystal(id)!
    if (!cr.basis) continue
    const per = periodicNeighbors(id)
    ok(per.length === cr.basis.length, `${id}: окружение у каждого атома базиса`)
    const cnSet = new Set(Object.values(cr.coordination))
    per.forEach((p, i) => {
      ok(p.gapRatio > 1.1, `${id}[${i}]: граница первой сферы размыта (${p.gapRatio.toFixed(3)})`)
      // молекулярный кристалл (сухой лёд): в coordination — число соседних МОЛЕКУЛ, а не атомов
      if (cr.latticeType !== 'кубическая (молекулярная)') {
        ok(cnSet.has(p.shellPm.length), `${id}[${i}] ${cr.basis![i]!.el}: КЧ ${p.shellPm.length} нет в coordination`)
      }
    })
    ok(near(Math.min(...per.map((x) => x.minPm)), cr.cationAnionPm, 0.1), `${id}: кратчайшее из базиса = cationAnionPm`)
  }
})

test('NaCl 2×2×2: 125 ионов, заряды чередуются, октаэдр 6 × 282 пм, 12 рёбер у каждой ячейки', () => {
  const cr = getCrystal('nacl')!
  const n = 2
  const f = latticeFragment('nacl', [n, n, n])
  // узлы — сетка шага d = a/2: по ребру n·a/d + 1 узлов
  const perEdge = Math.round((n * cr.cellPm.a) / cr.cationAnionPm) + 1
  ok(perEdge === 5, `по ребру ${perEdge} ионов`)
  ok(f.sites.length === perEdge ** 3, `ионов ${f.sites.length}, ждали ${perEdge ** 3}`)
  const onEdge = f.sites.filter((s) => near(s.frac[1], 0, 1e-9) && near(s.frac[2], 0, 1e-9)).length
  ok(onEdge === perEdge, `на ребре куба ${onEdge} ионов`)
  ok(f.bonds.length > 0, 'есть пары соседей')
  for (const [i, j, d] of f.bonds) {
    ok(f.sites[i]!.charge * f.sites[j]!.charge < 0, `одноимённые ионы ${i},${j} — соседи`)
    ok(near(d, cr.cationAnionPm, 0.1), `d(Na–Cl) ${d}`)
    ok(near(len(f.sites[i]!.posScene, f.sites[j]!.posScene), pmToScene(d), 1e-9), 'posScene = pmToScene(пм)')
  }
  const inner = f.sites.map((s, i) => [s, i] as const).filter(([s]) => s.frac.every((v) => v > 1e-9 && v < n - 1e-9))
  ok(inner.length === (perEdge - 2) ** 3, `внутренних ионов ${inner.length}`)
  for (const [s, i] of inner) {
    const sh = coordinationShell(f, i)
    ok(sh.neighbors.length === 6 && s.cn === 6, `КЧ внутреннего иона ${sh.neighbors.length}`)
    ok(s.cn === cr.coordination[s.charge > 0 ? 'Na⁺' : 'Cl⁻'], 'КЧ = crystalData.coordination')
    for (const j of sh.neighbors) ok(f.sites[j]!.charge === -s.charge, 'сосед — противоион')
    for (const d of sh.distancesPm) ok(near(d, cr.cationAnionPm, 0.1), `расстояние ${d}`)
    ok(sh.edges.length === 12, `октаэдр: 12 рёбер, получено ${sh.edges.length}`)
  }
  // рёбра ячеек: уникальных 3·n·(n+1)², длина каждого = a, у каждой ячейки все 12 на месте
  ok(f.cellEdges.length === 3 * n * (n + 1) ** 2, `уникальных рёбер ${f.cellEdges.length}`)
  const aS = pmToScene(cr.cellPm.a)
  for (const [p, q] of f.cellEdges) ok(near(len(p, q), aS, 1e-9), 'ребро = a')
  const mids = new Set(f.cellEdges.map(([p, q]) => midKey(p, q)))
  const m = cellMatrix('nacl')
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
    let found = 0
    for (const [ax, u, v] of [[0, 1, 2], [1, 0, 2], [2, 0, 1]] as const) {
      for (const du of [0, 1]) for (const dv of [0, 1]) {
        const fr = [i, j, k]
        fr[ax]! += 0.5
        fr[u]! += du
        fr[v]! += dv
        const pm = [0, 1, 2].map((c) => fr[0]! * m.a[c]! + fr[1]! * m.b[c]! + fr[2]! * m.c[c]!)
        const key = pointKey(pm.map((x, c) => pmToScene(x) + f.offsetScene[c]!))
        if (mids.has(key)) found++
      }
    }
    ok(found === 12, `ячейка ${i}${j}${k}: рёбер ${found}`)
  }
  ok(f.boundsScene.center.every((c) => near(c, 0, 1e-9)), 'center: рамка в начале координат')
  ok(near(f.boundsScene.radius, (aS * n * Math.sqrt(3)) / 2, 1e-9), 'радиус рамки = половина диагонали')
  const ce = cellEdges('nacl', [n, n, n])
  ok(ce.length === f.cellEdges.length && ce.every(([p], i) => near(len(p, f.cellEdges[i]![0]), 0, 1e-12)), 'cellEdges = fragment.cellEdges')
  const noB = latticeFragment('nacl', [n, n, n], { includeBoundary: false })
  ok(noB.sites.length === cr.basis!.length * n ** 3, 'без границы — basis × число ячеек')
})

test('Na (ОЦК): КЧ 8 на a·√3/2, многогранник — куб', () => {
  const cr = getCrystal('na_metal')!
  const f = latticeFragment('na_metal', [2, 2, 2])
  const want = (cr.cellPm.a * Math.sqrt(3)) / 2
  ok(near(want, cr.cationAnionPm, 0.1), 'a√3/2 = cationAnionPm')
  const inner = innerSites(f, 'Na', 0.9, 1.6)
  ok(inner.length === 2, 'два атома внутри')
  for (const i of inner) {
    const sh = coordinationShell(f, i)
    ok(sh.neighbors.length === 8 && f.sites[i]!.cn === cr.coordination.Na, `КЧ ${sh.neighbors.length}`)
    for (const d of sh.distancesPm) ok(near(d, want, 0.01), `d ${d} ≠ a√3/2 ${want}`)
    ok(sh.edges.length === 12, `куб: 12 рёбер, получено ${sh.edges.length}`)
  }
})

test('кварц: у Si 4 O на ≈161 пм, у O 2 Si, ∠Si–O–Si из базиса', () => {
  const f = latticeFragment('quartz', [3, 3, 3])
  const lengths = BOND_DATA['Si-O'].lengthsPm ?? [bondLengthPm('Si-O')]
  const [lo, hi] = [Math.min(...lengths), Math.max(...lengths)]
  const si = innerSites(f, 'Si')
  const o = innerSites(f, 'O')
  ok(si.length === 3 && o.length === 6, `в ячейке ${si.length} Si и ${o.length} O (Z = 3)`)
  for (const i of si) {
    const sh = coordinationShell(f, i)
    ok(sh.neighbors.length === 4 && sh.neighbors.every((j) => f.sites[j]!.el === 'O'), 'SiO₄')
    for (const d of sh.distancesPm) ok(d >= lo - 0.1 && d <= hi + 0.1, `Si–O ${d}`)
    ok(sh.edges.length === 6, 'тетраэдр: 6 рёбер')
  }
  for (const i of o) {
    const sh = coordinationShell(f, i)
    ok(sh.neighbors.length === 2 && sh.neighbors.every((j) => f.sites[j]!.el === 'Si'), 'O — мостик между двумя Si')
    ok(sh.edges.length === 0, 'у КЧ 2 многогранника нет')
    const ang = angleAt(f.posPm[sh.neighbors[0]!]!, f.posPm[i]!, f.posPm[sh.neighbors[1]!]!)
    ok(near(ang, BOND_ANGLES.quartzSiOSi.deg, 0.3), `∠Si–O–Si ${ang.toFixed(2)}`)
  }
})

test('корунд: у Al 6 O двух длин, у O 4 Al', () => {
  const cr = getCrystal('corundum')!
  const f = latticeFragment('corundum', [3, 3, 3])
  const al = innerSites(f, 'Al')
  const o = innerSites(f, 'O')
  ok(al.length === 12 && o.length === 18, `в ячейке ${al.length} Al и ${o.length} O (Z = 6)`)
  for (const i of al) {
    const sh = coordinationShell(f, i)
    ok(sh.neighbors.length === 6 && sh.neighbors.every((j) => f.sites[j]!.el === 'O'), 'AlO₆')
    const kinds = [...new Set(sh.distancesPm.map((d) => d.toFixed(1)))]
    ok(kinds.length === 2, `две длины Al–O, получено ${kinds.join(', ')}`)
    ok(near(sh.distancesPm[0]!, cr.cationAnionPm, 0.1), 'кратчайшая = cationAnionPm')
    ok(sh.distancesPm.filter((d) => near(d, sh.distancesPm[0]!, 0.05)).length === 3, '3 короткие + 3 длинные')
    ok(sh.edges.length === 12, `искажённый октаэдр: 12 рёбер, получено ${sh.edges.length}`)
  }
  for (const i of o) {
    const sh = coordinationShell(f, i)
    ok(sh.neighbors.length === 4 && sh.neighbors.every((j) => f.sites[j]!.el === 'Al'), 'OAl₄')
    ok(f.sites[i]!.cn === cr.coordination['O²⁻'], 'КЧ O = coordination')
  }
})

test('глёт: у Pb 4 O на 231.8 ± 0.5 пм, квадратное основание пирамиды', () => {
  const f = latticeFragment('litharge', [3, 3, 3])
  const pb = innerSites(f, 'Pb')
  ok(pb.length === 2, 'Z = 2')
  for (const i of pb) {
    const sh = coordinationShell(f, i)
    ok(sh.neighbors.length === 4 && sh.neighbors.every((j) => f.sites[j]!.el === 'O'), 'PbO₄')
    for (const d of sh.distancesPm) {
      ok(Math.abs(d - 231.8) <= 0.5, `Pb–O ${d} вне 231.8 ± 0.5`)
      ok(near(d, bondLengthPm('Pb-O'), 0.1), 'Pb–O = bondData')
    }
    // четыре O в одной плоскости, Pb над ней — вершина пирамиды; рёбра — только стороны квадрата
    ok(sh.edges.length === 4, `квадрат основания: 4 ребра, получено ${sh.edges.length}`)
    const ys = sh.neighbors.map((j) => f.posPm[j]![1])
    ok(Math.max(...ys) - Math.min(...ys) < 1e-6, 'основание горизонтально (слой O ⟂ c)')
    ok(Math.abs(f.posPm[i]![1] - ys[0]!) > 50, 'Pb вне плоскости O')
  }
  for (const i of innerSites(f, 'O')) ok(coordinationShell(f, i).neighbors.length === 4, 'OPb₄')
})

test('кремний: КЧ 4 на a·√3/4 = bondData Si–Si', () => {
  const cr = getCrystal('si')!
  const f = latticeFragment('si', [2, 2, 2])
  const want = (cr.cellPm.a * Math.sqrt(3)) / 4
  ok(near(want, bondLengthPm('Si-Si'), 0.1), 'a√3/4 = bondData')
  const inner = innerSites(f, 'Si', 0.5, 1.5)
  ok(inner.length === cr.basis!.length, 'ячейка внутри фрагмента')
  const tet = (Math.acos(-1 / 3) * 180) / Math.PI
  for (const i of inner) {
    const sh = coordinationShell(f, i)
    ok(sh.neighbors.length === 4, 'тетраэдр')
    for (const d of sh.distancesPm) ok(near(d, want, 0.01), `Si–Si ${d}`)
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
      ok(near(angleAt(f.posPm[sh.neighbors[a]!]!, f.posPm[i]!, f.posPm[sh.neighbors[b]!]!), tet, 1e-3), 'тетраэдрический угол')
    }
  }
})

test('графит: 3 соседа на a/√3 в слое, слой ⟂ оси Y, ячейка — ромб 120°', () => {
  const cr = getCrystal('graphite')!
  const f = latticeFragment('graphite', [3, 3, 2])
  const want = cr.cellPm.a / Math.sqrt(3)
  ok(near(want, cr.cationAnionPm, 0.05), 'a/√3 = cationAnionPm')
  const inner = innerSites(f, 'C', 1, 2)
  ok(inner.length === cr.basis!.length, `Z = 4, получено ${inner.length}`)
  for (const i of inner) {
    const sh = coordinationShell(f, i)
    ok(sh.neighbors.length === 3, 'sp²: 3 соседа')
    for (const j of sh.neighbors) ok(near(f.posPm[j]![1], f.posPm[i]![1], 1e-6), 'сосед в том же слое')
    for (const d of sh.distancesPm) ok(near(d, want, 0.01), `C–C ${d}`)
    ok(sh.edges.length === 3, 'треугольник')
  }
  const m = cellMatrix('graphite')
  ok(near(angleAt(m.a, [0, 0, 0], m.b), 120, 1e-9), 'γ = 120° (ромбическая призма ячейки)')
  ok(near(m.c[0], 0, 1e-9) && near(m.c[2], 0, 1e-9) && near(m.c[1], cr.cellPm.c!, 1e-9), 'c ∥ +Y')
  // уникальные рёбра сетки 3×3×2: вдоль a 3·4·3, вдоль b 4·3·3, вдоль c 4·4·2
  ok(f.cellEdges.length === 3 * 4 * 3 + 4 * 3 * 3 + 4 * 4 * 2, `рёбра сетки ${f.cellEdges.length}`)
})

test('подпись решётки и пул рёбер ячейки', () => {
  const cr = getCrystal('nacl')!
  const cap = latticeCaption('nacl')
  ok(cap[0] === `a = ${Math.round(cr.cellPm.a)} {pm}`, cap[0]!)
  ok(cap.includes(cr.spaceGroup), 'группа')
  ok(cap.at(-1) === `{cn} ${Object.values(cr.coordination).join(':')}`, cap.at(-1)!)
  ok(localizeLabelText(cap[0]!, 'ru') === `a = ${Math.round(cr.cellPm.a)} пм`, 'ru: пм')
  ok(localizeLabelText(cap.at(-1)!, 'en') === `CN ${Object.values(cr.coordination).join(':')}`, 'en: CN')
  const lit = latticeCaption('litharge')
  ok(lit.some((s) => s.startsWith('c = ')) && !lit.some((s) => s.startsWith('b = ')), 'тетрагональная: a и c')
  ok(latticeCaption('massicot').some((s) => s.startsWith('b = ')), 'ромбическая: a, b, c')
  for (const s of [...cap, ...lit]) ok(!/[А-Яа-яЁё]/.test(s), `в 3D-подписи нет слов: ${s}`)

  const f = latticeFragment('nacl', [2, 2, 2])
  const pool = createEdgePool(64)
  const seg = pool.seg
  ok(writeCellEdges(pool, f.cellEdges) === f.cellEdges.length && pool.version === 1, 'запись рёбер')
  writeCellEdges(pool, f.cellEdges, [1, 0, 0], 2)
  ok(pool.seg === seg && near(pool.seg[0]!, f.cellEdges[0]![0][0] * 2 + 1, 1e-6), 'сдвиг и масштаб без новой памяти')
  setCellEdgesAmount(pool, 3)
  ok(pool.amount === 1, 'amount зажат в 0…1')
  let threw = false
  try {
    writeCellEdges(createEdgePool(4), f.cellEdges)
  } catch {
    threw = true
  }
  ok(threw, 'переполнение пула — ошибка, а не молча обрезанный каркас')
  const w = buildSceneWorld({ atoms: 8, bonds: 4, glows: [], edges: 60 })
  ok(w.edges?.capacity === 60, 'SceneWorld.edges по запросу')
  ok(buildSceneWorld({ atoms: 8, bonds: 4, glows: [] }).edges === undefined, 'без edges — слоя нет (старые сцены)')
})

test('лестница: множители ступеней из BornHaberStage', () => {
  let shown = 0
  for (const [id, cycle] of Object.entries(BORN_HABER)) {
    const at: Record<string, number> = {}
    cycle.stages.forEach((s, i) => (at[s.id] = i))
    const ladder = buildBornHaberLadder(id, at)
    for (const st of ladder.stages) {
      const txt = formatStageFactor(st, ',')
      if (st.multiplier == null || st.multiplier === 1 || st.perUnitKJ == null) {
        ok(txt === null, `${id}.${st.id}: без множителя — как раньше`)
        continue
      }
      shown++
      const mm = /^(\d+) × \(?(−?)([\d,]+)\)?$/.exec(txt ?? '')
      ok(mm !== null, `${id}.${st.id}: формат «${txt}»`)
      const per = Number(mm![3]!.replace(',', '.')) * (mm![2] ? -1 : 1)
      ok(Number(mm![1]) === st.multiplier, 'множитель')
      ok(near(per, st.perUnitKJ, 0.05), 'на частицу = perUnitKJ')
      ok(near(st.multiplier * per, st.dH, 0.05 * st.multiplier + 1e-9), `${id}.${st.id}: m × на частицу = ΔH ступени`)
    }
  }
  ok(shown > 0, 'хотя бы одна лестница с множителями (Al₂O₃)')
  ok(formatStageFactor({ multiplier: 2, perUnitKJ: 577.5 }, ',') === '2 × 577,5', 'пример документа')
  ok(formatStageFactor({ multiplier: 3, perUnitKJ: -141 }) === '3 × (−141)', 'отрицательная ступень в скобках')
})

console.log(`test-cinema-kit: ${passed} passed, ${checks} checks`)
