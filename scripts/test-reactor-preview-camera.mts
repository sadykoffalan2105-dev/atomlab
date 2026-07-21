import assert from 'node:assert/strict'
import {
  isCameraStuckNearCatalogHero,
  isCameraFarFromPreviewPose,
  needsReactorPreviewCameraRescue,
  resolveReactorPreviewCameraPose,
  REACTOR_PREVIEW_CAMERA,
  applyReactorPreviewCamera,
  type OrbitControlsLike,
} from '../src/lab/reactorPreviewCamera.ts'
import { LAB_ORBIT } from '../src/components/lab/labOrbitConstants.ts'
import { PerspectiveCamera, Vector3 } from 'three'

{
  const few = resolveReactorPreviewCameraPose(3, false)
  assert.equal(few.manyAtoms, false)
  assert.deepEqual(few.pose.position, [...REACTOR_PREVIEW_CAMERA.few.position])

  const manyEnter = resolveReactorPreviewCameraPose(10, false)
  assert.equal(manyEnter.manyAtoms, true)

  const hysteresisKeep = resolveReactorPreviewCameraPose(8, true)
  assert.equal(hysteresisKeep.manyAtoms, true, 'hysteresis keeps many until <7')

  const hysteresisExit = resolveReactorPreviewCameraPose(6, true)
  assert.equal(hysteresisExit.manyAtoms, false)
}

{
  // Exact catalog hero → stuck.
  assert.equal(isCameraStuckNearCatalogHero({ x: 0, y: 0.12, z: 3.6 }), true)
  // Reactor few pose → not stuck.
  assert.equal(isCameraStuckNearCatalogHero({ x: 0.92, y: 1.38, z: 6.35 }), false)
  // Near catalog within 0.35 ball.
  assert.equal(isCameraStuckNearCatalogHero({ x: 0.1, y: 0.1, z: 3.9 }), true)
  // User zoom / orbit near z≈4 but far in XY — must NOT fight orbit (old z-only bug).
  assert.equal(isCameraStuckNearCatalogHero({ x: 0.92, y: 1.38, z: 4.0 }), false)
  assert.equal(isCameraStuckNearCatalogHero({ x: 0, y: 0.12, z: 4.2 }), false)
}

{
  const pose = REACTOR_PREVIEW_CAMERA.many
  assert.equal(
    isCameraFarFromPreviewPose({ x: pose.position[0], y: pose.position[1], z: pose.position[2] }, pose),
    false,
    'at home pose — not far',
  )
  assert.equal(
    isCameraFarFromPreviewPose({ x: 0, y: 0.12, z: 3.6 }, pose),
    true,
    'catalog hero vs many pose — far (чёрный центр)',
  )
  assert.equal(
    isCameraFarFromPreviewPose({ x: 0, y: 0, z: 0 }, pose),
    true,
    'origin vs preview — far',
  )
  assert.equal(
    needsReactorPreviewCameraRescue({
      position: { x: 0, y: 0.12, z: 3.6 },
      pose: REACTOR_PREVIEW_CAMERA.few,
    }),
    true,
    'needsRescue closes dead zone catalog→few',
  )
}

{
  const cam = new PerspectiveCamera(46, 1, 0.1, 100)
  cam.position.set(0, 0.12, 3.6)
  const target = new Vector3(0, 0, 0)
  const controls: OrbitControlsLike = {
    target,
    minDistance: 3.6,
    maxDistance: 3.6,
    minPolarAngle: Math.PI * 0.38,
    maxPolarAngle: Math.PI * 0.62,
    setScale: () => {},
    update: () => {
      // Mimic OrbitControls clamp: if still catalog limits, stay close.
      const r = cam.position.distanceTo(target)
      if (r > controls.maxDistance) {
        cam.position.sub(target).setLength(controls.maxDistance).add(target)
      }
    },
  }

  const pose = REACTOR_PREVIEW_CAMERA.few
  applyReactorPreviewCamera(cam, controls, pose)

  assert.equal(controls.minDistance, LAB_ORBIT.minDistance)
  assert.equal(controls.maxDistance, LAB_ORBIT.maxDistance)
  assert.ok(cam.position.z > 5.5, `expected reactor z, got ${cam.position.z}`)
  assert.ok(Math.abs(cam.position.x - pose.position[0]) < 0.05)
  assert.equal(cam.fov, pose.fov)
  assert.ok(Math.abs(controls.target.y - pose.target[1]) < 0.01)
}

{
  assert.ok(
    REACTOR_PREVIEW_CAMERA.lockMs <= 500,
    `camera lockMs should release for user orbit (got ${REACTOR_PREVIEW_CAMERA.lockMs})`,
  )
  assert.ok(
    REACTOR_PREVIEW_CAMERA.stuckRescueMs <= 300,
    `stuck rescue must be short (got ${REACTOR_PREVIEW_CAMERA.stuckRescueMs})`,
  )
}

console.log('test-reactor-preview-camera: all passed')
