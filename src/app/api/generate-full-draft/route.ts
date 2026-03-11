import { NextRequest, NextResponse } from 'next/server';
import { getTextForPageRange } from '@/utils/textSplitter';
import { generateSlidesFromPrompt, SlideContent } from '@/utils/serverSlideUtils';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.5-pro'; // 테스트용으로 고성능 Pro 모델 지정 (기존: gemini-2.0-flash)
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export const maxDuration = 600; // 10분 (Pro 모델 지연시간 대응)

interface ChapterAnalysis {
    title: string;
    pageRange: string;
    suggestedSlideCount: number;
}

interface StructureAnalysis {
    overallTitle: string;
    learningObjectives: string[];
    chapters: ChapterAnalysis[];
    styleSuggestions: string;
}

/**
 * Phase 1: 원고 구조 분석 — 강의 제목, 학습목표, 챕터 구성 + 챕터별 추천 슬라이드 수
 */
async function analyzeStructure(fullText: string, fileName: string, template: string, targetCount?: number): Promise<StructureAnalysis> {
    const templateDesc = template === 'lecture' ? '강의 교안' : template === 'seminar' ? '세미나/발표' : '자유형 프레젠테이션';
    const targetText = targetCount ? `**총 목표 슬라이드 수: ${targetCount}장** (이 전체 분량에 맞춰 챕터별 슬라이드 수와 챕터 개수를 유연하게 분배하세요. 목표 장수가 10장 이하라면 챕터를 1~3개로 대폭 줄이세요.)` : '적절한 분량으로 촘촘히 분해하세요';

    const prompt = `당신은 사용자가 제공한 문서만을 기반으로 분석하고 내용을 구성하는 엄격한 AI 연구 보조원(NotebookLM 스타일)이자 프레젠테이션 설계자입니다.
아래 원고 텍스트를 깊이 있게 분석하여 ${templateDesc} 슬라이드를 위한 전체 구조를 설계하세요.

## 원고 파일명
${fileName}

## 원고 텍스트
${fullText.substring(0, 12000)}

## 분석 지침
1. 원고 전체를 아우르는 **강의 제목**을 생성하세요 (파일명 참고, 원고 내용 기반)
2. 원고 내용에서 **학습목표** 3~5개를 추출하세요 ("~을 이해한다", "~을 설명할 수 있다" 형식)
3. ${targetText}
4. 원고에 챕터가 많을 경우 최대 8개 챕터까지 나누고, 각 챕터의 **최적 슬라이드 수**를 결정하세요
   - [Page N] 마커가 있으면 페이지 범위를 지정
5. 원고에 어울리는 디자인 스타일을 제안하세요

## 출력 형식 (JSON)
{
  "overallTitle": "강의 전체 제목",
  "learningObjectives": ["학습목표1", "학습목표2", "학습목표3"],
  "chapters": [
    {
      "title": "챕터 제목 (20자 이내)",
      "pageRange": "1-5",
      "suggestedSlideCount": 4
    }
  ],
  "styleSuggestions": "디자인 스타일 제안"
}

## 필수 규칙
0. **[최우선 절대 원칙 - NotebookLM 모드] 당신은 외부 지식을 절대 사용하지 않습니다. 절대로 제공된 원고 텍스트에 없는 내용을 스스로 지어내거나 추가하지 마세요. 문맥을 추론하되, 반드시 원고 내의 정보와 팩트만을 바탕으로 도출해야 합니다.**
1. **[논리 구조 보존] 원고의 전개 논리와 시간적/논리적 흐름이 절대 끊기지 않거나 섞이지 않도록, 서론-본론-결론의 유기적인 맥락을 완전히 유지하며 챕터를 순서대로 구성하세요.**
2. 모든 텍스트는 한국어
2. 챕터 제목은 20자 이내
3. 챕터는 목표 슬라이드 수에 맞게 유동적으로 배분 (1개~8개)
4. pageRange는 "시작-끝" 형식
5. suggestedSlideCount는 챕터당 2~10 사이로 자유롭게 배분하되, 총합이 목표 장수와 최대한 일치하도록 하세요
6. 마지막 챕터의 끝 페이지는 전체 페이지 수와 일치
7. [Page N] 마커가 없으면 균등 분할
8. **단 한 문단이라도 버리지 말고 최대한 촘촘하게 나누어 슬라이드 수를 정확히 확보하세요.**`;

    const structureController = new AbortController();
    const structureTimeout = setTimeout(() => structureController.abort(), 300000); // 5분

    console.log('[analyzeStructure] Gemini API 호출 시작...');
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
                    temperature: 0.5,
                },
            }),
            signal: structureController.signal,
        });
        clearTimeout(structureTimeout);
    } catch (fetchError: any) {
        clearTimeout(structureTimeout);
        if (fetchError.name === 'AbortError') {
            throw new Error('구조 분석 요청 시간이 초과되었습니다 (5분). 원고 분량을 줄이거나 잠시 후 다시 시도해주세요.');
        }
        throw fetchError;
    }
    console.log(`[analyzeStructure] Gemini API 응답 수신: ${response.status}`);

    if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        console.error('[analyzeStructure] API 실패:', response.status, errBody.substring(0, 300));
        throw new Error(`구조 분석 API 오류: ${response.status}`);
    }

    const data = await response.json();
    const textPart = data.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text);
    if (!textPart?.text) throw new Error('구조 분석 응답 없음');

    let parsed;
    try {
        const cleanText = textPart.text.replace(/^```json\s*/m, '').replace(/```\s*$/m, '').trim();
        parsed = JSON.parse(cleanText);
    } catch (e) {
        console.error('[analyzeStructure] JSON parsing failed. length:', textPart.text.length);
        throw new Error('AI 분석 중 응답 형식이 깨졌습니다 (JSON 파싱 오류). 원고 내용이 너무 복잡하여 중간에 분석이 끊겼을 수 있습니다.');
    }

    // 총 페이지 수 계산
    const pageMatches = fullText.match(/\[Page [0-9]+\]/g);
    const totalPages = pageMatches ? pageMatches.length : 10;

    let chapters: ChapterAnalysis[] = (parsed.chapters || []).map((ch: ChapterAnalysis, idx: number) => ({
        title: (ch.title || `섹션 ${idx + 1}`).substring(0, 30),
        pageRange: ch.pageRange || `${Math.floor((totalPages / (parsed.chapters?.length || 4)) * idx) + 1}-${Math.floor((totalPages / (parsed.chapters?.length || 4)) * (idx + 1))}`,
        suggestedSlideCount: ch.suggestedSlideCount || 5,
    }));

    // targetCount가 있을 경우 챕터별 슬라이드 수를 강제 분배 (수학적 쪼개기)
    if (targetCount && chapters.length > 0) {
        const isLecture = template === 'lecture';
        const isSeminar = template === 'seminar';
        // 고정 슬라이드 개수: 커버(1) + (강의면 목표 1) + 요약(1)
        const fixedCount = isLecture ? 3 : (isSeminar ? 2 : 2);
        // 순수 본문 슬라이드로 배정할 개수 (최소 1장 보장)
        let contentTarget = Math.max(1, targetCount - fixedCount);

        // 만약 챕터 수가 목표 분량보다 길게 잡혔다면 뒷부분을 합치거나 잘라서 개수 맞추기
        if (chapters.length > contentTarget) {
            chapters = chapters.slice(0, contentTarget);
        }

        // 기본으로 균등하게 분배
        const baseCount = Math.floor(contentTarget / chapters.length);
        let remain = contentTarget - (baseCount * chapters.length);

        chapters.forEach((ch, idx) => {
            ch.suggestedSlideCount = baseCount + (idx < remain ? 1 : 0);
        });
    } else {
        // 안전장치
        chapters.forEach(ch => {
            ch.suggestedSlideCount = Math.max(4, Math.min(10, ch.suggestedSlideCount));
        });
    }

    return {
        overallTitle: parsed.overallTitle || fileName.replace(/\.[^.]+$/, ''),
        learningObjectives: parsed.learningObjectives || ['핵심 개념을 이해한다'],
        chapters,
        styleSuggestions: parsed.styleSuggestions || 'Professional, Minimalist',
    };
}

