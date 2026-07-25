#!/usr/bin/env node
/**
 * ATOMLAB Cinema — контракт раскадровки диоксида хлора.
 *
 * Сцена 3D проверяется данными, а не глазами: раскадровка — это чистые дорожки,
 * поэтому весь сюжет можно просэмплировать в Node и убедиться, что реакция
 * идёт химически верно и без рывков. Ловит именно те дефекты, которые были
 * в прошлой версии сцены: телепорты атомов на границах фаз, разрыв «не той»
 * связи, продукт, появляющийся раньше переноса электрона.
 *
 * Запуск: npx tsx scripts/test-clo2-cinema.mts
 */
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { BOND_ANGLE_DEG, BOND_LENGTH_A, ang } from '../src/lab/cinema/core/atoms.ts'
import { Ease, ease } from '../src/lab/cinema/core/easing.ts'
import { isSceneTextSafe, sceneText } from '../src/lab/cinema/core/glyphs.ts'
import { sampleScalar, sampleVec3, validateTrack } from '../src/lab/cinema/core/tracks.ts'
import { storyDuration, storyWallDuration } from '../src/lab/cinema/core/storyTime.ts'
import { createCueRunner, pulseAt } from '../src/lab/cinema/core/cues.ts'
import { createBentFrame, measureAngle, writeBent, writeTetrahedral } from '../src/lab/cinema/core/vsepr.ts'
import {
  CLO2_CAPTIONS,
  CLO2_CUES,
  CLO2_GEOM,
  CLO2_PHASE,
  CLO2_SEGMENTS,
  CLO2_TRACKS,
  CLO2_TRANSFER_WINDOW,
  clo2StageAt,
  validateClo2Storyboard,
} from '../src/lab/cinema/scenes/clo2/storyboard.ts'

const END = CLO2_PHASE.finaleEnd
const DT = 1 / 120

// ——— Ядро библиотеки: easing и дорожки ———
{
  for (const [name, fn] of Object.entries(Ease)) {
    assert.ok(Math.abs(fn(0)) < 1e-6, `ease ${name}: f(0) must be 0`)
    if (name !== 'spike' && name !== 'flash') {
      assert.ok(Math.abs(fn(1) - 1) < 1e-6, `ease ${name}: f(1) must be 1`)
    }
  }
  assert.equal(ease(undefined, 0.5), 0.5, 'the default curve is symmetric around the midpoint')

  const track = [
    { t: 0, v: 0 },
    { t: 1, v: 10 },
  ]
  assert.equal(sampleScalar(track, -1), 0, 'before first key — hold')
  assert.equal(sampleScalar(track, 5), 10, 'after last key — hold')
  assert.equal(sampleScalar(track, 0.5), 5)

  assert.throws(
    () => validateTrack('broken', [{ t: 1 }, { t: 1 }]),
    /strictly increasing/,
    'duplicate keys must be rejected',
  )

  // Дуга выгибает траекторию, но не сдвигает концы — иначе атом «прилетит» не туда.
  const arc = [
    { t: 0, v: [0, 0, 0] as const },
    { t: 1, v: [2, 0, 0] as const, arc: 0.5 },
  ]
  const out = new THREE.Vector3()
  sampleVec3(arc, 1, out)
  assert.ok(out.distanceTo(new THREE.Vector3(2, 0, 0)) < 1e-6, 'arc keeps the end key exact')
  sampleVec3(arc, 0.5, out)
  assert.ok(out.distanceTo(new THREE.Vector3(1, 0, 0)) > 0.3, 'arc bends the middle of the path')
}

// ——— Геометрия молекул ———
{
  const frame = createBentFrame()
  const origin = new THREE.Vector3(1, -2, 0.5)
  writeBent(frame, origin, BOND_ANGLE_DEG.clo2, CLO2_GEOM.clORadical, 0.7, 0.3, -0.2)
  assert.ok(
    Math.abs(measureAngle(frame.l0, frame.center, frame.l1) - BOND_ANGLE_DEG.clo2) < 1e-4,
    'ClO2 angle survives an arbitrary rotation',
  )
  assert.ok(
    Math.abs(frame.l0.distanceTo(frame.center) - CLO2_GEOM.clORadical) < 1e-6,
    'bond length is exact',
  )

  const h = [0, 1, 2, 3].map(() => new THREE.Vector3())
  const c = new THREE.Vector3()
  writeTetrahedral(h, c, ang(BOND_LENGTH_A.CH), 0.4, 0.2)
  assert.ok(
    Math.abs(measureAngle(h[0]!, c, h[1]!) - BOND_ANGLE_DEG.tetrahedral) < 1e-2,
    'methane keeps the 109.47° tetrahedron',
  )
}

