import { describe, expect, it } from 'vitest'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import type { OfficialCardRecord } from '../cards/types'
import {
  advancePhase,
  applyGameCommand,
  getCookieEffectiveLevel,
  getEffectTargetCandidates,
  isEffectConditionMet,
  createPlayerView,
} from '.'
import { executeCardEffect } from './effects/execute'
import { createBattleState, item } from './test-helpers/battle-helpers'
import type { CookieInBattle, EffectContext, GameCard, GameState } from './types'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const licoriceCard = (instanceId: string): GameCard => {
  const record = records.find((card) => card.cardNumber === 'BS11-092')
  if (!record) throw new Error('Missing BS11-092 candidate')
  const result = convertOfficialCardToGameCard(record, instanceId)
  if (result.status !== 'converted') throw new Error(result.reason)
  return result.gameCard
}

const battleEntry = (card: GameCard): CookieInBattle => {
  if (card.type !== 'cookie') throw new Error(`Expected Cookie: ${card.name}`)
  return {
    card,
    hpCards: [item(`${card.instanceId}:hp-1`), item(`${card.instanceId}:hp-2`)],
    rested: false,
    battleEntryId: `${card.instanceId}:battle`,
  }
}

const makeState = (): { state: GameState; source: CookieInBattle } => {
  const base = createBattleState()
  const source = battleEntry(licoriceCard('bs11-092:source'))
  return {
    source,
    state: {
      ...base,
      activePlayerId: 'player-one',
      phase: 'main',
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [source],
          supportArea: [],
        },
      },
    },
  }
}

describe('BS11-092 Licorice Cookie runtime', () => {
  it('sets only the source Cookie to LV.1 for this turn and respects the Once Per Turn boundary', () => {
    const { state, source } = makeState()
    const context: EffectContext = {
      sourcePlayerId: 'player-one',
      sourceInstanceId: source.card.instanceId,
    }

    expect(getCookieEffectiveLevel(source)).toBe(2)
    expect(
      getEffectTargetCandidates(state, context, {
        side: 'self',
        min: 1,
        max: 1,
        maxLevel: 1,
      }),
    ).toEqual([])

    const activated = applyGameCommand(state, {
      kind: 'activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
      effectTargets: [[source.card.instanceId]],
    })
    const activatedSource = activated.players['player-one'].battleArea[0]
    if (!activatedSource) throw new Error('Activated source should remain in battle')

    expect(activatedSource.card.level).toBe(2)
    expect(activatedSource.levelOverride).toBe(1)
    expect(getCookieEffectiveLevel(activatedSource)).toBe(1)
    expect(createPlayerView(activated, 'player-two').opponent.battleArea[0]?.card.level).toBe(1)
    expect(activated.skillUsesThisTurn).toContain(activatedSource.battleEntryId)
    expect(
      getEffectTargetCandidates(activated, context, {
        side: 'self',
        min: 1,
        max: 1,
        maxLevel: 1,
      }).map((cookieInBattle) => cookieInBattle.card.instanceId),
    ).toEqual([source.card.instanceId])
    expect(isEffectConditionMet(activated, context, {
      kind: 'damage',
      amount: 0,
      target: { side: 'opponent', min: 0, max: 0 },
      condition: {
        kind: 'battle-area-has-cookie-with-level',
        side: 'self',
        level: 1,
      },
    })).toBe(true)
    expect(() => applyGameCommand(activated, {
      kind: 'activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
      effectTargets: [[source.card.instanceId]],
    })).toThrow('每回合一次')
  })

  it('clears the temporary LV at the next turn and preserves the printed LV when the Cookie leaves battle', () => {
    const { state, source } = makeState()
    const activated = applyGameCommand(state, {
      kind: 'activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
      effectTargets: [[source.card.instanceId]],
    })
    const nextTurn = advancePhase({ ...activated, phase: 'end' })
    const nextTurnSource = nextTurn.players['player-one'].battleArea[0]
    if (!nextTurnSource) throw new Error('Source should remain after turn transition')
    expect(nextTurnSource.levelOverride).toBeUndefined()
    expect(getCookieEffectiveLevel(nextTurnSource)).toBe(2)

    const moved = executeCardEffect(
      activated,
      {
        sourcePlayerId: 'player-one',
        sourceInstanceId: source.card.instanceId,
      },
      {
        kind: 'field-to-trash',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
      [source.card.instanceId],
    )
    expect(moved.players['player-one'].battleArea).toHaveLength(0)
    expect(moved.players['player-one'].discardPile).toContainEqual(
      expect.objectContaining({
        instanceId: source.card.instanceId,
        level: 2,
      }),
    )
  })
})
