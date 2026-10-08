import {
  getCookieEffectiveHp,
  getCookieEffectiveLevel,
  getOpponentId,
} from './helpers'
import { getForcedAttackTargetId, getFaintSourceCostUnavailableReason, getBattleAttackEffectPrevention } from './battle'
import { materializeExtraDeckCookie } from './extra-deck'
import { canActivateCookieSkill, getActiveOnPlayReplacement, getCookieSkillEffects, isSkillEffectConditionDeferredUntilCost } from './skills'
import {
  getEnergyCostTotal,
  getRemainingEnergyCost,
  selectEnergyPayment,
} from './energy'
import {
  getBattleToBreakBlocker,
  getEffectSelectionLimits,
  getFieldToDeckBottomBlocker,
  getEffectTargetCandidates,
  getOpponentBattleMovementPreventer,
  isEffectConditionMet,
  isCookieActivePhasePrevented,
  isProtectedBySoulJamResolution,
} from './effects/targeting'
import type { GameCommand } from './commands'
import type {
  CardEffect,
  EffectContext,
  EffectTargetSelector,
  GameCard,
  GameState,
  LogCategory,
  LogStepDetail,
  PlayerId,
} from './types'

const playerName = (state: GameState, playerId: PlayerId): string =>
  state.players[playerId]?.name ?? playerId