// ——— Хронометраж ———
{
  validateClo2Storyboard()

  let prev = 0
  for (const seg of CLO2_SEGMENTS) {
    assert.ok(seg.to > prev, 'segments must advance story time')
    assert.ok(seg.wall > 0, 'every segment takes screen time')
    prev = seg.to
  }
  assert.equal(prev, END, 'segments cover the whole storyboard')
  assert.equal(storyDuration(CLO2_SEGMENTS), END, 'story duration matches the last phase')

  const wall = storyWallDuration(CLO2_SEGMENTS)
  assert.ok(wall > 8 && wall < 14, `wall duration out of range: ${wall}`)

  // Фаза 3 (перенос электрона) обязана идти медленнее сюжета — это slow-motion.
  const transfer = CLO2_SEGMENTS[2]!
  const storySpan = transfer.to - CLO2_SEGMENTS[1]!.to
  assert.ok(transfer.wall > storySpan, 'the electron-transfer beat must be slowed down')

  assert.equal(clo2StageAt(0), 1)
  assert.equal(clo2StageAt(CLO2_PHASE.entryEnd), 2)
  assert.equal(clo2StageAt(CLO2_PHASE.approachEnd), 3)
  assert.equal(clo2StageAt(CLO2_PHASE.releaseEnd), 5)
  for (const stage of [1, 2, 3, 4, 5] as const) {
    const { text, sub } = CLO2_CAPTIONS[stage]
    assert.ok(text.length > 0, `caption ${stage} is filled`)
    // Шрифт 3D-текста не знает индексов и стрелок вверх/вниз: если строка не
    // приводится к безопасным глифам, ученик увидит на экране пустые квадраты.
    assert.ok(isSceneTextSafe(text), `caption ${stage} has glyphs the 3D font cannot draw: ${sceneText(text)}`)
    assert.ok(isSceneTextSafe(sub), `caption sub ${stage} has unsupported glyphs: ${sceneText(sub)}`)
  }
  assert.equal(sceneText('2 NaClO₂ + Cl₂ → 2 NaCl + 2 ClO₂'), '2 NaClO2 + Cl2 → 2 NaCl + 2 ClO2')
  assert.equal(sceneText('Cl: +3 → +4, e⁻ уходит к Na⁺'), 'Cl: +3 → +4, e- уходит к Na+')
}

// ——— События: порядок сюжета и одноразовость ———
{
  const fired: string[] = []
  const runner = createCueRunner(CLO2_CUES)
  for (let t = 0; t <= END + 0.5; t += DT) runner.update(t, (id) => fired.push(id))

  assert.equal(fired.length, CLO2_CUES.length, 'every cue fires exactly once')
  assert.deepEqual(
    fired,
    [...CLO2_CUES].sort((a, b) => a.at - b.at).map((c) => c.id),
    'cues fire in story order',
  )

  const order = (id: string) => fired.indexOf(id)
  assert.ok(order('tension') < order('transfer'), 'tension before the electron leaves')
  assert.ok(order('transfer') < order('break'), 'electron transfer precedes the Cl–Cl rupture')
  assert.ok(order('break') < order('pairA'), 'NaCl snaps only after Cl⁻ appears')
  assert.ok(order('pairA') < order('radicalA'), 'salt pairs before the amber gas is announced')
  assert.ok(order('radicalB') < order('embryo'), 'lab is told about the product after it exists')
  assert.ok(order('embryo') < order('birth') && order('birth') < order('complete'), 'lab handshake order')
  assert.equal(fired[fired.length - 1], 'complete', 'complete closes the scene')

  const completeAt = CLO2_CUES.find((c) => c.id === 'complete')!.at
  assert.equal(completeAt, END, 'onComplete lands on the last frame of the storyboard')

  // Один и тот же прогон, пройденный крупными шагами, не теряет события:
  // при просадке FPS сцена не должна «проглатывать» разрыв связи.
  const coarse: string[] = []
  const coarseRunner = createCueRunner(CLO2_CUES)
  for (let t = 0; t <= END + 0.5; t += 0.4) coarseRunner.update(t, (id) => coarse.push(id))
  assert.deepEqual(coarse, fired, 'cues survive frame drops')

  assert.equal(pulseAt(1, 2, 0.5), 0, 'pulse is silent before its cue')
  assert.ok(pulseAt(2.06, 2, 0.5) > 0.9, 'pulse peaks right after the cue')
  assert.equal(pulseAt(3, 2, 0.5), 0, 'pulse fully decays')
}

