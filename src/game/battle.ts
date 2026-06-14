import { GameRuleError } from './errors'
import {
  executeCardEffect,
  getAttackDamageAgainst,
  getBreakToTrashCandidates,
  getEffectTargetCandidates,
  selectEffectTargets,
} from './effects'
import {
  getAttackEnergyCost,
  selectEnergyPayment,
  validateEnergyPayment,
} from './energy'
import { getOpponentId } from './helpers'
import {
  finalizePendingReplacements,
  recordCookieDepartures,
} from './replacement'
import { canAttack } from './turn'
import type {
  CardEffect,
  CookieInBattle,
  EffectTargetSelector,
  EnergyColor,
  GameCard,
  GameState,
  PendingBattle,
  PlayerId,
  PlayerState,
  TrapAbility,
} from './types'
import { getBreakAreaLevel } from './victory'

const requirePendingBattle = (state: GameState): PendingBattle => {
  if (!state.pendingBattle) {
    throw new GameRuleError('目前沒有等待處理的戰鬥。')
  }

  return state.pendingBattle
}

const assertNoBlockingDecision = (state: GameState) => {
  if (state.pendingBattle) {
    throw new GameRuleError('必須先完成目前的戰鬥。')
  }

  if (state.pendingReplacement) {
    throw new GameRuleError('必須先補充戰鬥區餅乾。')
  }

  if (state.pendingRefresh) {
    throw new GameRuleError('必須先完成牌庫 Refresh。')
  }

  if (state.pendingFaintEffects && state.pendingFaintEffects.length > 0) {
    throw new GameRuleError('必須先處理昏厥效果。')
  }

  if (state.pendingOpponentHandDiscard) {
    throw new GameRuleError('必須先處理對手棄牌。')
  }
}

export const beginAttack = (
  state: GameState,
  attackerInstanceId: string,
  targetInstanceId: string,
  supportPaymentIds: string[],
): GameState => {
  assertNoBlockingDecision(state)

  if (!canAttack(state)) {
    throw new GameRuleError('目前不能宣告攻擊。')
  }

  const attackerPlayer = state.players[state.activePlayerId]
  const attackerIndex = attackerPlayer.battleArea.findIndex(
    (cookie) => cookie.card.instanceId === attackerInstanceId,
  )
  const attacker = attackerPlayer.battleArea[attackerIndex]

  if (!attacker || attacker.rested) {
    throw new GameRuleError('找不到可攻擊的餅乾。')
  }

  const defenderPlayerId = getOpponentId(state.activePlayerId)
  const defender = state.players[defenderPlayerId]
  if (
    !defender.battleArea.some(
      (cookie) => cookie.card.instanceId === targetInstanceId,
    )
  ) {
    throw new GameRuleError('找不到攻擊目標。')
  }

  const paymentValidation = validateEnergyPayment(
    getAttackEnergyCost(attacker.card),
    attackerPlayer.supportArea,
    supportPaymentIds,
  )
  if (!paymentValidation.valid) {
    throw new GameRuleError(`攻擊支付無效：${paymentValidation.reason}`)
  }

  const paymentSet = new Set(supportPaymentIds)
  const declaredDamage = getAttackDamageAgainst(
    state,
    attackerInstanceId,
    targetInstanceId,
  )

  return {
    ...state,
    players: {
      ...state.players,
      [attackerPlayer.id]: {
        ...attackerPlayer,
        battleArea: attackerPlayer.battleArea.map((cookie, index) =>
          index === attackerIndex ? { ...cookie, rested: true } : cookie,
        ),
        supportArea: attackerPlayer.supportArea.map((support) =>
          paymentSet.has(support.card.instanceId)
            ? { ...support, rested: true }
            : support,
        ),
      },
    },
    pendingBattle: {
      attackerPlayerId: attackerPlayer.id,
      defenderPlayerId,
      attackerInstanceId,
      targetInstanceId,
      declaredDamage,
      remainingDamage: declaredDamage,
      stage: 'trap',
      trapUsed: false,
      revealedHpCard: null,
      preventKnockoutTargetIds: [],
      faintedColors: [],
      attackEffects: attacker.card.attackEffects ?? [],
      attackEffectIndex: 0,
    },
  }
}

