import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { cookie, createBattleState, item } from './test-helpers/battle-helpers'
import type { CookieCard, CookieInBattle, GameCard, GameState } from './types'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const candidate = (cardNumber: string): GameCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  const result = convertOfficialCardToGameCard(record, `bs11-thirty-seventh-${cardNumber}`)
  if (result.status !== 'converted') throw new Error(`${cardNumber}: ${result.reason}`)
  return { ...result.gameCard, instanceId: `${cardNumber}:item` }
}

const cookieEntry = (card: CookieCard, hpCards: GameCard[]): CookieInBattle => ({
  card,
  hpCards,
  rested: false,
  battleEntryId: `${card.instanceId}:battle`,
})

const makeScenario = (withActivationReturn = true): {
  state: GameState
  censer: GameCard
  activationPayment: GameCard
  activationReturn: GameCard
  replacementPayment: GameCard
  opponentSupport: GameCard
  onPlayCookie: CookieCard
} => {
  const base = createBattleState()
  const censer = candidate('BS11-047')
  const activationPayment = item('BS11-047:activation-payment', 'green')
  const activationReturn = item('BS11-047:activation-return', 'red')
  const replacementPayment = item('BS11-047:replacement-payment', 'blue')
  const opponentSupport = item('BS11-047:opponent-support', 'purple')
  const onPlayCookie: CookieCard = {
    ...cookie('BS11-047:on-play-cookie', 1, 1),
    skill: {
      trigger: 'on-play',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { energy: { red: 1 }, discardHand: 0 },
      text: '<{R}> Draw 1 card.',
      effects: [{ kind: 'draw', amount: 1 }],
    },
  }

  return {
    state: {
      ...base,
      activePlayerId: 'player-one',
      phase: 'main',
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [censer],
          supportArea: [
            { card: activationPayment, rested: false },
            ...(withActivationReturn ? [{ card: activationReturn, rested: false }] : []),
          ],
        },
        'player-two': {
          ...base.players['player-two'],
          hand: [],
          battleArea: [cookieEntry(onPlayCookie, [item('BS11-047:on-play-hp')])],
          supportArea: [
            { card: replacementPayment, rested: false },
            { card: opponentSupport, rested: false },
          ],
        },
      },
    },
    censer,
    activationPayment,
    activationReturn,
    replacementPayment,
    opponentSupport,
    onPlayCookie,
  }
}

describe('BS11-047 Dumpling Censer runtime', () => {
  it('pays G plus one support return, then charges 1N and returns the opponent support card', () => {
    const scenario = makeScenario()
    let current = applyGameCommand(scenario.state, {
      kind: 'begin-play-item',
      playerId: 'player-one',
      instanceId: scenario.censer.instanceId,
      paymentIds: [scenario.activationPayment.instanceId],
      supportToHandIds: [scenario.activationReturn.instanceId],
    })
    current = applyGameCommand(current, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })

    expect(current.onPlayReplacementUntilTurn?.['player-two']).toMatchObject({
      turn: current.turnNumber,
      cost: { energy: { neutral: 1 } },
      effects: [{ kind: 'support-to-hand', amount: 1 }],
    })
    expect(current.players['player-one'].hand).toEqual([scenario.activationReturn])
    expect(current.players['player-one'].supportArea).toEqual([{
      card: scenario.activationPayment,
      rested: true,
    }])

    current = {
      ...current,
      pendingOnPlay: {
        playerId: 'player-two',
        sourceInstanceId: scenario.onPlayCookie.instanceId,
        origin: 'hand',
      },
    }
    current = applyGameCommand(current, {
      kind: 'begin-activate-skill',
      playerId: 'player-two',
      sourceInstanceId: scenario.onPlayCookie.instanceId,
      trigger: 'on-play',
      paymentIds: [scenario.replacementPayment.instanceId],
    })
    expect(current.pendingOnPlay).toBeNull()
    expect(current.pendingAbilityEffect?.effects).toEqual([
      { kind: 'support-to-hand', amount: 1 },
    ])

    current = applyGameCommand(current, {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: [scenario.opponentSupport.instanceId],
    })

    expect(current.players['player-two'].hand).toEqual([scenario.opponentSupport])
    expect(current.players['player-two'].supportArea).toEqual([{
      card: scenario.replacementPayment,
      rested: true,
    }])
  })

  it('rejects activation when the support-to-hand cost has no selectable support card', () => {
    const scenario = makeScenario(false)
    expect(() => applyGameCommand(scenario.state, {
      kind: 'begin-play-item',
      playerId: 'player-one',
      instanceId: scenario.censer.instanceId,
      paymentIds: [scenario.activationPayment.instanceId],
      supportToHandIds: [],
    })).toThrow()
  })
})