// ——— Химия сюжета ———
const tr = CLO2_TRACKS
const at = (track: Parameters<typeof sampleScalar>[0], t: number) => sampleScalar(track, t)
const [TRANSFER_START, BREAK] = CLO2_TRANSFER_WINDOW

{
  // Реакция: 2 NaClO₂ + Cl₂ → 2 NaCl + 2 ClO₂.
  // Рвётся ТОЛЬКО связь Cl–Cl. Связи Cl–O живут всю сцену.
  assert.equal(at(tr.cl2Opacity, 0), 1, 'Cl₂ enters as a real molecule')
  assert.ok(at(tr.cl2Opacity, BREAK - 0.02) > 0.95, 'Cl–Cl is intact until the rupture')
  assert.ok(at(tr.cl2Opacity, BREAK + 0.15) < 0.05, 'Cl–Cl is gone right after the rupture')
  assert.equal(at(tr.cl2Opacity, END), 0, 'no chlorine molecule in the products')

  // Связь белеет и истончается перед разрывом — «накопление энергии».
  assert.ok(at(tr.cl2Stress, BREAK) > 0.98, 'Cl–Cl reaches white-hot stress at the rupture')
  assert.ok(at(tr.cl2Stress, 0.2) < 0.35, 'no stress while the reagents are just drifting')
  assert.ok(at(tr.cl2Thinning, BREAK) > at(tr.cl2Thinning, 1), 'the bond thins out towards the rupture')

  // Электрон уходит от хлорита к хлору: сначала перенос, потом рост аниона.
  assert.equal(at(tr.clAnionGrowth, TRANSFER_START), 0, 'Cl is neutral before the transfer')
  assert.ok(at(tr.clAnionGrowth, END) > 0.99, 'Cl⁻ keeps the extra electron to the end')
  assert.ok(CLO2_GEOM.radius.clAnion > CLO2_GEOM.radius.cl, 'the anion is larger than the atom')

  // Ионная связь Na⁺–Cl⁻ не может существовать до появления Cl⁻.
  assert.equal(at(tr.naClOpacity, BREAK - 0.1), 0, 'no NaCl before the chloride ion exists')
  assert.ok(at(tr.naClOpacity, END) > 0.8, 'NaCl stays as the precipitate')

  // Угол O–Cl–O: хлорит 110.5° → радикал ClO₂ 117.4°.
  assert.equal(at(tr.bondAngle, 0), BOND_ANGLE_DEG.chlorite, 'starts as the chlorite ion')
  assert.equal(at(tr.bondAngle, END), BOND_ANGLE_DEG.clo2, 'ends as the ClO₂ radical')
  assert.equal(at(tr.bondAngle, TRANSFER_START), BOND_ANGLE_DEG.chlorite, 'angle opens only after oxidation')

  // Длина Cl–O укорачивается: порядок связи в радикале выше.
  assert.ok(at(tr.clOBond, END) < at(tr.clOBond, 0), 'Cl–O shortens in the radical')
  assert.ok(Math.abs(at(tr.clOBond, END) - ang(BOND_LENGTH_A.ClO_radical)) < 1e-9, 'exact radical bond length')

  // Газы: зелёный Cl₂ расходуется, янтарный ClO₂ рождается.
  assert.ok(at(tr.gasCl2Opacity, 1) > 0.4, 'green chlorine cloud arrives with the reagent')
  assert.equal(at(tr.gasCl2Opacity, END), 0, 'chlorine is fully consumed')
  assert.equal(at(tr.gasClo2Opacity, BREAK), 0, 'no ClO₂ gas before the radical forms')
  assert.ok(at(tr.gasClo2Opacity, END) > 0.4, 'amber ClO₂ fills the frame at the end')
  assert.ok(at(tr.gasClo2Rise, END) > at(tr.gasClo2Rise, 0), 'the gas rises')
  assert.ok(at(tr.fogOpacity, END) > at(tr.fogOpacity, 0), 'fog thickens where the salt settles')

  // Экзотермика и камера привязаны к моменту разрыва, а не к случайному времени.
  assert.ok(at(tr.exoLight, BREAK + 0.12) > 0.95, 'the energy flash peaks at the rupture')
  assert.ok(at(tr.camShake, BREAK + 0.04) > 0.95, 'the camera kicks on the rupture')
  assert.equal(at(tr.camShake, 0), 0, 'no shake while nothing happens')
  assert.equal(at(tr.camShake, END), 0, 'the finale is a steady hero shot')
  assert.ok(at(tr.postBloom, BREAK) > at(tr.postBloom, 0), 'bloom peaks with the energy release')

  // Броуновское дрожание гаснет к контакту: в момент реакции кадр собран.
  assert.ok(at(tr.jitter, 0) > 0.9 && at(tr.jitter, BREAK) < 0.01, 'jitter fades into the reaction')

  // HUD: коэффициенты реагентов и продуктов не висят одновременно.
  assert.ok(at(tr.reactantCounters, 1) > 0.9, 'reagent coefficients are shown at the start')
  assert.equal(at(tr.reactantCounters, CLO2_PHASE.transferEnd), 0, 'reagent badges leave before the products')
  assert.ok(at(tr.productCounters, CLO2_PHASE.releaseEnd) > 0.9, 'product coefficients are shown on release')
  assert.ok(at(tr.oxidationTags, BREAK + 0.3) > 0.9, 'oxidation states are explained during the transfer')
  assert.equal(at(tr.oxidationTags, END), 0, 'labels do not clutter the hero shot')
}

