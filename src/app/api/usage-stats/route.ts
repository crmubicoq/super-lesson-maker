import { NextResponse } from 'next/server';
import { getUsageSummary } from '@/utils/usageTracker';

export async function GET() {
    const summary = await getUsageSummary();
    return NextResponse.json(summary);
}
