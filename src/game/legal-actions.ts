import { getPendingDecision } from './commands'
import type { PlayerActionCommand } from './commands'
import { canPlayStage } from './card-abilities'
import { getAttackEnergyCostForState, selectEnergyPayment } from './energy'
import { getOpponentId } from './helpers'
import { getRefreshCandidates } from './refresh'
import {
  getCurrentReplacementTask,
  getReplacementCandidates,
} from './replacement'
import { canAttack } from './turn'
import type { GameState, PlayerId } from './types'

/**
 * 枚舉指定玩家目前可執行且保證合法的動作指令。
 *
 * 涵蓋：Refresh、補位／略過、略過 OnPlay、支援放置、餅乾登場、
 * 場景放置、攻擊（含自動計算的能量支付）與階段推進。
 * 不涵蓋：待處理決策（走 PendingDecisionCommand）、戰鬥回應
 * （陷阱／FLIP 等，由 battle handler 處理），以及需要目標選擇的
 * 技能／物品／場景啟動。
 */
export const getLegalTurnCommands = (
  state: GameState,
  playerId: PlayerId,
): PlayerActionCommand[] => {
  if (state.status !== 'playing') return []
  if (getPendingDecision(state)) return []

  if (state.pendingRefresh) {
    if (state.pendingRefresh.playerId !== playerId) return []
    return getRefreshCandidates(state, playerId).map((candidate) => ({
      kind: 'refresh-deck',
      playerId,
      cookieInstanceId: candidate.instanceId,
    }))
  }

  if (state.pendingOnPlay) {
    if (state.pendingOnPlay.playerId !== playerId) return []
    return [
      {
        kind: 'skip-on-play',
        playerId,
        sourceInstanceId: state.pendingOnPlay.sourceInstanceId,
      },
    ]
  }

  const replacementTask = getCurrentReplacementTask(state)
  if (replacementTask) {
    if (replacementTask.playerId !== playerId) return []
    return [
      ...getReplacementCandidates(state, playerId).map((card) => ({
        kind: 'replace-cookie' as const,
        playerId,
        instanceId: card.instanceId,
      })),
      { kind: 'skip-replacement', playerId },
    ]
  }

  if (state.pendingBattle) return []
  if (state.pendingAbilityEffect) return []
  if (state.activePlayerId !== playerId) return []

  const commands: PlayerActionCommand[] = []
  const player = state.players[playerId]

  if (state.phase === 'support' && !state.supportPlacedThisTurn) {
    for (const card of player.hand) {
      commands.push({
        kind: 'place-support',
        playerId,
        instanceId: card.instanceId,
      })
    }
  }

  if (state.phase === 'main') {
    if (player.battleArea.length < 2) {
      for (const card of player.hand) {
        if (card.type === 'cookie') {
          commands.push({
            kind: 'deploy-cookie',
            playerId,
            instanceId: card.instanceId,
          })
        }
      }
    }

    for (const card of player.hand) {
      if (
        card.type === 'stage' &&
        card.stageAbility &&
        canPlayStage(state, playerId, card.instanceId)
      ) {
        const paymentIds = selectEnergyPayment(
          card.stageAbility.placementCost,
          player.supportArea,
        )
        if (paymentIds) {
          commands.push({
            kind: 'play-stage',
            playerId,
            instanceId: card.instanceId,
            paymentIds,
          })
        }
      }
    }

    if (canAttack(state)) {
      const opponent = state.players[getOpponentId(playerId)]
      for (const attacker of player.battleArea) {
        if (attacker.rested || attacker.card.nonAttackable) continue
        if (
          state.attackDisabledUntilTurn?.[attacker.card.instanceId] ===
          state.turnNumber
        ) {
          continue
        }
        const paymentIds = selectEnergyPayment(
          getAttackEnergyCostForState(state, attacker.card.instanceId),
          player.supportArea,
        )
        if (!paymentIds) continue
        for (const target of opponent.battleArea) {
          commands.push({
            kind: 'attack',
            playerId,
            attackerInstanceId: attacker.card.instanceId,
            targetInstanceId: target.card.instanceId,
            supportPaymentIds: paymentIds,
          })
        }
      }
    }
  }

  commands.push({ kind: 'advance-phase', playerId })
  return commands
}
