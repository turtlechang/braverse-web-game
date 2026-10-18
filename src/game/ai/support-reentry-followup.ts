import { applyGameCommand, getPendingDecision, type AttackCommand } from '../commands'
import { getStageActivationSource } from '../card-abilities'
import { getAttackDamageAgainst } from '../effects'
import { getCookieEffectiveLevel, getOpponentId } from '../helpers'
import { getLegalTurnCommands } from '../legal-actions'
import { maskGameStateForViewer } from '../masked-state'
import { hasBlockingPending } from '../pending'
import { commandFromLogEntry } from '../replay'
import { getActivatableSkillSources } from '../skills'
import type { AbilityCost, CardEffect, GameState, PlayerId } from '../types'
import { handleAiTurnState, type AiTurnStrategy } from './turn-handler'

export interface PublicSupportReentryOpportunity {
  parentState: GameState
  reentryState: GameState
  attacks: AttackCommand[]
}

const sameMainTurn = (state: GameState, before: GameState, owner: PlayerId): boolean =>
  state.status === 'playing' && state.phase === 'main' &&
  state.activePlayerId === owner && state.turnNumber === before.turnNumber

const energyOnly = (cost: AbilityCost): boolean => Object.entries(cost).every(
  ([key, value]) => ['energy', 'red', 'yellow', 'green', 'blue', 'purple', 'black', 'pure', 'neutral'].includes(key) ||
    value === undefined || value === 0 || value === false,
)

const hasThen = (effect: CardEffect): boolean =>
  'thenEffects' in effect && Boolean(effect.thenEffects?.length)

const pureReentry = (effects: readonly CardEffect[]): boolean =>
  effects.length === 1 && effects[0].kind === 'support-to-battle' &&
  !effects[0].thenEffects?.length

/** Resolve only legal own skips and a zero optional draw, never a battle response. */
const finishPublicSkips = (
  initial: GameState,
  before: GameState,
  owner: PlayerId,
  returningId: string,
): GameState | null => {
  let state = initial
  for (let step = 0; step < 8; step += 1) {
    if (!sameMainTurn(state, before, owner) || state.pendingEffectOrder) return null
    const pending = getPendingDecision(state)
    if (pending) {
      if (pending.kind !== 'draw-up-to' || pending.playerId !== owner) return null
      state = applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId: owner, drawCount: 0 })
      continue
    }
    if (!hasBlockingPending(state)) return state
    const ability = state.pendingAbilityEffect
    if (!state.pendingOnPlay && ability?.playerId === owner && ability.sourceKind === 'stage' &&
        !hasBlockingPending({ ...state, pendingAbilityEffect: undefined }) &&
        ability.effects.slice(ability.effectIndex).every(effect => effect.kind === 'draw-up-to' && !hasThen(effect))) {
      state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: owner, targetIds: [] })
      continue
    }
    const skip = getLegalTurnCommands(state, owner).find(command =>
      command.kind === 'skip-replacement' ||
      (command.kind === 'skip-on-play' && command.sourceInstanceId === returningId),
    )
    if (!skip) return null
    state = applyGameCommand(state, skip)
  }
  return null
}

const hasPublicFinishingAttack = (state: GameState, owner: PlayerId): boolean => {
  const foe = state.players[getOpponentId(owner)]
  const breakLevel = foe.breakArea.reduce((sum, card) => sum + card.level, 0)
  return getLegalTurnCommands(state, owner).some(command => {
    if (command.kind !== 'attack') return false
    const target = foe.battleArea.find(cookie => cookie.card.instanceId === command.targetInstanceId)
    return target !== undefined && breakLevel + getCookieEffectiveLevel(target) >= 10 &&
      getAttackDamageAgainst(state, command.attackerInstanceId, command.targetInstanceId) >= target.hpCards.length
  })
}

/**
 * A battle-to-support item can cross a replacement window before a second
 * ability makes its same rested Cookie attack again. Replay the real parent
 * command against the BEFORE mask: newly discarded HP must stay unknown.
 * This bounded forecast stops at legal attack declarations, not settlement.
 */
