/** Позиции 10 колб на настенной полке (фон, над столом). */

export const SHELF_FLASK_COUNT = 10

export const SHELF_Y = 0.82
export const SHELF_Z = -0.86
export const BENCH_Y = 0.02
export const BENCH_Z = 0.06

const SHELF_X0 = -1.18
const SHELF_SPACING = 0.132

export function shelfSlotPosition(index: number): [number, number, number] {
  return [SHELF_X0 + index * SHELF_SPACING, SHELF_Y, SHELF_Z]
}

export const SHELF_SLOT_POSITIONS: readonly [number, number, number][] = Array.from(
  { length: SHELF_FLASK_COUNT },
  (_, i) => shelfSlotPosition(i),
)

export function nearestShelfSlot(x: number): number {
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < SHELF_FLASK_COUNT; i++) {
    const d = Math.abs(SHELF_SLOT_POSITIONS[i]![0] - x)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best
}

const SNAP_SLOT_X = 0.07
const SHELF_ZONE_Z = -0.48

export function snapFlaskPlacement(pos: [number, number, number]): {
  position: [number, number, number]
  slotIndex: number | null
  onShelf: boolean
} {
  if (pos[2] <= SHELF_ZONE_Z) {
    const slotIndex = nearestShelfSlot(pos[0])
    const slot = SHELF_SLOT_POSITIONS[slotIndex]!
    if (Math.abs(pos[0] - slot[0]) <= SNAP_SLOT_X * 2.2) {
      return { position: [...slot], slotIndex, onShelf: true }
    }
    return {
      position: [pos[0], SHELF_Y, SHELF_Z],
      slotIndex: null,
      onShelf: true,
    }
  }

  const x = Math.max(-1.05, Math.min(0.95, pos[0]))
  const z = Math.max(0.02, Math.min(0.28, pos[2]))
  return { position: [x, BENCH_Y, z], slotIndex: null, onShelf: false }
}

export function shelfFlaskId(index: number): string {
  return `shelf-${index + 1}`
}

export function shelfFlaskLabel(index: number): string {
  return String(index + 1)
}

/** Центр реактора смешивания на столе. */
export const VAT_POSITION: [number, number, number] = [0.38, BENCH_Y, BENCH_Z]

export const VAT_ZONE_RADIUS = 0.18

/** Колба над зоной реактора (можно влить наклоном). */
export function isNearVat(
  pos: [number, number, number],
  vat: [number, number, number] = VAT_POSITION,
  radius = VAT_ZONE_RADIUS,
): boolean {
  const dx = pos[0] - vat[0]
  const dz = pos[2] - vat[2]
  return dx * dx + dz * dz <= radius * radius
}
