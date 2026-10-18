import { describe, expect, it } from 'vitest'
import { BS12_DECK_PRESETS } from '../../game/bs12-deck-recipes'
import {
  COMMUNITY_DECK_PRESETS,
  type CommunityDeckChoice,
} from '../../game/community-deck-recipes'
import { OFFICIAL_DECK_RECIPES } from '../../game/starter-deck'
import { getStarterDeckDraftRecipe } from './starter-deck-draft'

const communityRecipes = Object.entries(COMMUNITY_DECK_PRESETS) as [
  CommunityDeckChoice,
  (typeof COMMUNITY_DECK_PRESETS)[CommunityDeckChoice],
][]

describe('起始牌組草稿配方', () => {
  it.each(communityRecipes)(
    '%s 以社群配方名稱建立完整主牌與 EXTRA',
    (choice, recipe) => {
      const draft = getStarterDeckDraftRecipe(choice)

      expect(draft.name).toBe(recipe.name)
      expect(draft.entries).toEqual(recipe.entries)
      expect(draft.extraDeckEntries).toEqual(recipe.extraDeckEntries)
    },
  )

  it.each(Object.entries(BS12_DECK_PRESETS))(
    '%s 保持 BS12 預設牌組的名稱、主牌與 EXTRA',
    (choice, recipe) => {
      const draft = getStarterDeckDraftRecipe(choice as keyof typeof BS12_DECK_PRESETS)

      expect(draft.name).toBe(recipe.name)
      expect(draft.entries).toEqual(OFFICIAL_DECK_RECIPES[choice as keyof typeof OFFICIAL_DECK_RECIPES])
      expect(draft.extraDeckEntries).toEqual(recipe.extraDeckEntries)
    },
  )
})
