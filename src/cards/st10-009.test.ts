import { describe, expect, it } from 'vitest'
import candidateDocument from '../../data/candidates/st6-st10/official-st10.en.json'
import { getCardPoolEntry } from '../game/card-pool'
import type { CookieCard } from '../game/types'
import { analyzeOfficialCardBehavior } from './contracts/ledger'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'

const raw = (getCardPoolEntry('ST10-009') ??
  (candidateDocument.cards as OfficialCardRecord[]).find(card => card.cardNumber === 'ST10-009'))
if (!raw) throw new Error('Missing original ST10-009 printing')

const converted = (): CookieCard => {
  const result = convertOfficialCardToGameCard(raw, 'st10-009-contract')
  if (result.status !== 'converted' || result.gameCard?.type !== 'cookie') {
    throw new Error('Space Doughnut must convert to Cookie')
  }
  return result.gameCard
}

const mutations = [
  ['trigger changed', (card: CookieCard) => card.skill
    ? { ...card, skill: { ...card.skill, trigger: 'activate' as const } }
    : card],
  ['turn restriction added', (card: CookieCard) => card.skill
    ? { ...card, skill: { ...card.skill, yourTurn: true } }
    : card],
  ['draw maximum increased', (card: CookieCard) => card.skill
    ? { ...card, skill: { ...card.skill, effects: card.skill.effects.map(effect =>
        effect.kind === 'draw-up-to' ? { ...effect, max: 2 } : effect,
      ) } }
    : card],
  ['hand cost added', (card: CookieCard) => card.skill
    ? { ...card, skill: { ...card.skill, cost: { ...card.skill.cost, discardHand: 1 } } }
    : card],
  ['draw condition added', (card: CookieCard) => card.skill
    ? { ...card, skill: { ...card.skill, effects: card.skill.effects.map(effect =>
        effect.kind === 'draw-up-to'
          ? { ...effect, condition: { kind: 'hand-count-at-most' as const, count: 5 } }
          : effect,
      ) } }
    : card],
  ['skill removed', (card: CookieCard) => ({ ...card, skill: undefined })],
  ['printed attack changed', (card: CookieCard) => ({ ...card, attack: 2 })],
  ['faint trigger added', (card: CookieCard) => card.skill
    ? { ...card, skill: { ...card.skill, faint: true } }
    : card],
  ['end-phase trigger added', (card: CookieCard) => card.skill
    ? { ...card, skill: { ...card.skill, endPhase: true } }
    : card],
  ['after-damage trigger added', (card: CookieCard) => card.skill
    ? { ...card, skill: { ...card.skill, afterDamage: true } }
    : card],
  ['break-area source enabled', (card: CookieCard) => card.skill
    ? { ...card, skill: { ...card.skill, fromBreakArea: true } }
    : card],
  ['break-area On Play enabled', (card: CookieCard) => card.skill
    ? { ...card, skill: { ...card.skill, onPlayFromBreakArea: true } }
    : card],
  ['trash-area source enabled', (card: CookieCard) => card.skill
    ? { ...card, skill: { ...card.skill, fromTrashArea: true } }
    : card],
  ['support-area source enabled', (card: CookieCard) => card.skill
    ? { ...card, skill: { ...card.skill, fromSupportArea: true } }
    : card],
] as const

const exactContractBlocker =
  'ST10-009 requires the original purple LV1 HP1 PP ordinary-one body and a free unrestricted departure draw-up-to-one skill'

describe('ST10-009 original Space Doughnut printing', () => {
  it('preserves its printed body and unrestricted direct battle-to-trash draw trigger', () => {
    const card = converted()
    expect([
      card.id,
      card.name,
      card.type,
      card.cardColor ?? card.energyColor,
      card.energyColor,
      card.level,
      card.hp,
      card.attack,
      card.attackCost,
      card.attackEnergyCost,
    ]).toEqual([
      'ST10-009', 'Space Doughnut', 'cookie', 'purple', 'purple', 1, 1, 1, 2, { purple: 2 },
    ])
    expect(raw.imageUrl).toMatch(/^https:\/\/cookierunbraverse\.com\//)
    expect(raw.skill.text).toBe(
      'When this Cookie is placed from your battle area into your trash, draw up to 1 card from your deck.',
    )
    expect(card.skill).toMatchObject({
      trigger: 'departure',
      effects: [{ kind: 'draw-up-to', max: 1 }],
    })
    expect(card.skill?.yourTurn).toBe(false)
    expect(card.effects).toEqual(card.skill?.effects)
    expect(card.flip).toBeUndefined()
    expect(card.attackEffects ?? []).toEqual([])
    expect(analyzeOfficialCardBehavior(raw, card).contract.status).toBe('verified')
  })

  it.each(mutations)('strict contract rejects a runtime mutation: %s', (_label, mutate) => {
    const audit = analyzeOfficialCardBehavior(raw, mutate(converted()))
    expect(audit.contract.status).toBe('needs-review')
    expect(audit.errors).toContain(exactContractBlocker)
  })
})
