import { NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import path from 'path';

export async function GET() {
    try {
        const baseDir = path.join(process.cwd(), 'outputs');

        // outputs 디렉토리 존재 확인
        let entries;
        try {
            entries = await readdir(baseDir, { withFileTypes: true });
        } catch {
            return NextResponse.json({ projects: [] });
        }

        const projects: {
            folderName: string;
            overallTitle: string;
            slideCount: number;
            savedAt: string | null;
            slideTemplate: string;
        }[] = [];

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;

            const jsonPath = path.join(baseDir, entry.name, 'project.json');
            try {
                const raw = await readFile(jsonPath, 'utf-8');
                const data = JSON.parse(raw);
                projects.push({
                    folderName: entry.name,
                    overallTitle: data.overallTitle || entry.name,
                    slideCount: data.slides?.length || 0,
                    savedAt: data.savedAt || null,
                    slideTemplate: data.slideTemplate || 'lecture',
                });
            } catch {
                continue;
            }
        }

        // 최신 저장순 정렬
        projects.sort((a, b) => {
            if (!a.savedAt) return 1;
            if (!b.savedAt) return -1;
            return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
        });

        return NextResponse.json({ projects });
    } catch (error) {
        console.error('[List Projects Error]', error);
        return NextResponse.json(
            { error: '프로젝트 목록 조회 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
