#!/usr/bin/env node
/**
 * Hard-pin атомов при +/- коэффициентов.
 * Запуск: npx tsx scripts/test-coeff-edit-atom-pin.mts
 */
import assert from 'node:assert/strict'
import {
  pinCoeffEditAtomsHard,
  shouldHardPinCoeffEditAtoms,
  resolveBohrReactVisible,
} from '../src/lab/coeffEditAtomPin.ts'

{
  assert.equal(
    shouldHardPinCoeffEditAtoms({
      coeffEditing: true,
      previewOnlyMode: false,
      synthHoldPreview: false,
      hasActiveTerms: true,
      synthLive: false,
    }),
    true,
  )
  assert.equal(
    shouldHardPinCoeffEditAtoms({
      coeffEditing: false,
      previewOnlyMode: true,
      synthHoldPreview: false,
      hasActiveTerms: true,
      synthLive: false,
    }),
    true,
  )
  assert.equal(
    shouldHardPinCoeffEditAtoms({
      coeffEditing: true,
      previewOnlyMode: true,
      synthHoldPreview: false,
      hasActiveTerms: true,
      synthLive: true,
    }),
    false,
    'no hard-pin during live synth flight',
  )
  assert.equal(
    shouldHardPinCoeffEditAtoms({
      coeffEditing: false,
      previewOnlyMode: false,
      synthHoldPreview: false,
      hasActiveTerms: true,
      synthLive: false,
    }),
    false,
  )
}

{
  // После синтеза: terms ещё есть, visible=false → Bohr скрыт (баг хаоса орбит).
  assert.equal(
    resolveBohrReactVisible({
      visible: false,
      previewOnlyMode: false,
      coeffEditing: false,
      synthHoldPreview: false,
      atomsOnScreen: false,
      hasActiveTerms: true,
      stickySlotCount: 22,
      productOwnsScreen: true,
    }),
    false,
    'settled product owns screen: hide Bohr despite terms',
  )
  assert.equal(
    resolveBohrReactVisible({
      visible: true,
      previewOnlyMode: true,
      coeffEditing: false,
      synthHoldPreview: false,
      atomsOnScreen: true,
      hasActiveTerms: true,
      stickySlotCount: 15,
      productOwnsScreen: false,
    }),
    true,
    'pre-synth: show Bohr',
  )
  assert.equal(
    resolveBohrReactVisible({
      visible: false,
      previewOnlyMode: false,
      coeffEditing: true,
      synthHoldPreview: false,
      atomsOnScreen: false,
      hasActiveTerms: true,
      stickySlotCount: 15,
      productOwnsScreen: false,
    }),
    true,
    'coeff edit: show Bohr even if visible prop false',
  )
  assert.equal(
    resolveBohrReactVisible({
      visible: false,
      previewOnlyMode: false,
      coeffEditing: false,
      synthHoldPreview: false,
      atomsOnScreen: false,
      hasActiveTerms: true,
      stickySlotCount: 15,
      productOwnsScreen: false,
    }),
    true,
    'terms + no product on screen: Bohr обязателен (чёрный центр)',
  )
}

{
  const scales: Array<{ scale: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void }; visible: boolean } | null> = []
  const groups: Array<{ visible: boolean; position: { set: (...a: number[]) => void } } | null> = []
  for (let i = 0; i < 4; i++) {
    const sc = {
      visible: false,
      scale: {
        x: 0.06,
        y: 0.06,
        z: 0.06,
        set(x: number, y: number, z: number) {
          this.x = x
          this.y = y
          this.z = z
        },
      },
    }
    scales.push(sc)
    groups.push({
      visible: false,
      position: { set() {} },
    })
  }
  const root = { visible: false }
  pinCoeffEditAtomsHard({
    slotCount: 4,
    layoutScale: 0.88,
    root: root as never,
    atomGroupRefs: { current: groups as never },
    atomScaleGroupRefs: { current: scales as never },
  })
  assert.equal(root.visible, true)
  for (let i = 0; i < 4; i++) {
    assert.equal(groups[i]!.visible, true, `group ${i} visible`)
    assert.equal(scales[i]!.visible, true, `scale ${i} visible`)
    assert.ok(scales[i]!.scale.x >= 0.88, `scale ${i} restored from collapse 0.06`)
  }
}

console.log('test-coeff-edit-atom-pin: all passed')
