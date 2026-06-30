import type { DeckChoice } from './starter-deck'

const AI_DECKS: readonly Exclude<DeckChoice, 'custom'>[] = [
  'red',
  'yellow',
  'green',
  'blue',
  'purple',
]

export const chooseRandomDeck = (
  random: () => number = Math.random,
): Exclude<DeckChoice, 'custom'> => {
  const value = Math.max(0, Math.min(random(), 1))
  const index = Math.min(
    Math.floor(value * AI_DECKS.length),
    AI_DECKS.length - 1,
  )
  return AI_DECKS[index]
}
