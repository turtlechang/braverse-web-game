import { getOpponentId } from './helpers'
import { getForcedAttackTargetId } from './battle'
import {
  getFieldToDeckBottomBlocker,
  getOpponentBattleMovementPreventer,
  isProtectedBySoulJamResolution,
} from './effects/targeting'
import type { GameCommand } from './commands'
import type {
  CardEffect,
  GameCard,
  GameState,
  LogCategory,
  LogStepDetail,
  PlayerId,
} from './types'

const playerName = (state: GameState, playerId: PlayerId): string =>
  state.players[playerId]?.name ?? playerId

/** 在雙方手牌／牌庫／休息區／棄牌區／戰鬥區（含 HP 卡）／支援區／場景區裡找一張卡。 */
const findCard = (state: GameState, instanceId: string): GameCard | undefined => {
  for (const playerId of Object.keys(state.players) as PlayerId[]) {
    const player = state.players[playerId]
    const zones = [
      player.hand,
      player.deck,
      player.breakArea,
      player.discardPile,
      ...player.battleArea.flatMap((entry) => [entry.card, ...entry.hpCards]),
      ...player.supportArea.map((entry) => entry.card),
    ]
    for (const zone of zones) {
      const list = Array.isArray(zone) ? zone : [zone]
      const found = list.find((card) => card.instanceId === instanceId)
      if (found) return found
    }
    if (player.stage?.card.instanceId === instanceId) {
      return player.stage.card
    }
  }
  return undefined
}

const findCardName = (state: GameState, instanceId: string): string =>
  findCard(state, instanceId)?.name ?? '未知卡牌'

const describeForcedAttackRestriction = (
  state: GameState,
  attackerPlayerId: PlayerId,
): LogStepDetail | undefined => {
  const forcedTargetId = getForcedAttackTargetId(state, attackerPlayerId)
  const forcedTarget = forcedTargetId
    ? findCard(state, forcedTargetId)
    : undefined
  if (!forcedTarget) return undefined

  const conditionText =
    forcedTarget.id === 'BS4-024' ? '（場上有黃色 LV.3 餅乾）' : ''
  return {
    text: `目標限制：因「${forcedTarget.name}」的被動效果${conditionText}，只能攻擊「${forcedTarget.name}」`,
    cards: [forcedTarget],
  }
}

const cardTypeLabels: Record<GameCard['type'], string> = {
  cookie: '餅乾',
  item: '物品',
  trap: '陷阱',
  stage: '場景',
}

/**
 * 將 hpToTrash 技能代價寫成可展開的對戰紀錄步驟。
 *
 * `begin-activate-skill` 的 previous state 還保留 HP 卡在餅乾下方，
 * 因此必須從支付後的 next state 讀取 costRecord 與棄牌區，才能顯示
 * 實際被丟棄的卡片名稱與類型，而不是只顯示支付來源餅乾。
 */
const describeHpTrashStep = (
  previous: GameState,
  next: GameState,
  hpToTrashTargetIds: string[] | undefined,
): LogStepDetail | undefined => {
  const topCardId = next.costRecord?.hpTrashTopCardInstanceId
  const hpCard = topCardId ? findCard(next, topCardId) : undefined
  const hpCardType = hpCard?.type ?? next.costRecord?.hpTrashTopCardType
  if (!hpCard && !hpCardType) return undefined

  const sourceName = hpToTrashTargetIds?.[0]
    ? findCardName(previous, hpToTrashTargetIds[0])
    : '餅乾'
  const cardName = hpCard ? `「${hpCard.name}」` : 'HP 卡'
  const typeLabel = hpCardType
    ? `（${cardTypeLabels[hpCardType]}）`
    : '（卡片種類待確認）'

  return {
    text: `HP 費用：從「${sourceName}」丟棄${cardName}${typeLabel}`,
    cards: hpCard ? [hpCard] : undefined,
  }
}

/**
 * 找出 resolve-next-damage 這筆指令實際翻開的 HP 卡。不能只看
 * `pendingBattle.revealedHpCard`：沒有 FLIP 能力的卡翻開後會在同一個指令裡
 * 立刻送進棄牌區，如果這次結算剛好讓 remainingDamage 歸零、戰鬥整個結束，
 * pendingBattle 會在同一個指令裡被清空，讀 next.pendingBattle 就看不到剛剛
 * 翻開的是哪張卡了。改成優先看 command.playerId 的棄牌區這次多了哪張卡
 * （翻開後立刻進棄牌區的情況一定驗得到）；FLIP 卡翻開後會先停在
 * revealedHpCard 等玩家決定要不要發動，還沒進棄牌區，才需要 fallback 這條。
 */
const resolveRevealedDamageCard = (
  previous: GameState,
  next: GameState,
  playerId: PlayerId,
): GameCard | undefined => {
  const previousDiscardIds = new Set(
    previous.players[playerId].discardPile.map((card) => card.instanceId),
  )
  const newlyDiscarded = next.players[playerId].discardPile.find(
    (card) => !previousDiscardIds.has(card.instanceId),
  )
  if (newlyDiscarded) return newlyDiscarded

  const revealedBefore = previous.pendingBattle?.revealedHpCard?.instanceId
  const revealedAfter = next.pendingBattle?.revealedHpCard
  return revealedAfter && revealedAfter.instanceId !== revealedBefore
    ? revealedAfter
    : undefined
}

