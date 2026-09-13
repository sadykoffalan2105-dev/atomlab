#!/usr/bin/env node
/**
 * ATOMLAB Cinema — контракт ядра движка: Эрмит-дорожки, пружины, честные колебания,
 * π-орбитали ClO₂ и порядки связей. Всё — чистые функции, проверяются в Node.
 *
 * Запуск: npx tsx scripts/test-cinema-engine.mts
 */
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { ang, BOND_ANGLE_DEG, BOND_LENGTH_A } from '../src/lab/cinema/core/atoms.ts'
import { mix, ease } from '../src/lab/cinema/core/easing.ts'
import { sampleScalar, sampleVec3, type ScalarKey, type Vec3Key } from '../src/lab/cinema/core/tracks.ts'
import { damp, lambdaFromLerp, springEase, springStep, springStepVec3 } from '../src/lab/cinema/core/spring.ts'
import { createLobePool, LobeKind } from '../src/lab/cinema/core/pools.ts'
import {
  applyBentTriatomicModes,
  applyDiatomicStretch,
  bondPolarity,
  CL2_FUNDAMENTAL_CM1,
  CL2_VIB_AMP,
  CLO2_PI_ELEMENTS,
  CLO2_PI_OCCUPANCY,
  CLO2_PI_ORBITALS,
  CLO2_SOMO_SPIN_DENSITY,
  CLO2_VIB_AMP,
  CLO2_VIB_CM1,
  clo2PiOrbital,
  electronsToOccupancy,
  evalPiOrbital,
  jacobiEigenSymmetric,
  LESSON_BOND_ORDERS,
  LESSON_SOMO_REMOVAL_DELTA,
  lobeLayoutForOrbital,
  piBondOrderChange,
  ringDown,
  screenHz,
  slaterExtentScene,
  slaterMeanRadius,
  slaterNorm,
  slaterRadial,
  slaterZetaScene,
  VIB_SLOWDOWN,
  vibrationPeriodFs,
  zeroPointRmsA,
  type BentModeTriple,
} from '../src/lab/cinema/core/chem/index.ts'

