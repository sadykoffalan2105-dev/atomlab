/**
 * Оборудование лаборатории в стиле LabXchange (процедурные 3D-модели).
 * Без внешних GLB — всё на Three.js + @react-three/drei.
 */
import { MeshTransmissionMaterial, RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { useExperimentPosterTexture, usePhScaleTexture } from './vrLabPosterTextures'

/** Верхняя полка с пробками и крышками. */
export function VrLabStopperRack({ position = [-2.05, 0.42, -0.48] as [number, number, number] }) {
  return (
    <group position={position}>
      <RoundedBox args={[0.35, 0.5, 0.12]} radius={0.015} smoothness={4} castShadow>
        <meshStandardMaterial color="#9aa8b8" metalness={0.35} roughness={0.45} />
      </RoundedBox>
      {[0, 1, 2, 3].map((i) => (
        <group key={i} position={[-0.1 + i * 0.07, 0.12, 0.06]}>
          <mesh>
            <cylinderGeometry args={[0.022, 0.025, 0.06, 12]} />
            <meshStandardMaterial color="#e8a030" roughness={0.5} />
          </mesh>
        </group>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <group key={`l${i}`} position={[-0.1 + i * 0.07, -0.08, 0.06]}>
          <mesh>
            <cylinderGeometry args={[0.028, 0.028, 0.025, 16]} />
            <meshStandardMaterial color="#c83838" roughness={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Акварium с Elodea. */
export function VrLabAquarium({ position = [-1.55, 0.38, -0.48] as [number, number, number] }) {
  const plantsRef = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (plantsRef.current) {
      plantsRef.current.children.forEach((c, i) => {
        c.rotation.z = Math.sin(state.clock.elapsedTime * 0.8 + i) * 0.08
      })
    }
  })

  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.42, 0.32, 0.28]} />
        <MeshTransmissionMaterial
          backside
          samples={3}
          thickness={0.25}
          roughness={0.05}
          ior={1.33}
          color="#e8f8ff"
        />
      </mesh>
      <mesh position={[0, -0.12, 0]}>
        <boxGeometry args={[0.36, 0.04, 0.22]} />
        <meshStandardMaterial color="#8a7860" roughness={0.9} />
      </mesh>
      <group ref={plantsRef}>
        {[ -0.08, 0, 0.08].map((x, i) => (
          <mesh key={i} position={[x, 0.02, 0]}>
            <coneGeometry args={[0.04, 0.2, 6]} />
            <meshStandardMaterial color="#2a8848" roughness={0.7} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** Картонные коробки. */
export function VrLabStorageBoxes({ position = [-0.85, 0.38, -0.48] as [number, number, number] }) {
  return (
    <group position={position}>
      {[ -0.12, 0.12].map((x, i) => (
        <RoundedBox
          key={i}
          args={[0.22, 0.38, 0.18]}
          radius={0.01}
          position={[x, 0, 0]}
          castShadow
        >
          <meshStandardMaterial color="#a87848" roughness={0.85} />
        </RoundedBox>
      ))}
    </group>
  )
}

/** pH-постер на стене. */
export function VrLabPhPoster({ position = [0.55, 0.95, -0.85] as [number, number, number] }) {
  const tex = usePhScaleTexture()
  return (
    <mesh position={position} rotation={[0, 0, 0]}>
      <planeGeometry args={[0.85, 0.55]} />
      <meshStandardMaterial map={tex} roughness={0.6} />
    </mesh>
  )
}

/** Постер с экспериментом. */
export function VrLabExperimentPoster({ position = [0.15, 0.12, -0.38] as [number, number, number] }) {
  const tex = useExperimentPosterTexture()
  return (
    <group position={position} rotation={[-0.15, 0, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.22, 0.16, 0.008]} />
        <meshStandardMaterial map={tex} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0, -0.006]}>
        <boxGeometry args={[0.22, 0.16, 0.006]} />
        <meshStandardMaterial color="#f0f0f0" />
      </mesh>
    </group>
  )
}

/** Лампы над столом. */
export function VrLabOverheadLamps({ on = true }: { on?: boolean }) {
  const bulbIntensity = on ? 1.6 : 0.1
  return (
    <group>
      {[-0.9, -0.5].map((x) => (
        <group key={x} position={[x, 0.72, 0.05]}>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.16, 8]} />
            <meshStandardMaterial color="#555" metalness={0.6} />
          </mesh>
          <mesh castShadow>
            <sphereGeometry args={[0.09, 16, 16]} />
            <meshStandardMaterial
              color="#fffef5"
              emissive="#fff8e0"
              emissiveIntensity={on ? 1.2 : 0}
              roughness={0.2}
            />
          </mesh>
          <pointLight intensity={bulbIntensity} distance={2.5} color="#fff8ee" castShadow />
        </group>
      ))}
      {/* Переключатель On/Off на «стене» */}
      <group position={[-1.15, 0.35, -0.35]}>
        <RoundedBox args={[0.08, 0.12, 0.04]} radius={0.008}>
          <meshStandardMaterial color="#ddd" />
        </RoundedBox>
        <mesh position={[0, on ? 0.02 : -0.02, 0.022]}>
          <boxGeometry args={[0.04, 0.04, 0.01]} />
          <meshStandardMaterial color={on ? '#4caf50' : '#888'} />
        </mesh>
      </group>
    </group>
  )
}

/** Микропipетка P1000 + штатив. */
export function VrLabMicropipette({ position = [0.05, 0.04, -0.22] as [number, number, number] }) {
  return (
    <group position={position}>
      <RoundedBox args={[0.08, 0.14, 0.08]} radius={0.012} position={[0, 0.07, 0]} castShadow>
        <meshStandardMaterial color="#e8ecf0" roughness={0.4} />
      </RoundedBox>
      <group position={[0, 0.22, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.018, 0.022, 0.28, 16]} />
          <meshStandardMaterial color="#4080c0" roughness={0.35} metalness={0.15} />
        </mesh>
        <mesh position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.08, 16]} />
          <meshStandardMaterial color="#2060a0" roughness={0.3} />
        </mesh>
        <mesh position={[0.04, 0.1, 0]}>
          <boxGeometry args={[0.06, 0.035, 0.015]} />
          <meshStandardMaterial color="#1a1a1a" emissive="#0a8040" emissiveIntensity={0.8} />
        </mesh>
        <mesh position={[0, -0.16, 0]}>
          <cylinderGeometry args={[0.006, 0.006, 0.06, 8]} />
          <meshStandardMaterial color="#888" metalness={0.5} />
        </mesh>
      </group>
    </group>
  )
}

/** Бокс с наконечниками P1000. */
export function VrLabTipBox({ position = [0.42, 0.04, -0.22] as [number, number, number] }) {
  return (
    <group position={position}>
      <RoundedBox args={[0.18, 0.08, 0.12]} radius={0.01} castShadow>
        <meshStandardMaterial color="#f0f4f8" transparent opacity={0.85} roughness={0.2} />
      </RoundedBox>
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[-0.05 + (i % 4) * 0.035, 0.06, -0.03 + Math.floor(i / 4) * 0.035]}>
          <coneGeometry args={[0.008, 0.04, 6]} />
          <meshStandardMaterial color="#6090d0" transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  )
}

