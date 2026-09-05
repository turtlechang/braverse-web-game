import { describe, expect, it } from 'vitest'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import { getCardPoolEntry } from './card-pool'
import { applyGameCommand } from './commands'
import { executeCardEffect } from './effects'
import type { CardEffect, CookieCard, GameCard, GameState, PlayerId, PlayerState } from './types'

const item = (instanceId: string): GameCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'item',
  energyColor: 'green',
})

const cookie = (instanceId: string): CookieCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'cookie',
  level: 1,
  hp: 5,
  attack: 1,
  attackCost: 1,
})

const player = (id: PlayerId): PlayerState => ({
  id,
  name: id,
  deck: [item(`${id}-deck-1`), item(`${id}-deck-2`), item(`${id}-deck-3`)],
  hand: [cookie(`${id}-hand-cookie`)],
  battleArea: [{
    card: cookie(`${id}-battle-cookie`),
    hpCards: Array.from({ length: 5 }, (_, index) => item(`${id}-hp-${index}`)),
    rested: false,
  }],
  supportArea: [],
  breakArea: [],
  discardPile: [],
  stage: null,
  hasMulliganed: true,
  startingCookieSelected: true,
})

const createState = (): GameState => ({
  players: { 'player-one': player('player-one'), 'player-two': player('player-two') },
  firstPlayerId: 'player-one',
  activePlayerId: 'player-one',
  turnNumber: 3,
  phase: 'main',
  status: 'playing',
  result: null,
  supportPlacedThisTurn: false,
  skillUsesThisTurn: [],
  nextBattleEntrySequence: 3,
  attackModifiers: [],
  damageReceivedModifiers: [],
  pendingReplacement: null,
  departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
  pendingRefresh: null,
  pendingOnPlay: null,
  pendingBattle: null,
})

const advance = (state: GameState) => applyGameCommand(state, {
  kind: 'advance-phase',
  playerId: state.activePlayerId,
})

const defer = (
  state: GameState,
  effects: CardEffect[],
  sourcePlayerId: PlayerId = 'player-one',
) => executeCardEffect(state, {
  sourcePlayerId,
  sourceInstanceId: state.players[sourcePlayerId].battleArea[0].card.instanceId,
}, { kind: 'deferred-end-of-turn', effects }, [])

const addRestedSupports = (state: GameState, count: number) => {
  state.players['player-one'].supportArea = Array.from({ length: count }, (_, index) => ({
    card: item(`support-${index}`),
    rested: true,
  }))
}

const activeSupportCount = (state: GameState) =>
  state.players['player-one'].supportArea.filter(support => !support.rested).length