interface DraftSlide extends SlideContent {
    chapterId: string;
    chapterTitle: string;
    slideRole: 'cover' | 'objectives' | 'content' | 'summary';
}

/**
 * 짧은 텍스트용: 구조 분석 + 전체 슬라이드를 단일 API 호출로 생성
 */
async function generateAllInOne(fullText: string, fileName: string, template: string, targetCount?: number): Promise<{
    overallTitle: string;
    learningObjectives: string[];
    slides: DraftSlide[];
    styleSuggestions: string;
}> {
    const templateDesc = template === 'lecture' ? '강의 교안' : template === 'seminar' ? '세미나/발표' : '자유형 프레젠테이션';
    const isLecture = template === 'lecture';
    const isSeminar = template === 'seminar';
    const targetLengthStr = targetCount ? `정확히 ${targetCount}장` : (isLecture || isSeminar ? '18~28장' : '14~22장');

    const prompt = `당신은 사용자가 제공한 문서만을 완벽하게 숙지하고 분석하는 엄격한 AI 연구 보조원(NotebookLM 스타일)이자 슬라이드 설계자입니다.
아래 원고를 분석하여, 오직 원고의 내용만으로 완성된 ${templateDesc} 슬라이드 세트를 한 번에 생성하세요.

## 원고 파일명
${fileName}

## 원고 텍스트
${fullText.substring(0, 40000)}

## 출력 형식 (JSON)
{
  "overallTitle": "강의 전체 제목",
  "learningObjectives": ["학습목표1", "학습목표2", "학습목표3"],
  "styleSuggestions": "디자인 스타일 제안",
  "slides": [
    {
      "slideTitle": "슬라이드 제목",
      "layout": "레이아웃",
      "bulletPoints": ["포인트1", "포인트2"],
      "bodyText": "본문",
      "contentBlocks": [{"subtitle": "키워드", "body": "설명"}],
      "speakerNotes": "강사 스크립트",
      "slideRole": "content"
    }
  ]
}

## 슬라이드 구조
${isLecture ? `- 첫 슬라이드: cover 레이아웃 (강의 제목, slideRole: "cover")
- 두 번째 슬라이드: bullet_list (학습목표 3~5개, slideRole: "objectives")
- 본문 슬라이드: 요청된 총 장수에 맞추어 다양한 레이아웃 사용 (순차적이고 자연스러운 흐름, slideRole: "content")
- 마지막 슬라이드: bullet_list (학습정리, slideRole: "summary")`
            : isSeminar ? `- 첫 슬라이드: cover 레이아웃 (발표 제목, slideRole: "cover")
- 본문 슬라이드: 요청된 총 장수에 맞추어 다양한 레이아웃 사용 (slideRole: "content")
- 마지막 슬라이드: title_body (핵심 요약 & Q&A, slideRole: "summary")`
                : `- 첫 슬라이드: cover 레이아웃 (slideRole: "cover")
- 본문 슬라이드: 요청된 총 장수에 맞추어 순차적으로 구성 (slideRole: "content")
- 마지막 슬라이드: title_body (요약, slideRole: "summary")`}

## 사용 가능한 레이아웃
cover, title_body, bullet_list, grid_2x2, grid_1x3, content_image, section_divider

## 필수 규칙
0. **[최우선 절대 원칙 - NotebookLM 모드] 당신은 철저히 제공된 문서 내용 안에서만 작동합니다. 원고에 없는 내용을 창작하거나 외부 지식을 덧붙이지 마세요(Hallucination 절대 금지). 주어진 원고의 문맥과 정보만을 사용해 요약하고 재구성해야 합니다.**
1. **[논리 구조 보존] 슬라이드 간의 내용이 뒤죽박죽 섞이거나 비약이 발생하지 않도록, 원고의 원래 서술 순서와 인과관계를 철저히 유지하며 매끄러운 스토리라인을 이어가세요.**
2. 모든 텍스트는 한국어
2. 연속된 슬라이드가 같은 레이아웃을 사용하지 않도록 분배
3. slideTitle은 청중 관심을 끌도록 임팩트 있게
4. 원고의 핵심 정보, 수치, 사례를 빠짐없이 포함하며, **요구된 장수를 맞추기 위해 슬라이드를 잘게 쪼개세요.**
5. **(절대 규칙) 제목만 덩그러니 있고 본문 내용이 텅 빈 슬라이드는 어떠한 경우에도 생성해서는 안 됩니다. 모든 슬라이드에는 원고에서 추출한 구체적이고 실질적인 정보(수치, 사례, 상세 설명)가 꽉 차 있어야 합니다.**
6. bulletPoints 최소 3개, bodyText 2~4문장 이상, speakerNotes 3문장 이상 (내용을 풍부하게)
7. grid_2x2는 contentBlocks 4개, grid_1x3는 3개
7. 총 슬라이드 수: ${targetLengthStr}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 580000); // 9분 40초로 타임아웃 극대화

    console.log('[generateAllInOne] Gemini API 호출 시작...');
    try {
        const response = await fetch(API_URL, {
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
        console.log(`[generateAllInOne] Gemini API 응답 수신: ${response.status}`);

        if (!response.ok) {
            const errBody = await response.text().catch(() => '');
            console.error('[generateAllInOne] API 실패:', response.status, errBody.substring(0, 300));
            throw new Error(`Gemini API 오류: ${response.status}`);
        }

        const data = await response.json();
        const textPart = data.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text);
        if (!textPart?.text) throw new Error('응답 없음');

        let parsed;
        try {
            const cleanText = textPart.text.replace(/^```json\s*/m, '').replace(/```\s*$/m, '').trim();
            parsed = JSON.parse(cleanText);
        } catch (e) {
            console.error('[generateAllInOne] JSON parsing failed. length:', textPart.text.length);
            throw new Error('AI 초안 생성 중 형식이 깨졌습니다 (JSON 파싱 오류). 요청한 목표 장수가 너무 많아 중간에 문장 생성이 끊겼을 가능성이 높습니다. 장수를 약간 줄여서 다시 시도해주세요.');
        }
        const overallTitle = parsed.overallTitle || fileName.replace(/\.[^.]+$/, '');
        const slides: DraftSlide[] = (parsed.slides || []).map((s: DraftSlide, idx: number) => {
            // 첫 번째 슬라이드(표지) 강제화: 제목 외의 본문 내용은 모두 버림
            const isFirst = idx === 0;
            return {
                ...s,
                slideTitle: isFirst ? overallTitle : s.slideTitle,
                layout: isFirst ? 'cover' : (s.layout || 'bullet_list'),
                bodyText: isFirst ? '' : s.bodyText,
                bulletPoints: isFirst ? [] : s.bulletPoints,
                contentBlocks: isFirst ? [] : s.contentBlocks,
                chapterId: 'all',
                chapterTitle: '',
                slideRole: s.slideRole || 'content',
            };
        });

        return {
            overallTitle,
            learningObjectives: parsed.learningObjectives || ['핵심 개념을 이해한다'],
            slides,
            styleSuggestions: parsed.styleSuggestions || 'Professional, Minimalist',
        };
    } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error('초안 생성 요청 시간이 초과되었습니다 (약 10분). 목표 슬라이드 장수를 줄이거나 잠시 후 다시 시도해주세요.');
        }
        throw err;
    }
}

export async function POST(request: NextRequest) {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your-api-key-here') {
        return NextResponse.json(
            { error: 'GEMINI_API_KEY가 설정되지 않았습니다.' },
            { status: 500 }
        );
    }

    try {
        const { fullText, fileName, template, targetSlideCount } = await request.json();

        if (!fullText) {
            return NextResponse.json({ error: 'fullText가 필요합니다.' }, { status: 400 });
        }

        // [Page N] 마커 외에 순수 텍스트가 의미 있는 수준인지 검사
        const realTextLength = fullText.replace(/\[Page \d+\]/g, '').trim().length;
        if (realTextLength < 20) {
            return NextResponse.json({
                error: '문서에서 텍스트를 거의 추출하지 못했습니다. 스캔된 이미지 형태의 문서이거나 내용이 비어있을 수 있습니다. 텍스트 복사가 가능한 문서를 올려주세요.'
            }, { status: 400 });
        }

        console.log(`[generate-full-draft] 시작: ${fileName}, template=${template}, textLength=${fullText.length}, target=${targetSlideCount}`);

        const isLecture = template === 'lecture';
        const isSeminar = template === 'seminar';

        // 타겟 장수가 20장을 초과하면 AI 출력 토큰을 초과하여 JSON이 잘릴 위험이 매우 높음
        const forceChunking = typeof targetSlideCount === 'number' && targetSlideCount > 20;

        // 목표 장수가 20장 이하이고 텍스트가 15000자 이하라면 챕터 분석 없이 한 번에 순차 생성
        if (!forceChunking && (fullText.length <= 15000 || (targetSlideCount && targetSlideCount <= 20))) {
            console.log('[generate-full-draft] 단일 API 호출 모드 (챕터 무관 순차 생성)');
            const result = await generateAllInOne(fullText, fileName || 'document', template || 'lecture', targetSlideCount);
            console.log(`[generate-full-draft] 완료: "${result.overallTitle}" → ${result.slides.length}장`);

            return NextResponse.json({
                overallTitle: result.overallTitle,
                learningObjectives: result.learningObjectives,
                totalSlides: result.slides.length,
                slides: result.slides,
                styleSuggestions: result.styleSuggestions,
            });
        }

        // 긴 텍스트: 구조 분석 → 챕터별 순차 생성
        console.log('[generate-full-draft] 긴 텍스트 → 챕터별 생성 모드');

        // Phase 1: 구조 분석
        console.log('[generate-full-draft] Phase 1: 구조 분석...');
        const structure = await analyzeStructure(fullText, fileName || 'document', template || 'lecture', targetSlideCount);
        console.log(`[generate-full-draft] 구조: "${structure.overallTitle}" → ${structure.chapters.length}개 챕터`);

        // Phase 2: 슬라이드 콘텐츠 생성
        const allSlides: DraftSlide[] = [];

        // 무조건 최우선 도입 슬라이드: 강의명(cover)
        allSlides.push({
            chapterId: 'all',
            chapterTitle: '',
            slideTitle: structure.overallTitle,
            bodyText: '',
            layout: 'cover',
            slideRole: 'cover',
            speakerNotes: isLecture ? '강의 도입부입니다.' : isSeminar ? '발표 도입부입니다.' : '프레젠테이션 도입부입니다.',
        });

        // 학습목표 슬라이드 (강의만)
        if (isLecture) {
            allSlides.push({
                chapterId: 'all',
                chapterTitle: '',
                slideTitle: '학습목표',
                bulletPoints: structure.learningObjectives,
                layout: 'bullet_list',
                slideRole: 'objectives',
                speakerNotes: '이번 강의의 학습목표를 안내합니다.',
            });
        }

        // 본문 슬라이드 — 구간별 API 호출
        for (let idx = 0; idx < structure.chapters.length; idx++) {
            const chapter = structure.chapters[idx];

            console.log(`[generate-full-draft] Phase 2: 구간 ${idx + 1}/${structure.chapters.length} "${chapter.title}" (${chapter.suggestedSlideCount}장)...`);

            const chapterText = getTextForPageRange(fullText, chapter.pageRange);

            try {
                // 본문 구간은 무조건 section_content 템플릿 지시를 내려 표지/목표가 중복 생성되지 않게 함
                const sectionTemplate = 'section_content';
                const slides = await generateSlidesFromPrompt(
                    chapterText,
                    chapter.title,
                    chapter.suggestedSlideCount,
                    structure.styleSuggestions,
                    sectionTemplate
                );

                for (const slide of slides) {
                    allSlides.push({
                        ...slide,
                        chapterId: 'all',
                        chapterTitle: '',
                        slideRole: 'content',
                    });
                }

                console.log(`[generate-full-draft] "${chapter.title}" → ${slides.length}장 생성 완료`);
            } catch (error) {
                console.error(`[generate-full-draft] "${chapter.title}" 생성 실패:`, error);
                allSlides.push({
                    chapterId: 'all',
                    chapterTitle: '',
                    slideTitle: chapter.title,
                    bulletPoints: ['콘텐츠 생성에 실패했습니다. 직접 편집해주세요.'],
                    layout: 'bullet_list',
                    slideRole: 'content',
                    speakerNotes: '',
                });
            }

            // Gemini rate limit 방지 딜레이 (3초)
            if (idx < structure.chapters.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        // 마무리 슬라이드
        if (isLecture) {
            allSlides.push({
                chapterId: 'all',
                chapterTitle: '',
                slideTitle: '학습 핵심 요약',
                bulletPoints: structure.learningObjectives && structure.learningObjectives.length > 0
                    ? structure.learningObjectives.map(obj => obj.replace(/~?을\s이해한다|~?\s이해한다|~?을\s설명할\s수\s있다/, ' 완료')) // "~을 이해한다" 톤을 정리 톤으로 살짝 보정
                    : structure.chapters.map(ch => `${ch.title} 주요 내용 복습`),
                layout: 'bullet_list',
                slideRole: 'summary',
                speakerNotes: '오늘 배운 핵심 내용들을 다시 한번 되짚어보겠습니다.',
            });
        } else if (isSeminar) {
            allSlides.push({
                chapterId: 'all',
                chapterTitle: '',
                slideTitle: '핵심 요약 & Q&A',
                bulletPoints: ['발표 내용에 대한 질의응답'],
                bodyText: '감사합니다.',
                layout: 'title_body',
                slideRole: 'summary',
                speakerNotes: '질의응답 시간입니다.',
            });
        }

        console.log(`[generate-full-draft] 완료: 총 ${allSlides.length}장`);

        return NextResponse.json({
            overallTitle: structure.overallTitle,
            learningObjectives: structure.learningObjectives,
            totalSlides: allSlides.length,
            slides: allSlides,
            styleSuggestions: structure.styleSuggestions,
        });
    } catch (error) {
        console.error('[generate-full-draft] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : '초안 생성 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