const getCardEffects = (card: GameCard | undefined): CardEffect[] => {
  if (!card) return []
  if ('skill' in card) return card.skill?.effects ?? []
  if ('item' in card) return card.item?.effects ?? []
  if ('stageAbility' in card) return card.stageAbility?.effects ?? []
  return []
}

const getOpponentBattleToTrashEffect = (
  effects: CardEffect[],
): Extract<CardEffect, { kind: 'opponent-battle-to-trash' }> | undefined =>
  effects.find(
    (effect): effect is Extract<CardEffect, { kind: 'opponent-battle-to-trash' }> =>
      effect.kind === 'opponent-battle-to-trash',
  )

const getFieldToDeckBottomEffect = (
  effects: CardEffect[],
): Extract<CardEffect, { kind: 'field-to-deck-bottom' }> | undefined =>
  effects.find(
    (effect): effect is Extract<CardEffect, { kind: 'field-to-deck-bottom' }> =>
      effect.kind === 'field-to-deck-bottom',
  )

const getOpponentBattleToTrashBlocker = (
  state: GameState,
  sourcePlayerId: PlayerId,
  effect: Extract<CardEffect, { kind: 'opponent-battle-to-trash' }>,
): { blocker: GameCard; protectedTarget?: GameCard } | undefined => {
  const opponent = state.players[getOpponentId(sourcePlayerId)]
  const eligibleTargets = opponent.battleArea.filter((cookie) => {
    if (
      effect.maxLevel !== undefined &&
      cookie.card.level > effect.maxLevel
    ) {
      return false
    }
    if (
      effect.minLevel !== undefined &&
      cookie.card.level < effect.minLevel
    ) {
      return false
    }
    if (
      effect.remainingHp !== undefined &&
      cookie.hpCards.length > effect.remainingHp
    ) {
      return false
    }
    return true
  })
  const movementPreventer = getOpponentBattleMovementPreventer(state, sourcePlayerId)
  if (movementPreventer && eligibleTargets.length > 0) {
    return { blocker: movementPreventer.card }
  }
  const unprotectedTarget = eligibleTargets.find(
    (cookie) => !isProtectedBySoulJamResolution(cookie),
  )
  if (unprotectedTarget) return undefined

  const protectedTarget = eligibleTargets.find((cookie) =>
    isProtectedBySoulJamResolution(cookie),
  )
  const soulJam = protectedTarget?.equippedCards?.find(
    (card) => card.id === 'BS3-115',
  )
  return soulJam && protectedTarget
    ? { blocker: soulJam, protectedTarget: protectedTarget.card }
    : undefined
}

const describeOpponentBattleToTrashStep = (
  previous: GameState,
  command: Extract<GameCommand, { kind: 'resolve-ability-effect' }>,
  effect: Extract<CardEffect, { kind: 'opponent-battle-to-trash' }>,
): LogStepDetail => {
  const targetCard = command.targetIds[0]
    ? findCard(previous, command.targetIds[0])
    : undefined
  if (targetCard) {
    return {
      text: `效果結算：將「${targetCard.name}」放入棄牌區`,
      cards: [targetCard],
    }
  }

  const block = getOpponentBattleToTrashBlocker(
    previous,
    command.playerId,
    effect,
  )
  if (block) {
    const protectedTargetText = block.protectedTarget
      ? `（目標「${block.protectedTarget.name}」受到保護）`
      : ''
    return {
      text: `效果未生效：被「${block.blocker.name}」的效果阻止${protectedTargetText}`,
      cards: [block.blocker],
    }
  }

  return {
    text:
      (effect.min ?? 1) > 0
        ? '效果未生效：沒有符合條件的目標'
        : '效果結算：未選擇目標',
  }
}

/**
 * BS4-077 的「將這個餅乾放到牌庫底」印在尖括號中，是發動代價而非技能效果。
 * BS6-010 只阻止對手「以效果」移動戰鬥區餅乾，因此需要在紀錄中明示兩者的
 * 差異，避免玩家把成功支付代價誤認為封鎖失效。
 */
const describeSelfToDeckBottomCostStep = (
  state: GameState,
  command: Extract<
    GameCommand,
    { kind: 'activate-skill' | 'begin-activate-skill' }
  >,
): LogStepDetail | undefined => {
  const sourceCard = findCard(state, command.sourceInstanceId)
  if (sourceCard?.type !== 'cookie' || !sourceCard.skill?.cost.selfToDeckBottom) {
    return undefined
  }

  const movementPreventer = getOpponentBattleMovementPreventer(
    state,
    command.playerId,
  )
  const explanation = movementPreventer
    ? `；「${movementPreventer.card.name}」只阻止效果造成的移動，這是發動代價，仍可支付`
    : ''

  return {
    text: `技能代價：將「${sourceCard.name}」放到牌庫底${explanation}`,
    cards: [sourceCard, ...(movementPreventer ? [movementPreventer.card] : [])],
  }
}

