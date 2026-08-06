import { describe, expect, it } from 'vitest'
import {
  executeCardEffect,
  getEffectTargetCandidatesForEffect,
  type CardEffect,
  type EffectContext,
} from '..'
import { createBattleState, cookie, item } from '../test-helpers/battle-helpers'

describe('BS5 blue/purple/pure runtime effects', () => {
  it('equips any Dragon and applies bonuses only at 3 or less remaining HP', () => {
    const dragon = {
      ...cookie('dragon-cookie', 2, 3),
      keywords: ['dragon' as const],
    }
    const nonDragon = cookie('non-dragon-cookie', 2, 3)
    const base = createBattleState()
    const state = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [
            {
              ...base.players['player-one'].battleArea[0],
              card: dragon,
              hpCards: [
                item('dragon-hp-1'),
                item('dragon-hp-2'),
                item('dragon-hp-3'),
              ],
            },
          ],
          hand: [nonDragon],
          discardPile: [item('wrath-of-the-dragons')],
        },
      },
    }
    const context: EffectContext = {
      sourcePlayerId: 'player-one',
      sourceInstanceId: 'wrath-of-the-dragons',
    }
    const effect: CardEffect = {
      kind: 'equip-source',
      target: { side: 'self', min: 1, max: 1 },
      requiredKeyword: 'dragon',
      bonusMaxRemainingHp: 3,
      attackBonus: 1,
      damageReceivedReduction: 1,
    }

    expect(
      getEffectTargetCandidatesForEffect(state, context, effect).map(
        (target) => target.card.instanceId,
      ),
    ).toEqual(['dragon-cookie'])

    const result = executeCardEffect(state, context, effect, ['dragon-cookie'])
    const equipped = result.players['player-one'].battleArea[0]
    expect(equipped.equippedCards?.map((card) => card.instanceId)).toEqual([
      'wrath-of-the-dragons',
    ])
    expect(result.attackModifiers).toContainEqual({
      sourceInstanceId: 'wrath-of-the-dragons',
      targetInstanceId: 'dragon-cookie',
      amount: 1,
      expiresAfterTurn: null,
    })
    expect(result.damageReceivedModifiers).toContainEqual({
      sourceInstanceId: 'wrath-of-the-dragons',
      targetInstanceId: 'dragon-cookie',
      amount: -1,
      expiresAfterTurn: null,
    })

    const highHpDragon = {
      ...cookie('high-hp-dragon', 2, 4),
      keywords: ['dragon' as const],
    }
    const highHpState = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: [
            ...state.players['player-one'].battleArea,
            {
              ...state.players['player-one'].battleArea[0],
              card: highHpDragon,
              hpCards: [
                item('high-hp-1'),
                item('high-hp-2'),
                item('high-hp-3'),
                item('high-hp-4'),
              ],
            },
          ],
        },
      },
    }
    expect(
      getEffectTargetCandidatesForEffect(highHpState, context, effect).map(
        (target) => target.card.instanceId,
      ),
    ).toEqual(['dragon-cookie', 'high-hp-dragon'])
    const highHpResult = executeCardEffect(
      highHpState,
      context,
      effect,
      ['high-hp-dragon'],
    )
    expect(highHpResult.players['player-one'].battleArea[1].equippedCards).toEqual([
      item('wrath-of-the-dragons'),
    ])
    expect(highHpResult.attackModifiers).not.toContainEqual(
      expect.objectContaining({ targetInstanceId: 'high-hp-dragon' }),
    )
    expect(highHpResult.damageReceivedModifiers).not.toContainEqual(
      expect.objectContaining({ targetInstanceId: 'high-hp-dragon' }),
    )
  })
})
