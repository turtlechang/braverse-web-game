import { describe, expect, it } from 'vitest'
import { takeAiStep } from '../ai'
import { applyGameCommand } from '../commands'
import { canActivateCookieSkill, getSkillUseKey } from '../skills'
import { createCustomDeckMatch, type SwissRosterDeck } from '../tournament'
import type { AiLevel } from './types'
import type { CookieCard, GameCard, PlayerState } from '../types'

const owner = 'player-one' as const
const opponent = 'player-two' as const
const seed = 2026101802
const recipe: SwissRosterDeck = {
  id: 'empty-support-once-regression',
  name: 'Original green inventory for support deployment policy',
  color: 'green',
  format: 'standard',
  createdAt: '2026-10-18',
  updatedAt: '2026-10-18',
  entries: [
    'BS7-044', 'BS7-046', 'BS7-049', 'BS7-051', 'BS7-052',
    'BS7-053', 'BS7-054', 'BS7-055', 'BS7-056', 'BS7-057',
    'BS7-058', 'BS7-063', 'BS7-064', 'BS7-065', 'ST3-016',
  ].map(cardNumber => ({ cardNumber, count: 4 })),
  extraDeckEntries: [],
}

const resetZones = (player: PlayerState) => {
  player.deck = [
    ...player.deck,
    ...player.hand,
    ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards]),
    ...player.supportArea.map(support => support.card),
    ...player.breakArea,
    ...player.discardPile,
  ]
  player.hand = []
  player.battleArea = []
  player.supportArea = []
  player.breakArea = []
  player.discardPile = []
  player.stage = null
}

const take = (player: PlayerState, id: string): GameCard => {
  const index = player.deck.findIndex(card => card.id === id)
  if (index < 0) throw new Error(`Missing original copy ${player.id} ${id}`)
  return player.deck.splice(index, 1)[0]!
}

const takeCookie = (player: PlayerState, id: string): CookieCard => {
  const card = take(player, id)
  if (card.type !== 'cookie') throw new Error(`Expected original Cookie ${id}`)
  return card
}

// Rearranged original 60-card inventories isolate policy decisions. They are
// prepared regression states, not physical Browser or full-match evidence.
const fixture = (withSupportCookie = false) => {
  const state = createCustomDeckMatch(seed, recipe, recipe, owner)
  for (const player of Object.values(state.players)) resetZones(player)
  const self = state.players[owner]
  const foe = state.players[opponent]
  const glitter = takeCookie(self, 'BS7-055')
  const supportCookie = withSupportCookie ? takeCookie(self, 'BS7-046') : undefined
  self.supportArea = ['BS7-063', 'BS7-064', 'BS7-065'].flatMap(id =>
    Array.from({ length: 4 }, () => ({ card: take(self, id), rested: false })),
  )
  if (supportCookie) self.supportArea.push({ card: supportCookie, rested: false })
  self.battleArea = [{
    card: glitter,
    hpCards: self.deck.splice(0, glitter.hp),
    rested: true,
    battleEntryId: `${glitter.instanceId}:battle:1`,
    enteredFrom: 'hand',
    enteredTurn: 1,
  }]
  const foeCookie = takeCookie(foe, 'BS7-046')
  foe.battleArea = [{
    card: foeCookie,
    hpCards: foe.deck.splice(0, foeCookie.hp),
    rested: false,
    battleEntryId: `${foeCookie.instanceId}:battle:2`,
    enteredFrom: 'hand',
    enteredTurn: 1,
  }]
  state.activePlayerId = owner
  state.phase = 'main'
  state.turnNumber = 3
  state.supportPlacedThisTurn = true
  state.skillUsesThisTurn = []
  state.nextBattleEntrySequence = 3
  state.commandLog = []
  return { state, glitter, supportCookie }
}

describe('AI preserves a free support deployment Once when it selects zero', () => {
  it.each([2, 3, 4, 5] as AiLevel[])(
    'Lv%s does not spend the original BS7-055 Once without a support Cookie',
    level => {
      const { state, glitter } = fixture()
      const before = structuredClone(state)
      const source = state.players[owner].battleArea[0]
      expect(glitter).toMatchObject({
        id: 'BS7-055', name: 'Shining Glitter Cookie', energyColor: 'green',
        level: 3, hp: 5, attack: 3,
      })
      expect(state.players[owner].supportArea.every(support => support.card.type !== 'cookie'))
        .toBe(true)
      expect(canActivateCookieSkill(state, owner, glitter.instanceId, 'activate')).toBe(true)

      const decision = takeAiStep(state, owner, { level, seed, searchNow: () => 0 })

      expect(decision.action).toBe('advance-phase')
      expect(decision.error).toBeUndefined()
      expect(decision.state.skillUsesThisTurn).not.toContain(getSkillUseKey(source))
      expect(decision.state.commandLog?.some(entry =>
        entry.payload?.kind === 'activate-skill' &&
        entry.payload.sourceInstanceId === glitter.instanceId,
      )).toBe(false)
      expect(state).toEqual(before)
    },
  )

  it.each([2, 3, 4, 5] as AiLevel[])(
    'Lv%s can still deploy an original Cookie through BS7-055',
    level => {
      const { state, glitter, supportCookie } = fixture(true)
      if (!supportCookie) throw new Error('Fixture requires an original support Cookie')
      const before = structuredClone(state)
      const source = state.players[owner].battleArea[0]

      const decision = takeAiStep(state, owner, { level, seed, searchNow: () => 0 })

      expect(decision.action).toBe('activate-skill')
      expect(decision.error).toBeUndefined()
      expect(decision.state.skillUsesThisTurn).toContain(getSkillUseKey(source))
      expect(decision.effectSelections).toContainEqual(expect.objectContaining({
        sourceInstanceId: glitter.instanceId,
        targetIds: [supportCookie.instanceId],
        effect: { kind: 'support-to-battle', amount: 1 },
      }))
      expect(decision.state.players[owner].battleArea.find(cookie =>
        cookie.card.instanceId === supportCookie.instanceId,
      )).toMatchObject({ card: supportCookie, rested: false })
      expect(decision.state.players[owner].supportArea.some(support =>
        support.card.instanceId === supportCookie.instanceId,
      )).toBe(false)
      expect(state).toEqual(before)
    },
  )

  it('preserves the player rule that a legal zero-target activation consumes Once', () => {
    const { state, glitter } = fixture()
    const before = structuredClone(state)
    const source = state.players[owner].battleArea[0]

    const after = applyGameCommand(state, {
      kind: 'activate-skill',
      playerId: owner,
      sourceInstanceId: glitter.instanceId,
      trigger: 'activate',
      paymentIds: [],
      effectTargets: [[]],
    }, { shuffleSeed: seed })

    expect(after.skillUsesThisTurn).toContain(getSkillUseKey(source))
    expect(after.players[owner].battleArea).toEqual(before.players[owner].battleArea)
    expect(after.players[owner].supportArea).toEqual(before.players[owner].supportArea)
    expect(canActivateCookieSkill(after, owner, glitter.instanceId, 'activate')).toBe(false)
    expect(state).toEqual(before)
  })
})
