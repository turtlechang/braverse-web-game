import type { PlayerView } from '../../player-view'
import type { GameCard, PlayerId } from '../../types'

/**
 * G2 的長期策略記憶只保存由合法觀察事件帶入的事實。它刻意不接收
 * `GameState`，避免 AI 從完整牌庫、對手手牌或未翻 HP 反推出隱藏資訊。
 */
export type KnowledgeCertainty = 'confirmed' | 'publicly-revealed' | 'inferred'

export type KnownPosition =
  | 'deck-top'
  | 'deck-bottom'
  | 'deck-index'
  | 'public-zone'

export type PublicZone =
  | 'battle'
  | 'support'
  | 'break'
  | 'discard'
  | 'stage'

export type KnowledgeSourceEvent =
  | 'inspect'
  | 'reveal'
  | 'known-move'
  | 'public-play'
  | 'public-discard'

export interface KnowledgeSource {
  event: KnowledgeSourceEvent
  observer: PlayerId
  commandLogIndex?: number
}

export interface KnownCardFact {
  playerId: PlayerId
  cardId: string
  instanceId?: string
  position: KnownPosition
  /** 只適用於 deck-top／deck-bottom／deck-index。 */
  deckSequenceVersion?: number
  /** deck-index 的邊界索引；0 表示最靠近指定邊界。 */
  indexFromBoundary?: number
  publicZone?: PublicZone
  certainty: KnowledgeCertainty
  source: KnowledgeSource
}

export interface KnowledgeState {
  observerId: PlayerId
  deckSequenceVersion: Record<PlayerId, number>
  facts: readonly KnownCardFact[]
}

export type DeckInvalidationReason =
  | 'shuffle'
  | 'refresh-shuffle'
  | 'mulligan-shuffle'
  | 'unknown-deck-change'

interface KnowledgeEventBase {
  playerId: PlayerId
}

/**
 * `self-private` 僅允許觀察者自己的已知卡；對手牌庫資訊必須是 `public`。
 */
export interface ObserveKnownDeckCardEvent extends KnowledgeEventBase {
  kind: 'observe-known-deck-card'
  visibility: 'self-private' | 'public'
  cardId: string
  instanceId?: string
  position: Exclude<KnownPosition, 'public-zone'>
  indexFromBoundary?: number
  source: KnowledgeSource
}

export interface ObservePublicCardEvent extends KnowledgeEventBase {
  kind: 'observe-public-card'
  cardId: string
  instanceId?: string
  zone: PublicZone
  source: KnowledgeSource
}

export interface ForgetKnownCardEvent extends KnowledgeEventBase {
  kind: 'forget-known-card'
  cardId?: string
  instanceId?: string
}

export interface InvalidateDeckSequenceEvent extends KnowledgeEventBase {
  kind: 'invalidate-deck-sequence'
  reason: DeckInvalidationReason
}

export type KnowledgeEvent =
  | ObserveKnownDeckCardEvent
  | ObservePublicCardEvent
  | ForgetKnownCardEvent
  | InvalidateDeckSequenceEvent

export class KnowledgeBoundaryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'KnowledgeBoundaryError'
  }
}

const isDeckPosition = (
  position: KnownPosition,
): position is Exclude<KnownPosition, 'public-zone'> => position !== 'public-zone'

const compareFacts = (left: KnownCardFact, right: KnownCardFact): number => {
  const leftKey = [
    left.playerId,
    left.position,
    left.publicZone ?? '',
    left.deckSequenceVersion ?? -1,
    left.indexFromBoundary ?? -1,
    left.instanceId ?? '',
    left.cardId,
  ].join('|')
  const rightKey = [
    right.playerId,
    right.position,
    right.publicZone ?? '',
    right.deckSequenceVersion ?? -1,
    right.indexFromBoundary ?? -1,
    right.instanceId ?? '',
    right.cardId,
  ].join('|')
  return leftKey.localeCompare(rightKey)
}

const sortFacts = (facts: readonly KnownCardFact[]): KnownCardFact[] =>
  [...facts].sort(compareFacts)

const isSameKnownCard = (
  fact: KnownCardFact,
  card: { cardId?: string; instanceId?: string },
): boolean =>
  card.instanceId
    ? fact.instanceId === card.instanceId
    : card.cardId !== undefined && fact.cardId === card.cardId

const assertEventObserver = (
  state: KnowledgeState,
  source: KnowledgeSource,
) => {
  if (source.observer !== state.observerId) {
    throw new KnowledgeBoundaryError('知識事件的 observer 必須是目前策略觀察者。')
  }
}

const makePublicFact = (
  observerId: PlayerId,
  playerId: PlayerId,
  card: GameCard,
  zone: PublicZone,
): KnownCardFact => ({
  playerId,
  cardId: card.id,
  instanceId: card.instanceId,
  position: 'public-zone',
  publicZone: zone,
  certainty: 'publicly-revealed',
  source: {
    event: zone === 'discard' ? 'public-discard' : 'public-play',
    observer: observerId,
  },
})

const publicFactsFromView = (view: PlayerView): KnownCardFact[] => {
  const facts: KnownCardFact[] = []
  const addSide = (side: PlayerView['self']) => {
    side.battleArea.forEach((cookie) =>
      facts.push(makePublicFact(view.viewerId, side.id, cookie.card, 'battle')),
    )
    side.supportArea.forEach((support) =>
      facts.push(makePublicFact(view.viewerId, side.id, support.card, 'support')),
    )
    side.breakArea.forEach((card) =>
      facts.push(makePublicFact(view.viewerId, side.id, card, 'break')),
    )
    side.discardPile.forEach((card) =>
      facts.push(makePublicFact(view.viewerId, side.id, card, 'discard')),
    )
    if (side.stage) {
      facts.push(makePublicFact(view.viewerId, side.id, side.stage.card, 'stage'))
    }
  }
  addSide(view.self)
  addSide(view.opponent)
  return sortFacts(facts)
}

