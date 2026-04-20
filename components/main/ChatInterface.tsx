'use client';

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { chatApi } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// SQLite func.now()는 UTC를 반환하지만 Z가 없어서 JS가 로컬로 해석함
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
        scrollToBottom();
    }, [messages]);

    useImperativeHandle(ref, () => ({
        handleResearch: async (topic: string) => {
            if (!chatId || isLoading) return;
            setIsLoading(true);
            try {
                const userResponse = await chatApi.requestResearch(chatId, topic, sessionId ?? null);
                const newUserMessage: ChatMessage = {
                    messageId: userResponse.messageId,
                    role: 'user',
                    text: userResponse.text,
                    timestamp: userResponse.timestamp,
                };
                setMessages(prev => [...prev, newUserMessage]);

                const aiResponse = await chatApi.getAnswer(userResponse.messageId);
                const aiMessage: ChatMessage = {
                    messageId: aiResponse.messageId,
                    role: 'assistant',
                    text: aiResponse.text,
                    image: aiResponse.image,
                    timestamp: aiResponse.timestamp,
                };
                setMessages(prev => [...prev, aiMessage]);
            } catch (error) {
                console.error('Failed research request:', error);
            } finally {
                setIsLoading(false);
            }
        }
    }));

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const loadChatHistory = async () => {
        if (!chatId) return;

        try {
            const response = await chatApi.getHistory(chatId, undefined, 50, sessionId ?? null);
            if (response && Array.isArray(response.messages)) {
                setMessages(response.messages);
            } else {
                setMessages([]);
            }
        } catch (error) {
            console.error('[ChatHistory] Failed to load chat history:', error);
            setMessages([]);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || !chatId || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setIsLoading(true);

        try {
            const userResponse = await chatApi.sendMessage(chatId, userMessage);
            const newUserMessage: ChatMessage = {
                messageId: userResponse.messageId,
                role: 'user',
                text: userMessage,
                timestamp: userResponse.timestamp,
            };
            setMessages(prev => [...prev, newUserMessage]);

            const aiResponse = await chatApi.getAnswer(userResponse.messageId);
            const aiMessage: ChatMessage = {
                messageId: aiResponse.messageId,
                role: 'assistant',
                text: aiResponse.text,
                image: aiResponse.image,
                timestamp: aiResponse.timestamp,
            };
            setMessages(prev => [...prev, aiMessage]);
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
                <p className="text-[var(--text-tertiary)] text-sm">채팅을 불러오는 중...</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-[var(--card-bg)] transition-colors duration-300">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && !isLoading && (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                            <div className="w-10 h-10 rounded-full bg-[var(--accent-primary)]/10 flex items-center justify-center mx-auto mb-3">
                                <svg className="w-5 h-5 text-[var(--accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </div>
                            <p className="text-xs text-[var(--text-tertiary)]">AI에게 무엇이든 물어보세요</p>
                        </div>
                    </div>
                )}
                {messages.map((message) => (
                    <div
                        key={message.messageId}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl ${message.role === 'user'
                                ? 'bg-[var(--accent-primary)] text-white rounded-br-md'
                                : 'bg-[var(--highlight-bg)] text-[var(--foreground)] border border-[var(--border-color)] rounded-bl-md'
                                }`}
                        >
                            {message.text && (
                                <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:my-1">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            a: ({ href, children }) => (
                                                <a
                                                    href={href}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-indigo-400 underline cursor-pointer hover:text-indigo-300"
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
                                <img
                                    src={message.image}
                                    alt="Message attachment"
                                    className="mt-2 rounded-lg max-w-full"
                                />
                            )}
                            <p className={`text-[10px] mt-1.5 ${
                                message.role === 'user' ? 'text-white/70' : 'text-[var(--text-tertiary)]'
                            }`}>
                                {toKST(message.timestamp)}
                            </p>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-[var(--highlight-bg)] border border-[var(--border-color)] px-4 py-3 rounded-2xl rounded-bl-md">
                            <div className="flex space-x-1.5">
                                <div className="w-2 h-2 bg-[var(--accent-primary)]/40 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-[var(--accent-primary)]/40 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                                <div className="w-2 h-2 bg-[var(--accent-primary)]/40 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-[var(--border-color)] p-3 bg-[var(--background)]">
                <div className="flex items-end gap-2">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="메시지를 입력하세요..."
                        className="flex-1 px-3.5 py-2.5 bg-[var(--highlight-bg)] text-[var(--foreground)] border border-[var(--border-color)] rounded-xl resize-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)]/40 outline-none transition-all placeholder:text-[var(--text-tertiary)] text-sm"
                        rows={1}
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="p-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-30 text-white rounded-xl transition-all active:scale-95"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
});

export default ChatInterface;
