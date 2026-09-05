import { describe, expect, it } from 'vitest'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import { getCardPoolEntry } from './card-pool'
import { applyGameCommand } from './commands'
import { canPlayItem } from './card-abilities'
import { createBattleState } from './test-helpers/battle-helpers'
import type { GameCard, GameState } from './types'

const official = (id: string, suffix: string): GameCard => {
  const entry = getCardPoolEntry(id)
  if (!entry) throw new Error(`Missing ${id}`)
  const result = convertOfficialCardToGameCard(entry)
  if (result.status !== 'converted') throw new Error(`Unconverted ${id}`)
  return { ...result.gameCard, instanceId: `${id}:${suffix}` }
}
const cookie = (id: string, suffix: string) => {
  const card = official(id, suffix)
  if (card.type !== 'cookie') throw new Error(`Expected Cookie ${id}`)
  return card
}
const setup = () => {
  const base = createBattleState()
  const item = official('BS8-047', 'item')
  const revealed = cookie('BS8-009', 'revealed-red-three')
  const otherHand = cookie('BS8-039', 'other-hand-three')
  const target = cookie('BS8-026', 'break-yellow-three')
  const other = cookie('BS8-039', 'existing-field')
  const support = official('BS8-037', 'yellow-payment')
  const state: GameState = { ...base, players: { ...base.players,
    'player-two': { ...base.players['player-two'], hand: [item, revealed, otherHand],
      battleArea: [{ card: other, hpCards: [official('BS8-046', 'existing-hp')], rested: false }],
      supportArea: [{ card: support, rested: false }], breakArea: [target],
      deck: Array.from({ length: 20 }, (_, index) => official('BS8-046', `deck-${index}`)),
      discardPile: [cookie('BS8-037', 'refresh-cookie'), ...Array.from({ length: 7 }, (_, index) => official('BS8-046', `trash-${index}`))],
    },
  } }
  const command = { kind: 'begin-play-item' as const, playerId: 'player-two' as const, instanceId: item.instanceId, paymentIds: [support.instanceId] }
  return { state, item, revealed, otherHand, target, other, command }
}
const resolve = (state: GameState, targetIds: string[]) => applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-two', targetIds })

