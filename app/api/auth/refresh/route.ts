import { loggedFetch } from '../../_logger';

const BE_URL = process.env.API_URL || 'http://localhost:8000';

export async function POST(request: Request) {
    const body = await request.json();
    try {
        const { response, data } = await loggedFetch(
            `${BE_URL}/auth/refresh`, 'POST',
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        );
        return Response.json(data, { status: response.status });
    } catch (error) {
        return Response.json(
            { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' } },
            { status: 500 }
        );
    }
}
