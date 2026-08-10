import type { AbilityCost, CardEffect, CardKeyword, EnergyCost } from '../game'

const opponent = (max = 1) => ({ side: 'opponent' as const, min: 0, max })
const self = (max = 1) => ({ side: 'self' as const, min: 0, max })

export const P_EXACT_EFFECTS: Partial<Record<string, CardEffect[]>> = {
  'P-041': [],
  'P-042': [{
    kind: 'set-cookie-active',
    target: { side: 'self', min: 1, max: 1, sourceOnly: true },
    condition: { kind: 'source-hp-at-most', amount: 1 },
  }],
  'P-043': [{
    kind: 'gain-hp',
    amount: 1,
    target: { side: 'self', min: 0, max: 1, energyColor: 'yellow', maxLevel: 3 },
  }],
  'P-044': [{
    kind: 'battle-to-support',
    target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
    rested: true,
  }],
  'P-045': [
    { kind: 'discard-hand', count: 1, destination: 'deck-bottom' },
    { kind: 'draw-up-to', max: 1 },
  ],
  'P-046': [{ kind: 'hp-to-trash-all', amount: 1, side: 'opponent' }],
  'P-050': [{
    kind: 'modify-attack',
    amount: 1,
    duration: 'this-turn',
    target: { side: 'self', min: 1, max: 1, sourceOnly: true },
  }],
  'P-051': [{
    kind: 'damage',
    amount: 2,
    target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
    condition: { kind: 'break-level-at-least', level: 2 },
  }],
  'P-052': [{
    kind: 'make-faint',
    target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
    condition: { kind: 'break-level-at-least', level: 5 },
  }],
  'P-054': [{
    kind: 'draw-up-to',
    max: 2,
    condition: {
      kind: 'all-of',
      conditions: [
        { kind: 'hand-count-at-most', count: 5 },
        { kind: 'opponent-has-cookie-with-level', level: 1 },
      ],
    },
  }],
  'P-055': [{
    kind: 'damage',
    amount: 2,
    target: { ...opponent(), maxLevel: 1 },
    condition: {
      kind: 'opponent-trash-count-at-least',
      count: 15,
    },
  }],
  'P-056': [{
    kind: 'make-faint',
    target: { ...opponent(), remainingHp: 1 },
  }],
  'P-057': [{
    kind: 'gain-hp',
    amount: 2,
    target: { side: 'self', min: 1, max: 1, sourceOnly: true },
    condition: {
      kind: 'break-area-card-count-at-least',
      side: 'self',
      count: 2,
      minLevel: 3,
    },
  }],
  'P-058': [{ kind: 'deck-to-support', amount: 2, rested: false }],
  'P-059': [{
    kind: 'draw-up-to',
    max: 1,
    condition: { kind: 'active-support-count-at-least', count: 2 },
  }],
  'P-060': [{
    kind: 'set-cookie-active',
    target: { side: 'self', min: 1, max: 1, sourceOnly: true },
  }],
  'P-065': [{
    kind: 'modify-attack',
    amount: 1,
    duration: 'persistent',
    target: { side: 'self', min: 1, max: 1, sourceOnly: true },
    condition: {
      kind: 'battle-area-has-named-cookie',
      side: 'self',
      name: 'Pizza Cookie',
      excludeSource: true,
    },
  }],
  'P-066': [{
    kind: 'gain-hp',
    amount: 1,
    target: { side: 'self', min: 1, max: 1, sourceOnly: true },
    condition: { kind: 'break-level-at-least', level: 5 },
  }],
  'P-067': [{
    kind: 'modify-attack',
    amount: 1,
    duration: 'persistent',
    target: { side: 'self', min: 1, max: 1, sourceOnly: true },
    condition: { kind: 'support-count-less-than-opponent', difference: 2 },
  }],
  'P-069': [{
    kind: 'rest-cookie',
    target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
  }],
  'P-070': [{
    kind: 'damage',
    amount: 1,
    target: { ...opponent(), maxLevel: 1 },
  }],
  'P-071': [
    { kind: 'hand-to-break', amount: 1, optional: false },
    { kind: 'draw-up-to', max: 2 },
  ],
  'P-072': [{ kind: 'deck-to-support', amount: 1, rested: false }],
  'P-074': [{ kind: 'draw-up-to', max: 2 }],
  'P-080': [
    { kind: 'break-source-to-trash' },
    {
      kind: 'modify-attack',
      amount: 1,
      duration: 'this-turn',
      target: { side: 'self', min: 0, max: 1, maxLevel: 1 },
    },
  ],
  'P-083': [
    { kind: 'break-source-to-trash' },
    {
      kind: 'rest-support',
      side: 'opponent',
      amount: 1,
      activeOnly: true,
      optional: true,
      condition: { kind: 'opponent-support-count-at-least', count: 7 },
    },
  ],
  'P-084': [
    {
      kind: 'rest-cookie',
      target: { side: 'self', min: 1, max: 1 },
    },
    {
      kind: 'damage',
      amount: 1,
      target: opponent(),
    },
  ],
  'P-086': [
    { kind: 'break-source-to-trash' },
    {
      kind: 'opponent-discard-hand',
      count: 1,
      destination: 'trash',
      condition: { kind: 'opponent-hand-count-at-least', count: 6 },
    },
  ],
  'P-093': [{
    kind: 'damage',
    amount: 1,
    target: opponent(),
    condition: { kind: 'source-hp-reduced-this-turn' },
  }],
  'P-095': [{
    kind: 'gain-hp',
    amount: 1,
    target: { side: 'self', min: 1, max: 1, sourceOnly: true, maxRemainingHp: 4 },
    condition: { kind: 'item-activated-this-turn' },
  }],
  'P-096': [{
    kind: 'damage',
    amount: 1,
    target: opponent(),
    condition: {
      kind: 'cookies-fainted-this-turn-at-least',
      side: 'self',
      count: 2,
    },
  }],
  'P-097': [{ kind: 'draw-up-to', max: 2 }],
  'P-098': [{
    kind: 'gain-hp',
    amount: 1,
    target: { side: 'self', min: 1, max: 1, sourceOnly: true },
    condition: { kind: 'support-cards-trashed-this-turn-at-least', count: 2 },
  }],
  'P-102': [{
    kind: 'damage',
    amount: 1,
    target: opponent(),
    condition: {
      kind: 'all-of',
      conditions: [
        { kind: 'trash-count-at-least', count: 15 },
        { kind: 'opponent-trash-count-at-least', count: 15 },
      ],
    },
  }],
  'P-103': [{
    kind: 'damage',
    amount: 1,
    target: opponent(),
  }],
  'P-104': [{
    kind: 'battle-to-support',
    target: { side: 'self', min: 0, max: 1, maxLevel: 2, excludeSource: true },
    rested: true,
  }],
  'P-105': [{
    kind: 'modify-attack',
    amount: 2,
    duration: 'this-turn',
    target: { side: 'self', min: 1, max: 1, sourceOnly: true },
  }],
  'P-106': [{
    kind: 'modify-attack',
    amount: 1,
    duration: 'this-turn',
    target: { side: 'self', min: 1, max: 1, sourceOnly: true },
    condition: { kind: 'arena-cookie-dealt-effect-damage-this-turn' },
  }],
  'P-108': [{
    kind: 'damage',
    amount: 2,
    target: opponent(),
  }],
  'P-109': [{
    kind: 'damage-all',
    amount: 1,
    side: 'opponent',
    condition: {
      kind: 'any-of',
      conditions: [
        { kind: 'break-area-card-count-at-least', side: 'self', count: 4, keyword: 'arena' },
        { kind: 'arena-cookie-placed-in-break-this-turn' },
      ],
    },
  }],
  'P-110': [{
    kind: 'modify-attack',
    amount: 2,
    duration: 'this-turn',
    target: { side: 'self', min: 1, max: 1, sourceOnly: true },
    condition: {
      kind: 'any-of',
      conditions: [
        { kind: 'break-area-card-count-at-least', side: 'self', count: 4, keyword: 'arena' },
        { kind: 'arena-cookie-placed-in-break-this-turn' },
      ],
    },
  }],
  'P-114': [
    { kind: 'deck-to-support', amount: 1, rested: true },
    { kind: 'damage', amount: 1, target: opponent() },
  ],
  'P-115': [
    {
      kind: 'draw',
      amount: 1,
      condition: { kind: 'support-color-count-at-least', color: 'green', count: 3 },
    },
    {
      kind: 'support-to-battle',
      amount: 1,
      keyword: 'arena',
      condition: { kind: 'support-color-count-at-least', color: 'green', count: 3 },
    },
  ],
  'P-116': [
    { kind: 'reveal-hand', amount: 2, keyword: 'arena' },
    { kind: 'draw-up-to', max: 2, condition: { kind: 'hand-count-at-most', count: 5 } },
  ],
  'P-119': [{ kind: 'damage', amount: 1, target: opponent() }],
  'P-120': [{
    kind: 'field-to-trash',
    target: { side: 'self', min: 0, max: 1, maxLevel: 2, energyColor: 'purple' },
  }],
  'P-121': [
    { kind: 'damage', amount: 1, target: opponent(), condition: {
      kind: 'trash-keyword-count-at-least', keyword: 'arena', count: 7,
    } },
  ],
  'P-124': [{ kind: 'trash-to-hand', max: 1, energyColor: 'purple', cookieOnly: true }],
  'P-125': [{ kind: 'draw-up-to', max: 1 }],
  'P-128': [{
    kind: 'draw-up-to',
    max: 1,
    condition: { kind: 'cookies-fainted-this-turn-at-least', side: 'opponent', count: 1 },
  }],
  'P-129': [{
    kind: 'gain-hp', amount: 1,
    target: { side: 'self', min: 1, max: 1, sourceOnly: true, maxRemainingHp: 5 },
    condition: { kind: 'cookie-gained-hp-this-turn' },
  }],
  'P-131': [{
    kind: 'set-cookie-active',
    target: { side: 'self', min: 1, max: 1, sourceOnly: true },
    condition: { kind: 'support-color-count-at-least', color: 'green', count: 7 },
  }],
  'P-132': [{ kind: 'place-source-to-support', rested: true }],
  'P-133': [{
    kind: 'return-to-hand',
    target: { side: 'self', min: 0, max: 1, energyColor: 'blue', maxLevel: 1 },
  }],
  'P-135': [{ kind: 'deck-to-trash', amount: 2, side: 'self' }],
  'P-136': [{ kind: 'trash-to-hand', max: 1, energyColor: 'purple', cookieOnly: true, maxLevel: 3 }],
  'P-137': [{
    kind: 'modify-attack', amount: 1, duration: 'this-turn', target: self(),
    condition: { kind: 'cookies-fainted-this-turn-at-least', side: 'opponent', count: 1 },
  }],
  'P-138': [{
    kind: 'gain-hp', amount: 1, target: self(),
    condition: { kind: 'cookies-fainted-this-turn-at-least', side: 'opponent', count: 1 },
  }],
  'P-139': [{
    kind: 'gain-hp', amount: 1, target: { side: 'self', min: 1, max: 1, sourceOnly: true },
    condition: { kind: 'break-area-has-card', side: 'self', minLevel: 3 },
  }],
  'P-140': [{
    kind: 'gain-hp', amount: 1, target: { side: 'self', min: 0, max: 1, maxLevel: 3, maxRemainingHp: 5 },
  }],
  'P-141': [{
    kind: 'modify-attack', amount: 1, duration: 'this-turn', target: self(),
  }],
  'P-143': [
    { kind: 'return-to-hand', target: { side: 'self', min: 0, max: 1, maxLevel: 2 } },
    { kind: 'draw-up-to', max: 2 },
  ],
  'P-144': [{ kind: 'draw-up-to', max: 2 }],
  'P-145': [{ kind: 'deck-to-trash', amount: 3, side: 'self' }],
  'P-146': [{ kind: 'trash-to-battle', amount: 1, exactLevel: 1 }],
  'P-147': [{
    kind: 'opponent-discard-hand', count: 1,
    condition: { kind: 'opponent-hand-count-at-least', count: 4 },
  }],
}