const describeFieldToDeckBottomStep = (
  previous: GameState,
  command: Extract<GameCommand, { kind: 'resolve-ability-effect' }>,
  effect: Extract<CardEffect, { kind: 'field-to-deck-bottom' }>,
): LogStepDetail => {
  const targetCard = command.targetIds[0]
    ? findCard(previous, command.targetIds[0])
    : undefined
  if (targetCard) {
    return {
      text: `效果結算：將「${targetCard.name}」放到持有者牌庫底`,
      cards: [targetCard],
    }
  }

  const blocker = getFieldToDeckBottomBlocker(
    previous,
    {
      sourcePlayerId: command.playerId,
      sourceInstanceId:
        previous.pendingAbilityEffect?.sourceInstanceId ?? '',
    },
    effect,
  )
  if (blocker) {
    return {
      text: `效果未生效：被「${blocker.card.name}」的效果阻止，無法將餅乾移出戰鬥區`,
      cards: [blocker.card],
    }
  }

  return {
    text:
      effect.target.min > 0
        ? '效果未生效：沒有符合條件的目標'
        : '效果未生效：未選擇目標',
  }
}

const describeBlockedOnPlayMovement = (
  state: GameState,
  sourceInstanceId: string,
  sourcePlayerId: PlayerId,
): LogStepDetail | undefined => {
  const sourceCard = findCard(state, sourceInstanceId)
  const sourceEffects = getCardEffects(sourceCard)
  const fieldToDeckBottom = getFieldToDeckBottomEffect(sourceEffects)
  if (fieldToDeckBottom && !getOpponentBattleToTrashEffect(sourceEffects)) {
    const block = getFieldToDeckBottomBlocker(
      state,
      { sourcePlayerId, sourceInstanceId },
      fieldToDeckBottom,
    )
    if (block) {
      return {
        text: `效果未生效：被「${block.card.name}」的效果阻止，無法將餅乾移出戰鬥區`,
        cards: [block.card],
      }
    }
  }
  const effect = getOpponentBattleToTrashEffect(getCardEffects(sourceCard))
  if (!effect) return undefined
  const block = getOpponentBattleToTrashBlocker(state, sourcePlayerId, effect)
  if (!block) return undefined
  const protectedTargetText = block.protectedTarget
    ? `（目標「${block.protectedTarget.name}」受到保護）`
    : ''
  return {
    text: `效果未生效：被「${block.blocker.name}」的效果阻止${protectedTargetText}`,
    cards: [block.blocker],
  }
}

/** 取出這筆指令真正要結算的效果，讓紀錄以狀態差異描述結果而非只描述點擊。 */
const getResolvedEffects = (
  previous: GameState,
  command: GameCommand,
): CardEffect[] => {
  if (command.kind === 'resolve-ability-effect') {
    const pending = previous.pendingAbilityEffect
    const effect = pending?.effects[pending.effectIndex]
    return effect ? [effect] : []
  }
  if (command.kind === 'resolve-attack-effect') {
    const pending = previous.pendingBattle
    const effect = pending?.attackEffects[pending.attackEffectIndex]
    return effect ? [effect] : []
  }
  if (command.kind === 'activate-skill') {
    return getCardEffects(findCard(previous, command.sourceInstanceId))
  }
  if (command.kind === 'play-item') {
    return getCardEffects(findCard(previous, command.instanceId))
  }
  if (command.kind === 'activate-stage') {
    return getCardEffects(previous.players[command.playerId].stage?.card)
  }
  return []
}

const addDamageTargetSide = (
  playerIds: Set<PlayerId>,
  sourcePlayerId: PlayerId,
  side: 'self' | 'opponent' | 'either',
) => {
  if (side === 'self' || side === 'either') playerIds.add(sourcePlayerId)
  if (side === 'opponent' || side === 'either') {
    playerIds.add(getOpponentId(sourcePlayerId))
  }
}

/** 只把實際會造成傷害的 CardEffect 納入紀錄，避免 HP 代價被誤寫成對手受傷。 */
const getDamageTargetPlayerIds = (
  sourcePlayerId: PlayerId,
  effects: CardEffect[],
): Set<PlayerId> => {
  const playerIds = new Set<PlayerId>()
  for (const effect of effects) {
    if (effect.kind === 'damage-all') {
      addDamageTargetSide(playerIds, sourcePlayerId, effect.side)
      continue
    }
    if (
      effect.kind === 'damage' ||
      effect.kind === 'split-damage' ||
      effect.kind === 'damage-by-break-count' ||
      effect.kind === 'damage-by-break-level-difference' ||
      effect.kind === 'rest-support-and-damage'
    ) {
      addDamageTargetSide(playerIds, sourcePlayerId, effect.target.side)
    }
  }
  return playerIds
}

/**
 * 將結算前後的 HP 卡差異轉成玩家看得懂的結果。這比直接重述卡面可靠：
 * 被保護、條件未滿足或沒有合法目標時都會如實顯示「未造成傷害」。
 */
