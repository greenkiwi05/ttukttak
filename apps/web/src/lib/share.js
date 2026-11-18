// 공유하기 (브라우저 전용). 휴대폰은 공유창(카카오톡·문자 등), 지원하지 않으면 클립보드 복사.
// @returns {Promise<'shared'|'copied'|'cancelled'>}
export async function shareOrCopy({ title, text }) {
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  return 'copied';
}
