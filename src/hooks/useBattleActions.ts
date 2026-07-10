import { useCallback, useMemo, useState } from 'react'
import {
  getAttackEnergyCost,
  getEnergyCostTotal,
  validateEnergyPayment,
  type EnergyColor,
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

  const getRequiredColors = (cost: Record<string, number | undefined>): Set<EnergyColor | 'neutral'> =>
    new Set(
      (Object.keys(cost) as (EnergyColor | 'neutral')[]).filter(
        (k) => (cost[k] ?? 0) > 0,
      ),
    )

  const checkColorCompatible = (
    cardColor: EnergyColor | 'wild' | undefined,
    requiredColors: Set<EnergyColor | 'neutral'>,
  ): boolean => {
    if (!cardColor) return false
    if (cardColor === 'wild') return true
    if (requiredColors.size === 0) return false
    if (requiredColors.size === 1 && requiredColors.has('neutral')) return true
    return requiredColors.has(cardColor)
  }

  const attackPaymentTargetIds = useMemo(() => {
    if (!selectedAttackerId) return new Set<string>()
    const attacker = activePlayer.battleArea.find(
      (cookie) => cookie.card.instanceId === selectedAttackerId,
    )
    if (!attacker) return new Set<string>()
    const cost = getAttackEnergyCost(attacker.card)
    const totalCost = getEnergyCostTotal(cost)
    if (totalCost <= 0) return new Set<string>()
    const requiredColors = getRequiredColors(cost)
    return new Set(
      activePlayer.supportArea
        .filter((support) => {
          if (support.rested) return false
          if (selectedAttackPaymentIds.includes(support.card.instanceId)) return true
          if (selectedAttackPaymentIds.length >= totalCost) return false
          return checkColorCompatible(support.card.energyColor, requiredColors)
        })
        .map((support) => support.card.instanceId),
    )
  }, [selectedAttackerId, selectedAttackPaymentIds, activePlayer])

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

  const toggleAttackPayment = useCallback(
    (instanceId: string) => {
      setSelectedAttackPaymentIds((current) => {
        const isSelected = current.includes(instanceId)
        if (!isSelected) {
          const cost = selectedAttacker
            ? getAttackEnergyCost(selectedAttacker.card)
            : {}
          const totalCost = getEnergyCostTotal(cost)
          if (current.length >= totalCost) return current
          const requiredColors = getRequiredColors(cost)
          const supportCard = activePlayer.supportArea.find(
            (s) => s.card.instanceId === instanceId,
          )
          if (
            !supportCard ||
            !checkColorCompatible(supportCard.card.energyColor, requiredColors)
          )
            return current
        }
        return isSelected
          ? current.filter((id) => id !== instanceId)
          : [...current, instanceId]
      })
    },
    [selectedAttacker, activePlayer.supportArea],
  )

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
    attackPaymentTargetIds,
    attackPaymentValidation,
    clearAttacker,
    toggleAttackPayment,
    handleAttackTarget,
  } as const
}
