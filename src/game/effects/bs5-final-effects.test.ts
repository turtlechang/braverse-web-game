import { describe, expect, it } from 'vitest'
import {
  beginAttack,
  executeCardEffect,
  getEffectTargetCandidatesForEffect,
  getTrashToDeckCandidates,
  hasRequiredEffectTargets,
  isEffectConditionMet,
  type CardEffect,
  type EffectContext,
  type CookieCard,
} from '..'
import { createBattleState, cookie, item } from '../test-helpers/battle-helpers'

const sourceContext: EffectContext = {
  sourcePlayerId: 'player-one',
  sourceInstanceId: 'source-cookie',
}

describe('BS5-087／BS5-109 Then condition runtime', () => {
  it('checks break level and own trash count on both sides of each threshold', () => {
    const base = createBattleState()
    const breakEffect: CardEffect = {
      kind: 'draw-up-to',
      max: 2,
      condition: { kind: 'break-level-at-least', level: 6 },
    }
    const trashEffect: CardEffect = {
      kind: 'modify-attack',
      amount: -1,
      duration: 'this-turn',
      target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
      condition: { kind: 'trash-count-at-least', count: 15 },
    }

    expect(isEffectConditionMet(base, sourceContext, breakEffect)).toBe(false)
    expect(
      isEffectConditionMet(
        {
          ...base,
          players: {
            ...base.players,
            'player-one': {
              ...base.players['player-one'],
              breakArea: Array.from({ length: 6 }, (_, index) =>
                cookie(`break-${index}`),
              ),
            },
          },
        },
        sourceContext,
        breakEffect,
      ),
    ).toBe(true)

    expect(isEffectConditionMet(base, sourceContext, trashEffect)).toBe(false)
    expect(
      isEffectConditionMet(
        {
          ...base,
          players: {
            ...base.players,
            'player-one': {
              ...base.players['player-one'],
              discardPile: Array.from({ length: 15 }, (_, index) =>
                item(`trash-${index}`),
              ),
            },
          },
        },
        sourceContext,
        trashEffect,
      ),
    ).toBe(true)
  })

  it('does not carry the parsed Then condition into the trap activation gate', () => {
    const base = createBattleState()
    const trapEffect: CardEffect = {
      kind: 'draw-up-to',
      max: 2,
      condition: { kind: 'break-level-at-least', level: 6 },
    }

    expect(isEffectConditionMet(base, sourceContext, trapEffect)).toBe(false)
    // The exact trap adapter returns this condition on the effect, not on
    // TrapAbility.condition; the effect can therefore be skipped cleanly.
    expect(hasRequiredEffectTargets(base, sourceContext, trapEffect)).toBe(true)
  })
})

describe('BS5-094 fixed purple Cookie return and BS5-098 attack target', () => {
  it('filters BS5-094 to five purple non-FLIP Cookies and enforces the minimum', () => {
    const base = createBattleState()
    const purpleCookies = Array.from({ length: 5 }, (_, index) => ({
      ...cookie(`purple-${index}`),
      energyColor: 'purple' as const,
    }))
    const purpleFlip: CookieCard = {
      ...purpleCookies[0],
      instanceId: 'purple-flip',
      id: 'purple-flip',
      flip: { text: 'FLIP', cost: {}, effects: [] },
    }
    const state = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          discardPile: [
            ...purpleCookies,
            purpleFlip,
            item('red-item'),
          ],
        },
      },
    }
    const effect: CardEffect = {
      kind: 'trash-to-deck',
      min: 5,
      max: 5,
      excludeFlip: true,
      energyColor: 'purple',
      cookieOnly: true,
    }

    expect(getTrashToDeckCandidates(state, sourceContext, effect)).toEqual(
      purpleCookies,
    )
    expect(hasRequiredEffectTargets(state, sourceContext, effect)).toBe(true)

    const selectedIds = purpleCookies.map((card) => card.instanceId)
    const result = executeCardEffect(
      state,
      sourceContext,
      effect,
      selectedIds,
      (cards) => cards,
    )
    expect(result.players['player-one'].discardPile).toEqual([
      purpleFlip,
      item('red-item'),
    ])
    expect(result.players['player-one'].deck).toEqual([
      ...base.players['player-one'].deck,
      ...purpleCookies,
    ])

    expect(() =>
      executeCardEffect(
        state,
        sourceContext,
        effect,
        selectedIds.slice(0, 4),
        (cards) => cards,
      ),
    ).toThrow()
  })

  it('restricts BS5-098 field-to-trash to the attacked LV.1 Cookie', () => {
    const base = createBattleState()
    const attackState = beginAttack(base, 'attacker', 'defender', ['p2-support'])
    const levelTwo = {
      ...cookie('level-two', 2, 2),
      level: 2,
    }
    const state = {
      ...attackState,
      players: {
        ...attackState.players,
        'player-one': {
          ...attackState.players['player-one'],
          battleArea: [
            ...attackState.players['player-one'].battleArea,
            {
              card: levelTwo,
              hpCards: [item('level-two-hp')],
              rested: false,
              battleEntryId: 'level-two:battle:3',
            },
          ],
        },
      },
    }
    const context: EffectContext = {
      sourcePlayerId: 'player-two',
      sourceInstanceId: 'attacker',
    }
    const effect: CardEffect = {
      kind: 'field-to-trash',
      target: {
        side: 'opponent',
        min: 0,
        max: 1,
        maxLevel: 1,
        attackTargetOnly: true,
      },
    }

    expect(
      getEffectTargetCandidatesForEffect(state, context, effect).map(
        (target) => target.card.instanceId,
      ),
    ).toEqual(['defender'])

    const result = executeCardEffect(state, context, effect, ['defender'])
    expect(result.players['player-one'].battleArea.map((c) => c.card.instanceId)).toEqual([
      'level-two',
    ])
    expect(result.players['player-one'].discardPile.map((c) => c.instanceId)).toContain(
      'defender',
    )
  })
})
