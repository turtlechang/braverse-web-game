import blue from '../../data/decks/bs12-blue-arena.json'
import green from '../../data/decks/bs12-green-arena.json'
import yellow from '../../data/decks/bs12-yellow-arena.json'
import red from '../../data/decks/bs12-red-arena.json'
import purple from '../../data/decks/bs12-purple-arena.json'
import black from '../../data/decks/bs12-black-arena.json'
import redKoreanStarter from '../../data/decks/bs12-red-korean-starter.json'

export const BS12_DECK_PRESETS = {
  'bs12-blue-arena': blue,
  'bs12-green-arena': green,
  'bs12-yellow-arena': yellow,
  'bs12-red-arena': red,
  'bs12-purple-arena': purple,
  'bs12-black-arena': black,
  'bs12-red-korean-starter': redKoreanStarter,
} as const

export type Bs12AiPresetDeckChoice = keyof typeof BS12_DECK_PRESETS
