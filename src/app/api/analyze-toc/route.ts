import { NextRequest, NextResponse } from 'next/server';
import { generateText, getAIConfigFromHeaders } from '@/utils/aiProvider';

export const maxDuration = 60;

function buildTOCPrompt(fullText: string, fileName: string): string {
    return `당신은 교육 콘텐츠 전문 분석가입니다.
아래 원고 텍스트를 분석하여 프레젠테이션 강의를 위한 목차(챕터 구성)를 생성하세요.

## 원고 파일명
${fileName}

## 원고 텍스트
${fullText.substring(0, 8000)}

## 분석 지침
1. 원고의 논리적 흐름과 주제 전환을 파악하여 3~6개의 챕터로 나누세요
2. 각 챕터 제목은 원고의 핵심 주제를 반영한 명확하고 간결한 한국어 제목이어야 합니다
3. 원고에 명시적 장/절 구분이 있으면 그것을 우선 활용하세요
4. 명시적 구분이 없으면 내용의 주제 전환점을 기준으로 논리적으로 나누세요
5. 각 챕터에 해당하는 페이지 범위를 지정하세요 (텍스트에 [Page N] 마커가 있으면 활용)
6. 스타일 제안: 원고 내용에 어울리는 프레젠테이션 디자인 스타일을 한 줄로 제안하세요

## 출력 형식 (JSON)
{
  "chapters": [
    {
      "title": "챕터 제목",
      "pageRange": "1-5"
    }
  ],
  "summary": "원고 전체 요약 (1-2문장)",
  "styleSuggestions": "디자인 스타일 제안"
}

## 필수 규칙
1. 모든 텍스트는 한국어
2. 챕터 제목은 20자 이내로 간결하게
3. 챕터는 최소 3개, 최대 6개
4. pageRange는 "시작페이지-끝페이지" 형식 (예: "1-5", "6-12")
5. 마지막 챕터의 끝 페이지는 전체 페이지 수와 일치해야 함
6. [Page N] 마커가 없는 경우 전체를 균등 분할
7. 제목에 "[Page", "섹션", "번 섹션" 같은 메타 문자열 사용 금지`;
}

interface ChapterItem {
    title?: string;
    pageRange?: string;
}

export async function POST(request: NextRequest) {
    const config = getAIConfigFromHeaders(request.headers);

    if (!config.apiKey) {
        return NextResponse.json(
            { error: 'API 키가 설정되지 않았습니다. 상단 설정에서 API 키를 입력해주세요.' },
            { status: 500 }
        );
    }

    try {
        const { fullText, fileName } = await request.json();

        if (!fullText) {
            return NextResponse.json(
                { error: 'fullText가 필요합니다.' },
                { status: 400 }
            );
        }

        const prompt = buildTOCPrompt(fullText, fileName || 'document');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000);

        let rawResponse: string;
        try {
            rawResponse = await generateText(config, prompt, {
                temperature: 0.5,
                jsonMode: true,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
        } catch (fetchError) {
            clearTimeout(timeoutId);
            if ((fetchError as Error).name === 'AbortError') {
                return NextResponse.json({ error: '요청 시간 초과 (45초)' }, { status: 504 });
            }
            throw fetchError;
        }

        let parsed: { chapters?: ChapterItem[]; summary?: string; styleSuggestions?: string };
        try {
            const cleanText = rawResponse.replace(/^```json\s*/m, '').replace(/```\s*$/m, '').trim();
            parsed = JSON.parse(cleanText);
        } catch {
            console.error('[JSON Parse Error]', rawResponse?.substring(0, 200));
            return NextResponse.json({ error: 'AI 응답 JSON 파싱 실패' }, { status: 500 });
        }

        // chapters 배열 추출
        let chapters: ChapterItem[] = [];
        if (Array.isArray(parsed)) {
            chapters = parsed;
        } else if (parsed.chapters && Array.isArray(parsed.chapters)) {
            chapters = parsed.chapters;
        } else {
            return NextResponse.json({ error: '올바른 챕터 배열이 아닙니다.' }, { status: 500 });
        }

        // 총 페이지 수 계산
        const pageMatches = fullText.match(/\[Page [0-9]+\]/g);
        const totalPages = pageMatches ? pageMatches.length : 10;

        // TOCItem 형태로 변환 + 검증
        const toc = chapters.map((ch: ChapterItem, idx: number) => ({
            id: String(idx + 1),
            title: (ch.title || `섹션 ${idx + 1}`).substring(0, 30),
            pageRange: ch.pageRange || `${Math.floor((totalPages / chapters.length) * idx) + 1}-${Math.floor((totalPages / chapters.length) * (idx + 1))}`,
        }));

        console.log(`[TOC Analyzed] ${fileName} → ${toc.length}개 챕터: [${toc.map((t: { title: string }) => t.title).join(', ')}]`);

        return NextResponse.json({
            toc,
            summary: parsed.summary || 'AI가 문서의 구조를 분석하여 최적의 강의 흐름을 설계했습니다.',
            styleSuggestions: parsed.styleSuggestions || 'Professional, Minimalist',
        });
    } catch (error) {
        console.error('[Analyze TOC Error]', error);
        return NextResponse.json(
            { error: '목차 분석 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