export const P_EXACT_ATTACK_EFFECTS: Partial<Record<string, CardEffect[]>> = {
  'P-041': [{
    kind: 'modify-attack', amount: 1, duration: 'this-turn',
    target: { side: 'self', min: 1, max: 1, sourceOnly: true },
    condition: { kind: 'birthday' },
  }],
  'P-050': [{
    kind: 'optional-cost-attack',
    cost: { discardHand: 1 },
    sourceEnergy: { red: 1 },
    effects: [{ kind: 'damage', amount: 1, target: opponent() }],
    effectText: 'Use this Cookie as {R}, discard 1 card, and deal 1 damage to 1 of your opponent Cookies.',
  }],
  'P-053': [{
    kind: 'deck-to-support', amount: 1, rested: true,
    condition: { kind: 'opponent-cookie-fainted-in-current-battle' },
  }],
  'P-061': [
    { kind: 'trash-to-deck', min: 2, max: 2, nonCookieOnly: true },
    { kind: 'field-to-trash', target: { side: 'self', min: 1, max: 1, sourceOnly: true } },
  ],
  'P-064': [{
    kind: 'damage', amount: 1, target: { ...opponent(), maxLevel: 2 },
    condition: { kind: 'source-hp-at-most', amount: 1 },
  }],
  'P-068': [{
    kind: 'draw-up-to', max: 2, condition: { kind: 'hand-count-at-most', count: 5 },
  }],
  'P-073': [
    { kind: 'discard-hand', count: 1 },
    { kind: 'modify-attack', amount: 1, duration: 'this-turn', target: { ...self(), keyword: 'arena' } },
  ],
  'P-075': [{ kind: 'draw-up-to', max: 1, condition: { kind: 'trash-count-at-least', count: 15 } }],
  'P-079': [
    { kind: 'hp-to-trash', amount: 1, target: { ...self(), max: 1, excludeSource: true } },
    { kind: 'damage', amount: 1, target: opponent() },
  ],
  'P-094': [{
    kind: 'optional-cost-attack',
    cost: {},
    sourceEnergy: { yellow: 1 },
    effects: [{ kind: 'damage', amount: 1, target: opponent(), condition: { kind: 'break-level-at-most', level: 3 } }],
    effectText: 'Use this Cookie as {Y} to deal 1 damage if your break area is LV.3 or lower.',
  }],
  'P-101': [{
    kind: 'draw-up-to-then-discard', max: 2, discardCount: 1, handDestination: 'deck-top',
    condition: { kind: 'hand-count-at-most', count: 5 },
  }],
  'P-103': [{
    kind: 'modify-attack-cost',
    target: { side: 'self', min: 0, max: 1, excludeSource: true, keyword: 'arena' },
    energyCost: { red: 1 }, duration: 'this-turn',
  }],
  'P-104': [
    { kind: 'support-to-hand', amount: 1 },
    { kind: 'damage', amount: 1, target: opponent() },
  ],
  'P-105': [{
    kind: 'draw-up-to-then-discard', max: 2, discardCount: 1, handDestination: 'deck-top',
  }],
  'P-111': [
    { kind: 'hand-to-break', amount: 1, keyword: 'arena' },
    { kind: 'draw-up-to', max: 2 },
    { kind: 'damage', amount: 1, target: opponent() },
  ],
  'P-117': [
    { kind: 'field-to-deck-bottom', target: { side: 'self', min: 0, max: 1, excludeSource: true, energyColor: 'blue', maxLevel: 2, keyword: 'arena' } },
    { kind: 'gain-hp', amount: 1, target: { side: 'self', min: 1, max: 1, sourceOnly: true } },
  ],
  'P-120': [{ kind: 'trash-to-hand', max: 1, energyColor: 'purple', keyword: 'arena' }],
  'P-127': [
    { kind: 'hp-to-trash', amount: 2, target: { side: 'self', min: 1, max: 1, minLevel: 2 } },
    { kind: 'damage', amount: 2, target: opponent() },
  ],
  'P-129': [
    { kind: 'hp-to-trash', amount: 2, target: { side: 'self', min: 1, max: 1, sourceOnly: true } },
    { kind: 'damage', amount: 1, target: opponent() },
  ],
  'P-130': [{
    kind: 'damage', amount: 1, target: opponent(),
    condition: { kind: 'source-hp-at-least', amount: 3 },
  }],
  'P-134': [{
    kind: 'damage', amount: 1, target: opponent(),
    condition: { kind: 'hand-count-at-least', count: 7 },
  }],
  'P-135': [
    { kind: 'deck-to-trash', amount: 3, side: 'self' },
    { kind: 'draw', amount: 1 },
    { kind: 'discard-hand', count: 1 },
  ],
  'P-142': [{
    kind: 'gain-hp', amount: 1, target: { side: 'self', min: 0, max: 1, maxRemainingHp: 3 },
    condition: { kind: 'support-count-less-than-opponent', difference: 1 },
  }],
  'P-143': [
    { kind: 'discard-hand', count: 1 },
    { kind: 'damage', amount: 1, target: opponent() },
  ],
}

