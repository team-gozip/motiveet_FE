// Server-side logger for Next.js API proxy routes (FE → BE communication)

const SENSITIVE_PATHS = new Set(['/auth/signin', '/auth/signup']);

function ts() {
    return new Date().toISOString().slice(11, 23);
}

function extractPath(url: string): string {
    try { return new URL(url).pathname; } catch { return url; }
}

/**
 * fetch를 wrapping해서 요청/응답 로그를 출력하고 { response, data }를 반환한다.
 * FormData body는 로그에서 생략된다.
 */
export async function loggedFetch(
    url: string,
    method: string,
    options: RequestInit,
    jsonBody?: unknown
): Promise<{ response: Response; data: unknown }> {
    const path = extractPath(url);
    const isSensitive = SENSITIVE_PATHS.has(path);
    const isFormData = options.body instanceof FormData;

    // ── 요청 로그 ──────────────────────────────────────────────
    console.log(`[${ts()}] [FE→BE] → ${method} ${url}`);
    if (jsonBody && !isSensitive && !isFormData) {
        console.log(`         body: ${JSON.stringify(jsonBody).slice(0, 400)}`);
    } else if (isFormData) {
        console.log(`         body: [FormData]`);
    }

    try {
        const response = await fetch(url, options);
        const data = await response.json().catch(() => null);
        const ok = response.status < 400;
        const icon = ok ? '✓' : '✗';

        // ── 응답 로그 ────────────────────────────────────────────
        console.log(`[${ts()}] [FE→BE] ${icon} ${method} ${url} → ${response.status}`);
        if (!ok) {
            console.error(`         error: ${JSON.stringify(data).slice(0, 400)}`);
        }

        return { response, data };
    } catch (error) {
        console.error(`[${ts()}] [FE→BE] ✗ ${method} ${url} — ${error instanceof Error ? error.message : error}`);
        throw error;
    }
}
