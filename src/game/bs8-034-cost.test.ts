import { describe, expect, it } from 'vitest'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import { getCardPoolEntry } from './card-pool'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState } from './demo'
import { canActivateCookieSkill, getBreakToBattleCandidates } from './index'
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

const setup = (id: string) => {
  const base = createCardCheckDemoState(id)
  const source = base.players['player-one'].battleArea.find((entry) => entry.card.id === 'BS8-034')!
  const companion = cookie('BS8-037', 'companion')
  const handCost = cookie('BS8-037', 'hand-cost')
  const spareHand = cookie('BS8-043', 'spare-hand')
  const golden = cookie('BS8-026', 'break-golden')
  const extra = createCardCheckDemoState('BS8-027').players['player-one'].extraDeck?.find((card) => card.id === 'BS8-027')
  if (!extra) throw new Error('Expected real BS8-027 EXTRA fixture')
  const state: GameState = {
    ...base,
    players: { ...base.players, 'player-one': {
      ...base.players['player-one'],
      battleArea: [source, { card: companion, hpCards: [official('BS8-046', 'companion-hp')], rested: false }],
      hand: [handCost, spareHand],
      breakArea: [golden],
      extraDeck: [extra],
    } },
  }
  const command = {
    kind: 'begin-activate-skill' as const,
    playerId: 'player-one' as const,
    sourceInstanceId: source.card.instanceId,
    trigger: 'activate' as const,
    paymentIds: [],
    handToBreakAreaIds: [handCost.instanceId],
  }
  return { state, source, companion, handCost, spareHand, golden, extra, command }
}

