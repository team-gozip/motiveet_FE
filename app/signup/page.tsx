import SignupForm from '@/components/auth/SignupForm';
import AuthHeader from '@/components/auth/AuthHeader';

export default function SignupPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 dark:from-zinc-950 dark:to-zinc-900 flex flex-col transition-colors duration-300">
            <AuthHeader />
            <div className="flex-1 flex items-center justify-center p-4">
                <SignupForm />
            </div>
        </div>
    );
}
