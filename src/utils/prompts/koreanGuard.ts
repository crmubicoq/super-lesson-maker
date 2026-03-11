/**
 * 레퍼런스 코드에서 이식된 한글 렌더링 보호 프롬프트
 * Korean Text Rendering Rules to prevent font rendering issues in AI generation.
 */
export const KOREAN_GUARD_PROMPT = `
CRITICAL KOREAN TEXT RENDERING RULES — MUST FOLLOW:
- All Korean (Hangul) characters must be rendered as complete, properly composed syllable blocks.
- Each syllable must combine initial consonant (초성), vowel (중성), and final consonant (종성) correctly.
- DO NOT separate Korean syllables into individual jamo (ㄱ, ㅏ, ㄴ etc.) — this is forbidden.
- DO NOT distort, rotate, mirror, or warp any Korean character.
- DO NOT change the meaning of Korean words — preserve exact spelling.
- Korean text must appear as print-quality typography, sharp and legible at any size.
- Use a clean, modern sans-serif Korean font style (e.g., Noto Sans KR, Pretendard, Apple SD Gothic Neo).
- If a Korean character cannot be rendered accurately, replace it with clearly readable English instead.
- Title text must be large (minimum 60–80px equivalent), bold, and positioned at the top of the slide.
- Supporting text blocks must be clearly separated, left-aligned, and no smaller than 24px equivalent.
`.trim();