describe('BS8-047 Puny Strength reveal cost and locked Then', () => {
  it.each([0, 1])('pays Y1 and reveals a red LV.3 before selecting %i yellow Break summon, then moves that exact revealed card', (count) => {
    const { state, item, revealed, otherHand, target, command } = setup()
    if (item.type !== 'item') throw new Error('Expected Item')
    expect(item.item?.cost).toMatchObject({ energy: { yellow: 1 } })
    expect(item.item?.effects[0]).toMatchObject({ kind: 'reveal-hand', amount: 1, asCost: true, selectCard: true, cookieOnly: true, minLevel: 3, maxLevel: 3 })
    expect(revealed).toMatchObject({ level: 3, energyColor: 'red' })
    const paid = applyGameCommand(state, { ...command, targetIds: [revealed.instanceId] })
    expect(paid.pendingAbilityEffect).toMatchObject({ sourceInstanceId: item.instanceId, effectIndex: 1 })
    expect(paid.players['player-two'].supportArea[0].rested).toBe(true)
    expect(paid.players['player-two'].hand).toEqual([revealed, otherHand])
    expect(paid.players['player-two'].discardPile).toContainEqual(item)
    expect(paid.costRecord).toMatchObject({ revealedHandCardInstanceIds: [revealed.instanceId], revealedHandSourceInstanceId: item.instanceId })
    expect(paid.players['player-two'].breakArea).toEqual(state.players['player-two'].breakArea)
    const afterSummon = resolve(paid, count ? [target.instanceId] : [])
    expect(afterSummon.pendingAbilityEffect?.effectIndex).toBe(2)
    expect(afterSummon.players['player-two'].hand).toContainEqual(revealed)
    expect(afterSummon.players['player-two'].battleArea).toHaveLength(count ? 2 : 1)
    if (count) expect(afterSummon.players['player-two'].battleArea[1]).toMatchObject({ card: target, enteredFrom: 'break', enteredTurn: state.turnNumber })
    expect(() => resolve(afterSummon, [otherHand.instanceId])).toThrow()
    const result = resolve(afterSummon, [])
    expect(result.players['player-two'].hand).toEqual([otherHand])
    expect(result.players['player-two'].breakArea).toEqual(count ? [revealed] : [target, revealed])
    expect(result.pendingAbilityEffect).toBeFalsy()
    const batch = applyGameCommand(state, { ...command, kind: 'play-item', effectTargets: [[revealed.instanceId], count ? [target.instanceId] : [], []] })
    expect(batch.players).toEqual(result.players)
  })

  it.each(['omitted', 'zero', 'level-two', 'item', 'duplicate', 'two-cards', 'wrong-zone'] as const)('rejects %s reveal cost before paying or discarding the Item', (selection) => {
    const { state, item, revealed, otherHand, target, command } = setup()
    const low = cookie('BS8-034', 'hand-lv-two')
    const prepared: GameState = { ...state, players: { ...state.players, 'player-two': { ...state.players['player-two'], hand: [...state.players['player-two'].hand, low] } } }
    const ids = { omitted: undefined, zero: [], 'level-two': [low.instanceId], item: [item.instanceId], duplicate: [revealed.instanceId, revealed.instanceId], 'two-cards': [revealed.instanceId, otherHand.instanceId], 'wrong-zone': [target.instanceId] }[selection]
    const snapshot = structuredClone(prepared)
    expect(() => applyGameCommand(prepared, { ...command, ...(ids === undefined ? {} : { targetIds: ids }) })).toThrow()
    expect(prepared).toEqual(snapshot)
  })

  it.each(['red-three', 'yellow-two', 'hand', 'duplicate'] as const)('rejects %s Break summon selection after a legal reveal cost', (selection) => {
    const { state, revealed, target, command } = setup()
    const wrong = cookie(selection === 'red-three' ? 'BS8-009' : 'BS8-034', 'invalid-break')
    const prepared: GameState = { ...state, players: { ...state.players, 'player-two': { ...state.players['player-two'], breakArea: [target, wrong] } } }
    const paid = applyGameCommand(prepared, { ...command, targetIds: [revealed.instanceId] })
    const ids = selection === 'hand' ? [revealed.instanceId] : selection === 'duplicate' ? [target.instanceId, target.instanceId] : [wrong.instanceId]
    expect(() => resolve(paid, ids)).toThrow()
    expect(paid.players['player-two'].hand).toContainEqual(revealed)
  })

  it('at two battle Cookies may choose zero but still must move the revealed card in Then', () => {
    const { state, revealed, target, command } = setup()
    const full: GameState = { ...state, players: { ...state.players, 'player-two': { ...state.players['player-two'], battleArea: [...state.players['player-two'].battleArea, { card: cookie('BS8-034', 'full-field'), hpCards: [official('BS8-046', 'full-hp')], rested: false }] } } }
    expect(canPlayItem(full, 'player-two', command.instanceId)).toBe(true)
    const paid = applyGameCommand(full, { ...command, targetIds: [revealed.instanceId] })
    expect(() => resolve(paid, [target.instanceId])).toThrow()
    const result = resolve(resolve(paid, []), [])
    expect(result.players['player-two'].battleArea).toEqual(full.players['player-two'].battleArea)
    expect(result.players['player-two'].breakArea).toEqual([target, revealed])
    expect(result.players['player-two'].hand).not.toContainEqual(revealed)
  })

  it.each(['missing', 'red'] as const)('rejects %s energy despite having a legal reveal card', (payment) => {
    const { state, revealed, command } = setup()
    const red = official('BS8-009', 'red-payment')
    const prepared: GameState = { ...state, players: { ...state.players, 'player-two': { ...state.players['player-two'], supportArea: payment === 'missing' ? [] : [{ card: red, rested: false }] } } }
    expect(() => applyGameCommand(prepared, { ...command, paymentIds: payment === 'missing' ? [] : [red.instanceId], targetIds: [revealed.instanceId] })).toThrow()
    expect(prepared.players['player-two'].hand).toContainEqual(revealed)
    expect(prepared.players['player-two'].breakArea).toEqual(state.players['player-two'].breakArea)
  })

  it('retains the exact revealed card across Refresh while supplying the summoned Cookie HP, then completes Then', () => {
    const { state, revealed, otherHand, target, command } = setup()
    const short: GameState = { ...state, players: { ...state.players, 'player-two': { ...state.players['player-two'], deck: state.players['player-two'].deck.slice(0, 2) } } }
    const paid = applyGameCommand(short, { ...command, targetIds: [revealed.instanceId] })
    const interrupted = resolve(paid, [target.instanceId])
    expect(interrupted.pendingRefresh).toMatchObject({ playerId: 'player-two', remainingHpSetup: [{ targetInstanceId: target.instanceId, amount: target.hp - 2 }] })
    expect(interrupted.players['player-two'].hand).toEqual([revealed, otherHand])
    const refreshed = applyGameCommand(interrupted, { kind: 'refresh-deck', playerId: 'player-two', cookieInstanceId: 'BS8-037:refresh-cookie', shuffleSeed: 1 })
    expect(refreshed.pendingAbilityEffect?.effectIndex).toBe(2)
    expect(refreshed.players['player-two'].battleArea[1].hpCards).toHaveLength(target.hp)
    expect(refreshed.costRecord?.revealedHandCardInstanceIds).toEqual([revealed.instanceId])
    const result = resolve(refreshed, [])
    expect(result.players['player-two'].hand).toEqual([otherHand])
    expect(result.players['player-two'].breakArea).toContainEqual(revealed)
    expect(result.pendingAbilityEffect).toBeFalsy()
  })

  it('does not allow use without a LV.3 hand Cookie even if Break has a legal summon', () => {
    const { state, item, command } = setup()
    const unavailable: GameState = { ...state, players: { ...state.players, 'player-two': { ...state.players['player-two'], hand: [item, cookie('BS8-034', 'lv-two')] } } }
    expect(canPlayItem(unavailable, 'player-two', item.instanceId)).toBe(false)
    expect(() => applyGameCommand(unavailable, command)).toThrow()
    expect(unavailable.players['player-two'].supportArea[0].rested).toBe(false)
    expect(unavailable.players['player-two'].hand).toContainEqual(item)
  })

  it('allows an empty Break summon choice with no Break candidates and still completes the revealed-card Then', () => {
    const { state, revealed, command } = setup()
    const empty: GameState = { ...state, players: { ...state.players, 'player-two': { ...state.players['player-two'], breakArea: [] } } }
    expect(canPlayItem(empty, 'player-two', command.instanceId)).toBe(true)
    const paid = applyGameCommand(empty, { ...command, targetIds: [revealed.instanceId] })
    const result = resolve(resolve(paid, []), [])
    expect(result.players['player-two'].breakArea).toEqual([revealed])
    expect(result.players['player-two'].supportArea[0].rested).toBe(true)
    expect(result.pendingAbilityEffect).toBeFalsy()
  })

  it('preserves the item Then when a real yellow LV.3 OnPlay entry is declined', () => {
    const { state, revealed, otherHand, command } = setup()
    const onPlay = cookie('BS7-033', 'yellow-lv-three-on-play')
    expect(onPlay).toMatchObject({ level: 3, energyColor: 'yellow', skill: { trigger: 'on-play' } })
    const prepared: GameState = { ...state, players: { ...state.players, 'player-two': { ...state.players['player-two'], breakArea: [onPlay] } } }
    const paid = applyGameCommand(prepared, { ...command, targetIds: [revealed.instanceId] })
    const entered = resolve(paid, [onPlay.instanceId])
    expect(entered.pendingOnPlay).toMatchObject({ playerId: 'player-two', sourceInstanceId: onPlay.instanceId, origin: 'break' })
    expect(entered.pendingAbilityEffect?.effectIndex).toBe(2)
    const skipped = applyGameCommand(entered, { kind: 'skip-on-play', playerId: 'player-two', sourceInstanceId: onPlay.instanceId })
    const result = resolve(skipped, [])
    expect(result.players['player-two'].hand).toEqual([otherHand])
    expect(result.players['player-two'].breakArea).toEqual([revealed])
    expect(result.players['player-two'].battleArea[1].card).toEqual(onPlay)
    expect(result.pendingAbilityEffect).toBeFalsy()
    expect(result.pendingOnPlay).toBeFalsy()
  })
})
