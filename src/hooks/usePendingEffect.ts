import { useCallback, useEffect, useState } from 'react'
import type {
  CardAbility,
  GameCard,
  GameState,
  PlayerId,
  SkillTrigger,
} from '../game'
import {
  activateCookieSkill,
  activateStage,
  canActivateCookieSkill,
  executeCardEffect,
  finalizePendingReplacements,
  getBreakToTrashCandidates,
  getEffectTargetCandidates,
  getSupportEffectCandidates,
  getTrashCookieCandidates,
  isEffectConditionMet,
  isEffectUntargeted,
  playItem,
  resolveAttackEffect,
  skipCookieOnPlay,
} from '../game'
import { describeEffectResult } from '../components/effects/effectUiUtils'
import type { PendingEffect } from '../components/effects/effectUiTypes'

interface HpPileInfo {
  title: string
  cards: GameCard[]
}

export function usePendingEffect(params: {
  game: GameState
  setGame: (value: GameState | ((prev: GameState) => GameState)) => void
  viewerPlayerId: PlayerId
  setMessage: (value: string) => void
  clearAttacker: () => void
  setInspectedHpPile: (info: HpPileInfo) => void
  hasFaint: boolean
  faintTargetIds: Set<string>
  selectedFaintTargetIds: string[]
  faintMinMax: { min: number; max: number }
  setSelectedFaintTargetIds: React.Dispatch<React.SetStateAction<string[]>>
}) {
  const {
    game,
    setGame,
    viewerPlayerId,
    setMessage,
    clearAttacker,
    setInspectedHpPile,
    hasFaint,
    faintTargetIds,
    selectedFaintTargetIds,
    faintMinMax,
    setSelectedFaintTargetIds,
  } = params

  const [pendingEffect, setPendingEffect] =
    useState<PendingEffect | null>(null)
  const [suspendedEffect, setSuspendedEffect] =
    useState<PendingEffect | null>(null)
  const [effectHistory, setEffectHistory] = useState<string[]>([])

  const faintActive = hasFaint && !pendingEffect

  const currentEffect =
    pendingEffect?.effects[pendingEffect.effectIndex] ?? null
  const currentTargetSelector =
    currentEffect?.kind === 'gain-hp'
      ? currentEffect.target?.sourceOnly
        ? null
        : currentEffect.target ?? null
      : currentEffect && !isEffectUntargeted(currentEffect)
        ? currentEffect.kind === 'break-to-trash' ||
          currentEffect.kind === 'support-to-trash' ||
          currentEffect.kind === 'support-to-hand' ||
          currentEffect.kind === 'trash-to-battle'
          ? null
          : currentEffect.target
        : null

  const effectTargetCandidates =
    pendingEffect &&
    currentEffect &&
    currentTargetSelector
      ? getEffectTargetCandidates(
          game,
          pendingEffect.context,
          currentTargetSelector,
        )
      : []

  const supportEffectCandidates =
    pendingEffect &&
    currentEffect &&
    (currentEffect.kind === 'support-to-trash' ||
      currentEffect.kind === 'support-to-hand')
      ? getSupportEffectCandidates(game, pendingEffect.context)
      : []

  const trashCookieCandidates =
    pendingEffect && currentEffect?.kind === 'trash-to-battle'
      ? getTrashCookieCandidates(game, pendingEffect.context)
      : []

  const nonBattleEffectCandidateCards = [
    ...supportEffectCandidates.map((support) => support.card),
    ...trashCookieCandidates,
  ]

  const breakToTrashCandidates =
    pendingEffect && currentEffect?.kind === 'break-to-trash'
      ? getBreakToTrashCandidates(
          game,
          pendingEffect.context,
          currentEffect,
        )
      : []

  const effectTargetIds = faintActive
    ? faintTargetIds
    : new Set(
        effectTargetCandidates.map((cookie) => cookie.card.instanceId),
      )

  const breakEffectTargetIds = faintActive
    ? new Set<string>()
    : new Set(breakToTrashCandidates.map((card) => card.instanceId))

  const selectedEffectTargetIds = faintActive
    ? new Set(selectedFaintTargetIds)
    : new Set(pendingEffect?.selectedTargetIds ?? [])

  const selectedSkillPaymentIds = new Set(
    pendingEffect?.selectedPaymentIds ?? [],
  )

  useEffect(() => {
    if (pendingEffect || effectHistory.length === 0) return

    const timer = window.setTimeout(() => setEffectHistory([]), 1000)
    return () => window.clearTimeout(timer)
  }, [effectHistory, pendingEffect])

  useEffect(() => {
    if (
      !suspendedEffect ||
      pendingEffect ||
      game.status !== 'playing'
    ) {
      return
    }

    const viewerBlocks =
      (game.pendingRefresh?.playerId === viewerPlayerId) ||
      (game.pendingOnPlay?.playerId === viewerPlayerId)
    if (viewerBlocks) return

    const timer = window.setTimeout(() => {
      setPendingEffect(suspendedEffect)
      setSuspendedEffect(null)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [
    suspendedEffect,
    pendingEffect,
    game.pendingRefresh,
    game.pendingOnPlay,
    game.status,
    viewerPlayerId,
  ])

  const beginCookieSkill = useCallback(
    (
      nextGame: GameState,
      card: GameCard | undefined,
      playerId: PlayerId,
      trigger: SkillTrigger,
      triggerLabel: string,
      optional = false,
    ) => {
    if (
      !card?.skill ||
      card.skill.trigger !== trigger ||
      nextGame.status !== 'playing'
    ) {
      return
    }

    const context = {
      sourcePlayerId: playerId,
      sourceInstanceId: card.instanceId,
    }
    const availableEffects = card.skill.effects.filter((effect) =>
      isEffectConditionMet(nextGame, context, effect),
    )

    if (availableEffects.length === 0) {
      if (trigger === 'on-play' && nextGame.pendingOnPlay) {
        setGame(
          skipCookieOnPlay(nextGame, playerId, card.instanceId),
        )
      }
      setMessage(`${card.name}的效果尚未滿足發動條件。`)
      return
    }

    if (
      !canActivateCookieSkill(
        nextGame,
        playerId,
        card.instanceId,
        trigger,
      )
    ) {
      if (trigger === 'on-play' && nextGame.pendingOnPlay) {
        setGame(
          skipCookieOnPlay(nextGame, playerId, card.instanceId),
        )
      }
      setMessage(`${card.name}目前無法支付或發動技能。`)
      return
    }

    clearAttacker()
    setPendingEffect({
      sourceCard: card,
      context,
      skill: card.skill,
      trigger,
      effects: availableEffects,
      effectIndex: 0,
      selectedTargetIds: [],
      selectedPaymentIds: [],
      skillActivated: false,
      optional,
      triggerLabel,
      sourceKind: 'cookie',
    })
    setMessage(`${card.name}的技能等待支付能量並選擇目標。`)
    },
    [setGame, setMessage, clearAttacker, setPendingEffect],
  )

  const beginCardAbility = (
    card: GameCard,
    ability: CardAbility,
    sourceKind: 'item' | 'stage',
    triggerLabel: string,
  ) => {
    const context = {
      sourcePlayerId: viewerPlayerId,
      sourceInstanceId: card.instanceId,
    }
    const effects = ability.effects.filter((effect) =>
      isEffectConditionMet(game, context, effect),
    )
    if (effects.length === 0) {
      setMessage(`${card.name}目前未滿足使用條件。`)
      return
    }
    setPendingEffect({
      sourceCard: card,
      context,
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: true,
        restSource: sourceKind === 'stage',
        cost: ability.cost,
        text: ability.text,
        effects,
      },
      trigger: 'activate',
      effects,
      effectIndex: 0,
      selectedTargetIds: [],
      selectedPaymentIds: [],
      skillActivated: false,
      optional: false,
      triggerLabel,
      sourceKind,
    })
    clearAttacker()
    setMessage(`${card.name}等待支付能量並選擇目標。`)
  }

  useEffect(() => {
    const battle = game.pendingBattle
    if (
      !battle ||
      battle.stage !== 'attack-effect' ||
      battle.attackerPlayerId !== viewerPlayerId ||
      pendingEffect ||
      faintActive
    ) {
      return
    }

    const sourceCard = game.players[viewerPlayerId].battleArea.find(
      (cookie) => cookie.card.instanceId === battle.attackerInstanceId,
    )?.card
    const currentAttackEffect =
      battle.attackEffects[battle.attackEffectIndex]
    if (!sourceCard || !currentAttackEffect) return

    const timer = window.setTimeout(() => {
      setPendingEffect({
        sourceCard,
        context: {
          sourcePlayerId: viewerPlayerId,
          sourceInstanceId: battle.attackerInstanceId,
        },
        skill: {
          trigger: 'activate',
          oncePerTurn: false,
          yourTurn: true,
          restSource: false,
          cost: {},
          text: sourceCard.attackText ?? '',
          effects: battle.attackEffects,
        },
        trigger: 'activate',
        effects: battle.attackEffects,
        effectIndex: battle.attackEffectIndex,
        selectedTargetIds: [],
        selectedPaymentIds: [],
        skillActivated: true,
        optional: false,
        triggerLabel: '攻擊後續效果',
        sourceKind: 'attack',
      })
      setMessage(`${sourceCard.name}等待選擇攻擊後續效果目標。`)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [
    game,
    viewerPlayerId,
    pendingEffect,
    faintActive,
    setMessage,
  ])

  useEffect(() => {
    if (
      !game.pendingOnPlay ||
      game.pendingOnPlay.playerId !== viewerPlayerId ||
      pendingEffect ||
      faintActive ||
      game.pendingOpponentHandDiscard
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      const card = game.players[viewerPlayerId].battleArea.find(
        (cookie) =>
          cookie.card.instanceId === game.pendingOnPlay?.sourceInstanceId,
      )?.card
      if (card) {
        beginCookieSkill(
          game,
          card,
          viewerPlayerId,
          'on-play',
          'OnPlay 登場觸發',
          true,
        )
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [
    game.pendingOnPlay,
    game.pendingOpponentHandDiscard,
    pendingEffect,
    faintActive,
    viewerPlayerId,
    game,
    beginCookieSkill,
  ])

  const toggleEffectTarget = (instanceId: string) => {
    if (faintActive) {
      if (!effectTargetIds.has(instanceId)) return
      setSelectedFaintTargetIds((current) =>
        current.includes(instanceId)
          ? current.filter((id) => id !== instanceId)
          : current.length < faintMinMax.max
            ? [...current, instanceId]
            : current,
      )
      return
    }

    if (
      !pendingEffect ||
      !currentEffect ||
      (!effectTargetIds.has(instanceId) &&
        !breakEffectTargetIds.has(instanceId))
    ) {
      return
    }

    const max =
      currentEffect.kind === 'break-to-trash'
        ? currentEffect.max
        : currentEffect.kind === 'support-to-trash' ||
            currentEffect.kind === 'support-to-hand' ||
            currentEffect.kind === 'trash-to-battle'
          ? currentEffect.amount
        : isEffectUntargeted(currentEffect)
          ? currentEffect.kind === 'gain-hp'
            ? currentEffect.target?.max ?? 0
            : 0
          : currentEffect.target.max

    const isSelected = pendingEffect.selectedTargetIds.includes(instanceId)
    const selectedTargetIds = isSelected
      ? pendingEffect.selectedTargetIds.filter((id) => id !== instanceId)
      : pendingEffect.selectedTargetIds.length < max
        ? [...pendingEffect.selectedTargetIds, instanceId]
        : pendingEffect.selectedTargetIds

    setPendingEffect({ ...pendingEffect, selectedTargetIds })
  }

  const toggleSkillPayment = (instanceId: string) => {
    if (!pendingEffect || pendingEffect.skillActivated) return

    const isSelected =
      pendingEffect.selectedPaymentIds.includes(instanceId)
    const selectedPaymentIds = isSelected
      ? pendingEffect.selectedPaymentIds.filter((id) => id !== instanceId)
      : [...pendingEffect.selectedPaymentIds, instanceId]

    setPendingEffect({ ...pendingEffect, selectedPaymentIds })
  }

  const skipOptionalSkill = () => {
    if (
      pendingEffect &&
      currentEffect &&
      'optional' in currentEffect &&
      currentEffect.optional
    ) {
      const nextEffectIndex = pendingEffect.effectIndex + 1
      const hasNextEffect =
        nextEffectIndex < pendingEffect.effects.length
      const viewerMustAct =
        (game.pendingRefresh?.playerId === viewerPlayerId) ||
        (game.pendingOnPlay?.playerId === viewerPlayerId)

      if (hasNextEffect && viewerMustAct) {
        setPendingEffect(null)
        setSuspendedEffect({
          ...pendingEffect,
          effectIndex: nextEffectIndex,
          selectedTargetIds: [],
          skillActivated: true,
        })
        setMessage('已略過可選效果。')
        return
      }

      setPendingEffect(
        hasNextEffect
          ? {
              ...pendingEffect,
              effectIndex: nextEffectIndex,
              selectedTargetIds: [],
              skillActivated: true,
            }
          : null,
      )
      setMessage('已略過可選效果。')
      return
    }

    if (!pendingEffect?.optional) return

    setGame(
      skipCookieOnPlay(
        game,
        pendingEffect.context.sourcePlayerId,
        pendingEffect.sourceCard.instanceId,
      ),
    )
    setMessage(`${pendingEffect.sourceCard.name}的 OnPlay 技能未發動。`)
    setPendingEffect(null)
  }

  const confirmEffect = () => {
    if (!pendingEffect || !currentEffect) return

    const targetNames =
      currentEffect.kind === 'break-to-trash'
        ? pendingEffect.selectedTargetIds.map(
            (instanceId) =>
              breakToTrashCandidates.find(
                (card) => card.instanceId === instanceId,
              )?.name ?? instanceId,
          )
        : currentEffect.kind === 'support-to-trash' ||
            currentEffect.kind === 'support-to-hand'
          ? pendingEffect.selectedTargetIds.map(
              (instanceId) =>
                supportEffectCandidates.find(
                  (support) => support.card.instanceId === instanceId,
                )?.card.name ?? instanceId,
            )
          : currentEffect.kind === 'trash-to-battle'
            ? pendingEffect.selectedTargetIds.map(
                (instanceId) =>
                  trashCookieCandidates.find(
                    (card) => card.instanceId === instanceId,
                  )?.name ?? instanceId,
              )
        : pendingEffect.selectedTargetIds.map(
            (instanceId) =>
              effectTargetCandidates.find(
                (cookie) => cookie.card.instanceId === instanceId,
              )?.card.name ?? instanceId,
          )

    try {
      if (pendingEffect.sourceKind === 'attack') {
        const nextGame = resolveAttackEffect(
          game,
          pendingEffect.context.sourcePlayerId,
          pendingEffect.selectedTargetIds,
        )
        const result = describeEffectResult(currentEffect, targetNames)
        setGame(nextGame)
        setMessage(result)
        setEffectHistory((history) => [result, ...history].slice(0, 4))
        setPendingEffect(null)
        return
      }

      const activatedGame = pendingEffect.skillActivated
        ? game
        : pendingEffect.sourceKind === 'item'
          ? playItem(
              game,
              pendingEffect.context.sourcePlayerId,
              pendingEffect.sourceCard.instanceId,
              pendingEffect.selectedPaymentIds,
            )
          : pendingEffect.sourceKind === 'stage'
            ? activateStage(
                game,
                pendingEffect.context.sourcePlayerId,
                pendingEffect.selectedPaymentIds,
              )
            : activateCookieSkill(
                game,
                pendingEffect.context.sourcePlayerId,
                pendingEffect.sourceCard.instanceId,
                pendingEffect.trigger,
                pendingEffect.selectedPaymentIds,
              )
      const nextGame = executeCardEffect(
        activatedGame,
        pendingEffect.context,
        currentEffect,
        pendingEffect.selectedTargetIds,
      )
      const result = describeEffectResult(currentEffect, targetNames)
      if (
        currentEffect.kind === 'view-hp' &&
        pendingEffect.selectedTargetIds.length === 1
      ) {
        const target = effectTargetCandidates.find(
          (cookie) =>
            cookie.card.instanceId === pendingEffect.selectedTargetIds[0],
        )
        if (target) {
          setInspectedHpPile({
            title: `${target.card.name}的 HP 卡`,
            cards: target.hpCards,
          })
        }
      }
      const nextEffectIndex = pendingEffect.effectIndex + 1
      const hasNextEffect =
        nextGame.status === 'playing' &&
        nextEffectIndex < pendingEffect.effects.length
      const viewerMustAct =
        (nextGame.pendingRefresh?.playerId === viewerPlayerId) ||
        (nextGame.pendingOnPlay?.playerId === viewerPlayerId)

      if (hasNextEffect && viewerMustAct) {
        setGame(nextGame)
        setMessage(result)
        setEffectHistory((history) => [result, ...history].slice(0, 4))
        setPendingEffect(null)
        setSuspendedEffect({
          ...pendingEffect,
          effectIndex: nextEffectIndex,
          selectedTargetIds: [],
          skillActivated: true,
        })

        if (nextGame.pendingOnPlay?.playerId === viewerPlayerId) {
          const onPlayCard = nextGame.players[viewerPlayerId].battleArea.find(
            (cookie) =>
              cookie.card.instanceId === nextGame.pendingOnPlay!.sourceInstanceId,
          )?.card
          if (onPlayCard) {
            beginCookieSkill(
              nextGame,
              onPlayCard,
              viewerPlayerId,
              'on-play',
              'OnPlay 登場觸發',
              true,
            )
          }
        }

        return
      }

      const resolvedGame =
        nextGame.status !== 'playing' || hasNextEffect
          ? nextGame
          : finalizePendingReplacements(nextGame)

      setGame(resolvedGame)
      setMessage(result)
      setEffectHistory((history) => [result, ...history].slice(0, 4))
      setPendingEffect(
        hasNextEffect
          ? {
              ...pendingEffect,
              effectIndex: nextEffectIndex,
              selectedTargetIds: [],
              skillActivated: true,
            }
          : null,
      )

      if (!hasNextEffect && resolvedGame.status === 'playing') {
        const onPlay = resolvedGame.pendingOnPlay
        if (onPlay && onPlay.playerId === viewerPlayerId) {
          const onPlayCard = resolvedGame.players[viewerPlayerId].battleArea.find(
            (cookie) =>
              cookie.card.instanceId === onPlay.sourceInstanceId,
          )?.card
          if (onPlayCard) {
            beginCookieSkill(
              resolvedGame,
              onPlayCard,
              viewerPlayerId,
              'on-play',
              'OnPlay 登場觸發',
              true,
            )
          }
        }
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '效果無法執行。',
      )
    }
  }

  const resetEffectContext = () => {
    setPendingEffect(null)
    setSuspendedEffect(null)
    setEffectHistory([])
  }

  return {
    pendingEffect,
    setPendingEffect,
    suspendedEffect,
    setSuspendedEffect,
    effectHistory,
    setEffectHistory,
    resetEffectContext,
    beginCookieSkill,
    beginCardAbility,
    toggleEffectTarget,
    toggleSkillPayment,
    confirmEffect,
    skipOptionalSkill,
    currentEffect,
    effectTargetCandidates,
    supportEffectCandidates,
    trashCookieCandidates,
    nonBattleEffectCandidateCards,
    breakToTrashCandidates,
    effectTargetIds,
    breakEffectTargetIds,
    selectedEffectTargetIds,
    selectedSkillPaymentIds,
    faintActive,
  } as const
}
