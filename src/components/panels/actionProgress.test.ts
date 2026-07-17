import { describe, expect, it } from 'vitest'
import { buildActionProgress } from './actionProgress'

describe('buildActionProgress', () => {
  it('保留宣告到結算的完整五步驟', () => {
    expect(
      buildActionProgress({
        active: 'target',
        hasPayment: true,
        hasCost: true,
        hasTarget: true,
      }).map((step) => [step.key, step.state]),
    ).toEqual([
      ['declare', 'done'],
      ['payment', 'done'],
      ['cost', 'done'],
      ['target', 'active'],
      ['resolve', 'pending'],
    ])
  })

  it('沒有費用或代價時直接略過該步', () => {
    expect(
      buildActionProgress({
        active: 'target',
        hasPayment: false,
        hasCost: false,
        hasTarget: true,
      }).map((step) => step.key),
    ).toEqual(['declare', 'target', 'resolve'])
  })
})
