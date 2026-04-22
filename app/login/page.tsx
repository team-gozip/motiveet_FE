import LoginForm from '@/components/auth/LoginForm';
import AuthHeader from '@/components/auth/AuthHeader';

export default function LoginPage() {
    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col">
            <AuthHeader />
            <div className="flex-1 flex items-center justify-center px-4 py-16">
                <LoginForm />
            </div>
        </div>
    );
}
