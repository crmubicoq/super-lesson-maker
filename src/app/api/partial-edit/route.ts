import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readFile } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';

export const maxDuration = 180;

const ENV_GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-3-pro-image-preview';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const GENERATED_DIR = path.join(process.cwd(), 'public', 'generated', 'slides');

interface PartialEditRequest {
    existingImageUrl: string;       // 기존 슬라이드 이미지 경로 (/generated/slides/xxx.png)
    instruction: string;            // 사용자 수정 지시
    slideTitle: string;
    bodyText?: string;
    bulletPoints?: string[];
    slideNumber: number;
    totalSlides: number;
    styleDescription: string;
    referenceImageBase64?: string;
}

function buildPartialEditPrompt(req: PartialEditRequest): string {
    let contentSection = `제목: ${req.slideTitle}`;

    if (req.bulletPoints && req.bulletPoints.length > 0) {
        contentSection += '\n\n핵심 포인트:\n' + req.bulletPoints.map((p, i) => `${i + 1}. ${p}`).join('\n');
    }

    if (req.bodyText) {
        contentSection += `\n\n본문: ${req.bodyText}`;
    }

    return `당신은 강의 교안 이미지 디자이너입니다. 첨부된 기존 교안 페이지 이미지를 기반으로 사용자의 수정 지시에 따라 이미지를 수정하세요.

## [최우선 1] 이미지 캔버스 — 반드시 준수
- **이미지 자체가 교안 페이지입니다.** 이미지 안에 다시 종이/공책/카드를 그리지 마세요.
- 이미지 경계 = 페이지 경계. 두 영역은 정확히 같은 크기입니다.
- 배경색(흰색, 연한 색 등)이 이미지의 네 변 끝까지 빈틈없이 채워야 합니다.
- **절대 금지**: 이미지 안에 종이/노트북이 떠 있고 그 바깥에 어두운 배경이 있는 형태. 이미지 전체가 종이 표면이어야 합니다.
- **절대 금지**: 검은색/회색/어두운 테두리, 여백, 그림자, 프레임.
- 비율은 가로 16 : 세로 9 (표준 와이드 화면 비율). 정사각형이나 세로형 금지.

## [최우선 2] 사용자 수정 지시
"""
${req.instruction}
"""

위 지시에 따라 기존 페이지를 수정하되, 명시적으로 변경을 요청하지 않은 부분은 그대로 유지하세요.

## 기존 페이지 정보
${contentSection}

## 디자인 스타일 (유지)
"""
${req.styleDescription}
"""

## 기술 요구사항
1. **(제일 중요) 제공된 '기존 페이지 정보'의 텍스트(제목, 핵심 포인트, 수치 등)를 토씨 하나 틀리지 않고 100% 동일하게 유지해서 그려주세요. 사용자가 명시적으로 텍스트를 고쳐달라고 지시한 경우가 아니라면 절대로 내용을 지어내거나(Hallucination), 요약/수정하지 마세요.**
2. 배경색/패턴이 이미지 가장자리까지 꽉 차는 교안 페이지 (검은 여백 금지)
3. 모든 텍스트는 한국어로 정확하게 렌더링 (오탈자 없이)
4. 기존 스타일과 레이아웃을 최대한 유지하면서 수정 지시만 반영
5. 텍스트는 읽기 쉬운 크기, 배경과의 대비 확보
5. **(절대 주의) 이미지 안에 슬라이드 페이지 번호(예: 1/10 등)를 절대로 적어 넣지 마세요.**

## 주의사항
- 수정 지시에 언급되지 않은 요소는 변경하지 마세요
- 기존 페이지의 전체적인 디자인 톤을 유지하세요
- 수정 후에도 다른 페이지와의 시각적 일관성을 유지하세요
- **절대로 이미지 가장자리에 검은색/어두운 테두리나 빈 공간을 넣지 마세요**`;
}

