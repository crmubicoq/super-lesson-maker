import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const SLIDES_DIR = path.join(process.cwd(), 'public', 'generated', 'slides');

export async function POST(request: NextRequest) {
    try {
        const { imageData, slideId } = await request.json();

        if (!imageData || !slideId) {
            return NextResponse.json({ error: 'imageData와 slideId가 필요합니다.' }, { status: 400 });
        }

        // data:image/png;base64,... 형식에서 base64 추출
        const matches = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!matches) {
            return NextResponse.json({ error: '잘못된 이미지 데이터 형식입니다.' }, { status: 400 });
        }

        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const base64Data = matches[2];
        const filename = `${slideId}.${ext}`;

        await mkdir(SLIDES_DIR, { recursive: true });
        const filePath = path.join(SLIDES_DIR, filename);
        const buffer = Buffer.from(base64Data, 'base64');
        await writeFile(filePath, buffer);

        console.log(`[Slide Saved] ${filePath} (${(buffer.length / 1024).toFixed(1)}KB)`);

        return NextResponse.json({
            savedPath: `/generated/slides/${filename}`,
        });
    } catch (error) {
        console.error('[Save Slide Error]', error);
        return NextResponse.json(
            { error: '슬라이드 저장 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