const isCurrentDeckFact = (state: KnowledgeState, fact: KnownCardFact): boolean =>
  isDeckPosition(fact.position) &&
  fact.deckSequenceVersion === state.deckSequenceVersion[fact.playerId]

const removeFactsForCard = (
  facts: readonly KnownCardFact[],
  card: { cardId?: string; instanceId?: string },
): KnownCardFact[] => facts.filter((fact) => !isSameKnownCard(fact, card))

export const createKnowledgeState = (observerId: PlayerId): KnowledgeState => ({
  observerId,
  deckSequenceVersion: {
    'player-one': 0,
    'player-two': 0,
  },
  facts: [],
})

/**
 * 將目前合法 PlayerView 的公開區同步到記憶。PlayerView 不含對手手牌、
 * 牌庫內容或 HP 卡面，因此這個入口無法把它們存入 KnowledgeState。
 */
export const synchronizeKnowledgeWithPlayerView = (
  state: KnowledgeState,
  view: PlayerView,
): KnowledgeState => {
  if (view.viewerId !== state.observerId) {
    throw new KnowledgeBoundaryError('PlayerView 的 viewer 必須與策略觀察者一致。')
  }
  const retainedFacts = state.facts.filter(
    (fact) => fact.position !== 'public-zone' &&
      (!isDeckPosition(fact.position) || isCurrentDeckFact(state, fact)),
  )
  return {
    ...state,
    facts: sortFacts([...retainedFacts, ...publicFactsFromView(view)]),
  }
}

export const createKnowledgeStateFromPlayerView = (
  view: PlayerView,
): KnowledgeState => synchronizeKnowledgeWithPlayerView(
  createKnowledgeState(view.viewerId),
  view,
)

export const applyKnowledgeEvent = (
  state: KnowledgeState,
  event: KnowledgeEvent,
): KnowledgeState => {
  switch (event.kind) {
    case 'observe-known-deck-card': {
      assertEventObserver(state, event.source)
      if (event.visibility === 'self-private' && event.playerId !== state.observerId) {
        throw new KnowledgeBoundaryError('不能把對手未公開的牌庫卡加入策略記憶。')
      }
      const indexFromBoundary = event.indexFromBoundary
      if (event.position === 'deck-index' &&
        (indexFromBoundary === undefined ||
          !Number.isInteger(indexFromBoundary) ||
          indexFromBoundary < 0)) {
        throw new KnowledgeBoundaryError('deck-index 必須帶有非負整數的邊界索引。')
      }
      if (event.position !== 'deck-index' && event.indexFromBoundary !== undefined) {
        throw new KnowledgeBoundaryError('只有 deck-index 可以帶有邊界索引。')
      }
      const currentVersion = state.deckSequenceVersion[event.playerId]
      const existing = removeFactsForCard(state.facts, event)
      const fact: KnownCardFact = {
        playerId: event.playerId,
        cardId: event.cardId,
        instanceId: event.instanceId,
        position: event.position,
        deckSequenceVersion: currentVersion,
        indexFromBoundary: event.indexFromBoundary,
        certainty: event.visibility === 'public'
          ? 'publicly-revealed'
          : 'confirmed',
        source: event.source,
      }
      return { ...state, facts: sortFacts([...existing, fact]) }
    }
    case 'observe-public-card': {
      assertEventObserver(state, event.source)
      const existing = removeFactsForCard(state.facts, event)
      const fact: KnownCardFact = {
        playerId: event.playerId,
        cardId: event.cardId,
        instanceId: event.instanceId,
        position: 'public-zone',
        publicZone: event.zone,
        certainty: 'publicly-revealed',
        source: event.source,
      }
      return { ...state, facts: sortFacts([...existing, fact]) }
    }
    case 'forget-known-card': {
      if (!event.cardId && !event.instanceId) {
        throw new KnowledgeBoundaryError('遺忘已知卡時必須提供 cardId 或 instanceId。')
      }
      return {
        ...state,
        facts: sortFacts(removeFactsForCard(state.facts, event)),
      }
    }
    case 'invalidate-deck-sequence': {
      const nextVersion = state.deckSequenceVersion[event.playerId] + 1
      return {
        ...state,
        deckSequenceVersion: {
          ...state.deckSequenceVersion,
          [event.playerId]: nextVersion,
        },
        facts: state.facts.filter(
          (fact) => !(
            fact.playerId === event.playerId &&
            isDeckPosition(fact.position)
          ),
        ),
      }
    }
  }
}

export const replayKnowledgeEvents = (
  observerId: PlayerId,
  events: readonly KnowledgeEvent[],
): KnowledgeState => events.reduce(applyKnowledgeEvent, createKnowledgeState(observerId))

export const getKnownDeckFacts = (
  state: KnowledgeState,
  playerId: PlayerId,
): KnownCardFact[] => sortFacts(state.facts.filter(
  (fact) => fact.playerId === playerId &&
    fact.certainty !== 'inferred' &&
    isCurrentDeckFact(state, fact),
))

export const getPublicFacts = (
  state: KnowledgeState,
  playerId?: PlayerId,
): KnownCardFact[] => sortFacts(state.facts.filter(
  (fact) => fact.position === 'public-zone' &&
    (playerId === undefined || fact.playerId === playerId),
))
