import type { ReplayIssueBundleV1 } from '../game/replay-issue-bundle'

/**
 * GameErrorBoundary 是包在整個 App 外層的 class component，拿不到對局 hook
 * 的狀態；由 useMatchController／useOnlineMatchController 在對局進行中註冊
 * provider，錯誤邊界（或其他無法直接取得對局狀態的出口）再透過這裡
 * 建構問題包。同一時間只會有一場對局，後註冊者覆蓋前者。
 *
 * 刻意「不」在 unmount 時解除註冊：畫面崩潰時 React 會先卸載子樹再呼叫
 * componentDidCatch，若照慣例在 effect cleanup 解除註冊，錯誤邊界拿到
 * 控制權時 provider 已被清掉。provider 閉包保留最後一次註冊時的對局
 * 狀態，正是崩潰當下要回報的內容。
 */
export type IssueBundleProvider = (
  errorSummary: string | null,
) => ReplayIssueBundleV1

let activeProvider: IssueBundleProvider | null = null

export const registerIssueBundleProvider = (
  provider: IssueBundleProvider,
): void => {
  activeProvider = provider
}

/** 測試用：還原到未註冊狀態。 */
export const resetIssueBundleProviderForTest = (): void => {
  activeProvider = null
}

export const hasIssueBundleProvider = (): boolean => activeProvider !== null

export const buildIssueBundleFromProvider = (
  errorSummary: string | null,
): ReplayIssueBundleV1 | null => activeProvider?.(errorSummary) ?? null
