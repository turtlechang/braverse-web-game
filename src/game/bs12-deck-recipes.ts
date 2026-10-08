import blue from '../../data/decks/bs12-blue-arena.json'
import green from '../../data/decks/bs12-green-arena.json'
import yellow from '../../data/decks/bs12-yellow-arena.json'
import red from '../../data/decks/bs12-red-arena.json'
import purple from '../../data/decks/bs12-purple-arena.json'

export const BS12_DECK_PRESETS = {
  'bs12-blue-arena': blue,
  'bs12-green-arena': green,
  'bs12-yellow-arena': yellow,
  'bs12-red-arena': red,
  'bs12-purple-arena': purple,
} as const

export type Bs12AiPresetDeckChoice = keyof typeof BS12_DECK_PRESETS
