#!/usr/bin/env node
/**
 * ATOMLAB Cinema — чистая логика InstancedAtoms и окружения «софтбокс».
 *
 * Шейдеры без WebGL не скомпилировать, поэтому здесь проверяется всё, что
 * можно проверить данными:
 *   • упаковка AtomPool → interleaved-буфер (раскладка aSphere/aColor/aEnergy);
 *   • поиск соседей для контактного затенения (≤ 4, ближайшие, нули в пустых);
 *   • SH софтбокса: ключ ярче пола, контровой — циановый, проекция сходится,
 *     CPU-оценка совпадает с three.SphericalHarmonics3.getIrradianceAt;
 *   • структура GLSL: нужные чанки/defines/атрибуты на месте.
 *
 * Запуск: npx tsx scripts/test-instanced-atoms.mts
 */
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  ATOM_INSTANCE_STRIDE,
  ATOM_NEIGHBOR_STRIDE,
  atomLightUniforms,
  computeAtomContacts,
  createAtomMaterial,
  createIcosphereInstancedGeometry,
  createImpostorQuadGeometry,
  packAtomInstances,
} from '../src/lab/cinema/core/atomImpostorShader.ts'
import {
  buildSoftboxLighting,
  evalSHIrradiance,
  getLabSoftboxLighting,
  LAB_SOFTBOX,
  projectSoftboxSH,
  sampleSoftboxRadiance,
  type SoftboxSpec,
} from '../src/lab/cinema/core/envLighting.ts'
import { createAtomPool, writeVec3 } from '../src/lab/cinema/core/pools.ts'

let passed = 0
function test(name: string, fn: () => void): void {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}

const near = (a: number, b: number, eps = 1e-5) => Math.abs(a - b) <= eps

test('packAtomInstances: раскладка и только первые count', () => {
  const pool = createAtomPool(4)
  for (let i = 0; i < 4; i++) {
    writeVec3(pool.position, i, i + 0.1, i + 0.2, i + 0.3)
    pool.radius[i] = 0.5 + i
    writeVec3(pool.color, i, 0.1 * i, 0.2, 0.3)
    pool.opacity[i] = 0.9
    pool.emissive[i] = 1.5
    pool.charge[i] = -0.25
  }
  pool.count = 3
  const out = new Float32Array(4 * ATOM_INSTANCE_STRIDE).fill(-7)
  const n = packAtomInstances(pool, out)
  assert.equal(n, 3)
  const o = 2 * ATOM_INSTANCE_STRIDE
  assert.ok(near(out[o]!, 2.1) && near(out[o + 1]!, 2.2) && near(out[o + 2]!, 2.3))
  assert.ok(near(out[o + 3]!, 2.5))
  assert.ok(near(out[o + 4]!, 0.2) && near(out[o + 5]!, 0.2) && near(out[o + 6]!, 0.3))
  assert.ok(near(out[o + 7]!, 0.9))
  assert.ok(near(out[o + 8]!, 1.5) && near(out[o + 9]!, -0.25))
  // 4-й слот не тронут
  assert.equal(out[3 * ATOM_INSTANCE_STRIDE], -7)
  // count больше буфера — не выходим за границы
  pool.count = 99
  assert.equal(packAtomInstances(pool, new Float32Array(2 * ATOM_INSTANCE_STRIDE)), 2)
})

test('computeAtomContacts: ближайшие касающиеся, ≤ 4, пустые — нули', () => {
  const pool = createAtomPool(8)
  // центральный атом и 6 соседей на расстоянии 0.5..1.0, один далеко
  writeVec3(pool.position, 0, 0, 0, 0)
  const dists = [0.9, 0.5, 0.7, 0.6, 1.0, 0.8]
  const dirs = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ]
  for (let k = 0; k < 6; k++) {
    const [x, y, z] = dirs[k]!
    writeVec3(pool.position, k + 1, x! * dists[k]!, y! * dists[k]!, z! * dists[k]!)
  }
  writeVec3(pool.position, 7, 10, 0, 0)
  pool.radius.fill(0.4)
  pool.count = 8
  const out = new Float32Array(8 * ATOM_NEIGHBOR_STRIDE).fill(3)
  assert.equal(computeAtomContacts(pool, out, 1.2), 8)
  // центр: 4 ближайших — 0.5, 0.6, 0.7, 0.8 (порог (0.4+0.4)·1.2 = 0.96)
  const got = [0, 1, 2, 3].map((s) => Math.hypot(out[s * 4]!, out[s * 4 + 1]!, out[s * 4 + 2]!))
  got.forEach((g, s) => assert.ok(near(g, [0.5, 0.6, 0.7, 0.8][s]!), `slot ${s}: ${g}`))
  assert.ok(near(out[3]!, 0.4))
  // вектор к соседу, не от него
  assert.ok(near(out[0]!, -0.5))
  // одинокий атом — все слоты нулевые
  const lone = 7 * ATOM_NEIGHBOR_STRIDE
  for (let k = 0; k < ATOM_NEIGHBOR_STRIDE; k++) assert.equal(out[lone + k], 0)
  // невидимый сосед не затеняет
  pool.opacity[2] = 0
  computeAtomContacts(pool, out, 1.2)
  assert.ok(near(Math.hypot(out[0]!, out[1]!, out[2]!), 0.6))
})

