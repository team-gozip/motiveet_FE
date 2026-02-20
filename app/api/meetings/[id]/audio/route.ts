const BE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://222.116.142.95:8000';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const authHeader = request.headers.get('Authorization');

        // FormData를 그대로 BE로 전달
        const formData = await request.formData();

        const headers: Record<string, string> = {};
        if (authHeader) headers['Authorization'] = authHeader;

        const response = await fetch(`${BE_URL}/meetings/${id}/audio`, {
            method: 'POST',
            headers,
            body: formData,
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
