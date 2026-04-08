import { loggedFetch } from '../../../_logger';

const BE_URL = process.env.API_URL || 'https://localhost:8000';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const authHeader = request.headers.get('Authorization');
    const formData = await request.formData();
    const headers: Record<string, string> = {};
    if (authHeader) headers['Authorization'] = authHeader;

    try {
        const { response, data } = await loggedFetch(
            `${BE_URL}/rooms/${id}/audio`, 'POST',
            { method: 'POST', headers, body: formData }
        );
        return Response.json(data, { status: response.status });
    } catch (error) {
        return Response.json(
            { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' } },
            { status: 500 }
        );
    }
}