export const P_EXACT_FLIP_EFFECTS: Partial<
  Record<string, { effects: CardEffect[]; cost?: AbilityCost; attachedHpBonus?: number }>
> = {
  'P-040': { cost: { discardHand: 1 }, effects: [], attachedHpBonus: 1 },
  'P-047': { effects: [] },
  'P-063': { effects: [{ kind: 'draw-up-to', max: 1 }] },
  'P-077': { cost: { discardHand: 1 }, effects: [], attachedHpBonus: 1 },
  'P-081': { cost: { discardHand: 1 }, effects: [], attachedHpBonus: 1 },
  'P-085': { effects: [{ kind: 'draw-up-to', max: 1 }] },
  'P-092': { cost: { discardHand: 1 }, effects: [], attachedHpBonus: 1 },
  'P-099': { effects: [{ kind: 'draw-up-to', max: 1 }] },
  'P-100': { cost: { discardHand: 1 }, effects: [], attachedHpBonus: 1 },
  'P-107': { cost: { discardHand: 1 }, effects: [], attachedHpBonus: 1 },
  'P-112': { cost: { discardHand: 1 }, effects: [], attachedHpBonus: 1 },
  'P-113': { cost: { discardHand: 1 }, effects: [], attachedHpBonus: 1 },
  'P-118': { cost: { discardHand: 1 }, effects: [], attachedHpBonus: 1 },
  'P-151': { effects: [{ kind: 'draw-up-to', max: 1 }] },
  'P-152': { effects: [{ kind: 'draw-up-to', max: 1 }] },
  'P-153': { effects: [{ kind: 'draw-up-to', max: 1 }] },
  'P-154': { effects: [{ kind: 'draw-up-to', max: 1 }] },
  'P-155': { effects: [{ kind: 'draw-up-to', max: 1 }] },
  'P-156': { effects: [{ kind: 'draw-up-to', max: 1 }] },
  'P-157': { cost: { discardHand: 1 }, effects: [], attachedHpBonus: 1 },
  'P-158': { cost: { discardHand: 1 }, effects: [], attachedHpBonus: 1 },
  'P-159': { cost: { discardHand: 1 }, effects: [], attachedHpBonus: 1 },
  'P-160': { cost: { discardHand: 1 }, effects: [], attachedHpBonus: 1 },
  'P-161': { cost: { discardHand: 1 }, effects: [], attachedHpBonus: 1 },
  'P-162': { cost: { discardHand: 1 }, effects: [], attachedHpBonus: 1 },
}

