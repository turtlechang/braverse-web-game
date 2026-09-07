import { describe, expect, it } from 'vitest'
import { applyGameCommand, beginAttack, executeCardEffect, resolveInspectDeck, type GameCard } from './index'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import { getCardPoolEntry } from './card-pool'
import { createBattleState, cookie, item } from './test-helpers/battle-helpers'
import { expandChooseOneSequence } from './effects/choose-one'

const card = (id: string) => {
  const record = getCardPoolEntry(id)
  if (!record) throw new Error(`Missing ${id}`)
  const result = convertOfficialCardToGameCard(record)
  if (result.status !== 'converted') throw new Error(`Cannot convert ${id}`)
  return result.gameCard
}
const fixture = () => {
  const state = createBattleState()
  state.activePlayerId = 'player-one'
  state.players['player-one'].deck = Array.from({ length: 7 }, (_, i) => item(`deck-${i}`))
  state.players['player-one'].supportArea = [0, 1].map(i => ({ card: item(`pay-${i}`, 'green'), rested: false }))
  state.players['player-two'].supportArea = [0, 1, 2].map(i => ({ card: item(`opponent-${i}`), rested: false }))
  return state
}
const context = { sourcePlayerId: 'player-one' as const, sourceInstanceId: 'source', sourceCardName: 'source' }