const describeDamageOutcome = (
  previous: GameState,
  next: GameState,
  sourcePlayerId: PlayerId,
  effects: CardEffect[],
): string | null => {
  const targetPlayerIds = getDamageTargetPlayerIds(sourcePlayerId, effects)
  if (targetPlayerIds.size === 0) return null

  const outcomes: string[] = []
  for (const playerId of targetPlayerIds) {
    const afterBattle = new Map(
      next.players[playerId].battleArea.map((cookie) => [
        cookie.card.instanceId,
        cookie,
      ]),
    )
    for (const before of previous.players[playerId].battleArea) {
      const after = afterBattle.get(before.card.instanceId)
      const damage = before.hpCards.length - (after?.hpCards.length ?? 0)
      if (damage <= 0) continue
      outcomes.push(
        after
          ? `「${before.card.name}」受到 ${damage} 點傷害`
          : `「${before.card.name}」受到 ${damage} 點傷害並昏厥`,
      )
    }
  }

  return outcomes.length > 0 ? outcomes.join('；') : '未造成傷害'
}

export const describeCommand = (
  previous: GameState,
  next: GameState,
  command: GameCommand,
): string => {
  const state = previous
  const actor = playerName(state, command.playerId)

  switch (command.kind) {
    case 'attack':
    case 'declare-attack': {
      const restriction = describeForcedAttackRestriction(
        state,
        command.playerId,
      )
      const restrictionText = restriction ? `（${restriction.text}）` : ''
      return `${actor} 使用「${findCardName(state, command.attackerInstanceId)}」攻擊「${findCardName(state, command.targetInstanceId)}」${restrictionText}`
    }
    case 'deploy-cookie':
      return `${actor} 部署了「${findCardName(state, command.instanceId)}」`
    case 'place-support':
      return `${actor} 放置了支援卡「${findCardName(state, command.instanceId)}」`
    case 'play-item':
    case 'begin-play-item':
      return `${actor} 使用了道具卡「${findCardName(state, command.instanceId)}」`
    case 'play-stage':
      return `${actor} 打出了場景卡「${findCardName(state, command.instanceId)}」`
    case 'activate-stage':
    case 'begin-activate-stage':
      return `${actor} 發動了場景效果`
    case 'play-trap':
      return `${actor} 設置了陷阱卡「${findCardName(state, command.trapInstanceId)}」`
    case 'skip-trap':
      return `${actor} 選擇不發動陷阱`
    case 'play-blocker':
      return `${actor} 使用了阻擋卡「${findCardName(state, command.sourceInstanceId)}」`
    case 'play-attack-response':
      return `${actor} 發動了「${findCardName(state, command.sourceInstanceId)}」的對手指攻回應技能`
    case 'activate-skill':
    case 'begin-activate-skill': {
      const hpTrashStep = describeHpTrashStep(
        state,
        next,
        command.hpToTrashTargetIds,
      )
      const battleToHandStep = describeCardListStep(
        state,
        '技能代價：將戰鬥區餅乾返回手牌',
        command.battleToHandIds,
      )
      const selfToDeckBottomStep = describeSelfToDeckBottomCostStep(
        state,
        command,
      )
      const sourceName = findCardName(state, command.sourceInstanceId)
      const costStep = hpTrashStep ?? battleToHandStep ?? selfToDeckBottomStep
      return costStep
        ? `${actor} 發動了「${sourceName}」的技能（${costStep.text}）`
        : `${actor} 發動了「${sourceName}」的技能`
    }
    case 'resolve-ability-effect': {
      const effects = getResolvedEffects(previous, command)
      const opponentBattleToTrash = getOpponentBattleToTrashEffect(effects)
      if (opponentBattleToTrash) {
        const targetCard = command.targetIds[0]
          ? findCard(previous, command.targetIds[0])
          : undefined
        if (targetCard) {
          return `${actor} 將「${targetCard.name}」放入棄牌區`
        }
        const block = getOpponentBattleToTrashBlocker(
          previous,
          command.playerId,
          opponentBattleToTrash,
        )
        if (block) {
          return `${actor} 的效果被「${block.blocker.name}」的效果阻止，無法將對手餅乾移出戰鬥區`
        }
        return (opponentBattleToTrash.min ?? 1) > 0
          ? `${actor} 未找到符合條件的目標，技能未生效`
          : `${actor} 未選擇目標，技能結算完畢`
      }
      const fieldToDeckBottom = getFieldToDeckBottomEffect(effects)
      if (fieldToDeckBottom) {
        const step = describeFieldToDeckBottomStep(
          previous,
          command,
          fieldToDeckBottom,
        )
        return `${actor} ${step.text}`
      }
      const cycleHp = effects.find((effect) => effect.kind === 'cycle-hp')
      if (cycleHp) {
        if (command.targetIds.length === 0) {
          return `${actor} 未選擇目標，技能結算完畢`
        }
        const targetId = command.targetIds[0]
        const targetName = findCardName(previous, targetId)
        const targetSurvived = next.players[command.playerId].battleArea.some(
          (cookie) => cookie.card.instanceId === targetId,
        )
        return targetSurvived
          ? `${actor} 從「${targetName}」取回 1 張 HP 卡`
          : `${actor} 從「${targetName}」取回 1 張 HP 卡，該餅乾因此昏厥`
      }
      const handToHp = effects.find(
        (effect) => effect.kind === 'hand-to-hp' && effect.selectTarget,
      )
      if (handToHp) {
        if (command.targetIds.length === 0) {
          return `${actor} 未選擇目標，技能結算完畢`
        }
        return `${actor} 選擇了「${findCardName(previous, command.targetIds[0])}」作為放置 HP 的目標`
      }
      const outcome = describeDamageOutcome(
        previous,
        next,
        command.playerId,
        effects,
      )
      return outcome
        ? `${actor} 結算效果：${outcome}`
        : `${actor} 結算了效果`
    }
    case 'resolve-place-hand-hp': {
      const targetName = previous.pendingAbilityEffect?.pendingPlace
        ? findCardName(
            previous,
            previous.pendingAbilityEffect.pendingPlace.targetInstanceId,
          )
        : null
      return command.handCardInstanceId
        ? `${actor} 將 1 張手牌放到「${targetName ?? '目標'}」的 HP 最上方`
        : `${actor} 略過放置 HP`
    }
    case 'resolve-reorder-hp': {
      const targetName = previous.pendingAbilityEffect?.pendingReorderHp
        ? findCardName(
            previous,
            previous.pendingAbilityEffect.pendingReorderHp.targetInstanceId,
          )
        : null
      return `${actor} 重新排列了 ${targetName ?? '目標餅乾'} 的 HP 卡`
    }
    case 'skip-on-play': {
      const blockedStep = describeBlockedOnPlayMovement(
        state,
        command.sourceInstanceId,
        command.playerId,
      )
      return blockedStep
        ? `${actor} 無法發動「${findCardName(state, command.sourceInstanceId)}」的登場效果：${blockedStep.text.replace(/^效果未生效：/, '')}`
        : `${actor} 選擇不發動「${findCardName(state, command.sourceInstanceId)}」的登場效果`
    }
    case 'replace-cookie':
      return `${actor} 補位了「${findCardName(state, command.instanceId)}」`
    case 'skip-replacement':
      return `${actor} 選擇不補位`
    case 'refresh-deck':
      return `${actor} 讓「${findCardName(state, command.cookieInstanceId)}」進行調度`
    case 'advance-phase': {
      const drawnCount =
        next.players[command.playerId].hand.length -
        previous.players[command.playerId].hand.length
      return drawnCount > 0
        ? `${actor} 抽了 ${drawnCount} 張牌`
        : `${actor} 推進了階段`
    }
    case 'select-starting-cookie':
      return `${actor} 選擇了先發餅乾「${findCardName(state, command.instanceId)}」`
    case 'keep-opening-hand':
      return `${actor} 保留了起始手牌`
    case 'mulligan-opening-hand':
      return `${actor} 重新抽取了起始手牌`
    case 'force-mulligan-opening-hand':
      return `${actor} 被要求重新抽取起始手牌`
    case 'draw-mulligan-compensation':
      return `${actor} 抽取了補償手牌`
    case 'resolve-flip': {
      const flippedCard = previous.pendingBattle?.revealedHpCard
      const cardLabel = flippedCard ? `「${flippedCard.name}」` : ''
      return command.activate
        ? `${actor} 翻開${cardLabel}，發動了 FLIP 效果`
        : `${actor} 翻開${cardLabel}，選擇不發動 FLIP 效果`
    }
    case 'resolve-attack-effect': {
      const outcome = describeDamageOutcome(
        previous,
        next,
        command.playerId,
        getResolvedEffects(previous, command),
      )
      return outcome
        ? `${actor} 結算攻擊後續效果：${outcome}`
        : `${actor} 結算了攻擊後續效果`
    }
    case 'resolve-next-damage': {
      const revealed = resolveRevealedDamageCard(previous, next, command.playerId)
      const sequence = previous.pendingBattle?.effectDamageSequence
      const damageTargetId =
        previous.pendingBattle?.damageTargetInstanceId ??
        previous.pendingBattle?.targetInstanceId
      const damageTargetName = damageTargetId
        ? findCardName(previous, damageTargetId)
        : null
      if (sequence && damageTargetName) {
        return revealed
          ? `${actor} 的「${damageTargetName}」受到 1 點傷害，翻開了 HP 卡「${revealed.name}」`
          : `${actor} 的「${damageTargetName}」未受到傷害`
      }
      return revealed
        ? `${actor} 翻開了 HP 卡「${revealed.name}」`
        : `${actor} 結算了下一段傷害`
    }
    case 'resolve-battle':
      return `${actor} 自動結算了戰鬥`
    case 'resolve-faint-effect':
      return `${actor} 決定了擊倒效果的目標`
    case 'resolve-opponent-hand-discard':
      return `${actor} 選擇了要棄掉的手牌`
    case 'resolve-opponent-rest-support':
      return `${actor} 選擇了要橫置的支援卡`
    case 'resolve-inspect-deck':
      return `${actor} 決定了檢視牌庫的結果`
    case 'resolve-optional-cost-attack':
      return command.action === 'pay'
        ? `${actor} 支付了額外代價`
        : `${actor} 選擇不支付額外代價`
    case 'resolve-draw-up-to':
      return `${actor} 抽了 ${command.drawCount} 張牌`
    case 'resolve-stage-trigger':
      return command.action === 'activate'
        ? `${actor} 發動了場景觸發效果`
        : `${actor} 選擇不發動場景觸發效果`
    case 'resolve-after-damage-effect':
      return `${actor} 決定了傷害後效果的目標`
    case 'resolve-effect-order':
      return `${actor} 決定了效果的結算順序`
    default:
      return `${actor} 執行了 ${(command as GameCommand).kind}`
  }
}

