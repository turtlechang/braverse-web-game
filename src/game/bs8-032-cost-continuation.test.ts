import { describe, expect, it } from 'vitest'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import { getCardPoolEntry } from './card-pool'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState } from './demo'
import { canActivateCookieSkill } from './skills'
import type { GameCard, GameState } from './types'

const officialCard = (id: string, suffix: string): GameCard => {
  const entry = getCardPoolEntry(id)
  if (!entry) throw new Error(`Missing official ${id}`)
  const result = convertOfficialCardToGameCard(entry)
  if (result.status !== 'converted') throw new Error(`Unconverted official ${id}`)
  return { ...result.gameCard, instanceId: `${id}:${suffix}` }
}

const officialCookie = (id: string, suffix: string) => {
  const card = officialCard(id, suffix)
  if (card.type !== 'cookie') throw new Error(`Expected official Cookie ${id}`)
  return card
}

const setup = () => {
  const base = createCardCheckDemoState('BS8-032')
  const source = base.players['player-one'].battleArea.find((cookie) => cookie.card.id === 'BS8-032')!
  const companion = officialCookie('BS8-026', 'companion')
  const handCost = officialCookie('BS8-030', 'hand-cost')
  const golden = officialCookie('BS8-026', 'break-golden')
  const hp = officialCard('BS8-040', 'source-hp')
  const equipment = officialCard('BS8-021', 'source-equipment')
  const state: GameState = {
    ...base,
    players: { ...base.players, 'player-one': {
      ...base.players['player-one'],
      battleArea: [
        { ...source, hpCards: [hp], equippedCards: [equipment] },
        { card: companion, hpCards: [officialCard('BS8-040', 'companion-hp')], rested: false },
      ],
      hand: [handCost],
      breakArea: [golden],
      discardPile: [officialCard('BS8-037', 'refresh-cookie'), officialCard('BS8-040', 'trash-item')],
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
  return { state, source, companion, handCost, golden, hp, equipment, command }
}

const openDraw = (state: GameState): GameState => applyGameCommand(state, {
  kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [],
})

const chooseDraw = (state: GameState, drawCount: number): GameState => applyGameCommand(state, {
  kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount,
})

describe('BS8-032 formal cost and continuation', () => {
  it('pays source and LV2+ hand Cookie first, freeing a full battle area without losing HP or equipment', () => {
    const { state, source, companion, handCost, hp, equipment, command } = setup()
    expect(state.players['player-one'].battleArea).toHaveLength(2)
    expect(canActivateCookieSkill(state, 'player-one', source.card.instanceId, 'activate')).toBe(true)
    const paid = applyGameCommand(state, command)
    expect(paid.players['player-one'].battleArea.map((cookie) => cookie.card.instanceId)).toEqual([companion.instanceId])
    expect(paid.players['player-one'].breakArea).toEqual(expect.arrayContaining([source.card, handCost]))
    expect(paid.players['player-one'].hand).toEqual([])
    expect(paid.players['player-one'].discardPile).toEqual(expect.arrayContaining([hp, equipment]))
    expect(paid.pendingAbilityEffect?.effectIndex).toBe(0)
    expect(paid.pendingDrawUpTo).toBeFalsy()
    expect(state.players['player-one'].battleArea[0].hpCards).toEqual([hp])
  })

  it('cannot satisfy the preexisting Break condition by paying its own costs', () => {
    const { state, source, command } = setup()
    const emptyBreak: GameState = { ...state, players: { ...state.players, 'player-one': { ...state.players['player-one'], breakArea: [] } } }
    expect(canActivateCookieSkill(emptyBreak, 'player-one', source.card.instanceId, 'activate')).toBe(false)
    expect(() => applyGameCommand(emptyBreak, command)).toThrow()
  })

  it('rejects missing or LV1 hand payment without moving the source', () => {
    const { state, source, command } = setup()
    const low = officialCard('BS8-037', 'lv1-hand')
    const missing: GameState = { ...state, players: { ...state.players, 'player-one': { ...state.players['player-one'], hand: [low] } } }
    expect(canActivateCookieSkill(missing, 'player-one', source.card.instanceId, 'activate')).toBe(false)
    expect(() => applyGameCommand(missing, { ...command, handToBreakAreaIds: [low.instanceId] })).toThrow()
    expect(() => applyGameCommand(state, { ...command, handToBreakAreaIds: [] })).toThrow()
    expect(missing.players['player-one'].battleArea[0].card).toEqual(source.card)
  })

  it.each([0, 1, 2].flatMap((drawCount) => [false, true].map((playGolden) => ({ drawCount, playGolden }))))(
    'draw $drawCount then preserve the choice to play Golden: $playGolden',
    ({ drawCount, playGolden }) => {
      const { state, golden, command } = setup()
      const paid = applyGameCommand(state, command)
      const drawing = openDraw(paid)
      expect(drawing.pendingDrawUpTo?.max).toBe(2)
      const drawn = chooseDraw(drawing, drawCount)
      expect(drawn.players['player-one'].hand).toHaveLength(drawCount)
      expect(drawn.pendingAbilityEffect?.effects[drawn.pendingAbilityEffect.effectIndex]).toMatchObject({ kind: 'break-to-battle', cardName: 'Golden Cheese Cookie' })
      const resolved = applyGameCommand(drawn, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: playGolden ? [golden.instanceId] : [] })
      expect(resolved.players['player-one'].battleArea).toHaveLength(playGolden ? 2 : 1)
      expect(resolved.players['player-one'].battleArea.some((cookie) => cookie.card.instanceId === golden.instanceId)).toBe(playGolden)
      expect(resolved.pendingAbilityEffect).toBeFalsy()
    },
  )

  it('allows the zero choice when no Golden Cheese Cookie exists', () => {
    const { state, command } = setup()
    const noGolden: GameState = { ...state, players: { ...state.players, 'player-one': { ...state.players['player-one'], breakArea: [officialCookie('BS8-037', 'break-not-golden')] } } }
    const drawn = chooseDraw(openDraw(applyGameCommand(noGolden, command)), 0)
    const resolved = applyGameCommand(drawn, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [] })
    expect(resolved.pendingAbilityEffect).toBeFalsy()
    expect(resolved.players['player-one'].battleArea).toHaveLength(1)
  })

  it('keeps Then queued when the batch activate command pauses at the draw decision', () => {
    const { state, golden, command } = setup()
    const drawing = applyGameCommand(state, { ...command, kind: 'activate-skill', effectTargets: [[], [golden.instanceId]] })
    expect(drawing.pendingDrawUpTo?.max).toBe(2)
    expect(drawing.players['player-one'].battleArea).toHaveLength(1)
    const drawn = chooseDraw(drawing, 1)
    expect(drawn.pendingAbilityEffect?.effects[drawn.pendingAbilityEffect.effectIndex]).toMatchObject({ kind: 'break-to-battle' })
    const resolved = applyGameCommand(drawn, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [golden.instanceId] })
    expect(resolved.players['player-one'].battleArea).toHaveLength(2)
  })

  it.each(['begin-activate-skill', 'activate-skill'] as const)('%s ends the game immediately when the costs raise Break LV to ten', (kind) => {
    const { state, source, command } = setup()
    const handCost = officialCookie('BS8-035', 'lv2-defeat-cost')
    const breakArea = [
      officialCookie('BS8-026', 'existing-lv3-a'),
      officialCookie('BS8-030', 'existing-lv3-b'),
      officialCookie('BS8-037', 'existing-lv1'),
    ]
    expect(breakArea.reduce((total, card) => total + card.level, 0)).toBe(7)
    expect(source.card.level + handCost.level).toBe(3)
    const nearDefeat: GameState = { ...state, players: { ...state.players, 'player-one': {
      ...state.players['player-one'], breakArea, hand: [handCost],
    } } }
    const result = applyGameCommand(nearDefeat, { ...command, kind, handToBreakAreaIds: [handCost.instanceId] })
    expect(result.status).toBe('finished')
    expect(result.pendingDrawUpTo).toBeFalsy()
    expect(result.pendingAbilityEffect).toBeFalsy()
    expect(result.players['player-one'].hand).toEqual([])
    expect(result.players['player-one'].deck).toEqual(nearDefeat.players['player-one'].deck)
  })

  it('preserves Then after drawing two across a deck Refresh boundary', () => {
    const { state, golden, command } = setup()
    const shortDeck: GameState = { ...state, players: { ...state.players, 'player-one': { ...state.players['player-one'], deck: state.players['player-one'].deck.slice(0, 1) } } }
    const interrupted = chooseDraw(openDraw(applyGameCommand(shortDeck, command)), 2)
    expect(interrupted.pendingRefresh).toBeTruthy()
    const refreshed = applyGameCommand(interrupted, { kind: 'refresh-deck', playerId: 'player-one', cookieInstanceId: 'BS8-037:refresh-cookie', shuffleSeed: 1 })
    expect(refreshed.players['player-one'].hand).toHaveLength(2)
    expect(refreshed.pendingAbilityEffect?.effects[refreshed.pendingAbilityEffect.effectIndex]).toMatchObject({ kind: 'break-to-battle' })
    const resolved = applyGameCommand(refreshed, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [golden.instanceId] })
    expect(resolved.players['player-one'].battleArea.some((cookie) => cookie.card.instanceId === golden.instanceId)).toBe(true)
  })
})
