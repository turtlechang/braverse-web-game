import { describe, expect, it } from 'vitest'
import { executeCardEffect, type CardEffect, type EffectContext } from '..'
import officialBS3Inventory from '../../../data/cards/official-age-of-heroes-and-kingdoms-bs3.en.json'
import { convertOfficialCardToGameCard } from '../../cards/official-card-adapter'
import type { OfficialCardRecord } from '../../cards/types'
import { createBattleState, item } from '../test-helpers/battle-helpers'

/**
 * BS3-095《榮耀奶油共和國》官方文字「Select 1 of the following. ・View 3
 * cards... ・Draw 1 card...place this card at the bottom of your deck.」
 * 是「選擇一項」，第二分支需要一個新的效果——來源場景卡自己離開場景區、
 * 送回牌庫（stage-source-to-deck）。原本的轉接只對到第一分支，且對照表用
 * 含異畫版本後綴的完整卡號當 key，導致 BS3-095@1／@2 兩個異畫版本完全沒有
 * 轉出任何效果。
 */
describe('stage-source-to-deck effect', () => {
  const context: EffectContext = {
    sourcePlayerId: 'player-two',
    sourceInstanceId: 'stage-1',
    sourceCardName: 'stage-1',
  }

  it('moves the source stage card to the bottom of the deck and clears the stage slot', () => {
    const state = createBattleState()
    state.players['player-two'].stage = {
      card: { ...item('stage-1'), type: 'stage' },
      rested: true,
    }
    state.players['player-two'].deck = [item('deck-a'), item('deck-b')]

    const effect: CardEffect = { kind: 'stage-source-to-deck', destination: 'bottom' }
    const result = executeCardEffect(state, context, effect, [])

    expect(result.players['player-two'].stage).toBeNull()
    expect(result.players['player-two'].deck.map((c) => c.instanceId)).toEqual([
      'deck-a',
      'deck-b',
      'stage-1',
    ])
  })

  it('moves the source stage card to the top of the deck when destination is top', () => {
    const state = createBattleState()
    state.players['player-two'].stage = {
      card: { ...item('stage-1'), type: 'stage' },
      rested: false,
    }
    state.players['player-two'].deck = [item('deck-a'), item('deck-b')]

    const effect: CardEffect = { kind: 'stage-source-to-deck', destination: 'top' }
    const result = executeCardEffect(state, context, effect, [])

    expect(result.players['player-two'].stage).toBeNull()
    expect(result.players['player-two'].deck.map((c) => c.instanceId)).toEqual([
      'stage-1',
      'deck-a',
      'deck-b',
    ])
  })

  it('throws when the source is not the active stage card', () => {
    const state = createBattleState()
    state.players['player-two'].stage = {
      card: { ...item('other-stage'), type: 'stage' },
      rested: false,
    }

    const effect: CardEffect = { kind: 'stage-source-to-deck', destination: 'bottom' }
    expect(() => executeCardEffect(state, context, effect, [])).toThrowError()
  })
})

describe('BS3-095 Glorious Crème Republic (official adapter)', () => {
  const findBs3Card = (cardNumber: string) => {
    const card = (officialBS3Inventory.cards as OfficialCardRecord[]).find(
      (candidate) => candidate.cardNumber === cardNumber,
    )
    if (!card) throw new Error(`Missing BS3 inventory card ${cardNumber}`)
    return card
  }

  it.each(['BS3-095', 'BS3-095@1', 'BS3-095@2'])(
    'converts %s into a choose-one with reorder-top and draw-then-return-to-deck branches',
    (cardNumber) => {
      const conversion = convertOfficialCardToGameCard(findBs3Card(cardNumber))
      if (conversion.status !== 'converted' || conversion.gameCard.type !== 'stage') {
        throw new Error(`${cardNumber} should convert to a stage GameCard.`)
      }
      const { stageAbility } = conversion.gameCard
      expect(stageAbility).toBeDefined()
      expect(stageAbility?.restSource).toBe(true)
      expect(stageAbility?.effects).toEqual([
        {
          kind: 'choose-one',
          modes: [
            expect.objectContaining({
              effects: [
                { kind: 'inspect-deck', lookCount: 3, pickCount: 0, restDestination: 'top' },
              ],
            }),
            expect.objectContaining({
              effects: [
                { kind: 'draw', amount: 1 },
                { kind: 'stage-source-to-deck', destination: 'bottom' },
              ],
            }),
          ],
        },
      ])
    },
  )
})
