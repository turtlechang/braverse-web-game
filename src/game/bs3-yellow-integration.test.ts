import { describe, expect, it } from 'vitest'
import officialBS3Inventory from '../../data/cards/official-age-of-heroes-and-kingdoms-bs3.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import {
  convertOfficialCookieSkill,
  convertOfficialAttackEffects,
  convertOfficialFlipAbility,
  convertOfficialItemAbility,
  convertOfficialTrapAbility,
  convertOfficialStageAbility,
} from '../cards/official-effect-adapter'
import type { OfficialCardRecord } from '../cards/types'

const findBs3Card = (cardNumber: string) => {
  const card = (officialBS3Inventory.cards as OfficialCardRecord[]).find(
    (candidate) => candidate.cardNumber === cardNumber,
  )
  if (!card) throw new Error(`Missing BS3 inventory card ${cardNumber}`)
  return card
}

const asGameCard = (cardNumber: string) => {
  const conversion = convertOfficialCardToGameCard(findBs3Card(cardNumber))
  if (conversion.status !== 'converted') {
    throw new Error(`${cardNumber} should convert to a GameCard.`)
  }
  return conversion.gameCard
}

// =====================================
// BS3-025 Golden Cheese Cookie - break-to-battle
// =====================================
describe('BS3-025 Golden Cheese Cookie', () => {
  it('converts to activate skill with break-source-to-battle', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-025'))
    expect(skill).toBeTruthy()
    expect(skill!.oncePerGame).toBe(true)
    expect(skill!.fromBreakArea).toBe(true)
    expect(skill!.yourTurn).toBe(true)
    expect(skill!.effects[0]).toMatchObject({
      kind: 'break-source-to-battle',
      hpCount: 1,
    })
  })

  it('has valid game card conversion', () => {
    const card = asGameCard('BS3-025')
    expect(card.type).toBe('cookie')
    expect(card).toHaveProperty('skill')
  })
})

// =====================================
// BS3-026 Linzer Cookie - view-hp
// =====================================
describe('BS3-026 Linzer Cookie', () => {
  it('converts to on-play skill with view-hp', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-026'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('on-play')
    expect(skill!.effects[0]).toMatchObject({
      kind: 'view-hp',
      target: { side: 'self', min: 0, max: 1 },
      optional: true,
    })
  })
})

// =====================================
// BS3-027 Marzipan Cookie - flip draw-up-to
// =====================================
describe('BS3-027 Marzipan Cookie', () => {
  it('converts to flip ability with draw-up-to', () => {
    const flip = convertOfficialFlipAbility(findBs3Card('BS3-027'))
    expect(flip).toBeTruthy()
    expect(flip!.effects[0]).toMatchObject({ kind: 'draw-up-to', max: 1 })
  })

  it('has no cookie skill', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-027'))
    expect(skill).toBeUndefined()
  })
})

// =====================================
// BS3-028 Mozzarella Cookie - opponent-trash-to-break
// =====================================
describe('BS3-028 Mozzarella Cookie', () => {
  it('converts to on-play skill with opponent-trash-to-break', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-028'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('on-play')
    expect(skill!.cost.discardHand).toBe(1)
    expect(skill!.effects[0]).toMatchObject({
      kind: 'opponent-trash-to-break',
      condition: { kind: 'opponent-break-level-at-most', level: 6 },
    })
  })

  it('has attack effect with gain-hp', () => {
    const attackEffects = convertOfficialAttackEffects(findBs3Card('BS3-028'))
    expect(attackEffects).toBeTruthy()
    expect(attackEffects![0]).toMatchObject({
      kind: 'gain-hp',
      condition: { kind: 'source-hp-less-than', amount: 6 },
    })
  })
})

