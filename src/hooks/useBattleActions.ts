import { useCallback, useState } from 'react'
import {
  getAttackEnergyCost,
  validateEnergyPayment,
  type GameCommand,
  type GameState,
} from '../game'

export type RunGameAction = (
  action: (current: GameState) => GameState,
  successMessage: string,
  onSuccess?: (nextGame: GameState) => void,
) => void

/**
 * 統一分派層：本地模式下等價於 runAction((current) => applyGameCommand(current, command), ...)；
 * 線上模式改成把 command 送到伺服器，不在本地套用。
 */
export type DispatchGameCommand = (
  command: GameCommand | GameCommand[],
  successMessage: string,
  onSuccess?: (nextGame: GameState) => void,
) => void

interface UseBattleActionsParams {
  game: GameState
  dispatch: DispatchGameCommand
}

export function useBattleActions({ game, dispatch }: UseBattleActionsParams) {
  const [selectedAttackerId, setSelectedAttackerId] = useState<string | null>(
    null,
  )
  const [selectedAttackPaymentIds, setSelectedAttackPaymentIds] = useState<
    string[]
  >([])

  const activePlayer = game.players[game.activePlayerId]
  const selectedAttacker = activePlayer.battleArea.find(
    (cookie) => cookie.card.instanceId === selectedAttackerId,
  )
  const selectedAttackCost = selectedAttacker
    ? getAttackEnergyCost(selectedAttacker.card)
    : {}
  const attackPaymentValidation = selectedAttacker
    ? validateEnergyPayment(
        selectedAttackCost,
        activePlayer.supportArea,
        selectedAttackPaymentIds,
      )
    : { valid: false, reason: '尚未選擇攻擊餅乾。' }

  const clearAttacker = useCallback(() => {
    setSelectedAttackerId(null)
    setSelectedAttackPaymentIds([])
  }, [])

  const toggleAttackPayment = useCallback((instanceId: string) => {
    setSelectedAttackPaymentIds((current) =>
      current.includes(instanceId)
        ? current.filter((id) => id !== instanceId)
        : [...current, instanceId],
    )
  }, [])

  const handleAttackTarget = useCallback(
    (targetInstanceId: string) => {
      if (!selectedAttackerId || !attackPaymentValidation.valid) return

      const command: GameCommand = {
        kind: 'declare-attack',
        playerId: game.activePlayerId,
        attackerInstanceId: selectedAttackerId,
        targetInstanceId,
        supportPaymentIds: selectedAttackPaymentIds,
      }
      dispatch(
        command,
        `${selectedAttacker?.card.name ?? '餅乾'}已宣告攻擊。`,
        clearAttacker,
      )
    },
    [
      attackPaymentValidation.valid,
      clearAttacker,
      dispatch,
      game.activePlayerId,
      selectedAttacker,
      selectedAttackerId,
      selectedAttackPaymentIds,
    ],
  )

  return {
    selectedAttackerId,
    setSelectedAttackerId,
    selectedAttackPaymentIds,
    setSelectedAttackPaymentIds,
    selectedAttacker,
    selectedAttackCost,
    attackPaymentValidation,
    clearAttacker,
    toggleAttackPayment,
    handleAttackTarget,
  } as const
}
