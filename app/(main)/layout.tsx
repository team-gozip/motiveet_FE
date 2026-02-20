import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function Layout({ children }: { children: React.ReactNode }) {
    // 간단한 서버 사이드 인증 체크 (쿠키 기반)
    // 실제로는 미들웨어나 더 정교한 로직이 필요할 수 있음
    // 여기서는 클라이언트 사이드 체크를 보완하는 역할
    return (
        <div className="min-h-screen bg-[var(--background)]">
            {children}
        </div>
    );
}