export const P_EXACT_SKILL_COSTS: Partial<Record<string, AbilityCost>> = {
  'P-012': { energy: { green: 3 } },
  'P-084': { energy: { green: 1 } },
  'P-045': { energy: {}, discardHand: 1 },
  'P-046': { energy: { purple: 2 } },
  'P-050': { energy: {}, hpToTrash: { amount: 1, sourceOnly: true } },
  'P-051': { energy: { red: 1 } },
  'P-056': { energy: { red: 1 }, hpToTrash: { amount: 1, sourceOnly: true } },
  'P-058': { energy: {}, supportToTrash: 2 },
  'P-060': { energy: {}, discardHand: 2 },
  'P-070': { energy: {}, hpToTrash: { amount: 2, sourceOnly: true } },
  'P-071': { energy: { yellow: 1 }, handToBreakArea: { count: 1 } },
  'P-072': { energy: { green: 2 } },
  'P-074': { energy: {}, discardHand: 2, discardHandKeyword: 'arena' },
  'P-093': { energy: {}, discardHand: 0 },
  'P-095': { energy: {}, discardHand: 0 },
  'P-097': { energy: {}, discardHand: 1, discardHandType: 'cookie', discardHandHasFlip: true },
  'P-098': { energy: {}, discardHand: 0 },
  'P-103': { energy: { red: 1 } },
  'P-105': { energy: {}, discardHand: 1, discardHandKeyword: 'arena' },
  'P-106': { energy: {}, discardHand: 0 },
  'P-109': { energy: { yellow: 1 } },
  'P-110': { energy: {}, discardHand: 0 },
  'P-115': { energy: {}, selfToTrash: true },
  'P-119': { energy: {}, trashToDeck: { count: 5, keyword: 'arena', excludeFlip: true } },
  'P-121': { energy: {}, selfToTrash: true },
  'P-124': { energy: {}, discardHand: 1 },
  'P-125': { energy: { blue: 1 } },
  'P-131': { energy: {}, discardHand: 0 },
  'P-132': { energy: { green: 3 } },
  'P-133': { energy: {}, discardHand: 0 },
  'P-135': { energy: {}, hpToTrash: { amount: 2, sourceOnly: true } },
  'P-140': { energy: {}, discardHand: 1 },
  'P-141': { energy: {}, supportToHand: 1 },
  'P-143': { energy: { blue: 1 } },
  'P-144': { energy: { blue: 1 } },
  'P-145': { energy: { purple: 1 } },
  'P-146': { energy: { purple: 1 } },
  // P-147's black LV.1 Cookie payment belongs to Special Play, not On Play.
  'P-147': { energy: {}, discardHand: 0 },
}

