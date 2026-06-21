import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameState } from '../game'

export function useMatchAnimations() {
  const [attackShakeId, setAttackShakeId] = useState<string | null>(null)
  const [damageFlashId, setDamageFlashId] = useState<string | null>(null)
  const [faintAnimIds, setFaintAnimIds] = useState<Set<string>>(new Set())
  const [drawAnimIds, setDrawAnimIds] = useState<Set<string>>(new Set())
  const timersRef = useRef<Set<number>>(new Set())

  const schedule = useCallback((callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      timersRef.current.delete(timer)
      callback()
    }, delay)
    timersRef.current.add(timer)
  }, [])

  const clearTimers = useCallback(() => {
    for (const timer of timersRef.current) {
      window.clearTimeout(timer)
    }
    timersRef.current.clear()
  }, [])

  const observeTransition = useCallback(
    (previous: GameState, next: GameState) => {
      if (
        (!previous.pendingBattle && next.pendingBattle) ||
        (previous.pendingBattle &&
          next.pendingBattle &&
          previous.pendingBattle.stage !== 'damage' &&
          next.pendingBattle.stage === 'damage')
      ) {
        setAttackShakeId(next.pendingBattle.attackerInstanceId)
        schedule(() => setAttackShakeId(null), 500)
      }

      if (
        previous.pendingBattle &&
        next.pendingBattle &&
        previous.pendingBattle.remainingDamage >
          next.pendingBattle.remainingDamage
      ) {
        const targetId =
          next.pendingBattle.damageTargetInstanceId ??
          next.pendingBattle.targetInstanceId
        setDamageFlashId(targetId)
        schedule(() => setDamageFlashId(null), 600)
      }

      const previousBattleIds = new Set(
        Object.values(previous.players).flatMap((player) =>
          player.battleArea.map((cookie) => cookie.card.instanceId),
        ),
      )
      const nextBattleIds = new Set(
        Object.values(next.players).flatMap((player) =>
          player.battleArea.map((cookie) => cookie.card.instanceId),
        ),
      )
      const faintedIds = [...previousBattleIds].filter(
        (id) => !nextBattleIds.has(id),
      )
      if (faintedIds.length > 0) {
        setFaintAnimIds(new Set(faintedIds))
        schedule(() => setFaintAnimIds(new Set()), 800)
      }

      for (const playerId of ['player-one', 'player-two'] as const) {
        const previousHand = previous.players[playerId].hand
        const nextHand = next.players[playerId].hand
        if (nextHand.length <= previousHand.length) continue

        const newIds = nextHand
          .filter(
            (card) =>
              !previousHand.some(
                (previousCard) =>
                  previousCard.instanceId === card.instanceId,
              ),
          )
          .map((card) => card.instanceId)
        if (newIds.length > 0) {
          setDrawAnimIds(new Set(newIds))
          schedule(() => setDrawAnimIds(new Set()), 700)
        }
      }
    },
    [schedule],
  )

  const resetAnimations = useCallback(() => {
    clearTimers()
    setAttackShakeId(null)
    setDamageFlashId(null)
    setFaintAnimIds(new Set())
    setDrawAnimIds(new Set())
  }, [clearTimers])

  useEffect(() => clearTimers, [clearTimers])

  return {
    attackShakeId,
    damageFlashId,
    faintAnimIds,
    drawAnimIds,
    observeTransition,
    resetAnimations,
  } as const
}
