'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, MessageSquarePlus } from 'lucide-react';
import Link from 'next/link';

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Chat view error caught by app/c/[chatId]/error.tsx:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center bg-light-primary dark:bg-dark-primary">
      <div className="max-w-md w-full p-6 rounded-2xl border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary shadow-lg">
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400">
            <AlertCircle size={32} />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-black dark:text-white mb-2">
          Chat rendering error
        </h2>
        <p className="text-sm text-black/70 dark:text-white/70 mb-4">
          There was a problem displaying the messages. You can refresh the view or start a new chat.
        </p>
        {error.message && (
          <div className="mb-6 p-3 rounded-lg bg-black/5 dark:bg-white/5 text-xs font-mono text-left text-black/60 dark:text-white/60 overflow-x-auto max-h-32">
            {error.message}
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition"
          >
            <RefreshCw size={16} />
            Try again
          </button>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-black/80 dark:text-white/80 bg-light-200 dark:bg-dark-200 hover:bg-light-300 dark:hover:bg-dark-100 rounded-lg transition"
          >
            <MessageSquarePlus size={16} />
            New chat
          </Link>
        </div>
      </div>
    </div>
  );
}
