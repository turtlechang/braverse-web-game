import { describe, expect, it } from 'vitest'
import { applyGameCommand, type AttackCommand } from '../commands'
import { getAttackDamageAgainst } from '../effects'
import { getLegalTurnCommands } from '../legal-actions'
import { takeAiStep } from '../ai'
import { createBattleState, cookie, item } from '../test-helpers/battle-helpers'
import type { AbilityCost, CardEffect, GameState } from '../types'
import { forecastPublicAttackAftereffectValue } from './optional-attack-aftereffect'

const damageThen = (
  cost: AbilityCost = { hpToTrash: { amount: 1, sourceOnly: true } },
  maxRemainingHp?: number,
): CardEffect => ({
  kind: 'optional-cost-attack',
  cost,
  effectText: 'Pay the printed cost to deal 2 damage.',
  effects: [{
    kind: 'damage',
    amount: 2,
    target: {
      side: 'opponent',
      min: 1,
      max: 1,
      attackTargetOnly: true,
      ...(maxRemainingHp === undefined ? {} : { maxRemainingHp }),
    },
  }],
})

const scenario = (
  targetHp: number,
  sourceHp: number,
  cost?: AbilityCost,
  options: { maxTargetRemainingHp?: number; sourceHpAuraThreshold?: number } = {},
): { state: GameState; declaredState: GameState; command: AttackCommand } => {
  const state = createBattleState()
  const sourceId = 'aftereffect-source'
  const targetId = 'aftereffect-target'
  state.activePlayerId = 'player-one'
  state.firstPlayerId = 'player-one'
  state.players['player-one'].hand = []
  state.players['player-one'].supportArea = []
  state.players['player-one'].battleArea = [{
    card: {
      ...cookie(sourceId, 1, 6),
      level: 3,
      attackCost: 0,
      attackEnergyCost: {},
      attackEffects: [damageThen(cost, options.maxTargetRemainingHp)],
      ...(options.sourceHpAuraThreshold === undefined ? {} : {
        skill: {
          trigger: 'passive' as const,
          oncePerTurn: false,
          yourTurn: false,
          restSource: false,
          cost: { energy: {} },
          text: 'Increase this Cookie effect damage at low HP.',
          effects: [{
            kind: 'modify-all-effect-damage' as const,
            amount: 1,
            duration: 'this-turn' as const,
            side: 'self' as const,
            condition: { kind: 'source-hp-at-most' as const, amount: options.sourceHpAuraThreshold },
          }],
        },
      }),
    },
    hpCards: Array.from({ length: sourceHp }, (_, index) => item(`${sourceId}-hp-${index}`)),
    rested: false,
    battleEntryId: `${sourceId}:battle:1`,
  }]
  state.players['player-two'].battleArea = [{
    card: { ...cookie(targetId, 1, targetHp), level: 2 },
    hpCards: Array.from({ length: targetHp }, (_, index) => item(`${targetId}-hp-${index}`)),
    rested: false,
    battleEntryId: `${targetId}:battle:1`,
  }]

  const command: AttackCommand = {
    kind: 'attack',
    playerId: 'player-one',
    attackerInstanceId: sourceId,
    targetInstanceId: targetId,
    supportPaymentIds: [],
  }
  const declaredState = applyGameCommand(state, {
    kind: 'declare-attack',
    playerId: command.playerId,
    attackerInstanceId: command.attackerInstanceId,
    targetInstanceId: command.targetInstanceId,
    supportPaymentIds: command.supportPaymentIds,
  })
  return { state, declaredState, command }
}

const value = (
  targetHp: number,
  sourceHp = 6,
  cost?: AbilityCost,
  options: { maxTargetRemainingHp?: number; sourceHpAuraThreshold?: number } = {},
): number => {
  const result = scenario(targetHp, sourceHp, cost, options)
  return forecastPublicAttackAftereffectValue(
    result.state,
    result.declaredState,
    result.command,
  )
}

