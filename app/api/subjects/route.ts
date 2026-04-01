import { loggedFetch } from '../_logger';

const BE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://222.116.142.95:8001';

function getAuthHeaders(request: Request): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const authHeader = request.headers.get('Authorization');
    if (authHeader) headers['Authorization'] = authHeader;
    return headers;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor');
    const limit = searchParams.get('limit');
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    if (limit) params.append('limit', limit);

    try {
        const { response, data } = await loggedFetch(
            `${BE_URL}/subjects?${params.toString()}`, 'GET',
            { method: 'GET', headers: getAuthHeaders(request) }
        );
        return Response.json(data, { status: response.status });
    } catch (error) {
        return Response.json(
            { error: { code: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' } },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    const body = await request.json();
    try {
        const { response, data } = await loggedFetch(
            `${BE_URL}/subjects`, 'POST',
            { method: 'POST', headers: getAuthHeaders(request), body: JSON.stringify(body) },
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