/**
 * commandKind -> 對戰紀錄分類，供 UI 篩選 chip 使用。用 `Record<GameCommand['kind'], LogCategory>`
 * （不是 `Partial`）讓 TS 強制窮舉——未來新增 commandKind 忘記歸類會直接編譯失敗。
 */
export const LOG_CATEGORY_BY_COMMAND_KIND: Record<GameCommand['kind'], LogCategory> = {
  'keep-opening-hand': 'system',
  'mulligan-opening-hand': 'system',
  'force-mulligan-opening-hand': 'system',
  'draw-mulligan-compensation': 'draw',
  'select-starting-cookie': 'deploy',

  // advance-phase 若偵測到抽牌，由 resolveLogCategory 覆寫成 'draw'。
  'advance-phase': 'phase',

  'place-support': 'deploy',
  'deploy-cookie': 'deploy',
  'play-stage': 'deploy',
  'replace-cookie': 'deploy',
  'skip-replacement': 'system',
  'refresh-deck': 'system',

  attack: 'attack',
  'declare-attack': 'attack',
  'resolve-optional-cost-attack': 'attack',
  'resolve-attack-effect': 'attack',
  'resolve-next-damage': 'damage',
  'resolve-battle': 'attack',
  'resolve-after-damage-effect': 'damage',
  'resolve-faint-effect': 'activate',
  'resolve-flip': 'flip',

  'play-trap': 'activate',
  'skip-trap': 'system',
  'play-blocker': 'activate',
  'play-attack-response': 'activate',

  'activate-skill': 'activate',
  'begin-activate-skill': 'activate',
  'skip-on-play': 'system',
  'play-item': 'activate',
  'begin-play-item': 'activate',
  'activate-stage': 'activate',
  'begin-activate-stage': 'activate',
  'resolve-ability-effect': 'activate',
  'resolve-place-hand-hp': 'activate',
  'resolve-reorder-hp': 'activate',
  'resolve-choose-one': 'activate',
  'resolve-opponent-hand-discard': 'activate',
  'resolve-opponent-rest-support': 'activate',
  'resolve-inspect-deck': 'activate',
  'resolve-reveal-top-deck': 'activate',
  'resolve-draw-up-to': 'draw',
  'resolve-stage-trigger': 'activate',
  'resolve-effect-order': 'system',
}

