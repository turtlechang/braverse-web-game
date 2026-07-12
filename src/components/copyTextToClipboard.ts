/**
 * 剪貼簿寫入包裝：Clipboard API 在非 https、無焦點或使用者拒絕權限時會
 * reject，統一收斂成 boolean 讓呼叫端顯示成功／失敗回饋而不擲例外。
 */
export const copyTextToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