// ——— Непрерывность: ни один атом не телепортируется ———
{
  const vecTracks = {
    unitAOrigin: tr.unitAOrigin,
    unitBOrigin: tr.unitBOrigin,
    naA: tr.naA,
    naB: tr.naB,
    clA: tr.clA,
    clB: tr.clB,
    camOffset: tr.camOffset,
  }

  // 0.06 мировых единиц за кадр при 120 Гц — это ~7 ед/с: быстро, но глаз
  // читает это как движение, а не как подмену объекта.
  const MAX_STEP = 0.06
  const cur = new THREE.Vector3()
  const prev = new THREE.Vector3()

  for (const [name, track] of Object.entries(vecTracks)) {
    sampleVec3(track, 0, prev)
    let maxStep = 0
    let worstAt = 0
    for (let t = DT; t <= END; t += DT) {
      sampleVec3(track, t, cur)
      const step = cur.distanceTo(prev)
      if (step > maxStep) {
        maxStep = step
        worstAt = t
      }
      prev.copy(cur)
    }
    assert.ok(maxStep < MAX_STEP, `${name}: teleport of ${maxStep.toFixed(3)} at t=${worstAt.toFixed(2)}s`)
  }

  // Скалярные дорожки тоже не должны щёлкать. Пороги — на кадр при 120 Гц,
  // то есть 0.06 = плавно, 0.2 = резко, но всё ещё несколько кадров перехода.
  // Разрыв связи и рождение соли задуманы резкими, остальное — мягким.
  const scalarLimits: Record<string, number> = {
    bondAngle: 0.9,
    clOBond: 0.01,
    cl2Opacity: 0.2,
    cl2Stress: 0.05,
    naClOpacity: 0.2,
    gasCl2Opacity: 0.05,
    gasClo2Opacity: 0.05,
    camZoom: 0.02,
    postBloom: 0.05,
  }
  for (const [name, limit] of Object.entries(scalarLimits)) {
    const track = tr[name as keyof typeof tr] as Parameters<typeof sampleScalar>[0]
    let prevV = sampleScalar(track, 0)
    let maxStep = 0
    let worstAt = 0
    for (let t = DT; t <= END; t += DT) {
      const v = sampleScalar(track, t)
      const step = Math.abs(v - prevV)
      if (step > maxStep) {
        maxStep = step
        worstAt = t
      }
      prevV = v
    }
    assert.ok(maxStep < limit, `${name}: jump of ${maxStep.toFixed(4)} at t=${worstAt.toFixed(2)}s`)
  }
}

