import { loggedFetch } from '../../../_logger';

const BE_URL = process.env.API_URL || 'https://localhost:8000';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const headers: Record<string, string> = {};
    const authHeader = request.headers.get('Authorization');
    if (authHeader) headers['Authorization'] = authHeader;

    try {
        const { response, data } = await loggedFetch(
            `${BE_URL}/notifications/${id}/read`, 'POST',
            { method: 'POST', headers }
        );
        return Response.json(data, { status: response.status });
    } catch {
        return Response.json({ error: { code: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' } }, { status: 500 });
    }
}
