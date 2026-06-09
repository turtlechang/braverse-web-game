import type { CardEffect, CardSkill } from '../../game'

export const getSkillLabels = (skill: CardSkill) => [
  skill.trigger === 'activate'
    ? 'Activate 啟動'
    : skill.trigger === 'on-play'
      ? 'OnPlay 登場'
      : 'Skill 技能',
  ...(skill.oncePerTurn ? ['Once per turn 一回合一次'] : []),
  ...(skill.yourTurn ? ['Your Turn 自己的回合'] : []),
]

export const describeEffect = (effect: CardEffect) => {
  if (effect.kind === 'draw') {
    return `從牌庫抽 ${effect.amount} 張牌。`
  }

  if (effect.kind === 'deck-to-support') {
    return `從牌庫頂取 ${effect.amount} 張卡，直立放入支援區。`
  }

  if (effect.kind === 'break-to-trash') {
    return `從休息區選擇最多 ${effect.max} 張 LV.${effect.exactLevel} 卡，移至棄牌區。`
  }

  const target =
    effect.target.side === 'self' ? '我方餅乾' : '對手餅乾'
  const count =
    effect.target.min === effect.target.max
      ? `${effect.target.max} 個`
      : `最多 ${effect.target.max} 個`

  if (effect.kind === 'damage') {
    return `選擇${count}${target}，造成 ${effect.amount} 點效果傷害。`
  }

  const value = effect.amount > 0 ? `+${effect.amount}` : effect.amount
  return effect.kind === 'modify-attack'
    ? `選擇${count}${target}，攻擊傷害 ${value}。`
    : `選擇${count}${target}，受到的攻擊傷害 ${value}。`
}

export const describeEffectResult = (
  effect: CardEffect,
  targetNames: string[],
) => {
  if (effect.kind === 'draw') {
    return `從牌庫抽了 ${effect.amount} 張牌。`
  }

  if (effect.kind === 'deck-to-support') {
    return `從牌庫頂取了 ${effect.amount} 張卡，直立放入支援區。`
  }

  if (effect.kind === 'break-to-trash') {
    if (targetNames.length === 0) {
      return '效果已確認，本次沒有選擇休息區目標。'
    }
    const names = targetNames.join('、')
    return `${names}已從休息區移至棄牌區。`
  }

  if (targetNames.length === 0) {
    return '效果已確認，本次沒有選擇目標。'
  }

  const names = targetNames.join('、')
  if (effect.kind === 'damage') {
    return `${names}受到 ${effect.amount} 點效果傷害。`
  }

  const value = effect.amount > 0 ? `+${effect.amount}` : effect.amount
  return effect.kind === 'modify-attack'
    ? `${names}獲得攻擊傷害 ${value} 修正。`
    : `${names}獲得受到攻擊傷害 ${value} 修正。`
}
