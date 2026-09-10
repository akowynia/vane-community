'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();

  // Full-bleed workspace for Scratchpad note editor
  const isScratchpadEditor = pathname ? /^\/scratchpad\/[^/]+/.test(pathname) : false;

  // Wider container for dashboards / multi-card pages
  const isWideDashboard = pathname
    ? pathname === '/scratchpad' ||
      pathname.startsWith('/waypoints') ||
      pathname.startsWith('/discover') ||
      pathname.startsWith('/library') ||
      pathname.startsWith('/statistics')
    : false;

  if (isScratchpadEditor) {
    return (
      <main className="lg:pl-[72px] bg-light-primary dark:bg-dark-primary min-h-screen h-screen overflow-hidden">
        <div className="w-full h-full overflow-hidden">{children}</div>
      </main>
    );
  }

  if (isWideDashboard) {
    return (
      <main className="lg:pl-[72px] bg-light-primary dark:bg-dark-primary min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</div>
      </main>
    );
  }

  return (
    <main className="lg:pl-[72px] bg-light-primary dark:bg-dark-primary min-h-screen">
      <div className="max-w-screen-lg lg:mx-auto mx-4">{children}</div>
    </main>
  );
};

export default Layout;

