import LoginForm from '@/components/auth/LoginForm';
import AuthHeader from '@/components/auth/AuthHeader';

export default function LoginPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50/50 to-white dark:from-zinc-950 dark:to-zinc-900 flex flex-col transition-colors duration-300">
            <AuthHeader />
            <div className="flex-1 flex items-center justify-center p-4">
                <LoginForm />
            </div>
        </div>
    );
}
