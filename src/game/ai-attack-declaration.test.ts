import { describe, expect, it } from 'vitest'
import {
  applyGameCommand,
  beginAttack,
  commandFromLogEntry,
  createDemoGame,
  getAttackEnergyCost,
  getLegalTurnCommands,
  selectEnergyPayment,
  takeAiStep,
  type AttackCommand,
  type GameCard,
  type GameState,
  type SupportCard,
} from '.'
import {
  applyChosenTurnCommand,
  handleAiRandomTurnState,
} from './ai/random-turn-handler'
import { handleAiTurnState } from './ai/turn-handler'
import {
  handleAiEvaluatedTurnState,
  handleAiTwoPlyTurnState,
} from './ai/evaluated-turn-handler'
import type { AiTurnStrategy } from './ai/turn-handler'
import type { AiDecision } from './ai/types'

const support = (instanceId: string): SupportCard => ({
  card: {
    id: instanceId,
    instanceId,
    name: instanceId,
    type: 'item',
  },
  rested: false,
})

const itemCard = (instanceId: string): GameCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'item',
})

interface AttackableFixture {
  state: GameState
  attackCmd: AttackCommand
}

const buildAttackableState = (): AttackableFixture => {
  let state = createDemoGame(1)

  const attackerInst = state.players['player-two'].battleArea[0].card.instanceId
  const targetInst = state.players['player-one'].battleArea[0].card.instanceId

  const attacker = state.players['player-two'].battleArea[0]
  const energyCost = getAttackEnergyCost(attacker.card)
  const paymentIds = selectEnergyPayment(energyCost, [
    { card: itemCard('supp-1'), rested: false },
  ])
  const supports = paymentIds ?? ['supp-1']

  state = {
    ...state,
    activePlayerId: 'player-two' as const,
    phase: 'main' as const,
    turnNumber: 2,
    players: {
      ...state.players,
      'player-two': {
        ...state.players['player-two'],
        hand: [],
        battleArea: [attacker],
        supportArea: supports.map((id) => support(id)),
      },
    },
  }

  const attackCmd: AttackCommand = {
    kind: 'attack',
    playerId: 'player-two',
    attackerInstanceId: attackerInst,
    targetInstanceId: targetInst,
    supportPaymentIds: supports,
  }

  return { state, attackCmd }
}

const minimalStrategy: AiTurnStrategy = {
  chooseEffectTargets: () => [],
  resolveCardAbility: () => null,
  resolveSkill: () => null,
  chooseReplacement: () => undefined,
  chooseAttackTarget: (state, playerId) => {
    const opponentId = playerId === 'player-one' ? 'player-two' : 'player-one'
    return state.players[opponentId].battleArea[0]
  },
}

const expectAttackDeclared = (result: GameState) => {
  expect(result.pendingBattle, 'pendingBattle must exist after attack').toBeDefined()
  expect(result.pendingBattle!.stage).toBe('trap')
  const lastLog = result.commandLog?.at(-1)
  expect(lastLog?.commandKind).toBe('declare-attack')
}

const expectNoAttackKind = (result: GameState) => {
  const log = result.commandLog ?? []
  const attackKindEntries = log.filter((e) => e.commandKind === 'attack')
  expect(attackKindEntries.length).toBe(0)
}

// ============================================================================
// A) applyChosenTurnCommand attack → declare-attack + pendingBattle (trap)
// ============================================================================

describe('A) applyChosenTurnCommand', () => {
  it('records declare-attack and stops at pendingBattle (trap stage)', () => {
    const { state, attackCmd } = buildAttackableState()
    const result = applyChosenTurnCommand(state, attackCmd)
    expectAttackDeclared(result)
    expectNoAttackKind(result)
  })

  it('stops before auto-resolving battle unlike direct attackCookie', () => {
    const { state, attackCmd } = buildAttackableState()
    const declared = applyChosenTurnCommand(state, attackCmd)
    const resolved = applyGameCommand(state, attackCmd)

    expect(declared.pendingBattle).toBeDefined()
    expect(resolved.pendingBattle).toBeNull()
  })
})

// ============================================================================
// B) replay declare-attack still stops at pendingBattle
// ============================================================================

describe('B) replay declare-attack', () => {
  it('preserves pendingBattle when replayed via applyGameCommand', () => {
    const { state, attackCmd } = buildAttackableState()
    const declared = applyChosenTurnCommand(state, attackCmd)
    const logEntry = declared.commandLog!.at(-1)!
    const declareCmd = commandFromLogEntry(logEntry)

    expect(declareCmd.kind).toBe('declare-attack')
    expectAttackDeclared(applyGameCommand(state, declareCmd))
  })

  it('produces same battle shape as direct beginAttack', () => {
    const { state, attackCmd } = buildAttackableState()
    const viaBegin = beginAttack(
      state,
      attackCmd.attackerInstanceId,
      attackCmd.targetInstanceId,
      attackCmd.supportPaymentIds,
    )
    const logEntry = applyChosenTurnCommand(state, attackCmd).commandLog!.at(-1)!
    const replayed = applyGameCommand(state, commandFromLogEntry(logEntry))

    expect(replayed.pendingBattle?.attackerInstanceId).toBe(
      viaBegin.pendingBattle?.attackerInstanceId,
    )
    expect(replayed.pendingBattle?.targetInstanceId).toBe(
      viaBegin.pendingBattle?.targetInstanceId,
    )
    expect(replayed.pendingBattle?.stage).toBe(viaBegin.pendingBattle?.stage)
  })
})

