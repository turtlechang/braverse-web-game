import { describe, expect, it } from 'vitest'
import bs9Candidates from '../../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState } from './demo'
import { processEndPhaseEffects } from './turn'
import type { CookieCard, GameState } from './types'

const records = bs9Candidates.cards as unknown as OfficialCardRecord[]

const candidate = (cardNumber: string) => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS9 candidate ${cardNumber}`)
  const conversion = convertOfficialCardToGameCard(record, 'bs9-036-test')
  if (conversion.status !== 'converted') throw new Error(conversion.reason)
  return conversion.gameCard
}

describe('BS9-036 Bookseller candidate', () => {
  it('converts the mandatory end-of-turn choice without treating either branch as a skill cost', () => {
    expect(candidate('BS9-036')).toMatchObject({
      id: 'BS9-036',
      name: 'Bookseller',
      level: 2,
      hp: 3,
      attack: 4,
      attackEnergyCost: { yellow: 3 },
      skill: {
        trigger: 'passive',
        endPhase: true,
        endPhaseScope: 'your-turn',
        cost: { energy: {}, discardHand: 0 },
        effects: [{
          kind: 'choose-one',
          modes: [
            {
              effects: [{
                kind: 'discard-hand',
                count: 1,
                cookieOnly: true,
                hasFlip: true,
              }],
            },
            {
              effects: [{
                kind: 'hp-to-trash',
                amount: 1,
                target: { side: 'self', min: 1, max: 1, sourceOnly: true },
              }],
            },
          ],
        }],
      },
    })
  })

  const endPhaseState = (includeFlip: boolean): GameState => {
    const base = createCardCheckDemoState('BS9-033')
    const source = candidate('BS9-036') as CookieCard
    const sourceEntry = {
      ...base.players['player-one'].battleArea[0]!,
      card: source,
      hpCards: base.players['player-one'].battleArea[0]!.hpCards.slice(0, 2),
    }
    const flip = candidate('BS9-032')
    const nonFlip = { ...candidate('BS9-036'), instanceId: 'bs9-036-non-flip-cookie' }
    return {
      ...base,
      phase: 'end',
      skillUsesThisTurn: [],
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [sourceEntry],
          hand: includeFlip
            ? [flip, nonFlip]
            : [nonFlip],
        },
      },
    }
  }

  it('queues a real end-phase choice and filters the FLIP Cookie discard branch', () => {
    const initial = processEndPhaseEffects(endPhaseState(true))
    expect(initial.pendingAbilityEffect?.effects[0]).toMatchObject({ kind: 'choose-one' })
    const chosen = applyGameCommand(initial, {
      kind: 'resolve-choose-one',
      playerId: 'player-one',
      modeIndex: 0,
    })
    const pendingDiscard = applyGameCommand(chosen, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(pendingDiscard.pendingOpponentHandDiscard).toMatchObject({
      playerId: 'player-one',
      count: 1,
      cookieOnly: true,
      hasFlip: true,
    })
    const nonFlip = pendingDiscard.players['player-one'].hand.find((card) => !card.flip)!
    expect(() => applyGameCommand(pendingDiscard, {
      kind: 'resolve-opponent-hand-discard',
      playerId: 'player-one',
      cardIds: [nonFlip.instanceId],
    })).toThrow('具有 FLIP')
  })

  it('rejects an unavailable mode and resolves the source HP branch', () => {
    const initial = processEndPhaseEffects(endPhaseState(false))
    expect(() => applyGameCommand(initial, {
      kind: 'resolve-choose-one',
      playerId: 'player-one',
      modeIndex: 0,
    })).toThrow('目前無法執行')
    const chosen = applyGameCommand(initial, {
      kind: 'resolve-choose-one',
      playerId: 'player-one',
      modeIndex: 1,
    })
    const sourceId = chosen.pendingAbilityEffect!.sourceInstanceId
    const beforeHp = chosen.players['player-one'].battleArea[0]!.hpCards.length
    const resolved = applyGameCommand(chosen, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [sourceId],
    })
    expect(resolved.players['player-one'].battleArea[0]!.hpCards).toHaveLength(beforeHp - 1)
  })
})
