import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState } from './demo'
import { isEffectConditionMet } from './effects'
import { selectEnergyPayment } from './energy'
import type { CardEffect, GameState } from './types'

const breakEntryCondition: CardEffect = {
  kind: 'draw-up-to',
  max: 1,
  condition: { kind: 'cookie-played-from-break-this-turn' },
}
const conditionMet = (state: GameState) => isEffectConditionMet(state, {
  sourcePlayerId: 'player-one',
  sourceInstanceId: state.players['player-one'].battleArea[0].card.instanceId,
}, breakEntryCondition)

const enterGoldenCheeseFromBreak = () => {
  const fixture = createCardCheckDemoState('BS3-025')
  const player = fixture.players['player-one']
  const source = player.battleArea[0].card
  const prepared: GameState = {
    ...fixture,
    players: {
      ...fixture.players,
      'player-one': {
        ...player,
        battleArea: player.battleArea.slice(1),
        breakArea: [source],
        extraDeck: createCardCheckDemoState('BS8-027').players['player-one'].extraDeck,
      },
    },
  }
  const paymentIds = selectEnergyPayment(source.skill!.cost.energy ?? {}, player.supportArea)
  if (!paymentIds) throw new Error('Golden Cheese fixture needs its printed yellow payment')
  return applyGameCommand(prepared, {
    kind: 'activate-skill',
    playerId: 'player-one',
    sourceInstanceId: source.instanceId,
    trigger: 'activate',
    paymentIds,
  })
}

describe('Break entry event history', () => {
  it('records break-source-to-battle through the real Golden Cheese skill command', () => {
    const entered = enterGoldenCheeseFromBreak()
    const source = entered.players['player-one'].battleArea.find((entry) => entry.card.id === 'BS3-025')!
    expect(source.hpCards).toHaveLength(1)
    expect(source.enteredFrom).toBe('break')
    expect(entered.cookiesPlayedFromBreakThisTurn).toEqual({ 'player-one': true })
    expect(conditionMet(entered)).toBe(true)
  })

  it('keeps the event after an EXTRA awakening replaces the Break-origin entity', () => {
    const entered = enterGoldenCheeseFromBreak()
    const awakened = applyGameCommand(entered, {
      kind: 'play-extra-deck-cookie',
      playerId: 'player-one',
      instanceId: entered.players['player-one'].extraDeck![0].instanceId,
    })
    expect(awakened.players['player-one'].battleArea.some((entry) => entry.enteredFrom === 'break')).toBe(false)
    expect(awakened.players['player-one'].battleArea.find((entry) => entry.card.id === 'BS8-027')?.hpCards).toHaveLength(3)
    expect(awakened.cookiesPlayedFromBreakThisTurn?.['player-one']).toBe(true)
    expect(conditionMet(awakened)).toBe(true)
  })

  it('clears the event at the next turn even while the original Break entrant remains', () => {
    const entered = enterGoldenCheeseFromBreak()
    const end = applyGameCommand(entered, { kind: 'advance-phase', playerId: 'player-one' })
    const nextTurn = applyGameCommand(end, { kind: 'advance-phase', playerId: 'player-one' })
    expect(nextTurn.turnNumber).toBe(entered.turnNumber + 1)
    expect(nextTurn.cookiesPlayedFromBreakThisTurn).toEqual({})
    expect(nextTurn.players['player-one'].battleArea.some((entry) => entry.enteredFrom === 'break')).toBe(true)
    expect(conditionMet(nextTurn)).toBe(false)
  })

  it('does not record an entry when Shelly pays its hand cost but chooses zero Cookies to play', () => {
    const fixture = createCardCheckDemoState('BS8-039')
    const player = fixture.players['player-one']
    const source = player.battleArea.find((entry) => entry.card.id === 'BS8-039')!.card
    const costCard = player.hand.find((card) => card.type === 'cookie' && card.level === 2)!
    expect(fixture.cookiesPlayedFromBreakThisTurn?.['player-one']).not.toBe(true)
    const resolved = applyGameCommand(fixture, {
      kind: 'activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.instanceId,
      trigger: 'activate',
      paymentIds: [],
      handToBreakAreaIds: [costCard.instanceId],
      effectTargets: [[]],
    })
    expect(resolved.players['player-one'].breakArea.some((card) => card.instanceId === costCard.instanceId)).toBe(true)
    expect(resolved.players['player-one'].battleArea).toHaveLength(player.battleArea.length)
    expect(resolved.cookiesPlayedFromBreakThisTurn?.['player-one']).not.toBe(true)
    expect(conditionMet(resolved)).toBe(false)
  })
})