// ============================================================================
// C) Lv.1 / Lv.2 / Lv.3 / Lv.4 attack decisions
//    all leave declare-attack log and stop response window
// ============================================================================

describe('C) Lv.1 attack (random handler)', () => {
  it('preserves pendingBattle and logs declare-attack when random picks attack', () => {
    const { state } = buildAttackableState()
    const commands = getLegalTurnCommands(state, 'player-two')
    const attackIdx = commands.findIndex((cmd) => cmd.kind === 'attack')
    expect(attackIdx).toBeGreaterThanOrEqual(0)

    const decision = handleAiRandomTurnState(
      state,
      'player-two',
      () => attackIdx / commands.length,
    )

    expect(decision.action).toBe('attack')
    expectAttackDeclared(decision.state)
    expectNoAttackKind(decision.state)
  })
})

describe('C) Lv.2 attack (scored handler)', () => {
  it('handleAiTurnState logs declare-attack and stops pendingBattle', () => {
    const { state } = buildAttackableState()
    const decision = handleAiTurnState(state, 'player-two', minimalStrategy)

    expect(decision.action).toBe('attack')
    expectAttackDeclared(decision.state)
    expectNoAttackKind(decision.state)
  })

  it('takeAiStep Lv.2 logs declare-attack and stops pendingBattle', () => {
    const { state } = buildAttackableState()
    const decision = takeAiStep(state, 'player-two')

    expect(decision.action).toBe('attack')
    expectAttackDeclared(decision.state)
    expectNoAttackKind(decision.state)
  })
})

describe('C) Lv.3 attack (evaluated handler)', () => {
  it('when attack chosen, logs declare-attack and stops pendingBattle', () => {
    const { state } = buildAttackableState()
    const decision = handleAiEvaluatedTurnState(
      state,
      'player-two',
      minimalStrategy,
    )

    if (decision.action === 'attack') {
      expectAttackDeclared(decision.state)
      expectNoAttackKind(decision.state)
    } else {
      expect(decision.state.pendingBattle).toBeNull()
    }
  })
})

describe('C) Lv.4 attack (two-ply handler)', () => {
  it('when attack chosen, logs declare-attack and stops pendingBattle', () => {
    const { state } = buildAttackableState()
    const decision = handleAiTwoPlyTurnState(
      state,
      'player-two',
      minimalStrategy,
    )

    if (decision.action === 'attack') {
      expectAttackDeclared(decision.state)
      expectNoAttackKind(decision.state)
    } else {
      expect(decision.state.pendingBattle).toBeNull()
    }
  })
})

// ============================================================================
// D) Lv.4 scoring path: no double-settlement, scores normally
// ============================================================================

describe('D) Lv.4 scoring', () => {
  it('does not double-settle — no attack-kind entries in commandLog', () => {
    const { state } = buildAttackableState()
    const commands = getLegalTurnCommands(state, 'player-two')
    const hasAttack = commands.some((cmd) => cmd.kind === 'attack')
    expect(hasAttack).toBe(true)

    const decision = handleAiTwoPlyTurnState(
      state,
      'player-two',
      minimalStrategy,
    )
    expect(decision.action).not.toBe('error')
    expect(decision.state).toBeDefined()
    expectNoAttackKind(decision.state)
  })
})

// ============================================================================
// cross-level: all levels use applyChosenTurnCommand for attack
// ============================================================================

describe('cross-level integrity', () => {
  it('Lv.1–Lv.4 all produce declare-attack through shared gate', () => {
    const { state } = buildAttackableState()

    const lv1 = (): AiDecision => {
      const commands = getLegalTurnCommands(state, 'player-two')
      const idx = commands.findIndex((cmd) => cmd.kind === 'attack')
      return handleAiRandomTurnState(state, 'player-two', () => idx / commands.length)
    }
    const lv2 = (): AiDecision =>
      handleAiTurnState(state, 'player-two', minimalStrategy)
    const lv3 = (): AiDecision =>
      handleAiEvaluatedTurnState(state, 'player-two', minimalStrategy)
    const lv4 = (): AiDecision =>
      handleAiTwoPlyTurnState(state, 'player-two', minimalStrategy)

    const results: [string, AiDecision][] = [
      ['Lv.1', lv1()],
      ['Lv.2', lv2()],
      ['Lv.3', lv3()],
      ['Lv.4', lv4()],
    ]

    for (const [label, decision] of results) {
      expect(decision.action, `${label} should not error`).not.toBe('error')
      if (decision.action === 'attack') {
        expectAttackDeclared(decision.state)
        expectNoAttackKind(decision.state)
      }
    }
  })
})
