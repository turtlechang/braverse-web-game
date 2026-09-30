import { describe, expect, it } from 'vitest'
import bs11 from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { createBattleState, item } from './test-helpers/battle-helpers'
import type { CookieInBattle, GameCard, GameState } from './types'

const records = bs11.cards as unknown as OfficialCardRecord[]

const candidate = (cardNumber: string, suffix: string): GameCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  const result = convertOfficialCardToGameCard(record, `bs11-runtime-${suffix}`)
  if (result.status !== 'converted') throw new Error(`${cardNumber}: ${result.reason}`)
  return { ...result.gameCard, instanceId: `${cardNumber}:${suffix}` }
}

const entry = (card: GameCard, hpCards: GameCard[]): CookieInBattle => ({
  card: card as CookieInBattle['card'],
  hpCards,
  rested: false,
  battleEntryId: `${card.instanceId}:battle`,
})

const makeState = (): { state: GameState; source: GameCard; sacrifice: GameCard } => {
  const base = createBattleState()
  const source = candidate('BS11-018', 'source')
  const sacrifice = candidate('BS11-017', 'sacrifice')
  const state: GameState = {
    ...base,
    activePlayerId: 'player-two',
    phase: 'main',
    players: {
      ...base.players,
      'player-two': {
        ...base.players['player-two'],
        battleArea: [
          entry(source, [item('bs11-018-source-hp')]),
          entry(sacrifice, [item('bs11-017-sacrifice-hp')]),
        ],
        hand: [item('bs11-018-hand')],
        deck: [item('bs11-018-deck-1'), item('bs11-018-deck-2')],
      },
    },
  }
  return { state, source, sacrifice }
}

const resolvePendingFaints = (state: GameState): GameState => {
  let next = state
  while (next.pendingFaintEffects && next.pendingFaintEffects.length > 0) {
    next = applyGameCommand(next, {
      kind: 'resolve-faint-effect',
      playerId: 'player-two',
      targetIds: [],
    })
  }
  return next
}

describe('BS11-018 Burning Spice Cookie runtime', () => {
  it('faints a selected red Cookie as the cost, then draws up to two cards', () => {
    const { state, source, sacrifice } = makeState()
    let next = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-two',
      sourceInstanceId: source.instanceId,
      trigger: 'activate',
      paymentIds: [],
      trashBattleCookieIds: [sacrifice.instanceId],
    })
    next = resolvePendingFaints(next)

    expect(next.players['player-two'].breakArea).toContainEqual(sacrifice)
    expect(next.players['player-two'].discardPile.map((card) => card.instanceId)).toContain(
      'bs11-017-sacrifice-hp',
    )
    expect(next.commandLog?.some((entry) => entry.steps?.some((step) =>
      step.text.includes('使餅乾昏厥並送入休息區'),
    ))).toBe(true)
    expect(next.pendingAbilityEffect).toBeDefined()

    next = applyGameCommand(next, {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: [],
    })
    expect(next.pendingDrawUpTo?.max).toBe(2)
    next = applyGameCommand(next, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-two',
      drawCount: 2,
    })

    expect(next.players['player-two'].hand.map((card) => card.instanceId)).toEqual([
      'bs11-018-hand',
      'bs11-018-deck-1',
      'bs11-018-deck-2',
    ])
    expect(next.players['player-two'].battleArea).toHaveLength(1)
    expect(() => applyGameCommand(next, {
      kind: 'begin-activate-skill',
      playerId: 'player-two',
      sourceInstanceId: source.instanceId,
      trigger: 'activate',
      paymentIds: [],
      trashBattleCookieIds: [source.instanceId],
    })).toThrow()
  })
})