describe('public optional attack Then value', () => {
  it('distinguishes a conditional knockout from damage that cannot finish the target', () => {
    expect(value(3)).toBeGreaterThan(value(4))
    expect(value(4)).toBe(value(6))
  })

  it('charges the public HP cost and omits a line whose source would leave battle', () => {
    expect(value(3, 6)).toBeGreaterThan(value(3, 3))
    expect(value(3, 1)).toBe(0)
  })

  it('does not forecast extra energy costs outside the first-version model', () => {
    expect(value(3, 6, { energy: { red: 1 } })).toBe(0)
  })

  it('fails closed for unsupported effect and HP-cost shapes', () => {
    const multiEffect = scenario(3, 6)
    const attackEffect = multiEffect.state.players['player-one'].battleArea[0]!.card.attackEffects![0]!
    if (attackEffect.kind !== 'optional-cost-attack') throw new Error('Expected optional attack effect')
    const unsupportedEffect = {
      ...attackEffect,
      effects: [...attackEffect.effects, { kind: 'draw-up-to' as const, max: 1 }],
    }
    multiEffect.state.players['player-one'].battleArea[0]!.card.attackEffects = [unsupportedEffect]
    multiEffect.declaredState.pendingBattle!.attackEffects = [unsupportedEffect]
    expect(forecastPublicAttackAftereffectValue(
      multiEffect.state,
      multiEffect.declaredState,
      multiEffect.command,
    )).toBe(0)

    expect(value(3, 6, { hpToTrash: { amount: 1, sourceOnly: true, untilRemainingHp: 3 } })).toBe(0)
  })

  it('uses target HP after normal attack damage and source HP after cost for public thresholds', () => {
    expect(value(4, 6, undefined, { maxTargetRemainingHp: 3 })).toBeGreaterThan(0)
    expect(value(4, 5, undefined, { sourceHpAuraThreshold: 4 })).toBeGreaterThan(
      value(4, 6),
    )
  })

  it('recalculates normal attack damage after support payment rests the support', () => {
    const result = scenario(4, 6)
    const source = result.state.players['player-one'].battleArea[0]!
    const support = item('aftereffect-support', 'red')
    source.card.attackCost = 1
    source.card.attackEnergyCost = { red: 1 }
    source.card.skill = {
      trigger: 'passive',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { energy: {} },
      text: 'This Cookie gets +2 attack while you have an active support.',
      effects: [{
        kind: 'modify-attack',
        amount: 2,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'active-support-count-at-least', count: 1 },
      }],
    }
    result.state.players['player-one'].supportArea = [{ card: support, rested: false }]
    result.command.supportPaymentIds = [support.instanceId]

    const declaredState = applyGameCommand(result.state, {
      kind: 'declare-attack',
      playerId: result.command.playerId,
      attackerInstanceId: result.command.attackerInstanceId,
      targetInstanceId: result.command.targetInstanceId,
      supportPaymentIds: result.command.supportPaymentIds,
    })

    expect(declaredState.pendingBattle?.declaredDamage).toBe(3)
    expect(getAttackDamageAgainst(
      declaredState,
      result.command.attackerInstanceId,
      result.command.targetInstanceId,
    )).toBe(1)
    expect(forecastPublicAttackAftereffectValue(
      result.state,
      declaredState,
      result.command,
    )).toBe(10)
  })

  it('does not project normal damage again after the trap window has ended', () => {
    const result = scenario(3, 6)
    result.declaredState.pendingBattle!.stage = 'damage'
    expect(forecastPublicAttackAftereffectValue(
      result.state,
      result.declaredState,
      result.command,
    )).toBe(0)
  })

  it('does not award a Then knockout when normal attack damage removed its only legal target', () => {
    expect(value(1)).toBe(0)
  })

  it('omits an attack Then blocked by public same-battle level prevention', () => {
    const result = scenario(3, 6)
    const skill = {
      trigger: 'passive' as const,
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { energy: {} },
      text: 'Prevent opposing level-three attack effects.',
      effects: [],
      battleOpponentAttackEffectPrevention: { level: 3 },
    }
    result.state.players['player-two'].battleArea[0]!.card.skill = skill
    result.declaredState.players['player-two'].battleArea[0]!.card.skill = skill
    expect(forecastPublicAttackAftereffectValue(
      result.state,
      result.declaredState,
      result.command,
    )).toBe(0)
  })

  it('keeps the conditional Then value attributable in the selected Lv5 root score', () => {
    const result = scenario(3, 6)
    const decision = takeAiStep(result.state, 'player-one', {
      level: 5,
      seed: 202610170,
      searchNow: () => 0,
    })
    expect(decision.action).toBe('attack')
    expect(decision.reason?.actionScore?.contributions).toContainEqual(
      expect.objectContaining({
        id: 'conditional-attack-aftereffect',
        amount: value(3),
      }),
    )
  })

  it('spends its last red energy on a public knockout instead of a one-damage Activate skill', () => {
    const result = scenario(3, 6)
    const source = result.state.players['player-one'].battleArea[0]!
    source.card.attackCost = 2
    source.card.attackEnergyCost = { red: 2 }
    source.card.skill = {
      trigger: 'activate',
      oncePerTurn: true,
      yourTurn: true,
      restSource: false,
      cost: { energy: { red: 1 } },
      text: 'Pay one red energy to deal 1 damage.',
      effects: [{
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 1, max: 1 },
      }],
    }
    result.state.players['player-one'].supportArea = [
      { card: item('aftereffect-energy-a', 'red'), rested: false },
      { card: item('aftereffect-energy-b', 'red'), rested: false },
    ]

    const decision = takeAiStep(result.state, 'player-one', {
      level: 5,
      seed: 202610171,
      searchNow: () => 0,
    })

    expect(decision.action).toBe('attack')
    expect(decision.state.commandLog?.at(-1)?.payload).toMatchObject({
      kind: 'declare-attack',
      attackerInstanceId: source.card.instanceId,
      targetInstanceId: 'aftereffect-target',
      supportPaymentIds: ['aftereffect-energy-a', 'aftereffect-energy-b'],
    })
    expect(decision.reason?.actionScore?.contributions).toContainEqual(
      expect.objectContaining({
        id: 'conditional-attack-aftereffect',
        amount: value(3),
      }),
    )
  })

  it('uses an Activate skill before an attack when the skill leaves that attack payable', () => {
    const result = scenario(3, 6)
    const source = result.state.players['player-one'].battleArea[0]!
    source.card.attackCost = 2
    source.card.attackEnergyCost = { red: 2 }
    source.card.skill = {
      trigger: 'activate',
      oncePerTurn: true,
      yourTurn: true,
      restSource: false,
      cost: { energy: { red: 1 } },
      text: 'Pay one red energy to deal 1 damage.',
      effects: [{
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 1, max: 1 },
      }],
    }
    result.state.players['player-one'].supportArea = [
      { card: item('aftereffect-sequence-energy-a', 'red'), rested: false },
      { card: item('aftereffect-sequence-energy-b', 'red'), rested: false },
      { card: item('aftereffect-sequence-energy-c', 'red'), rested: false },
    ]

    const decision = takeAiStep(result.state, 'player-one', {
      level: 5,
      seed: 202610172,
      searchNow: () => 0,
    })

    expect(decision.action).toBe('activate-skill')
    expect(decision.state.players['player-one'].battleArea[0]?.rested).toBe(false)
    expect(decision.state.players['player-one'].supportArea.filter(support => !support.rested)).toHaveLength(2)
    expect(getLegalTurnCommands(decision.state, 'player-one').some(command =>
      command.kind === 'attack' && command.attackerInstanceId === source.card.instanceId,
    )).toBe(true)
  })

  it('uses public effect damage prevention and ignores hidden hand, HP, and deck faces', () => {
    const original = scenario(3, 6)
    const hiddenChanged = scenario(3, 6)
    hiddenChanged.state.players['player-two'].hand = [cookie('unknown-hand', 99, 99)]
    hiddenChanged.state.players['player-two'].deck = [cookie('unknown-deck', 99, 99)]
    hiddenChanged.state.players['player-two'].battleArea[0]!.hpCards = [
      item('unknown-hp-a'), item('unknown-hp-b'), item('unknown-hp-c'),
    ]
    hiddenChanged.declaredState.players['player-two'].hand = [cookie('other-unknown-hand', 98, 98)]
    hiddenChanged.declaredState.players['player-two'].deck = [cookie('other-unknown-deck', 98, 98)]
    hiddenChanged.declaredState.players['player-two'].battleArea[0]!.hpCards = [
      item('different-unknown-hp-a'), item('different-unknown-hp-b'), item('different-unknown-hp-c'),
    ]
    const beforeValue = forecastPublicAttackAftereffectValue(
      original.state,
      original.declaredState,
      original.command,
    )
    const beforeState = structuredClone(original.state)
    const beforeDeclaration = structuredClone(original.declaredState)
    const hiddenValue = forecastPublicAttackAftereffectValue(
      hiddenChanged.state,
      hiddenChanged.declaredState,
      hiddenChanged.command,
    )
    expect(hiddenValue).toBe(beforeValue)
    expect(original.state).toEqual(beforeState)
    expect(original.declaredState).toEqual(beforeDeclaration)

    const protectedAttack = scenario(3, 6)
    protectedAttack.state.damageReceivedModifiers = [{
      sourceInstanceId: 'aftereffect-target',
      targetInstanceId: 'aftereffect-target',
      amount: -2,
      damageType: 'effect',
      expiresAfterTurn: protectedAttack.state.turnNumber,
    }]
    protectedAttack.declaredState.damageReceivedModifiers =
      protectedAttack.state.damageReceivedModifiers
    expect(forecastPublicAttackAftereffectValue(
      protectedAttack.state,
      protectedAttack.declaredState,
      protectedAttack.command,
    )).toBe(0)
  })
})