const isTrapConditionMet = (
  state: GameState,
  playerId: PlayerId,
  trap: TrapAbility,
): boolean => {
  const battle = requirePendingBattle(state)

  if (!trap.condition) return true

  if (trap.condition.kind === 'break-level-at-least') {
    return getBreakAreaLevel(state, playerId) >= trap.condition.level
  }

  if (trap.condition.kind === 'attacker-attack-more-than') {
    return battle.declaredDamage > trap.condition.amount
  }

  return true
}

export const getTrapCandidates = (
  state: GameState,
  playerId: PlayerId,
): GameCard[] => {
  const battle = state.pendingBattle
  if (
    !battle ||
    battle.stage !== 'trap' ||
    battle.trapUsed ||
    battle.defenderPlayerId !== playerId
  ) {
    return []
  }

  const player = state.players[playerId]
  return player.hand.filter(
    (card) =>
      card.type === 'trap' &&
      Boolean(card.trap) &&
      isTrapConditionMet(state, playerId, card.trap!) &&
      selectEnergyPayment(card.trap!.cost.energy, player.supportArea) !== null,
  )
}

const validateTrapTargets = (
  state: GameState,
  playerId: PlayerId,
  effects: CardEffect[],
  targetIds: string[],
) => {
  const targetEffects = effects.filter(
    (effect) =>
      effect.kind === 'damage' ||
      effect.kind === 'modify-attack' ||
      effect.kind === 'prevent-knockout',
  )
  if (targetEffects.length === 0) {
    if (targetIds.length > 0) {
      throw new GameRuleError('這張陷阱不需要選擇餅乾目標。')
    }
    return
  }

  for (const effect of targetEffects) {
    selectEffectTargets(
      state,
      {
        sourcePlayerId: playerId,
        sourceInstanceId: 'pending-trap',
      },
      effect.target,
      targetIds,
    )
  }
}

const moveSupportsToTrash = (
  player: PlayerState,
  selectedIds: string[],
  amount: number,
): PlayerState => {
  const uniqueIds = [...new Set(selectedIds)]
  if (uniqueIds.length !== amount) {
    throw new GameRuleError(`必須選擇 ${amount} 張支援卡送入棄牌區。`)
  }

  const selected = player.supportArea.filter((support) =>
    uniqueIds.includes(support.card.instanceId),
  )
  if (selected.length !== amount) {
    throw new GameRuleError('只能選擇自己的支援區卡牌。')
  }

  return {
    ...player,
    supportArea: player.supportArea.filter(
      (support) => !uniqueIds.includes(support.card.instanceId),
    ),
    discardPile: [
      ...player.discardPile,
      ...selected.map((support) => support.card),
    ],
  }
}

export interface PlayTrapOptions {
  trapInstanceId: string
  paymentIds: string[]
  targetIds: string[]
  supportTrashIds?: string[]
}

