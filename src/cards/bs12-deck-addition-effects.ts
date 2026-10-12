import type { CardEffect, TrapAbility } from '../game/types'
import type { OfficialCardRecord } from './types'

/** Exact mappings transcribed from the official printed cards on 2026-10-08. */
export const DECK_ADDITION_EFFECTS: Partial<Record<string, CardEffect[]>> = {
  'P-163': [{ kind: 'modify-attack', amount: 1, duration: 'this-turn',
    target: { side: 'self', min: 0, max: 1, keyword: 'arena', excludeSource: true },
    thenEffects: [{ kind: 'set-cookie-active',
      target: { side: 'self', min: 0, max: 1, keyword: 'arena', excludeSource: true, previousEffectTargetOnly: true } }],
  }],
  'ST10-002': [{ kind: 'trash-to-battle', amount: 1, optional: true, energyColor: 'purple', maxLevel: 2 }],
  'ST10-008': [{ kind: 'damage-all', amount: 1, side: 'opponent', sequential: true,
    target: { side: 'opponent', min: 1, max: 2 }, condition: { kind: 'trash-count-at-least', count: 15 } }],
  'ST10-013': [{ kind: 'opponent-battle-to-trash', min: 0, maxLevel: 2 }],
  'P-175': [
    { kind: 'draw', amount: 1, condition: { kind: 'source-set-active-by-effect-this-turn' } },
    { kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 },
      condition: { kind: 'source-set-active-by-effect-this-turn' } },
  ],
  'P-176': [{ kind: 'break-to-trash', max: 1, exactLevel: 1,
    condition: { kind: 'break-area-card-count-at-least', side: 'self', count: 4, keyword: 'arena' } }],
}

export const getDeckAdditionAttackEffects = (card: OfficialCardRecord): CardEffect[] | undefined => {
  switch (card.baseCardNumber) {
    case 'ST10-002': return [{ kind: 'optional-cost-attack',
      cost: { energy: {}, trashBattleCookie: { count: 1, energyColor: 'purple', maxLevel: 2 } },
      effectText: card.attackText ?? '',
      effects: [{ kind: 'draw-up-to-then-discard', max: 2, discardCount: 1 }],
    }]
    case 'ST10-008': return [{ kind: 'optional-cost-attack',
      cost: { energy: {}, trashBattleCookie: { count: 1, energyColor: 'purple', level: 1 } },
      effectText: card.attackText ?? '',
      effects: [{ kind: 'damage', amount: 1, target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true } }],
    }]
    case 'P-175': return [{ kind: 'damage', amount: 1,
      target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
      condition: { kind: 'battle-area-has-keyword', side: 'self', keyword: 'arena', excludeSource: true, restedOnly: true },
    }]
    case 'P-176': return [{ kind: 'gain-hp', amount: 1,
      target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      condition: { kind: 'break-level-at-least', level: 4 },
    }]
    default: return undefined
  }
}

export const getDeckAdditionTrap = (card: OfficialCardRecord): TrapAbility | undefined => {
  if (!['ST8-018', 'ST10-019'].includes(card.baseCardNumber)) return undefined
  return {
    text: card.skill.text ?? '',
    cost: { energy: card.baseCardNumber === 'ST8-018' ? { green: 1 } : { purple: 1 }, discardHand: 0 },
    effects: [
      { kind: 'modify-attack', amount: -1, duration: 'this-turn', target: { side: 'opponent', min: 0, max: 1 },
        thenEffects: [{ kind: 'modify-attack', amount: -1, duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 1, previousEffectTargetOnly: true },
        condition: card.baseCardNumber === 'ST8-018'
          ? { kind: 'support-count-at-least', count: 5 }
          : { kind: 'trash-count-at-least', count: 20 },
        }],
      },
    ],
  }
}
