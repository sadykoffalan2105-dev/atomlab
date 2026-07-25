import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { cinemaCircle, cinemaRing } from '../core/geometries'
import { sceneText } from '../core/glyphs'
import type { HudState } from '../core/states'

/**
 * Экранная графика микромира: неоновые счётчики коэффициентов, подписи фаз,
 * метки степени окисления. Всё появляется/исчезает через мутируемое состояние,
 * поэтому HUD не заставляет React перерисовывать сцену на каждом кадре.
 *
 * Любой текст проходит через sceneText: шрифт 3D-слоя не знает подстрочных
 * индексов, и «NaClO₂» без приведения превратилось бы в «NaClO□».
 */

function setTextOpacity(obj: THREE.Object3D | null, value: number): void {
  if (!obj) return
  const mesh = obj as THREE.Mesh
  const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
  if (!mat) return
  if (Array.isArray(mat)) {
    for (const m of mat) {
      m.transparent = true
      m.opacity = value
    }
    return
  }
  mat.transparent = true
  mat.opacity = value
}

/**
 * Неоновый счётчик коэффициента над группой атомов: ученик видит,
 * что молекул именно 2, а не «несколько».
 */
export function CinemaCounter({
  state,
  value,
  label,
  color = '#7ef4ff',
}: {
  state: HudState
  value: number
  label?: string
  color?: string
}) {
  const group = useRef<THREE.Group>(null)
  const discMat = useRef<THREE.MeshBasicMaterial>(null)
  const ringMat = useRef<THREE.MeshBasicMaterial>(null)
  const numRef = useRef<THREE.Object3D>(null)
  const labelRef = useRef<THREE.Object3D>(null)

  useFrame(() => {
    const g = group.current
    if (!g) return
    const o = state.opacity
    if (o <= 0.01) {
      g.visible = false
      return
    }
    g.visible = true
    g.position.copy(state.center)
    // Небольшой «доезд» масштаба на появлении — счётчик не выскакивает щелчком.
    g.scale.setScalar(0.82 + o * 0.18)
    if (discMat.current) discMat.current.opacity = o * 0.55
    if (ringMat.current) ringMat.current.opacity = o * 0.8
    setTextOpacity(numRef.current, o)
    setTextOpacity(labelRef.current, o * 0.9)
  })

  return (
    <group ref={group} visible={false}>
      <Billboard follow>
        <mesh position={[0, 0, -0.02]} geometry={cinemaCircle(0.26, 24)} dispose={null}>
          <meshBasicMaterial ref={discMat} color="#04141c" transparent opacity={0} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0, -0.01]} geometry={cinemaRing(0.23, 0.28, 28)} dispose={null}>
          <meshBasicMaterial
            ref={ringMat}
            color={color}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <Text
          ref={numRef}
          fontSize={0.27}
          color={color}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.012}
          outlineColor="#021018"
          material-side={THREE.FrontSide}
          material-transparent
          depthOffset={-1}
        >
          {String(value)}
        </Text>
        {label ? (
          <Text
            ref={labelRef}
            position={[0, -0.32, 0]}
            fontSize={0.11}
            color="#d9f4ff"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.006}
            outlineColor="#021018"
            material-side={THREE.FrontSide}
            material-transparent
            depthOffset={-1}
          >
            {sceneText(label)}
          </Text>
        ) : null}
      </Billboard>
    </group>
  )
}

/** Подпись фазы наверху кадра. Текст меняется только на смене фазы. */
export function CinemaCaption({
  text,
  sub,
  position = [0, 2.05, 0],
}: {
  text: string
  sub?: string
  position?: [number, number, number]
}) {
  return (
    <Billboard position={position} follow>
      <Text
        fontSize={0.15}
        color="#e2f7ff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.007}
        outlineColor="#04121c"
        maxWidth={5.6}
        textAlign="center"
        material-side={THREE.FrontSide}
        depthOffset={-1}
      >
        {sceneText(text)}
      </Text>
      {sub ? (
        <Text
          position={[0, -0.26, 0]}
          fontSize={0.115}
          color="#9fd2e8"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.005}
          outlineColor="#04121c"
          maxWidth={5.6}
          textAlign="center"
          material-side={THREE.FrontSide}
          depthOffset={-1}
        >
          {sceneText(sub)}
        </Text>
      ) : null}
    </Billboard>
  )
}

/** Метка степени окисления рядом с атомом: «Cl: +3 → +4». */
export function CinemaOxidationTag({
  state,
  text,
  color = '#ffe08a',
  offset = [0, 0.42, 0],
}: {
  state: HudState
  text: string
  color?: string
  offset?: [number, number, number]
}) {
  const group = useRef<THREE.Group>(null)
  const textRef = useRef<THREE.Object3D>(null)
  const off = useMemo(() => new THREE.Vector3(offset[0], offset[1], offset[2]), [offset])

  useFrame(() => {
    const g = group.current
    if (!g) return
    const o = state.opacity
    if (o <= 0.01) {
      g.visible = false
      return
    }
    g.visible = true
    g.position.copy(state.center).add(off)
    setTextOpacity(textRef.current, o)
  })

  return (
    <group ref={group} visible={false}>
      <Billboard follow>
        <Text
          ref={textRef}
          fontSize={0.105}
          color={color}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.006}
          outlineColor="#1a0c04"
          material-side={THREE.FrontSide}
          material-transparent
          depthOffset={-1}
        >
          {sceneText(text)}
        </Text>
      </Billboard>
    </group>
  )
}
