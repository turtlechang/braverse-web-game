import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'
import type { OfficialCardRecord } from './types'

// Complete physical print, read independently before adapter inspection.
const record = candidate.cards.find(c => c.cardNumber === 'BS12-077') as OfficialCardRecord
it('077 preserves P Once Per Turn named-host Equip and battle-only Blocker prevention without ruling its lifecycle', () => {
  const before = structuredClone(record)
  const result = convertOfficialCardToGameCard(record)
  expect(result.status).toBe('converted')
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') throw new Error('Missing Spotlight Fan')
  const card = result.gameCard
  expect(card).toMatchObject({ name: 'Spotlight Fan', energyColor: 'purple', level: 1, hp: 3, keywords: ['arena'],
    attack: 1, attackEnergyCost: { purple: 1, neutral: 1 },
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/oT6ANWGKyX4iLRwsLiHD6g.webp',
    skill: { trigger: 'activate', oncePerTurn: true, restSource: false, yourTurn: false, cost: { energy: { purple: 1 } },
      equippedAttackBlockerPrevention: { hostCardName: 'Rockstar Cookie' },
      effects: [{ kind: 'equip-source', sourceZone: 'battle', target: { side: 'self', min: 1, max: 1, cardName: 'Rockstar Cookie' } }],
    } })
  expect(card.attackEffects ?? []).toEqual([])
  expect(card.flip).toBeUndefined()
  expect(card.skill?.equippedAttackDisablesFlip).toBeUndefined()
  const equip = card.skill?.effects[0]
  if (equip?.kind !== 'equip-source') throw new Error('Missing Equip')
  expect(equip.battleSourceDisposition).toEqual({ hp: 'trash', replacement: 'none' })
  const audit = analyzeOfficialCardBehavior(record, card)
  expect(audit.contract.status).toBe('verified')
  expect(audit.errors).toEqual([])
  expect(audit.errors).not.toContain('BS12-077 lacks P Once Per Turn Rockstar Equip, named-host battle Blocker prevention or PN ordinary one')
  expect(record).toEqual(before)
})
it.each(['host', 'no-prevention', 'flip', 'draw', 'once', 'rest', 'cost', 'target-zero', 'ordinary', 'missing-disposition'] as const)('077 rejects changed printed behavior: %s', mutation => {
  const result = convertOfficialCardToGameCard(record)
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie' || !result.gameCard.skill) throw new Error('Missing Spotlight Fan')
  const card = structuredClone(result.gameCard)
  const skill = card.skill!
  const equip = skill.effects[0]
  if (equip.kind !== 'equip-source') throw new Error('Missing Equip')
  if (mutation === 'host') equip.target.cardName = 'Gnome Band'
  if (mutation === 'no-prevention') delete skill.equippedAttackBlockerPrevention
  if (mutation === 'flip') skill.equippedAttackDisablesFlip = true
  if (mutation === 'draw') skill.equippedAttackTrigger = { hostCardName: 'Rockstar Cookie', effects: [{ kind: 'draw-up-to', max: 1 }] }
  if (mutation === 'once') skill.oncePerTurn = false
  if (mutation === 'rest') skill.restSource = true
  if (mutation === 'cost') skill.cost.energy = { neutral: 1 }
  if (mutation === 'target-zero') equip.target.min = 0
  if (mutation === 'ordinary') card.attack = 2
  if (mutation === 'missing-disposition') delete equip.battleSourceDisposition
  expect(analyzeOfficialCardBehavior(record, card).errors).toContain('BS12-077 lacks P Once Per Turn Rockstar Equip, named-host battle Blocker prevention or PN ordinary one')
})
