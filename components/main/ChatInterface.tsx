'use client';

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { chatApi } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const toKST = (timestamp: string) => {
    const ts = timestamp.endsWith('Z') || timestamp.includes('+') ? timestamp : timestamp + 'Z';
    return new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' });
};

interface ChatMessage {
    messageId: number;
    role: 'user' | 'assistant';
    text?: string;
    image?: string;
    timestamp: string;
}

interface ChatInterfaceProps {
    chatId: number | null;
    sessionId?: number | null;
    isMeetingActive: boolean;
}

const ChatInterface = forwardRef(function ChatInterface(props: ChatInterfaceProps, ref) {
    const { chatId, sessionId, isMeetingActive } = props;
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatId) {
            loadChatHistory();
        } else {
            setMessages([]);
        }
    }, [chatId, sessionId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useImperativeHandle(ref, () => ({
        handleResearch: async (topic: string) => {
            if (!chatId || isLoading || !isMeetingActive) return;
            setIsLoading(true);
            try {
                const userResponse = await chatApi.requestResearch(chatId, topic, sessionId ?? null);
                setMessages(prev => [...prev, {
                    messageId: userResponse.messageId,
                    role: 'user',
                    text: userResponse.text,
                    timestamp: userResponse.timestamp,
                }]);

                const aiResponse = await chatApi.getAnswer(userResponse.messageId);
                setMessages(prev => [...prev, {
                    messageId: aiResponse.messageId,
                    role: 'assistant',
                    text: aiResponse.text,
                    image: aiResponse.image,
                    timestamp: aiResponse.timestamp,
                }]);
            } catch (error) {
                console.error('Failed research request:', error);
            } finally {
                setIsLoading(false);
            }
        }
    }));

    const loadChatHistory = async () => {
        if (!chatId) return;
        try {
            const response = await chatApi.getHistory(chatId, undefined, 50, sessionId ?? null);
            setMessages(response?.messages && Array.isArray(response.messages) ? response.messages : []);
        } catch {
            setMessages([]);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || !chatId || isLoading || !isMeetingActive) return;

        const userMessage = input.trim();
        setInput('');
        setIsLoading(true);

        try {
            const userResponse = await chatApi.sendMessage(chatId, userMessage, undefined, sessionId ?? null);
            setMessages(prev => [...prev, {
                messageId: userResponse.messageId,
                role: 'user',
                text: userMessage,
                timestamp: userResponse.timestamp,
            }]);

            const aiResponse = await chatApi.getAnswer(userResponse.messageId);
            setMessages(prev => [...prev, {
                messageId: aiResponse.messageId,
                role: 'assistant',
                text: aiResponse.text,
                image: aiResponse.image,
                timestamp: aiResponse.timestamp,
            }]);
        } catch (error) {
            console.error('Failed to send message:', error);
            setMessages(prev => [...prev, {
                messageId: Date.now(),
                role: 'assistant',
                text: '죄송합니다. 메시지 전송에 실패했습니다.',
                timestamp: new Date().toISOString(),
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!chatId) {
        return (
            <div className="h-full flex items-center justify-center bg-[var(--card-bg)]">
                <p className="text-xs text-[var(--text-tertiary)]">채팅을 불러오는 중...</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-[var(--card-bg)]">
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.length === 0 && !isLoading && (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center max-w-[220px]">
                            <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
                                {isMeetingActive
                                    ? '회의 내용에 대해 궁금한 점을 물어보세요.'
                                    : '회의가 시작되면 AI 채팅을 사용할 수 있습니다.'}
                            </p>
                        </div>
                    </div>
                )}

                {messages.map((message) => (
                    <div key={message.messageId} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                            className={`max-w-[85%] px-3 py-2 rounded-lg text-sm leading-relaxed ${
                                message.role === 'user'
                                    ? 'bg-[var(--accent-primary)] text-white'
                                    : 'bg-[var(--highlight-bg)] text-[var(--foreground)]'
                            }`}
                        >
                            {message.text && (
                                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-p:leading-relaxed">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            a: ({ href, children }) => (
                                                <a
                                                    href={href}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={`underline ${message.role === 'user' ? 'text-white/90' : 'text-[var(--accent-primary)]'}`}
                                                >
                                                    {children}
                                                </a>
                                            ),
                                        }}
                                    >
                                        {message.text}
                                    </ReactMarkdown>
                                </div>
                            )}
                            {message.image && (
                                <img src={message.image} alt="" className="mt-2 rounded max-w-full" />
                            )}
                            <p className={`text-[10px] mt-1 ${message.role === 'user' ? 'text-white/60' : 'text-[var(--text-tertiary)]'}`}>
                                {toKST(message.timestamp)}
                            </p>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-[var(--highlight-bg)] px-3 py-2.5 rounded-lg">
                            <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)] animate-bounce" />
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)] animate-bounce" style={{ animationDelay: '0.15s' }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)] animate-bounce" style={{ animationDelay: '0.3s' }} />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="flex-shrink-0 border-t border-[var(--border-color)] p-3">
                <div className="flex items-end gap-2">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={isMeetingActive ? '메시지 입력...' : '회의 시작 후 사용 가능'}
                        className="flex-1 px-3 py-2 bg-[var(--background)] text-[var(--foreground)] border border-[var(--border-color)] rounded-md resize-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)]/40 outline-none transition-all placeholder:text-[var(--text-tertiary)] text-sm disabled:opacity-40"
                        rows={1}
                        disabled={isLoading || !isMeetingActive}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading || !isMeetingActive}
                        className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-30 text-white rounded-md transition-colors"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
});

export default ChatInterface;
