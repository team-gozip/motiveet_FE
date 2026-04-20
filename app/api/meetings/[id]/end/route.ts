import { loggedFetch } from '../../../_logger';

const BE_URL = process.env.API_URL || 'https://localhost:8000';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const authHeader = request.headers.get('Authorization');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authHeader) headers['Authorization'] = authHeader;

    let body: unknown = {};
    try { body = await request.json(); } catch { body = {}; }

    try {
        const { response, data } = await loggedFetch(
            `${BE_URL}/meetings/${id}/end`, 'POST',
            { method: 'POST', headers, body: JSON.stringify(body) },
            body
        );
        return Response.json(data, { status: response.status });
    } catch (error) {
        return Response.json(
            { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' } },
            { status: 500 }
        );
    }
}