export const playTrap = (
  state: GameState,
  playerId: PlayerId,
  options: PlayTrapOptions,
): GameState => {
  const battle = requirePendingBattle(state)
  if (
    battle.stage !== 'trap' ||
    battle.trapUsed ||
    battle.defenderPlayerId !== playerId
  ) {
    throw new GameRuleError('目前不能發動陷阱。')
  }

  const player = state.players[playerId]
  const trapIndex = player.hand.findIndex(
    (card) => card.instanceId === options.trapInstanceId,
  )
  const trapCard = player.hand[trapIndex]
  const trap = trapCard?.trap

  if (!trapCard || trapCard.type !== 'trap' || !trap) {
    throw new GameRuleError('找不到可發動的陷阱卡。')
  }

  if (!isTrapConditionMet(state, playerId, trap)) {
    throw new GameRuleError('尚未滿足陷阱的發動條件。')
  }

  const paymentValidation = validateEnergyPayment(
    trap.cost.energy,
    player.supportArea,
    options.paymentIds,
  )
  if (!paymentValidation.valid) {
    throw new GameRuleError(`陷阱支付無效：${paymentValidation.reason}`)
  }

  validateTrapTargets(state, playerId, trap.effects, options.targetIds)

  const paymentSet = new Set(options.paymentIds)
  let updatedPlayer: PlayerState = {
    ...player,
    hand: player.hand.filter((_, index) => index !== trapIndex),
    supportArea: player.supportArea.map((support) =>
      paymentSet.has(support.card.instanceId)
        ? { ...support, rested: true }
        : support,
    ),
    discardPile: [...player.discardPile, trapCard],
  }

  const supportToTrash = trap.effects.find(
    (effect) => effect.kind === 'support-to-trash',
  )
  if (supportToTrash?.kind === 'support-to-trash') {
    updatedPlayer = moveSupportsToTrash(
      updatedPlayer,
      options.supportTrashIds ?? [],
      supportToTrash.amount,
    )
  }

  let nextState: GameState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: updatedPlayer,
    },
    pendingBattle: {
      ...battle,
      trapUsed: true,
      ...(trap.condition?.kind ===
      'friendly-color-fainted-this-battle'
        ? {
            delayedTrap: {
              playerId,
              color: trap.condition.color,
              effects: trap.effects,
            },
          }
        : {}),
    },
  }

  const context = {
    sourcePlayerId: playerId,
    sourceInstanceId: trapCard.instanceId,
  }

  for (const effect of trap.effects) {
    if (
      trap.condition?.kind ===
      'friendly-color-fainted-this-battle'
    ) {
      continue
    }

    if (
      effect.kind === 'support-to-trash' ||
      effect.kind === 'prevent-knockout'
    ) {
      if (effect.kind === 'prevent-knockout') {
        const targets = selectEffectTargets(
          nextState,
          context,
          effect.target,
          options.targetIds,
        )
        nextState = {
          ...nextState,
          pendingBattle: {
            ...requirePendingBattle(nextState),
            preventKnockoutTargetIds: [
              ...requirePendingBattle(nextState).preventKnockoutTargetIds,
              ...targets.map((target) => target.card.instanceId),
            ],
          },
        }
      }
      continue
    }

    if (effect.kind === 'damage') {
      const targets = selectEffectTargets(
        nextState,
        context,
        effect.target,
        options.targetIds,
      )
      if (targets.length === 0) {
        continue
      }
      const target = targets[0]
      const targetPlayerId = Object.values(nextState.players).find((owner) =>
        owner.battleArea.some(
          (cookie) =>
            cookie.card.instanceId === target?.card.instanceId,
        ),
      )?.id
      if (!target || !targetPlayerId) {
        throw new GameRuleError('找不到陷阱傷害目標。')
      }
      const activeBattle = requirePendingBattle(nextState)
      nextState = {
        ...nextState,
        pendingBattle: {
          ...activeBattle,
          stage: 'damage',
          remainingDamage: effect.amount,
          damagePlayerId: targetPlayerId,
          damageTargetInstanceId: target.card.instanceId,
          suspendedAttackDamage: activeBattle.declaredDamage,
        },
      }
      continue
    }

    nextState = executeCardEffect(
      nextState,
      context,
      effect,
      effect.kind === 'draw' ||
        effect.kind === 'deck-to-support' ||
        effect.kind === 'gain-hp'
        ? []
        : options.targetIds,
    )
  }

  if (nextState.status !== 'playing') {
    return { ...nextState, pendingBattle: null }
  }

  const activeBattle = requirePendingBattle(nextState)
  if (activeBattle.suspendedAttackDamage !== undefined) {
    return nextState
  }

  const attackerExists = battleParticipantExists(
    nextState,
    activeBattle.attackerInstanceId,
  )
  const targetExists = battleParticipantExists(
    nextState,
    activeBattle.targetInstanceId,
  )

  if (!attackerExists || !targetExists) {
    return finishBattle(nextState)
  }

  const recalculatedDamage = getAttackDamageAgainst(
    nextState,
    activeBattle.attackerInstanceId,
    activeBattle.targetInstanceId,
  )

  return {
    ...nextState,
    pendingBattle: {
      ...activeBattle,
      declaredDamage: recalculatedDamage,
      remainingDamage: recalculatedDamage,
      stage: 'damage',
    },
  }
}

export const skipTrap = (state: GameState, playerId: PlayerId): GameState => {
  const battle = requirePendingBattle(state)
  if (
    battle.stage !== 'trap' ||
    battle.defenderPlayerId !== playerId
  ) {
    throw new GameRuleError('目前沒有可略過的陷阱回應。')
  }

  const attackerExists = battleParticipantExists(
    state,
    battle.attackerInstanceId,
  )
  const targetExists = battleParticipantExists(
    state,
    battle.targetInstanceId,
  )
  if (!attackerExists || !targetExists) {
    return finishBattle(state)
  }

  return {
    ...state,
    pendingBattle: {
      ...battle,
      stage: 'damage',
    },
  }
}

