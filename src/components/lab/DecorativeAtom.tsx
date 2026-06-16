import { AtomStructureModel } from './AtomStructureModel'

/** Декоративный атом в свободной лаборатории (кислород — голубое облако). */
export function DecorativeAtom() {
  return <AtomStructureModel z={8} previewEmphasis cosmicStyle accentHex="#ff0d0d" />
}
