import { loggedFetch } from '../../../_logger';

const BE_URL = process.env.API_URL || 'http://localhost:8000';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const authHeader = request.headers.get('Authorization');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authHeader) headers['Authorization'] = authHeader;

    try {
        const { response, data } = await loggedFetch(
            `${BE_URL}/meetings/${id}/subject`, 'GET',
            { method: 'GET', headers }
        );
        return Response.json(data, { status: response.status });
    } catch (error) {
        return Response.json(
            { error: { code: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' } },
            { status: 500 }
        );
    }
}