/** 在雙方手牌／牌庫／休息區／棄牌區／戰鬥區（含 HP 卡）／支援區／場景區／EXTRA 區裡找一張卡。 */
const findCard = (state: GameState, instanceId: string): GameCard | undefined => {
  for (const playerId of Object.keys(state.players) as PlayerId[]) {
    const player = state.players[playerId]
    const zones = [
      player.hand,
      player.deck,
      player.breakArea,
      player.discardPile,
      ...player.battleArea.flatMap((entry) => [entry.card, ...entry.hpCards]),
      ...player.battleArea.flatMap(entry => entry.equippedCards ?? []),
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
    const extraCard = player.extraDeck?.find(
      (card) => card.instanceId === instanceId,
    )
    if (extraCard) {
      try {
        return materializeExtraDeckCookie(extraCard)
      } catch {
        // Incomplete legacy EXTRA snapshots still produce a command log; keep
        // the card association absent rather than inventing runtime fields.
      }
    }
  }
  return undefined
}

const findCardName = (state: GameState, instanceId: string): string =>
  findCard(state, instanceId)?.name ?? '未知卡牌'

const describeHandDiscardResult = (
  state: GameState,
  command: Extract<GameCommand, { kind: 'resolve-opponent-hand-discard' }>,
): LogStepDetail => {
  const selectedIds = new Set(command.cardIds)
  const selected = state.players[command.playerId].hand.filter((card) => selectedIds.has(card.instanceId))
  if (selected.length === 0) return { text: '選擇 0 張手牌，不移動手牌。' }
  const destination = state.pendingOpponentHandDiscard?.destination
  if (destination === 'deck-top' || destination === 'deck-bottom') {
    // Returning cards to a hidden deck does not make their identities public.
    return { text: `已將 ${selected.length} 張手牌放到${destination === 'deck-top' ? '牌庫頂' : '牌庫底'}。` }
  }
  return {
    text: `已棄置 ${selected.length} 張手牌至棄牌區：${selected.map((card) => card.name).join('、')}。`,
    cards: selected,
  }
}

/** 回應紀錄需要指出是哪一張裝備／效果鎖住陷阱，不能只寫「未發動」。 */
const findTrapLockSource = (
  state: GameState,
): { sourceName: string; attackerName: string } | undefined => {
  const battle = state.pendingBattle
  if (!battle?.trapsDisabled) return undefined

  const attacker = state.players[battle.attackerPlayerId].battleArea.find(
    (entry) => entry.card.instanceId === battle.attackerInstanceId,
  )
  if (!attacker) return undefined
  const equippedSource = attacker.equippedCards?.find(
    (card) =>
      card.type === 'item' &&
      card.item?.equippedAttackEffects?.some(
        (effect) => effect.kind === 'disable-traps',
      ),
  )
  return {
    sourceName: equippedSource?.name ?? attacker.card.name,
    attackerName: attacker.card.name,
  }
}

/** 公開 trace 需要說明來源本身離開了哪個區域；不能把自我移動吞成空白結算。 */
const findCardZoneLabel = (
  state: GameState,
  instanceId: string,
): string | undefined => {
  for (const playerId of Object.keys(state.players) as PlayerId[]) {
    const player = state.players[playerId]
    if (player.hand.some((card) => card.instanceId === instanceId)) return '手牌'
    if (player.deck.some((card) => card.instanceId === instanceId)) return '牌庫'
    if (player.breakArea.some((card) => card.instanceId === instanceId)) return '休息區'
    if (player.discardPile.some((card) => card.instanceId === instanceId)) return '棄牌區'
    if (player.battleArea.some((entry) => entry.card.instanceId === instanceId)) {
      return '戰鬥區'
    }
    if (player.supportArea.some((entry) => entry.card.instanceId === instanceId)) {
      return '支援區'
    }
    if (player.stage?.card.instanceId === instanceId) return '場景區'
  }
  return undefined
}

const describeSourceMovementOutcome = (
  previous: GameState,
  next: GameState,
  sourceInstanceId: string,
  effects: CardEffect[],
): LogStepDetail | undefined => {
  if (
    !effects.some(
      (effect) =>
        effect.kind === 'field-to-trash' ||
        effect.kind === 'battle-to-break' ||
        effect.kind === 'return-to-deck-bottom',
    )
  ) {
    return undefined
  }
  const from = findCardZoneLabel(previous, sourceInstanceId)
  const to = findCardZoneLabel(next, sourceInstanceId)
  if (!from || !to || from === to) return undefined
  const source = findCard(previous, sourceInstanceId) ?? findCard(next, sourceInstanceId)
  return {
    text: `效果結算：「${source?.name ?? '來源餅乾'}」從${from}送入${to}`,
    cards: source ? [source] : undefined,
  }
}

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

const pendingBattleProgressText: Record<
  NonNullable<GameState['pendingBattle']>['stage'],
  string
> = {
  trap: '戰鬥進行中：等待防守方回應',
  damage: '戰鬥進行中：等待傷害結算',
  flip: '戰鬥進行中：等待 FLIP 處理',
  'attack-effect': '戰鬥進行中：等待攻擊後效果處理',
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

const describeHpToHandStep = (
  previous: GameState,
  next: GameState,
  hpToHandTargetIds: string[] | undefined,
): LogStepDetail | undefined => {
  const targetId = hpToHandTargetIds?.[0]
  if (!targetId) return undefined
  const previousCookie = Object.values(previous.players)
    .flatMap((player) => player.battleArea)
    .find((cookie) => cookie.card.instanceId === targetId)
  const nextCookie = Object.values(next.players)
    .flatMap((player) => player.battleArea)
    .find((cookie) => cookie.card.instanceId === targetId)
  const movedCount = previousCookie && nextCookie
    ? previousCookie.hpCards.length - nextCookie.hpCards.length
    : previousCookie
      ? previousCookie.hpCards.length
      : 0
  if (movedCount <= 0) return undefined
  return {
    text: `攻擊後代價：從「${findCardName(previous, targetId)}」返回 ${movedCount} 張 HP 卡至手牌`,
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

const getBattleToBreakEffect = (
  effects: CardEffect[],
): Extract<CardEffect, { kind: 'battle-to-break' }> | undefined =>
  effects.find(
    (effect): effect is Extract<CardEffect, { kind: 'battle-to-break' }> =>
      effect.kind === 'battle-to-break',
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
      getCookieEffectiveLevel(cookie) > effect.maxLevel
    ) {
      return false
    }
    if (
      effect.minLevel !== undefined &&
      getCookieEffectiveLevel(cookie) < effect.minLevel
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
  next: GameState,
  command: Extract<GameCommand, { kind: 'resolve-ability-effect' }>,
  effect: Extract<CardEffect, { kind: 'field-to-deck-bottom' }>,
): LogStepDetail => {
  const targetCard = command.targetIds[0]
    ? findCard(previous, command.targetIds[0])
    : undefined
  if (targetCard) {
    if (effect.hpOnly) {
      for (const playerId of ['player-one', 'player-two'] as const) {
        const before = previous.players[playerId].battleArea.find(cookie => cookie.card.instanceId === targetCard.instanceId)
        const topHp = before?.hpCards.at(-1)
        if (!before || !topHp) continue
        const after = next.players[playerId].battleArea.find(cookie => cookie.card.instanceId === targetCard.instanceId)
        const moved = next.players[playerId].deck.at(-1)?.instanceId === topHp.instanceId && !after?.hpCards.some(card => card.instanceId === topHp.instanceId)
        return { text: moved
          ? `效果結算：將「${targetCard.name}」最上方 1 張 HP 卡放到持有者牌庫底；HP ${before.hpCards.length} → ${after?.hpCards.length ?? 0}${after ? '。' : '，該餅乾因此昏厥。'}`
          : `效果結算：「${targetCard.name}」的 HP 卡未移入牌庫底。`, cards: [targetCard] }
      }
    }
    if (targetCard.type === 'cookie' && targetCard.extraDeckOrigin) {
      const owner = Object.values(previous.players).find(player => player.battleArea.some(cookie => cookie.card.instanceId === targetCard.instanceId))
      const before = owner?.battleArea.find(cookie => cookie.card.instanceId === targetCard.instanceId)
      const returned = owner && next.players[owner.id].extraDeck?.some(card => card.instanceId === targetCard.instanceId)
      return { text: returned
        ? `效果結算：將「${targetCard.name}」返回 EXTRA Deck；原 HP ${before?.hpCards.length ?? 0} 張、裝備與 Awaken 底卡移入棄牌區。`
        : `效果結算：「${targetCard.name}」未返回 EXTRA Deck。`, cards: [targetCard] }
    }
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

const describeBattleToBreakStep = (
  previous: GameState,
  command: Extract<GameCommand, { kind: 'resolve-ability-effect' }>,
  effect: Extract<CardEffect, { kind: 'battle-to-break' }>,
): LogStepDetail => {
  const targetCard = command.targetIds[0]
    ? findCard(previous, command.targetIds[0])
    : undefined
  if (targetCard) {
    return {
      text: `效果結算：將「${targetCard.name}」放入休息區`,
      cards: [targetCard],
    }
  }

  const blocker = getBattleToBreakBlocker(
    previous,
    {
      sourcePlayerId: command.playerId,
      sourceInstanceId: previous.pendingAbilityEffect?.sourceInstanceId ?? '',
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
  if (sourceCard?.type === 'cookie' && sourceCard.skill?.onPlayFromBreakArea && state.pendingOnPlay?.origin !== 'break') {
    return { text: '效果未生效：本次不是從休息區登場，未符合登場來源條件。', cards: [sourceCard] }
  }
  if (sourceCard?.type === 'cookie' && sourceCard.skill?.fromSupportArea && state.pendingOnPlay?.origin !== 'support') {
    return { text: '效果未生效：本次不是從支援區登場，未符合登場來源條件。', cards: [sourceCard] }
  }
  if (sourceCard?.type === 'cookie' && sourceCard.skill) {
    const skill = sourceCard.skill
    const effects = getActiveOnPlayReplacement(state, sourcePlayerId)?.effects ??
      getCookieSkillEffects(skill, 'on-play')
    const context = { sourcePlayerId, sourceInstanceId }
    // The rules engine also checks conditions after fixed costs, such as a hand discard.
    if (effects.length > 0 && !skill.effectConditionsAtResolution &&
        !canActivateCookieSkill(state, sourcePlayerId, sourceInstanceId, 'on-play') &&
        effects.every(effect => !isSkillEffectConditionDeferredUntilCost(skill, effect) &&
          !isEffectConditionMet(state, context, effect))) {
      return { text: '登場效果結果：條件不成立，效果未執行。', cards: [sourceCard] }
    }
  }
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
  const battleToBreak = getBattleToBreakEffect(sourceEffects)
  if (battleToBreak) {
    const blocker = getBattleToBreakBlocker(
      state,
      { sourcePlayerId, sourceInstanceId },
      battleToBreak,
    )
    if (blocker) {
      return {
        text: `效果未生效：被「${blocker.card.name}」的效果阻止，無法將餅乾移出戰鬥區`,
        cards: [blocker.card],
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
  if (command.kind === 'begin-activate-skill' && command.targetIds !== undefined) {
    const effect = getCardEffects(findCard(previous, command.sourceInstanceId))[0]
    // A target-selection cost is resolved atomically with begin, including its damage.
    return effect?.kind === 'damage' && effect.selectionAsCost ? [effect] : []
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
      return `依休息區條件造成傷害（每 ${effect.groupSize ?? 1} 張 ${effect.perCount} 點）`
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
      return effect.side === 'opponent'
        ? `將對手${effect.optional ? '至多' : ''} ${effect.amount} 張支援卡返回對手手牌`
        : `將 ${effect.amount} 張支援卡返回手牌`
    case 'support-to-trash':
      return `將 ${effect.amount} 張支援卡放入棄牌區`
    case 'set-active':
      return `將 ${effect.supportCount} 張支援卡設為啟動`
    case 'rest-support':
      return `將 ${effect.amount} 張支援卡橫置`
    case 'prevent-support-active-next-phase':
      return '所選支援卡在控制者下一個活躍階段不會設為活躍（不立即橫置）'
    case 'rest-support-and-damage':
      return `橫置 ${effect.supportAmount} 張支援卡並造成傷害`
    case 'modify-attack':
      return `使目標攻擊力 ${effect.amount >= 0 ? '+' : ''}${effect.amount}`
    case 'modify-damage-received':
      if (effect.minimumDamage !== undefined && effect.setDamageTo !== undefined) {
        return `${effect.duration === 'opponent-next-turn' ? '直到對手回合結束，' : ''}使目標每次受到 ${effect.minimumDamage} 點以上的${effect.damageType === 'all' ? '傷害' : effect.damageType === 'effect' ? '效果傷害' : '攻擊傷害'}改為 ${effect.setDamageTo} 點`
      }
      return `使目標受到的${effect.damageType === 'all' ? '傷害' : effect.damageType === 'effect' ? '效果傷害' : '攻擊傷害'} ${effect.amount >= 0 ? '+' : ''}${effect.amount}`
    case 'modify-attack-by-break-count':
      return '依休息區張數修改目標攻擊力'
    case 'break-to-battle':
      return `從休息區登場至多 ${effect.amount} 張餅乾`
    case 'trash-to-battle':
      return `從棄牌區登場至多 ${effect.amount} 張餅乾`
    case 'trash-to-break':
      return effect.sourceToTrashFirst
        ? '先將來源餅乾移至棄牌區，再將選定餅乾放入休息區'
        : `將棄牌區 ${effect.amount} 張餅乾放入休息區`
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
    case 'prevent-opponent-on-play':
      return '本回合對手不能發動 On Play'
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

/**
 * 攻擊後效果在進入 pending decision 前就會先檢查條件；若條件不成立，
 * 規則引擎會直接跳到下一段效果，不會留下可供玩家操作的目標。紀錄層
 * 必須沿用同一個條件判定，避免把原始卡面文字誤記成「效果已結算」。
 */
const getOptionalCostAttackConditionContext = (
  state: GameState,
): EffectContext | undefined => {
  const pending = state.pendingOptionalCostAttack
  if (pending?.resolution !== 'ability') return undefined
  const pendingAbility = state.pendingAbilityEffect
  return {
    sourcePlayerId: pendingAbility?.sourcePlayerId ?? pending.playerId,
    sourceInstanceId: pendingAbility?.sourceInstanceId ?? pending.sourceInstanceId,
  }
}

const isAttackEffectConditionUnmet = (
  state: GameState,
  effects: CardEffect[],
  conditionContext?: EffectContext,
): boolean => {
  const battle = state.pendingBattle
  const effect = effects[0]
  if ((!battle && !conditionContext) || !effect || !('condition' in effect) || !effect.condition) {
    return false
  }
  return !isEffectConditionMet(
    state,
    conditionContext ?? {
      sourcePlayerId: battle!.attackerPlayerId,
      sourceInstanceId: battle!.attackerInstanceId,
    },
    effect,
  )
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
  label = '攻擊後效果',
): LogStepDetail | undefined => {
  const ids = targetIds ?? []
  if (ids.length > 0) {
    return describeCardListStep(state, `${label}目標`, ids)
  }
  if (effect?.kind === 'damage' && effect.target.attackTargetOnly && effect.target.min === 1 && effect.target.max === 1) {
    const originalId = state.pendingBattle?.targetInstanceId
    const original = Object.values(state.players).flatMap(player => player.battleArea)
      .find(cookie => cookie.card.instanceId === originalId)?.card
    return original
      ? { text: `${label}目標：原受攻擊的「${original.name}」`, cards: [original] }
      : { text: `${label}：原受攻擊餅乾已離場，無追加傷害目標。` }
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
      text: `${label}目標：「${sourceCard.name}」`,
      cards: [sourceCard],
    }
  }
  return selectors.some((selector) => selector.min > 0)
    ? { text: `${label}未生效：沒有符合條件的目標` }
    : { text: `${label}目標：未選擇目標（效果未生效）` }
}

const describeFlipRestSupportOutcome = (
  previous: GameState,
  next: GameState,
  command: Extract<GameCommand, { kind: 'resolve-flip' }>,
): LogStepDetail | undefined => {
  if (!previous.pendingBattle?.revealedHpCard?.flip?.effects.some(effect => effect.kind === 'rest-support')) return undefined
  const targetIds = command.effectTargetIds ?? command.targetIds ?? []
  const selected = Object.values(previous.players).flatMap(player =>
    player.supportArea.filter(entry => targetIds.includes(entry.card.instanceId))
      .map(entry => ({ playerId: player.id, entry })))
  if (selected.length === 0) return { text: 'FLIP 支援疲勞結果：未選擇支援卡，沒有支援卡改變狀態。' }
  const rested = selected.filter(({ playerId, entry }) => next.players[playerId].supportArea
    .some(after => after.card.instanceId === entry.card.instanceId && after.rested))
  return rested.length === 0
    ? { text: 'FLIP 支援疲勞結果：所選支援卡的疲勞狀態未改變。', cards: selected.map(({ entry }) => entry.card) }
    : {
        text: `FLIP 支援疲勞結果：${rested.map(({ entry }) => `「${entry.card.name}」${entry.rested ? '（原已疲勞）' : ''}`).join('、')}設為疲勞。`,
        cards: rested.map(({ entry }) => entry.card),
      }
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
  label = '攻擊後效果',
  conditionContext?: EffectContext,
): LogStepDetail => {
  if (isAttackEffectConditionUnmet(previous, effects, conditionContext)) {
    return { text: `${label}結果：條件不成立，效果未執行` }
  }
  const flatEffects = flattenAttackEffects(effects)
  if (flatEffects.length === 1 && flatEffects[0].kind === 'field-to-deck-bottom' &&
    !flatEffects[0].hpOnly && flatEffects[0].target.sourceOnly) {
    const sourceId = previous.pendingOptionalCostAttack?.sourceInstanceId ?? previous.pendingBattle?.attackerInstanceId ?? previous.pendingAbilityEffect?.sourceInstanceId
    const before = previous.players[commandPlayerId].battleArea.find(cookie => cookie.card.instanceId === sourceId)
    const after = next.players[commandPlayerId]
    const toExtra = before?.card.extraDeckOrigin && after.extraDeck?.some(card => card.instanceId === sourceId)
    const moved = before && !after.battleArea.some(cookie => cookie.card.instanceId === sourceId) && (toExtra || after.deck.at(-1)?.instanceId === sourceId)
    return moved
      ? { text: `${label}結果：將「${before.card.name}」${toExtra ? '返回 EXTRA Deck' : '放到持有者牌庫底'}；原 HP ${before.hpCards.length} 張及裝備 ${before.equippedCards?.length ?? 0} 張移入棄牌區${before.awakenedUnderlay?.length ? `，Awaken 底卡 ${before.awakenedUnderlay.length} 張也移入棄牌區` : ''}。`, cards: [before.card] }
      : { text: `${label}結果：來源餅乾未移入牌庫底。` }
  }
  if (flatEffects.length === 1 && flatEffects[0].kind === 'support-to-battle') {
    const supportIds = new Set(previous.players[commandPlayerId].supportArea.map(entry => entry.card.instanceId))
    const entered = next.players[commandPlayerId].battleArea.filter(entry => supportIds.has(entry.card.instanceId))
    return entered.length
      ? { text: `${label}結果：支援區餅乾登場；${entered.map(entry => `${entry.card.name} 配置 ${entry.hpCards.length} HP`).join('、')}${next.pendingRefresh ? '，等待 Refresh 後續結算' : ''}。`, cards: entered.map(entry => entry.card) }
      : { text: `${label}結果：沒有支援區餅乾登場。` }
  }
  if (flatEffects.length === 1 && flatEffects[0].kind === 'battle-to-break') {
    const blocker = getBattleToBreakBlocker(previous, {
      sourcePlayerId: commandPlayerId,
      sourceInstanceId: previous.pendingOptionalCostAttack?.sourceInstanceId ?? previous.pendingBattle?.attackerInstanceId ?? previous.pendingAbilityEffect?.sourceInstanceId ?? '',
    }, flatEffects[0])
    if (blocker) return { text: `${label}結果：被「${blocker.card.name}」阻擋，不能移出戰鬥區，效果未執行。`, cards: [blocker.card] }
  }
  const continuation = next.pendingBattle?.effectDamageSequence?.continuation
  if (
    (previous.pendingOptionalCostAttack?.resolution === 'ability' &&
      next.pendingAbilityEffect) ||
    continuation === 'attack-effect' ||
    next.pendingBattle?.stage === 'damage' ||
    next.pendingRevealTopDeck?.battleContinuation === 'attack-effect' ||
    next.pendingAbilityEffect?.battleContinuation === 'attack-effect'
  ) {
    return { text: `${label}結果：等待後續傷害／FLIP 或巢狀效果結算` }
  }
  const damageOutcome = describeDamageOutcome(
    previous,
    next,
    commandPlayerId,
    effects,
  )
  if (damageOutcome) return { text: `${label}結果：${damageOutcome}` }
  const gainHpOutcome = describeGainHpOutcome(
    previous,
    next,
    commandPlayerId,
    effects,
  )
  if (gainHpOutcome) return { text: `${label}結果：${gainHpOutcome}` }
  return {
    text: `${label}結果：${flattenAttackEffects(effects)
      .map(describeAttackEffectAction)
      .join('；') || '效果已結算'}`,
  }
}

const describeAttackEffectEnergyStep = (
  sourceCard: GameCard | undefined,
  sourceEnergy: Partial<Record<string, number>> | undefined,
  label = '攻擊後代價',
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
    text: `${label}：由「${sourceCard?.name ?? '攻擊餅乾'}」提供 ${costText} 能量`,
    cards: sourceCard ? [sourceCard] : undefined,
  }
}

/**
 * 攻擊後效果若停在待支付視窗，紀錄也要指出支付失敗的原因；否則玩家
 * 只會看到「等待選擇」或「略過」，無法知道是支援區沒有合法能量。
 * 這裡直接重用規則層的付款選擇，避免紀錄自行判斷顏色與橫置狀態。
 */
const describeOptionalCostAttackPaymentWarning = (
  state: GameState,
): string | undefined => {
  const pending = state.pendingOptionalCostAttack
  if (!pending) return undefined

  const remainingEnergyCost = getRemainingEnergyCost(
    pending.cost.energy ?? {},
    pending.sourceEnergy,
  )
  if (getEnergyCostTotal(remainingEnergyCost) === 0) return undefined

  const supportArea = state.players[pending.playerId]?.supportArea ?? []
  if (selectEnergyPayment(remainingEnergyCost, supportArea) !== null) {
    return undefined
  }

  const labels: Record<string, string> = {
    red: '紅色',
    yellow: '黃色',
    green: '綠色',
    blue: '藍色',
    purple: '紫色',
    black: '黑色',
    pure: '純色',
    neutral: '無色',
  }
  const requiredColors = Object.entries(remainingEnergyCost)
    .filter(([, amount]) => (amount ?? 0) > 0)
    .map(([color]) => labels[color] ?? color)
  const colorText = requiredColors.length > 0
    ? `${requiredColors.join('、')}`
    : ''
  return `目前沒有足夠的可支付${colorText}能量`
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
    case 'play-extra-deck-cookie':
      return `${actor} 從 EXTRA Deck 部署了「${findCardName(next, command.instanceId)}」`
    case 'place-support':
      return `${actor} 放置了支援卡「${findCardName(state, command.instanceId)}」`
    case 'play-item':
    case 'begin-play-item':
      if (next.pendingOpponentHandDiscard?.itemActivation?.instanceId === command.instanceId) {
        return `${actor} 宣告使用道具卡「${findCardName(state, command.instanceId)}」，等待支付額外棄牌代價（尚未支付費用）`
      }
      return `${actor} 使用了道具卡「${findCardName(state, command.instanceId)}」`
    case 'cancel-item-activation':
      return `${actor} 取消使用道具，未支付額外棄牌或道具費用`
    case 'play-stage':
      return `${actor} 打出了場景卡「${findCardName(state, command.instanceId)}」`
    case 'activate-stage':
    case 'begin-activate-stage':
      return `${actor} 發動了場景效果`
    case 'play-trap':
      return `${actor} 發動了陷阱卡「${findCardName(state, command.trapInstanceId)}」`
    case 'skip-trap': {
      const trapLock = findTrapLockSource(state)
      if (trapLock) {
        return `${actor} 無法發動陷阱：因「${trapLock.sourceName}」裝載在「${trapLock.attackerName}」上的效果，本次戰鬥陷阱已被禁止`
      }
      return `${actor} 選擇不發動陷阱`
    }
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
      const skillLabel = command.trigger === 'passive' ? '回合結束效果' : '技能'
      const costStep = hpTrashStep ?? battleToHandStep ?? selfToDeckBottomStep
      return costStep
        ? `${actor} 發動了「${sourceName}」的${skillLabel}（${costStep.text}）`
        : `${actor} 發動了「${sourceName}」的${skillLabel}`
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
          next,
          command,
          fieldToDeckBottom,
        )
        return `${actor} ${step.text}`
      }
      const battleToBreak = getBattleToBreakEffect(effects)
      if (battleToBreak) {
        const step = describeBattleToBreakStep(
          previous,
          command,
          battleToBreak,
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
      const modifyAttack = effects.find(
        (effect): effect is Extract<CardEffect, { kind: 'modify-attack' }> =>
          effect.kind === 'modify-attack',
      )
      if (modifyAttack) {
        const targetName = command.targetIds[0]
          ? findCardName(previous, command.targetIds[0])
          : undefined
        return targetName
          ? `${actor} 使「${targetName}」攻擊力 ${modifyAttack.amount >= 0 ? '+' : ''}${modifyAttack.amount}`
          : `${actor} 未選擇攻擊力效果目標，未套用攻擊力修改`
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
      const pending = previous.pendingAbilityEffect
      const effect = pending?.effects[pending.effectIndex]
      const placement = effect?.kind === 'hand-to-hp' ? effect : undefined
      const placed = placement?.faceUp && command.handCardInstanceId ? `「${findCardName(previous, command.handCardInstanceId) ?? '手牌'}」面朝上` : '1 張手牌'
      return command.handCardInstanceId
        ? `${actor} 將 ${placed}放到「${targetName ?? '目標'}」的 HP ${placement?.hpPlacement === 'bottom' ? '最下方' : '最上方'}`
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
    case 'skip-end-phase-skill':
      return `${actor} 選擇不發動「${findCardName(state, command.sourceInstanceId)}」的回合結束效果`
    case 'skip-on-play': {
      const blockedStep = describeBlockedOnPlayMovement(
        state,
        command.sourceInstanceId,
        command.playerId,
      )
      return blockedStep
        ? `${actor} 無法發動「${findCardName(state, command.sourceInstanceId)}」的登場效果：${blockedStep.text.replace(/^(?:效果未生效|登場效果結果)：/, '')}`
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
      const prevention = getBattleAttackEffectPrevention(previous, command.playerId)
      if (prevention) return `${actor} 的「${sourceName}」攻擊後效果無法發動：「${prevention.sourceCardName}」使對手 LV.${prevention.level} 餅乾在本次戰鬥中無法發動攻擊效果`
      if (resolvedEffects[0]?.kind === 'optional-cost-attack') {
        const paymentWarning = next.pendingOptionalCostAttack
          ? describeOptionalCostAttackPaymentWarning(next)
          : undefined
        return next.pendingOptionalCostAttack
          ? `${actor} 等待選擇「${sourceName}」的攻擊後效果：${effectText}${
              paymentWarning ? `；${paymentWarning}` : ''
            }`
          : `${actor} 的「${sourceName}」攻擊後效果未生效：沒有合法目標或條件不成立`
      }
      if (isAttackEffectConditionUnmet(previous, resolvedEffects)) {
        return `${actor} 的「${sourceName}」攻擊後效果未生效：條件不成立`
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
    case 'resolve-extra-deck-attack': {
      const pending = previous.pendingExtraDeckAttack
      const resolutionLabel = pending?.resolution === 'play'
        ? '登場'
        : pending?.resolution === 'skill'
          ? '技能'
          : '攻擊'
      if (!command.extraDeckInstanceId) {
        return `${actor} 略過「${pending?.cardName ?? 'EXTRA 餅乾'}」的${resolutionLabel}效果`
      }
      return `${actor} reveal 了「${findCardName(previous, command.extraDeckInstanceId)}」並啟動其${resolutionLabel}效果`
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
      return command.payDeckToTrash ? `${actor} 支付了昏厥效果的牌庫頂代價` : `${actor} 決定了擊倒效果的目標`
    case 'resolve-opponent-hand-discard': {
      const pending = previous.pendingOpponentHandDiscard
      const source = pending ? findCard(previous, pending.sourceInstanceId) ?? findCard(next, pending.sourceInstanceId) : undefined
      if (pending?.itemActivation) {
        return `${actor} 支付「${source?.name ?? pending.sourceCardName}」要求的額外棄牌代價，使用道具卡「${findCardName(previous, pending.itemActivation.instanceId)}」`
      }
      return pending
        ? `${actor} 完成「${source?.name ?? pending.sourceCardName}」效果：${describeHandDiscardResult(previous, command).text}`
        : `${actor} 選擇了要棄掉的手牌`
    }
    case 'resolve-opponent-rest-support':
      return `${actor} 選擇了要橫置的支援卡`
    case 'resolve-inspect-deck':
      return `${actor} 決定了檢視牌庫的結果`
    case 'resolve-optional-cost-attack':
      {
        const pending = previous.pendingOptionalCostAttack
        const isAbilityResolution = pending?.resolution === 'ability'
        const sourceCard = getAttackEffectSourceCard(previous, command)
        const sourceName =
          sourceCard?.name ?? pending?.sourceCardName ?? '未知餅乾'
        const effectText = getAttackEffectText(
          sourceCard,
          pending?.effects[0],
          pending?.effectText,
        )
        if (command.action === 'skip') {
          const paymentWarning = describeOptionalCostAttackPaymentWarning(previous)
          return paymentWarning
            ? `${actor} 選擇略過「${sourceName}」的${isAbilityResolution ? '技能 Then 可選效果' : '攻擊後效果'}（${paymentWarning}，未支付代價，後續動作未執行）`
            : `${actor} 選擇略過「${sourceName}」的${isAbilityResolution ? '技能 Then 可選效果' : '攻擊後效果'}（未支付代價，後續動作未執行）`
        }
        const outcome = describeAttackEffectResultStep(
          previous,
          next,
          command.playerId,
          pending?.effects ?? [],
          isAbilityResolution ? '技能 Then' : '攻擊後效果',
          getOptionalCostAttackConditionContext(previous),
        ).text
        return `${actor} 支付「${sourceName}」的${isAbilityResolution ? '技能 Then 代價' : '攻擊後代價'}並結算效果：${effectText}；${outcome.replace(/^(?:攻擊後效果|技能 Then)\s*結果：/, '')}`
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
        ? `${actor} 發動了${previous.pendingStageTrigger?.sourceKind === 'cookie-equip' ? '裝備' : previous.pendingStageTrigger?.sourceKind === 'cookie-skill' ? '餅乾技能' : '場景'}觸發效果`
        : `${actor} 選擇不發動${previous.pendingStageTrigger?.sourceKind === 'cookie-equip' ? '裝備' : previous.pendingStageTrigger?.sourceKind === 'cookie-skill' ? '餅乾技能' : '場景'}觸發效果`
    case 'resolve-after-damage-effect':
      return `${actor} 決定了${previous.pendingAfterDamageEffects?.[0]?.triggerReason === 'break-by-arena-effect' ? '休息區移入效果' : '傷害後效果'}的目標`
    case 'resolve-reveal-top-deck':
      return `${actor} 確認了${previous.pendingRevealTopDeck?.deckPosition === 'bottom' ? '牌庫底' : '牌庫頂'}展示，條件${previous.pendingRevealTopDeck?.matched ? '成立' : '不成立'}`
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
  'play-extra-deck-cookie': 'deploy',
  'play-stage': 'deploy',
  'replace-cookie': 'deploy',
  'skip-replacement': 'system',
  'refresh-deck': 'system',

  attack: 'attack',
  'declare-attack': 'attack',
  'resolve-optional-cost-attack': 'attack',
  'resolve-attack-effect': 'attack',
  'resolve-extra-deck-attack': 'attack',
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
  'skip-end-phase-skill': 'system',
  'play-item': 'activate',
  'begin-play-item': 'activate',
  'cancel-item-activation': 'system',
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
  if (
    command.kind === 'resolve-optional-cost-attack' &&
    previous.pendingOptionalCostAttack?.resolution === 'ability'
  ) {
    return 'activate'
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
  labelForIndex: (index: number, effect: CardEffect | undefined) => string =
    (index, effect) =>
      effect?.kind === 'opponent-battle-to-trash'
        ? '效果結算：放入棄牌區'
        : `第 ${index + 1} 個效果目標`,
): LogStepDetail[] =>
  (effectTargets ?? [])
    .map((targetIds, index) => {
      const effect = effects[index]
      if (effect && getEffectSelectionLimits(effect)?.min === 0 && targetIds.length === 0) {
        return { text: `第 ${index + 1} 個效果：選擇 0 個目標，此段可選效果未執行。` }
      }
      return describeCardListStep(
        state,
        labelForIndex(index, effect),
        targetIds,
      )
    })
    .filter((step): step is LogStepDetail => step !== undefined)

const describeChooseOneSteps = (chooseOneModes: number[] | undefined): LogStepDetail[] =>
  (chooseOneModes ?? []).map((modeIndex, index) => ({
    text: `第 ${index + 1} 個「選擇一項」效果：選了第 ${modeIndex + 1} 個選項`,
  }))

/** A shuffle can clear the trash condition; report observed movement rather than rechecking that emptied zone. */
const describeOwnTrashShuffleResult = (
  previous: GameState,
  next: GameState,
  playerId: GameState['activePlayerId'],
  sourceInstanceId: string,
  effects: CardEffect[],
): LogStepDetail | undefined => {
  const effect = effects[0]
  if (effects.length !== 1 || effect?.kind !== 'trash-to-deck-all' || effect.side === 'both' || effect.thenEffects?.length) return undefined
  const player = next.players[playerId]
  const returnedCount = player.deck.length - previous.players[playerId].deck.length
  if (returnedCount <= 0 || player.discardPile.length !== 0 || !player.deck.some(card => card.instanceId === sourceInstanceId)) return undefined
  const previousExtraIds = new Set(previous.players[playerId].extraDeck?.map(card => card.instanceId))
  const extraReturned = player.extraDeck?.filter(card => !previousExtraIds.has(card.instanceId)) ?? []
  if (extraReturned.length) return { text: `效果結算：己方棄牌區一般卡 ${returnedCount} 張洗回主牌庫並洗牌（包含來源道具）；${extraReturned.map(card => `「${card.name}」`).join('、')}返回 EXTRA Deck。` }
  return { text: `效果結算：己方棄牌區全部洗回牌庫並洗牌（${returnedCount} 張，包含來源道具）。` }
}

/**
 * 針對「單筆 entry 但 payload 已經帶齊所有子步驟資料」的批次指令，合成逐步驟文字＋
 * 對應卡片給 UI 展開用（每個步驟都能顯示實際用了哪些卡的縮圖，不是只給數量）。
 * 其餘 kind（例如互動式的 begin-* 系列，步驟本來就分散在多筆各自的 log entry 裡）
 * 回傳 undefined，UI 端改用同一個 groupId 底下其他 entry 的 summary/card 當步驟。
 */
/** Only newly attached, explicitly face-up HP may add card art to the public log. */
export const describeCommandSteps = (
  previous: GameState,
  next: GameState,
  command: GameCommand,
): LogStepDetail[] | undefined => {
  const steps = describeCommandCoreSteps(previous, next, command)
  const placements = Object.values(next.players).flatMap((player) =>
    player.battleArea.flatMap((cookie) => {
      const before = previous.players[player.id].battleArea.find(
        (entry) => entry.card.instanceId === cookie.card.instanceId,
      )
      return cookie.hpCards.flatMap((card, index) => {
        if (!cookie.faceUpHpCardInstanceIds?.includes(card.instanceId) ||
          before?.hpCards.some((entry) => entry.instanceId === card.instanceId)) return []
        return [{
          text: `HP 放置：將「${card.name}」正面朝上放到「${cookie.card.name}」HP ${index === 0 ? '最下方' : '最上方'}（目前 ${cookie.hpCards.length} 張）。`,
          cards: [card, cookie.card],
        }]
      })
    }),
  )
  const underlayMoves = Object.values(previous.players).flatMap(player => {
    const after = next.players[player.id]
    const oldTrash = new Set(player.discardPile.map(card => card.instanceId))
    return player.battleArea.flatMap(cookie => {
      const moved = cookie.awakenedUnderlay?.filter(card => !oldTrash.has(card.instanceId) && after.discardPile.some(entry => entry.instanceId === card.instanceId)) ?? []
      return moved.length ? [{ text: `Awaken 底卡：${moved.map(card => `「${card.name}」`).join('、')}移入棄牌區。`, cards: moved }] : []
    })
  })
  return placements.length + underlayMoves.length > 0 ? [...(steps ?? []), ...placements, ...underlayMoves] : steps
}

const describeCommandCoreSteps = (
  previous: GameState,
  next: GameState,
  command: GameCommand,
): LogStepDetail[] | undefined => {
  const state = previous

  switch (command.kind) {
    case 'resolve-after-damage-effect': {
      const pending = previous.pendingAfterDamageEffects?.[0]
      if (pending?.triggerReason !== 'break-by-arena-effect') return undefined
      const sourceCard = findCard(previous, pending.sourceInstanceId)
      if (pending.effect.kind === 'draw-up-to') {
        return [{ text: `休息區移入效果來源：「${pending.sourceCardName}」；開啟抽牌選擇，最多 ${pending.effect.max} 張。`, ...(sourceCard ? { cards: [sourceCard] } : {}) }]
      }
      const beforeHp = previous.players[pending.sourcePlayerId].battleArea.reduce((sum, cookie) => sum + cookie.hpCards.length, 0)
      const afterHp = next.players[pending.sourcePlayerId].battleArea.reduce((sum, cookie) => sum + cookie.hpCards.length, 0)
      const target = describeCardListStep(previous, '休息區移入效果目標', command.targetIds)
      return [{ text: `休息區移入效果來源：「${pending.sourceCardName}」；效果：${sourceCard?.skill?.text ?? ''}`, ...(sourceCard ? { cards: [sourceCard] } : {}) },
        ...(target ? [target] : []), { text: command.targetIds.length === 0 ? '休息區移入效果結果：未選擇餅乾，未增加 HP。' : `休息區移入效果結果：己方餅乾增加 ${Math.max(0, afterHp - beforeHp)} 張 HP。` }]
    }
    case 'advance-phase': {
      if (previous.phase !== 'active' || next.phase === 'active') return undefined
      return previous.players[command.playerId].battleArea.flatMap(cookie => {
        if (!cookie.card.skill?.effects.some(effect => effect.kind === 'prevent-source-active-phase')) return []
        const blocked = isCookieActivePhasePrevented(previous, command.playerId, cookie.card.instanceId)
        const remainsRested = next.players[command.playerId].battleArea.find(entry => entry.card.instanceId === cookie.card.instanceId)?.rested
        return [{ text: blocked ? `活躍階段：因「${cookie.card.name}」技能，己方戰鬥區沒有另一張【Arena】餅乾，未將來源設為活躍，保持原狀。`
          : remainsRested ? `活躍階段：「${cookie.card.name}」有另一張【Arena】餅乾，但其他效果阻止活躍，仍保持橫置。`
            : `活躍階段：己方戰鬥區有另一張【Arena】餅乾，「${cookie.card.name}」已設為活躍。`, cards: [cookie.card] }]
      })
    }
    case 'resolve-opponent-hand-discard': {
      const pending = previous.pendingOpponentHandDiscard
      if (!pending) return undefined
      const source = findCard(previous, pending.sourceInstanceId) ?? findCard(next, pending.sourceInstanceId)
      if (pending.itemActivation) {
        return [
          { text: `額外代價來源：「${source?.name ?? pending.sourceCardName}」`, cards: source ? [source] : undefined },
          describeCardListStep(previous, '道具額外代價：棄置手牌', command.cardIds)!,
          ...(describeCommandSteps(previous, next, pending.itemActivation) ?? []),
        ]
      }
      return [
        { text: `效果來源：「${source?.name ?? pending.sourceCardName}」`, cards: source ? [source] : undefined },
        describeHandDiscardResult(previous, command),
      ]
    }
    case 'skip-trap': {
      const trapLock = findTrapLockSource(state)
      return trapLock
        ? [
            {
              text: `陷阱封鎖：因「${trapLock.sourceName}」裝載在「${trapLock.attackerName}」上的效果，本次戰鬥無法發動陷阱。`,
            },
          ]
        : undefined
    }
    case 'play-stage': {
      const paymentStep = describeCardListStep(
        state,
        '支付場景放置費用（橫置）',
        command.paymentIds,
      )
      return paymentStep ? [paymentStep] : undefined
    }
    case 'play-trap': {
      const steps: LogStepDetail[] = []
      const trapCard = findCard(state, command.trapInstanceId)
      const positionStep = describeCardListStep(state,
        `陷阱代價：將餅乾設為${trapCard?.trap?.cost.battleCookiePosition?.position === 'active' ? '活躍' : '橫置'}`,
        command.positionCostTargetIds)
      if (trapCard?.type === 'trap') {
        steps.push({
          text: `發動陷阱卡：「${trapCard.name}」`,
          cards: [trapCard],
        })
      }
      const paymentStep = describeCardListStep(state, '支付能量（橫置）', command.paymentIds)
      if (paymentStep) steps.push(paymentStep)
      if (positionStep) steps.push(positionStep)
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
      if (command.effectTargets !== undefined) {
        steps.push(
          ...describeEffectTargetsSteps(
            state,
            command.effectTargets,
            trapCard?.type === 'trap' ? trapCard.trap?.effects : [],
            (index, effect) =>
              effect?.kind === 'opponent-battle-to-trash'
                ? '效果結算：放入棄牌區'
                : index === 0
                  ? '選擇目標'
                  : `選擇目標（第 ${index + 1} 段）`,
          ),
        )
      } else {
        const targetStep = describeCardListStep(state, '選擇目標', command.targetIds)
        if (targetStep) steps.push(targetStep)
      }
      // play-trap 的 trashToDeckIds 是 `trash-to-deck` 效果選擇，不是
      // AbilityCost。它必須依卡面順序排在前段目標之後，不能誤標成
      // 「額外代價」而讓公開 trace 看起來先付款、再選第一段目標。
      const trashToDeckStep = describeCardListStep(
        state,
        'Then 效果：棄牌區卡片洗回牌庫',
        command.trashToDeckIds,
      )
      if (trashToDeckStep) steps.push(trashToDeckStep)
      const selfTargetStep = describeCardListStep(state, '選擇自身目標', command.selfTargetIds)
      if (selfTargetStep) steps.push(selfTargetStep)
      const outcome = describeDamageOutcome(
        previous,
        next,
        command.playerId,
        trapCard?.type === 'trap' ? trapCard.trap?.effects ?? [] : [],
      )
      if (outcome) steps.push({ text: `效果結算：${outcome}` })
      if (trapCard?.trap?.effects.some(effect => effect.kind === 'modify-attack' && effect.duration === 'own-next-turn')) {
        const modifiers = next.attackModifiers.filter(modifier =>
          modifier.sourceInstanceId === trapCard.instanceId && !previous.attackModifiers.includes(modifier),
        )
        for (const modifier of modifiers) {
          steps.push({ text: `效果結算：${findCardName(next, modifier.targetInstanceId)} 攻擊傷害 ${modifier.amount >= 0 ? '+' : ''}${modifier.amount}，直到自己的下個回合結束。` })
        }
        if (modifiers.length === 0) steps.push({ text: '效果結算：未選擇 Blocker 餅乾，未套用攻擊傷害修改。' })
      }
      const singleModifier = trapCard?.trap?.effects.length === 1 ? trapCard.trap.effects[0] : undefined
      if (singleModifier?.kind === 'modify-attack' && singleModifier.duration === 'this-turn' && !singleModifier.thenEffects?.length) {
        const context = { sourcePlayerId: command.playerId, sourceInstanceId: command.trapInstanceId }
        const modifiers = next.attackModifiers.filter(modifier => modifier.sourceInstanceId === command.trapInstanceId && !previous.attackModifiers.includes(modifier))
        if (!isEffectConditionMet(next, context, singleModifier)) {
          steps.push({ text: '效果結算：條件不成立，未套用攻擊傷害修改。' })
        } else if (modifiers.length === 0) {
          steps.push({ text: '效果結算：未選擇餅乾，未套用攻擊傷害修改。' })
        } else {
          for (const modifier of modifiers) steps.push({ text: `效果結算：${findCardName(next, modifier.targetInstanceId)} 攻擊傷害 ${modifier.amount >= 0 ? '+' : ''}${modifier.amount}，本回合有效。` })
        }
      }
      for (const effect of trapCard?.trap?.effects ?? []) {
        if (effect.kind !== 'modify-attack') continue
        const then = effect.thenEffects?.find(branch => branch.kind === 'modify-attack' && branch.target.previousEffectTargetOnly && branch.condition?.kind === 'trash-keyword-count-at-least' && branch.condition.keyword === 'arena')
        if (then?.kind !== 'modify-attack' || then.condition?.kind !== 'trash-keyword-count-at-least') continue
        const condition = then.condition
        const modifiers = next.attackModifiers.filter(modifier => modifier.sourceInstanceId === trapCard?.instanceId && !previous.attackModifiers.includes(modifier))
        const count = next.players[command.playerId].discardPile.filter(card => card.keywords?.includes(condition.keyword)).length
        if (modifiers.length === 0) {
          steps.push({ text: '效果結算：未選擇對手餅乾，兩段攻擊傷害修改均未套用。' })
          continue
        }
        const first = modifiers.find(modifier => modifier.amount === effect.amount)
        if (first) steps.push({ text: `效果結算：${findCardName(next, first.targetInstanceId)} 攻擊傷害 ${first.amount}，本回合有效。` })
        const additional = modifiers.find(modifier => modifier.amount === then.amount && modifier.targetInstanceId === first?.targetInstanceId)
        steps.push({ text: `Then 結果：己方棄牌區有 ${count} 張【Arena】牌（門檻 ${condition.count} 張）；${additional ? `同一張 ${findCardName(next, additional.targetInstanceId)} 攻擊傷害再 ${additional.amount}，本回合有效。` : '條件不成立，未追加修改。'}` })
      }
      return steps
    }
    case 'activate-skill':
    case 'begin-activate-skill': {
      const steps: LogStepDetail[] = []
      const skillSource = findCard(state, command.sourceInstanceId)
      const faintCost = skillSource?.skill?.cost.trashBattleCookie?.faint ?? false
      const directBreakCost = skillSource?.skill?.cost.trashBattleCookie?.toBreakArea ?? false
      if (skillSource?.skill?.cost.selfToTrash) {
        const sourceCookie = state.players[command.playerId].battleArea.find(cookie => cookie.card.instanceId === command.sourceInstanceId)
        if (sourceCookie) steps.push({
          text: `技能代價：將「${sourceCookie.card.name}」及其 ${sourceCookie.hpCards.length} 張 HP 卡、裝備與 Awaken 底卡置入棄牌區`,
          cards: [sourceCookie.card, ...sourceCookie.hpCards, ...(sourceCookie.equippedCards ?? []), ...(sourceCookie.awakenedUnderlay ?? [])],
        })
      }
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
        faintCost
          ? '額外代價：使餅乾昏厥並送入休息區'
          : directBreakCost ? '技能代價：戰鬥區餅乾放入休息區' : '額外代價：戰鬥區送入棄牌區',
        command.trashBattleCookieIds,
      )
      if (trashBattleStep) steps.push(trashBattleStep)
      const battleToHandStep = describeCardListStep(
        state,
        '技能代價：將戰鬥區餅乾返回手牌',
        command.battleToHandIds,
      )
      if (battleToHandStep) steps.push(battleToHandStep)
      const positionCostStep = describeCardListStep(state,
        `技能代價：將餅乾設為${skillSource?.skill?.cost.battleCookiePosition?.position === 'rested' ? '橫置' : '活躍'}`,
        command.positionCostTargetIds)
      if (positionCostStep) steps.push(positionCostStep)
      const trashToBreakCostStep = describeCardListStep(state,
        '技能代價：棄牌區餅乾放入休息區', command.trashCookieToBreakAreaIds)
      if (trashToBreakCostStep) steps.push(trashToBreakCostStep)
      const handToBreakCostStep = describeCardListStep(state,
        '技能代價：手牌餅乾放入休息區', command.handToBreakAreaIds)
      if (handToBreakCostStep) steps.push(handToBreakCostStep)
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
          command.kind === 'activate-skill' ? command.effectTargets
            : command.targetIds !== undefined ? [command.targetIds] : undefined,
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
      if (outcome) steps.push({ text: next.pendingBattle?.effectDamageSequence
        ? '效果結算：已確認目標，等待 HP／FLIP 傷害逐段結算。'
        : `效果結算：${outcome}` })
      const sourceMovement = describeSourceMovementOutcome(
        previous,
        next,
        command.sourceInstanceId,
        getResolvedEffects(previous, command),
      )
      if (sourceMovement) steps.push(sourceMovement)
      const hpOutcome = describeGainHpOutcome(previous, next, command.playerId, getResolvedEffects(previous, command))
      if (hpOutcome && (hpOutcome !== '未增加 HP' || !next.pendingAbilityEffect && !next.pendingRefresh)) {
        steps.push({ text: `效果結算：${hpOutcome}` })
      }
      return steps
    }
    case 'play-attack-response': {
      const steps: LogStepDetail[] = []
      const sourceCard = findCard(state, command.sourceInstanceId)
      if (sourceCard) {
        steps.push({
          text: `攻擊回應技能來源：「${sourceCard.name}」`,
          cards: [sourceCard],
        })
      }
      const discardStep = describeCardListStep(
        state,
        '攻擊回應代價：棄置手牌',
        command.discardHandIds,
      )
      if (discardStep) steps.push(discardStep)
      const supportTrashStep = describeCardListStep(state, '攻擊回應代價：支援區送入棄牌區', command.supportToTrashIds)
      if (supportTrashStep) steps.push(supportTrashStep)
      const trashToDeckStep = describeCardListStep(
        state,
        '攻擊回應代價：棄牌區卡片洗回牌庫',
        command.trashToDeckIds,
      )
      if (trashToDeckStep) steps.push(trashToDeckStep)
      return steps
    }
    case 'play-blocker': {
      const steps: LogStepDetail[] = []
      const discardStep = describeCardListStep(state, 'Blocker 代價：棄置手牌', command.discardHandIds ?? [])
      if (discardStep) steps.push(discardStep)
      const paymentStep = describeCardListStep(state, '支付能量（橫置）', command.paymentIds)
      if (paymentStep) steps.push(paymentStep)

      const originalTargetId = previous.pendingBattle?.targetInstanceId
      const redirectedTargetId = next.pendingBattle?.targetInstanceId
      const originalTarget = originalTargetId ? findCard(previous, originalTargetId) : undefined
      const redirectedTarget = redirectedTargetId
        ? findCard(next, redirectedTargetId)
        : undefined
      if (originalTarget && redirectedTarget && originalTargetId !== redirectedTargetId) {
        const sourceCard = findCard(previous, command.sourceInstanceId)
        const cards = [sourceCard, originalTarget, redirectedTarget].filter(
          (card): card is GameCard => card !== undefined,
        )
        steps.push({
          text: `阻擋效果結果：攻擊目標從「${originalTarget.name}」改為「${redirectedTarget.name}」`,
          cards: [...new Map(cards.map((card) => [card.instanceId, card])).values()],
        })
      }
      return steps.length > 0 ? steps : undefined
    }
    case 'play-item':
    case 'begin-play-item':
    case 'begin-activate-stage':
    case 'activate-stage': {
      if ((command.kind === 'play-item' || command.kind === 'begin-play-item') &&
        next.pendingOpponentHandDiscard?.itemActivation?.instanceId === command.instanceId) {
        return [{ text: '道具宣告：等待選擇額外棄牌，能量與原本代價尚未支付。' }]
      }
      const steps: LogStepDetail[] = []
      const activationSource = 'instanceId' in command
        ? findCard(previous, command.instanceId)
        : previous.players[command.playerId].stage?.card
      const faintCost = (activationSource?.item?.cost ?? activationSource?.stageAbility?.cost)?.trashBattleCookie?.faint
      const directBreakCost = (activationSource?.item?.cost ?? activationSource?.stageAbility?.cost)?.trashBattleCookie?.toBreakArea
      if (command.kind === 'begin-activate-stage' || command.kind === 'activate-stage') {
        const source = previous.players[command.playerId].stage
        if (source && !source.rested && next.players[command.playerId].stage?.rested) {
          steps.push({ text: `場景代價：將「${source.card.name}」橫置。`, cards: [source.card] })
        }
        const bottomStep = describeCardListStep(previous, '場景代價：棄牌區卡片依選取順序放到牌庫底', command.trashToDeckBottomIds)
        if (bottomStep) steps.push(bottomStep)
      }
      const paymentStep = describeCardListStep(state, '支付能量（橫置）', command.paymentIds)
      if (paymentStep) steps.push(paymentStep)
      if (command.kind === 'begin-play-item' || command.kind === 'play-item') {
        const handBreakStep = describeCardListStep(previous, '道具代價：手牌餅乾放入休息區', command.handToBreakAreaIds)
        if (handBreakStep) steps.push(handBreakStep)
        const source = findCard(previous, command.instanceId)
        const reveal = source?.item?.effects[0]
        if (reveal?.kind === 'reveal-hand' && reveal.asCost) {
          const revealed = describeCardListStep(previous, '展示代價（公開；Then 將同一張牌放入休息區）',
            command.kind === 'begin-play-item' ? command.targetIds : command.effectTargets?.[0])
          if (revealed) steps.push(revealed)
        }
      }
      const supportTrashStep = describeCardListStep(
        state,
        '額外代價：支援區送入棄牌區',
        'supportToTrashIds' in command
          ? command.supportToTrashIds
          : undefined,
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
        faintCost ? '額外代價：使餅乾昏厥並送入休息區' : directBreakCost ? '道具代價：戰鬥區餅乾放入休息區' : '額外代價：戰鬥區送入棄牌區',
        command.trashBattleCookieIds,
      )
      if (trashBattleStep) steps.push(trashBattleStep)
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
      const trashShuffle = (command.kind === 'begin-play-item' || command.kind === 'play-item') && activationSource?.item
        ? describeOwnTrashShuffleResult(previous, next, command.playerId, activationSource.instanceId, activationSource.item.effects)
        : undefined
      if (trashShuffle) steps.push(trashShuffle)
      if (command.kind === 'begin-activate-stage' && 'targetIds' in command) {
        const targetStep = describeCardListStep(
          state,
          '效果目標',
          command.targetIds,
        )
        if (targetStep) steps.push(targetStep)
      }
      if ((command.kind === 'begin-activate-stage' || command.kind === 'activate-stage') &&
        next.status === 'playing' && activationSource?.stageAbility?.allowInactiveConditionalEffects === true &&
        activationSource.stageAbility.effects.length > 0 && activationSource.stageAbility.effects.every(effect =>
          'condition' in effect && effect.condition !== undefined && !isEffectConditionMet(next,
            { sourcePlayerId: command.playerId, sourceInstanceId: activationSource.instanceId }, effect))) {
        steps.push({ text: '場景效果結果：條件不成立，效果未執行。' })
      }
      if ((command.kind === 'begin-play-item' || command.kind === 'play-item') &&
        !trashShuffle &&
        next.status === 'playing' && activationSource?.item?.allowInactiveConditionalEffects === true &&
        activationSource.item.effects.length > 0 && activationSource.item.effects.every(effect =>
          'condition' in effect && effect.condition !== undefined && !isEffectConditionMet(next,
            { sourcePlayerId: command.playerId, sourceInstanceId: activationSource.instanceId }, effect))) {
        steps.push({ text: '道具效果結果：條件不成立，效果未執行。' })
      }
      return steps
    }
    case 'resolve-flip': {
      const flippedCard = previous.pendingBattle?.revealedHpCard
      if (!command.activate) {
        return [
          {
            text: 'FLIP 效果結果：選擇不發動，效果未執行',
            cards: flippedCard ? [flippedCard] : undefined,
          },
        ]
      }
      const steps: LogStepDetail[] = []
      const bottomCost = flippedCard?.flip?.handCostDestination === 'deck-bottom'
      const discardStep = describeCardListStep(bottomCost ? previous : next,
        bottomCost ? 'FLIP 代價：公開手牌並放到自己的牌庫底' : 'FLIP 代價：棄置手牌', command.discardHandIds)
      if (discardStep) steps.push(discardStep)
      if (flippedCard?.flip?.effects.some(effect => effect.kind === 'trash-to-hand')) {
        const nextHandIds = new Set(next.players[command.playerId].hand.map(card => card.instanceId))
        const nextTrashIds = new Set(next.players[command.playerId].discardPile.map(card => card.instanceId))
        const recovered = previous.players[command.playerId].discardPile.filter(card => nextHandIds.has(card.instanceId) && !nextTrashIds.has(card.instanceId))
        steps.push({
          text: recovered.length > 0
            ? `FLIP 回收結果：${recovered.map(card => `「${card.name}」`).join('、')}從己方棄牌區返回手牌。`
            : 'FLIP 回收結果：沒有卡牌從棄牌區返回手牌。',
          ...(recovered.length > 0 ? { cards: recovered } : {}),
        })
      }
      const gainHpOutcome = describeGainHpOutcome(previous, next, command.playerId, flippedCard?.flip?.effects ?? [])
      const supportRestOutcome = describeFlipRestSupportOutcome(previous, next, command)
      if (supportRestOutcome) steps.push(supportRestOutcome)
      steps.push(
        {
          text: `FLIP 效果結果：已發動${flippedCard ? `「${flippedCard.name}」` : ''}${gainHpOutcome ? `；${gainHpOutcome}` : ''}`,
          cards: flippedCard ? [flippedCard] : undefined,
        },
      )
      return steps
    }
    case 'resolve-attack-effect': {
      const effects = getResolvedEffects(previous, command)
      const effect = effects[0]
      const sourceCard = getAttackEffectSourceCard(previous, command)
      const steps: LogStepDetail[] = [
        describeAttackEffectSourceStep(previous, command, effect),
      ]
      const prevention = getBattleAttackEffectPrevention(previous, command.playerId)
      if (prevention) {
        steps.push({ text: `「${prevention.sourceCardName}」使對手 LV.${prevention.level} 餅乾在本次戰鬥中無法發動攻擊效果；未支付後續代價。` })
        return steps
      }
      if (effect?.kind === 'optional-cost-attack') {
        const paymentWarning = next.pendingOptionalCostAttack
          ? describeOptionalCostAttackPaymentWarning(next)
          : undefined
        steps.push(
          next.pendingOptionalCostAttack
            ? {
                text: paymentWarning
                  ? `攻擊後效果：等待玩家選擇支付代價或略過；${paymentWarning}，請選擇「略過」`
                  : '攻擊後效果：等待玩家選擇支付代價或略過',
              }
            : { text: '攻擊後效果未生效：沒有合法目標或條件不成立' },
        )
        return steps
      }
      if (isAttackEffectConditionUnmet(previous, effects)) {
        steps.push({ text: '攻擊後效果結果：條件不成立，效果未執行' })
        return steps
      }
      const targetStep = describeAttackEffectTargetStep(
        effect?.kind === 'damage' && effect.target.attackTargetOnly ? previous : state,
        effect,
        command.targetIds,
        sourceCard,
      )
      if (targetStep) {
        steps.push(targetStep)
        // An optional target may legitimately be left empty, and a required
        // selector may have no legal candidate. In both cases the target step
        // already records that the effect did not apply; do not append a
        // generic action description that falsely claims the result happened.
        if (targetStep.text.includes('未生效')) return steps
      }
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
      if (pending.extraDeckPlayInstanceId && command.action === 'pay') {
        const paidCookies = previous.players[command.playerId].battleArea.filter(cookie => command.targetIds?.includes(cookie.card.instanceId))
        const discarded = previous.players[command.playerId].hand.filter(card => command.discardCardIds?.includes(card.instanceId))
        const source = next.players[command.playerId].battleArea.find(cookie => cookie.card.instanceId === pending.extraDeckPlayInstanceId)
        const steps: LogStepDetail[] = []
        if (paidCookies.length) steps.push({ text: `EXTRA 登場代價：將${paidCookies.map(cookie => `「${cookie.card.name}」`).join('、')}及其 HP／裝備放入棄牌區。`,
          cards: paidCookies.flatMap(cookie => [cookie.card, ...cookie.hpCards, ...(cookie.equippedCards ?? []), ...(cookie.awakenedUnderlay ?? [])]) })
        if (discarded.length) steps.push({ text: `EXTRA 登場代價：棄置${discarded.map(card => `「${card.name}」`).join('、')}。`, cards: discarded })
        const payment = describeCardListStep(state, 'EXTRA 登場代價：支付能量（橫置）', command.paymentIds)
        if (payment) steps.push(payment)
        if (source) steps.push({ text: `EXTRA 登場：「${source.card.name}」進入戰鬥區，已配置 ${source.hpCards.length} 張 HP。`, cards: [source.card] })
        return steps
      }
      if (pending.effects.some(effect => effect.kind === 'play-revealed-bottom-cookie')) {
        const source = previous.players[command.playerId].battleArea.find(cookie => cookie.card.instanceId === pending.sourceInstanceId)
        return [{ text: command.action === 'skip'
          ? '技能登場代價：選擇不支付，來源餅乾與展示底牌維持原位。'
          : `技能登場代價：將來源「${pending.sourceCardName}」及其 HP／裝備放入棄牌區；接續同一張底牌登場。`,
          ...(source ? { cards: [source.card] } : {}),
        }]
      }
      const isAbilityResolution = pending.resolution === 'ability'
      const sourceCard = getAttackEffectSourceCard(previous, command)
      const steps: LogStepDetail[] = [
        isAbilityResolution
          ? {
              text: `技能 Then 來源：「${pending.sourceCardName}」；效果：${pending.effectText}`,
              cards: sourceCard ? [sourceCard] : undefined,
            }
          : describeAttackEffectSourceStep(
              previous,
              command,
              pending.effects[0],
              pending.effectText,
            ),
      ]
      if (command.action === 'skip') {
        const paymentWarning = describeOptionalCostAttackPaymentWarning(previous)
        steps.push({
          text: paymentWarning
            ? `${isAbilityResolution ? '技能 Then 可選效果' : '攻擊後效果'}未生效：${paymentWarning}，未支付代價，後續動作未執行`
            : `玩家選擇略過${isAbilityResolution ? '技能 Then 可選效果' : '攻擊後效果'}，未支付代價，後續動作未執行`,
        })
        return steps
      }

      const sourceEnergyStep = describeAttackEffectEnergyStep(
        sourceCard,
        pending.sourceEnergy,
        isAbilityResolution ? '技能 Then 代價' : '攻擊後代價',
      )
      if (sourceEnergyStep) steps.push(sourceEnergyStep)
      const paymentStep = describeCardListStep(
        state,
        `${isAbilityResolution ? '技能 Then 代價' : '攻擊後代價'}：支付能量（橫置）`,
        command.paymentIds,
      )
      if (paymentStep) steps.push(paymentStep)
      const discardStep = describeCardListStep(
        state,
        `${isAbilityResolution ? '技能 Then 代價' : '攻擊後代價'}：${pending.cost.handCostDestination === 'deck-bottom' ? '公開手牌並將同一張牌放入牌庫底' : '棄置手牌'}`,
        command.discardCardIds,
      )
      if (discardStep) steps.push(discardStep)
      const supportToHandStep = describeCardListStep(
        state,
        `${isAbilityResolution ? '技能 Then 代價' : '攻擊後代價'}：支援卡返回手牌`,
        command.supportToHandIds,
      )
      if (supportToHandStep) steps.push(supportToHandStep)
      const hpToTrashStep = describeHpTrashStep(
        state,
        next,
        command.hpToTrashIds,
      )
      if (hpToTrashStep) steps.push(hpToTrashStep)
      const hpToHandStep = describeHpToHandStep(
        state,
        next,
        command.hpToHandIds,
      )
      if (hpToHandStep) steps.push(hpToHandStep)
      const trashToDeckStep = describeCardListStep(
        state,
        `${isAbilityResolution ? '技能 Then 代價' : '攻擊後代價'}：棄牌區卡片${pending.cost.trashToDeckBottom ? '依選取順序放到牌庫底' : '洗回牌庫'}`,
        command.trashToDeckIds,
      )
      if (trashToDeckStep) steps.push(trashToDeckStep)
      const positionStep = describeCardListStep(
        state,
        `${isAbilityResolution ? '技能 Then 代價' : '攻擊後代價'}：餅乾設為${pending.cost.battleCookiePosition?.position === 'active' ? '活躍' : '橫置'}`,
        command.positionCostTargetIds,
      )
      if (positionStep) steps.push(positionStep)
      const cookieBreakStep = describeCardListStep(state, '攻擊後代價：餅乾放入休息區', command.cookieToBreakAreaIds)
      if (cookieBreakStep) steps.push(cookieBreakStep)
      if (
        !sourceEnergyStep &&
        !paymentStep &&
        !discardStep &&
        !supportToHandStep &&
        !hpToTrashStep &&
        !hpToHandStep &&
        !trashToDeckStep &&
        !cookieBreakStep &&
        !positionStep
      ) {
        steps.push({
          text: `${isAbilityResolution ? '技能 Then 代價' : '攻擊後代價'}：已支付（無需額外選牌）`,
        })
      }
      const targetStep = describeAttackEffectTargetStep(
        pending.effects[0]?.kind === 'damage' && pending.effects[0].target.attackTargetOnly ? previous : state,
        pending.effects[0],
        command.targetIds,
        sourceCard,
        isAbilityResolution ? '技能 Then ' : '攻擊後效果',
      )
      if (targetStep) steps.push(targetStep)
      if (pending.effects.length === 1 && pending.effects[0].kind === 'set-active' && pending.effects[0].selectable) {
        const selected = previous.players[command.playerId].supportArea.filter(s => command.targetIds?.includes(s.card.instanceId))
        steps.push(selected.length === 0
          ? { text: `${isAbilityResolution ? '技能 Then ' : '攻擊後效果'}結果：選擇 0 張支援卡，此段未改變支援狀態。` }
          : { text: `${isAbilityResolution ? '技能 Then ' : '攻擊後效果'}結果：${selected.length} 張支援卡設為活躍：${selected.map(s => `${s.card.name}${s.rested ? '' : '（原已活躍）'}`).join('、')}。`, cards: selected.map(s => s.card) })
        return steps
      }
      steps.push(
        describeAttackEffectResultStep(
          previous,
          next,
          command.playerId,
          pending.effects,
          isAbilityResolution ? '技能 Then ' : '攻擊後效果',
          getOptionalCostAttackConditionContext(previous),
        ),
      )
      return steps
    }
    case 'resolve-ability-effect': {
      const resolvedEffects = getResolvedEffects(previous, command)
      const drawEffect = resolvedEffects[0]
      if (drawEffect?.kind === 'trash-to-deck-all' && previous.pendingAbilityEffect?.sourceKind === 'item') {
        const pending = previous.pendingAbilityEffect
        const shuffled = describeOwnTrashShuffleResult(previous, next, pending.sourcePlayerId, pending.sourceInstanceId, resolvedEffects)
        if (shuffled) return [shuffled]
      }
      if (drawEffect?.kind === 'play-revealed-bottom-cookie') {
        const played = next.players[command.playerId].battleArea.find(cookie => cookie.card.instanceId === drawEffect.revealedInstanceId)
        return [{ text: played
          ? `底牌登場結果：「${played.card.name}」由原牌庫底直接登場，已配置 ${played.hpCards.length} HP${next.pendingRefresh ? '；等待 Refresh 補足 HP。' : '。'}`
          : '底牌登場結果：未登場。', ...(played ? { cards: [played.card] } : {}) }]
      }
      if (drawEffect?.kind === 'support-to-hand' && drawEffect.side === 'opponent') {
        const pending = previous.pendingAbilityEffect
        const sourcePlayerId = pending?.sourcePlayerId ?? command.playerId
        const context = { sourcePlayerId, sourceInstanceId: pending?.sourceInstanceId ?? '' }
        if (!isEffectConditionMet(previous, context, drawEffect)) {
          return [{ text: '支援回手結果：條件不成立，未移動支援卡。' }]
        }
        const opponentId = getOpponentId(sourcePlayerId)
        const remaining = new Set(next.players[opponentId].supportArea.map(support => support.card.instanceId))
        const moved = previous.players[opponentId].supportArea.filter(support => !remaining.has(support.card.instanceId))
        return moved.length === 0 ? [{ text: '支援回手結果：選擇 0 張，未移動支援卡。' }]
          : [{ text: `支援回手結果：對手 ${moved.length} 張支援卡返回對手手牌：${moved.map(support => support.card.name).join('、')}。`, cards: moved.map(support => support.card) }]
      }
      if (drawEffect?.kind === 'deck-to-support') {
        const playerId = previous.pendingAbilityEffect?.sourcePlayerId ?? command.playerId
        const previousSupport = new Set(previous.players[playerId].supportArea.map(s => s.card.instanceId))
        // Newly placed support cards are public; untouched deck identities remain private.
        const moved = next.players[playerId].supportArea.filter(s => !previousSupport.has(s.card.instanceId))
        return [moved.length === 0
          ? { text: drawEffect.amount === 0 ? '牌庫支援結果：選擇 0 張，此段未移動卡牌。' : '牌庫支援結果：未移動卡牌。' }
          : { text: `牌庫支援結果：${moved.length} 張卡移入支援區（${moved.every(s => s.rested) ? '疲勞' : '活躍'}）：${moved.map(s => s.card.name).join('、')}${next.pendingRefresh ? '；等待 Refresh。' : ''}`, cards: moved.map(s => s.card) }]
      }
      if (drawEffect?.kind === 'trash-to-support') {
        const sourcePlayerId = previous.pendingAbilityEffect?.sourcePlayerId ?? command.playerId
        const previousSupport = new Set(previous.players[sourcePlayerId].supportArea.map(s => s.card.instanceId))
        const moved = next.players[sourcePlayerId].supportArea.filter(s => !previousSupport.has(s.card.instanceId) && command.targetIds.includes(s.card.instanceId))
        const targetStep = describeCardListStep(state, '效果目標', command.targetIds)
        return [...(targetStep ? [targetStep] : []), moved.length === 0
          ? { text: command.targetIds.length === 0 ? '棄牌區回收結果：選擇 0 張，此段未移動卡牌。' : '棄牌區回收結果：未移動卡牌。' }
          : { text: `棄牌區回收結果：${moved.length} 張卡移入支援區（${moved.every(s => s.rested) ? '疲勞' : '活躍'}）：${moved.map(s => s.card.name).join('、')}`, cards: moved.map(s => s.card) }]
      }
      if (drawEffect?.kind === 'gain-hp' && !drawEffect.target?.previousEffectTargetOnly) {
        const pending = previous.pendingAbilityEffect
        const sourcePlayerId = pending?.sourcePlayerId ?? command.playerId
        const context = { sourcePlayerId, sourceInstanceId: pending?.sourceInstanceId ?? '' }
        const outcome = describeGainHpOutcome(previous, next, sourcePlayerId, resolvedEffects)
        const targetStep = drawEffect.target?.sourceOnly ? undefined : describeCardListStep(state, '效果目標', command.targetIds)
        const emptyTarget = !drawEffect.target?.sourceOnly && getEffectSelectionLimits(drawEffect)?.min === 0 && command.targetIds.length === 0
        return [...(targetStep ? [targetStep] : []), ...(emptyTarget ? [{ text: '選擇 0 個目標，此段可選效果未執行。' }] : []), { text: !isEffectConditionMet(previous, context, drawEffect)
          ? 'HP 效果結果：條件不成立，未增加 HP。'
          : next.pendingRefresh ? `HP 效果結果：${outcome}；等待 Refresh 後繼續。` : `HP 效果結果：${outcome}` }]
      }
      if (drawEffect?.kind === 'draw') {
        const sourcePlayerId = previous.pendingAbilityEffect?.sourcePlayerId ?? command.playerId
        const targetPlayerId = drawEffect.side === 'opponent' ? getOpponentId(sourcePlayerId) : sourcePlayerId
        const drawn = Math.max(0, next.players[targetPlayerId].hand.length - previous.players[targetPlayerId].hand.length)
        const remaining = next.pendingRefresh?.playerId === targetPlayerId ? next.pendingRefresh.remainingDraws : 0
        // Only publish counts. The drawn card identities remain private.
        return [{ text: `抽牌結果：抽了 ${drawn} 張牌${remaining > 0 ? `；Refresh 後尚須抽 ${remaining} 張` : ''}` }]
      }
      const effect = getOpponentBattleToTrashEffect(
        resolvedEffects,
      )
      if (effect) {
        return [describeOpponentBattleToTrashStep(previous, command, effect)]
      }
      const fieldToDeckBottom = getFieldToDeckBottomEffect(resolvedEffects)
      if (fieldToDeckBottom) {
        return [describeFieldToDeckBottomStep(previous, next, command, fieldToDeckBottom)]
      }
      const battleToBreak = getBattleToBreakEffect(resolvedEffects)
      return battleToBreak
        ? [describeBattleToBreakStep(previous, command, battleToBreak)]
        : (() => {
            const effect = resolvedEffects[0]
            if (!effect) return undefined
            if (effect.kind === 'modify-attack' && effect.target.previousEffectTargetOnly) {
              const pending = previous.pendingAbilityEffect
              const context = { sourcePlayerId: pending?.sourcePlayerId ?? command.playerId, sourceInstanceId: pending?.sourceInstanceId ?? '' }
              const targets = getEffectTargetCandidates(previous, context, effect.target)
              return targets.length > 0
                ? targets.map(cookie => ({ text: `Then 攻擊力效果結果：同一張「${cookie.card.name}」本回合追加 ${effect.amount} 攻擊傷害。`, cards: [cookie.card] }))
                : [{ text: 'Then 攻擊力效果結果：未選前段目標或原目標已離場，無合法目標，未套用追加減傷。' }]
            }
            if (effect.kind === 'gain-hp' && effect.target?.previousEffectTargetOnly) {
              const pending = previous.pendingAbilityEffect
              const ids = pending?.previousEffectTargetIds ?? []
              if (!isEffectConditionMet(previous, { sourcePlayerId: command.playerId, sourceInstanceId: pending?.sourceInstanceId ?? '' }, effect)) {
                return [{ text: 'Then HP 效果結果：條件不成立，未額外增加 HP。' }]
              }
              return ids.flatMap((id) => {
                const before = previous.players[command.playerId].battleArea.find((entry) => entry.card.instanceId === id)
                const after = next.players[command.playerId].battleArea.find((entry) => entry.card.instanceId === id)
                return before && after ? [{ text: `Then HP 效果結果：同一張「${after.card.name}」HP ${getCookieEffectiveHp(before)} → ${getCookieEffectiveHp(after)}。`, cards: [after.card] }] : []
              })
            }
            const steps: LogStepDetail[] = []
            if (effect.kind === 'hp-to-trash-all') {
              const pending = previous.pendingAbilityEffect
              const targetSelector = effect.target ?? {
                side: effect.side,
                min: 0,
                max: 4,
              }
              const candidates = getEffectTargetCandidates(
                previous,
                {
                  sourcePlayerId: pending?.sourcePlayerId ?? command.playerId,
                  sourceInstanceId: pending?.sourceInstanceId ?? '',
                },
                targetSelector,
              )
              const candidateIds = new Set(
                candidates.map((cookie) => cookie.card.instanceId),
              )
              const hpChanges = Object.values(previous.players).flatMap((player) =>
                player.battleArea.flatMap((beforeCookie) => {
                  if (!candidateIds.has(beforeCookie.card.instanceId)) return []
                  const afterCookie = next.players[player.id].battleArea.find(
                    (cookie) => cookie.card.instanceId === beforeCookie.card.instanceId,
                  )
                  const hpBefore = beforeCookie.hpCards.length
                  const hpAfter = afterCookie?.hpCards.length ?? 0
                  return hpAfter < hpBefore
                    ? [{
                        text: `HP 移除結果：「${beforeCookie.card.name}」HP 張數 ${hpBefore}→${hpAfter}。`,
                        cards: [beforeCookie.card],
                      }]
                    : []
                }),
              )
              if (hpChanges.length > 0) return hpChanges
              if (candidates.length === 0) {
                const minimumHp = effect.target?.minRemainingHp
                return [{
                  text: minimumHp === undefined
                    ? 'HP 移除結果：沒有符合效果目標條件的餅乾，未移除 HP 卡。'
                    : `HP 移除結果：沒有符合效果目標條件（剩餘 HP 至少 ${minimumHp} 張）的餅乾，未移除 HP 卡。`,
                }]
              }
              return [{ text: 'HP 移除結果：符合效果目標的餅乾 HP 未改變，未移除 HP 卡。' }]
            }
            if (effect.kind === 'hand-to-break' && effect.revealedCardOnly) {
              const moved = next.players[command.playerId].breakArea.filter((card) =>
                previous.costRecord?.revealedHandCardInstanceIds?.includes(card.instanceId) &&
                previous.players[command.playerId].hand.some((handCard) => handCard.instanceId === card.instanceId))
              steps.push(moved.length > 0
                ? { text: `Then 結算：將先前展示的同一張牌「${moved.map((card) => card.name).join('、')}」放入休息區。`, cards: moved }
                : { text: 'Then 結算：展示牌未移動。' })
            }
            if (effect.kind === 'trash-to-hand' && command.targetIds.length > 0) {
              const recovered = next.players[command.playerId].hand.filter((card) => command.targetIds.includes(card.instanceId) && previous.players[command.playerId].discardPile.some((entry) => entry.instanceId === card.instanceId))
              if (recovered.length > 0) steps.push({ text: `回收結果：${recovered.map((card) => card.name).join('、')} 從棄牌區返回手牌。`, cards: recovered })
            }
            if (effect.kind === 'equip-source' && command.targetIds.length > 0) {
              const sourceId = previous.pendingAbilityEffect?.sourceInstanceId
              const host = next.players[command.playerId].battleArea.find(cookie => cookie.card.instanceId === command.targetIds[0])
              const equipped = host?.equippedCards?.find(card => card.instanceId === sourceId)
              if (host && equipped) {
                steps.push({ text: `裝備結果：「${equipped.name}」已裝備到「${host.card.name}」。`, cards: [equipped, host.card] })
                if (effect.sourceZone === 'battle') {
                  const originalSource = previous.players[command.playerId].battleArea.find(cookie => cookie.card.instanceId === sourceId)
                  if (originalSource) steps.push({ text: `原 HP ${originalSource.hpCards.length} 張移入棄牌區；本次裝備不觸發補位登場。`, cards: originalSource.hpCards })
                }
              }
            }
            const targetStep = describeCardListStep(
              state,
              effect.kind === 'modify-attack'
                ? '攻擊力效果目標'
                : '效果目標',
              command.targetIds,
            )
            if (targetStep) steps.push(targetStep)
            if (getEffectSelectionLimits(effect)?.min === 0 && command.targetIds.length === 0) {
              steps.push({ text: '選擇 0 個目標，此段可選效果未執行。' })
            }
            if (effect.kind === 'set-cookie-active' || effect.kind === 'rest-cookie') {
              const context = { sourcePlayerId: previous.pendingAbilityEffect?.sourcePlayerId ?? command.playerId,
                sourceInstanceId: previous.pendingAbilityEffect?.sourceInstanceId ?? '' }
              const targets = Object.values(next.players).flatMap(player => player.battleArea)
                .filter(cookie => command.targetIds.includes(cookie.card.instanceId) &&
                  (effect.kind === 'rest-cookie' ? cookie.rested : !cookie.rested &&
                    next.cookiesSetActiveByEffectThisTurn?.[cookie.battleEntryId ?? cookie.card.instanceId]))
              steps.push(!isEffectConditionMet(previous, context, effect)
                ? { text: '效果結算：條件不成立，未改變餅乾狀態。' }
                : targets.length > 0
                  ? { text: `效果結算：${targets.map(cookie => cookie.card.name).join('、')} 已${effect.kind === 'rest-cookie' ? '橫置' : '設為活躍'}。`, cards: targets.map(cookie => cookie.card) }
                  : { text: `效果結算：未將任何餅乾${effect.kind === 'rest-cookie' ? '橫置' : '設為活躍'}。` })
            }
            if (effect.kind === 'break-to-battle' && effect.hpCount !== undefined && command.targetIds.length > 0) {
              steps.push({ text: `效果結算：選定餅乾從休息區登場，HP 設為 ${effect.hpCount}。` })
            }
            if (effect.kind === 'prevent-support-active-next-phase' && command.targetIds.length > 0) {
              steps.push({ text: `效果結算：${describeAttackEffectAction(effect)}。` })
            }
            if (effect.kind === 'trash-to-break' && effect.sourceToTrashFirst) {
              steps.push({ text: `效果結算：${describeAttackEffectAction(effect)}` })
            }
            if (effect.kind === 'modify-attack') {
              const amount = effect.amount
              const targetNames = command.targetIds
                .map((id) => findCardName(state, id))
                .join('、')
              steps.push({
                text: targetNames
                  ? `效果結算：${targetNames} 攻擊力 ${amount >= 0 ? '+' : ''}${amount}`
                  : '效果結算：未選擇攻擊力效果目標，未套用攻擊力修改',
                cards: command.targetIds
                  .map((id) => findCard(state, id))
                  .filter((card): card is GameCard => card !== undefined),
              })
              const readyThen = effect.thenEffects?.find(then => then.kind === 'set-cookie-active' && then.target.previousEffectTargetOnly)
              const readyContext = { sourcePlayerId: previous.pendingAbilityEffect?.sourcePlayerId ?? command.playerId,
                sourceInstanceId: previous.pendingAbilityEffect?.sourceInstanceId ?? '' }
              if (readyThen && isEffectConditionMet(next, readyContext, readyThen)) {
                const readyIds = command.targetIds.filter(id => Object.values(next.players).some(player =>
                  player.battleArea.some(cookie => cookie.card.instanceId === id && !cookie.rested &&
                    next.cookiesSetActiveByEffectThisTurn?.[cookie.battleEntryId!])))
                const readyNames = readyIds.map(id => findCardName(next, id)).join('、')
                steps.push({ text: readyNames ? `Then 結算：${readyNames} 已設為活躍（沿用同一張目標）。`
                  : 'Then 結算：未選擇餅乾，未將任何餅乾設為活躍。' })
              }
            }
            return steps.length > 0 ? steps : undefined
          })()
    }
    case 'resolve-faint-effect': {
      const pending = previous.pendingFaintEffects?.[0]
      if (!pending) return undefined
      const steps: LogStepDetail[] = []
      const unavailableReason = getFaintSourceCostUnavailableReason(previous)
      if (unavailableReason) {
        return [{ text: `昏厥效果未發動：${unavailableReason}` }]
      }
      const sourceCard = findCard(previous, pending.sourceInstanceId)
      if (sourceCard) {
        steps.push({
          text: `昏厥效果來源：「${sourceCard.name}」；效果：${
            sourceCard.effectText ?? sourceCard.skill?.text ?? pending.sourceCardName ?? '昏厥效果'
          }`,
          cards: [sourceCard],
        })
      }
      if ((pending.cost?.deckToTrash?.amount ?? 0) > 0) {
        const moved = command.payDeckToTrash ? next.deckTrashResolution?.cards ?? [] : []
        steps.push({ text: command.payDeckToTrash
          ? `昏厥效果代價：牌庫頂 ${moved.length} 張已移到自己的棄牌區。${next.pendingRefresh ? '先完成 Refresh，再接續代價與回收。' : '接著選擇回收目標。'}`
          : '昏厥效果未發動：未支付牌庫頂代價，後續回收未執行。', cards: moved })
        return steps
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
      const supportToHandStep = describeCardListStep(
        state,
        '昏厥效果代價：支援區返回手牌',
        command.supportToHandIds,
      )
      if (supportToHandStep) steps.push(supportToHandStep)
      const targetStep = describeCardListStep(
        state,
        '昏厥效果目標',
        command.targetIds,
      )
      if (targetStep) steps.push(targetStep)
      if (pending.effect.kind === 'break-to-trash') {
        const moved = previous.players[pending.sourcePlayerId].breakArea.filter(card =>
          command.targetIds.includes(card.instanceId) && next.players[pending.sourcePlayerId].discardPile.some(moved => moved.instanceId === card.instanceId),
        )
        steps.push({ text: moved.length > 0
          ? `昏厥效果結果：${moved.map(card => `「${card.name}」`).join('、')}從自己的休息區移到棄牌區。`
          : '昏厥效果結果：未選擇休息區目標，沒有卡牌移動。', cards: moved })
        return steps
      }
      if (pending.effect.kind === 'trash-to-hand') {
        const moved = previous.players[pending.sourcePlayerId].discardPile.filter(card => command.targetIds.includes(card.instanceId) &&
          next.players[pending.sourcePlayerId].hand.some(recovered => recovered.instanceId === card.instanceId))
        steps.push({ text: moved.length > 0
          ? `昏厥效果結果：${moved.map(card => `「${card.name}」`).join('、')}從自己的棄牌區返回手牌。`
          : '昏厥效果結果：未選擇回收目標，沒有卡牌返回手牌。', cards: moved })
        return steps
      }
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
      const pendingProgress = next.pendingBattle
        ? pendingBattleProgressText[next.pendingBattle.stage]
        : undefined
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
        ...(next.pendingBattle?.flipBlocker ? [{
          text: `FLIP 封鎖：「${next.pendingBattle.flipBlocker.sourceCardName}」使對手在本次戰鬥不能發動 FLIP。`,
          cards: [findCard(state, next.pendingBattle.flipBlocker.sourceInstanceId)].filter((card): card is GameCard => card !== undefined),
        }] : []),
        ...(next.pendingBattle?.blockerPrevention ? [{
          text: `Blocker 封鎖：「${next.pendingBattle.blockerPrevention.sourceCardName}」使對手在本次戰鬥不能發動 Blocker。`,
          cards: [findCard(state, next.pendingBattle.blockerPrevention.sourceInstanceId)].filter((card): card is GameCard => card !== undefined),
        }] : []),
        ...(() => {
          const attacker = previous.players[command.playerId].battleArea.find(cookie => cookie.card.instanceId === command.attackerInstanceId)
          const equipment = attacker?.equippedCards?.find(card => card.skill?.equippedAttackTrigger?.hostCardName === attacker.card.name)
          const trigger = equipment?.skill?.equippedAttackTrigger
          if (!equipment || !trigger) return []
          const context = { sourcePlayerId: command.playerId, sourceInstanceId: equipment.instanceId, sourceCardName: equipment.name }
          const met = trigger.effects.some(effect => isEffectConditionMet(next, context, effect))
          return [{ text: met ? `裝備攻擊觸發：「${equipment.name}」等待是否發動。` : `裝備攻擊觸發：「${equipment.name}」條件不成立，效果未執行。`, cards: [equipment] }]
        })(),
        pendingProgress
          ? { text: pendingProgress, cards: targetCard ? [targetCard] : undefined }
          : { text: `自動結算戰鬥，${outcome}`, cards: targetCard ? [targetCard] : undefined },
      ]
    }
    case 'resolve-reveal-top-deck': {
      const pending = previous.pendingRevealTopDeck
      if (!pending) return undefined
      return [{ text: `展示${pending.deckPosition === 'bottom' ? '牌庫底' : '牌庫頂'}：「${pending.revealedCard.name}」。`, cards: [pending.revealedCard] },
        { text: pending.matched ? pending.playMatchedAfterSourceTrash
          ? '條件成立：等待是否支付來源餅乾進棄牌區的代價，再讓展示的同一張底牌登場。'
          : pending.addMatchedToHand
          ? '條件成立：將展示的同一張牌加入手牌，接續後段效果。' : '條件成立，接續後段效果。'
          : pending.deckPosition === 'bottom' ? '條件不成立，底牌維持原位，後段效果未執行。' : '條件不成立，後段效果未執行。' }]
    }
    case 'resolve-inspect-deck': {
      const pending = previous.pendingInspectDeck
      if (!pending) return undefined
      const destination = pending.pickDestination ?? 'hand'
      const player = next.players[pending.playerId]
      const destinationCards = destination === 'hand' ? player.hand
        : destination === 'battle' ? player.battleArea.map(cookie => cookie.card)
        : player.supportArea.map(entry => entry.card)
      const picked = pending.revealedCards.filter(card => command.pickedCardIds.includes(card.instanceId) &&
        destinationCards.some(moved => moved.instanceId === card.instanceId))
      const destinationLabel = destination === 'hand' ? '加入手牌' : destination === 'battle' ? '進入戰鬥區' : '進入支援區'
      const steps: LogStepDetail[] = [picked.length === 0
        ? { text: `選擇 0 張，沒有牌${destinationLabel}。` }
        : pending.revealPicked
          ? { text: `展示並${destinationLabel}：${picked.map(card => `「${card.name}」`).join('、')}。`, cards: picked }
          : { text: `檢視結果：${picked.length} 張牌${destinationLabel}。` }]
      if (pending.restDestination === 'trash') {
        const moved = command.restOrder.map(id => pending.revealedCards.find(card => card.instanceId === id))
          .filter((card): card is GameCard => card !== undefined && player.discardPile.some(moved => moved.instanceId === card.instanceId))
        steps.push({ text: `未選卡進棄牌區：${moved.map(card => `「${card.name}」`).join('、')}。`, cards: moved })
      }
      return steps
    }
    case 'resolve-draw-up-to': {
      const pending = previous.pendingDrawUpTo
      if (!pending) return undefined
      const sourceCard = findCard(previous, pending.sourceInstanceId)
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
    case 'cancel-item-activation': {
      const sourceId = previous.pendingOpponentHandDiscard?.itemActivation?.instanceId
      return sourceId ? findCard(previous, sourceId) : undefined
    }
    case 'play-trap':
      return findCard(previous, command.trapInstanceId)
    case 'skip-on-play':
    case 'skip-end-phase-skill':
    case 'play-blocker':
    case 'play-attack-response':
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
    case 'play-extra-deck-cookie':
      // A paid EXTRA entry is still pending in `previous.extraDeck`; after a
      // cost prompt it may already be materialized in the battle area.  Check
      // both states so the public trace retains the source card either way.
      return findCard(previous, command.instanceId) ?? findCard(next, command.instanceId)
    case 'refresh-deck':
      return findCard(previous, command.cookieInstanceId)
    case 'attack':
    case 'declare-attack':
      return findCard(previous, command.attackerInstanceId)
    case 'resolve-battle':
      // The automatic battle resolver does not carry an attacker ID in its
      // command payload, but the pending battle still identifies the source
      // while the command-log entry is built. Associating that entry with the
      // attacker lets Browser contract traces prove passive attack modifiers
      // and ordinary damage resolution without exposing private payloads.
      return previous.pendingBattle?.attackerInstanceId
        ? findCard(previous, previous.pendingBattle.attackerInstanceId)
        : undefined
    case 'resolve-attack-effect':
      return previous.pendingBattle?.attackerInstanceId
        ? findCard(previous, previous.pendingBattle.attackerInstanceId)
        : undefined
    case 'resolve-extra-deck-attack':
      return command.extraDeckInstanceId
        ? findCard(previous, command.extraDeckInstanceId) ??
            findCard(next, command.extraDeckInstanceId)
        : previous.pendingExtraDeckAttack?.sourceInstanceId
          ? findCard(previous, previous.pendingExtraDeckAttack.sourceInstanceId)
          : undefined
    case 'resolve-ability-effect':
    case 'resolve-place-hand-hp':
      return previous.pendingAbilityEffect?.sourceInstanceId
        ? findCard(previous, previous.pendingAbilityEffect.sourceInstanceId)
        : undefined
    case 'resolve-reorder-hp':
      return previous.pendingAbilityEffect?.sourceInstanceId
        ? findCard(previous, previous.pendingAbilityEffect.sourceInstanceId)
        : undefined
    case 'resolve-faint-effect': {
      const pending = previous.pendingFaintEffects?.[0]
      return pending
        ? findCard(previous, pending.sourceInstanceId)
        : undefined
    }
    case 'resolve-after-damage-effect': {
      const pending = previous.pendingAfterDamageEffects?.[0]
      return pending ? findCard(previous, pending.sourceInstanceId) : undefined
    }
    case 'resolve-inspect-deck': {
      const pending = previous.pendingInspectDeck
      return pending
        ? findCard(previous, pending.sourceInstanceId) ?? pending.revealedCards.find(card => card.instanceId === pending.sourceInstanceId)
        : undefined
    }
    case 'resolve-stage-trigger':
      return previous.pendingStageTrigger?.sourceInstanceId
        ? findCard(previous, previous.pendingStageTrigger.sourceInstanceId)
        : undefined
    case 'resolve-reveal-top-deck':
      return previous.pendingRevealTopDeck?.sourceInstanceId
        ? findCard(previous, previous.pendingRevealTopDeck.sourceInstanceId)
        : undefined
    case 'resolve-optional-cost-attack':
      return previous.pendingOptionalCostAttack?.sourceInstanceId
        ? findCard(previous, previous.pendingOptionalCostAttack.sourceInstanceId)
        : undefined
    case 'activate-stage':
    case 'begin-activate-stage':
      return previous.players[command.playerId].stage?.card
    case 'resolve-next-damage':
      // Sequential effect damage is attributed to its real effect source so a
      // contract trace can prove every damage segment even when protection
      // prevents the HP reveal (or when the revealed card is only a filler).
      // Ordinary battle damage keeps the existing revealed-HP association.
      if (previous.pendingBattle?.effectDamageSequence) {
        const sourceId = previous.pendingBattle.attackerInstanceId
        const source = sourceId ? findCard(previous, sourceId) : undefined
        if (source) return source
      }
      return resolveRevealedDamageCard(previous, next, command.playerId)
    case 'resolve-flip':
      // BS9-030 activates a discarded Cookie's FLIP as part of the attacker's
      // Then effect.  Attribute that nested decision to the attacking source
      // so the BS9-030 contract trace proves the complete causal chain while
      // preserving ordinary HP FLIP entries' revealed-card association.
      if (
        previous.pendingBattle?.detachedFlip &&
        previous.pendingBattle.attackerInstanceId
      ) {
        return findCard(previous, previous.pendingBattle.attackerInstanceId)
      }
      return previous.pendingBattle?.revealedHpCard ?? undefined
    case 'resolve-draw-up-to': {
      const pending = previous.pendingDrawUpTo
      if (!pending) return undefined
      if (
        pending.battleContinuation === 'attack-effect' &&
        previous.pendingBattle?.attackerInstanceId
      ) {
        return findCard(previous, previous.pendingBattle.attackerInstanceId)
      }
      return findCard(previous, pending.sourceInstanceId)
    }
    case 'resolve-opponent-hand-discard': {
      const sourceId = previous.pendingOpponentHandDiscard?.sourceInstanceId
      return sourceId ? findCard(previous, sourceId) ?? findCard(next, sourceId) : undefined
    }
    default:
      return undefined
  }
}
