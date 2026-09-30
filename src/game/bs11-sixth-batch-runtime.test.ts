import { describe, expect, it } from 'vitest'
import bs11 from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { getEffectSelectionCandidates } from './effects'
import { canActivateCookieSkill } from './skills'
import { createBattleState, item } from './test-helpers/battle-helpers'
import type { CookieInBattle, GameCard, GameState } from './types'

const records = bs11.cards as unknown as OfficialCardRecord[]

const candidate = (cardNumber: string, suffix: string): GameCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  const result = convertOfficialCardToGameCard(record, `bs11-sixth-runtime-${suffix}`)
  if (result.status !== 'converted') throw new Error(`${cardNumber}: ${result.reason}`)
  return { ...result.gameCard, instanceId: `${cardNumber}:${suffix}` }
}

const entry = (card: GameCard, hpCards: GameCard[]): CookieInBattle => ({
  card: card as CookieInBattle['card'],
  hpCards,
  rested: false,
  battleEntryId: `${card.instanceId}:battle`,
})

const makeState = (withWizard: boolean): {
  state: GameState
  source: GameCard
  flip: GameCard
  nonFlip: GameCard
} => {
  const base = createBattleState()
  const source = candidate('BS11-021', 'source')
  const flip = candidate('BS11-019', 'flip')
  const nonFlip = candidate('BS11-022', 'non-flip')
  const wizard = {
    ...source,
    id: 'wizard-fixture',
    instanceId: 'wizard-fixture',
    name: 'Wizard Cookie',
    skill: undefined,
  }
  const state: GameState = {
    ...base,
    activePlayerId: 'player-two',
    phase: 'main',
    players: {
      ...base.players,
      'player-two': {
        ...base.players['player-two'],
        battleArea: [
          entry(source, [item('bs11-021-source-hp')]),
          ...(withWizard ? [entry(wizard, [item('wizard-hp')])] : []),
        ],
        hand: [],
        deck: [item('bs11-021-draw')],
        discardPile: [flip, nonFlip, item('not-a-cookie')],
      },
    },
  }
  return { state, source, flip, nonFlip }
}

const begin = (state: GameState, source: GameCard) => applyGameCommand(state, {
  kind: 'begin-activate-skill',
  playerId: 'player-two',
  sourceInstanceId: source.instanceId,
  trigger: 'activate',
  paymentIds: [],
})

const setupFlipAttack = (
  cardNumber: 'BS11-019' | 'BS11-020',
  suffix: string,
  options: { hand: GameCard[]; deck: GameCard[] },
) => {
  const base = createBattleState()
  const flip = candidate(cardNumber, `${suffix}:flip`)
  const defender = base.players['player-one'].battleArea[0]
  if (!defender) throw new Error('Expected a default defender')

  let state: GameState = {
    ...base,
    players: {
      ...base.players,
      'player-one': {
        ...base.players['player-one'],
        hand: options.hand,
        deck: options.deck,
        discardPile: [],
        battleArea: [{
          ...defender,
          hpCards: [item(`${suffix}:hp-bottom`), flip],
        }],
      },
    },
  }
  state = applyGameCommand(state, {
    kind: 'declare-attack',
    playerId: 'player-two',
    attackerInstanceId: 'attacker',
    targetInstanceId: 'defender',
    supportPaymentIds: ['p2-support'],
  })
  state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-one' })
  state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-one' })
  expect(state.pendingBattle?.stage).toBe('flip')
  expect(state.pendingBattle?.revealedHpCard).toEqual(flip)
  return { state, flip }
}

