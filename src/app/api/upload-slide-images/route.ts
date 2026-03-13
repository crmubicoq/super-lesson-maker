import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';

const SLIDES_DIR = path.join(process.cwd(), 'public', 'generated', 'slides');

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const files = formData.getAll('images') as File[];

        if (!files || files.length === 0) {
            return NextResponse.json({ error: '이미지 파일이 필요합니다.' }, { status: 400 });
        }

        await mkdir(SLIDES_DIR, { recursive: true });

        const images: { url: string; filename: string }[] = [];

        for (const file of files) {
            if (!file.type.startsWith('image/')) continue;

            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // sharp로 1920x1080 리사이즈 + PNG 변환
            const processed = await sharp(buffer)
                .flatten({ background: { r: 255, g: 255, b: 255 } })
                .resize(1920, 1080, { fit: 'fill' })
                .png()
                .toBuffer();

            const id = `uploaded-${crypto.randomUUID()}`;
            const filename = `${id}.png`;
            const filePath = path.join(SLIDES_DIR, filename);

            await writeFile(filePath, processed);

            const url = `/generated/slides/${filename}`;
            images.push({ url, filename: file.name });

            console.log(`[Upload Slide Image] ${file.name} → ${filePath} (${(processed.length / 1024).toFixed(1)}KB)`);
        }

        return NextResponse.json({ images });
    } catch (error) {
        console.error('[Upload Slide Images Error]', error);
        return NextResponse.json(
            { error: '이미지 업로드 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
