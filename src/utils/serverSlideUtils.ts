/**
 * 서버사이드 슬라이드 생성 유틸리티
 * generate-slide-content, generate-full-draft 양쪽에서 사용
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.5-pro'; // 테스트용으로 고성능 Pro 모델 지정 (기존: gemini-2.0-flash)
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export const CHUNK_SIZE = 4000;

export const VALID_LAYOUTS = [
    'cover', 'title_body', 'bullet_list', 'grid_2x2',
    'grid_1x3', 'content_image', 'image_background', 'section_divider',
] as const;

/**
 * Progressive Summarization: 긴 원고를 청크로 나눠 핵심을 추출한 뒤 합산
 */
export async function extractKeyPoints(rawText: string, sectionTitle: string): Promise<string> {
    const chunks: string[] = [];
    for (let i = 0; i < rawText.length; i += CHUNK_SIZE) {
        chunks.push(rawText.substring(i, i + CHUNK_SIZE));
    }

    console.log(`[extractKeyPoints] "${sectionTitle}": ${rawText.length}자 → ${chunks.length}개 청크로 분할`);

    const extractedParts: string[] = new Array(chunks.length).fill('');

    // 병렬 처리를 위한 Batch 처리 (한 번에 5개씩)
    const BATCH_SIZE = 5;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (chunk, batchIndex) => {
            const idx = i + batchIndex;
            const prompt = `당신은 강의 교안 전문가입니다.
아래 원고 텍스트에서 강의 슬라이드에 반드시 포함해야 할 핵심 내용을 추출하세요.

## 섹션 제목
${sectionTitle}

## 원고 텍스트 (${idx + 1}/${chunks.length} 파트)
${chunk}

## 추출 규칙
1. 핵심 개념, 정의, 원리를 빠짐없이 추출
2. 중요한 수치, 통계, 사례를 보존
3. 단계별 프로세스나 절차가 있으면 순서 유지
4. 불필요한 접속사, 반복 표현은 제거
5. 원문의 핵심 의미를 왜곡하지 않도록 주의
6. 결과는 한국어 구조화된 텍스트로 출력 (마크다운 불릿 형태)
7. 약 1000~1500자로 요약`;

            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-goog-api-key': GEMINI_API_KEY!,
                    },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.3 },
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    const textPart = data.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text);
                    if (textPart?.text) {
                        extractedParts[idx] = textPart.text;
                        console.log(`[extractKeyPoints] 청크 ${idx + 1}/${chunks.length} 핵심 추출 완료 (${textPart.text.length}자)`);
                    }
                } else {
                    console.warn(`[extractKeyPoints] 청크 ${idx + 1} API 실패 (${response.status}), 원문 일부 사용`);
                    extractedParts[idx] = chunk.substring(0, 1500);
                }
            } catch (error) {
                console.warn(`[extractKeyPoints] 청크 ${idx + 1} 에러, 원문 일부 사용:`, error);
                extractedParts[idx] = chunk.substring(0, 1500);
            }
        }));
    }

    const combined = extractedParts.join('\n\n');
    console.log(`[extractKeyPoints] 최종 핵심 요약: ${combined.length}자 (원문 ${rawText.length}자 → ${Math.round((combined.length / rawText.length) * 100)}% 압축)`);
    return combined;
}

