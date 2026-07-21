export const CARD_W = 112
export const CARD_H = 156

export interface OpponentFanResult {
  arcSpan: number
  opponentAngle: number
  opponentX: number
  opponentY: number
  maxAngle: number
  leftOverhang: number
  safetyInset: number
  safetyRatio: number
  fanZIndex: number
}

export function computeOpponentFan(count: number, index: number): OpponentFanResult {
  const arcSpan = 0
  const centerIndex = (count - 1) / 2
  const opponentAngle = 0
  const opponentStep = count <= 1 ? 0 : Math.max(36, Math.min(96, 384 / (count - 1)))
  const opponentX = (index - centerIndex) * opponentStep
  // Spread face-down cards horizontally while keeping every individual card
  // upright. The top-hand card orientation itself remains opponent-facing.
  const opponentY = 0
  const maxAngle = 0
  const a = maxAngle * Math.PI / 180
  const leftOverhang =
    count <= 1 ? 0 : Math.max(0, CARD_H * Math.sin(a) - (CARD_W / 2) * (1 - Math.cos(a)))
  const safetyInset = leftOverhang + 2
  const safetyRatio = count <= 1 ? 0 : leftOverhang / CARD_W
  const fanZIndex = count <= 1 ? 0 : (count - 1) - index
  return { arcSpan, opponentAngle, opponentX, opponentY, maxAngle, leftOverhang, safetyInset, safetyRatio, fanZIndex }
}
