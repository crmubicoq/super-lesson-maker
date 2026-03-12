import { NextRequest, NextResponse } from 'next/server';

const ENV_GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.5-flash'; // Google의 최신 멀티모달 모델
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// Next.js max duration 설정 (OCR 작업은 시간이 다소 걸릴 수 있음)
export const maxDuration = 300;

export async function POST(req: NextRequest) {
    const GEMINI_API_KEY = req.headers.get('X-Gemini-Key') || ENV_GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return NextResponse.json(
            { error: 'Gemini API 키가 설정되지 않았습니다.' },
            { status: 500 }
        );
    }

    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file || file.type !== 'application/pdf') {
            return NextResponse.json({ error: '유효한 PDF 파일이 전송되지 않았습니다.' }, { status: 400 });
        }

        console.log(`[extract-pdf-ocr] 시작: ${file.name} (${Math.round(file.size / 1024)}KB) - Gemini 2.5 Flash OCR 작동`);

        // 파일을 Base64로 변환
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Data = buffer.toString('base64');

        // Gemini 2.5 Flash에 Vision OCR 요청 프롬프트 구성
        const prompt = `당신은 문서 텍스트 추출 전문가입니다.
첨부된 PDF 문서(스캔본 또는 이미지 파일일 수 있음)의 모든 페이지를 꼼꼼하게 읽고, 문서 내에 있는 모든 텍스트를 추출해 주세요.
추출할 때 다음 규칙을 지켜주세요:
1. 문서에 있는 텍스트만 정확하게 추출하고, 절대로 텍스트를 요약하거나 당신의 생각을 덧붙이지 마세요.
2. 각 페이지의 내용이 시작될 때마다 "[Page N]" 형태의 마커를 달아주세요. (단, 페이지 구분이 어려울 경우 그냥 순차적으로 텍스트만 나열해도 됩니다)`;

        // Gemini REST API 호출
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': GEMINI_API_KEY,
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: prompt },
                            {
                                inlineData: {
                                    mimeType: 'application/pdf',
                                    data: base64Data
                                }
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.1, // 무조건 원본 내용만 가져오도록 매우 낮게 설정
                }
            })
        });

        if (!response.ok) {
            const errBody = await response.text();
            console.error('[extract-pdf-ocr] API 실패 응답:', errBody);
            throw new Error(`Gemini API 오류: ${response.status}`);
        }

        const data = await response.json();
        const textPart = data.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text);

        if (!textPart?.text) {
            throw new Error('문서에서 텍스트를 추출하지 못했습니다. (빈 응답)');
        }

        const extractedText = textPart.text;
        console.log(`[extract-pdf-ocr] 성공: ${extractedText.length}자 추출 완료`);

        return NextResponse.json({ text: extractedText });

    } catch (error: any) {
        console.error('[extract-pdf-ocr] 과정 중 오류:', error);
        return NextResponse.json({ error: error.message || 'PDF OCR 처리 중 알 수 없는 오류가 발생했습니다.' }, { status: 500 });
    }
}