// =====================================
// BS3-029 Burnt Cheese Cookie - hand-to-battle (faint)
// =====================================
describe('BS3-029 Burnt Cheese Cookie', () => {
  it('converts to faint skill with hand-to-battle', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-029'))
    expect(skill).toBeTruthy()
    expect(skill!.faint).toBe(true)
    expect(skill!.effects[0]).toMatchObject({
      kind: 'hand-to-battle',
      amount: 1,
      energyColor: 'yellow',
      energyCost: { yellow: 1 },
      optional: true,
      gainHp: 1,
    })
  })
})

// =====================================
// BS3-030 Black Raisin Cookie - hand-to-hp
// =====================================
describe('BS3-030 Black Raisin Cookie', () => {
  it('converts to on-play skill with hand-to-hp', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-030'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('on-play')
    expect(skill!.effects[0]).toMatchObject({
      kind: 'hand-to-hp',
      target: { side: 'self', sourceOnly: true },
      optional: true,
    })
  })
})

// =====================================
// BS3-031 Pancake Cookie - transfer-hp
// =====================================
describe('BS3-031 Pancake Cookie', () => {
  it('converts to on-play skill with transfer-hp', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-031'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('on-play')
    expect(skill!.effects[0]).toMatchObject({
      kind: 'transfer-hp',
      amount: 1,
      direction: 'to-source',
      target: { side: 'self', excludeSource: true },
    })
  })
})

// =====================================
// BS3-032 Smoked Cheese Cookie - optional-cost-attack + break-to-battle
// =====================================
describe('BS3-032 Smoked Cheese Cookie', () => {
  it('has optional-cost-attack with break-to-battle', () => {
    const attackEffects = convertOfficialAttackEffects(findBs3Card('BS3-032'))
    expect(attackEffects).toBeTruthy()
    expect(attackEffects![0]).toMatchObject({
      kind: 'optional-cost-attack',
      cost: { energy: { yellow: 1 } },
    })
  })
})

// =====================================
// BS3-033 Stardust Cookie - optional-cost-attack + opponent-battle-to-trash
// =====================================
describe('BS3-033 Stardust Cookie', () => {
  it('has optional-cost-attack with opponent-battle-to-trash', () => {
    const attackEffects = convertOfficialAttackEffects(findBs3Card('BS3-033'))
    expect(attackEffects).toBeTruthy()
    expect(attackEffects![0]).toMatchObject({
      kind: 'optional-cost-attack',
      cost: { energy: { yellow: 1 } },
    })
  })
})

// =====================================
// BS3-034 Sparkling Cookie - no effects
// =====================================
describe('BS3-034 Sparkling Cookie', () => {
  it('has no skill and no effects', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-034'))
    expect(skill).toBeUndefined()
    const conversion = convertOfficialCardToGameCard(findBs3Card('BS3-034'))
    expect(conversion.status).toBe('converted')
  })
})

// =====================================
// BS3-035 High Priest Cheesenbird - flip gain-hp
// =====================================
describe('BS3-035 High Priest Cheesenbird', () => {
  it('converts to flip ability with gain-hp', () => {
    const flip = convertOfficialFlipAbility(findBs3Card('BS3-035'))
    expect(flip).toBeTruthy()
    expect(flip!.effects[0]).toMatchObject({ kind: 'gain-hp', amount: 1 })
  })
})

// =====================================
// BS3-036 Olive Cookie - battle-to-break + draw
// =====================================
describe('BS3-036 Olive Cookie', () => {
  it('converts to on-play skill with battle-to-break + draw-up-to', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-036'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('on-play')
    expect(skill!.effects).toHaveLength(2)
    expect(skill!.effects[0]).toMatchObject({ kind: 'battle-to-break' })
    expect(skill!.effects[1]).toMatchObject({ kind: 'draw-up-to', max: 2 })
  })
})

// =====================================
// BS3-037 Angel Cookie - optional-cost-attack + gain-hp
// =====================================
describe('BS3-037 Angel Cookie', () => {
  it('has optional-cost-attack with gain-hp', () => {
    const attackEffects = convertOfficialAttackEffects(findBs3Card('BS3-037'))
    expect(attackEffects).toBeTruthy()
    expect(attackEffects![0]).toMatchObject({
      kind: 'optional-cost-attack',
      cost: { energy: { yellow: 1 } },
    })
  })
})

