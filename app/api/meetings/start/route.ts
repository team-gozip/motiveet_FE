const BE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://222.116.142.95:8001';

function getAuthHeaders(request: Request): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const authHeader = request.headers.get('Authorization');
    if (authHeader) headers['Authorization'] = authHeader;
    return headers;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const response = await fetch(`${BE_URL}/meetings/start`, {
            method: 'POST',
            headers: getAuthHeaders(request),
            body: JSON.stringify(body),
        });

        const data = await response.json();
        return Response.json(data, { status: response.status });
    } catch (error) {
        return Response.json(
            { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' } },
            { status: 500 }
        );
    }
}