export const P_EXACT_ITEM_ACTIVATION_COST_OVERRIDES: Partial<
  Record<
    string,
    {
      condition: 'friendly-cookie-fainted-this-turn'
      cost: AbilityCost
    }
  >
> = {
  // During this turn, if your Cookie fainted, this item's cost becomes {N}.
  'P-084': {
    condition: 'friendly-cookie-fainted-this-turn',
    cost: { energy: { neutral: 1 } },
  },
}

export const P_EXACT_SPECIAL_PLAY_COSTS: Partial<Record<string, AbilityCost>> = {
  'P-147': {
    energy: {},
    trashBattleCookie: { count: 1, energyColor: 'black', level: 1 },
  },
}

export const P_EXACT_SKILL_TRIGGERS: Partial<Record<string, 'activate' | 'on-play' | 'passive'>> = {
  'P-041': 'on-play',
  'P-042': 'activate',
  'P-050': 'activate',
  'P-051': 'activate',
  'P-052': 'passive',
  'P-054': 'on-play',
  'P-055': 'on-play',
  'P-056': 'activate',
  'P-057': 'on-play',
  'P-058': 'passive',
  'P-059': 'passive',
  'P-060': 'activate',
  'P-065': 'passive',
  'P-066': 'on-play',
  'P-067': 'passive',
  'P-069': 'on-play',
  'P-070': 'activate',
  'P-071': 'activate',
  'P-072': 'on-play',
  'P-074': 'activate',
  'P-080': 'passive',
  'P-083': 'passive',
  'P-086': 'passive',
  'P-093': 'activate',
  'P-095': 'activate',
  'P-096': 'on-play',
  'P-097': 'passive',
  'P-098': 'activate',
  'P-102': 'on-play',
  'P-103': 'on-play',
  'P-104': 'on-play',
  'P-105': 'activate',
  'P-106': 'activate',
  'P-108': 'passive',
  'P-109': 'activate',
  'P-110': 'activate',
  'P-114': 'on-play',
  'P-115': 'activate',
  'P-116': 'on-play',
  'P-119': 'activate',
  'P-120': 'on-play',
  'P-121': 'activate',
  'P-124': 'on-play',
  'P-128': 'activate',
  'P-129': 'activate',
  'P-131': 'activate',
  'P-132': 'activate',
  'P-133': 'activate',
  'P-136': 'passive',
  'P-137': 'activate',
  'P-138': 'on-play',
  'P-139': 'on-play',
  'P-140': 'activate',
  'P-141': 'activate',
  'P-143': 'on-play',
  'P-144': 'on-play',
  'P-145': 'passive',
  'P-146': 'on-play',
  'P-147': 'on-play',
}

export const P_SOURCE_ENERGY: Partial<Record<string, EnergyCost>> = {
  'P-050': { red: 1 },
  'P-094': { yellow: 1 },
}

export const P_FROM_TRASH = new Set(['P-069', 'P-146'])
export const P_FROM_SUPPORT = new Set(['P-104', 'P-114'])

export const P_ARENA_CARDS = new Set([
  'P-103', 'P-104', 'P-105', 'P-106', 'P-107', 'P-108', 'P-109', 'P-110',
  'P-111', 'P-112', 'P-113', 'P-114', 'P-115', 'P-116', 'P-117', 'P-118',
  'P-119', 'P-120', 'P-121',
])

export const P_NON_COOKIE_KEYWORD: CardKeyword = 'arena'
