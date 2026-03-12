import { NextRequest, NextResponse } from 'next/server';

const ENV_GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.0-flash';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

/**
 * 스타일 참고 이미지를 Gemini Vision으로 분석하여 StyleProfile 반환
 */
export async function POST(request: NextRequest) {
    const GEMINI_API_KEY = request.headers.get('X-Gemini-Key') || ENV_GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return NextResponse.json({ error: 'Gemini API 키가 설정되지 않았습니다.' }, { status: 500 });
    }

    try {
        const { imagesBase64, textPrompt } = await request.json();

        // 텍스트 프롬프트만 있는 경우 — 이미지 분석 없이 StyleProfile 생성
        if ((!imagesBase64 || imagesBase64.length === 0) && textPrompt) {
            return NextResponse.json({
                styleProfile: {
                    colorPalette: [],
                    layoutStyle: 'custom',
                    typography: '',
                    mood: '',
                    rawDescription: textPrompt,
                },
            });
        }

        if (!imagesBase64 || imagesBase64.length === 0) {
            return NextResponse.json({ error: '이미지 또는 텍스트 프롬프트가 필요합니다.' }, { status: 400 });
        }


        const prompt = `이 프레젠테이션 슬라이드 이미지의 디자인 스타일을 상세히 분석하세요.

다음 항목을 JSON으로 반환하세요:
{
    "colorPalette": ["주요 색상 hex 코드 3-5개"],
    "layoutStyle": "minimal 또는 corporate 또는 creative 또는 elegant 또는 bold 중 하나",
    "typography": "타이포그래피 스타일 설명 (폰트 느낌, 크기 비율, 굵기 등)",
    "mood": "전체적인 분위기 (예: 전문적이고 차분한, 생동감 있고 모던한 등)",
    "rawDescription": "이 슬라이드의 디자인을 재현하기 위한 상세한 설명 (색상, 레이아웃, 여백, 배경, 장식 요소 등)"
}`;

        const imageParts = imagesBase64.map((img: string) => ({
            inlineData: { mimeType: 'image/png', data: img.replace(/^data:image\/\w+;base64,/, '') }
        }));

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': GEMINI_API_KEY,
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        ...imageParts,
                        { text: prompt },
                    ],
                }],
                generationConfig: {
                    responseMimeType: 'application/json',
                    temperature: 0.3,
                },
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Style Analysis Error]', response.status, errorText);
            return NextResponse.json({ error: `Gemini API 오류: ${response.status}` }, { status: response.status });
        }

        const data = await response.json();
        const textPart = data.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text);

        if (!textPart) {
            return NextResponse.json({ error: '스타일 분석 응답이 없습니다.' }, { status: 500 });
        }

        const styleProfile = JSON.parse(textPart.text);
        // 참고 이미지를 styleProfile에 포함 (생성 시 전달용)
        styleProfile.referenceImagesBase64 = imagesBase64;

        console.log(`[Style Analyzed] ${styleProfile.layoutStyle} / ${styleProfile.mood}`);
        return NextResponse.json({ styleProfile });
    } catch (error) {
        console.error('[Analyze Style Error]', error);
        return NextResponse.json({ error: '스타일 분석 중 오류' }, { status: 500 });
    }
}
