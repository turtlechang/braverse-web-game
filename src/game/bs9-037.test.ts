import { describe, expect, it } from 'vitest'
import bs9Candidates from '../../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState } from './demo'
import { getEffectSelectionCandidates } from './effects'
import type { GameCard } from './types'

const records = bs9Candidates.cards as unknown as OfficialCardRecord[]

const candidate = (cardNumber: string) => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS9 candidate ${cardNumber}`)
  const conversion = convertOfficialCardToGameCard(record, 'bs9-037-test')
  if (conversion.status !== 'converted') throw new Error(conversion.reason)
  return conversion.gameCard
}

describe('BS9-037 Apple Faerie Cookie candidate', () => {
  it('converts both arts with the faint timing and every printed trash filter', () => {
    for (const cardNumber of ['BS9-037', 'BS9-037@1']) {
      expect(candidate(cardNumber)).toMatchObject({
        id: 'BS9-037',
        name: 'Apple Faerie Cookie',
        level: 1,
        hp: 2,
        attack: 2,
        attackEnergyCost: { yellow: 2 },
        skill: {
          trigger: 'passive',
          faint: true,
          effects: [{
            kind: 'trash-to-hand',
            max: 2,
            energyColor: 'yellow',
            cookieOnly: true,
            hasFlip: true,
          }],
        },
      })
    }
  })

  it('accepts only yellow Cookies that actually have FLIP', () => {
    const source = candidate('BS9-037')
    const effect = source.skill!.effects[0]!
    const base = createCardCheckDemoState('BS9-033')
    const yellowFlip = candidate('BS9-032')
    const yellowNonFlip = base.players['player-one'].hand.find((card) => !card.flip)!
    const wrongColor = { ...yellowFlip, instanceId: 'wrong-color', energyColor: 'red' as const }
    const nonCookie = {
      ...yellowFlip,
      id: 'non-cookie',
      instanceId: 'non-cookie',
      type: 'item' as const,
    } as GameCard
    const state = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          discardPile: [yellowFlip, yellowNonFlip, wrongColor, nonCookie],
        },
      },
    }
    expect(getEffectSelectionCandidates(state, {
      sourcePlayerId: 'player-one',
      sourceInstanceId: source.instanceId,
    }, effect).map((card) => card.instanceId)).toEqual([yellowFlip.instanceId])
  })

  it('resolves the faint command with zero to two eligible cards and rejects every invalid selection', () => {
    const state = createCardCheckDemoState('BS9-037')
    const eligible = state.players['player-one'].discardPile.filter(
      (card) => card.type === 'cookie' && card.energyColor === 'yellow' && Boolean(card.flip),
    )
    const invalid = state.players['player-one'].discardPile.find(
      (card) => !eligible.includes(card),
    )!
    expect(eligible).toHaveLength(2)
    expect(() => applyGameCommand(state, {
      kind: 'resolve-faint-effect',
      playerId: 'player-one',
      targetIds: [invalid.instanceId],
    })).toThrow()
    expect(() => applyGameCommand(state, {
      kind: 'resolve-faint-effect',
      playerId: 'player-one',
      targetIds: [eligible[0]!.instanceId, eligible[1]!.instanceId, invalid.instanceId],
    })).toThrow()

    const resolved = applyGameCommand(state, {
      kind: 'resolve-faint-effect',
      playerId: 'player-one',
      targetIds: eligible.map((card) => card.instanceId),
    })
    expect(resolved.players['player-one'].hand).toEqual(
      expect.arrayContaining(eligible),
    )
    expect(resolved.players['player-one'].discardPile).not.toEqual(
      expect.arrayContaining(eligible),
    )

    const skipped = applyGameCommand(createCardCheckDemoState('BS9-037'), {
      kind: 'resolve-faint-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(skipped.pendingFaintEffects).toBeUndefined()
  })
})
