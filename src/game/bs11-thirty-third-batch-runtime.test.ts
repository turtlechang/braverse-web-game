import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { canActivateStage } from './card-abilities'
import { cookie, createBattleState, item } from './test-helpers/battle-helpers'
import type { CookieInBattle, GameCard, GameState } from './types'

const records = bs11CandidateDocument.cards as unknown as OfficialCardRecord[]

const candidate = (cardNumber: string, suffix: string): GameCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  const result = convertOfficialCardToGameCard(record, `bs11-thirty-third-runtime-${suffix}`)
  if (result.status !== 'converted') throw new Error(`${cardNumber}: ${result.reason}`)
  return { ...result.gameCard, instanceId: `${cardNumber}:${suffix}` }
}

const entry = (card: GameCard, hpCards: GameCard[]): CookieInBattle => ({
  card: card as CookieInBattle['card'],
  hpCards,
  rested: false,
  battleEntryId: `${card.instanceId}:battle`,
})

const specialPlayCookie = (): GameCard => ({
  ...cookie('bs11-108-special-cookie', 1, 1),
  name: 'Special Play Test Cookie',
  energyColor: 'black',
  skill: {
    trigger: 'activate',
    oncePerTurn: false,
    yourTurn: false,
    restSource: false,
    cost: { energy: {}, discardHand: 0 },
    text: 'Special Play test fixture',
    effects: [],
    specialPlayCost: {
      energy: {},
      discardHand: 0,
      trashBattleCookie: { count: 1, energyColor: 'black', level: 1 },
    },
  },
})

const makeStageState = (): {
  state: GameState
  stage: GameCard
  specialCookie: GameCard
  sacrifice: GameCard
  discardCard: GameCard
  drawCard: GameCard
  placementPayment: GameCard
} => {
  const base = createBattleState()
  const stage = candidate('BS11-108', 'stage')
  const specialCookieCard = specialPlayCookie()
  const sacrifice = { ...cookie('bs11-108-sacrifice', 1, 1), energyColor: 'black' as const }
  const discardCard = item('bs11-108-discard-card', 'red')
  const drawCard = item('bs11-108-draw-card', 'blue')
  const placementPayment = item('bs11-108-placement-payment', 'black')
  const attacker = base.players['player-two'].battleArea[0]
  if (!attacker) throw new Error('Expected the default attacker')

  return {
    state: {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          hand: [stage, specialCookieCard, discardCard],
          battleArea: [attacker, entry(sacrifice, [item('bs11-108-sacrifice-hp')])],
          supportArea: [{ card: placementPayment, rested: false }],
          deck: [item('bs11-108-special-cookie-hp'), drawCard, item('bs11-108-deck-reserve')],
          discardPile: [],
        },
      },
    },
    stage,
    specialCookie: specialCookieCard,
    sacrifice,
    discardCard,
    drawCard,
    placementPayment,
  }
}

describe('BS11-108 Dark Enchantress\'s Castle runtime', () => {
  it('requires Special Play history, then draws and chains into one hand discard', () => {
    const scenario = makeStageState()
    const placed = applyGameCommand(scenario.state, {
      kind: 'play-stage',
      playerId: 'player-two',
      instanceId: scenario.stage.instanceId,
      paymentIds: [scenario.placementPayment.instanceId],
    })

    expect(canActivateStage(placed, 'player-two')).toBe(false)
    expect(() => applyGameCommand(placed, {
      kind: 'begin-activate-stage',
      playerId: 'player-two',
      paymentIds: [],
      targetIds: [],
    })).toThrow('目前無法啟動場景卡')

    const specialPlayed = applyGameCommand(placed, {
      kind: 'deploy-cookie',
      playerId: 'player-two',
      instanceId: scenario.specialCookie.instanceId,
      specialPlayCookieInstanceIds: [scenario.sacrifice.instanceId],
    })
    const replacementResolved = applyGameCommand(specialPlayed, {
      kind: 'skip-replacement',
      playerId: 'player-two',
    })
    expect(replacementResolved.cookiesPlayedViaSpecialPlayThisTurn?.['player-two']).toBe(true)
    expect(replacementResolved.players['player-two'].battleArea)
      .toHaveLength(2)

    const activated = applyGameCommand(replacementResolved, {
      kind: 'begin-activate-stage',
      playerId: 'player-two',
      paymentIds: [],
      targetIds: [],
    })
    expect(activated.players['player-two'].stage?.rested).toBe(true)
    expect(activated.pendingDrawUpTo).toMatchObject({
      playerId: 'player-two',
      max: 1,
    })

    const drawn = applyGameCommand(activated, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-two',
      drawCount: 1,
    })
    expect(drawn.pendingOpponentHandDiscard).toMatchObject({
      playerId: 'player-two',
      count: 1,
      chainedFromDrawUpTo: true,
    })
    expect(drawn.players['player-two'].hand).toEqual(
      expect.arrayContaining([scenario.discardCard, scenario.drawCard]),
    )

    const resolved = applyGameCommand(drawn, {
      kind: 'resolve-opponent-hand-discard',
      playerId: 'player-two',
      cardIds: [scenario.discardCard.instanceId],
    })
    expect(resolved.pendingOpponentHandDiscard).toBeNull()
    expect(resolved.players['player-two'].hand).toEqual([scenario.drawCard])
    expect(resolved.players['player-two'].discardPile).toContainEqual(scenario.discardCard)
  })

  it('does not mark a normal Cookie deployment as Special Play', () => {
    const scenario = makeStageState()
    const placed = applyGameCommand(scenario.state, {
      kind: 'play-stage',
      playerId: 'player-two',
      instanceId: scenario.stage.instanceId,
      paymentIds: [scenario.placementPayment.instanceId],
    })
    const normalCookie = {
      ...cookie('bs11-108-normal-cookie', 1, 1),
      energyColor: 'black' as const,
    }
    const normalState: GameState = {
      ...placed,
      players: {
        ...placed.players,
        'player-two': {
          ...placed.players['player-two'],
          hand: [normalCookie],
          battleArea: [placed.players['player-two'].battleArea[0]!],
          deck: [item('bs11-108-normal-hp')],
        },
      },
    }

    const deployed = applyGameCommand(normalState, {
      kind: 'deploy-cookie',
      playerId: 'player-two',
      instanceId: normalCookie.instanceId,
    })
    expect(deployed.cookiesPlayedViaSpecialPlayThisTurn?.['player-two']).not.toBe(true)
    expect(canActivateStage(deployed, 'player-two')).toBe(false)
  })
})