export async function POST(request: NextRequest) {
    const GEMINI_API_KEY = request.headers.get('X-Gemini-Key') || ENV_GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return NextResponse.json({ error: 'Gemini API 키가 설정되지 않았습니다.' }, { status: 500 });
    }

    try {
        const body: PartialEditRequest = await request.json();

        if (!body.instruction?.trim()) {
            return NextResponse.json({ error: '수정 지시가 비어 있습니다.' }, { status: 400 });
        }

        const prompt = buildPartialEditPrompt(body);

        // 기존 슬라이드 이미지를 base64로 로드
        const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

        if (body.existingImageUrl) {
            try {
                // URL에서 쿼리스트링(?t=...) 제거 후 파일 경로 생성
                const cleanUrl = body.existingImageUrl.split('?')[0];
                const imagePath = path.join(process.cwd(), 'public', cleanUrl);
                const imageBuffer = await readFile(imagePath);
                const base64 = imageBuffer.toString('base64');
                parts.push({
                    inlineData: { mimeType: 'image/png', data: base64 },
                });
            } catch (error) {
                console.warn('[Partial Edit] 기존 이미지 로드 실패, 이미지 없이 진행:', error);
            }
        }

        // 스타일 참고 이미지도 함께 전송
        if (body.referenceImageBase64) {
            const raw = body.referenceImageBase64.replace(/^data:image\/\w+;base64,/, '');
            parts.push({
                inlineData: { mimeType: 'image/png', data: raw },
            });
        }

        parts.push({
            text: parts.length > 0
                ? `[중요] 첫 번째 이미지는 수정할 기존 슬라이드입니다. 이 슬라이드를 기반으로 아래 수정 지시를 적용하세요.\n\n${prompt}`
                : prompt,
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000);

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': GEMINI_API_KEY,
            },
            body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: {
                    responseModalities: ['TEXT', 'IMAGE'],
                },
            }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Partial Edit Error]', response.status, errorText);
            return NextResponse.json(
                { error: `Gemini API 오류: ${response.status}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        const candidates = data.candidates;

        if (!candidates || candidates.length === 0) {
            return NextResponse.json({ error: '이미지 생성 결과가 없습니다.' }, { status: 500 });
        }

        const resultParts = candidates[0].content?.parts || [];
        const imagePart = resultParts.find((p: { inlineData?: { mimeType?: string } }) =>
            p.inlineData?.mimeType?.startsWith('image/')
        );

        if (!imagePart) {
            return NextResponse.json({ error: '수정된 이미지를 찾을 수 없습니다.' }, { status: 500 });
        }

        const { data: base64Data } = imagePart.inlineData;
        const filename = `slide-${crypto.randomUUID()}.png`;

        await mkdir(GENERATED_DIR, { recursive: true });
        const filePath = path.join(GENERATED_DIR, filename);
        const rawBuffer = Buffer.from(base64Data, 'base64');

        // 흰색 배경 flatten 후 1920x1080 리사이즈
        const buffer = await sharp(rawBuffer)
            .flatten({ background: { r: 255, g: 255, b: 255 } })
            .resize(1920, 1080, { fit: 'fill' })
            .png()
            .toBuffer();
        await writeFile(filePath, buffer);

        console.log(`[Partial Edit] "${body.instruction}" → ${filename} (${(buffer.length / 1024).toFixed(1)}KB, 1920x1080)`);

        return NextResponse.json({
            imageUrl: `/generated/slides/${filename}`,
            imageBase64: `data:image/png;base64,${buffer.toString('base64')}`,
        });
    } catch (error) {
        if ((error as Error).name === 'AbortError') {
            return NextResponse.json({ error: '수정 시간 초과 (3분)' }, { status: 504 });
        }
        console.error('[Partial Edit Error]', error);
        return NextResponse.json({ error: '슬라이드 수정 중 오류' }, { status: 500 });
    }
}
