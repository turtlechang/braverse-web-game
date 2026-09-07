import { describe, expect, it } from 'vitest'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import { getCardPoolEntry } from './card-pool'
import { applyGameCommand } from './commands'
import { resolveBattleAutomatically } from './battle'
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

const physicalCardIds = (state: GameState) => [
  ...Object.values(state.players).flatMap((player) => [
    ...player.deck, ...player.hand, ...player.breakArea, ...player.discardPile,
    ...player.supportArea.map((entry) => entry.card),
    ...player.battleArea.flatMap((entry) => [entry.card, ...entry.hpCards, ...(entry.equippedCards ?? []), ...(entry.awakenedUnderlay ?? [])]),
    ...(player.stage ? [player.stage.card] : []), ...(player.extraDeck ?? []),
  ]),
  ...(state.pendingBattle?.revealedHpCard ? [state.pendingBattle.revealedHpCard] : []),
].map((card) => card.instanceId).sort()

const setup = (shortDeck = false) => {
  const base = createBattleState()
  const flip = cookie('BS8-041', 'flip')
  const attacker = cookie('BS8-041', 'attacker')
  const defender = cookie('BS8-030', 'defender')
  const supports = [official('BS8-037', 'support-a'), official('BS8-037', 'support-b')]
  const drawnCard = official('BS8-046', 'drawn-card')
  const bottomHp = official('BS8-046', 'bottom-hp')
  const secondHp = official('BS8-046', 'second-hp')
  const state: GameState = {
    ...base,
    players: {
      ...base.players,
      'player-one': {
        ...base.players['player-one'],
        battleArea: [{ card: defender, hpCards: [bottomHp, secondHp, flip], rested: false }],
        hand: [], supportArea: [],
        deck: shortDeck ? [drawnCard] : [drawnCard, official('BS8-046', 'deck-bottom')],
        discardPile: [cookie('BS8-037', 'refresh-cookie'), official('BS8-046', 'trash-item')],
      },
      'player-two': {
        ...base.players['player-two'],
        battleArea: [{ card: attacker, hpCards: [official('BS8-046', 'attacker-hp')], rested: false }],
        supportArea: supports.map((card) => ({ card, rested: false })),
      },
    },
  }
  const command = { kind: 'declare-attack' as const, playerId: 'player-two' as const, attackerInstanceId: attacker.instanceId, targetInstanceId: defender.instanceId, supportPaymentIds: supports.map((card) => card.instanceId) }
  const declared = applyGameCommand(state, command)
  const unblocked = applyGameCommand(declared, { kind: 'skip-trap', playerId: 'player-one' })
  const revealed = applyGameCommand(unblocked, { kind: 'resolve-next-damage', playerId: 'player-one' })
  expect(revealed.pendingBattle).toMatchObject({ stage: 'flip', remainingDamage: 1, revealedHpCard: flip })
  expect(physicalCardIds(revealed)).toEqual(physicalCardIds(state))
  return { state, declared, revealed, flip, attacker, command, drawnCard, bottomHp }
}

const activate = (state: GameState) => applyGameCommand(state, { kind: 'resolve-flip', playerId: 'player-one', activate: true })
const chooseDraw = (state: GameState, drawCount: number) => applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount })
const finishDamage = (state: GameState) => applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-one' })

