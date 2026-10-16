import { describe, expect, it } from 'vitest'
import { applyGameCommand } from '../commands'
import { getAllCardPoolEntries, getCardPoolEntry } from '../card-pool'
import { getLegalTurnCommands } from '../legal-actions'
import { createCard } from '../starter-deck'
import { declare, fixture, openThen, settle } from '../st8-005-demo'
import { zones } from '../st8-002-demo'
import { takeAiStep } from '../ai'

const resting = (state: ReturnType<typeof openThen>) => state.players['player-one'].supportArea
  .filter(support => support.rested).map(support => support.card.instanceId)

describe('AI support and damage attack groups', () => {
  it.each([3, 4, 5] as const)('Lv%i never treats the Cookie target as enough to deal support-count damage', level => {
    const state = openThen(), before = structuredClone(state), decision = takeAiStep(state, 'player-one', { level, searchNow: () => 0 })
    expect(decision.action).toBe('resolve-attack-effect')
    expect(decision.state.players['player-one'].supportArea[3].rested).toBe(true)
    expect(decision.state.players['player-one'].supportArea[4].rested).toBe(false)
    expect(state).toEqual(before)
  })
  it.each([3, 4, 5] as const)('Lv%i preserves supports when public effect immunity prevents all damage', level => {
    const state = openThen(), target = state.players['player-two'].battleArea[0].card.instanceId
    // Synthetic public immunity isolates AI logic; not physical-card acceptance.
    state.effectDamagePreventedUntilTurn = { [target]: state.turnNumber }
    const decision = takeAiStep(state, 'player-one', { level, searchNow: () => 0 })
    expect(decision.action).not.toBe('error')
    expect(resting(decision.state)).toEqual(resting(state))
  })
  it.each([3, 4, 5] as const)('Lv%i ignores unrevealed deck, hand and HP order when selecting supports', level => {
    const state = openThen(), changed = structuredClone(state)
    for (const player of Object.values(changed.players)) {
      player.deck.reverse()
      player.hand.reverse()
      for (const cookie of player.battleArea) cookie.hpCards.reverse()
    }
    const first = takeAiStep(state, 'player-one', { level, seed: 93, searchNow: () => 0 })
    const second = takeAiStep(changed, 'player-one', { level, seed: 93, searchNow: () => 0 })
    expect(first.action).not.toBe('error')
    expect(second.action).toBe(first.action)
    expect(resting(second.state)).toEqual(resting(first.state))
  })
  it.each(['three-supports', 'four-supports', 'positive'])('only selects currently active supports: %s', scenario => {
    const state = openThen(scenario), before = structuredClone(state)
    const decision = takeAiStep(state, 'player-one', { level: 5, searchNow: () => 0 })
    expect(decision.action).not.toBe('error')
    expect(resting(decision.state)).toHaveLength(scenario === 'three-supports' ? 3 : 4)
    expect(state).toEqual(before)
  })

  it.each([3, 4, 5] as const)('Lv%i preserves a legal follow-up Cookie attack when choosing supports', level => {
    let state = fixture('six-supports')
    const foe = state.players['player-two']
    const previousTarget = foe.battleArea[0]
    const usedIds = new Set([
      ...Object.values(state.players).flatMap(player => [
        ...player.deck, ...player.hand, ...player.supportArea.map(support => support.card),
        ...player.battleArea.map(cookie => cookie.card), ...player.breakArea, ...player.discardPile,
      ].map(card => card.id)),
    ])
    const targetRecord = getAllCardPoolEntries().find(card =>
      card.type === 'cookie' && card.hp === 6 && !usedIds.has(card.cardNumber),
    )
    if (!targetRecord) throw Error('Original 6-HP opponent Cookie required')
    const targetCard = createCard(targetRecord, 'player-two', 99)
    if (targetCard.type !== 'cookie') throw Error('Original opponent Cookie required')
    if (!foe.deck.pop()) throw Error('Original opponent deck card required')
    const targetHp = Array.from({ length: targetCard.hp }, () => {
      const index = foe.deck.findIndex(card => !card.flip)
      if (index < 0) throw Error('Original non-FLIP HP card required')
      return foe.deck.splice(index, 1)[0]
    })
    foe.deck.push(previousTarget.card, ...previousTarget.hpCards)
    foe.battleArea[0] = {
      card: targetCard,
      hpCards: targetHp,
      rested: false,
      battleEntryId: `${targetCard.instanceId}:entry`,
    }
    state = declare(state)
    state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
    for (let index = 0; index < 3; index++) {
      state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
    }

    const own = state.players['player-one']
    const activeSupportIndices = own.supportArea
      .map((support, index) => !support.rested ? index : -1)
      .filter(index => index >= 0)
    const desiredColors = ['green', 'red', 'red'] as const

    // Reorder actual cards from this physical 60-card fixture so the active
    // supports are G/R/R; no card identity, color, or printed text is changed.
    const desiredCards = desiredColors.map(color => {
      const index = own.deck.findIndex(card => card.energyColor === color)
      if (index < 0) throw Error(`Original ${color} support required`)
      return own.deck.splice(index, 1)[0]
    })
    activeSupportIndices.forEach((supportIndex, index) => {
      const previous = own.supportArea[supportIndex].card
      own.supportArea[supportIndex] = { card: desiredCards[index], rested: false }
      own.deck.push(previous)
    })

    // Replace one unused deck card with the official G-cost ST8-010 and give
    // it two real HP cards from the same 60-card fixture.
    const cookiemalsRecord = getCardPoolEntry('ST8-010')
    if (!cookiemalsRecord) throw Error('Original ST8-010 required')
    const cookiemalsCard = createCard(cookiemalsRecord, 'player-one', 99)
    if (cookiemalsCard.type !== 'cookie') throw Error('Original ST8-010 Cookie required')
    if (!own.deck.pop()) throw Error('Original player deck card required')
    const cookiemalsHp = own.deck.splice(0, cookiemalsCard.hp)
    const previousCookie = own.battleArea[1]
    own.battleArea[1] = {
      card: cookiemalsCard,
      hpCards: cookiemalsHp,
      rested: false,
      battleEntryId: `${cookiemalsCard.instanceId}:entry`,
    }
    own.deck.push(previousCookie.card, ...previousCookie.hpCards)

    const target = state.players['player-two'].battleArea[0]
    expect(target.hpCards).toHaveLength(3)
    expect(own.supportArea.filter(support => !support.rested).map(support => support.card.energyColor))
      .toEqual(desiredColors)
    for (const playerId of ['player-one', 'player-two'] as const) {
      const cards = zones(state, playerId)
      expect(cards).toHaveLength(60)
      expect(new Set(cards.map(card => card.instanceId)).size).toBe(60)
      for (const card of cards) expect(cards.filter(other => other.id === card.id).length).toBeLessThanOrEqual(4)
    }

    const decision = takeAiStep(state, 'player-one', { level, searchNow: () => 0 })
    expect(decision.action).toBe('resolve-attack-effect')
    expect(decision.state.players['player-one'].supportArea
      .filter((support, index) => activeSupportIndices.includes(index) && support.rested)
      .map(support => support.card.energyColor))
      .toEqual(['red', 'red'])

    const afterThen = settle(decision.state)
    const attack = getLegalTurnCommands(afterThen, 'player-one').find(command =>
      command.kind === 'attack' && command.attackerInstanceId === cookiemalsCard.instanceId &&
      command.targetInstanceId === target.card.instanceId)
    expect(attack?.kind).toBe('attack')
    if (!attack || attack.kind !== 'attack') throw Error('Legal Cookiemals follow-up attack required')
    expect(attack.supportPaymentIds).toHaveLength(1)
    expect(afterThen.players['player-one'].supportArea
      .find(support => attack.supportPaymentIds.includes(support.card.instanceId))?.card.energyColor)
      .toBe('green')

    const afterAttack = applyGameCommand(afterThen, attack)
    expect(afterAttack.players['player-two'].breakArea.some(card => card.instanceId === target.card.instanceId))
      .toBe(true)
  })
})
