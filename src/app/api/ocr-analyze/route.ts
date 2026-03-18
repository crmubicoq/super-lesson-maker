import { NextRequest, NextResponse } from 'next/server';

const ENV_GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.5-flash';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export const maxDuration = 60;

export async function POST(request: NextRequest) {
    const GEMINI_API_KEY = request.headers.get('X-Gemini-Key') || ENV_GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return NextResponse.json({ error: 'Gemini API 키가 설정되지 않았습니다.' }, { status: 500 });
    }

    try {
        const { imageBase64 } = await request.json();

        if (!imageBase64) {
            return NextResponse.json({ error: '이미지 데이터가 필요합니다.' }, { status: 400 });
        }

        const rawBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': GEMINI_API_KEY,
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        {
                            inlineData: {
                                mimeType: 'image/png',
                                data: rawBase64,
                            },
                        },
                        {
                            text: `Identify the text in this image snippet.
Estimate the following typography properties:
1. The exact text content (preserve line breaks if any).
2. Approximate font size in pixels.
3. Font weight (e.g., "normal", "bold").
4. Dominant text color in hex (e.g., "#000000").
5. Closest font family name (e.g., "sans-serif", "serif", "monospace").
6. Dominant background color in hex behind the text.

Return ONLY a JSON object with keys: text, fontSize, fontWeight, fontColor, fontFamily, backgroundColor.
No markdown, no explanation, just the JSON object.`
                        }
                    ]
                }],
                generationConfig: {
                    temperature: 0.1,
                    responseMimeType: 'application/json',
                }
            })
        });

        if (!response.ok) {
            const errBody = await response.text();
            console.error('[ocr-analyze] API error:', errBody);
            return NextResponse.json({ error: `Gemini API 오류: ${response.status}` }, { status: response.status });
        }

        const data = await response.json();
        const textPart = data.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text);

        if (!textPart?.text) {
            return NextResponse.json({ error: 'OCR 분석 결과가 없습니다.' }, { status: 500 });
        }

        const parsed = JSON.parse(textPart.text);

        return NextResponse.json({
            text: parsed.text || '',
            fontSize: parsed.fontSize || 16,
            fontWeight: parsed.fontWeight || 'normal',
            fontColor: parsed.fontColor || '#000000',
            fontFamily: parsed.fontFamily || 'sans-serif',
            backgroundColor: parsed.backgroundColor || '#ffffff',
        });
    } catch (error) {
        console.error('[ocr-analyze] Error:', error);
        return NextResponse.json({ error: 'OCR 분석 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
