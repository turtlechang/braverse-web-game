import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { createBattleState, item } from './test-helpers/battle-helpers'
import type { GameCard, GameState } from './types'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const candidate = (cardNumber: string, instanceId: string): GameCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  const result = convertOfficialCardToGameCard(record, instanceId)
  if (result.status !== 'converted') throw new Error(`${cardNumber}: ${result.reason}`)
  return result.gameCard
}

const reachFlipWindow = (
  cardNumber: string,
  instanceId: string,
  hand: GameCard[],
  deck: GameCard[],
): { state: GameState; flip: GameCard } => {
  const base = createBattleState()
  const flip = candidate(cardNumber, instanceId)
  const state: GameState = {
    ...base,
    players: {
      ...base.players,
      'player-one': {
        ...base.players['player-one'],
        hand,
        deck,
        battleArea: [{
          ...base.players['player-one'].battleArea[0]!,
          hpCards: [flip],
        }],
      },
      'player-two': {
        ...base.players['player-two'],
        battleArea: [{
          ...base.players['player-two'].battleArea[0]!,
          card: {
            ...base.players['player-two'].battleArea[0]!.card,
            attack: 1,
          },
        }],
      },
    },
  }

  let current = applyGameCommand(state, {
    kind: 'declare-attack',
    playerId: 'player-two',
    attackerInstanceId: 'attacker',
    targetInstanceId: 'defender',
    supportPaymentIds: ['p2-support'],
  })
  current = applyGameCommand(current, { kind: 'skip-trap', playerId: 'player-one' })
  current = applyGameCommand(current, { kind: 'resolve-next-damage', playerId: 'player-one' })
  expect(current.pendingBattle?.stage).toBe('flip')
  return { state: current, flip }
}

describe('BS11-093／096／101 attached HP FLIP runtime', () => {
  it.each(['BS11-093', 'BS11-096', 'BS11-101'] as const)(
    '%s pays one hand card and restores one HP to the attached Cookie',
    (cardNumber) => {
      const discardCard = item(`${cardNumber}:discard`)
      const drawHp = item(`${cardNumber}:deck-hp`)
      const { state, flip } = reachFlipWindow(
        cardNumber,
        `${cardNumber}:flip`,
        [discardCard],
        [drawHp, item(`${cardNumber}:deck-pad`)],
      )

      const resolved = applyGameCommand(state, {
        kind: 'resolve-flip',
        playerId: 'player-one',
        activate: true,
        discardHandIds: [discardCard.instanceId],
      })
      expect(resolved.pendingBattle).toBeNull()
      expect(resolved.players['player-one'].battleArea[0]?.hpCards).toEqual([drawHp])
      expect(resolved.players['player-one'].discardPile).toEqual(
        expect.arrayContaining([discardCard, flip]),
      )
    },
  )

  it('rejects the attached HP FLIP when the discard cost is not paid', () => {
    const { state } = reachFlipWindow(
      'BS11-093',
      'BS11-093:missing-payment',
      [],
      [item('BS11-093:deck-hp')],
    )

    expect(() => applyGameCommand(state, {
      kind: 'resolve-flip',
      playerId: 'player-one',
      activate: true,
      discardHandIds: [],
    })).toThrow()
  })
})

describe('BS11-100 Agar Agar Cookie FLIP runtime', () => {
  it('opens the explicit draw-up-to choice and resolves one draw', () => {
    const drawCard = item('BS11-100:draw')
    const { state, flip } = reachFlipWindow(
      'BS11-100',
      'BS11-100:flip',
      [item('BS11-100:hand')],
      [drawCard, item('BS11-100:deck-extra')],
    )

    let resolved = applyGameCommand(state, {
      kind: 'resolve-flip',
      playerId: 'player-one',
      activate: true,
    })
    expect(resolved.pendingDrawUpTo).toMatchObject({ playerId: 'player-one', max: 1 })

    resolved = applyGameCommand(resolved, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-one',
      drawCount: 1,
    })
    expect(resolved.pendingDrawUpTo).toBeNull()
    expect(resolved.players['player-one'].hand).toContainEqual(drawCard)
    expect(resolved.players['player-one'].discardPile).toContainEqual(flip)
  })
})
