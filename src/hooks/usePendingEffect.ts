import { useCallback, useEffect, useState } from 'react'
import type {
  CardAbility,
  GameCard,
  GameState,
  PlayerId,
  SkillTrigger,
} from '../game'
import {
  applyGameCommand,
  canActivateCookieSkill,
  finalizePendingReplacements,
  getEnergyCostTotal,
  getBreakToBattleCandidates,
  getBreakToHandBySumCandidates,
  getBreakToTrashCandidates,
  getEffectTargetCandidates,
  getSupportEffectCandidates,
  getTrashBattleCookieCostCandidates,
  getTrashCookieCandidates,
  getTrashToDeckCandidates,
  getTrashToHandCandidates,
  getTrashToSupportCandidates,
  isEffectConditionMet,
  isEffectUntargeted,
  validateEnergyPayment,
} from '../game'
import { describeEffectResult } from '../components/effects/effectUiUtils'
import type { PendingEffect } from '../components/effects/effectUiTypes'
import type { DispatchGameCommand } from './useBattleActions'

interface HpPileInfo {
  title: string
  cards: GameCard[]
}

export function usePendingEffect(params: {
  game: GameState
  setGame: (value: GameState | ((prev: GameState) => GameState)) => void
  dispatch: DispatchGameCommand
  viewerPlayerId: PlayerId
  setMessage: (value: string) => void
  clearAttacker: () => void
  setInspectedHpPile: (info: HpPileInfo) => void
  hasFaint: boolean
  faintTargetIds: Set<string>
  selectedFaintTargetIds: string[]
  faintMinMax: { min: number; max: number }
  setSelectedFaintTargetIds: React.Dispatch<React.SetStateAction<string[]>>
  hasAfterDamage: boolean
  afterDamageTargetIds: Set<string>
  selectedAfterDamageTargetIds: string[]
  afterDamageMinMax: { min: number; max: number }
  setSelectedAfterDamageTargetIds: React.Dispatch<React.SetStateAction<string[]>>
}) {
  const {
    game,
    setGame,
    dispatch,
    viewerPlayerId,
    setMessage,
    clearAttacker,
    setInspectedHpPile,
    hasFaint,
    faintTargetIds,
    selectedFaintTargetIds,
    faintMinMax,
    setSelectedFaintTargetIds,
    hasAfterDamage,
    afterDamageTargetIds,
    selectedAfterDamageTargetIds,
    afterDamageMinMax,
    setSelectedAfterDamageTargetIds,
  } = params

  const [pendingEffect, setPendingEffect] =
    useState<PendingEffect | null>(null)
  const [suspendedEffect, setSuspendedEffect] =
    useState<PendingEffect | null>(null)
  const [effectHistory, setEffectHistory] = useState<string[]>([])

  const faintActive =
    hasFaint &&
    !pendingEffect &&
    !game.pendingReplacement &&
    !game.pendingRefresh &&
    !game.pendingOnPlay
  const afterDamageActive = hasAfterDamage && !pendingEffect

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
          currentEffect.kind === 'trash-to-support' ||
          currentEffect.kind === 'trash-to-hand' ||
          currentEffect.kind === 'trash-to-deck' ||
          currentEffect.kind === 'flip-to-support' ||
          currentEffect.kind === 'inspect-deck' ||
          currentEffect.kind === 'optional-cost-attack' ||
          currentEffect.kind === 'disable-block'
          ? null
          : currentEffect.target
        : null

  const effectTargetCandidates =
    pendingEffect &&
    currentEffect &&
    currentTargetSelector
      ? (currentEffect.kind === 'field-to-trash' && currentEffect.stageOnly)
          ? []
          : getEffectTargetCandidates(
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
      ? getSupportEffectCandidates(game, pendingEffect.context).filter(
          (support) =>
            currentEffect.kind !== 'support-to-hand' ||
            currentEffect.maxLevel === undefined ||
            (support.card.type === 'cookie' &&
              support.card.level <= currentEffect.maxLevel),
        )
      : []

  const trashCookieCandidates =
    pendingEffect &&
    (currentEffect?.kind === 'trash-to-battle' ||
      currentEffect?.kind === 'trash-to-support')
      ? currentEffect.kind === 'trash-to-battle'
        ? getTrashCookieCandidates(game, pendingEffect.context)
        : getTrashToSupportCandidates(game, pendingEffect.context)
      : []

  const fieldToTrashStageCandidate =
    pendingEffect &&
    currentEffect &&
    currentEffect.kind === 'field-to-trash' &&
    (currentEffect.allowStage || currentEffect.stageOnly)
      ? (() => {
          const targetPlayerId =
            currentEffect.target.side === 'self'
              ? pendingEffect.context.sourcePlayerId
              : pendingEffect.context.sourcePlayerId === 'player-one'
                ? 'player-two'
                : 'player-one'
          const targetPlayer = game.players[targetPlayerId]
          return targetPlayer.stage
            ? [targetPlayer.stage.card]
            : []
        })()
      : []

  const nonBattleEffectCandidateCards = [
    ...supportEffectCandidates.map((support) => support.card),
    ...trashCookieCandidates,
    ...fieldToTrashStageCandidate,
  ]

  const breakToTrashCandidates =
    pendingEffect && currentEffect?.kind === 'break-to-trash'
      ? getBreakToTrashCandidates(
          game,
          pendingEffect.context,
          currentEffect,
        )
      : []

  const breakToBattleCandidates =
    pendingEffect && currentEffect?.kind === 'break-to-battle'
      ? getBreakToBattleCandidates(game, pendingEffect.context, currentEffect)
      : []

  const breakToHandBySumCandidates =
    pendingEffect && currentEffect?.kind === 'break-to-hand-by-level-sum'
      ? getBreakToHandBySumCandidates(game, pendingEffect.context, currentEffect)
      : []

  const trashToHandCandidates =
    pendingEffect && currentEffect?.kind === 'trash-to-hand'
      ? getTrashToHandCandidates(game, pendingEffect.context, currentEffect)
      : []

  const trashToDeckCandidates =
    pendingEffect && currentEffect?.kind === 'trash-to-deck'
      ? getTrashToDeckCandidates(game, pendingEffect.context, currentEffect)
      : []

  const effectTargetIds = faintActive
    ? faintTargetIds
    : afterDamageActive
      ? afterDamageTargetIds
      : new Set([
          ...effectTargetCandidates.map((cookie) => cookie.card.instanceId),
          ...fieldToTrashStageCandidate.map((c) => c.instanceId),
        ])

  const breakEffectTargetIds = faintActive
    ? new Set<string>()
    : new Set([
        ...breakToTrashCandidates.map((card) => card.instanceId),
        ...breakToBattleCandidates.map((card) => card.instanceId),
        ...breakToHandBySumCandidates.map((card) => card.instanceId),
      ])

  const supportEffectTargetIds = faintActive
    ? new Set<string>()
    : new Set(
        supportEffectCandidates.map((support) => support.card.instanceId),
      )

  const trashEffectTargetIds = faintActive
    ? new Set<string>()
    : new Set([
        ...trashCookieCandidates.map((card) => card.instanceId),
        ...trashToHandCandidates.map((card) => card.instanceId),
        ...trashToDeckCandidates.map((card) => card.instanceId),
      ])

  const selectedEffectTargetIds: Set<string> = faintActive
    ? new Set(selectedFaintTargetIds)
    : afterDamageActive
      ? new Set(selectedAfterDamageTargetIds)
      : new Set(pendingEffect?.selectedTargetIds ?? [])

  const selectedSkillPaymentIds = new Set(
    pendingEffect?.selectedPaymentIds ?? [],
  )

  const pendingSupportArea = pendingEffect
    ? game.players[pendingEffect.context.sourcePlayerId].supportArea
    : []
  const skillEnergyCostTotal = pendingEffect
    ? getEnergyCostTotal(
        pendingEffect.skill.cost.energy ?? pendingEffect.skill.cost,
      )
    : 0
  const skillEnergyPaymentValid = pendingEffect
    ? validateEnergyPayment(
        pendingEffect.skill.cost.energy ?? pendingEffect.skill.cost,
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
  const supportToHandCost =
    pendingEffect?.skill.cost.supportToHand ?? 0
  const supportAreaCost = supportToTrashCost + supportToHandCost
  const skillCostSupportCandidates =
    pendingEffect &&
    supportAreaCost > 0 &&
    skillEnergyPaymentValid
      ? getSupportEffectCandidates(game, pendingEffect.context).filter(
          (support) =>
            !pendingEffect.selectedPaymentIds.includes(
              support.card.instanceId,
            ) &&
            (pendingEffect.selectedCostSupportToTrashIds.length <
              supportAreaCost ||
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
            card.instanceId !== pendingEffect.sourceCard.instanceId &&
            (pendingEffect.selectedDiscardHandIds.length < discardHandCost ||
              pendingEffect.selectedDiscardHandIds.includes(
                card.instanceId,
              )),
        )
      : []
  const skillDiscardHandTargetIds = new Set(
    skillCostDiscardHandCandidates.map((card) => card.instanceId),
  )
  const selectedSkillDiscardHandIds = new Set(
    pendingEffect?.selectedDiscardHandIds ?? [],
  )

  const selectedSkillTrashBattleCookieIds = new Set(
    pendingEffect?.selectedTrashBattleCookieIds ?? [],
  )
  const skillTrashBattleCookieTargetIds = new Set(
    pendingEffect &&
    !pendingEffect.skillActivated &&
    pendingEffect.skill.cost.trashBattleCookie
      ? getTrashBattleCookieCostCandidates(
          pendingEffect.skill.cost,
          game.players[pendingEffect.context.sourcePlayerId].battleArea,
          pendingEffect.context.sourceInstanceId,
        ).map((cookie) => cookie.card.instanceId)
      : [],
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
      (game.pendingOptionalCostAttack?.playerId === viewerPlayerId) ||
      (game.pendingDrawUpTo?.playerId === viewerPlayerId) ||
      (game.pendingStageTrigger?.playerId === viewerPlayerId) ||
      (game.pendingAfterDamageEffects &&
        game.pendingAfterDamageEffects.length > 0 &&
        game.pendingAfterDamageEffects[0].sourcePlayerId === viewerPlayerId)
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
    game.pendingDrawUpTo,
    game.pendingStageTrigger,
    game.pendingAfterDamageEffects,
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
          applyGameCommand(nextGame, {
            kind: 'skip-on-play',
            playerId,
            sourceInstanceId: card.instanceId,
          }),
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
          applyGameCommand(nextGame, {
            kind: 'skip-on-play',
            playerId,
            sourceInstanceId: card.instanceId,
          }),
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
      selectedTrashBattleCookieIds: [],
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
        cost: ability.cost,
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
      selectedTrashBattleCookieIds: [],
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
          return applyGameCommand(current, {
            kind: 'resolve-attack-effect',
            playerId: viewerPlayerId,
            targetIds: [],
          })
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
        selectedTrashBattleCookieIds: [],
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

    if (afterDamageActive) {
      if (!afterDamageTargetIds.has(instanceId)) return
      setSelectedAfterDamageTargetIds((current) =>
        current.includes(instanceId)
          ? current.filter((id) => id !== instanceId)
          : current.length < afterDamageMinMax.max
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
        !supportEffectTargetIds.has(instanceId) &&
        !trashEffectTargetIds.has(instanceId))
    ) {
      return
    }

    const max =
      currentEffect.kind === 'break-to-trash' ||
        currentEffect.kind === 'trash-to-hand' ||
        currentEffect.kind === 'trash-to-deck'
        ? currentEffect.max
        : currentEffect.kind === 'break-to-hand-by-level-sum'
          ? Number.MAX_SAFE_INTEGER
        : currentEffect.kind === 'support-to-trash' ||
            currentEffect.kind === 'support-to-hand' ||
            currentEffect.kind === 'trash-to-battle' ||
            currentEffect.kind === 'trash-to-support' ||
            currentEffect.kind === 'break-to-battle'
          ? currentEffect.amount
        : isEffectUntargeted(currentEffect)
          ? currentEffect.kind === 'gain-hp'
            ? currentEffect.target?.max ?? 0
            : 0
          : currentEffect.kind === 'inspect-deck' ||
              currentEffect.kind === 'optional-cost-attack' ||
              currentEffect.kind === 'disable-block' ||
              currentEffect.kind === 'flip-to-support'
            ? 0
          : currentEffect.target?.max ?? 0

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

    const max =
      (pendingEffect.skill.cost.supportToTrash ?? 0) +
      (pendingEffect.skill.cost.supportToHand ?? 0)
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
    const discardHandCost = pendingEffect.skill.cost.discardHand ?? 0
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

  const toggleSkillTrashBattleCookie = (instanceId: string) => {
    if (!pendingEffect || pendingEffect.skillActivated) return
    const trashCost = pendingEffect.skill.cost.trashBattleCookie
    if (!trashCost) return
    const player = game.players[pendingEffect.context.sourcePlayerId]
    const cookie = player.battleArea.find(
      (c) => c.card.instanceId === instanceId,
    )
    if (!cookie) return
    if (
      trashCost.level !== undefined &&
      cookie.card.level !== trashCost.level
    ) return
    if (
      trashCost.energyColor !== undefined &&
      cookie.card.energyColor !== trashCost.energyColor
    ) return

    const isSelected =
      pendingEffect.selectedTrashBattleCookieIds.includes(instanceId)
    if (
      !isSelected &&
      pendingEffect.selectedTrashBattleCookieIds.length >= trashCost.count
    ) {
      return
    }
    const selectedTrashBattleCookieIds = isSelected
      ? pendingEffect.selectedTrashBattleCookieIds.filter(
          (id) => id !== instanceId,
        )
      : [...pendingEffect.selectedTrashBattleCookieIds, instanceId]

    setPendingEffect({ ...pendingEffect, selectedTrashBattleCookieIds })
  }

  const cancelPendingSkill = () => {
    if (!pendingEffect) return
    if (
      (pendingEffect.sourceKind !== 'cookie' &&
        pendingEffect.sourceKind !== 'item' &&
        pendingEffect.sourceKind !== 'stage') ||
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
        (game.pendingOptionalCostAttack?.playerId === viewerPlayerId) ||
        (game.pendingDrawUpTo?.playerId === viewerPlayerId) ||
        (game.pendingStageTrigger?.playerId === viewerPlayerId) ||
        (game.pendingAfterDamageEffects &&
          game.pendingAfterDamageEffects.length > 0 &&
          game.pendingAfterDamageEffects[0].sourcePlayerId === viewerPlayerId)

      if (hasNextEffect && viewerMustAct) {
        setPendingEffect(null)
        setSuspendedEffect({
          ...pendingEffect,
          effectIndex: nextEffectIndex,
          selectedTargetIds: [],
          skillActivated: true,
          selectedDiscardHandIds: [],
          selectedTrashBattleCookieIds: [],
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
              selectedTrashBattleCookieIds: [],
              skillActivated: true,
            }
          : null,
      )
      setMessage('已略過可選效果。')
      return
    }

    if (!pendingEffect?.optional) return

    dispatch(
      {
        kind: 'skip-on-play',
        playerId: pendingEffect.context.sourcePlayerId,
        sourceInstanceId: pendingEffect.sourceCard.instanceId,
      },
      `${pendingEffect.sourceCard.name}的 OnPlay 技能未發動。`,
    )
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
          : currentEffect.kind === 'trash-to-battle' ||
              currentEffect.kind === 'trash-to-support'
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
        const result = describeEffectResult(currentEffect, targetNames)
        dispatch(
          {
            kind: 'resolve-attack-effect',
            playerId: pendingEffect.context.sourcePlayerId,
            targetIds: pendingEffect.selectedTargetIds,
          },
          result,
        )
        setEffectHistory((history) => [result, ...history].slice(0, 4))
        setPendingEffect(null)
        return
      }

      const paymentIds = pendingEffect.selectedPaymentIds
      const supportToTrashIds = pendingEffect.skill.cost.supportToTrash
        ? pendingEffect.selectedCostSupportToTrashIds
        : []
      const supportToHandIds = pendingEffect.skill.cost.supportToHand
        ? pendingEffect.selectedCostSupportToTrashIds
        : []
      const discardHandIds = pendingEffect.selectedDiscardHandIds

      // 技能/道具/場景效果是多步驟精靈(逐一支付代價、逐一選目標),
      // 只有第一次呼叫才需要支付代價(begin-*指令),之後每步都走 resolve-ability-effect。
      const activatedGame = pendingEffect.skillActivated
        ? game
        : pendingEffect.sourceKind === 'item'
          ? applyGameCommand(game, {
              kind: 'begin-play-item',
              playerId: pendingEffect.context.sourcePlayerId,
              instanceId: pendingEffect.sourceCard.instanceId,
              paymentIds,
              supportToTrashIds,
              supportToHandIds,
              discardHandIds,
            })
          : pendingEffect.sourceKind === 'stage'
            ? applyGameCommand(game, {
                kind: 'begin-activate-stage',
                playerId: pendingEffect.context.sourcePlayerId,
                paymentIds,
                supportToTrashIds,
                supportToHandIds,
                discardHandIds,
              })
            : applyGameCommand(game, {
                kind: 'begin-activate-skill',
                playerId: pendingEffect.context.sourcePlayerId,
                sourceInstanceId: pendingEffect.sourceCard.instanceId,
                trigger: pendingEffect.trigger as 'activate' | 'on-play',
                paymentIds,
                costSupportToTrashIds: pendingEffect.selectedCostSupportToTrashIds,
                discardHandIds,
                trashBattleCookieIds: pendingEffect.selectedTrashBattleCookieIds,
              })
      const nextGame = applyGameCommand(activatedGame, {
        kind: 'resolve-ability-effect',
        playerId: pendingEffect.context.sourcePlayerId,
        targetIds: pendingEffect.selectedTargetIds,
      })
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
        (nextGame.pendingOptionalCostAttack?.playerId === viewerPlayerId) ||
        (nextGame.pendingDrawUpTo?.playerId === viewerPlayerId) ||
        (nextGame.pendingStageTrigger?.playerId === viewerPlayerId) ||
        (nextGame.pendingAfterDamageEffects &&
          nextGame.pendingAfterDamageEffects.length > 0 &&
          nextGame.pendingAfterDamageEffects[0].sourcePlayerId === viewerPlayerId)

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
          selectedTrashBattleCookieIds: [],
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
              selectedTrashBattleCookieIds: [],
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
    toggleSkillTrashBattleCookie,
    confirmEffect,
    skipOptionalSkill,
    cancelPendingSkill,
    currentEffect,
    effectTargetCandidates,
    supportEffectCandidates,
    trashCookieCandidates,
    nonBattleEffectCandidateCards,
    breakToTrashCandidates,
    breakToBattleCandidates,
    breakToHandBySumCandidates,
    trashToHandCandidates,
    trashToDeckCandidates,
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
    selectedSkillTrashBattleCookieIds,
    skillTrashBattleCookieTargetIds,
    faintActive,
    afterDamageActive,
  } as const
}
