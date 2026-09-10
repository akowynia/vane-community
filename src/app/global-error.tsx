'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global layout error caught by app/global-error.tsx:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex flex-col items-center justify-center min-h-screen px-4 font-sans bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
        <div className="max-w-md w-full p-6 text-center rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 shadow-xl">
          <h2 className="text-xl font-bold mb-2">Critical application error</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            An unexpected global error occurred.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => reset()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
            >
              Refresh view
            </button>
            <button
              onClick={() => (window.location.href = '/')}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg transition"
            >
              Home page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
