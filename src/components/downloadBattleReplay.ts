import {
  serializeBattleReplayExport,
  type BattleReplayExportV1,
} from '../game'

const safeTimestamp = (isoTimestamp: string): string =>
  isoTimestamp
    .replace(/[^0-9]/g, '')
    .slice(0, 14)

export const battleReplayFileName = (
  artifact: Pick<BattleReplayExportV1, 'mode' | 'exportedAt'>,
): string =>
  `braverse-replay-${artifact.mode}-${safeTimestamp(artifact.exportedAt) || 'match'}.json`

/**
 * Starts a browser download without coupling the game engine to DOM APIs.
 * Returns false in non-browser/test environments where downloads are absent.
 */
export const downloadBattleReplay = (
  artifact: BattleReplayExportV1,
): boolean => {
  if (
    typeof document === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return false
  }

  try {
    const blob = new Blob([serializeBattleReplayExport(artifact)], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = battleReplayFileName(artifact)
    anchor.rel = 'noopener'
    anchor.style.display = 'none'
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    return true
  } catch {
    return false
  }
}
