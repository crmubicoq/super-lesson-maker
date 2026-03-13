import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { overallTitle, userStyle, slideTemplate, slides } = body;

        if (!overallTitle || !slides || !Array.isArray(slides)) {
            return NextResponse.json(
                { error: 'overallTitle과 slides가 필요합니다.' },
                { status: 400 }
            );
        }

        const safeTitle = overallTitle.replace(/[<>:"/\\|?*]+/g, '_').trim();
        const baseDir = path.join(process.cwd(), 'outputs');
        const folderDir = path.join(baseDir, safeTitle);

        await mkdir(folderDir, { recursive: true });

        // base64 필드 제거 (용량 절감)
        const cleanSlides = slides.map((s: Record<string, unknown>) => {
            const { generatedImageBase64, finalCapturedBase64, ...rest } = s;
            return rest;
        });

        const projectData = {
            version: 1,
            savedAt: new Date().toISOString(),
            overallTitle,
            userStyle: userStyle || '',
            slideTemplate: slideTemplate || 'lecture',
            slides: cleanSlides,
        };

        const jsonPath = path.join(folderDir, 'project.json');
        await writeFile(jsonPath, JSON.stringify(projectData, null, 2), 'utf-8');

        console.log(`[Project Saved] ${jsonPath} (${cleanSlides.length} slides)`);

        return NextResponse.json({
            success: true,
            savedAt: projectData.savedAt,
        });
    } catch (error) {
        console.error('[Save Project Error]', error);
        return NextResponse.json(
            { error: '프로젝트 저장 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
