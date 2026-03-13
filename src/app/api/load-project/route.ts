import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
    try {
        const folderName = request.nextUrl.searchParams.get('folder');
        if (!folderName) {
            return NextResponse.json(
                { error: 'folder 파라미터가 필요합니다.' },
                { status: 400 }
            );
        }

        const safeFolder = folderName.replace(/[<>:"/\\|?*]+/g, '_').trim();
        const jsonPath = path.join(process.cwd(), 'outputs', safeFolder, 'project.json');

        const raw = await readFile(jsonPath, 'utf-8');
        const project = JSON.parse(raw);

        return NextResponse.json({ project });
    } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
            return NextResponse.json(
                { error: '프로젝트를 찾을 수 없습니다.' },
                { status: 404 }
            );
        }
        console.error('[Load Project Error]', error);
        return NextResponse.json(
            { error: '프로젝트 로드 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
