import { describe, expect, it } from 'vitest'
import bs9Candidates from '../../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import {
  createCardCheckDemoState,
  createCardNegativeDemoState,
  parseTestStateConfig,
} from './demo'
import { canActivateCookieSkill } from './skills'
import type { GameState } from './types'

const records = bs9Candidates.cards as unknown as OfficialCardRecord[]

const candidate = () => {
  const record = records.find((card) => card.cardNumber === 'BS9-040')
  if (!record) throw new Error('Missing BS9-040 candidate')
  const conversion = convertOfficialCardToGameCard(record, 'bs9-040-test')
  if (conversion.status !== 'converted') throw new Error(conversion.reason)
  return conversion.gameCard
}

const source = (state: GameState) => {
  const entry = state.players['player-one'].battleArea.find(
    (candidateEntry) => candidateEntry.card.id === 'BS9-040',
  )
  if (!entry) throw new Error('Missing BS9-040 source')
  return entry
}

const activate = (state: GameState) => applyGameCommand(state, {
  kind: 'begin-activate-skill',
  playerId: 'player-one',
  sourceInstanceId: source(state).card.instanceId,
  trigger: 'activate',
  paymentIds: ['bs9-bs9-040-yellow-support'],
  discardHandIds: [],
  targetIds: [],
})

describe('BS9-040 Cauliflower Cookie candidate', () => {
  it('converts its printed Activate / Once Per Turn yellow payment and FLIP-Cookie reveal condition', () => {
    expect(candidate()).toMatchObject({
      id: 'BS9-040',
      name: 'Cauliflower Cookie',
      level: 1,
      hp: 3,
      attack: 1,
      attackEnergyCost: { yellow: 2 },
      skill: {
        trigger: 'activate',
        oncePerTurn: true,
        cost: { energy: { yellow: 1 }, discardHand: 0 },
        effects: [{
          kind: 'reveal-top-deck',
          match: { type: 'cookie', hasFlip: true },
          effects: [{ kind: 'draw-up-to', max: 1 }],
        }],
      },
    })
  })

  it('pays before revealing a FLIP Cookie, then offers draw 0–1 and consumes Once Per Turn', () => {
    const initial = createCardCheckDemoState('BS9-040')
    const initialHand = initial.players['player-one'].hand.length
    expect(canActivateCookieSkill(initial, 'player-one', source(initial).card.instanceId, 'activate')).toBe(true)

    let state = activate(initial)
    expect(state.players['player-one'].supportArea[0]?.rested).toBe(true)
    expect(state.pendingRevealTopDeck).toMatchObject({
      sourceCardName: 'Cauliflower Cookie',
      revealedCard: { id: 'BS9-032', name: 'Yoga Cookie' },
      matched: true,
    })

    state = applyGameCommand(state, {
      kind: 'resolve-reveal-top-deck',
      playerId: 'player-one',
    })
    expect(state.pendingDrawUpTo).toMatchObject({ max: 1, sourceCardName: 'Cauliflower Cookie' })
    state = applyGameCommand(state, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-one',
      drawCount: 1,
    })
    expect(state.players['player-one'].hand).toHaveLength(initialHand + 1)
    expect(state.players['player-one'].hand.some((card) => card.id === 'BS9-032')).toBe(true)
    expect(canActivateCookieSkill(state, 'player-one', source(state).card.instanceId, 'activate')).toBe(false)
  })

  it('still pays and publicly reveals a non-FLIP top card, but cannot open the draw branch', () => {
    const initial = createCardNegativeDemoState('BS9-040')
    const initialHand = initial.players['player-one'].hand.length
    expect(canActivateCookieSkill(initial, 'player-one', source(initial).card.instanceId, 'activate')).toBe(true)

    let state = activate(initial)
    expect(state.players['player-one'].supportArea[0]?.rested).toBe(true)
    expect(state.pendingRevealTopDeck).toMatchObject({
      revealedCard: { id: 'BS8-046' },
      matched: false,
      nestedEffects: [],
    })
    state = applyGameCommand(state, {
      kind: 'resolve-reveal-top-deck',
      playerId: 'player-one',
    })
    expect(state.pendingDrawUpTo ?? null).toBeNull()
    expect(state.players['player-one'].hand).toHaveLength(initialHand)
  })

  it('keeps candidate preview routes localhost-only', () => {
    expect(parseTestStateConfig('?test-state=bs9-card:BS9-040', 'localhost')).toEqual({
      kind: 'bs9-candidate', cardNumber: 'BS9-040', negative: false,
    })
    expect(parseTestStateConfig('?test-state=bs9-card-negative:BS9-040', '127.0.0.1')).toEqual({
      kind: 'bs9-candidate', cardNumber: 'BS9-040', negative: true,
    })
    expect(parseTestStateConfig('?test-state=bs9-card:BS9-040', 'braverse.example')).toBeNull()
  })
})
