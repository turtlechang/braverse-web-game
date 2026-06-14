import type { DeckChoice } from './starter-deck'

const OPENING_DECKS: readonly DeckChoice[] = ['red', 'yellow', 'green']

export const chooseRandomDeck = (
  random: () => number = Math.random,
): DeckChoice => {
  const value = Math.max(0, Math.min(random(), 1))
  const index = Math.min(
    Math.floor(value * OPENING_DECKS.length),
    OPENING_DECKS.length - 1,
  )
  return OPENING_DECKS[index]
}