/** Урна. */
export function VrLabTrashBin({ position = [-0.15, 0.04, -0.2] as [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.06, 0.05, 0.12, 16]} />
        <meshStandardMaterial color="#4080c0" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.07, 0]}>
        <torusGeometry args={[0.065, 0.008, 8, 20]} />
        <meshStandardMaterial color="#3070b0" />
      </mesh>
    </group>
  )
}

/** Кюветы + штатив. */
export function VrLabCuvetteRack({ position = [1.35, 0.04, -0.18] as [number, number, number] }) {
  const liquidColor = '#88c8e8'
  return (
    <group position={position}>
      <RoundedBox args={[0.28, 0.04, 0.1]} radius={0.008} castShadow>
        <meshStandardMaterial color="#f8fafc" roughness={0.35} />
      </RoundedBox>
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i} position={[-0.1 + i * 0.05, 0.06, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.025, 0.05, 0.025]} />
            <MeshTransmissionMaterial
              backside
              samples={2}
              thickness={0.1}
              roughness={0.05}
              ior={1.5}
              color="#f0f8ff"
            />
          </mesh>
          <mesh position={[0, -0.008, 0]}>
            <boxGeometry args={[0.02, 0.03, 0.02]} />
            <meshStandardMaterial
              color={i === 0 ? '#a0d8f0' : liquidColor}
              emissive={liquidColor}
              emissiveIntensity={0.15}
              transparent
              opacity={0.85}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Спектрофотометр. */
export function VrLabSpectrophotometer({ position = [1.75, 0.04, -0.12] as [number, number, number] }) {
  const screenRef = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (screenRef.current) {
      const mat = screenRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.4 + Math.sin(state.clock.elapsedTime * 2) * 0.1
    }
  })

  return (
    <group position={position}>
      <RoundedBox args={[0.32, 0.14, 0.28]} radius={0.015} castShadow receiveShadow>
        <meshStandardMaterial color="#f0f4f8" roughness={0.35} metalness={0.1} />
      </RoundedBox>
      <mesh position={[0, 0.1, 0.08]} castShadow>
        <boxGeometry args={[0.18, 0.06, 0.12]} />
        <meshStandardMaterial color="#5090d0" roughness={0.3} metalness={0.2} />
      </mesh>
      <mesh ref={screenRef} position={[-0.08, 0.04, 0.142]}>
        <planeGeometry args={[0.1, 0.05]} />
        <meshStandardMaterial color="#1a8040" emissive="#2a9040" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.1, 0.02, 0.142]}>
        <sphereGeometry args={[0.015, 12, 12]} />
        <meshStandardMaterial color="#c04040" />
      </mesh>
      <mesh position={[0.12, 0.02, 0.142]}>
        <sphereGeometry args={[0.015, 12, 12]} />
        <meshStandardMaterial color="#4060c0" />
      </mesh>
    </group>
  )
}

/** Задняя полка (верхний ярус). */
export function VrLabBackShelf({ position = [0, 0.32, -0.52] as [number, number, number] }) {
  return (
    <group position={position}>
      <mesh receiveShadow castShadow>
        <boxGeometry args={[4.2, 0.04, 0.35]} />
        <meshStandardMaterial color="#8a939f" roughness={0.42} metalness={0.1} />
      </mesh>
      <mesh position={[0, -0.18, 0]}>
        <boxGeometry args={[4.2, 0.32, 0.06]} />
        <meshStandardMaterial color="#6a737d" roughness={0.55} />
      </mesh>
    </group>
  )
}

/** Вся декоративная сцена LabXchange. */
export function VrLabEquipmentScene() {
  return (
    <group>
      <VrLabBackShelf />
      <VrLabStopperRack />
      <VrLabAquarium />
      <VrLabStorageBoxes />
      <VrLabPhPoster />
      <VrLabOverheadLamps on />
      <VrLabMicropipette />
      <VrLabTipBox />
      <VrLabTrashBin />
      <VrLabExperimentPoster />
      <VrLabCuvetteRack />
      <VrLabSpectrophotometer />
    </group>
  )
}