const addFaintedColor = (
  colors: EnergyColor[],
  card: GameCard,
): EnergyColor[] => {
  const color = card.energyColor
  return color && color !== 'wild' && !colors.includes(color)
    ? [...colors, color]
    : colors
}

const removeFaintedCookie = (
  state: GameState,
  playerId: PlayerId,
  targetInstanceId: string,
): GameState => {
  const battle = requirePendingBattle(state)
  const player = state.players[playerId]
  const target = player.battleArea.find(
    (cookie) => cookie.card.instanceId === targetInstanceId,
  )
  if (!target || target.hpCards.length > 0) {
    return state
  }

  let nextState = recordCookieDepartures(
    {
      ...state,
      players: {
        ...state.players,
        [playerId]: {
          ...player,
          battleArea: player.battleArea.filter(
            (cookie) => cookie.card.instanceId !== targetInstanceId,
          ),
          breakArea: [...player.breakArea, target.card],
        },
      },
      pendingBattle: {
        ...battle,
        faintedColors: addFaintedColor(battle.faintedColors, target.card),
      },
    },
    playerId,
    1,
  )

  const faintSkill = target.card.skill
  if (faintSkill && faintSkill.faint) {
    for (const effect of faintSkill.effects) {
      if (
        effect.kind === 'damage' ||
        effect.kind === 'modify-attack' ||
        effect.kind === 'modify-damage-received'
      ) {
        const context = {
          sourcePlayerId: playerId,
          sourceInstanceId: target.card.instanceId,
        }
        const candidates = getEffectTargetCandidates(nextState, context, effect.target)
        if (candidates.length > 0) {
          nextState = {
            ...nextState,
            pendingFaintEffects: [
              ...(nextState.pendingFaintEffects ?? []),
              {
                sourcePlayerId: playerId,
                sourceInstanceId: target.card.instanceId,
                effect,
                context,
              },
            ],
          }
        }
      } else {
        const context = {
          sourcePlayerId: playerId,
          sourceInstanceId: target.card.instanceId,
        }
        nextState = executeCardEffect(nextState, context, effect, [])
      }
    }
  }

  return nextState
}

const finishBattle = (state: GameState): GameState => {
  const battle = requirePendingBattle(state)
  let completedState = state
  if (
    battle.delayedTrap &&
    battle.faintedColors.includes(battle.delayedTrap.color)
  ) {
    for (const effect of battle.delayedTrap.effects) {
      completedState = executeCardEffect(
        completedState,
        {
          sourcePlayerId: battle.delayedTrap.playerId,
          sourceInstanceId: 'delayed-trap',
        },
        effect,
        [],
      )
    }
  }

  return finalizePendingReplacements({
    ...completedState,
    pendingBattle: null,
  })
}

const battleParticipantExists = (
  state: GameState,
  instanceId: string,
): boolean =>
  Object.values(state.players).some((owner) =>
    owner.battleArea.some(
      (cookie) => cookie.card.instanceId === instanceId,
    ),
  )

const finishDamageSequence = (state: GameState): GameState => {
  const battle = requirePendingBattle(state)
  if (battle.suspendedAttackDamage !== undefined) {
    const attackerExists = battleParticipantExists(
      state,
      battle.attackerInstanceId,
    )
    const targetExists = battleParticipantExists(
      state,
      battle.targetInstanceId,
    )
    if (!attackerExists || !targetExists) {
      return finishBattle(state)
    }
    return {
      ...state,
      pendingBattle: {
        ...battle,
        stage: 'damage',
        remainingDamage: battle.suspendedAttackDamage,
        damagePlayerId: undefined,
        damageTargetInstanceId: undefined,
        suspendedAttackDamage: undefined,
        revealedHpCard: null,
      },
    }
  }

  if (battle.attackEffectIndex < battle.attackEffects.length) {
    return {
      ...state,
      pendingBattle: {
        ...battle,
        stage: 'attack-effect',
      },
    }
  }

  return finishBattle(state)
}

