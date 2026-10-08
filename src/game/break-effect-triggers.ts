import type { AbilityCost, CardEffect, EffectContext, GameState, PendingAfterDamageEffect, PlayerId } from './types'
import { evaluateBreakLevelVictory } from './victory'

/** A newly met standby condition waits for the effect chain that caused it. */
export const isBreakEntryEffectWaiting = (
  state: GameState,
  pending: PendingAfterDamageEffect,
): boolean => pending.triggerReason === 'break-by-arena-effect' && Boolean(
  state.pendingAbilityEffect || state.pendingDrawUpTo || state.pendingRefresh || state.pendingBattle?.effectDamageSequence,
)

/** Preserve the public source identity before deferred damage or source departure. */
export const isArenaEffectSource = (state: GameState, context: EffectContext): boolean => {
  const owner = state.players[context.sourcePlayerId]
  return [...owner.hand, ...owner.discardPile, ...owner.breakArea,
    ...(state.pendingBattle?.revealedHpCard ? [state.pendingBattle.revealedHpCard] : []),
    ...owner.supportArea.map(entry => entry.card), ...(owner.stage ? [owner.stage.card] : []),
    ...owner.battleArea.flatMap(entry => [entry.card, ...entry.hpCards, ...(entry.equippedCards ?? [])]),
  ].some(card => card.instanceId === context.sourceInstanceId && card.keywords?.includes('arena'))
}

const collectBreakEntryMoves = (
  before: GameState,
  after: GameState,
  context: EffectContext,
  eligibleIds: ReadonlySet<string> | null,
  knownArenaSource = false,
): GameState => {
  // Comprehensive Rules 8-3-5: a standby source moved to a private zone
  // before activation loses that waiting effect.
  if (after.pendingAfterDamageEffects?.some(entry => entry.triggerReason === 'break-by-arena-effect')) {
    const privateIds = new Set(Object.values(after.players).flatMap(player => [
      ...player.hand, ...player.deck, ...(player.extraDeck ?? []),
      ...player.battleArea.flatMap(entry => entry.hpCards.filter(card => !entry.faceUpHpCardInstanceIds?.includes(card.instanceId))),
    ]).map(card => card.instanceId))
    const retained = after.pendingAfterDamageEffects.filter(entry => entry.triggerReason !== 'break-by-arena-effect' || !privateIds.has(entry.sourceInstanceId))
    if (retained.length !== after.pendingAfterDamageEffects.length) {
      after = { ...after, pendingAfterDamageEffects: retained.length ? retained : undefined }
    }
  }
  if (eligibleIds?.size === 0 || after.status !== 'playing' || evaluateBreakLevelVictory(after)) return after
  if (!knownArenaSource && !isArenaEffectSource(before, context)) return after
  let next = after
  for (const playerId of ['player-one', 'player-two'] as PlayerId[]) {
    const oldIds = new Set(before.players[playerId].breakArea.map(card => card.instanceId))
    for (const card of after.players[playerId].breakArea) {
      const skill = card.skill
      if (oldIds.has(card.instanceId) || (eligibleIds && !eligibleIds.has(card.instanceId)) || skill?.trigger !== 'break-by-arena-effect' ||
        (skill.yourTurn && after.activePlayerId !== playerId) ||
        next.pendingAfterDamageEffects?.some(entry => entry.triggerReason === 'break-by-arena-effect' && entry.sourceInstanceId === card.instanceId)) continue
      const triggerContext = { sourcePlayerId: playerId, sourceInstanceId: card.instanceId, sourceCardName: card.name }
      next = { ...next, pendingAfterDamageEffects: [...(next.pendingAfterDamageEffects ?? []),
        ...skill.effects.map(triggeredEffect => ({ triggerReason: 'break-by-arena-effect' as const, ...triggerContext, context: triggerContext, effect: triggeredEffect })),
      ] }
    }
  }
  return next
}

/** User ruling: Arena effect damage and effect-caused fainting also trigger 032. */
export const collectBreakEntryEffects = (before: GameState, after: GameState, context: EffectContext, effect: CardEffect): GameState => {
  const direct = effect.kind === 'battle-to-break' || effect.kind === 'hand-to-break' ||
    effect.kind === 'trash-to-break' || effect.kind === 'opponent-trash-to-break' || effect.kind === 'flip-to-break' ||
    effect.kind === 'hand-to-break-by-level-sum' || effect.kind === 'opponent-break-to-trash-then-battle-to-break' ||
    (effect.kind === 'opponent-battle-to-trash' && effect.destination === 'break')
  const causedFaint = (['player-one', 'player-two'] as PlayerId[]).some(playerId =>
    (after.cookiesFaintedThisTurn?.[playerId] ?? 0) > (before.cookiesFaintedThisTurn?.[playerId] ?? 0))
  return collectBreakEntryMoves(before, after, context, direct || causedFaint ? null : new Set())
}

/** Called only with the Arena source snapshot of a deferred effect damage sequence. */
export const collectArenaEffectFaintEntry = (before: GameState, after: GameState, context: EffectContext, instanceId: string): GameState =>
  collectBreakEntryMoves(before, after, context, new Set([instanceId]), true)

/** R001: Arena movement, HP and faint costs can all meet the Break-entry skill. */
export const collectBreakEntryCostEffects = (
  before: GameState, after: GameState, context: EffectContext, cost: AbilityCost,
  choices: { trashBattleCookieIds?: string[]; trashCookieToBreakAreaIds?: string[]; handToBreakAreaIds?: string[]; cookieToBreakAreaIds?: string[] } = {},
): GameState => {
  if (evaluateBreakLevelVictory(after)) return after
  const ids = new Set([
    ...(cost.trashBattleCookie?.toBreakArea || cost.trashBattleCookie?.faint
      ? cost.trashBattleCookie.sourceOnly ? [context.sourceInstanceId] : choices.trashBattleCookieIds ?? [] : []),
    ...(cost.trashCookieToBreakArea ? choices.trashCookieToBreakAreaIds ?? [] : []),
    ...(cost.handToBreakArea ? choices.handToBreakAreaIds ?? [] : []),
    ...(cost.cookieToBreakArea ? choices.cookieToBreakAreaIds ?? [] : []),
    ...(cost.selfToBreakArea ? [context.sourceInstanceId] : []),
    ...(cost.selfToFaint ? [context.sourceInstanceId] : []),
    // The paid HP record is shared by skill, item, stage and attack costs.
    // Only prior battle Cookies can faint from HP payment; a Refresh card
    // entering Break during the same chain must not acquire this provenance.
    ...(cost.hpToTrash || cost.hpToHand
      ? before.players[context.sourcePlayerId].battleArea.map(cookie => cookie.card.instanceId) : []),
  ])
  return collectBreakEntryMoves(before, after, context, ids)
}
