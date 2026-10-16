import { describe, expect, it } from 'vitest'
import { createCardCheckDemoState, createCardNegativeDemoState, parseTestStateConfig } from './demo'
import { createSt8007PreviewState } from './st8-007-demo'

describe('promoted ST8-007 physical test routes', () => {
  it.each(['ST8-007', 'st8-007'])('normalizes %s in the public card URL', number => {
    expect(parseTestStateConfig(`?test-state=card:${number}`, 'localhost'))
      .toEqual({ kind: 'card-check', cardNumber: 'ST8-007' })
  })

  it('opens the actual damage-triggered original FLIP instead of a neutral placeholder', () => {
    expect(createCardCheckDemoState('ST8-007')).toEqual(createSt8007PreviewState('positive'))
  })

  it('keeps the negative route at an actual unpaid FLIP', () => {
    expect(createCardNegativeDemoState('ST8-007')).toEqual(createSt8007PreviewState('negative'))
  })
})