export const forecastPublicSupportReentry = (
  before: GameState,
  after: GameState,
  owner: PlayerId,
  strategy: AiTurnStrategy,
): PublicSupportReentryOpportunity[] => {
  if (!sameMainTurn(before, before, owner) || !sameMainTurn(after, before, owner) ||
      !after.pendingReplacement || hasBlockingPending(before) || before.pendingEffectOrder) return []
  const log = after.commandLog?.slice(before.commandLog?.length ?? 0) ?? []
  if (log.length !== 1) return []
  const command = commandFromLogEntry(log[0])
  if (command.kind !== 'play-item' || command.playerId !== owner) return []
  const item = before.players[owner].hand.find(card => card.instanceId === command.instanceId)?.item
  if (!item || !energyOnly(item.cost) || item.effects.length !== 1 ||
      item.effects[0].kind !== 'battle-to-support' || hasThen(item.effects[0])) return []
  const moved = before.players[owner].battleArea.filter(cookie => cookie.rested &&
    !after.players[owner].battleArea.some(next => next.card.instanceId === cookie.card.instanceId) &&
    after.players[owner].supportArea.some(support => support.card.instanceId === cookie.card.instanceId),
  )
  if (moved.length !== 1) return []
  const returningId = moved[0].card.instanceId
  const maskedBefore = maskGameStateForViewer({ ...before, commandLog: [] }, owner)
  if (hasPublicFinishingAttack(maskedBefore, owner)) return []
  try {
    const parentState = applyGameCommand(
      maskedBefore, command,
    )
    const ready = finishPublicSkips(parentState, before, owner, returningId)
    if (!ready) return []
    const knownHand = new Set(before.players[owner].hand.map(card => card.instanceId))
    const opportunities: PublicSupportReentryOpportunity[] = []
    const add = (initial: GameState) => {
      const reentryState = finishPublicSkips(initial, before, owner, returningId)
      if (!reentryState || reentryState.players[owner].hand.some(card => !knownHand.has(card.instanceId))) return
      const returned = reentryState.players[owner].battleArea.find(cookie => cookie.card.instanceId === returningId)
      if (!returned || returned.rested || returned.battleEntryId === moved[0].battleEntryId) return
      const attacks = getLegalTurnCommands(reentryState, owner).filter((action): action is AttackCommand =>
        action.kind === 'attack' && action.attackerInstanceId === returningId,
      )
      if (attacks.length) opportunities.push({ parentState, reentryState, attacks })
    }
    const sources = getActivatableSkillSources(ready.players[owner]).filter(source =>
      source.card.skill && energyOnly(source.card.skill.cost) && pureReentry(source.card.skill.effects),
    ).slice(0, 2)
    for (const source of sources) {
      const skill = source.card.skill
      if (!skill || !energyOnly(skill.cost) || !pureReentry(skill.effects)) continue
      const decision = strategy.resolveSkill(ready, owner, source, 'activate')
      if (decision?.action === 'activate-skill') add(decision.state)
    }
    const stage = getStageActivationSource(ready, owner)
    if (stage && energyOnly(stage.ability.cost) && stage.ability.effects.length <= 2 &&
        stage.ability.effects[0]?.kind === 'support-to-battle' &&
        stage.ability.effects.every(effect =>
          (effect.kind === 'draw-up-to' && !hasThen(effect)) ||
          (effect.kind === 'support-to-battle' &&
            (effect.thenEffects ?? []).every(next => next.kind === 'draw-up-to' && !hasThen(next))))) {
      const decision = handleAiTurnState(ready, owner, {
        ...strategy,
        chooseEffectTargets: (state, context, effect) => effect.kind === 'draw-up-to'
          ? [] : strategy.chooseEffectTargets(state, context, effect),
      })
      if (decision.action === 'activate-stage') add(decision.state)
    }
    return opportunities
  } catch {
    // Mandatory effects, unavailable payments, and unsupported pending paths
    // decline this forecast; the actual candidate remains rule-validated.
    return []
  }
}
