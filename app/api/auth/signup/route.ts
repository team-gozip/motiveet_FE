const BE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://222.116.142.95:8001';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const authHeader = request.headers.get('Authorization');

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (authHeader) headers['Authorization'] = authHeader;

        const response = await fetch(`${BE_URL}/auth/signup`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[API DEBUG] BE Signup Error Response:', {
                status: response.status,
                data: data
            });
        }

        return Response.json(data, { status: response.status });
    } catch (error) {
        console.error('[API DEBUG] Signup Error:', error);
        return Response.json(
            { success: false, error: { code: 'SERVER_ERROR', message: error instanceof Error ? error.message : '서버 오류가 발생했습니다.' } },
            { status: 500 }
        );
    }
}
