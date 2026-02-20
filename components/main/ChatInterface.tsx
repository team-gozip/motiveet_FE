'use client';

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { chatApi } from '@/lib/api';
import Button from '../common/Button';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessage {
    messageId: number;
    role: 'user' | 'assistant';
    text?: string;
    image?: string;
    timestamp: string;
}

interface ChatInterfaceProps {
    chatId: number | null;
    isMeetingActive: boolean;
}

const ChatInterface = forwardRef((props: ChatInterfaceProps, ref) => {
    const { chatId, isMeetingActive } = props;
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);


    useEffect(() => {
        if (chatId) {
            loadChatHistory();
        }
    }, [chatId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useImperativeHandle(ref, () => ({
        handleResearch: async (topic: string) => {
            if (!chatId || isLoading) return;
            setIsLoading(true);
            try {
                // 1. Send "Topic 찾아줘" message
                const userResponse = await chatApi.requestResearch(chatId, topic);
                const newUserMessage: ChatMessage = {
                    messageId: userResponse.messageId,
                    role: 'user',
                    text: userResponse.text,
                    timestamp: userResponse.timestamp,
                };
                setMessages(prev => [...prev, newUserMessage]);

                // 2. Trigger AI Answer (which will handle research in BE)
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
            console.log(`[ChatHistory] Loading history for chatId: ${chatId}`);
            const response = await chatApi.getHistory(chatId);
            console.log('[ChatHistory] Response received:', response);

            // Defensive: Check if messages exists and is an array
            if (response && Array.isArray(response.messages)) {
                setMessages(response.messages);
                console.log(`[ChatHistory] Loaded ${response.messages.length} messages`);
            } else {
                console.warn('[ChatHistory] Invalid response format:', response);
                setMessages([]);
            }
        } catch (error) {
            console.error('[ChatHistory] Failed to load chat history:', error);
            // Don't throw, just set empty messages to prevent app crash
            setMessages([]);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || !chatId || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setIsLoading(true);

        try {
            // Send user message
            const userResponse = await chatApi.sendMessage(chatId, userMessage);
            const newUserMessage: ChatMessage = {
                messageId: userResponse.messageId,
                role: 'user',
                text: userMessage,
                timestamp: userResponse.timestamp,
            };
            setMessages(prev => [...prev, newUserMessage]);

            // Get AI answer
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
            // Add error message
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
            <div className="h-full flex items-center justify-center bg-zinc-900/50">
                <p className="text-zinc-500">회의를 시작하면 채팅을 사용할 수 있습니다.</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-[var(--card-bg)] border border-[var(--border-color)] transition-colors duration-300">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                    <div
                        key={message.messageId}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-xs lg:max-w-md xl:max-w-lg px-4 py-2 rounded-2xl shadow-sm ${message.role === 'user'
                                ? 'bg-[var(--accent-primary)] text-[#1a1a1a]'
                                : 'bg-[var(--highlight-bg)] text-[var(--foreground)] border border-[var(--border-color)]'
                                }`}
                        >
                            {message.text && (
                                <div className="text-sm prose dark:prose-invert prose-slate max-w-none prose-p:leading-relaxed prose-a:text-indigo-500 hover:prose-a:underline">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
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
                            <p
                                className={`text-[10px] mt-1 font-medium ${message.role === 'user' ? 'text-[#1a1a1a]' : 'text-[var(--foreground)] opacity-30'
                                    }`}
                            >
                                {new Date(message.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                            </p>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-[var(--highlight-bg)] border border-[var(--border-color)] px-4 py-2 rounded-2xl shadow-sm">
                            <div className="flex space-x-2">
                                <div className="w-1.5 h-1.5 bg-[var(--accent-primary)]/50 rounded-full animate-bounce"></div>
                                <div className="w-1.5 h-1.5 bg-[var(--accent-primary)]/50 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                <div className="w-1.5 h-1.5 bg-[var(--accent-primary)]/50 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-[var(--border-color)] p-4 bg-[var(--background)]">
                <div className="flex items-end space-x-2">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={isMeetingActive ? "메시지를 입력하세요..." : "회의 중에는 채팅이 가능합니다."}
                        className="flex-1 px-4 py-3 bg-[var(--highlight-bg)]/50 text-[var(--foreground)] border border-[var(--border-color)] rounded-xl resize-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)]/30 outline-none transition-all placeholder:text-[var(--foreground)] placeholder:opacity-20 text-sm"
                        rows={1}
                        disabled={isLoading || !isMeetingActive}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading || !isMeetingActive}
                        className="px-6 py-3 bg-[var(--accent-primary)] hover:opacity-90 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:opacity-50 text-white rounded-xl transition-all font-bold self-end shadow-md hover:shadow-lg active:scale-95 text-sm"
                    >
                        전송
                    </button>
                </div>
            </div>
        </div>
    );
});

export default ChatInterface;
