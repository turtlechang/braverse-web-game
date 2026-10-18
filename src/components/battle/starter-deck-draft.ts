import { BS12_DECK_PRESETS } from '../../game/bs12-deck-recipes'
import {
  COMMUNITY_DECK_PRESETS,
  type CommunityDeckChoice,
} from '../../game/community-deck-recipes'
import {
  OFFICIAL_DECK_RECIPES,
  type BuiltInDeckChoice,
  type StarterDeckChoice,
  type StarterDeckEntry,
} from '../../game/starter-deck'

export interface StarterDeckDraftRecipe {
  name: string
  entries: StarterDeckEntry[]
  extraDeckEntries?: StarterDeckEntry[]
}

const starterDeckLabels: Record<StarterDeckChoice, string> = {
  red: '紅色',
  yellow: '黃色',
  green: '綠色',
  blue: '藍色',
  purple: '紫色',
}

export const getStarterDeckDraftRecipe = (
  choice: BuiltInDeckChoice,
): StarterDeckDraftRecipe => {
  const bs12Preset = BS12_DECK_PRESETS[
    choice as keyof typeof BS12_DECK_PRESETS
  ]
  const communityPreset = COMMUNITY_DECK_PRESETS[
    choice as CommunityDeckChoice
  ]
  const preset = bs12Preset ?? communityPreset
  const starterLabel = starterDeckLabels[choice as StarterDeckChoice]

  return {
    name: preset?.name ?? (starterLabel ? `${starterLabel} Starter` : choice),
    entries: OFFICIAL_DECK_RECIPES[choice].map((entry) => ({ ...entry })),
    ...(preset
      ? { extraDeckEntries: preset.extraDeckEntries.map((entry) => ({ ...entry })) }
      : {}),
  }
}