export function getTemplateStructure(template: string, slidesPerSection: number): string {
    const N = slidesPerSection;

    if (template === 'lecture') {
        return `## 교안 구조 (반드시 준수)
이 프레젠테이션은 **강의 교안** 형식입니다. 아래 구조를 정확히 따르세요:
- 1번 슬라이드: "강의 제목" — cover 레이아웃, 섹션 제목을 강의 주제로 임팩트 있게 표현, bodyText에 부제/강사명
- 2번 슬라이드: "학습목표" — bullet_list 레이아웃, slideTitle은 "학습목표", bulletPoints에 "이 강의를 통해 학습할 내용" 3~5개
- 3~${N - 1}번 슬라이드: 본문 내용 — 원고 핵심을 다양한 레이아웃(bullet_list, title_body, grid_2x2, grid_1x3, content_image)으로 전달
- ${N}번 슬라이드: "학습정리" — bullet_list 레이아웃, slideTitle은 "학습정리", bulletPoints에 핵심 내용 3~5개 요약`;
    }

    if (template === 'seminar') {
        return `## 교안 구조 (반드시 준수)
이 프레젠테이션은 **세미나/발표** 형식입니다. 아래 구조를 정확히 따르세요:
- 1번 슬라이드: "발표 제목" — cover 레이아웃, 섹션 제목을 발표 주제로 임팩트 있게 표현, bodyText에 부제/발표자
- 2~${N - 1}번 슬라이드: 본문 내용 — 원고 핵심을 다양한 레이아웃으로 전달
- ${N}번 슬라이드: "핵심 요약 & Q&A" — title_body 레이아웃, bodyText에 핵심 메시지 요약, bulletPoints에 토론 포인트`;
    }

    if (template === 'section_content') {
        return `## 슬라이드 구조
이 슬라이드들은 전체 강의의 **하나의 본문 구간**입니다.
강의 제목, 학습목표, 학습정리는 별도로 생성되므로 여기서는 포함하지 마세요.
- 1~${N}번 슬라이드: 원고 핵심을 다양한 레이아웃(bullet_list, title_body, grid_2x2, grid_1x3, content_image)으로 전달
- cover, 학습목표, 학습정리, section_divider 슬라이드를 만들지 마세요
- 각 슬라이드의 speakerNotes에는 강사가 바로 활용할 수 있는 실전 스크립트를 작성하세요
  (도입 멘트 → 핵심 전달 → 전환 멘트, 2-4문장 구어체)`;
    }

    // 'free'
    return `## 슬라이드 구조
- 첫 번째 슬라이드는 반드시 "cover" 레이아웃
- 마지막 슬라이드는 "title_body" (핵심 요약)
- 중간 슬라이드는 내용에 맞게 다양한 레이아웃 배분`;
}

