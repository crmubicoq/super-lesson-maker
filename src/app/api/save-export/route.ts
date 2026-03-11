import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const title = formData.get('title') as string;
        const pdfFile = formData.get('pdfFile') as File | Blob | null;
        const pptxBase64 = formData.get('pptxBase64') as string | null;

        if (!title || !pdfFile || !pptxBase64) {
            return NextResponse.json({ error: 'title, pdfFile and pptxBase64 are required' }, { status: 400 });
        }

        // 폴더명 안전성 보장 (운영체제에서 올바르지 않은 특수문자 제거)
        const safeTitle = title.replace(/[<>:"/\\|?*]+/g, '_').trim();

        // 현재 작업 디렉토리 기준 'outputs' 폴더 지정
        const baseDir = path.join(process.cwd(), 'outputs');
        const folderDir = path.join(baseDir, safeTitle);

        // 폴더 존재 여부 확인 및 생성
        await fs.mkdir(baseDir, { recursive: true });
        await fs.mkdir(folderDir, { recursive: true });

        // PDF 파일 저장 (Blob -> ArrayBuffer -> Buffer)
        const pdfArrayBuffer = await pdfFile.arrayBuffer();
        const pdfBuffer = Buffer.from(pdfArrayBuffer);
        const pdfFilePath = path.join(folderDir, `Lecture_Slide_${safeTitle}.pdf`);
        await fs.writeFile(pdfFilePath, pdfBuffer);

        // PPTX 파일 저장 (Base64 -> Buffer)
        const pptxCleanBase64 = pptxBase64.includes('base64,') ? pptxBase64.split('base64,')[1] : pptxBase64;
        const pptxBuffer = Buffer.from(pptxCleanBase64, 'base64');
        const pptxFilePath = path.join(folderDir, `Lecture_Slide_${safeTitle}.pptx`);
        await fs.writeFile(pptxFilePath, pptxBuffer);

        // 선택적: 생성된 개별 슬라이드 이미지 저장
        const imagesDir = path.join(folderDir, 'slides');
        let hasImages = false;

        // FormData 키를 순회하며 slide_N 형식의 Blob 파일들 추출 및 저장
        for (const [key, value] of formData.entries()) {
            if (key.startsWith('slide_') && typeof value === 'object' && 'arrayBuffer' in value) {
                if (!hasImages) {
                    await fs.mkdir(imagesDir, { recursive: true });
                    hasImages = true;
                }

                // key 예: 'slide_0', 'slide_1' ...
                const indexStr = key.replace('slide_', '');
                const index = parseInt(indexStr, 10);
                const slideNumStr = String(index + 1).padStart(2, '0');

                const imgArrayBuffer = await (value as Blob).arrayBuffer();
                const imgBuffer = Buffer.from(imgArrayBuffer);
                const imgPath = path.join(imagesDir, `slide_${slideNumStr}.png`);
                await fs.writeFile(imgPath, imgBuffer);
            }
        }

        const absolutePath = path.resolve(folderDir);

        return NextResponse.json({
            success: true,
            message: 'PDF 및 슬라이드가 서버의 outputs 폴더에 성공적으로 저장되었습니다.',
            folderPath: absolutePath
        });

    } catch (err: any) {
        console.error('Error saving export (FormData):', err);
        return NextResponse.json({ error: typeof err === 'string' ? err : err.message }, { status: 500 });
    }
}
