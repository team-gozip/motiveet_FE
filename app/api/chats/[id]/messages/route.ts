import { loggedFetch } from '../../../_logger';

const BE_URL = process.env.API_URL || 'http://localhost:8000';

function getAuthHeaders(request: Request): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const authHeader = request.headers.get('Authorization');
    if (authHeader) headers['Authorization'] = authHeader;
    return headers;
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor');
    const limit = searchParams.get('limit');
    const sessionId = searchParams.get('sessionId');
    const queryParams = new URLSearchParams();
    if (cursor) queryParams.append('cursor', cursor);
    if (limit) queryParams.append('limit', limit);
    // sessionId 포워딩: BE가 session 단위로 히스토리를 격리하려면 반드시 필요.
    // 빠지면 BE는 chat_id 전체를 반환해 이전 회의의 메시지까지 섞인다.
    if (sessionId) queryParams.append('sessionId', sessionId);

    try {
        const { response, data } = await loggedFetch(
            `${BE_URL}/chats/${id}/messages?${queryParams.toString()}`, 'GET',
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