describe('deferred end-of-turn effect queue', () => {
  it('resolves both official BS5-060 attack events before changing turns', () => {
    let state = createState()
    const official = getCardPoolEntry('BS5-060')
    if (!official) throw new Error('Missing formal BS5-060 card')
    const conversion = convertOfficialCardToGameCard(official)
    if (conversion.status !== 'converted' || conversion.gameCard.type !== 'cookie') {
      throw new Error('BS5-060 must convert to a Cookie')
    }
    const croissant = conversion.gameCard
    state.players['player-one'].battleArea = ['first', 'second'].map(instance => ({
      card: { ...croissant, instanceId: `BS5-060-${instance}` },
      hpCards: Array.from({ length: croissant.hp }, (_, index) => item(`${instance}-hp-${index}`)),
      rested: false,
    }))
    addRestedSupports(state, 6)
    state.players['player-one'].supportArea.forEach(support => { support.rested = false })
    const target = state.players['player-two'].battleArea[0].card.instanceId

    for (const attacker of state.players['player-one'].battleArea) {
      state = applyGameCommand(state, {
        kind: 'attack',
        playerId: 'player-one',
        attackerInstanceId: attacker.card.instanceId,
        targetInstanceId: target,
        supportPaymentIds: state.players['player-one'].supportArea
          .filter(support => !support.rested).slice(0, 3).map(support => support.card.instanceId),
      })
    }
    expect(state.pendingEndOfTurnEffects).toHaveLength(2)
    expect(activeSupportCount(state)).toBe(0)

    state = advance(advance(state))

    expect(activeSupportCount(state)).toBe(6)
    expect(state.pendingEndOfTurnEffects).toHaveLength(0)
    expect(state).toMatchObject({ phase: 'active', activePlayerId: 'player-two', turnNumber: 4 })
  })

  it('keeps later events pending until the selected effect has resolved', () => {
    let state = createState()
    addRestedSupports(state, 4)
    state = defer(state, [{ kind: 'set-active', supportCount: 1, selectable: true }])
    state = defer(state, [{ kind: 'set-active', supportCount: 3 }])

    state = advance(advance(state))

    expect(state).toMatchObject({ phase: 'end', activePlayerId: 'player-one', turnNumber: 3 })
    expect(state.pendingAbilityEffect?.effects[0].kind).toBe('set-active')
    expect(state.pendingEndOfTurnEffects).toHaveLength(1)
    expect(activeSupportCount(state)).toBe(0)

    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: ['support-0'],
    })
    expect(activeSupportCount(state)).toBe(1)
    expect(state.phase).toBe('end')

    state = advance(state)
    expect(activeSupportCount(state)).toBe(4)
    expect(state.pendingEndOfTurnEffects).toHaveLength(0)
    expect(state.activePlayerId).toBe('player-two')
  })

  it('resumes the interrupted event and then drains later events after Refresh', () => {
    let state = createState()
    addRestedSupports(state, 2)
    state.players['player-one'].deck = [item('last-deck-card')]
    state.players['player-one'].discardPile = [cookie('refresh-cookie'), item('recycled-1'), item('recycled-2')]
    state = defer(state, [{ kind: 'draw', amount: 2 }, { kind: 'set-active', supportCount: 1 }])
    state = defer(state, [{ kind: 'set-active', supportCount: 1 }])

    state = advance(advance(state))

    expect(state.pendingRefresh).toMatchObject({ playerId: 'player-one', remainingDraws: 1 })
    expect(state.pendingEndOfTurnEffects?.[0].effectIndex).toBe(1)
    expect(state.pendingEndOfTurnEffects).toHaveLength(2)
    expect(activeSupportCount(state)).toBe(0)
    expect(state).toMatchObject({ phase: 'end', activePlayerId: 'player-one', turnNumber: 3 })

    state = applyGameCommand(state, {
      kind: 'refresh-deck', playerId: 'player-one', cookieInstanceId: 'refresh-cookie',
    }, { shuffle: cards => [...cards] })
    expect(state.pendingRefresh).toBeNull()
    expect(state.players['player-one'].hand).toHaveLength(3)

    state = advance(state)
    expect(state.players['player-one'].hand).toHaveLength(3)
    expect(activeSupportCount(state)).toBe(2)
    expect(state.pendingEndOfTurnEffects).toHaveLength(0)
    expect(state.activePlayerId).toBe('player-two')
  })

  it('does not let an event for the other player block events due this turn', () => {
    let state = createState()
    addRestedSupports(state, 2)
    state = defer(state, [{ kind: 'draw', amount: 1 }], 'player-two')
    state = defer(state, [{ kind: 'set-active', supportCount: 1 }])
    state = defer(state, [{ kind: 'set-active', supportCount: 1 }])

    state = advance(advance(state))

    expect(activeSupportCount(state)).toBe(2)
    expect(state.pendingEndOfTurnEffects).toHaveLength(1)
    expect(state.pendingEndOfTurnEffects?.[0].sourcePlayerId).toBe('player-two')
    expect(state.players['player-two'].hand).toHaveLength(1)
  })

  it('preserves new deferred events created while resolving the queue', () => {
    let state = createState()
    addRestedSupports(state, 2)
    state = defer(state, [{
      kind: 'deferred-end-of-turn', effects: [{ kind: 'set-active', supportCount: 1 }],
    }])
    state = defer(state, [{ kind: 'set-active', supportCount: 1 }])

    state = advance(advance(state))

    expect(activeSupportCount(state)).toBe(2)
    expect(state.pendingEndOfTurnEffects).toHaveLength(0)
  })

  it('stops the end phase when an event ends the game', () => {
    let state = createState()
    addRestedSupports(state, 1)
    state.players['player-one'].deck = [item('last-deck-card')]
    state = defer(state, [{ kind: 'draw', amount: 2 }])
    state = defer(state, [{ kind: 'set-active', supportCount: 1 }])

    state = advance(advance(state))

    expect(state).toMatchObject({
      status: 'finished', phase: 'end', activePlayerId: 'player-one', turnNumber: 3,
      result: { loserId: 'player-one', reason: 'refresh-unavailable' },
    })
    expect(activeSupportCount(state)).toBe(0)
  })
})
