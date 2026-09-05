import { describe, expect, it } from 'vitest'
import { applyGameCommand, type GameCard, type GameState } from './index'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import { getCardPoolEntry } from './card-pool'
import { createBattleState, cookie, item } from './test-helpers/battle-helpers'

const purpleItem = (id: string): GameCard => ({...item(id), energyColor:'purple'})
const fixture = (deck: GameCard[]): GameState => {
  const record = getCardPoolEntry('BS8-121')
  if (!record) throw new Error('Missing formal BS8-121')
  const converted = convertOfficialCardToGameCard(record)
  if (converted.status !== 'converted') throw new Error('BS8-121 conversion failed')
  const base = createBattleState()
  return {...base, phase:'main', activePlayerId:'player-one', players: {...base.players, 'player-one': {
    ...base.players['player-one'], deck,
    hand:[{...converted.gameCard, instanceId:'concoction'}],
    discardPile:[{...cookie('refresh-cookie'),level:1},purpleItem('old-purple-item'),item('old-red-item')],
    supportArea:[{card:purpleItem('payment'),rested:false}],
    battleArea:[{card:cookie('target'), hpCards:[item('hp')], rested:false}],
    breakArea:[],
  }}}
}
const begin = (state: GameState, amount: number) => applyGameCommand(state, {
  kind:'begin-play-item', playerId:'player-one', instanceId:'concoction', paymentIds:['payment'], chooseOneModes:[amount],
})
const resolve = (state: GameState, ids: string[] = []) => applyGameCommand(state, {kind:'resolve-ability-effect', playerId:'player-one', targetIds:ids})

describe('BS8-121 Black Concoction actual milled-card condition', () => {
  it.each([0, 1, 3])('allows milling %i and does not count an old purple Item or the played source', (amount) => {
    const initial = fixture(Array.from({length:6}, (_, i) => item(`red-${i}`)))
    const paid = begin(initial, amount)
    expect(paid.players['player-one'].supportArea[0].rested).toBe(true)
    const milled = resolve(paid)
    expect(milled.players['player-one'].deck).toHaveLength(6 - amount)
    expect(milled.deckTrashResolution?.cards).toHaveLength(amount)
    const finished = resolve(milled, ['target'])
    expect(finished.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
    expect(finished.pendingAbilityEffect).toBeUndefined()
    expect(initial.players['player-one'].hand).toHaveLength(1)
  })

  it.each([{ids: []}, {ids: ['target']}])('offers optional HP only after a milled purple Item: targets $ids', ({ids}) => {
    const initial = fixture([item('red'), purpleItem('milled-purple'), cookie('milled-cookie'), item('hp-gain'), item('tail')])
    const milled = resolve(begin(initial, 3))
    expect(milled.players['player-one'].discardPile.map(card => card.instanceId)).toContain('milled-purple')
    expect(milled.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
    const finished = resolve(milled, ids)
    expect(finished.players['player-one'].battleArea[0].hpCards).toHaveLength(ids.length === 0 ? 1 : 2)
    expect(finished.players['player-one'].deck).toHaveLength(ids.length === 0 ? 2 : 1)
  })

  it('does not treat a purple Cookie or red Item as a qualifying purple Item', () => {
    const initial = fixture([{...cookie('purple-cookie'),energyColor:'purple'}, item('red-item'), item('tail')])
    const finished = resolve(resolve(begin(initial, 2)), ['target'])
    expect(finished.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
  })

  it('resumes remaining milling after Refresh and keeps the cards from before Refresh in the same result', () => {
    const pending = resolve(begin(fixture([purpleItem('first-milled')]), 3))
    expect(pending.pendingRefresh?.remainingDeckToTrash?.effect.amount).toBe(2)
    expect(() => resolve(pending, ['target'])).toThrow()
    const refreshed = applyGameCommand(pending, {kind:'refresh-deck',playerId:'player-one',cookieInstanceId:'refresh-cookie'}, {shuffle: cards => [...cards]})
    expect(refreshed.pendingRefresh).toBeNull()
    expect(refreshed.deckTrashResolution?.cards.map(card => card.instanceId)).toEqual(['first-milled','old-purple-item','old-red-item'])
    expect(refreshed.players['player-one'].breakArea.map(card => card.instanceId)).toEqual(['refresh-cookie'])
    const finished = resolve(refreshed, ['target'])
    expect(finished.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
  })

  it('handles Refresh even when the last milled card exactly completes the selected amount', () => {
    const pending = resolve(begin(fixture([purpleItem('last-milled')]), 1))
    expect(pending.pendingRefresh?.remainingDeckToTrash?.effect.amount).toBe(0)
    const refreshed = applyGameCommand(pending, {kind:'refresh-deck',playerId:'player-one',cookieInstanceId:'refresh-cookie'}, {shuffle: cards => [...cards]})
    expect(refreshed.deckTrashResolution?.cards.map(card => card.instanceId)).toEqual(['last-milled'])
    expect(resolve(refreshed, ['target']).players['player-one'].battleArea[0].hpCards).toHaveLength(2)
  })

  it('uses the same condition through the batch item command and requires active purple payment', () => {
    const initial = fixture([purpleItem('milled'),item('hp'),item('tail')])
    const finished = applyGameCommand(initial, {kind:'play-item',playerId:'player-one',instanceId:'concoction',paymentIds:['payment'],chooseOneModes:[1],effectTargets:[[],['target']]})
    expect(finished.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
    initial.players['player-one'].supportArea[0].rested = true
    expect(() => begin(initial, 0)).toThrow()
  })
})
