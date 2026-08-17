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
  EffectTargetSelector,
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

type PendingDrawUpTo = NonNullable<GameState['pendingDrawUpTo']>

/** 將待處理抽牌的來源與條件寫成玩家看得懂的原因，避免只看到「抽了 N 張」。 */
const describeDrawUpToReasonText = (
  state: GameState,
  pending: PendingDrawUpTo,
): string => {
  const sourceCard = findCard(state, pending.sourceInstanceId)
  const sourceId = pending.sourceCardId ?? sourceCard?.id
  const sourceLabel = sourceId
    ? `${sourceId} ${pending.sourceCardName}`
    : pending.sourceCardName
  const isSkill = sourceId?.startsWith('P-') || Boolean(sourceCard?.skill)

  let conditionText: string | undefined
  const condition = pending.condition
  if (condition?.kind === 'active-support-count-at-least') {
    const activeSupportCount = state.players[pending.sourcePlayerId].supportArea.filter(
      (support) => !support.rested,
    ).length
    conditionText = `支援區有 ${activeSupportCount} 張啟動卡（需要至少 ${condition.count} 張）`
  }

  return `「${sourceLabel}」${isSkill ? '技能' : '效果'}觸發抽牌${
    conditionText ? `：${conditionText}` : ''
  }`
}

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
  if (command.kind === 'resolve-optional-cost-attack') {
    return previous.pendingOptionalCostAttack?.effects ?? []
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
  const visit = (nestedEffects: CardEffect[]) => {
    for (const effect of nestedEffects) {
      if (effect.kind === 'damage-all') {
        addDamageTargetSide(playerIds, sourcePlayerId, effect.side)
        if (effect.target) addDamageTargetSide(playerIds, sourcePlayerId, effect.target.side)
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
      if (
        effect.kind === 'optional-cost-attack' ||
        effect.kind === 'reveal-top-deck' ||
        effect.kind === 'deferred-end-of-turn'
      ) {
        visit(effect.effects)
      }
      if (effect.kind === 'choose-one') {
        for (const mode of effect.modes) visit(mode.effects)
      }
    }
  }
  visit(effects)
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

/** 將攻擊後效果中的巢狀效果攤平，供紀錄判斷實際行為（例如 reveal-top-deck 後再造成傷害）。 */
const flattenAttackEffects = (effects: CardEffect[]): CardEffect[] => {
  const flattened: CardEffect[] = []
  const visit = (nestedEffects: CardEffect[]) => {
    for (const effect of nestedEffects) {
      flattened.push(effect)
      if (
        effect.kind === 'optional-cost-attack' ||
        effect.kind === 'reveal-top-deck' ||
        effect.kind === 'deferred-end-of-turn'
      ) {
        visit(effect.effects)
      }
      if (effect.kind === 'choose-one') {
        for (const mode of effect.modes) visit(mode.effects)
      }
    }
  }
  visit(effects)
  return flattened
}

const getEffectTargetSelectors = (effects: CardEffect[]): EffectTargetSelector[] => {
  const selectors: EffectTargetSelector[] = []
  for (const effect of flattenAttackEffects(effects)) {
    if (!('target' in effect)) continue
    const candidate = effect.target
    if (
      candidate &&
      typeof candidate === 'object' &&
      'side' in candidate &&
      'min' in candidate &&
      'max' in candidate
    ) {
      selectors.push(candidate as EffectTargetSelector)
    }
  }
  return selectors
}

const effectSideLabel = (side: 'self' | 'opponent' | 'either'): string => {
  if (side === 'self') return '我方'
  if (side === 'opponent') return '對手'
  return '任一方'
}

/** 將 runtime effect 寫成短句；完整官方文字仍會另外顯示在來源／效果步驟。 */
const describeAttackEffectAction = (effect: CardEffect): string => {
  switch (effect.kind) {
    case 'damage':
      return `對${effectSideLabel(effect.target.side)}目標造成 ${effect.amount} 點傷害`
    case 'split-damage':
      return `分別造成 ${effect.primaryAmount} 與 ${effect.secondaryAmount} 點傷害`
    case 'damage-all':
      return `對${effectSideLabel(effect.side)}所有餅乾造成 ${effect.amount} 點傷害`
    case 'damage-by-break-count':
      return `依休息區條件造成傷害（每張 ${effect.perCount} 點）`
    case 'damage-by-break-level-difference':
      return '依休息區等級差造成傷害'
    case 'gain-hp':
      return `使目標增加 ${effect.amount} 點 HP`
    case 'draw':
      return `抽 ${effect.amount} 張牌`
    case 'draw-up-to':
      return `抽至多 ${effect.max} 張牌`
    case 'draw-up-to-then-discard':
      return `抽至多 ${effect.max} 張牌，再棄置 ${effect.discardCount} 張`
    case 'support-to-hand':
      return `將 ${effect.amount} 張支援卡返回手牌`
    case 'support-to-trash':
      return `將 ${effect.amount} 張支援卡放入棄牌區`
    case 'set-active':
      return `將 ${effect.supportCount} 張支援卡設為啟動`
    case 'rest-support':
      return `將 ${effect.amount} 張支援卡橫置`
    case 'rest-support-and-damage':
      return `橫置 ${effect.supportAmount} 張支援卡並造成傷害`
    case 'modify-attack':
      return `使目標攻擊力 ${effect.amount >= 0 ? '+' : ''}${effect.amount}`
    case 'modify-attack-by-break-count':
      return '依休息區張數修改目標攻擊力'
    case 'break-to-battle':
      return `從休息區登場至多 ${effect.amount} 張餅乾`
    case 'trash-to-battle':
      return `從棄牌區登場至多 ${effect.amount} 張餅乾`
    case 'battle-to-break':
      return '將目標餅乾放入休息區'
    case 'opponent-battle-to-trash':
      return '將對手目標餅乾放入棄牌區'
    case 'return-to-hand':
      return '將目標返回手牌'
    case 'return-to-deck-bottom':
      return '將目標放到牌庫底'
    case 'hp-to-trash':
      return `從目標 HP 丟棄 ${effect.amount} 張 HP 卡`
    case 'hp-to-hand':
      return `將目標 HP 卡返回手牌（至多 ${effect.amount} 張）`
    case 'hp-to-support':
      return `將 ${effect.amount} 張 HP 卡放入支援區`
    case 'deck-to-trash':
      return `將牌庫頂 ${effect.amount} 張牌放入棄牌區`
    case 'reveal-top-deck':
      return `揭示牌庫頂牌，符合條件時：${effect.effects
        .map(describeAttackEffectAction)
        .join('；')}`
    case 'choose-one':
      return `從 ${effect.modes.length} 個效果中選擇一項`
    case 'optional-cost-attack':
      return effect.effectText
    default:
      return `執行 ${effect.kind}`
  }
}

const getAttackEffectSourceCard = (
  state: GameState,
  command: Extract<
    GameCommand,
    { kind: 'resolve-attack-effect' | 'resolve-optional-cost-attack' }
  >,
): GameCard | undefined => {
  const sourceInstanceId =
    command.kind === 'resolve-attack-effect'
      ? state.pendingBattle?.attackerInstanceId
      : state.pendingOptionalCostAttack?.sourceInstanceId
  return sourceInstanceId ? findCard(state, sourceInstanceId) : undefined
}

const getAttackEffectText = (
  sourceCard: GameCard | undefined,
  effect: CardEffect | undefined,
  explicitText?: string,
): string => {
  if (explicitText) return explicitText
  if (!effect) return '未找到攻擊後效果'
  if (effect.kind === 'optional-cost-attack') return effect.effectText

  const attackText = sourceCard?.type === 'cookie' ? sourceCard.attackText : undefined
  const thenIndex = attackText?.search(/\bThen\s*,/i) ?? -1
  if (thenIndex >= 0 && attackText) {
    const commaIndex = attackText.indexOf(',', thenIndex)
    return attackText.slice(commaIndex + 1).trim()
  }
  return describeAttackEffectAction(effect)
}

const describeAttackEffectSourceStep = (
  state: GameState,
  command: Extract<
    GameCommand,
    { kind: 'resolve-attack-effect' | 'resolve-optional-cost-attack' }
  >,
  effect: CardEffect | undefined,
  explicitText?: string,
): LogStepDetail => {
  const sourceCard = getAttackEffectSourceCard(state, command)
  const sourceName =
    sourceCard?.name ??
    (command.kind === 'resolve-optional-cost-attack'
      ? state.pendingOptionalCostAttack?.sourceCardName
      : undefined) ??
    '未知餅乾'
  return {
    text: `攻擊後效果來源：「${sourceName}」；效果：${getAttackEffectText(sourceCard, effect, explicitText)}`,
    cards: sourceCard ? [sourceCard] : undefined,
  }
}

const describeAttackEffectTargetStep = (
  state: GameState,
  effect: CardEffect | undefined,
  targetIds: string[] | undefined,
  sourceCard: GameCard | undefined,
): LogStepDetail | undefined => {
  const ids = targetIds ?? []
  if (ids.length > 0) {
    return describeCardListStep(state, '攻擊後效果目標', ids)
  }
  if (!effect) return undefined

  // reveal-top-deck／choose-one 會先進入另一個待決策流程，這一筆攻擊後
  // 指令尚未真正選目標；不要把巢狀效果的必選目標誤寫成「沒有合法目標」。
  const selectors =
    effect.kind === 'reveal-top-deck' || effect.kind === 'choose-one'
      ? []
      : getEffectTargetSelectors([effect])
  if (selectors.length === 0) return undefined
  if (selectors.some((selector) => selector.sourceOnly) && sourceCard) {
    return {
      text: `攻擊後效果目標：「${sourceCard.name}」`,
      cards: [sourceCard],
    }
  }
  return selectors.some((selector) => selector.min > 0)
    ? { text: '攻擊後效果未生效：沒有符合條件的目標' }
    : { text: '攻擊後效果目標：未選擇目標（效果未生效）' }
}

const describeGainHpOutcome = (
  previous: GameState,
  next: GameState,
  sourcePlayerId: PlayerId,
  effects: CardEffect[],
): string | null => {
  if (!flattenAttackEffects(effects).some((effect) => effect.kind === 'gain-hp')) {
    return null
  }
  const targetPlayers = getEffectTargetSelectors(effects).reduce((players, selector) => {
    addDamageTargetSide(players, sourcePlayerId, selector.side)
    return players
  }, new Set<PlayerId>())
  if (targetPlayers.size === 0) targetPlayers.add(sourcePlayerId)

  const outcomes: string[] = []
  for (const playerId of targetPlayers) {
    const afterBattle = new Map(
      next.players[playerId].battleArea.map((cookie) => [cookie.card.instanceId, cookie]),
    )
    for (const before of previous.players[playerId].battleArea) {
      const after = afterBattle.get(before.card.instanceId)
      const gained = (after?.hpCards.length ?? 0) - before.hpCards.length
      if (gained > 0 && after) outcomes.push(`「${before.card.name}」增加 ${gained} 點 HP`)
    }
  }
  return outcomes.length > 0 ? outcomes.join('；') : '未增加 HP'
}

const describeAttackEffectResultStep = (
  previous: GameState,
  next: GameState,
  commandPlayerId: PlayerId,
  effects: CardEffect[],
): LogStepDetail => {
  const continuation = next.pendingBattle?.effectDamageSequence?.continuation
  if (
    continuation === 'attack-effect' ||
    next.pendingBattle?.stage === 'damage' ||
    next.pendingRevealTopDeck?.battleContinuation === 'attack-effect' ||
    next.pendingAbilityEffect?.battleContinuation === 'attack-effect'
  ) {
    return { text: '攻擊後效果結果：等待後續傷害／FLIP 或巢狀效果結算' }
  }
  const damageOutcome = describeDamageOutcome(
    previous,
    next,
    commandPlayerId,
    effects,
  )
  if (damageOutcome) return { text: `攻擊後效果結果：${damageOutcome}` }
  const gainHpOutcome = describeGainHpOutcome(
    previous,
    next,
    commandPlayerId,
    effects,
  )
  if (gainHpOutcome) return { text: `攻擊後效果結果：${gainHpOutcome}` }
  return {
    text: `攻擊後效果結果：${flattenAttackEffects(effects)
      .map(describeAttackEffectAction)
      .join('；') || '效果已結算'}`,
  }
}

const describeAttackEffectEnergyStep = (
  sourceCard: GameCard | undefined,
  sourceEnergy: Partial<Record<string, number>> | undefined,
): LogStepDetail | undefined => {
  if (!sourceEnergy || Object.values(sourceEnergy).every((amount) => !amount)) {
    return undefined
  }
  const labels: Record<string, string> = {
    red: '紅',
    yellow: '黃',
    green: '綠',
    blue: '藍',
    purple: '紫',
    black: '黑',
    pure: '純',
    neutral: '無色',
  }
  const costText = Object.entries(sourceEnergy)
    .filter(([, amount]) => amount !== undefined && amount > 0)
    .map(([color, amount]) => `${labels[color] ?? color}${amount}`)
    .join('、')
  return {
    text: `攻擊後代價：由「${sourceCard?.name ?? '攻擊餅乾'}」提供 ${costText} 能量`,
    cards: sourceCard ? [sourceCard] : undefined,
  }
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
      if (next.pendingBattle?.effectDamageSequence) {
        return `${actor} 結算效果：等待後續傷害結算`
      }
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
      const resolvedEffects = getResolvedEffects(previous, command)
      const sourceCard = getAttackEffectSourceCard(previous, command)
      const sourceName = sourceCard?.name ?? '未知餅乾'
      const effectText = getAttackEffectText(sourceCard, resolvedEffects[0])
      if (resolvedEffects[0]?.kind === 'optional-cost-attack') {
        return next.pendingOptionalCostAttack
          ? `${actor} 等待選擇「${sourceName}」的攻擊後效果：${effectText}`
          : `${actor} 的「${sourceName}」攻擊後效果未生效：沒有合法目標或條件不成立`
      }
      const outcome = describeDamageOutcome(
        previous,
        next,
        command.playerId,
        resolvedEffects,
      )
      return outcome
        ? `${actor} 結算「${sourceName}」的攻擊後效果：${effectText}；${outcome}`
        : `${actor} 結算「${sourceName}」的攻擊後效果：${effectText}`
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
    case 'resolve-battle': {
      // Ability damage uses the battle state machine internally, so one
      // resolve-battle command may finish every selected target at once.
      // Preserve the actual HP delta in the log instead of leaving the
      // preceding target-selection entry as the only explanation.
      const pendingAbility = previous.pendingAbilityEffect
      const effectSequence = previous.pendingBattle?.effectDamageSequence
      if (pendingAbility && effectSequence) {
        const outcome = describeDamageOutcome(
          previous,
          next,
          pendingAbility.sourcePlayerId,
          pendingAbility.effects,
        )
        return outcome
          ? `${actor} 自動結算了戰鬥：${outcome}`
          : `${actor} 自動結算了戰鬥`
      }
      return `${actor} 自動結算了戰鬥`
    }
    case 'resolve-faint-effect':
      return `${actor} 決定了擊倒效果的目標`
    case 'resolve-opponent-hand-discard':
      return `${actor} 選擇了要棄掉的手牌`
    case 'resolve-opponent-rest-support':
      return `${actor} 選擇了要橫置的支援卡`
    case 'resolve-inspect-deck':
      return `${actor} 決定了檢視牌庫的結果`
    case 'resolve-optional-cost-attack':
      {
        const pending = previous.pendingOptionalCostAttack
        const sourceCard = getAttackEffectSourceCard(previous, command)
        const sourceName =
          sourceCard?.name ?? pending?.sourceCardName ?? '未知餅乾'
        const effectText = getAttackEffectText(
          sourceCard,
          pending?.effects[0],
          pending?.effectText,
        )
        if (command.action === 'skip') {
          return `${actor} 選擇略過「${sourceName}」的攻擊後效果（未支付代價，後續動作未執行）`
        }
        const outcome = describeAttackEffectResultStep(
          previous,
          next,
          command.playerId,
          pending?.effects ?? [],
        ).text
        return `${actor} 支付「${sourceName}」的攻擊後代價並結算效果：${effectText}；${outcome.replace(/^攻擊後效果結果：/, '')}`
      }
    case 'resolve-draw-up-to': {
      const pending = state.pendingDrawUpTo
      const reason = pending
        ? describeDrawUpToReasonText(state, pending)
        : undefined
      return reason
        ? `${actor} 因${reason}，抽了 ${command.drawCount} 張牌`
        : `${actor} 抽了 ${command.drawCount} 張牌`
    }
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
      const trapCard = findCard(state, command.trapInstanceId)
      if (trapCard?.type === 'trap') {
        steps.push({
          text: `發動陷阱卡：「${trapCard.name}」`,
          cards: [trapCard],
        })
      }
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
    case 'resolve-attack-effect': {
      const effects = getResolvedEffects(previous, command)
      const effect = effects[0]
      const sourceCard = getAttackEffectSourceCard(previous, command)
      const steps: LogStepDetail[] = [
        describeAttackEffectSourceStep(previous, command, effect),
      ]
      if (effect?.kind === 'optional-cost-attack') {
        steps.push(
          next.pendingOptionalCostAttack
            ? { text: '攻擊後效果：等待玩家選擇支付代價或略過' }
            : { text: '攻擊後效果未生效：沒有合法目標或條件不成立' },
        )
        return steps
      }
      const targetStep = describeAttackEffectTargetStep(
        state,
        effect,
        command.targetIds,
        sourceCard,
      )
      if (targetStep) steps.push(targetStep)
      if (effect) {
        steps.push(
          describeAttackEffectResultStep(
            previous,
            next,
            command.playerId,
            effects,
          ),
        )
      }
      return steps
    }
    case 'resolve-optional-cost-attack': {
      const pending = previous.pendingOptionalCostAttack
      if (!pending) return undefined
      const sourceCard = getAttackEffectSourceCard(previous, command)
      const steps: LogStepDetail[] = [
        describeAttackEffectSourceStep(
          previous,
          command,
          pending.effects[0],
          pending.effectText,
        ),
      ]
      if (command.action === 'skip') {
        steps.push({
          text: '玩家選擇略過攻擊後效果，未支付代價，後續動作未執行',
        })
        return steps
      }

      const sourceEnergyStep = describeAttackEffectEnergyStep(
        sourceCard,
        pending.sourceEnergy,
      )
      if (sourceEnergyStep) steps.push(sourceEnergyStep)
      const paymentStep = describeCardListStep(
        state,
        '攻擊後代價：支付能量（橫置）',
        command.paymentIds,
      )
      if (paymentStep) steps.push(paymentStep)
      const discardStep = describeCardListStep(
        state,
        '攻擊後代價：棄置手牌',
        command.discardCardIds,
      )
      if (discardStep) steps.push(discardStep)
      const supportToHandStep = describeCardListStep(
        state,
        '攻擊後代價：支援卡返回手牌',
        command.supportToHandIds,
      )
      if (supportToHandStep) steps.push(supportToHandStep)
      const hpToTrashStep = describeHpTrashStep(
        state,
        next,
        command.hpToTrashIds,
      )
      if (hpToTrashStep) steps.push(hpToTrashStep)
      const trashToDeckStep = describeCardListStep(
        state,
        '攻擊後代價：棄牌區卡片洗回牌庫',
        command.trashToDeckIds,
      )
      if (trashToDeckStep) steps.push(trashToDeckStep)
      if (
        !sourceEnergyStep &&
        !paymentStep &&
        !discardStep &&
        !supportToHandStep &&
        !hpToTrashStep &&
        !trashToDeckStep
      ) {
        steps.push({ text: '攻擊後代價：已支付（無需額外選牌）' })
      }
      const targetStep = describeAttackEffectTargetStep(
        state,
        pending.effects[0],
        command.targetIds,
        sourceCard,
      )
      if (targetStep) steps.push(targetStep)
      steps.push(
        describeAttackEffectResultStep(
          previous,
          next,
          command.playerId,
          pending.effects,
        ),
      )
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
    case 'resolve-faint-effect': {
      const pending = previous.pendingFaintEffects?.[0]
      if (!pending) return undefined
      const steps: LogStepDetail[] = []
      const sourceCard = findCard(previous, pending.sourceInstanceId)
      if (sourceCard) {
        steps.push({
          text: `昏厥效果來源：「${sourceCard.name}」；效果：${
            sourceCard.effectText ?? sourceCard.skill?.text ?? pending.sourceCardName ?? '昏厥效果'
          }`,
          cards: [sourceCard],
        })
      }
      const paymentStep = describeCardListStep(
        state,
        '昏厥效果代價：支付能量（橫置）',
        command.paymentIds,
      )
      if (paymentStep) steps.push(paymentStep)
      const discardStep = describeCardListStep(
        state,
        '昏厥效果代價：棄置手牌',
        command.discardHandIds,
      )
      if (discardStep) steps.push(discardStep)
      const supportTrashStep = describeCardListStep(
        state,
        '昏厥效果代價：支援區送入棄牌區',
        command.supportToTrashIds,
      )
      if (supportTrashStep) steps.push(supportTrashStep)
      const targetStep = describeCardListStep(
        state,
        '昏厥效果目標',
        command.targetIds,
      )
      if (targetStep) steps.push(targetStep)
      const outcome = describeDamageOutcome(
        previous,
        next,
        pending.sourcePlayerId,
        [pending.effect],
      )
      if (outcome) {
        steps.push({ text: `昏厥效果結果：${outcome}` })
      } else if (next.pendingInspectDeck || next.pendingAbilityEffect) {
        steps.push({ text: '昏厥效果結果：等待後續效果選擇' })
      } else if (pending.effect) {
        steps.push({ text: '昏厥效果結果：效果已結算' })
      }
      return steps
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
    case 'resolve-draw-up-to': {
      const pending = previous.pendingDrawUpTo
      if (!pending) return undefined
      const sourceCard = findCard(previous, pending.sourceInstanceId)
      const drawnCards = previous.players[command.playerId].deck.slice(
        0,
        command.drawCount,
      )
      return [
        {
          text: `抽牌原因：${describeDrawUpToReasonText(previous, pending)}`,
          cards: sourceCard ? [sourceCard] : undefined,
        },
        {
          text:
            command.drawCount > 0
              ? `抽牌結果：抽了 ${command.drawCount} 張牌`
              : '抽牌結果：選擇不抽牌',
          cards: drawnCards.length > 0 ? drawnCards : undefined,
        },
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
    case 'resolve-attack-effect':
      return previous.pendingBattle?.attackerInstanceId
        ? findCard(previous, previous.pendingBattle.attackerInstanceId)
        : undefined
    case 'resolve-faint-effect': {
      const pending = previous.pendingFaintEffects?.[0]
      return pending
        ? findCard(previous, pending.sourceInstanceId)
        : undefined
    }
    case 'resolve-inspect-deck': {
      const pending = previous.pendingInspectDeck
      return pending
        ? findCard(previous, pending.sourceInstanceId)
        : undefined
    }
    case 'resolve-optional-cost-attack':
      return previous.pendingOptionalCostAttack?.sourceInstanceId
        ? findCard(previous, previous.pendingOptionalCostAttack.sourceInstanceId)
        : undefined
    case 'activate-stage':
    case 'begin-activate-stage':
      return previous.players[command.playerId].stage?.card
    case 'resolve-next-damage':
      return resolveRevealedDamageCard(previous, next, command.playerId)
    case 'resolve-flip':
      return previous.pendingBattle?.revealedHpCard ?? undefined
    case 'resolve-draw-up-to':
      return previous.pendingDrawUpTo
        ? findCard(previous, previous.pendingDrawUpTo.sourceInstanceId)
        : undefined
    default:
      return undefined
  }
}
