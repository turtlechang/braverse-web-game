import { describe, expect, it } from 'vitest'
import bs9Candidates from '../../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState, createCardNegativeDemoState } from './demo'
import { getDiscardHandCostCandidates } from './skills'
import type { GameCard, GameState } from './types'

const records = bs9Candidates.cards as unknown as OfficialCardRecord[]

const candidate = (cardNumber: string): GameCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing ${cardNumber} candidate`)
  const conversion = convertOfficialCardToGameCard(record, `${cardNumber}-test`)
  if (conversion.status !== 'converted') throw new Error(conversion.reason)
  return conversion.gameCard
}

const handCard = (state: GameState, cardNumber: string) => {
  const card = state.players['player-one'].hand.find((entry) => entry.id === cardNumber)
  if (!card) throw new Error(`Missing ${cardNumber} in hand`)
  return card
}

describe('BS9-042 through BS9-045 candidate effects', () => {
  it('preserves every printed cost, target, filter, condition, and Then order in the adapter', () => {
    expect(candidate('BS9-042')).toMatchObject({
      type: 'cookie',
      flip: { cost: { energy: {}, discardHand: 1 }, effects: [], attachedHpBonus: 1 },
    })
    expect(candidate('BS9-043')).toMatchObject({
      type: 'item',
      item: {
        cost: { yellow: 1 },
        effects: [{
          kind: 'equipped-to-hp', side: 'opponent', max: 1, keyword: 'soul-jam', faceUp: true,
          condition: { kind: 'break-level-at-least', level: 4 },
        }],
      },
    })
    expect(candidate('BS9-044')).toMatchObject({
      type: 'item',
      item: {
        cost: { energy: { yellow: 1 }, discardHand: 1 },
        effects: [{
          kind: 'trash-to-hand', max: 3, energyColor: 'yellow', cookieOnly: true, hasFlip: true,
        }],
      },
    })
    expect(candidate('BS9-045')).toMatchObject({
      type: 'trap',
      trap: {
        cost: {
          energy: { yellow: 1 }, discardHand: 2, discardHandType: 'cookie', discardHandHasFlip: true,
        },
        effects: [
          { kind: 'modify-attack', amount: -2, duration: 'this-turn', target: { side: 'opponent', min: 0, max: 1 } },
          { kind: 'draw-up-to', max: 2 },
        ],
      },
    })
  })

  it('BS9-042 pays a hand card before the attached Cookie gains exactly one HP', () => {
    const initial = createCardCheckDemoState('BS9-042')
    const defender = initial.players['player-one'].battleArea[0]!
    const deckBefore = initial.players['player-one'].deck.length
    const discard = initial.players['player-one'].hand[0]!

    const resolved = applyGameCommand(initial, {
      kind: 'resolve-flip', playerId: 'player-one', activate: true,
      discardHandIds: [discard.instanceId],
    })
    const defenderAfter = resolved.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === defender.card.instanceId,
    )!
    expect(defenderAfter.hpCards).toHaveLength(defender.hpCards.length + 1)
    expect(resolved.players['player-one'].deck).toHaveLength(deckBefore - 1)
    expect(resolved.players['player-one'].discardPile).toContainEqual(discard)
    expect(() => applyGameCommand(createCardNegativeDemoState('BS9-042'), {
      kind: 'resolve-flip', playerId: 'player-one', activate: true, discardHandIds: [],
    })).toThrow(/discard|棄置|代價/i)
  })

  it('BS9-043 moves only an opponent equipped Soul Jam to its host HP face-up after the LV.4 break check', () => {
    const initial = createCardCheckDemoState('BS9-043')
    const item = handCard(initial, 'BS9-043')
    const payment = initial.players['player-one'].supportArea[0]!.card.instanceId
    const host = initial.players['player-two'].battleArea[0]!
    const soulJam = host.equippedCards?.[0]
    if (!soulJam) throw new Error('Missing equipped Soul Jam')

    let state = applyGameCommand(initial, {
      kind: 'begin-play-item', playerId: 'player-one', instanceId: item.instanceId,
      paymentIds: [payment],
    })
    expect(state.pendingAbilityEffect).toMatchObject({ playerId: 'player-one' })
    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [soulJam.instanceId],
    })
    const hostAfter = state.players['player-two'].battleArea.find(
      (entry) => entry.card.instanceId === host.card.instanceId,
    )!
    expect(hostAfter.equippedCards).toEqual([])
    expect(hostAfter.hpCards.at(-1)).toEqual(soulJam)
    expect(hostAfter.faceUpHpCardInstanceIds).toContain(soulJam.instanceId)

    const blocked = createCardNegativeDemoState('BS9-043')
    const blockedItem = handCard(blocked, 'BS9-043')
    const blockedPayment = blocked.players['player-one'].supportArea[0]!.card.instanceId
    const blockedSoulJam = blocked.players['player-two'].battleArea[0]!.equippedCards?.[0]
    if (!blockedSoulJam) throw new Error('Missing negative-fixture equipped Soul Jam')
    const paid = applyGameCommand(blocked, {
      kind: 'begin-play-item', playerId: 'player-one', instanceId: blockedItem.instanceId,
      paymentIds: [blockedPayment],
    })
    expect(paid.pendingAbilityEffect).toBeUndefined()
    expect(paid.players['player-two'].battleArea[0]!.equippedCards).toContainEqual(blockedSoulJam)
  })

  it('BS9-044 pays first, returns only yellow FLIP Cookies, and rejects an ineligible trash card', () => {
    const initial = createCardCheckDemoState('BS9-044')
    const item = handCard(initial, 'BS9-044')
    const payment = initial.players['player-one'].supportArea[0]!.card.instanceId
    const discard = initial.players['player-one'].hand.find((card) => card.id !== item.id)!
    const [eligibleA, eligibleB, ineligible] = initial.players['player-one'].discardPile
    let state = applyGameCommand(initial, {
      kind: 'begin-play-item', playerId: 'player-one', instanceId: item.instanceId,
      paymentIds: [payment], discardHandIds: [discard.instanceId],
    })
    expect(() => applyGameCommand(state, {
      kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [ineligible!.instanceId],
    })).toThrow(/合法範圍/)
    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect', playerId: 'player-one',
      targetIds: [eligibleB!.instanceId, eligibleA!.instanceId],
    })
    expect(state.players['player-one'].hand).toEqual(expect.arrayContaining([eligibleA, eligibleB]))
    expect(state.players['player-one'].discardPile).toContainEqual(ineligible)
  })

  it('BS9-045 requires two FLIP Cookies before the optional attack reduction and Then draw', () => {
    const initial = createCardCheckDemoState('BS9-045')
    const trap = handCard(initial, 'BS9-045')
    const payment = initial.players['player-one'].supportArea[0]!.card.instanceId
    const flipCosts = initial.players['player-one'].hand.filter((card) => card.flip).map((card) => card.instanceId)
    expect(getDiscardHandCostCandidates(
      trap.trap!.cost,
      initial.players['player-one'].hand,
      trap.instanceId,
    ).map((card) => card.instanceId)).toEqual(flipCosts)
    const attacker = initial.players['player-two'].battleArea[0]!
    const played = applyGameCommand(initial, {
      kind: 'play-trap', playerId: 'player-one', trapInstanceId: trap.instanceId,
      paymentIds: [payment], discardHandIds: flipCosts, targetIds: [attacker.card.instanceId],
    })
    expect(played.attackModifiers).toContainEqual(expect.objectContaining({
      targetInstanceId: attacker.card.instanceId, amount: -2,
    }))
    expect(played.pendingDrawUpTo).toMatchObject({ max: 2 })
    expect(() => applyGameCommand(createCardNegativeDemoState('BS9-045'), {
      kind: 'play-trap', playerId: 'player-one', trapInstanceId: 'bs9-bs9-045-source',
      paymentIds: ['bs9-bs9-045-yellow-support'], discardHandIds: [], targetIds: [],
    })).toThrow(/invalid trap payment|discard|FLIP|棄置|代價/i)
  })
})
