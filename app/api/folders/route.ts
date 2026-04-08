import { loggedFetch } from '../_logger';

const BE_URL = process.env.API_URL || 'https://localhost:8000';

function getAuthHeaders(request: Request): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const authHeader = request.headers.get('Authorization');
    if (authHeader) headers['Authorization'] = authHeader;
    return headers;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const params = new URLSearchParams();
    if (searchParams.get('cursor')) params.append('cursor', searchParams.get('cursor')!);
    if (searchParams.get('limit')) params.append('limit', searchParams.get('limit')!);

    try {
        const { response, data } = await loggedFetch(
            `${BE_URL}/folders?${params}`, 'GET',
            { method: 'GET', headers: getAuthHeaders(request) }
        );
        return Response.json(data, { status: response.status });
    } catch {
        return Response.json({ error: { code: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' } }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const body = await request.json();
    try {
        const { response, data } = await loggedFetch(
            `${BE_URL}/folders`, 'POST',
            { method: 'POST', headers: getAuthHeaders(request), body: JSON.stringify(body) },
            body
        );
        return Response.json(data, { status: response.status });
    } catch {
        return Response.json({ error: { code: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' } }, { status: 500 });
    }
}