test('sampleSoftboxRadiance: попадание в ключ, мимо — фон, ближняя панель перекрывает', () => {
  const rgb = [0, 0, 0]
  const [kx, ky, kz] = LAB_SOFTBOX.panels[0]!.center
  sampleSoftboxRadiance(LAB_SOFTBOX, kx, ky, kz, rgb)
  const key = LAB_SOFTBOX.panels[0]!
  assert.ok(near(rgb[0]!, key.color[0] * key.intensity))
  sampleSoftboxRadiance(LAB_SOFTBOX, 0, -1, 0, rgb)
  assert.ok(near(rgb[1]!, LAB_SOFTBOX.panels[2]!.color[1] * LAB_SOFTBOX.panels[2]!.intensity))
  sampleSoftboxRadiance(LAB_SOFTBOX, 1, 0, 1, rgb)
  assert.deepEqual(rgb.map((v) => +v.toFixed(5)), LAB_SOFTBOX.background.map((v) => +v.toFixed(5)))

  const occluding: SoftboxSpec = {
    background: [0, 0, 0],
    panels: [
      { name: 'far', center: [0, 0, 5], size: [4, 4], color: [1, 0, 0], intensity: 1 },
      { name: 'near', center: [0, 0, 2], size: [1, 1], color: [0, 1, 0], intensity: 1 },
    ],
  }
  sampleSoftboxRadiance(occluding, 0, 0, 1, rgb)
  assert.deepEqual(rgb, [0, 1, 0])
  sampleSoftboxRadiance(occluding, 0.3, 0, 1, rgb)
  assert.deepEqual(rgb, [1, 0, 0])
})

test('SH: равномерное окружение → E = π·L во всех направлениях', () => {
  // Без панелей: весь горизонт — фон одной яркости.
  const L = 0.7
  const box: SoftboxSpec = {
    background: [L, L, L],
    panels: [],
  }
  const sh = projectSoftboxSH(box, 16)
  const e = [0, 0, 0]
  for (const [x, y, z] of [
    [1, 0, 0],
    [0, -1, 0],
    [0.577, 0.577, 0.577],
  ]) {
    evalSHIrradiance(sh, x!, y!, z!, e)
    assert.ok(near(e[0]! / Math.PI, L, 2e-3), `E/π = ${e[0]! / Math.PI}`)
  }
})

test('SH: совпадает с three.SphericalHarmonics3.getIrradianceAt', () => {
  const { sh } = getLabSoftboxLighting()
  const h = new THREE.SphericalHarmonics3()
  for (let k = 0; k < 9; k++) h.coefficients[k]!.set(sh[k * 3]!, sh[k * 3 + 1]!, sh[k * 3 + 2]!)
  const n = new THREE.Vector3(0.3, -0.5, 0.81).normalize()
  const ref = h.getIrradianceAt(n, new THREE.Vector3())
  const e = [0, 0, 0]
  evalSHIrradiance(sh, n.x, n.y, n.z, e)
  assert.ok(near(e[0]!, ref.x, 1e-4) && near(e[1]!, ref.y, 1e-4) && near(e[2]!, ref.z, 1e-4))
})

