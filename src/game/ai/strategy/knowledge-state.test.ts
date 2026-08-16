import { describe, expect, it } from 'vitest'
import { createDemoGame } from '../../demo'
import { createPlayerView } from '../../player-view'
import type { GameCard, GameState, PlayerId } from '../../types'
import {
  applyKnowledgeEvent,
  createKnowledgeState,
  createKnowledgeStateFromPlayerView,
  getKnownDeckFacts,
  getPublicFacts,
  KnowledgeBoundaryError,
  replayKnowledgeEvents,
  synchronizeKnowledgeWithPlayerView,
  type KnowledgeEvent,
  type KnowledgeSourceEvent,
} from './knowledge-state'

const source = (
  event: KnowledgeSourceEvent,
  observer: PlayerId = 'player-one',
) => ({ event, observer })

const knownBottom = (): KnowledgeEvent => ({
  kind: 'observe-known-deck-card',
  visibility: 'self-private',
  playerId: 'player-one',
  cardId: 'fixture-known-bottom',
  instanceId: 'fixture-known-bottom-instance',
  position: 'deck-bottom',
  source: source('known-move'),
})

describe('KnowledgeState', () => {
  it('記住自己合法放到牌庫底的卡，並附上當前牌序版本', () => {
    const state = applyKnowledgeEvent(createKnowledgeState('player-one'), knownBottom())

    expect(getKnownDeckFacts(state, 'player-one')).toEqual([
      expect.objectContaining({
        cardId: 'fixture-known-bottom',
        position: 'deck-bottom',
        deckSequenceVersion: 0,
        certainty: 'confirmed',
      }),
    ])
  })

  it('只保存實際公開給觀察者的對手牌庫卡，不憑相鄰未知卡補全資訊', () => {
    const state = applyKnowledgeEvent(createKnowledgeState('player-one'), {
      kind: 'observe-known-deck-card',
      visibility: 'public',
      playerId: 'player-two',
      cardId: 'fixture-revealed-top',
      instanceId: 'fixture-revealed-top-instance',
      position: 'deck-top',
      source: source('reveal'),
    })

    expect(getKnownDeckFacts(state, 'player-two')).toEqual([
      expect.objectContaining({
        cardId: 'fixture-revealed-top',
        certainty: 'publicly-revealed',
      }),
    ])
    expect(JSON.stringify(state)).not.toContain('fixture-unrevealed-neighbor')
  })

  it('拒絕把對手未公開的牌庫資訊寫入自己策略記憶', () => {
    expect(() => applyKnowledgeEvent(createKnowledgeState('player-one'), {
      kind: 'observe-known-deck-card',
      visibility: 'self-private',
      playerId: 'player-two',
      cardId: 'fixture-illegal-opponent-card',
      position: 'deck-bottom',
      source: source('inspect'),
    })).toThrow(KnowledgeBoundaryError)
  })

  it('洗牌與未知牌庫變動都會遞增版本並清除受影響的牌序事實', () => {
    let state = applyKnowledgeEvent(createKnowledgeState('player-one'), knownBottom())
    state = applyKnowledgeEvent(state, {
      kind: 'observe-public-card',
      playerId: 'player-one',
      cardId: 'fixture-public-discard',
      instanceId: 'fixture-public-discard-instance',
      zone: 'discard',
      source: source('public-discard'),
    })
    state = applyKnowledgeEvent(state, {
      kind: 'invalidate-deck-sequence',
      playerId: 'player-one',
      reason: 'refresh-shuffle',
    })

    expect(state.deckSequenceVersion['player-one']).toBe(1)
    expect(getKnownDeckFacts(state, 'player-one')).toEqual([])
    expect(getPublicFacts(state, 'player-one')).toEqual([
      expect.objectContaining({
        cardId: 'fixture-public-discard',
        position: 'public-zone',
      }),
    ])

    state = applyKnowledgeEvent(state, {
      kind: 'invalidate-deck-sequence',
      playerId: 'player-one',
      reason: 'unknown-deck-change',
    })
    expect(state.deckSequenceVersion['player-one']).toBe(2)
  })

  it('只由 PlayerView 同步公開區，因此未知底牌、對手手牌與未翻 HP 不會影響記憶', () => {
    const baseline = createDemoGame(17)
    const hiddenCard = (card: GameCard, index: number): GameCard => ({
      ...card,
      id: `hidden-card-${index}-${card.id}`,
      instanceId: `hidden-instance-${index}-${card.instanceId}`,
    }) as GameCard
    const privateVariant: GameState = {
      ...baseline,
      players: {
        ...baseline.players,
        'player-one': {
          ...baseline.players['player-one'],
          deck: baseline.players['player-one'].deck.map(hiddenCard),
        },
        'player-two': {
          ...baseline.players['player-two'],
          hand: baseline.players['player-two'].hand.map(hiddenCard),
          battleArea: baseline.players['player-two'].battleArea.map((cookie) => ({
            ...cookie,
            hpCards: cookie.hpCards.map(hiddenCard),
          })),
        },
      },
    }

    const baselineKnowledge = createKnowledgeStateFromPlayerView(
      createPlayerView(baseline, 'player-one'),
    )
    const variantKnowledge = createKnowledgeStateFromPlayerView(
      createPlayerView(privateVariant, 'player-one'),
    )

    expect(variantKnowledge).toEqual(baselineKnowledge)
    expect(getKnownDeckFacts(variantKnowledge, 'player-one')).toEqual([])
    expect(JSON.stringify(variantKnowledge)).not.toContain('hidden-card-')
  })

  it('PlayerView 同步只保留當前公開區卡牌，並不延續已離開公開區的舊事實', () => {
    const view = createPlayerView(createDemoGame(19), 'player-one')
    const state = applyKnowledgeEvent(createKnowledgeState('player-one'), {
      kind: 'observe-public-card',
      playerId: 'player-two',
      cardId: 'fixture-no-longer-public',
      instanceId: 'fixture-no-longer-public-instance',
      zone: 'support',
      source: source('public-play'),
    })
    const synchronized = synchronizeKnowledgeWithPlayerView(state, view)

    expect(getPublicFacts(synchronized).map((fact) => fact.cardId)).not.toContain(
      'fixture-no-longer-public',
    )
  })

  it('可重播的事件序列完全 deterministic', () => {
    const events: KnowledgeEvent[] = [
      knownBottom(),
      {
        kind: 'observe-known-deck-card',
        visibility: 'public',
        playerId: 'player-two',
        cardId: 'fixture-public-bottom',
        instanceId: 'fixture-public-bottom-instance',
        position: 'deck-bottom',
        source: source('reveal'),
      },
      {
        kind: 'invalidate-deck-sequence',
        playerId: 'player-one',
        reason: 'mulligan-shuffle',
      },
    ]

    expect(replayKnowledgeEvents('player-one', events)).toEqual(
      replayKnowledgeEvents('player-one', events),
    )
  })
})
