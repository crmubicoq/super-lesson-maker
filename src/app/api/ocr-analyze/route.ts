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
                            text: `이 이미지에서 텍스트를 인식하고, 시각적으로 가장 가깝게 재현할 수 있도록 타이포그래피 속성을 분석하세요.

분석 항목:
1. text: 정확한 텍스트 내용 (줄바꿈 보존)
2. fontSize: 픽셀 단위 폰트 크기 (숫자만, 이미지 속 글자의 실제 높이를 기준으로)
3. fontWeight: 획이 두꺼우면 "bold", 보통이면 "normal"
4. fontColor: 글자 색상 hex (예: "#000000")
5. fontFamily: 아래 폰트 목록에서 글자의 시각적 특징과 가장 비슷한 것을 선택
6. backgroundColor: 텍스트 바로 뒤의 배경색 hex

[중요] 폰트 선택 기준 — 아래 시각적 특징을 먼저 판단한 후 매칭하세요:

글자 시각적 특징 분석 순서:
A) 획 두께가 매우 굵고 꽉 차 보이는가? → "Black Han Sans" (제목/타이틀에 자주 사용되는 초굵은 고딕)
B) 획 끝에 삐침(세리프)이 있는가? → "Noto Serif KR" 또는 "Nanum Myeongjo"
C) 글자가 둥글둥글하고 귀여운 느낌인가? → "Jua"
D) 글자가 네모 반듯하고 기계적인가? → "Do Hyeon"
E) 일반적인 고딕체(획 끝이 깔끔, 보통~굵은 두께)인가?
   - 깔끔하고 현대적 → "Noto Sans KR"
   - 부드럽고 클래식 → "Nanum Gothic"
   - 기하학적이고 모던 → "IBM Plex Sans KR"
F) 잘 모르겠으면 → "Noto Sans KR" (가장 범용적)

사용 가능한 폰트 (반드시 이 중 하나만 선택):
"Noto Sans KR", "Nanum Gothic", "IBM Plex Sans KR", "Malgun Gothic",
"Noto Serif KR", "Nanum Myeongjo", "Black Han Sans", "Do Hyeon", "Jua"

Return ONLY a JSON object with keys: text, fontSize, fontWeight, fontColor, fontFamily, backgroundColor.
No markdown, no explanation.`
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