// =====================================
// BS3-038 Cocoa Cookie - hand-to-break + break-to-hand
// =====================================
describe('BS3-038 Cocoa Cookie', () => {
  it('converts to on-play skill with hand-to-break + break-to-hand', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-038'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('on-play')
    expect(skill!.effects).toHaveLength(2)
    expect(skill!.effects[0]).toMatchObject({
      kind: 'hand-to-break',
      amount: 1,
      minLevel: 2,
    })
    expect(skill!.effects[1]).toMatchObject({
      kind: 'break-to-hand',
      amount: 1,
      energyColor: 'yellow',
      maxLevel: 2,
      optional: true,
    })
  })
})

// =====================================
// BS3-039 Creme Brulee Cookie - no effects
// =====================================
describe('BS3-039 Creme Brulee Cookie', () => {
  it('has no skill and no effects', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-039'))
    expect(skill).toBeUndefined()
  })
})

// =====================================
// BS3-040 Adventurer Cookie - battle-to-break (either side)
// =====================================
describe('BS3-040 Adventurer Cookie', () => {
  it('converts to on-play skill with battle-to-break targeting either side', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-040'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('on-play')
    expect(skill!.effects[0]).toMatchObject({
      kind: 'battle-to-break',
      target: { side: 'either', maxLevel: 1 },
    })
  })
})

// =====================================
// BS3-041 Fettuccine Cookie - battle-to-break (self, after attack)
// =====================================
describe('BS3-041 Fettuccine Cookie', () => {
  it('has attack effect with battle-to-break self', () => {
    const attackEffects = convertOfficialAttackEffects(findBs3Card('BS3-041'))
    expect(attackEffects).toBeTruthy()
    expect(attackEffects![0]).toMatchObject({
      kind: 'battle-to-break',
      target: { side: 'self', sourceOnly: true },
    })
  })
})

// =====================================
// BS3-042 Golden Cheese Guardian Golem (item)
// =====================================
describe('BS3-042 Golden Cheese Guardian Golem', () => {
  it('converts to item ability with battle-to-break + damage', () => {
    const itemAbility = convertOfficialItemAbility(findBs3Card('BS3-042'))
    expect(itemAbility).toBeTruthy()
    expect(itemAbility!.effects).toHaveLength(2)
    expect(itemAbility!.effects[0]).toMatchObject({ kind: 'battle-to-break' })
    expect(itemAbility!.effects[1]).toMatchObject({
      kind: 'damage',
      amount: 2,
      target: { side: 'opponent' },
    })
  })
})

// =====================================
// BS3-043 Soul Jam: Light of Abundance (item)
// =====================================
describe('BS3-043 Soul Jam: Light of Abundance', () => {
  it('converts to item ability with damage-all + equip-source', () => {
    const itemAbility = convertOfficialItemAbility(findBs3Card('BS3-043'))
    expect(itemAbility).toBeTruthy()
    expect(itemAbility!.effects).toHaveLength(2)
    expect(itemAbility!.effects[0]).toMatchObject({ kind: 'damage-all', amount: 1 })
    expect(itemAbility!.effects[1]).toMatchObject({
      kind: 'equip-source',
      requiredCookieId: 'BS3-025',
      gainHp: 2,
    })
  })
})

// =====================================
// BS3-044 Cheesepad Tablet (item)
// =====================================
describe('BS3-044 Cheesepad Tablet', () => {
  it('converts to item ability with the LV.2+ hand-to-break cost effect followed by break-to-hand', () => {
    const itemAbility = convertOfficialItemAbility(findBs3Card('BS3-044'))
    expect(itemAbility).toBeTruthy()
    expect(itemAbility!.effects).toHaveLength(2)
    expect(itemAbility!.effects[0]).toMatchObject({
      kind: 'hand-to-break',
      amount: 1,
      minLevel: 2,
    })
    expect(itemAbility!.effects[1]).toMatchObject({
      kind: 'break-to-hand',
      amount: 1,
      energyColor: 'yellow',
      maxLevel: 2,
      optional: true,
    })
  })
})

