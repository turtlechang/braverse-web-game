import type { CardSkill } from '../../game'

const effectTokenLabels: Record<string, string> = {
  mob: 'Activate 啟動',
  ap: 'OnPlay 登場',
  t1: 'Once per turn 一回合一次',
  mt: 'Your Turn 自己的回合',
  bl: 'Blocker 阻擋者',
  da: 'Damage',
  sk: '',
}

export const getSkillCostTotal = (skill: CardSkill) =>
  Object.values(skill.cost.energy).reduce(
    (total, amount) => total + (amount ?? 0),
    0,
  )

export const getCardEffectTokenLabel = (token: string) =>
  effectTokenLabels[token]