export const resolveLogCategory = (
  previous: GameState,
  next: GameState,
  command: GameCommand,
): LogCategory => {
  if (command.kind === 'advance-phase') {
    const drawnCount =
      next.players[command.playerId].hand.length -
      previous.players[command.playerId].hand.length
    if (drawnCount > 0) return 'draw'
  }
  return LOG_CATEGORY_BY_COMMAND_KIND[command.kind]
}

/** 依 instanceId 陣列找出對應卡片，找不到的直接濾掉（理論上不會發生，防呆用）。 */
const resolveCards = (state: GameState, ids: string[]): GameCard[] =>
  ids
    .map((id) => findCard(state, id))
    .filter((card): card is GameCard => card !== undefined)

const describeCardListStep = (
  state: GameState,
  label: string,
  ids: string[] | undefined,
): LogStepDetail | undefined => {
  if (!ids || ids.length === 0) return undefined
  const cards = resolveCards(state, ids)
  return {
    text: `${label}：${cards.map((card) => card.name).join('、')}`,
    cards,
  }
}

const describeEffectTargetsSteps = (
  state: GameState,
  effectTargets: string[][] | undefined,
  effects: CardEffect[] = [],
): LogStepDetail[] =>
  (effectTargets ?? [])
    .map((targetIds, index) => {
      const effect = effects[index]
      return describeCardListStep(
        state,
        effect?.kind === 'opponent-battle-to-trash'
          ? '效果結算：放入棄牌區'
          : `第 ${index + 1} 個效果目標`,
        targetIds,
      )
    })
    .filter((step): step is LogStepDetail => step !== undefined)

const describeChooseOneSteps = (chooseOneModes: number[] | undefined): LogStepDetail[] =>
  (chooseOneModes ?? []).map((modeIndex, index) => ({
    text: `第 ${index + 1} 個「選擇一項」效果：選了第 ${modeIndex + 1} 個選項`,
  }))

/**
 * 針對「單筆 entry 但 payload 已經帶齊所有子步驟資料」的批次指令，合成逐步驟文字＋
 * 對應卡片給 UI 展開用（每個步驟都能顯示實際用了哪些卡的縮圖，不是只給數量）。
 * 其餘 kind（例如互動式的 begin-* 系列，步驟本來就分散在多筆各自的 log entry 裡）
 * 回傳 undefined，UI 端改用同一個 groupId 底下其他 entry 的 summary/card 當步驟。
 */