export const resolveAttackEffect = (
  state: GameState,
  playerId: PlayerId,
  selectedTargetIds: string[],
): GameState => {
  const battle = requirePendingBattle(state)
  if (
    battle.stage !== 'attack-effect' ||
    battle.attackerPlayerId !== playerId
  ) {
    throw new GameRuleError('目前沒有可處理的攻擊後續效果。')
  }

  const effect = battle.attackEffects[battle.attackEffectIndex]
  if (!effect) {
    return finishBattle(state)
  }

  const nextState = executeCardEffect(
    state,
    {
      sourcePlayerId: playerId,
      sourceInstanceId: battle.attackerInstanceId,
    },
    effect,
    selectedTargetIds,
  )
  if (nextState.status !== 'playing') {
    return { ...nextState, pendingBattle: null }
  }

  const nextBattle = requirePendingBattle(nextState)
  const attackEffectIndex = nextBattle.attackEffectIndex + 1
  if (attackEffectIndex < nextBattle.attackEffects.length) {
    return {
      ...nextState,
      pendingBattle: {
        ...nextBattle,
        attackEffectIndex,
        stage: 'attack-effect',
      },
    }
  }

  return finishBattle({
    ...nextState,
    pendingBattle: {
      ...nextBattle,
      attackEffectIndex,
    },
  })
}

export const resolveNextDamage = (state: GameState): GameState => {
  if (state.pendingRefresh) {
    throw new GameRuleError('必須先完成牌庫 Refresh。')
  }

  const battle = requirePendingBattle(state)
  if (battle.stage !== 'damage') {
    throw new GameRuleError('目前不能翻開下一張 HP 卡。')
  }

  const attackerExists = battleParticipantExists(
    state,
    battle.attackerInstanceId,
  )
  const targetExists = battleParticipantExists(
    state,
    battle.targetInstanceId,
  )
  if (!attackerExists || !targetExists) {
    return finishBattle(state)
  }

  if (battle.remainingDamage <= 0) {
    return finishDamageSequence(state)
  }

  const damagePlayerId =
    battle.damagePlayerId ?? battle.defenderPlayerId
  const damageTargetInstanceId =
    battle.damageTargetInstanceId ?? battle.targetInstanceId
  const defender = state.players[damagePlayerId]
  const targetIndex = defender.battleArea.findIndex(
    (cookie) => cookie.card.instanceId === damageTargetInstanceId,
  )
  const target = defender.battleArea[targetIndex]
  if (!target) {
    return finishDamageSequence(state)
  }

  if (target.hpCards.length === 0) {
    const afterFaint = removeFaintedCookie(
      state,
      damagePlayerId,
      damageTargetInstanceId,
    )
    if (afterFaint.pendingFaintEffects && afterFaint.pendingFaintEffects.length > 0) {
      return afterFaint
    }
    return finishDamageSequence(afterFaint)
  }

  const protectedFromKnockout =
    battle.preventKnockoutTargetIds.includes(damageTargetInstanceId) &&
    target.hpCards.length === 1
  if (protectedFromKnockout) {
    return finishDamageSequence({
      ...state,
      pendingBattle: {
        ...battle,
        remainingDamage: 0,
      },
    })
  }

  const revealedHpCard = target.hpCards[target.hpCards.length - 1]
  const updatedDefender: PlayerState = {
    ...defender,
    battleArea: defender.battleArea.map((cookie, index) =>
      index === targetIndex
        ? {
            ...cookie,
            hpCards: cookie.hpCards.slice(0, -1),
          }
        : cookie,
    ),
  }
  let nextState: GameState = {
    ...state,
    players: {
      ...state.players,
      [defender.id]: updatedDefender,
    },
    pendingBattle: {
      ...battle,
      remainingDamage: battle.remainingDamage - 1,
      revealedHpCard,
      stage:
        revealedHpCard.flip &&
        state.flipDisabledUntilTurn?.[target.card.instanceId] !==
          state.turnNumber
          ? 'flip'
          : 'damage',
    },
  }

  if (
    revealedHpCard.flip &&
    state.flipDisabledUntilTurn?.[target.card.instanceId] !==
      state.turnNumber
  ) {
    return nextState
  }

  nextState = {
    ...nextState,
    players: {
      ...nextState.players,
      [defender.id]: {
        ...nextState.players[defender.id],
        discardPile: [
          ...nextState.players[defender.id].discardPile,
          revealedHpCard,
        ],
      },
    },
    pendingBattle: {
      ...requirePendingBattle(nextState),
      revealedHpCard: null,
    },
  }
  nextState = removeFaintedCookie(
    nextState,
    defender.id,
    damageTargetInstanceId,
  )

  if (nextState.pendingFaintEffects && nextState.pendingFaintEffects.length > 0) {
    return nextState
  }

  return requirePendingBattle(nextState).remainingDamage <= 0
    ? finishDamageSequence(nextState)
    : nextState
}

