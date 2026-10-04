/**
 * Внутри Canvas: слушатель звука следует за камерой (пространственный звук), события шины 'sound'
 * проигрываются в своей точке. Ничего не рисует.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import { labEvents } from '../labEvents'
import { labAudio } from './labAudio'

const fwd = new THREE.Vector3()
let acc = 0

export function LabAudioListener() {
  useEffect(() => labEvents.on('sound', (e) => labAudio.play(e.name, { at: e.at, gain: e.gain })), [])
  // Скрытая вкладка — без звука; вернулись — звук продолжается
  useEffect(() => labAudio.attachVisibility(), [])
  useFrame(({ camera }, dt) => {
    // Слушатель обновляется ~20 раз в секунду — этого достаточно, а звуковой поток не нагружаем
    acc += dt
    if (acc < 0.05) return
    acc = 0
    camera.getWorldDirection(fwd)
    labAudio.setListener(camera.position.x, camera.position.y, camera.position.z, fwd.x, fwd.y, fwd.z)
  })
  return null
}
