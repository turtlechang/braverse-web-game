import { describe, expect, it } from 'vitest'
import {
  createCard,
  createDemoGame,
  getAttackDamageAgainst,
  getCardPoolEntry,
  getEffectiveAttack,
  type CookieCard,
  type GameCard,
  type GameState,
} from '.'

describe('BS2-073 Peperoncino Cookie', () => {
  const entry = getCardPoolEntry('BS2-073')
  if (!entry) throw new Error('BS2-073 missing from official card pool.')
  const peperoncino = createCard(entry, 'player-one', 1) as CookieCard

  const trashFiller = (count: number): GameCard[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `trash-${i}`,
      instanceId: `trash-${i}`,
      name: `Trash ${i}`,
      type: 'item',
    }))

  const stateWithTrashCount = (count: number): GameState => {
    const base = createDemoGame()
    return {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [{ card: peperoncino, hpCards: [], rested: false }],
          discardPile: trashFiller(count),
        },
      },
    }
  }

  it('deals its base attack (1) with fewer than 15 cards in the trash', () => {
    const state = stateWithTrashCount(14)
    expect(getEffectiveAttack(state, peperoncino.instanceId)).toBe(1)
    expect(
      getAttackDamageAgainst(state, peperoncino.instanceId, 'defender-cookie'),
    ).toBe(1)
  })

  it('gains +2 attack (total 3) once the trash reaches 15 cards', () => {
    const state = stateWithTrashCount(15)
    expect(getEffectiveAttack(state, peperoncino.instanceId)).toBe(3)
    expect(
      getAttackDamageAgainst(state, peperoncino.instanceId, 'defender-cookie'),
    ).toBe(3)
  })

  it('keeps the +2 bonus with more than 15 cards in the trash', () => {
    const state = stateWithTrashCount(20)
    expect(getEffectiveAttack(state, peperoncino.instanceId)).toBe(3)
  })
})