// ——— Молекулы на всём протяжении сцены остаются физичными ———
{
  const unitA = createBentFrame()
  const unitB = createBentFrame()
  const originA = new THREE.Vector3()
  const originB = new THREE.Vector3()
  const clA = new THREE.Vector3()
  const clB = new THREE.Vector3()
  const naA = new THREE.Vector3()

  let sawStretchedCl2 = false
  let minOO = Infinity

  for (let t = 0; t <= END; t += DT) {
    const angle = sampleScalar(tr.bondAngle, t)
    const bond = sampleScalar(tr.clOBond, t)
    sampleVec3(tr.unitAOrigin, t, originA)
    sampleVec3(tr.unitBOrigin, t, originB)
    writeBent(unitA, originA, angle, bond, sampleScalar(tr.unitAYaw, t), sampleScalar(tr.unitAPitch, t))
    writeBent(unitB, originB, angle, bond, sampleScalar(tr.unitBYaw, t), sampleScalar(tr.unitBPitch, t))

    assert.ok(
      Math.abs(measureAngle(unitA.l0, unitA.center, unitA.l1) - angle) < 1e-3,
      `unit A lost its VSEPR angle at t=${t.toFixed(2)}`,
    )
    assert.ok(angle >= BOND_ANGLE_DEG.chlorite - 1e-6, `angle collapsed below chlorite at t=${t.toFixed(2)}`)
    // outBack даёт лёгкий перелёт — он допустим, но не должен разваливать молекулу.
    assert.ok(angle < BOND_ANGLE_DEG.clo2 + 4, `angle overshoot too wild at t=${t.toFixed(2)}`)

    const oo = unitA.l0.distanceTo(unitA.l1)
    if (oo < minOO) minOO = oo
    assert.ok(oo > CLO2_GEOM.radius.o * 2 * 0.95, `oxygens interpenetrate at t=${t.toFixed(2)}`)

    // Хлориты не проходят друг через друга и не слипаются.
    assert.ok(originA.distanceTo(originB) > CLO2_GEOM.radius.cl * 2, `units collide at t=${t.toFixed(2)}`)

    sampleVec3(tr.clA, t, clA)
    sampleVec3(tr.clB, t, clB)
    const clcl = clA.distanceTo(clB)
    if (t < BREAK) {
      // До разрыва это одна молекула: связь тянется, но не разъезжается.
      assert.ok(clcl < CLO2_GEOM.clCl * 1.7, `Cl₂ stretched beyond a bond at t=${t.toFixed(2)}`)
      if (clcl > CLO2_GEOM.clCl * 1.3) sawStretchedCl2 = true
    }

    sampleVec3(tr.naA, t, naA)
    const naCl = naA.distanceTo(clA)
    if (sampleScalar(tr.naClOpacity, t) > 0.9) {
      // Если связь нарисована — ионы действительно рядом, на длине связи Na–Cl.
      assert.ok(naCl < CLO2_GEOM.naCl * 1.6, `NaCl bond drawn across ${naCl.toFixed(2)} at t=${t.toFixed(2)}`)
    }
  }

  assert.ok(sawStretchedCl2, 'the Cl–Cl bond must visibly stretch before it breaks')
  assert.ok(minOO > 0, 'oxygens never merge')
}

// ——— Финал: герой-план ClO₂ ———
{
  const originA = new THREE.Vector3()
  sampleVec3(tr.unitAOrigin, END, originA)
  assert.ok(Math.abs(originA.x) < 0.2, 'the hero molecule ends up centred in frame')

  const originB = new THREE.Vector3()
  sampleVec3(tr.unitBOrigin, END, originB)
  assert.ok(originB.length() > 3, 'the second molecule leaves the hero shot')

  const naA = new THREE.Vector3()
  sampleVec3(tr.naA, END, naA)
  assert.ok(naA.y < -2, 'the salt settles below the frame as a precipitate')
  assert.ok(sampleVec3(tr.unitAOrigin, END, originA).y > naA.y, 'gas rises above the precipitate')
}

console.log('test-clo2-cinema: all passed')