export const describeCommandSteps = (
  previous: GameState,
  next: GameState,
  command: GameCommand,
): LogStepDetail[] | undefined => {
  const state = previous

  switch (command.kind) {
    case 'play-trap': {
      const steps: LogStepDetail[] = []
      const paymentStep = describeCardListStep(state, '支付能量（橫置）', command.paymentIds)
      if (paymentStep) steps.push(paymentStep)
      const discardStep = describeCardListStep(state, '額外代價：棄置手牌', command.discardHandIds)
      if (discardStep) steps.push(discardStep)
      const handToBreakStep = describeCardListStep(
        state,
        '額外代價：手牌送入休息區',
        command.handToBreakIds,
      )
      if (handToBreakStep) steps.push(handToBreakStep)
      const trashBattleStep = describeCardListStep(
        state,
        '額外代價：戰鬥區送入棄牌區',
        command.trashBattleCookieIds,
      )
      if (trashBattleStep) steps.push(trashBattleStep)
      const supportTrashStep = describeCardListStep(
        state,
        '額外代價：支援區送入棄牌區',
        command.supportTrashIds,
      )
      if (supportTrashStep) steps.push(supportTrashStep)
      const supportToHandStep = describeCardListStep(
        state,
        '額外代價：支援卡返回手牌',
        command.supportToHandIds,
      )
      if (supportToHandStep) steps.push(supportToHandStep)
      const handToSupportStep = describeCardListStep(
        state,
        '額外代價：手牌橫置入支援區',
        command.handToSupportIds,
      )
      if (handToSupportStep) steps.push(handToSupportStep)
      const trashToDeckStep = describeCardListStep(
        state,
        '額外代價：棄牌區卡片洗回牌庫',
        command.trashToDeckIds,
      )
      if (trashToDeckStep) steps.push(trashToDeckStep)
      const targetStep = describeCardListStep(state, '選擇目標', command.targetIds)
      if (targetStep) steps.push(targetStep)
      const selfTargetStep = describeCardListStep(state, '選擇自身目標', command.selfTargetIds)
      if (selfTargetStep) steps.push(selfTargetStep)
      return steps
    }
    case 'activate-skill':
    case 'begin-activate-skill': {
      const steps: LogStepDetail[] = []
      const paymentStep = describeCardListStep(state, '支付能量（橫置）', command.paymentIds)
      if (paymentStep) steps.push(paymentStep)
      const supportTrashStep = describeCardListStep(
        state,
        '額外代價：支援區送入棄牌區',
        command.costSupportToTrashIds,
      )
      if (supportTrashStep) steps.push(supportTrashStep)
      const discardStep = describeCardListStep(state, '額外代價：棄置手牌', command.discardHandIds)
      if (discardStep) steps.push(discardStep)
      const hpTrashStep = describeHpTrashStep(
        state,
        next,
        command.hpToTrashTargetIds,
      )
      if (hpTrashStep) steps.push(hpTrashStep)
      const selfToDeckBottomStep = describeSelfToDeckBottomCostStep(
        state,
        command,
      )
      if (selfToDeckBottomStep) steps.push(selfToDeckBottomStep)
      const trashBattleStep = describeCardListStep(
        state,
        '額外代價：戰鬥區送入棄牌區',
        command.trashBattleCookieIds,
      )
      if (trashBattleStep) steps.push(trashBattleStep)
      const battleToHandStep = describeCardListStep(
        state,
        '技能代價：將戰鬥區餅乾返回手牌',
        command.battleToHandIds,
      )
      if (battleToHandStep) steps.push(battleToHandStep)
      const trashToDeckBottomStep = describeCardListStep(
        state,
        '額外代價：棄牌區卡片洗到牌庫底',
        command.trashToDeckBottomIds,
      )
      if (trashToDeckBottomStep) steps.push(trashToDeckBottomStep)
      const trashToDeckStep = describeCardListStep(
        state,
        '額外代價：棄牌區卡片洗回牌庫',
        command.trashToDeckIds,
      )
      if (trashToDeckStep) steps.push(trashToDeckStep)
      steps.push(
        ...describeEffectTargetsSteps(
          state,
          'effectTargets' in command ? command.effectTargets : undefined,
          getResolvedEffects(state, command),
        ),
      )
      steps.push(...describeChooseOneSteps(command.chooseOneModes))
      const outcome = describeDamageOutcome(
        previous,
        next,
        command.playerId,
        getResolvedEffects(previous, command),
      )
      if (outcome) steps.push({ text: `效果結算：${outcome}` })
      return steps
    }
    case 'play-item':
    case 'activate-stage': {
      const steps: LogStepDetail[] = []
      const paymentStep = describeCardListStep(state, '支付能量（橫置）', command.paymentIds)
      if (paymentStep) steps.push(paymentStep)
      const supportTrashStep = describeCardListStep(
        state,
        '額外代價：支援區送入棄牌區',
        command.supportToTrashIds,
      )
      if (supportTrashStep) steps.push(supportTrashStep)
      const supportToHandStep = describeCardListStep(
        state,
        '額外代價：支援卡返回手牌',
        command.supportToHandIds,
      )
      if (supportToHandStep) steps.push(supportToHandStep)
      const discardStep = describeCardListStep(state, '額外代價：棄置手牌', command.discardHandIds)
      if (discardStep) steps.push(discardStep)
      const hpToTrashStep = describeCardListStep(
        state,
        '額外代價：HP 卡送入棄牌區',
        command.hpToTrashTargetIds,
      )
      if (hpToTrashStep) steps.push(hpToTrashStep)
      const trashBattleStep = describeCardListStep(
        state,
        '額外代價：戰鬥區送入棄牌區',
        command.trashBattleCookieIds,
      )
      if (trashBattleStep) steps.push(trashBattleStep)
      steps.push(
        ...describeEffectTargetsSteps(
          state,
          command.effectTargets,
          getResolvedEffects(state, command),
        ),
      )
      steps.push(...describeChooseOneSteps(command.chooseOneModes))
      const outcome = describeDamageOutcome(
        previous,
        next,
        command.playerId,
        getResolvedEffects(previous, command),
      )
      if (outcome) steps.push({ text: `效果結算：${outcome}` })
      return steps
    }
    case 'resolve-ability-effect': {
      const resolvedEffects = getResolvedEffects(previous, command)
      const effect = getOpponentBattleToTrashEffect(
        resolvedEffects,
      )
      if (effect) {
        return [describeOpponentBattleToTrashStep(previous, command, effect)]
      }
      const fieldToDeckBottom = getFieldToDeckBottomEffect(resolvedEffects)
      return fieldToDeckBottom
        ? [describeFieldToDeckBottomStep(previous, command, fieldToDeckBottom)]
        : undefined
    }
    case 'skip-on-play': {
      const blockedStep = describeBlockedOnPlayMovement(
        state,
        command.sourceInstanceId,
        command.playerId,
      )
      return blockedStep ? [blockedStep] : undefined
    }
    case 'attack':
    case 'declare-attack': {
      const opponentId = getOpponentId(command.playerId)
      const targetBefore = previous.players[opponentId].battleArea.find(
        (cookie) => cookie.card.instanceId === command.targetInstanceId,
      )
      const targetAfter = next.players[opponentId].battleArea.find(
        (cookie) => cookie.card.instanceId === command.targetInstanceId,
      )
      const hpBefore = targetBefore?.hpCards.length ?? 0
      const hpAfter = targetAfter?.hpCards.length ?? 0
      const damage = Math.max(0, hpBefore - hpAfter)
      const attackerCard = findCard(state, command.attackerInstanceId)
      const targetCard = findCard(state, command.targetInstanceId)
      const outcome =
        hpBefore > 0 && hpAfter === 0
          ? `擊倒「${targetCard?.name ?? '未知卡牌'}」`
          : damage > 0
            ? `造成 ${damage} 點傷害`
            : '未造成傷害'
      return [
        {
          text: `宣告攻擊：「${attackerCard?.name ?? '未知卡牌'}」→「${targetCard?.name ?? '未知卡牌'}」`,
          cards: [attackerCard, targetCard].filter(
            (card): card is GameCard => card !== undefined,
          ),
        },
        ...(() => {
          const restriction = describeForcedAttackRestriction(
            state,
            command.playerId,
          )
          return restriction ? [restriction] : []
        })(),
        { text: `自動結算戰鬥，${outcome}`, cards: targetCard ? [targetCard] : undefined },
      ]
    }
    default:
      return undefined
  }
}

