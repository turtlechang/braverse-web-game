import type { CardSkill } from '../../game'

export const getSkillCostTotal = (skill: CardSkill) =>
  Object.values(skill.cost).reduce(
    (total, amount) => total + (amount ?? 0),
    0,
  )