export function buildBatchPrompt(
    rawText: string,
    sectionTitle: string,
    slidesPerSection: number,
    userStyle: string,
    template: string = 'lecture'
): string {
    const templateStructure = getTemplateStructure(template, slidesPerSection);

    return `당신은 사용자가 제공한 문서만을 완벽하게 숙지하고 분석하는 엄격한 AI 연구 보조원(NotebookLM 스타일)이자 프레젠테이션 설계자입니다.
아래는 원고 텍스트 원본과, 이미 앞서 구조 분석을 통해 확정된 '슬라이드 초안(메타데이터)' 배열입니다.
당신의 임무는 주어진 원고 내용 **안에서만** 정보를 추출하여, 각 슬라이드의 실제 내용(제목, 본문, 요약, 강사 대본 등)을 촘촘하고 풍부하게 채워 넣는 것입니다.

## 사용자 디자인 스타일 요청
${userStyle || '전문적이고 깔끔한 디자인'}

## 관련 챕터(섹션) 제목
${sectionTitle}

## 원고 텍스트
${rawText ? rawText.substring(0, 8000) : `(원고 내용이 비어있습니다. 제목만으로 내용을 절대로 창작하지 마시고, 내용 없음으로 처리하세요.)`}

## 슬라이드 수
정확히 ${slidesPerSection}장을 생성하세요.

${templateStructure}

## 슬라이드 설계 방법 (반드시 준수)
각 슬라이드를 설계할 때 아래 3가지를 순서대로 고려하세요:

### 1) 화면 구성 (→ layout 선택)
슬라이드의 시각적 레이아웃을 결정합니다. 내용의 성격에 따라 적절한 레이아웃을 선택하세요:
- 숫자/통계 강조 → "title_body" (큰 숫자 + 설명)
- 핵심 포인트 나열 → "bullet_list" (bulletPoints 3-5개)
- 4개 독립 개념 비교 → "grid_2x2" (contentBlocks 정확히 4개, 각각 subtitle + body)
- 3개 관련 개념 비교 → "grid_1x3" (contentBlocks 정확히 3개)
- 상세 설명/인용 → "title_body" (bodyText + 선택적 bulletPoints)
- 이미지+텍스트 병행 → "content_image" (bulletPoints 사용, 이미지 자동 생성)
- 챕터 전환 → "section_divider" (bodyText만)
- 표지/도입 → "cover" (목차상 가장 첫 번째 슬라이드일 경우 무조건 cover 레이아웃을 사용하며, 본문 내용을 넣지 말고 임팩트 있는 제목과 부제만 배치하세요)

### 2) 핵심 내용 (→ slideTitle, bulletPoints, bodyText, contentBlocks)
원고에서 해당 슬라이드에 담을 핵심 정보를 추출하세요:
- slideTitle: 청중의 관심을 끄는 임팩트 있는 제목 (예: "핵심 인사이트 3가지", "우리가 주목해야 할 사실")
- bulletPoints: 각 포인트는 핵심 키워드 + 구체적 수치/사례를 풍부하게 포함 (최소 3개, 각 1~2문장)
- bodyText: 슬라이드에 표시할 핵심 메시지 (충분히 상세하게 3~4문장 이상, 300자 내외)
- contentBlocks: 각 블록은 subtitle(키워드) + body(핵심 설명 1~2문장)

### 3) 강사 스크립트 팁 (→ speakerNotes)
강사가 이 슬라이드를 설명할 때 활용할 수 있는 실전 스크립트를 작성하세요:
- 도입 멘트: 청중의 관심을 끄는 질문이나 공감대 형성 멘트 (예: "여러분, 혹시 이런 경험 있으신가요?", "이 데이터가 의미하는 바는 무엇일까요?")
- 핵심 전달 포인트: 반드시 강조해야 할 내용
- 전환 멘트: 다음 슬라이드로 자연스럽게 넘어가는 말
- 분량: 2-4문장, 실제 말하듯 자연스러운 구어체

## 출력 형식 (JSON 배열)
{
  "slides": [
    {
      "slideTitle": "임팩트 있는 제목",
      "layout": "레이아웃 타입",
      "contentBlocks": [{"subtitle": "키워드", "body": "설명"}],
      "bulletPoints": ["핵심 포인트 + 구체적 수치/사례"],
      "bodyText": "본문 메시지",
      "speakerNotes": "강사 스크립트 (도입 멘트 + 핵심 전달 + 전환 멘트)"
    }
  ]
}

## 필수 규칙
0. **[최우선 절대 원칙 - NotebookLM 모드] 당신은 철저히 제공된 문서 내용 안에서만 작동합니다. 원고에 없는 내용을 창작하거나 외부 지식을 덧붙이지 마세요(Hallucination 절대 금지). 주어진 원고의 문맥과 정보만을 사용해 요약하고 재구성해야 합니다.**
1. 모든 텍스트는 한국어
2. **연속된 슬라이드가 같은 레이아웃을 사용하지 않도록 분배**
3. slideTitle은 청중의 관심을 끌도록 — 원고 제목을 그대로 복사하지 말 것
4. 원고에서 핵심 정보를 추출/요약하되, 구체적인 수치·사례·키워드를 빠짐없이 활용하여 **내용의 밀도를 최대한 높이세요.**
5. speakerNotes는 실전 강의에서 바로 활용 가능한 자연스러운 구어체 (강력하고 풍부한 설명 추가)
6. 선택한 layout에 해당하는 필드만 채울 것
7. grid_2x2는 contentBlocks 4개, grid_1x3는 3개 — 정확히 맞출 것
8. bulletPoints는 각 80자 내외, bodyText는 300자 내외로 기존보다 훨씬 상세하게 작성

## [중요] 콘텐츠 균일성 및 풍부함 — 반드시 준수
- **(절대 규칙) 제목만 덩그러니 있고 본문 내용이 텅 빈 슬라이드는 어떠한 경우에도 생성해서는 안 됩니다. 모든 슬라이드에는 원고에서 추출한 구체적이고 실질적인 정보(수치, 사례, 상세 설명)가 꽉 차 있어야 합니다.**
- bullet_list 레이아웃: bulletPoints 최소 3개~5개, 각 포인트가 단순 단어가 아닌 완전한 구/절로 구체적일 것
- title_body 레이아웃: bodyText에 반드시 3문장 이상의 길고 상세한 실질적 설명 포함
- grid_2x2/grid_1x3 레이아웃: 각 contentBlock의 body에 반드시 2문장 이상 상세 설명 포함
- speakerNotes: 모든 슬라이드에 반드시 3~5문장 이상의 상세한 대본 작성 (빈 문자열 금지)
- 슬라이드의 내용이 부족해보이지 않도록 원고의 디테일을 최대한 살려서 배분하세요`;
}

export interface SlideContent {
    slideTitle?: string;
    layout?: string;
    contentBlocks?: Array<{ subtitle?: string; body?: string }>;
    bulletPoints?: string[];
    bodyText?: string;
    speakerNotes?: string;
}

