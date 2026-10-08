import { describe, expect, it } from 'vitest'
import { createDemoGame, type AbilityCost } from '..'
import { chooseAiHpToTrashIds } from './hp-cost-selection'
import { chooseSharedEffectTargets } from './shared-selection'

const cost: AbilityCost = { energy: {}, hpToTrash: { amount: 2, energyColor: 'red', totalAcrossCookies: true } }
const cookies = (counts: number[]) => {
  const base = createDemoGame().players['player-one'].battleArea[0]
  return counts.map((count, i) => ({ ...base,
    card: { ...base.card, instanceId: `red-${i}`, energyColor: 'red' as const },
    hpCards: Array.from({ length: count }, () => base.hpCards[0]),
  }))
}
describe('AI shared HP cost selection', () => {
  it('pays two HP split across two Cookies', () => {
    expect(chooseAiHpToTrashIds(cost, cookies([1, 1]), 'red-0')).toEqual(['red-0', 'red-1'])
  })
  it('uses one Cookie when it has enough HP', () => {
    expect(chooseAiHpToTrashIds(cost, cookies([3, 1]), 'red-0')).toEqual(['red-0'])
  })
  it('rejects insufficient total HP', () => {
    expect(chooseAiHpToTrashIds(cost, cookies([1]), 'red-0')).toBeNull()
  })
  it('keeps non-split costs limited to one eligible Cookie', () => {
    expect(chooseAiHpToTrashIds({ ...cost, hpToTrash: { amount: 2 } }, cookies([1, 3]), 'red-0')).toEqual(['red-1'])
  })
})
describe('AI optional Then choice availability', () => {
  it('declines a paid choice with no matching EXTRA skill', () => {
    const state = createDemoGame()
    const result = chooseSharedEffectTargets(state, { sourcePlayerId: 'player-one', sourceInstanceId: 'shadow-milk' }, [{
      kind: 'choose-one', modes: [{ label: 'On Play', effects: [{ kind: 'activate-extra-deck-skill', cardName: 'Shadow Milk Cookie', skillTrigger: 'on-play', optional: false }] }],
    }])
    expect(result.valid).toBe(false)
  })
  it('allows ordinary target-free effects', () => {
    expect(chooseSharedEffectTargets(createDemoGame(), { sourcePlayerId: 'player-one', sourceInstanceId: 'source' }, [{ kind: 'draw-up-to', max: 1 }]).valid).toBe(true)
  })
})
