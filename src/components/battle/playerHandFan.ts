/** 底部手牌採用低弧度、較寬的橫向重疊，貼近實體卡牌手持視覺。 */
export const computePlayerHandFan = (count: number, index: number) => {
  if (count <= 1) return { fanX: 0, fanY: 0, fanRotation: 0 }

  const center = (count - 1) / 2
  const offset = index - center
  const baseStep = Math.max(42, Math.min(112, 520 / (count - 1)))
  const maxNorm = center || 1
  const normOffset = offset / maxNorm

  return {
    fanX: offset * baseStep,
    fanY: normOffset * normOffset * 6,
    fanRotation: offset * Math.min(2.4, 12 / count),
  }
}
