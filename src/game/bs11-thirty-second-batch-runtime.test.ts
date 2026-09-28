import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import {
  beginAttack,
  getBlockerCandidates,
  playBlocker,
} from '.'
import { createBattleState, item } from './test-helpers/battle-helpers'
import type {
  CookieCard,
  CookieInBattle,
  GameCard,
  GameState,
} from './types'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const candidate = (cardNumber: string, suffix: string): GameCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  const result = convertOfficialCardToGameCard(
    record,
    `bs11-thirty-second-${suffix}`,
  )
  if (result.status !== 'converted') {
    throw new Error(`${cardNumber}: ${result.reason}`)
  }
  return { ...result.gameCard, instanceId: `${cardNumber}:${suffix}` }
}

const cookieEntry = (card: GameCard): CookieInBattle => {
  if (card.type !== 'cookie') throw new Error(`Expected Cookie: ${card.name}`)
  return {
    card: card as CookieCard,
    hpCards: Array.from({ length: card.hp }, (_, index) =>
      item(`${card.instanceId}:hp-${index}`),
    ),
    rested: false,
    battleEntryId: `${card.instanceId}:battle`,
  }
}

const blockerState = (
  supportColor: NonNullable<GameCard['energyColor']>,
): {
  state: GameState
  blocker: GameCard
  support: GameCard
} => {
  const base = createBattleState()
  const blocker = candidate('BS11-094', supportColor)
  const support = item(`bs11-094:${supportColor}-support`, supportColor)
  const state: GameState = {
    ...base,
    players: {
      ...base.players,
      'player-one': {
        ...base.players['player-one'],
        battleArea: [
          base.players['player-one'].battleArea[0]!,
          cookieEntry(blocker),
        ],
        supportArea: [{ card: support, rested: false }],
      },
    },
  }
  return {
    state: beginAttack(state, 'attacker', 'defender', ['p2-support']),
    blocker,
    support,
  }
}

describe('BS11-094 Blocker runtime', () => {
  it('redirects an opponent attack after paying one black support', () => {
    const { state, blocker, support } = blockerState('black')

    expect(state.pendingBattle?.stage).toBe('trap')
    expect(getBlockerCandidates(state, 'player-one').map((entry) => entry.card.instanceId))
      .toEqual([blocker.instanceId])

    const redirected = playBlocker(state, 'player-one', {
      sourceInstanceId: blocker.instanceId,
      paymentIds: [support.instanceId],
    })

    expect(redirected.pendingBattle).toMatchObject({
      stage: 'damage',
      targetInstanceId: blocker.instanceId,
      declaredDamage: 3,
      remainingDamage: 3,
    })
    expect(redirected.players['player-one'].supportArea[0]?.rested).toBe(true)
  })

  it('does not expose or accept the Blocker when only a non-black support is active', () => {
    const { state, blocker, support } = blockerState('red')

    expect(getBlockerCandidates(state, 'player-one')).toEqual([])
    expect(() =>
      playBlocker(state, 'player-one', {
        sourceInstanceId: blocker.instanceId,
        paymentIds: [support.instanceId],
      }),
    ).toThrow()
  })
})
