import { NextRequest, NextResponse } from 'next/server';
import {
    CHUNK_SIZE,
    extractKeyPoints,
    buildBatchPrompt,
    validateSlide,
    SlideContent,
} from '@/utils/serverSlideUtils';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.0-flash';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export const maxDuration = 60;

export async function POST(request: NextRequest) {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your-api-key-here') {
        return NextResponse.json(
            { error: 'GEMINI_API_KEY가 설정되지 않았습니다.' },
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
            processedText = await extractKeyPoints(processedText, sectionTitle);
        }

        const prompt = buildBatchPrompt(processedText, sectionTitle, slidesPerSection, userStyle || '', template || 'lecture');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        let response: Response;
        try {
            response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': GEMINI_API_KEY,
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
        } catch (fetchError) {
            clearTimeout(timeoutId);
            if ((fetchError as Error).name === 'AbortError') {
                return NextResponse.json({ error: '요청 시간 초과 (60초)' }, { status: 504 });
            }
            throw fetchError;
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Gemini Text API Error]', response.status, errorText);
            return NextResponse.json(
                { error: `Gemini API 오류: ${response.status}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        const candidates = data.candidates;

        if (!candidates || candidates.length === 0) {
            return NextResponse.json({ error: '응답이 없습니다.' }, { status: 500 });
        }

        const textPart = candidates[0].content?.parts?.find((p: { text?: string }) => p.text);
        if (!textPart) {
            return NextResponse.json({ error: '텍스트 응답을 찾을 수 없습니다.' }, { status: 500 });
        }

        let parsed: { slides?: SlideContent[] };
        try {
            parsed = JSON.parse(textPart.text);
        } catch {
            console.error('[JSON Parse Error]', textPart.text?.substring(0, 200));
            return NextResponse.json({ error: 'Gemini 응답 JSON 파싱 실패' }, { status: 500 });
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