test('SH софтбокса: ключ тёплый и яркий, низ тёмный, контровой — циановый', () => {
  const lighting = getLabSoftboxLighting()
  const e = [0, 0, 0]
  const [kx, ky, kz] = lighting.keyDir
  evalSHIrradiance(lighting.sh, kx, ky, kz, e)
  const keyE = [...e]
  assert.ok(keyE[0]! > keyE[2]!, 'ключ тёплый (R > B)')
  evalSHIrradiance(lighting.sh, 0, -1, 0, e)
  assert.ok(e[0]! < keyE[0]! * 0.15, 'снизу темно')
  const rc = LAB_SOFTBOX.panels[1]!.center
  const rl = Math.hypot(...rc)
  evalSHIrradiance(lighting.sh, rc[0] / rl, rc[1] / rl, rc[2] / rl, e)
  assert.ok(e[2]! > e[0]! * 1.5, 'контровой холодный (B ≫ R)')
  // сходимость проекции по плотности сетки
  const coarse = projectSoftboxSH(LAB_SOFTBOX, 32)
  const fine = projectSoftboxSH(LAB_SOFTBOX, 96)
  evalSHIrradiance(coarse, kx, ky, kz, e)
  const a = e[1]!
  evalSHIrradiance(fine, kx, ky, kz, e)
  const maxRel = Math.abs(a - e[1]!) / e[1]!
  assert.ok(maxRel < 0.03, `сходимость ${maxRel}`)
  assert.ok(lighting.keyIrradiance.every((v) => v > 0))
  assert.ok(near(Math.hypot(...lighting.keyDir), 1))
  // без панелей — ключ по умолчанию
  assert.deepEqual(buildSoftboxLighting({ panels: [], background: [0, 0, 0] }, 4).keyDir, [0, 1, 0])
})

test('материалы: defines, общие uniforms освещения, чанки GLSL', () => {
  const imp = createAtomMaterial('impostor', { contact: true })
  const mesh = createAtomMaterial('mesh')
  assert.equal(imp.defines.ATOM_CONTACT, '')
  assert.equal(mesh.defines.ATOM_CONTACT, undefined)
  // один и тот же объект { value } во всех материалах
  assert.equal(imp.uniforms.uSH, atomLightUniforms.uSH)
  assert.equal(mesh.uniforms.uSH, atomLightUniforms.uSH)
  assert.notEqual(imp.uniforms.fogColor, mesh.uniforms.fogColor)
  // освещение проинициализировано из софтбокса
  assert.ok(atomLightUniforms.uSH.value[0]! > 0)
  assert.equal(imp.fog, true)
  assert.equal(imp.transparent, false)
  assert.equal(imp.blending, THREE.CustomBlending)

  for (const chunk of ['<fog_pars_fragment>', '<fog_fragment>', '<tonemapping_fragment>', '<colorspace_fragment>']) {
    assert.ok(imp.fragmentShader.includes(chunk), `impostor: ${chunk}`)
    assert.ok(mesh.fragmentShader.includes(chunk), `mesh: ${chunk}`)
  }
  assert.ok(imp.vertexShader.includes('<fog_vertex>') && mesh.vertexShader.includes('<fog_vertex>'))
  assert.ok(imp.fragmentShader.includes('gl_FragDepth'))
  assert.ok(imp.fragmentShader.includes('fwidth'))
  assert.ok(!mesh.fragmentShader.includes('gl_FragDepth'), 'lite без gl_FragDepth')
  assert.ok(!/\bdiscard\b/.test(mesh.fragmentShader), 'lite без discard')
  for (const a of ['aSphere', 'aColor', 'aEnergy', 'aNeighbor3']) {
    assert.ok(imp.vertexShader.includes(`attribute vec${a === 'aEnergy' ? 2 : 4} ${a}`), a)
  }
  // скобки GLSL сбалансированы (грубая структурная проверка без WebGL)
  for (const src of [imp.vertexShader, imp.fragmentShader, mesh.vertexShader, mesh.fragmentShader]) {
    let depth = 0
    for (const ch of src) {
      if (ch === '{') depth++
      if (ch === '}') depth--
      assert.ok(depth >= 0)
    }
    assert.equal(depth, 0)
    assert.ok(!src.includes('${'), 'не осталось неподставленных шаблонов')
  }
  imp.dispose()
  mesh.dispose()
})

test('геометрии: квад 4 вершины, икосфера detail 4 индексирована', () => {
  const quad = createImpostorQuadGeometry()
  assert.equal(quad.getAttribute('position').count, 4)
  assert.equal(quad.getIndex()!.count, 6)
  const ico = createIcosphereInstancedGeometry()
  // three: detail 4 → (4+1)² = 25 треугольников на грань, 20·25 = 500; вершин 10·25 + 2 = 252 (detail 2 давал гранёный силуэт крупного Na)
  assert.equal(ico.getAttribute('position').count, 252)
  assert.equal(ico.getIndex()!.count, 500 * 3)
  const p = ico.getAttribute('position')
  for (let i = 0; i < p.count; i++) assert.ok(near(Math.hypot(p.getX(i), p.getY(i), p.getZ(i)), 1, 1e-5))
  quad.dispose()
  ico.dispose()
})

console.log(`\ntest-instanced-atoms: ${passed} passed`)
