import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.0-flash';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

/**
 * 생성된 슬라이드 이미지에서 텍스트를 추출하고 원본과 비교하여 검증
 */
export async function POST(request: NextRequest) {
    if (!GEMINI_API_KEY) {
        return NextResponse.json({ error: 'GEMINI_API_KEY 미설정' }, { status: 500 });
    }

    try {
        const { imageBase64, expectedTitle, expectedBullets, expectedBodyText } = await request.json();

        if (!imageBase64) {
            return NextResponse.json({ error: '검증할 이미지가 필요합니다.' }, { status: 400 });
        }

        const raw = imageBase64.replace(/^data:image\/\w+;base64,/, '');

        let expectedText = `제목: ${expectedTitle || ''}`;
        if (expectedBullets && expectedBullets.length > 0) {
            expectedText += '\n포인트: ' + expectedBullets.join(', ');
        }
        if (expectedBodyText) {
            expectedText += `\n본문: ${expectedBodyText}`;
        }

        const prompt = `이 슬라이드 이미지에 표시된 모든 텍스트를 정확히 추출하세요.
그리고 아래 원본 텍스트와 비교하여 정확도를 평가하세요.

## 원본 텍스트 (기대값)
## 평가 기준 (매우 엄격)
- 원본 텍스트에 없는 내용(새로운 불릿 포인트, 문장, 단어 등)이 이미지에 추가로 생성되었다면 치명적인 오류입니다. (contentAccuracy 대폭 감점)
- 원본 텍스트 내용이 요약되거나 누락되어도 감점입니다.

## 응답 형식 (JSON)
{
    "extractedTitle": "이미지에서 추출한 제목",
    "extractedTexts": ["이미지에서 추출한 기타 텍스트들"],
    "titleMatch": true 또는 false,
    "contentAccuracy": 0~100 (원본 텍스트와 이미지 텍스트의 일치도. 원문에 없는 추가된 내용이 있다면 50점 이하로 평가),
    "issues": ["발견된 문제점들 (원문에 없는 내용 임의 추가, 임의 요약, 누락, 문장 변형 등. 완벽히 똑같다면 빈 배열)"]
}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': GEMINI_API_KEY,
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { inlineData: { mimeType: 'image/png', data: raw } },
                        { text: prompt },
                    ],
                }],
                generationConfig: {
                    responseMimeType: 'application/json',
                    temperature: 0.1,
                },
            }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error('[Text Validation Error]', response.status);
            return NextResponse.json({ error: `Gemini API 오류: ${response.status}` }, { status: response.status });
        }

        const data = await response.json();
        const textPart = data.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text);

        if (!textPart) {
            return NextResponse.json({ error: '검증 응답이 없습니다.' }, { status: 500 });
        }

        const validation = JSON.parse(textPart.text);

        // 매우 엄격한 통과 기준: 제목 일치 & 정확도 90 이상 & 이슈가 없거나 사소한 1개 이하일 것
        const passed = validation.titleMatch && validation.contentAccuracy >= 90 && (!validation.issues || validation.issues.length === 0);

        console.log(`[Text Validation] "${expectedTitle}" → accuracy: ${validation.contentAccuracy}% / passed: ${passed}`);

        return NextResponse.json({
            ...validation,
            passed,
        });
    } catch (error) {
        if ((error as Error).name === 'AbortError') {
            return NextResponse.json({ error: '텍스트 검증 시간 초과 (1분)' }, { status: 504 });
        }
        console.error('[Validate Text Error]', error);
        return NextResponse.json({ error: '텍스트 검증 중 오류' }, { status: 500 });
    }
}
