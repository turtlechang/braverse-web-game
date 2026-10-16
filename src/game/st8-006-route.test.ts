import { describe, expect, it } from 'vitest'
import { createCardCheckDemoState, createCardNegativeDemoState, parseTestStateConfig } from './demo'
import { createSt8006PreviewState } from './st8-006-demo'

describe('promoted ST8-006 physical test routes', () => {
  it.each(['ST8-006', 'st8-006'])('normalizes %s in the public card URL', number => {
    expect(parseTestStateConfig(`?test-state=card:${number}`, 'localhost'))
      .toEqual({ kind: 'card-check', cardNumber: 'ST8-006' })
  })

  it('opens the actual damage-triggered original FLIP instead of a neutral placeholder', () => {
    expect(createCardCheckDemoState('ST8-006')).toEqual(createSt8006PreviewState('positive'))
  })

  it('keeps the negative route at an actual unpaid FLIP', () => {
    expect(createCardNegativeDemoState('ST8-006')).toEqual(createSt8006PreviewState('negative'))
  })
})
