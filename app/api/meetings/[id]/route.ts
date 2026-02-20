const BE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://222.116.142.95:8000';

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
    try {
        const { id } = await params;
        const response = await fetch(`${BE_URL}/meetings/${id}`, {
            method: 'GET',
            headers: getAuthHeaders(request),
        });

        const data = await response.json();
        return Response.json(data, { status: response.status });
    } catch (error) {
        return Response.json(
            { error: { code: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' } },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const response = await fetch(`${BE_URL}/meetings/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(request),
        });

        const data = await response.json();
        return Response.json(data, { status: response.status });
    } catch (error) {
        return Response.json(
            { error: { code: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' } },
            { status: 500 }
        );
    }
}
