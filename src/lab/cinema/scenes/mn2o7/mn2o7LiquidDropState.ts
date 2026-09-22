import * as THREE from 'three'

/** Состояние слоя капли жидкого Mn₂O₇: пишет сцена в onFrame, читает Mn2o7LiquidDrop в useFrame. */
export type LiquidDropState = { pos: THREE.Vector3; radius: number; opacity: number }

export function createLiquidDropState(): LiquidDropState {
  return { pos: new THREE.Vector3(), radius: 0, opacity: 0 }
}

/** Скопировать каплю кадра в состояние слоя (модульная функция — без мутации значений хуков в теле компонента). */
export function writeLiquidDrop(state: LiquidDropState, pos: THREE.Vector3, radius: number, opacity: number): void {
  state.pos.copy(pos)
  state.radius = radius
  state.opacity = opacity
}