describe('BS11-021 Book of Wizdom runtime', () => {
  it('blocks activation unless a Wizard Cookie is in the battle area', () => {
    const { state, source } = makeState(false)

    expect(canActivateCookieSkill(state, 'player-two', source.instanceId, 'activate')).toBe(false)
    expect(() => begin(state, source)).toThrow()
  })

  it('returns only one FLIP Cookie from the owner trash and permits selecting zero', () => {
    const { state, source, flip, nonFlip } = makeState(true)
    const effect = source.skill?.effects[0]
    if (!effect) throw new Error('BS11-021 must have a recovery effect')

    expect(getEffectSelectionCandidates(state, {
      sourcePlayerId: 'player-two',
      sourceInstanceId: source.instanceId,
    }, effect).map((card) => card.instanceId)).toEqual([flip.instanceId])

    const activated = begin(state, source)
    expect(() => applyGameCommand(activated, {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: [nonFlip.instanceId],
    })).toThrow()

    const skipped = applyGameCommand(activated, {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: [],
    })
    expect(skipped.players['player-two'].hand).toEqual([])
    expect(skipped.players['player-two'].discardPile).toContainEqual(flip)
    expect(() => begin(skipped, source)).toThrow()

    const recovered = applyGameCommand(begin(state, source), {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: [flip.instanceId],
    })
    expect(recovered.players['player-two'].hand).toEqual([flip])
    expect(recovered.players['player-two'].discardPile).not.toContainEqual(flip)
    expect(recovered.players['player-two'].discardPile).toContainEqual(nonFlip)
  })
})

describe('BS11-019 and BS11-020 FLIP through a real attack', () => {
  it('BS11-019 pays one hand card and adds exactly one HP to the attached Cookie', () => {
    const hand = [item('bs11-019-hand-cost')]
    const deck = [item('bs11-019-deck-top'), item('bs11-019-deck-bottom')]
    const { state, flip } = setupFlipAttack('BS11-019', 'bs11-019-positive', { hand, deck })

    const resolved = applyGameCommand(state, {
      kind: 'resolve-flip',
      playerId: 'player-one',
      activate: true,
      discardHandIds: [hand[0]!.instanceId],
    })

    expect(resolved.players['player-one'].battleArea[0]?.hpCards.map((card) => card.instanceId))
      .toEqual(['bs11-019-positive:hp-bottom', 'bs11-019-deck-top'])
    expect(resolved.players['player-one'].hand).toEqual([])
    expect(resolved.players['player-one'].discardPile.map((card) => card.instanceId))
      .toEqual(expect.arrayContaining([flip.instanceId, hand[0]!.instanceId]))
  })

  it('BS11-019 rejects activation when the discard-hand cost cannot be paid immutably', () => {
    const { state } = setupFlipAttack('BS11-019', 'bs11-019-no-cost', {
      hand: [],
      deck: [item('bs11-019-no-cost-deck-top')],
    })
    const snapshot = structuredClone(state)

    expect(() => applyGameCommand(state, {
      kind: 'resolve-flip',
      playerId: 'player-one',
      activate: true,
      discardHandIds: [],
    })).toThrow()
    expect(state).toEqual(snapshot)
  })

  it.each([0, 1])('BS11-020 draws up to one card and accepts draw count %s', (drawCount) => {
    const deck = [item(`bs11-020-deck-${drawCount}-top`), item(`bs11-020-deck-${drawCount}-bottom`)]
    const { state, flip } = setupFlipAttack('BS11-020', `bs11-020-draw-${drawCount}`, {
      hand: [],
      deck,
    })

    const pending = applyGameCommand(state, {
      kind: 'resolve-flip',
      playerId: 'player-one',
      activate: true,
      discardHandIds: [],
    })
    expect(pending.pendingDrawUpTo).toMatchObject({ playerId: 'player-one', max: 1 })

    const resolved = applyGameCommand(pending, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-one',
      drawCount,
    })
    expect(resolved.pendingDrawUpTo ?? null).toBeNull()
    expect(resolved.players['player-one'].discardPile).toContainEqual(flip)
    expect(resolved.players['player-one'].hand.map((card) => card.instanceId))
      .toEqual(drawCount === 0 ? [] : [deck[0]!.instanceId])
  })
})
