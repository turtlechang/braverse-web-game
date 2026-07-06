import { useCallback, useState } from 'react'
import {
  applyGameCommand,
  getAttackEnergyCost,
  validateEnergyPayment,
  type GameState,
} from '../game'

export type RunGameAction = (
  action: (current: GameState) => GameState,
  successMessage: string,
  onSuccess?: (nextGame: GameState) => void,
) => void

interface UseBattleActionsParams {
  game: GameState
  runAction: RunGameAction
}

export function useBattleActions({ game, runAction }: UseBattleActionsParams) {
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

      runAction(
        (current) =>
          applyGameCommand(current, {
            kind: 'declare-attack',
            playerId: current.activePlayerId,
            attackerInstanceId: selectedAttackerId,
            targetInstanceId,
            supportPaymentIds: selectedAttackPaymentIds,
          }),
        `${selectedAttacker?.card.name ?? '餅乾'}已宣告攻擊。`,
        clearAttacker,
      )
    },
    [
      attackPaymentValidation.valid,
      clearAttacker,
      runAction,
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