describe('BS8 optional card counts', () => {
  it.each([0, 1])('BS8-067 resolves attack choice %i in the authoritative battle queue', amount => {
    const initial = fixture()
    const source = card('BS8-067')
    if (source.type !== 'cookie') throw new Error('Expected Cookie')
    initial.players['player-one'].battleArea[0].card = source
    const attacking = beginAttack(initial, source.instanceId, 'attacker', ['pay-0', 'pay-1'])
    const pending = { ...attacking, pendingBattle: { ...attacking.pendingBattle!,
      stage: 'attack-effect' as const, attackEffects: source.attackEffects!, attackEffectIndex: 0 } }
    const before = structuredClone(pending)
    expect(() => applyGameCommand(pending, { kind: 'resolve-choose-one', playerId: 'player-two', modeIndex: amount })).toThrow()
    expect(() => applyGameCommand(pending, { kind: 'resolve-choose-one', playerId: 'player-one', modeIndex: 9 })).toThrow()
    const selected = applyGameCommand(pending, { kind: 'resolve-choose-one', playerId: 'player-one', modeIndex: amount })
    expect(selected.pendingBattle?.attackEffects[0]).toMatchObject({ kind: 'deck-to-support', amount })
    const resolved = applyGameCommand(selected, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [] })
    expect(resolved.players['player-one'].supportArea).toHaveLength(2 + amount)
    expect(resolved.players['player-one'].deck).toHaveLength(7 - amount)
    expect(resolved.pendingBattle).toBeNull()
    expect(pending).toEqual(before)
  })

  it.each([0, 1])('BS8-067 selects %i support and keeps its condition after mode expansion', amount => {
    const source = card('BS8-067')
    if (source.type !== 'cookie') throw new Error('Expected Cookie')
    const effect = expandChooseOneSequence(source.attackEffects!, [amount])[0]
    const initial = fixture()
    const resolved = executeCardEffect(initial, context, effect, [])
    expect(resolved.players['player-one'].supportArea).toHaveLength(2 + amount)
    expect(resolved.players['player-one'].deck).toHaveLength(7 - amount)
    if (amount) expect(resolved.players['player-one'].supportArea[2].rested).toBe(false)
    initial.players['player-two'].supportArea.pop()
    expect(() => executeCardEffect(initial, context, effect, [])).toThrow('尚未滿足')
    expect(initial.players['player-one'].supportArea).toHaveLength(2)
    expect(initial.players['player-one'].deck).toHaveLength(7)
  })

  it.each([0, 1, 2])('BS8-072 reveals %i, allows all revealed cards rested, then retains equip', amount => {
    const state = fixture()
    const source = card('BS8-072')
    const mystic = card('BS8-059')
    if (mystic.type !== 'cookie') throw new Error('Expected Mystic Flour Cookie')
    state.players['player-one'].battleArea[0].card = mystic
    state.players['player-one'].hand = [source]
    let next = applyGameCommand(state, { kind: 'begin-play-item', playerId: 'player-one', instanceId: source.instanceId, paymentIds: ['pay-0', 'pay-1'], chooseOneModes: [amount] })
    expect(next.players['player-one'].supportArea.every(support => support.rested)).toBe(true)
    if (amount > 0) {
      next = applyGameCommand(next, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [] })
      expect(next.pendingInspectDeck?.revealedCards).toHaveLength(amount)
      next = resolveInspectDeck(next, 'player-one', [], state.players['player-one'].deck.slice(0, amount).map(c => c.instanceId))
    }
    expect(next.players['player-one'].deck).toHaveLength(7 - amount)
    expect(next.players['player-one'].supportArea).toHaveLength(2 + amount)
    expect(next.players['player-one'].supportArea.every(support => support.rested)).toBe(true)
    expect(next.pendingAbilityEffect?.effects.at(-1)?.kind).toBe('equip-source')
    const equipped = applyGameCommand(next, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [mystic.instanceId] })
    expect(equipped.players['player-one'].battleArea[0].equippedCards).toEqual([source])
    expect(equipped.players['player-one'].battleArea[0].hpCards).toHaveLength(4)
    expect(state.players['player-one'].deck).toHaveLength(7)
  })

  it('BS8-072 blocks revealing when support counts are equal despite valid payment', () => {
    const state = fixture()
    const source = card('BS8-072')
    state.players['player-one'].hand = [source]
    state.players['player-two'].supportArea.pop()
    const paid = applyGameCommand(state, { kind: 'begin-play-item', playerId: 'player-one', instanceId: source.instanceId, paymentIds: ['pay-0', 'pay-1'], chooseOneModes: [2] })
    const next = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [] })
    expect(next.pendingInspectDeck).toBeFalsy()
    expect(next.players['player-one'].deck).toHaveLength(7)
    expect(next.players['player-one'].supportArea).toHaveLength(2)
    expect(next.players['player-one'].supportArea.every(support => support.rested)).toBe(true)
  })

  const onion = (deck?: GameCard[]) => {
    const state = fixture()
    const source = card('BS8-111')
    if (source.type !== 'cookie') throw new Error('Expected Onion Cookie')
    state.players['player-one'].battleArea[0].card = source
    state.pendingOnPlay = { playerId: 'player-one', sourceInstanceId: source.instanceId }
    state.players['player-one'].hand = [item('cost')]
    state.players['player-one'].discardPile = [cookie('refresh-cookie'), item('trash-a'), item('trash-b'), item('trash-c'), item('trash-d')]
    if (deck) state.players['player-one'].deck = deck
    return { state, source }
  }
  const beginOnion = (initial: ReturnType<typeof onion>, amount: number, discardHandIds = ['cost']) => applyGameCommand(initial.state, {
    kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: initial.source.instanceId,
    trigger: 'on-play', paymentIds: [], discardHandIds, chooseOneModes: [amount],
  })
  it.each([0, 1, 2, 3, 4])('BS8-111 pays its discard before milling %i cards', amount => {
    const initial = onion()
    expect(() => beginOnion(initial, amount, [])).toThrow()
    const paid = beginOnion(initial, amount)
    expect(paid.players['player-one'].hand).toHaveLength(0)
    expect(paid.players['player-one'].discardPile.map(c => c.instanceId)).toContain('cost')
    const next = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [] })
    expect(next.players['player-one'].deck).toHaveLength(7 - amount)
    expect(next.deckTrashResolution?.cards).toHaveLength(amount)
    expect(initial.state.players['player-one'].hand).toHaveLength(1)
  })
  it('BS8-111 resumes the selected four-card mill after Refresh', () => {
    const paid = beginOnion(onion([item('first')]), 4)
    const pending = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [] })
    expect(pending.pendingRefresh?.remainingDeckToTrash?.effect.amount).toBe(3)
    const next = applyGameCommand(pending, { kind: 'refresh-deck', playerId: 'player-one', cookieInstanceId: 'refresh-cookie' }, { shuffle: cards => [...cards] })
    expect(next.pendingRefresh).toBeNull()
    expect(next.deckTrashResolution?.cards.map(c => c.instanceId)).toEqual(['first', 'trash-a', 'trash-b', 'trash-c'])
  })
})
