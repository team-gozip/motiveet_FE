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
                    <div className="mb-8 animate-slide-up">
                        <img
                            src={theme === 'dark' ? "/dark_baner.png" : "/white_baner.png"}
                            alt="Motiveet Banner"
                            className="max-w-full h-auto mx-auto"
                        />
                    </div>
                    <p className="text-xl text-[var(--foreground)] opacity-50 max-w-2xl mx-auto mb-12 leading-relaxed animate-slide-up animation-delay-200">
                        회의의 흐름을 놓치지 마세요. Motiveet이 실시간으로 대화를 기록하고,<br />
                        핵심 주제를 요약하며, 다음 액션 아이템까지 완벽하게 정리해 드립니다.
                    </p>

                    <div className="flex flex-col items-center space-y-3 animate-slide-up animation-delay-300">
                        <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
                            <Link
                                href="/signup"
                                className="w-full sm:w-auto px-10 py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-lg font-black shadow-2xl hover:shadow-indigo-500/40 transition-all hover:scale-105 active:scale-95"
                            >
                                지금 바로 시작하기
                            </Link>
                        </div>
                        <p className="text-xs text-[var(--foreground)] opacity-30">
                            데스크탑 PC / 노트북에 최적화되어 있습니다
                        </p>
                    </div>

                    {/* Preview Image / Mockup */}
                    <div className="mt-24 relative animate-fade-in animation-delay-500">
                        <div className="relative bg-[var(--card-bg)] rounded-[2rem] border border-[var(--border-color)] shadow-2xl overflow-hidden aspect-video max-w-5xl mx-auto">
                            <div className="flex items-center space-x-2 px-6 py-4 border-b border-[var(--border-color)] bg-[var(--highlight-bg)]">
                                <div className="flex space-x-1.5">
                                    <div className="w-3 h-3 rounded-full bg-rose-500/20"></div>
                                    <div className="w-3 h-3 rounded-full bg-amber-500/20"></div>
                                    <div className="w-3 h-3 rounded-full bg-emerald-500/20"></div>
                                </div>
                            </div>
                            {/* App layout preview */}
                            <div className="flex h-full text-left text-xs">
                                {/* Sidebar */}
                                <div className="w-48 border-r border-[var(--border-color)] bg-[var(--sidebar-bg)] p-3 space-y-2 flex-shrink-0">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-primary)] opacity-60 px-1 pb-1 border-b border-[var(--border-color)]">회의 목록</div>
                                    {['마케팅 전략 회의', '팀 스프린트 리뷰', 'Q2 기획 논의'].map((title, i) => (
                                        <div key={i} className={`p-2 rounded-lg border text-[var(--foreground)] ${i === 0 ? 'border-[var(--accent-primary)]/30 bg-[var(--highlight-bg)]' : 'border-transparent opacity-50'}`}>
                                            <div className="font-semibold truncate">{title}</div>
                                            {i === 0 && <span className="inline-block mt-1 px-1.5 py-0.5 text-[9px] font-bold bg-[var(--accent-primary)] text-white rounded">진행중</span>}
                                        </div>
                                    ))}
                                </div>
                                {/* Main area */}
                                <div className="flex-1 flex flex-col overflow-hidden">
                                    <div className="flex-1 p-4 space-y-3 overflow-hidden">
                                        {/* Subject card */}
                                        <div className="bg-gradient-to-br from-indigo-600 to-indigo-500 rounded-xl p-4 text-white">
                                            <div className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1">현재 주제</div>
                                            <div className="font-bold text-sm">Q3 마케팅 채널 전략 수립</div>
                                        </div>
                                        {/* AI topics */}
                                        <div className="flex gap-2 flex-wrap">
                                            {['SNS 광고 효율', '콘텐츠 마케팅', '예산 배분'].map((t, i) => (
                                                <span key={i} className="px-2.5 py-1 text-[10px] font-bold border border-[var(--border-color)] rounded-full text-[var(--foreground)] opacity-70">🔍 {t}</span>
                                            ))}
                                        </div>
                                        {/* Chat area */}
                                        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-3 space-y-2">
                                            <div className="flex gap-2 items-start">
                                                <div className="w-5 h-5 rounded-full bg-indigo-100 flex-shrink-0 flex items-center justify-center text-[8px] text-indigo-600 font-bold">AI</div>
                                                <div className="text-[10px] text-[var(--foreground)] opacity-80 bg-[var(--highlight-bg)] rounded-lg px-2.5 py-1.5">SNS 광고의 ROI를 분석한 결과, 인스타그램이 가장 효율적입니다.</div>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Floating controls */}
                                    <div className="p-3 border-t border-[var(--border-color)]">
                                        <div className="flex items-center justify-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                            <span className="text-[10px] font-bold text-[var(--foreground)] opacity-70">녹음 중 · 00:12:34</span>
                                            <button className="px-3 py-1 text-[10px] font-bold bg-[var(--foreground)] text-[var(--background)] rounded-lg">회의 종료</button>
                                        </div>
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