describe.each(['BS8-034', 'BS8-034@1'])('%s real cost and Golden summon', (id) => {
  it('has the official two-card cost and accepts LV1 hand payment from a full battle area', () => {
    const { state, source, handCost, companion, command } = setup(id)
    expect(source.card.imageUrl).toBe(getCardPoolEntry(id)?.imageUrl)
    expect(source.card.skill?.oncePerTurn).toBe(true)
    expect(source.card.skill?.cost).toMatchObject({ energy: {}, selfToBreakArea: true, handToBreakArea: { count: 1 } })
    expect(source.card.skill?.cost.handToBreakArea?.minLevel).toBeUndefined()
    expect(source.card.skill?.effects).toEqual([{ kind: 'break-to-battle', amount: 1, cardName: 'Golden Cheese Cookie', hpCount: 6, condition: { kind: 'break-area-has-card', side: 'self' } }])
    expect(handCost.level).toBe(1)
    expect(state.players['player-one'].battleArea).toHaveLength(2)
    expect(canActivateCookieSkill(state, 'player-one', source.card.instanceId, 'activate')).toBe(true)
    const paid = applyGameCommand(state, command)
    expect(paid.players['player-one'].battleArea.map((entry) => entry.card.instanceId)).toEqual([companion.instanceId])
    expect(paid.players['player-one'].breakArea).toEqual(expect.arrayContaining([source.card, handCost]))
    expect(paid.players['player-one'].hand).not.toContainEqual(handCost)
    expect(paid.pendingAbilityEffect?.effectIndex).toBe(0)
  })

  it('requires a preexisting Break Cookie and cannot satisfy the condition with its own cost', () => {
    const { state, source, command } = setup(id)
    const empty: GameState = { ...state, players: { ...state.players, 'player-one': { ...state.players['player-one'], breakArea: [] } } }
    expect(canActivateCookieSkill(empty, 'player-one', source.card.instanceId, 'activate')).toBe(false)
    expect(() => applyGameCommand(empty, command)).toThrow()
  })

  it('rejects a hand without Cookies and rejects unpaid costs', () => {
    const { state, source, command } = setup(id)
    const item = official('BS8-046', 'hand-item')
    const noCookie: GameState = { ...state, players: { ...state.players, 'player-one': { ...state.players['player-one'], hand: [item] } } }
    expect(canActivateCookieSkill(noCookie, 'player-one', source.card.instanceId, 'activate')).toBe(false)
    expect(() => applyGameCommand(noCookie, { ...command, handToBreakAreaIds: [item.instanceId] })).toThrow()
    expect(() => applyGameCommand(state, { ...command, handToBreakAreaIds: [] })).toThrow()
  })

  it.each([false, true])('allows Golden selection %s and sets summoned HP to exactly six', (playGolden) => {
    const { state, golden, command } = setup(id)
    const paid = applyGameCommand(state, command)
    const deckBefore = paid.players['player-one'].deck.length
    const resolved = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: playGolden ? [golden.instanceId] : [] })
    const summoned = resolved.players['player-one'].battleArea.find((entry) => entry.card.instanceId === golden.instanceId)
    expect(Boolean(summoned)).toBe(playGolden)
    if (playGolden) {
      expect(summoned?.hpCards).toHaveLength(6)
      expect(resolved.players['player-one'].deck).toHaveLength(deckBefore - 6)
    } else {
      expect(resolved.players['player-one'].deck).toHaveLength(deckBefore)
      expect(resolved.players['player-one'].breakArea).toContainEqual(golden)
    }
    expect(resolved.pendingAbilityEffect).toBeFalsy()
  })

  it('rejects non-Golden and EXTRA selections, while allowing zero without Golden in Break', () => {
    const { state, handCost, extra, command } = setup(id)
    const noGolden: GameState = { ...state, players: { ...state.players, 'player-one': { ...state.players['player-one'], breakArea: [cookie('BS8-037', 'break-not-golden')] } } }
    const paid = applyGameCommand(noGolden, command)
    const effect = paid.pendingAbilityEffect!.effects[0]
    if (effect.kind !== 'break-to-battle') throw new Error('Expected Golden summon')
    const candidates = getBreakToBattleCandidates(paid, { sourcePlayerId: 'player-one', sourceInstanceId: command.sourceInstanceId }, effect)
    expect(candidates).toEqual([])
    for (const targetId of [handCost.instanceId, extra.instanceId]) {
      expect(() => applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [targetId] })).toThrow()
    }
    const resolved = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [] })
    expect(resolved.players['player-one'].extraDeck).toEqual([extra])
    expect(resolved.players['player-one'].battleArea).toHaveLength(1)
  })

  it.each(['begin-activate-skill', 'activate-skill'] as const)('%s loses immediately at Break LV10 before summoning', (kind) => {
    const { state, source, handCost, command } = setup(id)
    const breakArea = [cookie('BS8-026', 'break3-a'), cookie('BS8-030', 'break3-b'), cookie('BS8-037', 'break1')]
    expect(breakArea.reduce((sum, card) => sum + card.level, 0) + source.card.level + handCost.level).toBe(10)
    const nearDefeat: GameState = { ...state, players: { ...state.players, 'player-one': { ...state.players['player-one'], breakArea } } }
    const result = applyGameCommand(nearDefeat, { ...command, kind })
    expect(result.status).toBe('finished')
    expect(result.pendingAbilityEffect).toBeFalsy()
    expect(result.players['player-one'].battleArea).toHaveLength(1)
    expect(result.players['player-one'].deck).toEqual(nearDefeat.players['player-one'].deck)
  })

  it('cannot activate the same departed source again from Break', () => {
    const { state, source, spareHand, command } = setup(id)
    const paid = applyGameCommand(state, command)
    const resolved = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [] })
    expect(resolved.players['player-one'].hand).toContainEqual(spareHand)
    expect(resolved.players['player-one'].breakArea).toContainEqual(source.card)
    expect(canActivateCookieSkill(resolved, 'player-one', source.card.instanceId, 'activate')).toBe(false)
    expect(() => applyGameCommand(resolved, { ...command, handToBreakAreaIds: [spareHand.instanceId] })).toThrow()
  })
})