/**
 * 這筆指令主要「關於」哪一張卡——供 UI 在對戰紀錄顯示卡圖縮圖用。純系統/階段類
 * 指令（advance-phase／skip-trap／resolve-battle……）沒有對應單一卡片，回傳
 * undefined，UI 端只顯示分類圖示。
 */
export const resolveLogCard = (
  previous: GameState,
  next: GameState,
  command: GameCommand,
): GameCard | undefined => {
  switch (command.kind) {
    case 'play-trap':
      return findCard(previous, command.trapInstanceId)
    case 'skip-on-play':
    case 'play-blocker':
    case 'activate-skill':
    case 'begin-activate-skill':
      return findCard(previous, command.sourceInstanceId)
    case 'play-item':
    case 'begin-play-item':
    case 'play-stage':
    case 'place-support':
    case 'deploy-cookie':
    case 'select-starting-cookie':
    case 'replace-cookie':
      return findCard(previous, command.instanceId)
    case 'refresh-deck':
      return findCard(previous, command.cookieInstanceId)
    case 'attack':
    case 'declare-attack':
      return findCard(previous, command.attackerInstanceId)
    case 'activate-stage':
    case 'begin-activate-stage':
      return previous.players[command.playerId].stage?.card
    case 'resolve-next-damage':
      return resolveRevealedDamageCard(previous, next, command.playerId)
    case 'resolve-flip':
      return previous.pendingBattle?.revealedHpCard ?? undefined
    default:
      return undefined
  }
}
