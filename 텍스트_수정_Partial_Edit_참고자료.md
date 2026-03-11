# 텍스트 수정 (Partial Edit) 기능 구현 참고자료

> 사용자가 텍스트로 수정 지시를 입력하면 해당 슬라이드를 AI가 수정해서 재생성하는 기능입니다.

---

## 1. 전체 흐름

```
사용자가 슬라이드 클릭
    → "Partial edit" 버튼 클릭
    → 텍스트 입력창에 수정 지시 입력
        예) "제목을 '새 제목'으로 변경", "배경색을 파란색으로 변경"
    → "Apply edit" 버튼 클릭
    → POST /api/generate/partial-edit 호출 (sessionId, slideIndex, instruction)
    → 서버에서 기존 슬라이드 이미지 + 수정 지시 + 스타일/텍스트 정보로 Gemini 재생성
    → 새 이미지 URL 반환
    → 화면에서 해당 슬라이드 이미지 교체
```

---

## 2. 클라이언트 - UI (`client/src/App.tsx`)

### 상태값

```tsx
const [editMode, setEditMode] = useState(false);           // 수정 입력창 표시 여부
const [editInstruction, setEditInstruction] = useState(""); // 사용자가 입력한 수정 지시
const [editing, setEditing] = useState(false);             // 수정 요청 진행 중 여부
```

### 수정 버튼 및 입력창 UI

```tsx
{/* "Partial edit" 토글 버튼 */}
<button
  type="button"
  className="ghost"
  onClick={() => setEditMode(!editMode)}
  disabled={regenerating || editing}
>
  {editMode ? "Cancel edit" : "Partial edit"}
</button>

{/* 수정 지시 입력창 (editMode가 true일 때만 표시) */}
{editMode ? (
  <div className="modal-edit">
    <textarea
      className="edit-textarea"
      placeholder="수정할 내용을 입력하세요 (예: 제목을 '새 제목'으로 변경, 배경색을 파란색으로 변경)"
      value={editInstruction}
      onChange={(e) => setEditInstruction(e.target.value)}
      disabled={editing}
      rows={3}
    />
    <button
      type="button"
      onClick={() => void handlePartialEdit()}
      disabled={editing || !editInstruction.trim()}
    >
      {editing ? "Editing..." : "Apply edit"}
    </button>
  </div>
) : null}
```

### handlePartialEdit 함수

```tsx
async function handlePartialEdit(): Promise<void> {
  if (!sessionId || !modalSlide || !editInstruction.trim()) return;

  setEditing(true);
  setError("");

  try {
    // 서버에 부분 수정 요청
    const res = await partialEditSlide(
      sessionId,
      modalSlide.slideIndex,
      editInstruction.trim()
    );

    // 캐시 방지용 타임스탬프 추가
    const newUrl = `${res.url}?t=${Date.now()}`;

    // 모달 이미지 업데이트
    setModalSlide({ slideIndex: modalSlide.slideIndex, url: newUrl });

    // 결과 목록 이미지도 업데이트
    setResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        images: prev.images.map((img) =>
          img.slideIndex === modalSlide.slideIndex
            ? { ...img, url: newUrl }
            : img
        )
      };
    });

    // 입력창 초기화 및 수정 모드 종료
    setEditInstruction("");
    setEditMode(false);

  } catch (err) {
    setError((err as Error).message);
  } finally {
    setEditing(false);
  }
}
```

---

## 3. 클라이언트 - API 통신 (`client/src/api.ts`)

```typescript
export async function partialEditSlide(
  sessionId: string,
  slideIndex: number,
  instruction: string
): Promise<{ sessionId: string; slideIndex: number; url: string }> {
  return requestJson("/api/generate/partial-edit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, slideIndex, instruction })
  });
}
```

**요청 바디:**
```json
{
  "sessionId": "세션ID",
  "slideIndex": 1,
  "instruction": "제목을 '새 제목'으로 변경"
}
```

**응답:**
```json
{
  "sessionId": "세션ID",
  "slideIndex": 1,
  "url": "/outputs/session_xxx/generated/slide_001.png"
}
```

---

## 4. 서버 - 구현이 필요한 엔드포인트

> 현재 서버에 없으므로 새로 추가해야 합니다.

### POST `/api/generate/partial-edit`

```javascript
router.post("/partial-edit", async (req, res, next) => {
  try {
    const { sessionId, slideIndex, instruction } = req.body;

    // 1. 세션 및 입력값 검증
    const session = sessionStore.getSession(sessionId);
    if (!session) throw new HttpError(404, "Session not found");
    if (!slideIndex || !instruction) throw new HttpError(400, "slideIndex and instruction are required");

    // 2. 기존 생성된 슬라이드 이미지 경로 가져오기
    const existingImagePath = session.generatedImagePaths[slideIndex - 1];
    if (!existingImagePath) throw new HttpError(404, "Generated slide not found");

    // 3. 기존 contentPlan, styleProfile 재사용
    const contentPlan = session.contentPlans[slideIndex - 1];
    const styleProfile = session.styleProfile;

    // 4. 수정 지시사항을 포함한 프롬프트 생성
    const prompt = buildGenerationPrompt({
      style: styleProfile,
      contentPlan,
      slideIndex,
      totalSlides: session.status.totalSlides,
      retryReason: `USER_EDIT_INSTRUCTION: ${instruction}`  // 수정 지시 주입
    });

    // 5. Gemini로 이미지 재생성
    const outputPath = existingImagePath; // 덮어쓰기 or 새 경로
    await geminiClient.generateSlideImage(existingImagePath, prompt, outputPath);

    res.json({
      sessionId,
      slideIndex,
      url: toOutputUrl(outputPath)
    });

  } catch (error) {
    next(error);
  }
});
```

