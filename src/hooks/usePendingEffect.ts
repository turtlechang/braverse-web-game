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
  getEnergyCostTotal,
  getBreakToTrashCandidates,
  getEffectTargetCandidates,
  getSupportEffectCandidates,
  getTrashCookieCandidates,
  isEffectConditionMet,
  isEffectUntargeted,
  playItem,
  resolveAttackEffect,
  skipCookieOnPlay,
  validateEnergyPayment,
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
          currentEffect.kind === 'trash-to-battle' ||
          currentEffect.kind === 'inspect-deck' ||
          currentEffect.kind === 'optional-cost-attack'
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

  const supportEffectTargetIds = faintActive
    ? new Set<string>()
    : new Set(
        supportEffectCandidates.map((support) => support.card.instanceId),
      )

  const selectedEffectTargetIds = faintActive
    ? new Set(selectedFaintTargetIds)
    : new Set(pendingEffect?.selectedTargetIds ?? [])

  const selectedSkillPaymentIds = new Set(
    pendingEffect?.selectedPaymentIds ?? [],
  )

  const pendingSupportArea = pendingEffect
    ? game.players[pendingEffect.context.sourcePlayerId].supportArea
    : []
  const skillEnergyCostTotal = pendingEffect
    ? getEnergyCostTotal(pendingEffect.skill.cost.energy)
    : 0
  const skillEnergyPaymentValid = pendingEffect
    ? validateEnergyPayment(
        pendingEffect.skill.cost.energy,
        pendingSupportArea,
        pendingEffect.selectedPaymentIds,
      ).valid
    : false
  const skillPaymentTargetIds = new Set(
    pendingEffect && !pendingEffect.skillActivated && skillEnergyCostTotal > 0
      ? pendingSupportArea
          .filter(
            (support) =>
              !support.rested &&
              !pendingEffect.selectedCostSupportToTrashIds.includes(
                support.card.instanceId,
              ) &&
              (pendingEffect.selectedPaymentIds.length <
                skillEnergyCostTotal ||
                pendingEffect.selectedPaymentIds.includes(
                  support.card.instanceId,
                )),
          )
          .map((support) => support.card.instanceId)
      : [],
  )

  const supportToTrashCost =
    pendingEffect?.skill.cost.supportToTrash ?? 0
  const skillCostSupportCandidates =
    pendingEffect &&
    supportToTrashCost > 0 &&
    skillEnergyPaymentValid
      ? getSupportEffectCandidates(game, pendingEffect.context).filter(
          (support) =>
            !pendingEffect.selectedPaymentIds.includes(
              support.card.instanceId,
            ) &&
            (pendingEffect.selectedCostSupportToTrashIds.length <
              supportToTrashCost ||
              pendingEffect.selectedCostSupportToTrashIds.includes(
                support.card.instanceId,
              )),
        )
      : []

  const skillCostSupportTargetIds = new Set(
    skillCostSupportCandidates.map(
      (support) => support.card.instanceId,
    ),
  )

  const selectedSkillCostSupportToTrashIds = new Set(
    pendingEffect?.selectedCostSupportToTrashIds ?? [],
  )

  const discardHandCost = pendingEffect?.skill.cost.discardHand ?? 0
  const skillCostDiscardHandCandidates =
    pendingEffect &&
    discardHandCost > 0 &&
    !pendingEffect.skillActivated
      ? game.players[pendingEffect.context.sourcePlayerId].hand.filter(
          (card) =>
            pendingEffect.selectedDiscardHandIds.length < discardHandCost ||
            pendingEffect.selectedDiscardHandIds.includes(
              card.instanceId,
            ),
        )
      : []
  const skillDiscardHandTargetIds = new Set(
    skillCostDiscardHandCandidates.map((card) => card.instanceId),
  )
  const selectedSkillDiscardHandIds = new Set(
    pendingEffect?.selectedDiscardHandIds ?? [],
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
      (game.pendingOnPlay?.playerId === viewerPlayerId) ||
      (game.pendingInspectDeck?.playerId === viewerPlayerId) ||
      (game.pendingOptionalCostAttack?.playerId === viewerPlayerId)
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
    game.pendingInspectDeck,
    game.pendingOptionalCostAttack,
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
      selectedCostSupportToTrashIds: [],
      selectedDiscardHandIds: [],
      skillActivated: false,
      optional,
      triggerLabel,
      sourceKind: 'cookie',
    })
    setMessage(`${card.name}的技能等待支付技能代價並選擇目標。`)
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
        cost: { energy: ability.cost, discardHand: 0 },
        text: ability.text,
        effects,
      },
      trigger: 'activate',
      effects,
      effectIndex: 0,
      selectedTargetIds: [],
      selectedPaymentIds: [],
      selectedCostSupportToTrashIds: [],
      selectedDiscardHandIds: [],
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
      game.pendingOptionalCostAttack ||
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

    if (currentAttackEffect.kind === 'optional-cost-attack') {
      const timer = window.setTimeout(() => {
        setGame((current) => {
          const currentBattle = current.pendingBattle
          if (
            current.pendingOptionalCostAttack ||
            !currentBattle ||
            currentBattle.stage !== 'attack-effect' ||
            currentBattle.attackerPlayerId !== viewerPlayerId ||
            currentBattle.attackerInstanceId !== battle.attackerInstanceId ||
            currentBattle.attackEffectIndex !== battle.attackEffectIndex
          ) {
            return current
          }
          return resolveAttackEffect(current, viewerPlayerId, [])
        })
        setMessage(`${sourceCard.name}等待決定是否支付攻擊後續效果代價。`)
      }, 0)
      return () => window.clearTimeout(timer)
    }

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
          cost: { energy: {}, discardHand: 0 },
          text: sourceCard.attackText ?? '',
          effects: battle.attackEffects,
        },
        trigger: 'activate',
        effects: battle.attackEffects,
        effectIndex: battle.attackEffectIndex,
        selectedTargetIds: [],
        selectedPaymentIds: [],
        selectedCostSupportToTrashIds: [],
        selectedDiscardHandIds: [],
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
    setGame,
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
        !breakEffectTargetIds.has(instanceId) &&
        !supportEffectTargetIds.has(instanceId))
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
          : currentEffect.kind === 'inspect-deck' ||
              currentEffect.kind === 'optional-cost-attack'
            ? 0
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
    if (
      pendingEffect.selectedCostSupportToTrashIds.includes(instanceId)
    ) {
      return
    }

    const isSelected =
      pendingEffect.selectedPaymentIds.includes(instanceId)
    if (
      !isSelected &&
      pendingEffect.selectedPaymentIds.length >= skillEnergyCostTotal
    ) {
      return
    }
    const selectedPaymentIds = isSelected
      ? pendingEffect.selectedPaymentIds.filter((id) => id !== instanceId)
      : [...pendingEffect.selectedPaymentIds, instanceId]

    setPendingEffect({ ...pendingEffect, selectedPaymentIds })
  }

  const toggleSkillCostSupport = (instanceId: string) => {
    if (!pendingEffect || pendingEffect.skillActivated) return
    if (
      !skillCostSupportTargetIds.has(instanceId) ||
      pendingEffect.selectedPaymentIds.includes(instanceId)
    ) {
      return
    }

    const max = pendingEffect.skill.cost.supportToTrash ?? 0
    const isSelected =
      pendingEffect.selectedCostSupportToTrashIds.includes(instanceId)
    const selectedCostSupportToTrashIds = isSelected
      ? pendingEffect.selectedCostSupportToTrashIds.filter(
          (id) => id !== instanceId,
        )
      : pendingEffect.selectedCostSupportToTrashIds.length < max
        ? [...pendingEffect.selectedCostSupportToTrashIds, instanceId]
        : pendingEffect.selectedCostSupportToTrashIds

    setPendingEffect({ ...pendingEffect, selectedCostSupportToTrashIds })
  }

  const toggleSkillDiscardHand = (instanceId: string) => {
    if (!pendingEffect || pendingEffect.skillActivated) return
    const discardHandCost = pendingEffect.skill.cost.discardHand
    if (discardHandCost <= 0) return
    const player = game.players[pendingEffect.context.sourcePlayerId]
    const ownsCard = player.hand.some(
      (card) => card.instanceId === instanceId,
    )
    if (!ownsCard) return

    const isSelected =
      pendingEffect.selectedDiscardHandIds.includes(instanceId)
    if (
      !isSelected &&
      pendingEffect.selectedDiscardHandIds.length >= discardHandCost
    ) {
      return
    }
    const selectedDiscardHandIds = isSelected
      ? pendingEffect.selectedDiscardHandIds.filter((id) => id !== instanceId)
      : [...pendingEffect.selectedDiscardHandIds, instanceId]

    setPendingEffect({ ...pendingEffect, selectedDiscardHandIds })
  }

  const cancelPendingSkill = () => {
    if (!pendingEffect) return
    if (
      pendingEffect.sourceKind !== 'cookie' ||
      pendingEffect.trigger !== 'activate' ||
      pendingEffect.skillActivated
    ) {
      return
    }
    setPendingEffect(null)
    setMessage(`已取消${pendingEffect.sourceCard.name}的技能發動。`)
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
        (game.pendingOnPlay?.playerId === viewerPlayerId) ||
        (game.pendingInspectDeck?.playerId === viewerPlayerId) ||
        (game.pendingOptionalCostAttack?.playerId === viewerPlayerId)

      if (hasNextEffect && viewerMustAct) {
        setPendingEffect(null)
        setSuspendedEffect({
          ...pendingEffect,
          effectIndex: nextEffectIndex,
          selectedTargetIds: [],
          skillActivated: true,
          selectedDiscardHandIds: [],
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
              selectedDiscardHandIds: [],
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
                pendingEffect.selectedCostSupportToTrashIds,
                pendingEffect.selectedDiscardHandIds,
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
        (nextGame.pendingOnPlay?.playerId === viewerPlayerId) ||
        (nextGame.pendingInspectDeck?.playerId === viewerPlayerId) ||
        (nextGame.pendingOptionalCostAttack?.playerId === viewerPlayerId)

      if (hasNextEffect && viewerMustAct) {
        setGame(nextGame)
        setMessage(result)
        setEffectHistory((history) => [result, ...history].slice(0, 4))
        setPendingEffect(null)
        setSuspendedEffect({
          ...pendingEffect,
          effectIndex: nextEffectIndex,
          selectedTargetIds: [],
          selectedDiscardHandIds: [],
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
              selectedDiscardHandIds: [],
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
    toggleSkillCostSupport,
    toggleSkillDiscardHand,
    confirmEffect,
    skipOptionalSkill,
    cancelPendingSkill,
    currentEffect,
    effectTargetCandidates,
    supportEffectCandidates,
    trashCookieCandidates,
    nonBattleEffectCandidateCards,
    breakToTrashCandidates,
    skillCostSupportCandidates,
    skillPaymentTargetIds,
    skillCostSupportTargetIds,
    skillCostDiscardHandCandidates,
    skillDiscardHandTargetIds,
    selectedSkillDiscardHandIds,
    discardHandCost,
    effectTargetIds,
    breakEffectTargetIds,
    supportEffectTargetIds,
    selectedEffectTargetIds,
    selectedSkillPaymentIds,
    selectedSkillCostSupportToTrashIds,
    faintActive,
  } as const
}