export function validateSlide(slide: SlideContent, index: number, total: number, template: string = 'lecture'): SlideContent {
    if (index === 0 && template !== 'section_content') {
        // 무조건 첫 번째 슬라이드는 커버로 강제 (단, 중간 섹션용 템플릿일 때는 제외)
        slide.layout = 'cover';
        slide.bodyText = '';
        slide.bulletPoints = [];
        slide.contentBlocks = [];
    } else if (!slide.layout || !VALID_LAYOUTS.includes(slide.layout as typeof VALID_LAYOUTS[number])) {
        if (template === 'section_content' && index === 0) slide.layout = 'section_divider';
        else if (template === 'lecture' && index === 1) slide.layout = 'bullet_list';
        else if (template === 'lecture' && index === total - 1) slide.layout = 'bullet_list';
        else if (index === total - 1) slide.layout = 'title_body';
        else slide.layout = 'bullet_list';
    }

    if (template === 'lecture' && index === 1 && !slide.slideTitle?.includes('학습목표')) {
        slide.slideTitle = '학습목표';
        slide.layout = 'bullet_list';
    }
    if (template === 'lecture' && index === total - 1 && !slide.slideTitle?.includes('학습정리') && !slide.slideTitle?.includes('정리') && !slide.slideTitle?.includes('요약')) {
        slide.slideTitle = '학습정리';
        slide.layout = 'bullet_list';
    }

    if (slide.layout === 'grid_2x2') {
        if (!Array.isArray(slide.contentBlocks) || slide.contentBlocks.length < 4) {
            slide.layout = 'bullet_list';
        } else {
            slide.contentBlocks = slide.contentBlocks.slice(0, 4).map(b => ({
                subtitle: b.subtitle || '핵심 포인트',
                body: b.body || '',
            }));
        }
    }

    if (slide.layout === 'grid_1x3') {
        if (!Array.isArray(slide.contentBlocks) || slide.contentBlocks.length < 3) {
            slide.layout = 'bullet_list';
        } else {
            slide.contentBlocks = slide.contentBlocks.slice(0, 3).map(b => ({
                subtitle: b.subtitle || '핵심 포인트',
                body: b.body || '',
            }));
        }
    }

    if (slide.layout === 'bullet_list' && (!slide.bulletPoints || slide.bulletPoints.length === 0)) {
        slide.bulletPoints = ['핵심 내용을 정리합니다.'];
    }

    if ((slide.layout === 'title_body' || slide.layout === 'cover') && !slide.bodyText) {
        slide.bodyText = '';
    }

    if (!slide.slideTitle) {
        slide.slideTitle = `슬라이드 ${index + 1}`;
    }

    return slide;
}

/**
 * Gemini API에 프롬프트를 보내고 JSON 응답을 파싱하여 슬라이드 배열을 반환
 */
export async function generateSlidesFromPrompt(
    rawText: string,
    sectionTitle: string,
    slidesPerSection: number,
    userStyle: string,
    template: string
): Promise<SlideContent[]> {
    // Progressive Summarization
    let processedText = rawText || '';
    if (processedText.length > CHUNK_SIZE) {
        processedText = await extractKeyPoints(processedText, sectionTitle);
    }

    const prompt = buildBatchPrompt(processedText, sectionTitle, slidesPerSection, userStyle, template);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 280000); // 4분 40초

    console.log(`[generateSlidesFromPrompt] "${sectionTitle}" Gemini API 호출 시작 (${slidesPerSection}장, 텍스트 ${processedText.length}자)...`);

    let response: Response;
    try {
        response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': GEMINI_API_KEY!,
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: 'application/json',
                    temperature: 0.7,
                },
            }),
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        console.log(`[generateSlidesFromPrompt] "${sectionTitle}" Gemini API 응답 수신: ${response.status}`);
    } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
            console.error(`[generateSlidesFromPrompt] "${sectionTitle}" 타임아웃 (4분 40초 초과)`);
            throw new Error(`"${sectionTitle}" 섹션 슬라이드 생성 시간이 초과되었습니다. 다시 시도해주세요.`);
        }
        console.error(`[generateSlidesFromPrompt] "${sectionTitle}" fetch 오류:`, fetchError.message);
        throw fetchError;
    }

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API 오류: ${response.status} — ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
    const candidates = data.candidates;

    if (!candidates || candidates.length === 0) {
        throw new Error('응답이 없습니다.');
    }

    const textPart = candidates[0].content?.parts?.find((p: { text?: string }) => p.text);
    if (!textPart) {
        throw new Error('텍스트 응답을 찾을 수 없습니다.');
    }

    let parsed: any;
    try {
        const cleanText = textPart.text.replace(/^```json\s*/m, '').replace(/```\s*$/m, '').trim();
        parsed = JSON.parse(cleanText);
    } catch (e) {
        console.error('[generateSlidesFromPrompt] JSON parsing failed. length:', textPart.text.length);
        throw new Error('AI 응답이 올바른 형식이 아니거나 재생성 도중 끊겼습니다 (JSON 파싱 오류). 다시 시도해주세요.');
    }

    let slides: SlideContent[] = [];
    if (Array.isArray(parsed)) {
        slides = parsed;
    } else if (parsed.slides && Array.isArray(parsed.slides)) {
        slides = parsed.slides;
    } else {
        throw new Error('올바른 슬라이드 배열이 아닙니다.');
    }

    return slides.map((slide, i) => validateSlide(slide, i, slides.length, template));
}
