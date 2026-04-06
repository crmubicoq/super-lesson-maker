import { NextRequest, NextResponse } from 'next/server';
import {
    CHUNK_SIZE,
    extractKeyPoints,
    buildBatchPrompt,
    validateSlide,
    SlideContent,
} from '@/utils/serverSlideUtils';
import { generateText, getAIConfigFromHeaders } from '@/utils/aiProvider';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
    const config = getAIConfigFromHeaders(request.headers);

    if (!config.apiKey) {
        return NextResponse.json(
            { error: 'API 키가 설정되지 않았습니다. 상단 설정에서 API 키를 입력해주세요.' },
            { status: 500 }
        );
    }

    try {
        const { rawText, sectionTitle, slidesPerSection, userStyle, template } = await request.json();

        console.log(`[generate-slide-content] rawText: ${rawText?.length || 0}자, sectionTitle: "${sectionTitle}", slidesPerSection: ${slidesPerSection}, template: ${template || 'lecture'}`);

        if (!sectionTitle || !slidesPerSection) {
            return NextResponse.json(
                { error: 'sectionTitle, slidesPerSection이 필요합니다.' },
                { status: 400 }
            );
        }

        // Progressive Summarization: 4000자 초과 시 핵심 추출 선행
        let processedText = rawText || '';
        if (processedText.length > CHUNK_SIZE) {
            console.log(`[generate-slide-content] 원고 ${processedText.length}자 > ${CHUNK_SIZE}자 → Progressive Summarization 적용`);
            processedText = await extractKeyPoints(processedText, sectionTitle, config);
        }

        const prompt = buildBatchPrompt(processedText, sectionTitle, slidesPerSection, userStyle || '', template || 'lecture');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        let rawResponse: string;
        try {
            rawResponse = await generateText(config, prompt, {
                temperature: 0.7,
                jsonMode: true,
                signal: controller.signal,
                traceName: 'generate-slide-content',
            });
            clearTimeout(timeoutId);
        } catch (fetchError) {
            clearTimeout(timeoutId);
            if ((fetchError as Error).name === 'AbortError') {
                return NextResponse.json({ error: '요청 시간 초과 (60초)' }, { status: 504 });
            }
            throw fetchError;
        }

        let parsed: { slides?: SlideContent[] };
        try {
            const cleanText = rawResponse.replace(/^```json\s*/m, '').replace(/```\s*$/m, '').trim();
            parsed = JSON.parse(cleanText);
        } catch {
            console.error('[JSON Parse Error]', rawResponse?.substring(0, 200));
            return NextResponse.json({ error: 'AI 응답 JSON 파싱 실패' }, { status: 500 });
        }

        let slides: SlideContent[] = [];
        if (Array.isArray(parsed)) {
            slides = parsed;
        } else if (parsed.slides && Array.isArray(parsed.slides)) {
            slides = parsed.slides;
        } else {
            console.error('[Invalid Response Structure]', Object.keys(parsed));
            return NextResponse.json({ error: '올바른 슬라이드 배열이 아닙니다.' }, { status: 500 });
        }

        const validated = slides.map((slide, i) => validateSlide(slide, i, slides.length, template || 'lecture'));

        const layouts = validated.map(s => s.layout);
        console.log(`[Section Slides Generated] ${sectionTitle} → ${validated.length}장: [${layouts.join(', ')}]`);

        return NextResponse.json({ slides: validated });
    } catch (error) {
        console.error('[Generate Slide Content Error]', error);
        return NextResponse.json(
            { error: '슬라이드 콘텐츠 생성 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
