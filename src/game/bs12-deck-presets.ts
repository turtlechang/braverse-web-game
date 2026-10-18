import { BS12_DECK_PRESETS } from './bs12-deck-recipes'
import {
  CUSTOM_DECK_STORAGE_VERSION,
  getCustomDeckStorageKey,
  loadCustomDecks,
  saveCustomDecks,
  type CustomDeck,
} from './custom-deck'

/** Add each requested deck once; subsequent edits and deletion belong to the player. */
export const installBs12DeckPresets = (): CustomDeck[] => {
  const decks = loadCustomDecks()

  // A failed storage read must never turn existing player data into an empty library.
  let raw: string | null
  try {
    raw = localStorage.getItem(getCustomDeckStorageKey())
  } catch {
    return decks
  }
  if (raw) {
    try {
      const stored = JSON.parse(raw)
      const entries = Array.isArray(stored) ? stored
        : stored?.version === CUSTOM_DECK_STORAGE_VERSION ? stored.decks : null
      if (!Array.isArray(entries) || entries.length !== decks.length) return decks
    } catch {
      return decks
    }
  }

  for (const [choice, recipe] of Object.entries(BS12_DECK_PRESETS)) {
    const installationKey = `braverse-${choice.replace('-arena', '')}-preset-installed`
    if (localStorage.getItem(installationKey) === '1') continue
    const now = new Date().toISOString()
    if (!decks.some((deck) => deck.id === `preset-${choice}`)) decks.push({
      id: `preset-${choice}`,
      name: recipe.name,
      entries: recipe.entries.map((entry) => ({ ...entry })),
      extraDeckEntries: recipe.extraDeckEntries.map((entry) => ({ ...entry })),
      format: 'standard',
      createdAt: now,
      updatedAt: now,
    })
    saveCustomDecks(decks)
    localStorage.setItem(installationKey, '1')
  }
  return loadCustomDecks()
}