describe('BS8-041 Elder Kulfi optional FLIP draw', () => {
  it('uses the official two-yellow attack for two damage and a free optional-draw FLIP', () => {
    const { state, declared, flip, attacker, command } = setup()
    expect(attacker.attack).toBe(2)
    expect(attacker.attackEnergyCost).toEqual({ yellow: 2 })
    expect(flip.flip).toMatchObject({ cost: { energy: {}, discardHand: 0 }, effects: [{ kind: 'draw-up-to', max: 1 }] })
    expect(() => applyGameCommand(state, { ...command, supportPaymentIds: command.supportPaymentIds.slice(0, 1) })).toThrow()
    const wrongColor: GameState = { ...state, players: { ...state.players, 'player-two': {
      ...state.players['player-two'], supportArea: state.players['player-two'].supportArea.map((entry, index) => index === 0 ? entry : { ...entry, card: { ...entry.card, energyColor: 'blue' } }),
    } } }
    expect(() => applyGameCommand(wrongColor, command)).toThrow()
    expect(declared.pendingBattle?.declaredDamage).toBe(2)
    expect(declared.players['player-two'].supportArea.every((entry) => entry.rested)).toBe(true)
  })

  it.each([0, 1])('activation with no hand or support leaves a real decision to draw %i', (drawCount) => {
    const { state, revealed, flip, drawnCard, bottomHp } = setup()
    expect(revealed.players['player-one'].hand).toEqual([])
    expect(revealed.players['player-one'].supportArea).toEqual([])
    const pending = activate(revealed)
    expect(pending.pendingDrawUpTo).toMatchObject({ playerId: 'player-one', max: 1, sourceInstanceId: flip.instanceId })
    expect(pending.players['player-one'].hand).toEqual([])
    expect(pending.players['player-one'].deck).toEqual(revealed.players['player-one'].deck)
    expect(pending.players['player-one'].discardPile).toContainEqual(flip)
    expect(physicalCardIds(pending)).toEqual(physicalCardIds(state))
    expect(() => finishDamage(pending)).toThrow()
    expect(resolveBattleAutomatically(pending)).toEqual(pending)
    const chosen = chooseDraw(pending, drawCount)
    expect(chosen.players['player-one'].hand).toEqual(drawCount === 0 ? [] : [drawnCard])
    expect(chosen.players['player-one'].supportArea).toEqual([])
    expect(chosen.players['player-one'].discardPile).toEqual(pending.players['player-one'].discardPile)
    const finished = finishDamage(chosen)
    expect(finished.pendingBattle).toBeNull()
    expect(finished.players['player-one'].battleArea[0].hpCards).toEqual([bottomHp])
    expect(physicalCardIds(finished)).toEqual(physicalCardIds(state))
  })

  it('can decline without drawing or paying anything and continues the remaining attack damage', () => {
    const { state, revealed, flip, bottomHp } = setup()
    const declined = applyGameCommand(revealed, { kind: 'resolve-flip', playerId: 'player-one', activate: false })
    expect(declined.pendingDrawUpTo).toBeFalsy()
    expect(declined.players['player-one'].hand).toEqual([])
    expect(declined.players['player-one'].deck).toEqual(revealed.players['player-one'].deck)
    expect(declined.players['player-one'].discardPile).toContainEqual(flip)
    const finished = finishDamage(declined)
    expect(finished.pendingBattle).toBeNull()
    expect(finished.players['player-one'].battleArea[0].hpCards).toEqual([bottomHp])
    expect(physicalCardIds(finished)).toEqual(physicalCardIds(state))
  })

  it('rejects a non-owner FLIP response and non-owner or excessive draw selections', () => {
    const { revealed } = setup()
    expect(() => applyGameCommand(revealed, { kind: 'resolve-flip', playerId: 'player-two', activate: true })).toThrow()
    const pending = activate(revealed)
    expect(pending.pendingDrawUpTo?.max).toBe(1)
    expect(() => chooseDraw(pending, 2)).toThrow()
    expect(() => applyGameCommand(pending, { kind: 'resolve-draw-up-to', playerId: 'player-two', drawCount: 1 })).toThrow()
    expect(pending.players['player-one'].hand).toEqual([])
  })

  it('drawing the last deck card refreshes and then resumes remaining attack damage without losing cards', () => {
    const { state, revealed, drawnCard, bottomHp } = setup(true)
    const pending = activate(revealed)
    expect(pending.pendingDrawUpTo?.max).toBe(1)
    const interrupted = chooseDraw(pending, 1)
    expect(interrupted.pendingRefresh?.playerId).toBe('player-one')
    expect(interrupted.players['player-one'].hand).toEqual([drawnCard])
    expect(interrupted.pendingBattle?.remainingDamage).toBe(1)
    expect(physicalCardIds(interrupted)).toEqual(physicalCardIds(state))
    const refreshed = applyGameCommand(interrupted, { kind: 'refresh-deck', playerId: 'player-one', cookieInstanceId: 'BS8-037:refresh-cookie', shuffleSeed: 1 })
    const finished = finishDamage(refreshed)
    expect(finished.pendingBattle).toBeNull()
    expect(finished.pendingDrawUpTo).toBeFalsy()
    expect(finished.players['player-one'].hand).toEqual([drawnCard])
    expect(finished.players['player-one'].battleArea[0].hpCards).toEqual([bottomHp])
    expect(physicalCardIds(finished)).toEqual(physicalCardIds(state))
  })
})
