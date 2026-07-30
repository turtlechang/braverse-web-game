import type { CardSkill } from '../../game'

const effectTokenLabels: Record<string, string> = {
  eq: 'Equip',
  mob: 'Activate 啟動',
  ap: 'OnPlay 登場',
  t1: 'Once per turn 一回合一次',
  mt: 'Your Turn 自己的回合',
  bl: 'Blocker 阻擋者',
  da: 'Damage',
  sk: 'Skill',
}

const effectTokenAliases: Record<string, string> = {
  eq: 'eq',
  mou: 'eq',
  equip: 'eq',
  mob: 'mob',
  activate: 'mob',
  ap: 'ap',
  'on play': 'ap',
  t1: 't1',
  'once per turn': 't1',
  mt: 'mt',
  'your turn': 'mt',
  bl: 'bl',
  blocker: 'bl',
  skill: 'sk',
}

export interface CardEffectTokenVisual {
  imageUrl: string
  alt: string
}

const effectTokenVisuals: Record<string, CardEffectTokenVisual> = {
  eq: { imageUrl: '/card-tags/equip.webp', alt: 'Equip' },
  ap: { imageUrl: '/card-tags/on-play.webp', alt: 'On play' },
  mt: { imageUrl: '/card-tags/your-turn.webp', alt: 'Your Turn' },
  t1: { imageUrl: '/card-tags/once-per-turn.webp', alt: 'Once Per Turn' },
  mob: { imageUrl: '/card-tags/activate.webp', alt: 'Activate' },
  bl: { imageUrl: '/card-tags/blocker.webp', alt: 'Blocker' },
  da: { imageUrl: '/card-tags/damage.webp', alt: 'Damage' },
  sk: { imageUrl: '/card-tags/skill.webp', alt: 'Skill' },
}

export const normalizeCardEffectToken = (token: string) => {
  const trimmed = token.trim()
  const officialTag = trimmed.match(/^【(.+)】$/)
  const normalized = (officialTag?.[1] ?? trimmed).toLowerCase()
  return effectTokenAliases[normalized] ?? normalized
}

export const getSkillCostTotal = (skill: CardSkill) =>
  Object.values(skill.cost.energy ?? skill.cost).reduce(
    (total, amount) => total + (amount ?? 0),
    0,
  )

export const getCardEffectTokenLabel = (token: string) =>
  effectTokenLabels[normalizeCardEffectToken(token)]

export const getCardEffectTokenVisual = (token: string) =>
  effectTokenVisuals[normalizeCardEffectToken(token)]