const close = (a: number, b: number, eps: number, msg: string) =>
  assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b} (eps ${eps})`)

// ——— 1. Дорожки: eased по умолчанию не изменились ———
{
  const track: ScalarKey[] = [
    { t: 0, v: 0 },
    { t: 1, v: 10, ease: 'outCubic' },
    { t: 3, v: -4 },
  ]
  for (let t = -0.5; t <= 3.5; t += 0.0625) {
    let expected: number
    if (t <= 0) expected = 0
    else if (t >= 3) expected = -4
    else if (t < 1) expected = mix(0, 10, ease('outCubic', t))
    else expected = mix(10, -4, ease(undefined, (t - 1) / 2))
    close(sampleScalar(track, t), expected, 1e-12, `eased scalar @${t}`)
  }
  const vt: Vec3Key[] = [
    { t: 0, v: [0, 0, 0] },
    { t: 2, v: [2, 0, 0], arc: 0.5 },
  ]
  const out = new THREE.Vector3()
  sampleVec3(vt, 1, out)
  close(out.x, 1, 1e-12, 'eased vec3 lerp')
  close(Math.hypot(out.y, out.z), 0.5, 1e-12, 'eased vec3 arc peak')
}

// ——— 2. Дорожки: Эрмит — точные ключи, непрерывная скорость, без перелёта ———
{
  const keys: ScalarKey[] = [
    { t: 0, v: 0 },
    { t: 1, v: 4, interp: 'hermite' },
    { t: 1.5, v: 5, interp: 'hermite' },
    { t: 3, v: 9, interp: 'hermite' },
    { t: 4, v: 2, interp: 'hermite' },
    { t: 5.5, v: 2.5, interp: 'hermite' },
  ]
  for (const k of keys) assert.equal(sampleScalar(keys, k.t), k.v, `hermite key value exact @${k.t}`)

  const h = 1e-6
  let maxJump = 0
  for (let j = 1; j < keys.length - 1; j++) {
    const tk = keys[j]!.t
    const vl = (sampleScalar(keys, tk) - sampleScalar(keys, tk - h)) / h
    const vr = (sampleScalar(keys, tk + h) - sampleScalar(keys, tk)) / h
    maxJump = Math.max(maxJump, Math.abs(vl - vr))
    assert.ok(Math.abs(vl - vr) < 1e-3 * (1 + Math.abs(vl)), `hermite C1 at key ${j}: ${vl} vs ${vr}`)
  }
  // интерьерный ключ 1.5 → 3 монотонный рост: скорость в ключе не нулевая (в отличие от smoothstep)
  const vMid = (sampleScalar(keys, 1.5 + h) - sampleScalar(keys, 1.5 - h)) / (2 * h)
  assert.ok(vMid > 0.5, `hermite keeps moving through interior key: v=${vMid}`)
  // без перелёта: каждый сегмент в пределах значений своих ключей
  for (let i = 1; i < keys.length; i++) {
    const k0 = keys[i - 1]!
    const k1 = keys[i]!
    const lo = Math.min(k0.v, k1.v) - 1e-12
    const hi = Math.max(k0.v, k1.v) + 1e-12
    for (let s = 0; s <= 1; s += 0.01) {
      const v = sampleScalar(keys, mix(k0.t, k1.t, s))
      assert.ok(v >= lo && v <= hi, `hermite scalar overshoot in segment ${i}: ${v} ∉ [${lo}, ${hi}]`)
    }
  }
  // стык eased ↔ hermite: касательная 0, скорость непрерывна (smoothstep тоже 0)
  const mixed: ScalarKey[] = [
    { t: 0, v: 0 },
    { t: 1, v: 1 },
    { t: 2, v: 3, interp: 'hermite' },
    { t: 3, v: 6, interp: 'hermite' },
  ]
  const vl = (sampleScalar(mixed, 1) - sampleScalar(mixed, 1 - h)) / h
  const vr = (sampleScalar(mixed, 1 + h) - sampleScalar(mixed, 1)) / h
  assert.ok(Math.abs(vl) < 1e-4 && Math.abs(vr) < 1e-4, `eased↔hermite joint velocity 0: ${vl}, ${vr}`)

  // вектор
  const vk: Vec3Key[] = [
    { t: 0, v: [0, 0, 0] },
    { t: 1, v: [1, 2, 0], interp: 'hermite' },
    { t: 2.5, v: [3, 1, -1], interp: 'hermite', arc: 0.3 },
    { t: 3, v: [4, 4, 4], interp: 'hermite' },
    { t: 4, v: [2, 5, 1], interp: 'hermite' },
  ]
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  for (const k of vk) {
    sampleVec3(vk, k.t, a)
    assert.deepEqual([a.x, a.y, a.z], [...k.v], `hermite vec3 key exact @${k.t}`)
  }
  for (let j = 1; j < vk.length - 1; j++) {
    const tk = vk[j]!.t
    sampleVec3(vk, tk - h, a)
    sampleVec3(vk, tk, b)
    sampleVec3(vk, tk + h, c)
    const l = b.clone().sub(a).divideScalar(h)
    const r = c.clone().sub(b).divideScalar(h)
    assert.ok(l.distanceTo(r) < 1e-3 * (1 + l.length()), `hermite vec3 C1 at key ${j}: ${l.toArray()} vs ${r.toArray()}`)
  }
  console.log(`  hermite: max velocity jump at interior keys ${maxJump.toExponential(2)}`)
}

// ——— 3. Пружины: точность при любом dt, независимость damp от частоты кадров ———
{
  for (const zeta of [0, 0.25, 0.7, 1, 1 + 5e-5, 1.8, 9]) {
    const one = { x: 3, v: -2 }
    const ten = { x: 3, v: -2 }
    springStep(one, 1, 6, zeta, 1)
    for (let i = 0; i < 10; i++) springStep(ten, 1, 6, zeta, 0.1)
    close(one.x, ten.x, 1e-9, `spring x exact ζ=${zeta}`)
    close(one.v, ten.v, 1e-9, `spring v exact ζ=${zeta}`)
    // сходимость к цели
    const s = { x: 3, v: -2 }
    if (zeta > 0) {
      springStep(s, 1, 6, zeta, 60)
      close(s.x, 1, 1e-6, `spring settles ζ=${zeta}`)
    }
  }
  // ζ=0: сохранение энергии
  {
    const s = { x: 1, v: 0 }
    springStep(s, 0, 2, 0, 0.37)
    close(s.x * s.x + (s.v * s.v) / 4, 1, 1e-12, 'undamped spring energy')
  }
  // критическая: без перелёта
  {
    const s = { x: 0, v: 0 }
    for (let i = 0; i < 600; i++) {
      springStep(s, 1, 10, 1, 1 / 60)
      assert.ok(s.x <= 1 + 1e-12, 'critical spring no overshoot')
    }
  }
  // вектор: совпадает со скаляром
  {
    const pos = new Float32Array([0, 0, 0, 3, -1, 2])
    const vel = new Float32Array([0, 0, 0, 1, 0.5, -2])
    springStepVec3(pos, vel, 1, 1, 1, 1, 7, 0.4, 0.3)
    const sx = { x: 3, v: 1 }
    springStep(sx, 1, 7, 0.4, 0.3)
    close(pos[3]!, sx.x, 1e-5, 'springStepVec3 x')
    close(vel[3]!, sx.v, 1e-5, 'springStepVec3 vx')
    assert.equal(pos[0], 0, 'springStepVec3 leaves other slots')
  }
  // damp
  {
    let a = 10
    for (let i = 0; i < 60; i++) a = damp(a, 2, 5, 1 / 60)
    let b = 10
    for (let i = 0; i < 24; i++) b = damp(b, 2, 5, 1 / 24)
    const c = damp(10, 2, 5, 1)
    close(a, c, 1e-9, 'damp 60 fps == 1 step')
    close(b, c, 1e-9, 'damp 24 fps == 1 step')
    close(lambdaFromLerp(0.14, 60), 9.0496, 1e-3, 'lambdaFromLerp')
    close(damp(0, 1, lambdaFromLerp(0.14, 60), 1 / 60), 0.14, 1e-12, 'lambdaFromLerp reproduces lerp at 60 fps')
  }
  // springEase — EaseFn-совместим
  for (const [w, z] of [
    [12, 0.35],
    [9, 1],
    [3, 0.1],
    [14, 4],
  ] as const) {
    const f = springEase(w, z)
    assert.equal(f(0), 0, `springEase(${w},${z}) f(0)`)
    assert.equal(f(1), 1, `springEase(${w},${z}) f(1)`)
    assert.equal(f(-1), 0)
    assert.equal(f(2), 1)
    for (let t = 0; t <= 1; t += 0.05) assert.ok(Number.isFinite(f(t)))
  }
  const snap = springEase(14, 0.35)
  let peak = 0
  for (let t = 0; t <= 1; t += 0.005) peak = Math.max(peak, snap(t))
  assert.ok(peak > 1.05, `under-damped springEase overshoots: ${peak}`)
}

// ——— 4. Колебания: частоты, картины мод, центр масс ———
{
  // экранные частоты и их отношения
  close(screenHz(CLO2_VIB_CM1.bend), 1, 1e-12, 'ν2 ↔ 1 Hz')
  for (const [cm1, hz] of [
    [CLO2_VIB_CM1.sym, 2.11],
    [CLO2_VIB_CM1.asym, 2.48],
    [CL2_FUNDAMENTAL_CM1, 1.24],
  ] as const) {
    assert.ok(Math.abs(screenHz(cm1) / hz - 1) < 0.01, `screen Hz ${cm1} cm⁻¹ → ${screenHz(cm1)} ≈ ${hz}`)
  }
  close(CL2_FUNDAMENTAL_CM1, 554.37, 0.01, 'Cl2 fundamental')
  assert.ok(VIB_SLOWDOWN > 1.3e13 && VIB_SLOWDOWN < 1.4e13, `slowdown ${VIB_SLOWDOWN}`)
  close(vibrationPeriodFs(CLO2_VIB_CM1.asym), 30.05, 0.1, 'ν3 period fs')
  close(zeroPointRmsA(CLO2_VIB_CM1.sym, (35.45 * 16) / 51.45), 0.04, 0.002, 'zero-point RMS ≈ 0.04 Å')

  const r0 = ang(BOND_LENGTH_A.ClO_radical)
  const theta0 = (BOND_ANGLE_DEG.clo2 * Math.PI) / 180
  // Молекула в произвольной ориентации: плоскость повёрнута.
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, -1.1, 0.7))
  const origin = new THREE.Vector3(0.3, -0.2, 1.1)
  const eq = () => {
    const c = origin.clone()
    const l1 = new THREE.Vector3(Math.sin(theta0 / 2), Math.cos(theta0 / 2), 0).multiplyScalar(r0).applyQuaternion(q).add(origin)
    const l2 = new THREE.Vector3(-Math.sin(theta0 / 2), Math.cos(theta0 / 2), 0).multiplyScalar(r0).applyQuaternion(q).add(origin)
    return { c, l1, l2 }
  }
  const mCl = 35.45
  const mO = 16
  const com = (m: { c: THREE.Vector3; l1: THREE.Vector3; l2: THREE.Vector3 }) =>
    m.c.clone().multiplyScalar(mCl).add(m.l1.clone().multiplyScalar(mO)).add(m.l2.clone().multiplyScalar(mO)).divideScalar(mCl + 2 * mO)
  const geom = (m: { c: THREE.Vector3; l1: THREE.Vector3; l2: THREE.Vector3 }) => {
    const d1 = m.l1.clone().sub(m.c)
    const d2 = m.l2.clone().sub(m.c)
    return { r1: d1.length(), r2: d2.length(), angle: d1.angleTo(d2) }
  }
  const com0 = com(eq())
  const run = (amp: BentModeTriple, check: (g: ReturnType<typeof geom>, t: number) => void) => {
    const ampMax = Math.max(amp.sym, amp.bend, amp.asym)
    for (let t = 0; t < 3; t += 0.0137) {
      const m = eq()
      applyBentTriatomicModes(m.c, m.l1, m.l2, t, amp, CLO2_VIB_CM1)
      assert.ok(com(m).distanceTo(com0) < 0.05 * ampMax, `CoM drift at t=${t}`)
      check(geom(m), t)
    }
  }
  const A = CLO2_VIB_AMP
  // симметричное валентное: угол постоянен, длины равны
  let symMaxStretch = 0
  run({ sym: A.sym, bend: 0, asym: 0 }, (g) => {
    close(g.angle, theta0, 1e-9, 'sym stretch keeps angle')
    close(g.r1, g.r2, 1e-9, 'sym stretch equal lengths')
    symMaxStretch = Math.max(symMaxStretch, g.r1 - r0)
  })
  close(symMaxStretch, A.sym, 0.01 * A.sym, 'sym stretch amplitude')
  // деформационное: длины в пределах 3 %, угол меняется
  let bendMaxAngle = 0
  run({ sym: 0, bend: A.bend, asym: 0 }, (g) => {
    assert.ok(Math.abs(g.r1 / r0 - 1) < 0.03 && Math.abs(g.r2 / r0 - 1) < 0.03, `bend keeps lengths: ${g.r1}, ${g.r2}`)
    bendMaxAngle = Math.max(bendMaxAngle, Math.abs(g.angle - theta0))
  })
  assert.ok(bendMaxAngle > 0.1, `bend changes angle: ${bendMaxAngle} rad`)
  // антисимметричное: длины меняются в противоположные стороны
  let asymSeen = 0
  run({ sym: 0, bend: 0, asym: A.asym }, (g) => {
    const d1 = g.r1 - r0
    const d2 = g.r2 - r0
    if (Math.abs(d1) > 1e-6) {
      assert.ok(d1 * d2 < 0, `asym opposite changes: ${d1}, ${d2}`)
      close(d1, -d2, 1e-9, 'asym symmetric magnitude')
      asymSeen++
    }
    close(g.angle, theta0, 1e-9, 'asym keeps angle (first order)')
  })
  assert.ok(asymSeen > 50)
  // все три моды вместе — центр масс
  run(A, () => {})

  // частота, измеренная по пересечениям нуля
  const measureHz = (cm1: number) => {
    const m0 = eq()
    let prev = 0
    const crossings: number[] = []
    for (let t = 0; t < 6; t += 1e-3) {
      const m = eq()
      applyBentTriatomicModes(m.c, m.l1, m.l2, t, { sym: A.sym, bend: 0, asym: 0 }, { sym: cm1, bend: 1, asym: 1 })
      const d = geom(m).r1 - geom(m0).r1
      if (t > 0 && prev < 0 && d >= 0) crossings.push(t)
      prev = d
    }
    return (crossings.length - 1) / (crossings[crossings.length - 1]! - crossings[0]!)
  }
  const nu1 = measureHz(CLO2_VIB_CM1.sym)
  const nu3 = measureHz(CLO2_VIB_CM1.asym)
  const nu2 = measureHz(CLO2_VIB_CM1.bend)
  assert.ok(Math.abs(nu1 / nu2 / (945.6 / 447.7) - 1) < 0.01, `ν1/ν2 ratio ${nu1 / nu2}`)
  assert.ok(Math.abs(nu3 / nu2 / (1110.1 / 447.7) - 1) < 0.01, `ν3/ν2 ratio ${nu3 / nu2}`)

  // двухатомная
  {
    const a = new THREE.Vector3(-0.28, 0.1, 0)
    const b = new THREE.Vector3(0.28, 0.1, 0.05)
    const c0 = a.clone().add(b).multiplyScalar(0.5)
    const r = a.distanceTo(b)
    let maxD = 0
    for (let t = 0; t < 2; t += 0.01) {
      const aa = a.clone()
      const bb = b.clone()
      applyDiatomicStretch(aa, bb, t, CL2_VIB_AMP, CL2_FUNDAMENTAL_CM1)
      assert.ok(aa.clone().add(bb).multiplyScalar(0.5).distanceTo(c0) < 1e-9, 'Cl2 CoM fixed')
      maxD = Math.max(maxD, aa.distanceTo(bb) - r)
    }
    close(maxD, CL2_VIB_AMP, 0.01 * CL2_VIB_AMP, 'Cl2 stretch amplitude')
    // разные массы: центр масс Na–Cl
    const na = new THREE.Vector3(0, 0, 0)
    const cl = new THREE.Vector3(0.6, 0, 0)
    const cm = (p: THREE.Vector3, s: THREE.Vector3) => (p.x * 22.99 + s.x * 35.45) / (22.99 + 35.45)
    const cmBefore = cm(na, cl)
    applyDiatomicStretch(na, cl, 0.2, 0.05, 364, 22.99, 35.45)
    close(cm(na, cl), cmBefore, 1e-12, 'hetero diatomic CoM fixed')
  }

  assert.equal(ringDown(-0.1, 1), 0)
  assert.equal(ringDown(0, 1), 1)
  close(ringDown(2, 2), Math.exp(-1), 1e-15, 'ringDown')
  assert.equal(ringDown(1, 0), 0)
  console.log(
    `  vibration: screen Hz ν1 ${screenHz(945.6).toFixed(3)}, ν2 1.000, ν3 ${screenHz(1110.1).toFixed(3)}, Cl2 ${screenHz(CL2_FUNDAMENTAL_CM1).toFixed(3)}; ` +
      `slowdown ${VIB_SLOWDOWN.toExponential(3)}; amp sym ${A.sym.toFixed(4)} bend ${A.bend.toFixed(4)} asym ${A.asym.toFixed(4)} Cl2 ${CL2_VIB_AMP.toFixed(4)}`,
  )
}

// ——— 5. π-орбитали ClO₂ ———
{
  // Якоби на известной матрице
  {
    const { values, vectors } = jacobiEigenSymmetric([
      [2, 1, 0],
      [1, 2, 1],
      [0, 1, 2],
    ])
    const sorted = [...values].sort((x, y) => x - y)
    close(sorted[0]!, 2 - Math.SQRT2, 1e-12, 'jacobi λ0')
    close(sorted[1]!, 2, 1e-12, 'jacobi λ1')
    close(sorted[2]!, 2 + Math.SQRT2, 1e-12, 'jacobi λ2')
    for (let k = 0; k < 3; k++) {
      const v = vectors[k]!
      const Av = [2 * v[0]! + v[1]!, v[0]! + 2 * v[1]! + v[2]!, v[1]! + 2 * v[2]!]
      for (let i = 0; i < 3; i++) close(Av[i]!, values[k]! * v[i]!, 1e-12, 'jacobi A·v = λ·v')
    }
  }

  assert.deepEqual(
    CLO2_PI_ORBITALS.map((o) => o.label),
    ['1b1', '1a2', '2b1'],
    'orbitals sorted by energy with C2v labels',
  )
  assert.ok(CLO2_PI_ORBITALS[0]!.x > CLO2_PI_ORBITALS[1]!.x && CLO2_PI_ORBITALS[1]!.x > CLO2_PI_ORBITALS[2]!.x, 'energy order')
  for (const o of CLO2_PI_ORBITALS) {
    const n = o.coefs.reduce((s, c) => s + c * c, 0)
    close(n, 1, 1e-12, `${o.label} normalised`)
  }
  // ортогональность
  for (let i = 0; i < 3; i++)
    for (let j = i + 1; j < 3; j++) {
      const d = CLO2_PI_ORBITALS[i]!.coefs.reduce((s, c, k) => s + c * CLO2_PI_ORBITALS[j]!.coefs[k]!, 0)
      close(d, 0, 1e-12, 'orbitals orthogonal')
    }
  const b1 = clo2PiOrbital('1b1')
  const a2 = clo2PiOrbital('1a2')
  const somo = clo2PiOrbital('2b1')
  assert.equal(a2.coefs[1], 0, '1a2 has zero Cl coefficient (node at Cl)')
  close(a2.coefs[0], -a2.coefs[2], 1e-12, '1a2 antisymmetric on O')
  assert.equal(a2.character, 'nonbonding')
  assert.ok(b1.coefs.every((c) => c > 0), '1b1 all in phase')
  assert.equal(b1.character, 'bonding')
  assert.ok(somo.coefs[1] > 0 && somo.coefs[0] < 0 && somo.coefs[2] < 0, '2b1 opposite signs Cl vs O')
  assert.equal(somo.character, 'antibonding')
  close(
    CLO2_SOMO_SPIN_DENSITY.reduce((s, x) => s + x, 0),
    1,
    1e-12,
    'spin density sums to 1',
  )

  // Порядки связей
  const bo = piBondOrderChange()
  close(bo.chlorite.clO1, bo.chlorite.clO2, 1e-12, 'chlorite symmetric')
  close(bo.radical.clO1, bo.radical.clO2, 1e-12, 'radical symmetric')
  assert.ok(bo.radical.clO1 > bo.chlorite.clO1, 'removing the 2b1 electron increases Cl–O π order')
  assert.ok(bo.deltaPerBond > 0.1)
  assert.deepEqual([...CLO2_PI_OCCUPANCY.radical], [2, 2, 1])
  assert.ok(LESSON_BOND_ORDERS.radical.ClO > LESSON_BOND_ORDERS.chlorite.ClO)
  close(LESSON_SOMO_REMOVAL_DELTA, 0.25, 1e-12, 'school delta')

  // Слейтер
  close(slaterZetaScene('O'), 15.08, 0.02, 'ζ O scene')
  close(slaterZetaScene('Cl'), 13.48, 0.02, 'ζ Cl scene')
  for (const [n, z] of [
    [2, 2.275],
    [3, 2.033],
  ] as const) {
    // ∫ R² r² dr = 1
    let s = 0
    const dr = 1e-3
    for (let r = dr / 2; r < 30; r += dr) s += slaterRadial(n, z, r) ** 2 * r * r * dr
    close(s, 1, 1e-4, `STO n=${n} normalised`)
    close(slaterMeanRadius(n, z), (2 * n + 1) / (2 * z), 1e-12, 'mean radius')
    assert.ok(slaterNorm(n, z) > 0)
  }
  assert.ok(slaterExtentScene('Cl') > slaterExtentScene('O'), 'Cl 3p larger than O 2p')

  // Узловая плоскость SOMO: в плоскости молекулы ψ = 0, над/под — противоположные знаки
  const r0 = ang(BOND_LENGTH_A.ClO_radical)
  const half = (BOND_ANGLE_DEG.clo2 * Math.PI) / 360
  const atoms = [
    { x: r0 * Math.sin(half), y: r0 * Math.cos(half), z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: -r0 * Math.sin(half), y: r0 * Math.cos(half), z: 0 },
  ]
  const normal = { x: 0, y: 0, z: 1 }
  for (let i = 0; i < 200; i++) {
    const p = { x: Math.sin(i * 1.3) * 0.6, y: Math.cos(i * 0.7) * 0.6, z: 0 }
    assert.equal(evalPiOrbital(p, atoms, normal, somo.coefs), 0, 'SOMO nodal plane: ψ = 0 in molecular plane')
  }
  // центр треугольника O–Cl–O (там раньше висел «шарик» радикала) — тоже 0
  const centroid = { x: 0, y: (2 * r0 * Math.cos(half)) / 3, z: 0 }
  assert.equal(evalPiOrbital(centroid, atoms, normal, somo.coefs), 0)
  const above = evalPiOrbital({ x: 0, y: 0, z: 0.1 }, atoms, normal, somo.coefs)
  const below = evalPiOrbital({ x: 0, y: 0, z: -0.1 }, atoms, normal, somo.coefs)
  assert.ok(above > 0 && below < 0 && Math.abs(above + below) < 1e-12, 'p lobe antisymmetric through the plane')
  // над O знак противоположен знаку над Cl
  const aboveO = evalPiOrbital({ x: atoms[0]!.x, y: atoms[0]!.y, z: 0.1 }, atoms, normal, somo.coefs)
  assert.ok(aboveO < 0, 'SOMO phase over O opposite to Cl')
  // 1a2 над Cl: узел
  close(evalPiOrbital({ x: 0, y: -0.001, z: 0.1 }, atoms, normal, a2.coefs), 0, 1e-3, '1a2 ~0 over Cl')

  // Лепестки
  const pool = createLobePool(8)
  pool.count = 1
  const end = lobeLayoutForOrbital(pool, 1, atoms, { x: 0, y: 0, z: 2 }, somo.coefs, electronsToOccupancy(1))
  assert.equal(end, 4)
  assert.equal(pool.count, 4)
  assert.equal(pool.version, 1)
  for (let i = 0; i < 3; i++) {
    const slot = 1 + i
    assert.equal(pool.kind[slot], LobeKind.p)
    close(pool.coef[slot]!, somo.coefs[i]!, 1e-7, 'lobe coef')
    close(pool.occupancy[slot]!, 0.5, 1e-7, 'lobe occupancy')
    close(pool.axis[slot * 3 + 2]!, 1, 1e-7, 'lobe axis normalised')
    close(pool.center[slot * 3]!, atoms[i]!.x, 1e-7, 'lobe centre')
    close(pool.size[slot]!, 1.8 * slaterExtentScene(CLO2_PI_ELEMENTS[i]!), 1e-6, 'lobe size ∝ Slater extent')
  }
  close(pool.size[1]!, 0.3, 0.01, 'O lobe ≈ LobePool default size')
  const small = createLobePool(2)
  assert.equal(lobeLayoutForOrbital(small, 0, atoms, normal, somo.coefs, 1), 2, 'layout clamps to capacity')

  // Полярность
  assert.ok(bondPolarity('Cl', 'O') > 0 && bondPolarity('O', 'Cl') < 0, 'polarity sign toward O')
  close(bondPolarity('Cl', 'O'), -bondPolarity('O', 'Cl'), 1e-15, 'polarity antisymmetric')
  assert.ok(bondPolarity('Na', 'Cl') > 0.95 && bondPolarity('Cl', 'Cl') === 0)
  assert.ok(Math.abs(bondPolarity(3.44, 0.93)) <= 1)

  console.log(
    `  orbitals: x(1b1, 1a2, 2b1) = ${CLO2_PI_ORBITALS.map((o) => o.x.toFixed(4)).join(', ')}; ` +
      `2b1 coefs [${somo.coefs.map((c) => c.toFixed(4)).join(', ')}]; ` +
      `spin density Cl ${CLO2_SOMO_SPIN_DENSITY[1].toFixed(3)}; ` +
      `π order Cl–O chlorite ${bo.chlorite.clO1.toFixed(4)} → ClO2 ${bo.radical.clO1.toFixed(4)} (Δ ${bo.deltaPerBond.toFixed(4)})`,
  )
}

console.log('test-cinema-engine: all passed')
