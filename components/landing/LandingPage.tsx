'use client';

import Link from 'next/link';
import { useTheme } from '../common/ThemeProvider';
import AuthHeader from '../auth/AuthHeader';

export default function LandingPage() {
    const { theme } = useTheme();

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] selection:bg-indigo-500/30 font-sans transition-colors duration-300">
            <AuthHeader />

            {/* Hero Section */}
            <main className="pt-32 pb-20 px-6">
                <div className="max-w-6xl mx-auto text-center">
                    <div className="inline-block px-4 py-1.5 mb-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 text-xs font-bold tracking-widest uppercase animate-fade-in">
                        AI-Powered Meeting Assistant
                    </div>
                    <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-8 leading-[1.1] animate-slide-up">
                        Focus on the <span className="text-indigo-600 italic">Conversation,</span><br />
                        Let AI Handle the <span className="underline decoration-indigo-500/30 decoration-8 underline-offset-8">Details.</span>
                    </h1>
                    <p className="text-xl text-[var(--foreground)] opacity-50 max-w-2xl mx-auto mb-12 leading-relaxed animate-slide-up animation-delay-200">
                        회의의 흐름을 놓치지 마세요. Motiveet이 실시간으로 대화를 기록하고,<br />
                        핵심 주제를 요약하며, 다음 액션 아이템까지 완벽하게 정리해 드립니다.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6 animate-slide-up animation-delay-300">
                        <Link
                            href="/signup"
                            className="w-full sm:w-auto px-10 py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-lg font-black shadow-2xl hover:shadow-indigo-500/40 transition-all hover:scale-105 active:scale-95"
                        >
                            지금 바로 시작하기
                        </Link>
                    </div>

                    {/* Preview Image / Mockup */}
                    <div className="mt-24 relative animate-fade-in animation-delay-500">
                        <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[2.5rem] blur-2xl opacity-20"></div>
                        <div className="relative bg-[var(--card-bg)] rounded-[2rem] border border-[var(--border-color)] shadow-2xl overflow-hidden aspect-video max-w-5xl mx-auto">
                            <div className="flex items-center space-x-2 px-6 py-4 border-b border-[var(--border-color)] bg-[var(--highlight-bg)]">
                                <div className="flex space-x-1.5">
                                    <div className="w-3 h-3 rounded-full bg-rose-500/20"></div>
                                    <div className="w-3 h-3 rounded-full bg-amber-500/20"></div>
                                    <div className="w-3 h-3 rounded-full bg-emerald-500/20"></div>
                                </div>
                            </div>
                            <div className="p-8 flex items-center justify-center h-full">
                                <div className="text-center space-y-6">
                                    <div className="w-20 h-20 bg-indigo-600/10 rounded-3xl flex items-center justify-center mx-auto">
                                        <svg className="w-10 h-10 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                        </svg>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="h-4 w-48 bg-indigo-600/20 rounded-full mx-auto animate-pulse"></div>
                                        <div className="h-4 w-32 bg-indigo-600/10 rounded-full mx-auto animate-pulse animation-delay-200"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Features Footer */}
            <section className="bg-[var(--card-bg)] border-t border-[var(--border-color)] py-20">
                <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12">
                    <div className="space-y-4">
                        <div className="text-indigo-600 font-black text-4xl">01.</div>
                        <h3 className="text-xl font-bold">실시간 주제 감지</h3>
                        <p className="opacity-50 text-sm leading-relaxed">대화의 흐름을 놓치지 마세요. AI가 실시간으로 소주제를 감지하여 가이드해 드립니다.</p>
                    </div>
                    <div className="space-y-4">
                        <div className="text-indigo-600 font-black text-4xl">02.</div>
                        <h3 className="text-xl font-bold">스마트 대화 요약</h3>
                        <p className="opacity-50 text-sm leading-relaxed">회의가 끝나면 AI가 전체 내용을 마크다운 기반의 정교한 리포트로 자동 생성합니다.</p>
                    </div>
                    <div className="space-y-4">
                        <div className="text-indigo-600 font-black text-4xl">03.</div>
                        <h3 className="text-xl font-bold">인터랙티브 AI 채팅</h3>
                        <p className="opacity-50 text-sm leading-relaxed">회의 내용에 대해 궁금한 점이 있다면 언제든 AI에게 질문하고 답변을 받으세요.</p>
                    </div>
                </div>
            </section>
        </div>
    );
}
