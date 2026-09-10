import { ArrowRight, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import Sources from './MessageInputActions/Sources';
import Optimization from './MessageInputActions/Optimization';
import Attach from './MessageInputActions/Attach';
import { useChat } from '@/lib/hooks/useChat';
import ModelSelector from './MessageInputActions/ChatModelSelector';
import WaypointSelector from './MessageInputActions/WaypointSelector';
import { useTranslation } from '@/lib/i18n';

const EmptyChatMessageInput = () => {
  const { sendMessage } = useChat();
  const { t } = useTranslation();

  /* const [copilotEnabled, setCopilotEnabled] = useState(false); */
  const [message, setMessage] = useState('');

  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;

      const isInputFocused =
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA' ||
        activeElement?.hasAttribute('contenteditable');

      if (e.key === '/' && !isInputFocused) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    inputRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        sendMessage(message);
        setMessage('');
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault();
          sendMessage(message);
          setMessage('');
        }
      }}
      className="w-full"
    >
      <div className="flex flex-col bg-light-secondary/90 dark:bg-[#181513]/90 backdrop-blur-md px-4 pt-4 pb-3 rounded-2xl w-full border border-light-200 dark:border-[#2e2720] shadow-xl shadow-black/25 transition-all duration-200 focus-within:border-light-300 dark:focus-within:border-[#b8864d]/60 dark:focus-within:ring-1 dark:focus-within:ring-[#b8864d]/30">
        <div className="flex flex-row items-start space-x-2.5">
          <Search className="w-5 h-5 mt-1 text-black/40 dark:text-stone-400 shrink-0" />
          <TextareaAutosize
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            minRows={2}
            className="px-1 py-0.5 bg-transparent placeholder:text-[15px] placeholder:text-black/50 dark:placeholder:text-stone-500 text-sm text-black dark:text-stone-100 resize-none focus:outline-none w-full max-h-24 lg:max-h-36 xl:max-h-48"
            placeholder={t('chat.askAnything')}
          />
        </div>
        <div className="flex flex-row items-center justify-between mt-3 pt-2 border-t border-light-200/50 dark:border-[#28221b]/70">
          <Optimization />
          <div className="flex flex-row items-center space-x-2">
            <div className="flex flex-row items-center space-x-1">
              <WaypointSelector />
              <Sources />
              <ModelSelector />
              <Attach />
            </div>
            <button
              type="submit"
              disabled={message.trim().length === 0}
              className="bg-gradient-to-r from-[#b8864d] to-[#d4a373] text-[#0c0a09] font-medium disabled:opacity-30 disabled:bg-none disabled:bg-[#e0e0dc] dark:disabled:bg-[#25201a] dark:disabled:text-stone-600 hover:brightness-110 active:scale-95 transition-all duration-200 rounded-full p-2"
            >
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default EmptyChatMessageInput;
