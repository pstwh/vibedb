import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Message } from '@/types';
import { useApiKey } from '@/hooks/useApiKey';

interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  onOpenSettings?: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onSendMessage, isLoading, onOpenSettings }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { apiKey } = useApiKey();
  const groups = useMemo(() => {
    const result: Array<{ user: string | null; ai: string[] }> = [];
    let current: { user: string | null; ai: string[] } | null = null;
    for (const m of messages) {
      if (m.sender === 'user') {
        current = { user: m.text, ai: [] };
        result.push(current);
      } else {
        if (current) {
          current.ai.push(m.text);
        } else {
          result.push({ user: null, ai: [m.text] });
        }
      }
    }
    return result;
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input);
      setInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSend();
    }
  };
  
  const handleResend = (text: string) => {
    if (!isLoading) {
      onSendMessage(text);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-800 text-gray-300">
      {!apiKey && (
        <div className="p-3 bg-yellow-900/50 border-b border-yellow-700 text-yellow-200 flex items-center justify-between">
          <span>Set your Gemini API key to enable the AI Assistant.</span>
          <button onClick={onOpenSettings} className="px-3 py-1 bg-yellow-700 hover:bg-yellow-600 rounded text-sm">Add API Key</button>
        </div>
      )}
      <div className="flex-grow p-4 overflow-y-auto space-y-4">
        {groups.map((g, i) => (
          <div key={i} className="space-y-2">
            {g.user !== null ? (
              <div className="flex justify-end items-center gap-2">
                <div className="max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-xl bg-blue-600 text-white">
                  <p className="whitespace-pre-wrap">{g.user}</p>
                </div>
                <button
                  title="Resend"
                  onClick={() => handleResend(g.user!)}
                  disabled={isLoading}
                  className="p-2 rounded-md text-gray-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 -960 960 960" fill="currentColor">
                    <path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/>
                  </svg>
                </button>
              </div>
            ) : null}
            {g.ai.map((text, j) => (
              <div key={j} className="flex justify-start">
                <div className="max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-xl bg-gray-700 text-gray-200">
                  <p className="whitespace-pre-wrap">{text}</p>
                </div>
              </div>
            ))}
          </div>
        ))}
        {isLoading && messages[messages.length-1]?.sender === 'user' && (
           <div className="flex justify-start">
             <div className="max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 rounded-xl bg-gray-700 text-gray-200 flex items-center space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center bg-gray-900 border border-gray-700 rounded-lg">
          <input
            type="text"
            className="flex-grow bg-transparent p-3 text-gray-200 focus:outline-none"
            placeholder="e.g., Add a 'users' table..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input}
            className="p-3 text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed transition duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;


