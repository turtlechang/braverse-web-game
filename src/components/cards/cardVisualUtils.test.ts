import { describe, expect, it } from 'vitest'
import { getCardEffectTokenLabel } from './cardVisualUtils'

describe('card effect token labels', () => {
  it('displays the official once-per-turn marker', () => {
    expect(getCardEffectTokenLabel('t1')).toBe(
      'Once per turn 一回合一次',
    )
  })

  it('leaves unknown markers available for raw display', () => {
    expect(getCardEffectTokenLabel('custom')).toBeUndefined()
  })

  it('displays the official damage marker', () => {
    expect(getCardEffectTokenLabel('da')).toBe('Damage')
  })
})