export interface ResolveFlipOptions {
  activate: boolean
  discardHandIds?: string[]
}

export const resolveFlip = (
  state: GameState,
  playerId: PlayerId,
  options: ResolveFlipOptions,
): GameState => {
  const battle = requirePendingBattle(state)
  const revealed = battle.revealedHpCard
  if (
    battle.stage !== 'flip' ||
    (battle.damagePlayerId ?? battle.defenderPlayerId) !== playerId ||
    !revealed?.flip
  ) {
    throw new GameRuleError('目前沒有可處理的 FLIP 效果。')
  }

  let nextState = state
  if (options.activate) {
    const player = nextState.players[playerId]
    const discardIds = [...new Set(options.discardHandIds ?? [])]
    if (discardIds.length !== revealed.flip.cost.discardHand) {
      throw new GameRuleError(
        `必須棄置 ${revealed.flip.cost.discardHand} 張手牌支付 FLIP 代價。`,
      )
    }
    const discarded = player.hand.filter((card) =>
      discardIds.includes(card.instanceId),
    )
    if (discarded.length !== discardIds.length) {
      throw new GameRuleError('只能棄置自己的手牌。')
    }
    nextState = {
      ...nextState,
      players: {
        ...nextState.players,
        [playerId]: {
          ...player,
          hand: player.hand.filter(
            (card) => !discardIds.includes(card.instanceId),
          ),
          discardPile: [...player.discardPile, ...discarded],
        },
      },
    }

    for (const effect of revealed.flip.effects) {
      if (effect.kind === 'gain-hp') {
        const owner = nextState.players[playerId]
        const targetIndex = owner.battleArea.findIndex(
          (cookie) =>
            cookie.card.instanceId ===
            (battle.damageTargetInstanceId ?? battle.targetInstanceId),
        )
        const target = owner.battleArea[targetIndex]
        if (!target || owner.deck.length < effect.amount) {
          throw new GameRuleError('牌庫張數不足，無法增加 HP。')
        }
        const gainedCards = owner.deck.slice(0, effect.amount)
        nextState = {
          ...nextState,
          players: {
            ...nextState.players,
            [playerId]: {
              ...owner,
              deck: owner.deck.slice(effect.amount),
              battleArea: owner.battleArea.map((cookie, index) =>
                index === targetIndex
                  ? {
                      ...cookie,
                      hpCards: [...cookie.hpCards, ...gainedCards],
                    }
                  : cookie,
              ),
            },
          },
        }
      } else {
        nextState = executeCardEffect(
          nextState,
          {
            sourcePlayerId: playerId,
            sourceInstanceId: revealed.instanceId,
          },
          effect,
          [],
        )
      }
    }
  }

  const player = nextState.players[playerId]
  nextState = {
    ...nextState,
    players: {
      ...nextState.players,
      [playerId]: {
        ...player,
        discardPile: [...player.discardPile, revealed],
      },
    },
    pendingBattle: {
      ...requirePendingBattle(nextState),
      stage: 'damage',
      revealedHpCard: null,
    },
  }
  nextState = removeFaintedCookie(
    nextState,
    playerId,
    battle.damageTargetInstanceId ?? battle.targetInstanceId,
  )

  if (nextState.pendingFaintEffects && nextState.pendingFaintEffects.length > 0) {
    return nextState
  }

  return requirePendingBattle(nextState).remainingDamage <= 0
    ? finishDamageSequence(nextState)
    : nextState
}

