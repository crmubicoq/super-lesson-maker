import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';

// Next.js 라우트 실행 시간 제한 확장 (이미지 생성에 30~60초 소요)
export const maxDuration = 180;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-3-pro-image-preview';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const GENERATED_DIR = path.join(process.cwd(), 'public', 'generated', 'slides');

interface SlideImageRequest {
    slideTitle: string;
    bodyText?: string;
    bulletPoints?: string[];
    slideNumber: number;
    totalSlides: number;
    styleDescription: string;
    referenceImagesBase64?: string[]; // 스타일 참고 이미지 (다중)
}

function buildSlidePrompt(req: SlideImageRequest): string {
    let contentSection = `제목: ${req.slideTitle}`;

    if (req.bulletPoints && req.bulletPoints.length > 0) {
        contentSection += '\n\n핵심 포인트:\n' + req.bulletPoints.map((p, i) => `${i + 1}. ${p}`).join('\n');
    }

    if (req.bodyText) {
        contentSection += `\n\n본문: ${req.bodyText}`;
    }

    const isCover = req.slideNumber === 1;

    return `당신은 강의 교안 이미지 디자이너입니다. 아래 지시에 따라 교안 페이지 이미지를 생성하세요.

## [최우선 1] 이미지 캔버스 — 반드시 준수
- **이미지 자체가 교안 페이지입니다.** 이미지 안에 다시 종이/공책/카드를 그리지 마세요.
- 이미지 경계 = 페이지 경계. 두 영역은 정확히 같은 크기입니다.
- 배경색(흰색, 연한 색 등)이 이미지의 네 변 끝까지 빈틈없이 채워야 합니다.
- **절대 금지**: 이미지 안에 종이/노트북이 떠 있고 그 바깥에 어두운 배경이 있는 형태. 이미지 전체가 종이 표면이어야 합니다.
- **절대 금지**: 검은색/회색/어두운 테두리, 여백, 그림자, 프레임.
- 비율은 가로 16 : 세로 9 (표준 와이드 화면 비율). 정사각형이나 세로형 금지.

## [최우선 2] 디자인 스타일 — 반드시 준수
아래 스타일 지시를 모든 디자인 요소(색상, 배경, 레이아웃, 폰트 느낌, 장식)에 철저히 반영하세요.
이 스타일 지시를 무시하거나 기본 디자인으로 대체하지 마세요.

"""
${req.styleDescription}
"""

이 교안의 전체적인 스타일을 모든 페이지 표면(배경, 색상, 레이아웃)에 일관되게 유지해야 합니다.

## 페이지에 표시할 내용
${contentSection}

## 기술 요구사항
1. **(제일 중요) 제공된 '페이지에 표시할 내용'의 텍스트 원본(특히 수치, 단어, 핵심 포인트)을 토씨 하나 틀리지 않고 100% 동일하게 이미지에 그려넣어야 합니다. AI가 임의로 내용을 지어내거나(Hallucination), 수정/요약하는 행위는 절대 금지됩니다.**
${isCover ? `2. **[표지 슬라이드 특별 규칙] 이 페이지는 강의의 첫 번째 표지(Cover) 슬라이드입니다. 따라서 본문이나 글머리 기호를 절대 임의로 지어내서 그려넣지 마세요. 오직 제공된 제목만 중앙에 아주 크게, 임팩트 있게 배치하세요.**` : `2. 배경색/패턴이 이미지 가장자리까지 꽉 차는 교안 페이지 (검은 여백 금지)`}
3. 모든 텍스트는 한국어로 정확하게 렌더링 (오탈자 없이)
4. 텍스트는 읽기 쉬운 크기, 배경과의 대비 확보
5. **(절대 주의) 이미지 안에 슬라이드 페이지 번호(예: 1/10 등)를 절대로 적어 넣지 마세요.**

## 주의사항
- 스타일 지시에 색상이 명시되어 있다면 그 색상을 사용하세요
- 스타일 지시에 분위기가 명시되어 있다면 그 분위기를 따르세요
- "전문적이고 깔끔한" 같은 일반적 디자인으로 대체하지 마세요
- 이전/이후 페이지와 시각적 일관성을 유지하세요
${isCover ? `- **표지이므로 제목을 화면 정중앙이나 시선이 집중되는 곳에 매우 크고 아름답게 배치하세요.**` : `- 제목을 상단에, 본문 콘텐츠를 넉넉한 공간에 배치하세요`}
- **절대로 이미지 가장자리에 검은색/어두운 테두리나 빈 공간을 넣지 마세요**`;
}

export async function POST(request: NextRequest) {
    if (!GEMINI_API_KEY) {
        return NextResponse.json({ error: 'GEMINI_API_KEY 미설정' }, { status: 500 });
    }

    try {
        const body: SlideImageRequest = await request.json();
        const prompt = buildSlidePrompt(body);

        // 요청 parts 구성 (참고 이미지 있으면 같이 전송)
        const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

        if (body.referenceImagesBase64 && Array.isArray(body.referenceImagesBase64) && body.referenceImagesBase64.length > 0) {
            body.referenceImagesBase64.forEach((imgBase64, idx) => {
                if (!imgBase64) return;
                const raw = imgBase64.replace(/^data:image\/\w+;base64,/, '');
                parts.push({
                    inlineData: { mimeType: 'image/png', data: raw },
                });
            });
            parts.push({
                text: `[중요] 위 이미지들의 디자인 스타일(색상, 레이아웃, 타이포그래피, 장식 요소)을 정확히 참고하여, 아래 내용의 슬라이드를 동일한 스타일로 생성하세요. 제공된 이미지들과 시각적으로 같은 시리즈처럼 보여야 합니다.\n\n${prompt}`,
            });
        } else {
            parts.push({ text: prompt });
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000); // 3분

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
            console.error('[Generate Slide Image Error]', response.status, errorText);
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

        const parts2 = candidates[0].content?.parts || [];
        const imagePart = parts2.find((p: { inlineData?: { mimeType?: string } }) =>
            p.inlineData?.mimeType?.startsWith('image/')
        );

        if (!imagePart) {
            return NextResponse.json({ error: '생성된 이미지를 찾을 수 없습니다.' }, { status: 500 });
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

        console.log(`[Slide Image Generated] ${body.slideTitle} → ${filename} (${(buffer.length / 1024).toFixed(1)}KB, 1920x1080)`);

        return NextResponse.json({
            imageUrl: `/generated/slides/${filename}`,
            imageBase64: `data:image/png;base64,${buffer.toString('base64')}`,
        });
    } catch (error) {
        if ((error as Error).name === 'AbortError') {
            return NextResponse.json({ error: '이미지 생성 시간 초과 (3분)' }, { status: 504 });
        }
        console.error('[Generate Slide Image Error]', error);
        return NextResponse.json({ error: '슬라이드 이미지 생성 중 오류' }, { status: 500 });
    }
}