// =====================================
// BS3-045 Golden Monarch\'s Counterattack (trap)
// =====================================
describe("BS3-045 Golden Monarch's Counterattack", () => {
  it('converts to trap with damage-by-break-count', () => {
    const trap = convertOfficialTrapAbility(findBs3Card('BS3-045'))
    expect(trap).toBeTruthy()
    expect(trap!.effects[0]).toMatchObject({
      kind: 'damage-by-break-count',
      perCount: 1,
      exactBreakLevel: 3,
    })
  })
})

// =====================================
// BS3-046 Golden Cheese Colosseum (trap)
// =====================================
describe('BS3-046 Golden Cheese Colosseum', () => {
  it('converts to trap with break-to-battle and fainted condition', () => {
    const trap = convertOfficialTrapAbility(findBs3Card('BS3-046'))
    expect(trap).toBeTruthy()
    expect(trap!.condition).toMatchObject({
      kind: 'friendly-color-fainted-this-battle',
      color: 'yellow',
      minLevel: 2,
    })
    expect(trap!.effects[0]).toMatchObject({
      kind: 'break-to-battle',
      amount: 1,
      exactLevel: 1,
      energyColor: 'yellow',
    })
  })
})

// =====================================
// BS3-047 Kingdom of Eternal Abundance (stage)
// =====================================
describe('BS3-047 Kingdom of Eternal Abundance', () => {
  it('converts to stage with hand-to-break-by-level-sum + break-to-battle', () => {
    const stage = convertOfficialStageAbility(findBs3Card('BS3-047'))
    expect(stage).toBeTruthy()
    expect(stage!.effects).toHaveLength(2)
    expect(stage!.effects[0]).toMatchObject({
      kind: 'hand-to-break-by-level-sum',
      targetSum: 3,
      energyColor: 'yellow',
    })
    expect(stage!.effects[1]).toMatchObject({
      kind: 'break-to-battle',
      amount: 1,
      exactLevel: 3,
      energyColor: 'yellow',
    })
  })
})

// =====================================
// BS3-048 Golden City's Control Chamber (stage)
// =====================================
describe("BS3-048 Golden City's Control Chamber", () => {
  it('converts to stage with modify-attack-by-break-count', () => {
    const stage = convertOfficialStageAbility(findBs3Card('BS3-048'))
    expect(stage).toBeTruthy()
    expect(stage!.effects[0]).toMatchObject({
      kind: 'modify-attack-by-break-count',
      perCount: 1,
      exactBreakLevel: 3,
      breakEnergyColor: 'yellow',
    })
  })
})

// =====================================
// 完整轉換驗證 - BS3-025~048
// =====================================
describe('BS3-025~048 完整轉換驗證', () => {
  const bs3Cards = [
    'BS3-025', 'BS3-026', 'BS3-027', 'BS3-028', 'BS3-029',
    'BS3-030', 'BS3-031', 'BS3-032', 'BS3-033', 'BS3-034',
    'BS3-035', 'BS3-036', 'BS3-037', 'BS3-038', 'BS3-039',
    'BS3-040', 'BS3-041', 'BS3-042', 'BS3-043', 'BS3-044',
    'BS3-045', 'BS3-046', 'BS3-047', 'BS3-048',
  ]

  bs3Cards.forEach((cardNumber) => {
    it(`${cardNumber} has valid conversion`, () => {
      const card = findBs3Card(cardNumber)
      expect(card.color).toBe('YELLOW')

      const conversion = convertOfficialCardToGameCard(card)
      expect(conversion.status).toBe('converted')
    })
  })
})
