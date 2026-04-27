import { loggedFetch } from '../../_logger';

const BE_URL = process.env.API_URL || 'http://localhost:8000';

function getAuthHeaders(request: Request): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const authHeader = request.headers.get('Authorization');
    if (authHeader) headers['Authorization'] = authHeader;
    return headers;
}

export async function GET(request: Request) {
    try {
        const { response, data } = await loggedFetch(
            `${BE_URL}/meetings/current`, 'GET',
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
