import { loggedFetch } from '../../_logger';

const BE_URL = process.env.API_URL || 'https://localhost:8000';

export async function POST(request: Request) {
    const body = await request.json();
    const authHeader = request.headers.get('Authorization');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authHeader) headers['Authorization'] = authHeader;

    try {
        const { response, data } = await loggedFetch(
            `${BE_URL}/auth/signup`, 'POST',
            { method: 'POST', headers, body: JSON.stringify(body) },
            body
        );
        return Response.json(data, { status: response.status });
    } catch (error) {
        return Response.json(
            { success: false, error: { code: 'SERVER_ERROR', message: error instanceof Error ? error.message : '서버 오류가 발생했습니다.' } },
            { status: 500 }
        );
    }
}
