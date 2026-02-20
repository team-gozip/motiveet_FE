const BE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://222.116.142.95:8001';

function getAuthHeaders(request: Request): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const authHeader = request.headers.get('Authorization');
    if (authHeader) headers['Authorization'] = authHeader;
    return headers;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const cursor = searchParams.get('cursor');
        const limit = searchParams.get('limit');

        const params = new URLSearchParams();
        if (cursor) params.append('cursor', cursor);
        if (limit) params.append('limit', limit);

        const response = await fetch(`${BE_URL}/meetings?${params.toString()}`, {
            method: 'GET',
            headers: getAuthHeaders(request),
        });

        const data = await response.json();
        return Response.json(data, { status: response.status });
    } catch (error) {
        console.error('[API DEBUG] GET /api/meetings error:', error);

        let detailMessage = error instanceof Error ? error.message : '서버 오류가 발생했습니다.';

        // 만약 에러 메시지가 JSON 파싱 오류라면, 백엔드 응답이 JSON이 아님을 의미함
        if (detailMessage.includes('Unexpected token')) {
            detailMessage = `백엔드 응답이 올바른 JSON 형식이 아닙니다 (Internal Server Error 가능성). 상세: ${detailMessage}`;
        }

        return Response.json(
            { success: false, error: { code: 'SERVER_ERROR', message: detailMessage } },
            { status: 500 }
        );
    }
}