export const resolveBattleAutomatically = (state: GameState): GameState => {
  let nextState = state
  let guard = 0

  while ((nextState.pendingBattle || (nextState.pendingFaintEffects && nextState.pendingFaintEffects.length > 0)) && guard < 100) {
    guard += 1

    if (nextState.status !== 'playing') {
      break
    }

    if (nextState.pendingFaintEffects && nextState.pendingFaintEffects.length > 0) {
      const faint = nextState.pendingFaintEffects[0]
      if (
        faint.effect.kind === 'damage' ||
        faint.effect.kind === 'modify-attack' ||
        faint.effect.kind === 'modify-damage-received'
      ) {
        const candidates = getEffectTargetCandidates(
          nextState,
          faint.context,
          (faint.effect as { target: EffectTargetSelector }).target,
        )
        const targetIds = candidates.length > 0 ? [candidates[0].card.instanceId] : []
        nextState = resolveFaintEffect(nextState, targetIds)
      } else {
        nextState = resolveFaintEffect(nextState, [])
      }
      continue
    }

    const battle = nextState.pendingBattle!
    if (battle.stage === 'trap') {
      nextState = skipTrap(nextState, battle.defenderPlayerId)
    } else if (battle.stage === 'flip') {
      nextState = resolveFlip(nextState, battle.defenderPlayerId, {
        activate: false,
      })
    } else if (battle.stage === 'attack-effect') {
      const effect = battle.attackEffects[battle.attackEffectIndex]
      const targetIds =
        effect?.kind === 'break-to-trash'
          ? getBreakToTrashCandidates(
              nextState,
              {
                sourcePlayerId: battle.attackerPlayerId,
                sourceInstanceId: battle.attackerInstanceId,
              },
              effect,
            )
              .slice(0, effect.max)
              .map((card) => card.instanceId)
          : []
      nextState = resolveAttackEffect(
        nextState,
        battle.attackerPlayerId,
        targetIds,
      )
    } else {
      nextState = resolveNextDamage(nextState)
    }
  }

  if (guard >= 100) {
    throw new GameRuleError('戰鬥結算超過安全上限。')
  }

  return nextState
}

export const getTrapTargetCandidates = (
  state: GameState,
  playerId: PlayerId,
  trapInstanceId: string,
) => {
  const card = state.players[playerId].hand.find(
    (candidate) => candidate.instanceId === trapInstanceId,
  )
  const targetEffect = card?.trap?.effects.find(
    (effect) =>
      effect.kind === 'damage' ||
      effect.kind === 'modify-attack' ||
      effect.kind === 'prevent-knockout',
  )
  return targetEffect
    ? getEffectTargetCandidates(
        state,
        {
          sourcePlayerId: playerId,
          sourceInstanceId: card!.instanceId,
        },
        targetEffect.target,
      )
    : []
}

export const getFaintEffectCandidates = (
  state: GameState,
): CookieInBattle[] => {
  const faint = state.pendingFaintEffects?.[0]
  if (
    !faint ||
    (faint.effect.kind !== 'damage' &&
      faint.effect.kind !== 'modify-attack' &&
      faint.effect.kind !== 'modify-damage-received')
  ) {
    return []
  }
  return getEffectTargetCandidates(state, faint.context, faint.effect.target)
}

export const getFaintEffectMinMax = (
  effect: CardEffect,
): { min: number; max: number } => {
  if (
    effect.kind === 'damage' ||
    effect.kind === 'modify-attack' ||
    effect.kind === 'modify-damage-received'
  ) {
    return { min: effect.target.min ?? 0, max: effect.target.max ?? 1 }
  }
  return { min: 0, max: 0 }
}

export const resolveFaintEffect = (
  state: GameState,
  targetIds: string[],
): GameState => {
  const faints = state.pendingFaintEffects
  if (!faints || faints.length === 0) {
    throw new GameRuleError('目前沒有待處理的昏厥效果。')
  }

  const faint = faints[0]
  const remaining = faints.slice(1)
  let nextState: GameState = {
    ...state,
    pendingFaintEffects: remaining.length > 0 ? remaining : undefined,
  }

  if (
    faint.effect.kind === 'damage' ||
    faint.effect.kind === 'modify-attack' ||
    faint.effect.kind === 'modify-damage-received'
  ) {
    if (targetIds.length > 0) {
      selectEffectTargets(nextState, faint.context, faint.effect.target, targetIds)
      nextState = executeCardEffect(
        nextState,
        faint.context,
        faint.effect,
        targetIds,
      )
    } else if (faint.effect.target.min > 0) {
      throw new GameRuleError('昏厥效果目標數量不足。')
    }
  }

  if (nextState.status !== 'playing') {
    return nextState
  }

  return nextState
}
