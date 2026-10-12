import { describe, expect, it } from 'vitest'
import { takeAiStep } from '../../ai'
import { applyGameCommand } from '../../commands'
import { createBattleState, cookie, item } from '../../test-helpers/battle-helpers'
import { getPublicEffectDamageByTarget } from '../public-effect-damage'

// Synthetic AI counterexamples, not physical-card acceptance evidence.
const fixture = (protection: 'reduction' | 'passive' | 'temporary') => {
  const state = createBattleState()
  state.activePlayerId = 'player-one'
  state.players['player-one'].hand = []
  state.players['player-one'].supportArea = []
  const source = state.players['player-one'].battleArea[0]
  source.card = { ...source.card, attack: 0, skill: {
    trigger: 'activate', oncePerTurn: true, restSource: false, yourTurn: true,
    text: 'AI regression', cost: { energy: {} },
    effects: [{ kind: 'damage', amount: 2, target: { side: 'opponent', min: 0, max: 1 } }],
  } }
  const protectedCard = { ...cookie('protected', 3, 1), level: 3 }
  state.players['player-two'].battleArea = [
    { card: protectedCard, hpCards: [item('protected-hp')], rested: false },
    { card: cookie('vulnerable', 1, 2), hpCards: [item('vulnerable-hp-a'), item('vulnerable-hp-b')], rested: false },
  ]
  if (protection === 'reduction') state.damageReceivedModifiers = [{ sourceInstanceId: 'protected',
    targetInstanceId: 'protected', amount: -2, damageType: 'effect', expiresAfterTurn: state.turnNumber }]
  if (protection === 'temporary') state.effectDamagePreventedUntilTurn = { protected: state.turnNumber }
  if (protection === 'passive') state.players['player-two'].battleArea[0].card.skill = {
    trigger: 'passive', oncePerTurn: false, yourTurn: false, restSource: false, cost: { energy: {} }, text: 'Public effect immunity',
    effects: [{ kind: 'prevent-effect-damage', duration: 'until-source-next-turn', target: { side: 'self', min: 1, max: 1, sourceOnly: true } }],
  }
  return state
}

describe('public target-specific effect damage decisions', () => {
  it('uses target-specific protection for a Then effect reached through a real normal attack', () => {
    let state = fixture('reduction')
    const source = state.players['player-one'].battleArea[0]
    source.card = { ...source.card, attack: 1, attackCost: 0, attackEnergyCost: {}, skill: undefined,
      attackEffects: [{ kind: 'damage', amount: 2, target: { side: 'opponent', min: 0, max: 1 } }] }
    state = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-one',
      attackerInstanceId: source.card.instanceId, targetInstanceId: 'vulnerable', supportPaymentIds: [] })
    state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
    state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
    expect(state.pendingBattle?.stage).toBe('attack-effect')
    const decision = takeAiStep(state, 'player-one', { level: 5, seed: 202610270, searchNow: () => 0 })
    expect(decision.state.players['player-two'].breakArea.map(card => card.instanceId)).toContain('vulnerable')
    expect(decision.state.players['player-two'].battleArea.find(c => c.card.instanceId === 'protected')?.hpCards).toHaveLength(1)
  })

  it('forecasts source aura bonuses and target reductions using the same rule as settlement', () => {
    const state = fixture('reduction')
    const source = state.players['player-one'].battleArea[0]
    state.players['player-one'].battleArea.push({ card: { ...cookie('aura'), skill: {
      trigger: 'passive', oncePerTurn: false, yourTurn: false, restSource: false, cost: { energy: {} }, text: 'Public bonus',
      effects: [{ kind: 'modify-all-effect-damage', amount: 1, duration: 'this-turn', side: 'self' }],
    } }, hpCards: [item('aura-hp')], rested: false })
    const effect = source.card.skill!.effects[0]
    const damage = getPublicEffectDamageByTarget(state, 'player-one', {
      sourcePlayerId: 'player-one', sourceInstanceId: source.card.instanceId,
    }, effect, ['protected', 'vulnerable'])
    expect([...damage!]).toEqual([['protected', 1], ['vulnerable', 3]])
    const result = applyGameCommand(state, { kind: 'activate-skill', playerId: 'player-one', trigger: 'activate',
      sourceInstanceId: source.card.instanceId, paymentIds: [], effectTargets: [['protected']] })
    expect(result.players['player-two'].breakArea.map(card => card.instanceId)).toContain('protected')
  })

  it('does not treat expired immunity as active protection', () => {
    const state = fixture('temporary')
    state.effectDamagePreventedUntilTurn = { protected: state.turnNumber - 1 }
    const decision = takeAiStep(state, 'player-one', { level: 5, seed: 202610270, searchNow: () => 0 })
    expect(decision.state.players['player-two'].breakArea.map(card => card.instanceId)).toContain('protected')
  })

  it.each([3, 4, 5] as const)('Lv.%i chooses real lethal over public zero damage', level => {
    const state = fixture('reduction'), before = structuredClone(state)
    const correct = applyGameCommand(state, { kind: 'activate-skill', playerId: 'player-one', trigger: 'activate',
      sourceInstanceId: 'defender', paymentIds: [], effectTargets: [['vulnerable']] })
    expect(correct.players['player-two'].breakArea.map(card => card.instanceId)).toContain('vulnerable')
    const decision = takeAiStep(state, 'player-one', { level, seed: 202610270, searchNow: () => 0 })
    expect(decision.action).toBe('activate-skill')
    expect(decision.state.players['player-two'].breakArea.map(card => card.instanceId)).toContain('vulnerable')
    expect(decision.state.players['player-two'].battleArea.find(c => c.card.instanceId === 'protected')?.hpCards).toHaveLength(1)
    expect(state).toEqual(before)
  })

  it.each(['passive', 'temporary'] as const)('avoids %s effect immunity', protection => {
    const state = fixture(protection)
    const decision = takeAiStep(state, 'player-one', { level: 5, seed: 202610270, searchNow: () => 0 })
    expect(decision.state.players['player-two'].breakArea.map(card => card.instanceId)).toContain('vulnerable')
  })

  it('does not change the chosen target when unrevealed HP, hands and deck faces are replaced', () => {
    const state = fixture('reduction'), hiddenChanged = structuredClone(state)
    for (const player of Object.values(hiddenChanged.players)) {
      player.deck = player.deck.map((_, i) => cookie(`${player.id}-unknown-deck-${i}`, 99, 99))
      for (const recipient of player.battleArea) recipient.hpCards = recipient.hpCards.map((_, i) =>
        cookie(`${recipient.card.instanceId}-unknown-hp-${i}`, 99, 99))
    }
    hiddenChanged.players['player-two'].hand = hiddenChanged.players['player-two'].hand.map((_, i) =>
      cookie(`opponent-unknown-hand-${i}`, 99, 99))
    const choose = (input: typeof state) => takeAiStep(input, 'player-one', { level: 5, seed: 202610270, searchNow: () => 0 })
      .state.commandLog?.slice().reverse().find(entry => entry.commandKind === 'activate-skill')?.payload.effectTargets
    expect(choose(state)).toEqual([['vulnerable']])
    expect(choose(hiddenChanged)).toEqual(choose(state))
  })
})
