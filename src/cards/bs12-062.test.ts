import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const record = candidate.cards.find(card => card.cardNumber === 'BS12-062') as OfficialCardRecord
it('062 separates the B Once Per Turn Equip from the host attack draw trigger and records HP-trash/no-replacement lifecycle', () => {
  const before = structuredClone(record)
  const conversion = convertOfficialCardToGameCard(record)
  expect(conversion.status).toBe('converted')
  if (conversion.status !== 'converted' || conversion.gameCard.type !== 'cookie') throw new Error('Missing Angel Lightstick')
  const card = conversion.gameCard
  expect(card).toMatchObject({ id: 'BS12-062', name: 'Angel Lightstick', level: 1, hp: 3, cardColor: 'blue', energyColor: 'blue',
    attack: 1, attackCost: 2, attackEnergyCost: { blue: 1, neutral: 1 }, keywords: ['arena'],
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/4EgvUXyfl0G8aTBKhoA5nw.webp',
    skill: { trigger: 'activate', oncePerTurn: true, yourTurn: false, restSource: false, cost: { energy: { blue: 1 }, discardHand: 0 },
      effects: [{ kind: 'equip-source', sourceZone: 'battle', target: { side: 'self', min: 1, max: 1, cardName: 'Popping Candy Cookie' } }],
      equippedAttackTrigger: { hostCardName: 'Popping Candy Cookie', effects: [{ kind: 'draw-up-to', max: 2, condition: { kind: 'hand-count-at-most', count: 5 } }] },
    } })
  expect(card.attackEffects ?? []).toEqual([])
  expect(card.flip).toBeUndefined()
  expect(card.skill?.effects).toHaveLength(1)
  const equip = card.skill?.effects[0]
  if (equip?.kind !== 'equip-source') throw new Error('Missing necessary Equip')
  expect(equip.battleSourceDisposition).toEqual({ hp: 'trash', replacement: 'none' })
  const audit = analyzeOfficialCardBehavior(record)
  expect(audit.contract.status).toBe('verified')
  expect(audit.errors).toEqual([])
  expect(audit.errors).not.toContain('BS12-062 lacks B Once Per Turn named-host Equip or the hand-at-most-five attack-declaration draw up to two')
  expect(record).toEqual(before)
})

it.each(['missing-trigger', 'wrong-host', 'six-threshold', 'three-draw', 'hand-cap', 'no-cost', 'no-once', 'rest', 'wrong-equip-host'] as const)('contract catches an incorrect confirmed branch: %s', mutation => {
  const conversion = convertOfficialCardToGameCard(record)
  if (conversion.status !== 'converted' || conversion.gameCard.type !== 'cookie' || !conversion.gameCard.skill) throw new Error('Missing source')
  const card = structuredClone(conversion.gameCard)
  const skill = card.skill!
  const draw = skill.equippedAttackTrigger!.effects[0]
  if (mutation === 'missing-trigger') delete skill.equippedAttackTrigger
  if (mutation === 'wrong-host') skill.equippedAttackTrigger!.hostCardName = 'CAKE POPs'
  if (draw.kind !== 'draw-up-to') throw new Error('Missing draw')
  if (mutation === 'six-threshold') draw.condition = { kind: 'hand-count-at-most', count: 6 }
  if (mutation === 'three-draw') draw.max = 3
  if (mutation === 'hand-cap') draw.untilHandSize = 5
  if (mutation === 'no-cost') skill.cost = { energy: {} }
  if (mutation === 'no-once') skill.oncePerTurn = false
  if (mutation === 'rest') skill.restSource = true
  if (mutation === 'wrong-equip-host' && skill.effects[0].kind === 'equip-source') skill.effects[0].target!.cardName = 'CAKE POPs'
  expect(analyzeOfficialCardBehavior(record, card).errors).toContain('BS12-062 lacks B Once Per Turn named-host Equip or the hand-at-most-five attack-declaration draw up to two')
})
