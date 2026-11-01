export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import Sidebar from '@/components/Sidebar';
import { Toaster } from 'sonner';
import ThemeProvider from '@/components/theme/Provider';
import configManager from '@/lib/config';
import SetupWizard from '@/components/Setup/SetupWizard';
import { ChatProvider } from '@/lib/hooks/useChat';
import { I18nProvider } from '@/lib/i18n';
import { BatchSearchProvider } from '@/lib/batch-search/context';
import { BatchFloatingStatus } from '@/components/BatchSearch/BatchFloatingStatus';

const montserrat = Montserrat({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  fallback: ['Arial', 'sans-serif'],
});

export const metadata: Metadata = {
  title: 'Vane-Community - Direct your curiosity',
  description: 'Vane-Community is an AI powered answering engine.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const setupComplete = configManager.isSetupComplete();
  const configSections = configManager.getUIConfigSections();

  return (
    <html className="h-full" lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('theme') || 'dark';
                  var isLight = t === 'light' || t === 'vintage-paper';
                  var el = document.documentElement;
                  if (isLight) {
                    el.classList.remove('dark');
                    el.classList.add('light');
                  } else {
                    el.classList.add('dark');
                    el.classList.remove('light');
                  }
                  el.classList.add(t);
                  el.setAttribute('data-theme', t);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={cn(
          'h-full antialiased bg-light-primary dark:bg-dark-primary text-black dark:text-white transition-colors duration-200',
          montserrat.className,
        )}
      >
        <ThemeProvider>
          <I18nProvider>
            {setupComplete ? (
              <ChatProvider>
                <BatchSearchProvider>
                  <Sidebar>{children}</Sidebar>
                  <BatchFloatingStatus />
                  <Toaster
                    toastOptions={{
                      unstyled: true,
                      classNames: {
                        toast:
                          'bg-light-secondary dark:bg-dark-secondary dark:text-white/70 text-black-70 rounded-lg p-4 flex flex-row items-center space-x-2',
                      },
                    }}
                  />
                </BatchSearchProvider>
              </ChatProvider>
            ) : (
              <SetupWizard configSections={configSections} />
            )}
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
