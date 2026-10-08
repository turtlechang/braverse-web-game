import { describe, expect, it } from 'vitest'
import { hasFixedModifierTargets } from '../../game'
import type { CardEffect } from '../../game'
import { describeEffect } from './effectUiUtils'

const move: CardEffect = { kind: 'field-to-deck-bottom', deferAwakenedUnderlay: true,
  target: { side: 'self', min: 1, max: 1, sourceOnly: true } }

describe('BS12-073 printed source movement', () => {
  it('fixes this Cookie rather than asking for another target', () => {
    expect(hasFixedModifierTargets(move)).toBe(true)
    expect(describeEffect(move)).toBe('將來源餅乾放到自己的牌庫底。')
  })
  it('shows the same-name exclusion without making the independent next effect conditional', () => {
    expect(describeEffect({ kind: 'reveal-bottom-deck', requireCard: true, addMatchedToHand: true,
      match: { type: 'cookie', level: 2, keyword: 'arena', excludeCardName: 'DJ Miya' } }))
      .toBe('展示牌庫底 1 張；若為 LV.2 Arena 餅乾（名稱不是 DJ Miya），加入手牌；不符合則保留牌庫底。')
  })
})