---

## 5. 서버 - 프롬프트 구조 (`server/dist/services/promptBuilder.js`)

수정 지시는 기존 프롬프트의 `retryReason` 자리를 활용합니다.

```javascript
function buildGenerationPrompt(input) {
  return `
You are generating one slide image for a Korean business presentation.

Slide context:
- slide number: ${input.slideIndex} of ${input.totalSlides}
- preserve the original slide meaning, structure, and information hierarchy
- original slide summary: ${input.contentPlan.summary}
- layout intent: ${input.contentPlan.layoutIntent}

Style constraints:
- Color palette: ${input.style.colorPalette.join(", ")}
- Layout: ${input.style.layout}
- Icon style: ${input.style.iconStyle}
- Typography: ${input.style.typography}
- Preferred Korean font style: ${input.style.koreanFont}

Output constraints:
- 16:9 ratio, exactly 1920x1080
- clean and professional composition

LOCKED_TEXT_EXACT (must be present, no omission):
${lockedTextSection}

VISUAL_ASSET_INTENT:
${visualAssetSection}

// ↓ Partial Edit 시 이 부분에 수정 지시 주입
${input.retryReason ? `RETRY_REASON: ${input.retryReason}` : ""}

${KOREAN_GUARD_PROMPT}
`.trim();
}
```

> 💡 **핵심 포인트:** `retryReason`에 `"USER_EDIT_INSTRUCTION: 제목을 '새 제목'으로 변경"` 형태로 넣으면  
> 기존 스타일/텍스트 제약은 그대로 유지하면서 수정 지시만 추가됩니다.

---

## 6. 서버 - 텍스트 검증 (`server/dist/services/textValidator.js`)

수정 후에도 원본 텍스트가 이미지에 유지되는지 확인하는 로직입니다.

```javascript
export class TextValidator {
  async validate(imagePath, lockedTexts) {
    if (lockedTexts.length === 0) {
      return { passed: true, missingTexts: [], detectedLines: [] };
    }

    // Gemini로 이미지에서 텍스트 추출
    const detectedLines = await this.geminiClient.extractTextLinesFromImage(imagePath);
    const normalizedDetected = detectedLines.map(normalizeText).filter(Boolean);
    const mergedDetected = normalizeText(detectedLines.join("\n"));

    const missingTexts = [];

    for (const locked of lockedTexts) {
      const target = normalizeText(locked.text);
      if (!target) continue;

      // 완전 일치 검사
      if (mergedDetected.includes(target)) continue;

      // 유사도 검사 (74% 이상이면 통과)
      const similarLine = normalizedDetected.some(
        (line) => similarityScore(line, target) >= 0.74
      );

      if (!similarLine) {
        missingTexts.push(locked.text);
      }
    }

    return {
      passed: missingTexts.length === 0,
      missingTexts,
      detectedLines
    };
  }
}
```

**텍스트 정규화 방식:**
```javascript
function normalizeText(input) {
  return input
    .toLowerCase()
    .replace(/\s+/g, "")           // 공백 제거
    .replace(/[^a-z0-9가-힣]/g, ""); // 특수문자 제거
}
```

**유사도 계산 (Bigram 방식):**
```javascript
function similarityScore(a, b) {
  const gramsA = toBigrams(a);  // 2글자씩 쪼개기
  const gramsB = toBigrams(b);
  const intersection = new Set([...gramsA].filter(g => gramsB.has(g))).size;
  const union = new Set([...gramsA, ...gramsB]).size;
  return union === 0 ? 0 : intersection / union;
}
```

---

## 7. 서버 - 한국어 텍스트 렌더링 규칙 (`server/dist/utils/koreanGuard.js`)

모든 이미지 생성 프롬프트에 포함되는 한국어 렌더링 규칙입니다. 수정 기능에도 동일하게 적용해야 합니다.

```javascript
export const KOREAN_GUARD_PROMPT = `
CRITICAL KOREAN TEXT RENDERING RULES - MUST FOLLOW:
- All Korean (Hangul) characters must be rendered as complete, properly composed syllable blocks.
- DO NOT separate Korean syllables into individual jamo (ㄱ, ㅏ, ㄴ etc.) - this is forbidden.
- DO NOT distort, rotate, mirror, or warp any Korean character.
- DO NOT change the meaning of Korean words - preserve exact spelling.
- Korean text must appear as print-quality typography, sharp and legible at any size.
- Use a clean, modern sans-serif Korean font style (e.g., Noto Sans KR, Pretendard, Apple SD Gothic Neo).
- Title text must be large (minimum 60-80px equivalent), bold, and positioned at the top of the slide.
- Supporting text blocks must be clearly separated, left-aligned, and no smaller than 24px equivalent.
`.trim();
```
