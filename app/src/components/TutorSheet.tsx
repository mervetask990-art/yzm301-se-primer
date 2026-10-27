import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, User, Loader2 } from 'lucide-react';
import { DecisionData, LevelId, RoleId, GoalId } from '../types';
import { learnerContext } from '../journal';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
}

interface TutorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  decision: DecisionData;
  level: LevelId;
  role: RoleId;
  goal: GoalId;
  learner: ReturnType<typeof learnerContext>;
  onUserMessage: () => void;
}

export const TutorSheet: React.FC<TutorSheetProps> = ({
  isOpen,
  onClose,
  decision,
  level,
  role,
  goal,
  learner,
  onUserMessage,
}) => {
  // First tutor message is decision.tutorQuestion shown without an API call
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init-0',
      role: 'model',
      content: decision.tutorQuestion,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Reset or update initial message if decision changes
  useEffect(() => {
    setMessages([
      {
        id: `init-${decision.id}`,
        role: 'model',
        content: decision.tutorQuestion,
      },
    ]);
    setInput('');
  }, [decision.id, decision.tutorQuestion]);

  // Auto scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    onUserMessage();

    try {
      const response = await fetch('/api/tutor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          context: {
            prompt: decision.prompt,
            choiceA: decision.choices.A.label,
            choiceB: decision.choices.B.label,
            hint: decision.hint,
            tutorQuestion: decision.tutorQuestion,
            level,
            role,
            goal,
          },
          learner,
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Tutor API failed');
      }

      const data = await response.json();
      const replyText = data.reply || 'Tutor şu an düşünemiyor, ipucu kartına bak.';

      setMessages((prev) => [
        ...prev,
        {
          id: `model-${Date.now()}`,
          role: 'model',
          content: replyText,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'model',
          content: 'Tutor şu an düşünemiyor, ipucu kartına bak.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        data-testid="tutor-sheet"
        className="w-full max-w-[430px] max-h-[85vh] h-[540px] bg-[#17263C] border-t border-x border-[#2A3E5C] rounded-t-[24px] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle & Header */}
        <div className="flex flex-col px-5 pt-3 pb-3 border-b border-[#2A3E5C] bg-[#142032]">
          <div className="w-10 h-1 bg-[#2A3E5C] rounded-full mx-auto mb-2" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-[#A7A3D9]/15 text-[#A7A3D9]">
                <Bot className="w-4 h-4 text-[#A7A3D9]" />
              </div>
              <div>
                <h3 className="font-heading text-sm font-bold text-[#E8EEF5]">
                  Sokratik Tutor
                </h3>
                <p className="font-mono text-[11px] text-[#9FB0C3]">
                  Kriz Düşünce Koçu
                </p>
              </div>
            </div>

            <button
              type="button"
              data-testid="tutor-close"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-[#1F3150] text-[#9FB0C3] hover:text-[#E8EEF5] cursor-pointer transition-colors"
              aria-label="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {messages.map((msg) => {
            const isModel = msg.role === 'model';
            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 items-start ${
                  isModel ? 'justify-start' : 'justify-end'
                }`}
              >
                {isModel && (
                  <div className="w-7 h-7 rounded-full bg-[#1F3150] border border-[#A7A3D9]/30 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-[#A7A3D9]" />
                  </div>
                )}

                <div
                  {...(isModel ? { 'data-testid': 'tutor-message' } : {})}
                  className={`max-w-[85%] rounded-[16px] px-3.5 py-2.5 text-xs leading-relaxed ${
                    isModel
                      ? 'bg-[#1F3150] text-[#E8EEF5] border border-[#2A3E5C] rounded-tl-sm'
                      : 'bg-[#5FB3A8] text-[#0F1B2D] font-medium rounded-tr-sm'
                  }`}
                >
                  {msg.content}
                </div>

                {!isModel && (
                  <div className="w-7 h-7 rounded-full bg-[#5FB3A8]/20 border border-[#5FB3A8]/40 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-[#5FB3A8]" />
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-2.5 items-start">
              <div className="w-7 h-7 rounded-full bg-[#1F3150] border border-[#A7A3D9]/30 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-[#A7A3D9]" />
              </div>
              <div
                data-testid="tutor-loading"
                className="bg-[#1F3150] text-[#9FB0C3] border border-[#2A3E5C] rounded-[16px] rounded-tl-sm px-3.5 py-2.5 text-xs flex items-center gap-2"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#A7A3D9]" />
                <span>Tutor düşünüyor...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSend}
          className="p-3 bg-[#101C2E] border-t border-[#2A3E5C] flex items-center gap-2"
        >
          <input
            type="text"
            data-testid="tutor-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Bir soru sor veya fikrini yaz..."
            className="flex-1 min-h-[44px] h-[44px] px-3.5 rounded-[12px] bg-[#17263C] border border-[#2A3E5C] text-[#E8EEF5] text-xs placeholder:text-[#9FB0C3]/60 focus:outline-none focus:border-[#5FB3A8] transition-colors"
          />
          <button
            type="submit"
            data-testid="tutor-send"
            disabled={!input.trim() || loading}
            className={`min-h-[44px] min-w-[44px] h-[44px] w-[44px] rounded-[12px] flex items-center justify-center border transition-all ${
              input.trim() && !loading
                ? 'bg-[#5FB3A8] text-[#0F1B2D] border-[#5FB3A8] cursor-pointer hover:bg-[#529F95]'
                : 'bg-[#17263C] text-[#9FB0C3]/40 border-[#2A3E5C] cursor-not-allowed'
            }`}
            aria-label="Gönder"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
