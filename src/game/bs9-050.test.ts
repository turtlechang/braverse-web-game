import { describe, expect, it } from 'vitest'
import bs9Candidates from '../../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { canActivateCookieSkill, getCookieSkillUnavailableReason } from './skills'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState, createCardNegativeDemoState } from './demo'
import type { GameCard } from './types'

const records = bs9Candidates.cards as unknown as OfficialCardRecord[]

const candidate = (cardNumber: string): GameCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS9-050 candidate ${cardNumber}`)
  const conversion = convertOfficialCardToGameCard(record, 'bs9-050-test')
  if (conversion.status !== 'converted') throw new Error(conversion.reason)
  return conversion.gameCard
}

describe('BS9-050 Wind Archer Cookie', () => {
  it('converts both arts with the support-trash condition and attack Then', () => {
    for (const cardNumber of ['BS9-050', 'BS9-050@1']) {
      expect(candidate(cardNumber)).toMatchObject({
        id: 'BS9-050',
        name: 'Wind Archer Cookie',
        attack: 3,
        attackEnergyCost: { green: 3 },
        skill: {
          trigger: 'activate',
          oncePerTurn: true,
          effects: [{
            kind: 'set-active',
            supportCount: 1,
            selectable: true,
            optional: true,
            condition: {
              kind: 'support-cards-trashed-this-turn-at-least',
              count: 2,
            },
          }],
        },
        attackEffects: [{
          kind: 'optional-cost-attack',
          cost: { energy: {}, supportToTrash: 2 },
          effects: [{
            kind: 'damage-all',
            amount: 1,
            side: 'opponent',
            sequential: true,
            target: { side: 'opponent', min: 1, max: 2 },
          }],
        }],
      })
    }
  })

  it('requires the two-card support-trash Then cost and damages every selected opponent Cookie', () => {
    let state = createCardCheckDemoState('BS9-050', { normalAttack: 'payable' })
    state = applyGameCommand(state, {
      kind: 'resolve-attack-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    const supports = state.players['player-one'].supportArea.map(({ card }) => card.instanceId)
    const targets = state.players['player-two'].battleArea.map(({ card }) => card.instanceId)
    expect(state.pendingOptionalCostAttack?.cost).toMatchObject({ supportToTrash: 2 })
    expect(() => applyGameCommand(state, {
      kind: 'resolve-optional-cost-attack',
      playerId: 'player-one',
      action: 'pay',
      targetIds: targets,
      supportToTrashIds: [supports[0]!],
    })).toThrow(/Must trash exactly 2/)

    state = applyGameCommand(state, {
      kind: 'resolve-optional-cost-attack',
      playerId: 'player-one',
      action: 'pay',
      targetIds: targets,
      supportToTrashIds: supports.slice(0, 2),
    })
    expect(state.players['player-one'].supportArea).toHaveLength(3)
    expect(state.players['player-one'].discardPile.filter((card) => supports.slice(0, 2).includes(card.instanceId))).toHaveLength(2)
    expect(state.supportCardsTrashedThisTurn).toEqual({ 'player-one': 2 })

    state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
    state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
    expect(state.pendingBattle).toBeNull()
    expect(state.players['player-two'].battleArea.map((cookie) => cookie.hpCards.length)).toEqual([3, 4])
  })

  it('exposes the support-trash condition and enforces Once Per Turn on Crow Storm', () => {
    let state = createCardCheckDemoState('BS9-050', { preferSkillSurface: true })
    const source = state.players['player-one'].battleArea.find((entry) => entry.card.id === 'BS9-050')!
    expect(canActivateCookieSkill(state, 'player-one', source.card.instanceId, 'activate')).toBe(true)

    state = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
    })
    const restedSupport = state.players['player-one'].supportArea.find((support) => support.rested)!
    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [restedSupport.card.instanceId],
    })
    expect(state.players['player-one'].supportArea.find((support) => support.card.instanceId === restedSupport.card.instanceId)?.rested).toBe(false)
    expect(() => applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
    })).toThrow(/每回合一次/)

    const negative = createCardNegativeDemoState('BS9-050', { preferSkillSurface: true })
    const negativeSource = negative.players['player-one'].battleArea.find((entry) => entry.card.id === 'BS9-050')!
    expect(canActivateCookieSkill(negative, 'player-one', negativeSource.card.instanceId, 'activate')).toBe(false)
    expect(getCookieSkillUnavailableReason(negative, 'player-one', negativeSource.card.instanceId, 'activate')).toMatch(/支援卡.*2/)
  })

  it('skips the optional Then without moving supports when the second support is unavailable', () => {
    let state = createCardCheckDemoState('BS9-050', { normalAttack: 'blocked' })
    state = applyGameCommand(state, {
      kind: 'resolve-attack-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    const supportCount = state.players['player-one'].supportArea.length
    state = applyGameCommand(state, {
      kind: 'resolve-optional-cost-attack',
      playerId: 'player-one',
      action: 'skip',
    })
    expect(state.players['player-one'].supportArea).toHaveLength(supportCount)
    expect(state.players['player-two'].battleArea.map((cookie) => cookie.hpCards.length)).toEqual([4, 5])
    expect(state.pendingBattle).toBeNull()
  })
})
