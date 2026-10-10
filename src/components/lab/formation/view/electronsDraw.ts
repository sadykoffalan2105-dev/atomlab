import * as THREE from 'three'
import type { SchoolHeroModel, V3 } from '../../hero/schoolHeroModel'
import { clamp01, routeKeyAt, type FormationStory } from '../formationStory'
import { electronPosAt } from '../story/electrons'

/**
 * Электроны «Как образуется» в 3D (InstancedMesh точек): положения — story/electrons.ts electronPosAt (та же функция, что у
 * автотеста test-formation-electrons): точка всегда снаружи шара, пары раздельны, перелёт — дугой к зрителю.
 * Затем — электроны сцены пути (routeStage), после электронов сюжета.
 */
const E_LONE = new THREE.Color('#facc15')
const E_PAIR = new THREE.Color('#22d3ee')
const E_MOVE = new THREE.Color('#fb923c')
const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _e: V3 = [0, 0, 0]
const _rp: V3 = [0, 0, 0]

export function drawElectrons(args: { story: FormationStory; model: SchoolHeroModel; mesh: THREE.InstancedMesh; live: readonly V3[]; t: number }): void {
  const { story, model, mesh, live, t } = args
  const eR = story.eR
  _q.identity()
  story.electrons.forEach((e, i) => {
    const st = electronPosAt(story, model, e, t, live, _e)
    _m.compose(_p.set(_e[0], _e[1], _e[2]), _q, _s.setScalar(Math.max(1e-5, eR * st.sc)))
    mesh.setMatrixAt(i, _m)
    mesh.setColorAt(i, st.kind === 2 ? E_MOVE : st.kind === 1 ? E_PAIR : E_LONE)
  })
  const route = story.routeStage
  if (route) {
    const base = story.electrons.length
    route.electrons.forEach((e, j) => {
      const sc = eR * 1.15 * clamp01((t - e.tIn) / 0.4) * (1 - clamp01((t - e.tOut) / 0.4))
      const P = routeKeyAt(e.keys, t, _rp)
      _m.compose(_p.set(P[0], P[1], P[2]), _q, _s.setScalar(Math.max(1e-5, sc)))
      mesh.setMatrixAt(base + j, _m)
      mesh.setColorAt(base + j, t > e.keys[1]![0] && t < e.keys[e.keys.length - 1]![0] ? E_MOVE : E_LONE)
    })
  }
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
}
