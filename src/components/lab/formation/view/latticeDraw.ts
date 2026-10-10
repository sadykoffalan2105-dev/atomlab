import * as THREE from 'three'
import type { SchoolHeroModel } from '../../hero/schoolHeroModel'
import { createSchoolMatteMaterial, schoolAtomColor, schoolSphereGeometry } from '../../hero/schoolHeroStyle'
import type { FormationStory } from '../formationStory'

export { applyLatticeSnap } from '../story/lattice'

/**
 * Фрагмент решётки «Как образуется» в 3D-виде (FormationMoleculeView): один InstancedMesh (≤ 240 инстансов), цвет каждого
 * атома смешан с фоном на LatticeAtom.dim (S1 0,30, S2 0,58, копии молекул 0,55, звенья цепи 0,35), без прозрачности.
 * Ион появляется ростом 0 → r за 0,5 с в момент latticeWin[0] + k·(latticeWin[1] − latticeWin[0]) и дальше не меняется
 * (ионы касаются — твёрдое тело). Кадр — frameRadius: модель в центре и ≥ 45 % кадра.
 */

const LAT_BG = new THREE.Color('#0b1020')
const GROW = 0.5
const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _c = new THREE.Color()

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const ease = (x: number) => {
  const u = clamp01(x)
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2
}

/** Меш фрагмента (useMemo при монтировании вида): цвета — один раз, матрицы — нулевой масштаб. */
export function createLatticeMesh(story: FormationStory, lowPower: boolean): { mesh: THREE.InstancedMesh; mat: THREE.Material } {
  const nL = story.latticeAtoms.length
  const mat = createSchoolMatteMaterial()
  const mesh = new THREE.InstancedMesh(schoolSphereGeometry(lowPower), mat, Math.max(1, nL))
  mesh.name = 'formation-lattice'
  mesh.frustumCulled = false
  mesh.count = nL
  mesh.visible = false
  story.latticeAtoms.forEach((a, i) => {
    _m.compose(_p.set(...a.pos), _q.identity(), _s.setScalar(1e-5))
    mesh.setMatrixAt(i, _m)
    mesh.setColorAt(i, schoolAtomColor(a.el as never, _c).lerp(LAT_BG, a.dim ?? 0.42))
  })
  return { mesh, mat }
}

/** Время, после которого рост закончен и фрагмент неподвижен (матрицы не пишутся). */
const doneAt = (story: FormationStory) => story.latticeWin[1] + GROW + 0.05

/**
 * Рост фрагмента в момент t; возвращает видимость latO (0…1) для кадра. У твёрдых (solidPhase) фрагмент остаётся
 * до конца показа, у прочих уходит в конце «Готово» (как раньше).
 */
export function drawLattice(story: FormationStory, mesh: THREE.InstancedMesh, t: number, solidPhase: boolean): number {
  const atoms = story.latticeAtoms
  const nL = atoms.length
  if (!nL) {
    mesh.visible = false
    return 0
  }
  const [w0, w1] = story.latticeWin
  const fin = story.stages[story.stages.length - 1]!
  const fadeAt = solidPhase ? Infinity : fin.t0 + fin.dur - 1.6
  const fade = 1 - ease((t - fadeAt) / 0.8)
  const latO = (t >= w0 - 0.05 ? 1 : 0) * fade
  const vis = latO > 0.01
  // неподвижный фрагмент (рост окончен, ухода нет) — матрицы уже записаны: ничего не делаем
  const still = t > doneAt(story) && fade >= 1
  const key = vis ? (still ? 2 : 1) : 0
  const ud = mesh.userData as { k?: number }
  if (!(still && ud.k === 2)) {
    if (vis) {
      const span = w1 - w0
      for (let i = 0; i < nL; i++) {
        const a = atoms[i]!
        const g = ease((t - (w0 + a.k * span)) / GROW) * fade
        _m.compose(_p.set(a.pos[0], a.pos[1], a.pos[2]), _q.identity(), _s.setScalar(Math.max(1e-5, a.r * g)))
        mesh.setMatrixAt(i, _m)
      }
      mesh.instanceMatrix.needsUpdate = true
    }
    ud.k = key
  }
  mesh.visible = vis
  return latO
}

/**
 * Радиус кадра, пока фрагмент виден (центр кадра — центр модели):
 *  • ионные с оболочками: R = max(1,08·R_m, min(ext_S1 + 0,05·R_m, 2,1·R_m)) — S1 (КЧ) в кадре, S2 может выходить за край;
 *  • копии молекул и формульных единиц (позади модели): R = max(1,1·R_m, …) — копии кадр не расширяют;
 *  • звенья цепи: до 1,6·R_m — соседние звенья видны частично.
 */
export function frameRadius(story: FormationStory, model: SchoolHeroModel, R: number, latO: number): number {
  if (latO <= 0.04 || !story.latticeAtoms.length) return R
  const Rm = model.radius
  const sh = story.latticeShells
  if (story.latticeAtoms[0]!.shell && sh) return Math.max(R, 1.08 * Rm, Math.min(sh.ext1 + 0.05 * Rm, 2.1 * Rm))
  if (story.latticeKind === 'chain' && sh) return Math.max(R, 1.1 * Rm, Math.min(sh.extAll, 1.6 * Rm))
  return Math.max(R, 1.1 * Rm)
}

/** Поворот твёрдого итога: покачивание yaw ± 0,42 рад (период 22 с) вокруг читаемой позы модели, без облёта. */
export function solidSwayYaw(model: SchoolHeroModel, swayT: number): number {
  return model.yaw + 0.42 * Math.sin((2 * Math.PI * swayT) / 22)
}
