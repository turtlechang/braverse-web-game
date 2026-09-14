import { describe, expect, it } from 'vitest'
import roster from '../../../data/decks/bs9-lv5-1024-roster.json'
import {
  createCustomDeckMatch,
  simulateAiMatchDetailed,
  type SwissRosterDeck,
} from '../index'

describe('BS9 Lv.5 tournament battle continuation', () => {
  it('每副 1024 roster 牌組會把同色 BS9 EXTRA Deck 載入正式開局狀態', () => {
    const decks = roster.decks as unknown as SwissRosterDeck[]
    const playerOne = decks.find((deck) => deck.color === 'red')
    const playerTwo = decks.find((deck) => deck.color === 'blue')
    if (!playerOne || !playerTwo) throw new Error('BS9 roster EXTRA fixture 不完整')

    const state = createCustomDeckMatch(20260913, playerOne, playerTwo)
    expect(state.players['player-one'].extraDeck).toHaveLength(4)
    expect(state.players['player-two'].extraDeck).toHaveLength(4)
    expect(state.players['player-one'].extraDeck?.every((card) =>
      card.type === 'extra' && card.id === 'BS9-010' && card.cardColor === 'red',
    )).toBe(true)
    expect(state.players['player-two'].extraDeck?.every((card) =>
      card.type === 'extra' && card.id === 'BS9-088' && card.cardColor === 'blue',
    )).toBe(true)
  })

  it('攻擊後效果與防守方昏厥效果並存時仍能完成對局', () => {
    const decks = roster.decks as unknown as SwissRosterDeck[]
    const playerOne = decks.find((deck) => deck.id === 'bs9-lv5-1024-red-003')
    const playerTwo = decks.find((deck) => deck.id === 'bs9-lv5-1024-red-007')
    if (!playerOne || !playerTwo) throw new Error('BS9 regression roster fixture 不完整')

    const seed = 27720946
    const result = simulateAiMatchDetailed(
      createCustomDeckMatch(seed, playerOne, playerTwo, 'player-two'),
      1200,
      {
        levels: { 'player-one': 5, 'player-two': 5 },
        seed,
        experienceProfile: null,
      },
    )

    expect(result.stuck, result.error ?? '').toBe(false)
    expect(result.state.status).toBe('finished')
  }, 120000)

  it('攻擊後傷害序列完成後仍會交還昏厥觸發的 Then 效果控制權', () => {
    const decks = roster.decks as unknown as SwissRosterDeck[]
    const playerOne = decks.find((deck) => deck.id === 'bs9-lv5-1024-red-172')
    const playerTwo = decks.find((deck) => deck.id === 'bs9-lv5-1024-green-113')
    if (!playerOne || !playerTwo) throw new Error('BS9 regression roster fixture 不完整')

    const seed = 26261156
    const result = simulateAiMatchDetailed(
      createCustomDeckMatch(seed, playerOne, playerTwo, 'player-two'),
      2500,
      {
        levels: { 'player-one': 5, 'player-two': 5 },
        seed,
        experienceProfile: null,
      },
    )

    expect(result.stuck, result.error ?? '').toBe(false)
    expect(result.state.status).toBe('finished')
  }, 120000)
})
