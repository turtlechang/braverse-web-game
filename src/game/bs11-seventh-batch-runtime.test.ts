import { describe, expect, it } from 'vitest'
import bs11 from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { cookie, createBattleState, item } from './test-helpers/battle-helpers'
import type { CookieInBattle, GameCard, GameState } from './types'

const records = bs11.cards as unknown as OfficialCardRecord[]

const candidate = (cardNumber: string, suffix: string): GameCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  const result = convertOfficialCardToGameCard(record, `bs11-seventh-runtime-${suffix}`)
  if (result.status !== 'converted') throw new Error(`${cardNumber}: ${result.reason}`)
  return { ...result.gameCard, instanceId: `${cardNumber}:${suffix}` }
}

const entry = (card: GameCard, hpCards: GameCard[]): CookieInBattle => ({
  card: card as CookieInBattle['card'],
  hpCards,
  rested: false,
  battleEntryId: `${card.instanceId}:battle`,
})

const makeFaintState = (hand: GameCard[]): { state: GameState; source: GameCard } => {
  const base = createBattleState()
  const source = candidate('BS11-024', 'faint-source')
  const survivor = cookie('bs11-024-survivor', 1, 2)
  let state: GameState = {
    ...base,
    players: {
      ...base.players,
      'player-one': {
        ...base.players['player-one'],
        battleArea: [
          entry(source, [item('bs11-024-faint-hp')]),
          entry(survivor, [item('bs11-024-survivor-hp-a'), item('bs11-024-survivor-hp-b')]),
        ],
        hand,
        deck: [
          item('bs11-024-replacement-hp-a'),
          item('bs11-024-replacement-hp-b'),
          item('bs11-024-replacement-hp-c'),
          item('bs11-024-replacement-hp-d'),
        ],
        discardPile: [],
        supportArea: [],
      },
    },
  }
  state = applyGameCommand(state, {
    kind: 'declare-attack',
    playerId: 'player-two',
    attackerInstanceId: 'attacker',
    targetInstanceId: source.instanceId,
    supportPaymentIds: ['p2-support'],
  })
  state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-one' })
  state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-one' })
  expect(state.pendingFaintEffects?.length).toBeGreaterThan(0)
  return { state, source }
}

const makeAttackThenState = (): { state: GameState; source: GameCard } => {
  const base = createBattleState()
  const source = candidate('BS11-025', 'attack-source')
  const defender = base.players['player-one'].battleArea[0]
  if (!defender) throw new Error('Expected a default defender')
  const supports = [item('bs11-025-yellow-a', 'yellow'), item('bs11-025-yellow-b', 'yellow')]
  let state: GameState = {
    ...base,
    players: {
      ...base.players,
      'player-one': {
        ...base.players['player-one'],
        battleArea: [{
          ...defender,
          hpCards: [
            item('bs11-025-target-hp-a'),
            item('bs11-025-target-hp-b'),
            item('bs11-025-target-hp-c'),
            item('bs11-025-target-hp-d'),
          ],
        }],
        supportArea: [],
        hand: [],
        discardPile: [],
      },
      'player-two': {
        ...base.players['player-two'],
        battleArea: [entry(source, [item('bs11-025-source-hp')])],
        supportArea: supports.map((card) => ({ card, rested: false })),
        hand: [],
        deck: [item('bs11-025-draw-a'), item('bs11-025-draw-b'), item('bs11-025-deck-reserve')],
        discardPile: [],
      },
    },
  }
  state = applyGameCommand(state, {
    kind: 'declare-attack',
    playerId: 'player-two',
    attackerInstanceId: source.instanceId,
    targetInstanceId: defender.card.instanceId,
    supportPaymentIds: supports.map((card) => card.instanceId),
  })
  state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-one' })
  for (let damage = 0; damage < 3; damage += 1) {
    state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-one' })
  }
  expect(state.pendingBattle?.stage).toBe('attack-effect')
  return { state, source }
}

describe('BS11-024 Smoked Cheese Cookie faint replacement', () => {
  it('plays a hand LV.3 Cookie and gives that Cookie one additional HP', () => {
    const replacement = { ...cookie('bs11-024-hand-lv3', 1, 2), level: 3 }
    const { state, source } = makeFaintState([replacement])

    const resolved = applyGameCommand(state, {
      kind: 'resolve-faint-effect',
      playerId: 'player-one',
      targetIds: [replacement.instanceId],
      paymentIds: [],
    })
    expect(resolved.players['player-one'].battleArea.find((entry) => entry.card.instanceId === replacement.instanceId)?.hpCards)
      .toHaveLength(replacement.hp + 1)
    expect(resolved.players['player-one'].breakArea).toContainEqual(source)
    expect(resolved.pendingAbilityEffect).toBeUndefined()
  })

  it('skips the optional faint effect when no hand Cookie is exactly LV.3', () => {
    const levelTwo = cookie('bs11-024-hand-lv2', 1, 2)
    const { state } = makeFaintState([levelTwo])

    const skipped = applyGameCommand(state, {
      kind: 'resolve-faint-effect',
      playerId: 'player-one',
      targetIds: [],
      paymentIds: [],
    })
    expect(skipped.pendingFaintEffects ?? null).toBeNull()
    expect(skipped.pendingAbilityEffect).toBeUndefined()
    expect(skipped.players['player-one'].battleArea.map((entry) => entry.card.instanceId))
      .not.toContain(levelTwo.instanceId)
  })
})

describe('BS11-025 Fettuccine Cookie attack Then', () => {
  it.each([0, 2])('draws up to two cards before placing the source in break (%s)', (drawCount) => {
    const { state, source } = makeAttackThenState()
    const pendingDraw = applyGameCommand(state, {
      kind: 'resolve-attack-effect',
      playerId: 'player-two',
      targetIds: [],
    })
    expect(pendingDraw.pendingDrawUpTo).toMatchObject({ playerId: 'player-two', max: 2 })

    const afterDraw = applyGameCommand(pendingDraw, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-two',
      drawCount,
    })
    expect(afterDraw.pendingBattle?.stage).toBe('attack-effect')

    const resolved = applyGameCommand(afterDraw, {
      kind: 'resolve-attack-effect',
      playerId: 'player-two',
      targetIds: [source.instanceId],
    })
    expect(resolved.pendingBattle).toBeNull()
    expect(resolved.players['player-two'].breakArea).toContainEqual(source)
    expect(resolved.players['player-two'].hand.map((card) => card.instanceId))
      .toEqual(drawCount === 0 ? [] : ['bs11-025-draw-a', 'bs11-025-draw-b'])
  })
})
