import React from 'react';
import { Metadata } from 'next';
import BatchSearchWorkspace from '@/components/BatchSearch/BatchSearchWorkspace';

export const metadata: Metadata = {
  title: 'Batch Search - Vane-Community',
  description: 'Sequential batch search over CSV queries with customizable per-item focus and reviewable notes export.',
};

export default function BatchSearchPage() {
  return (
    <div className="flex flex-col min-h-screen bg-light-primary dark:bg-[#0c0a09] text-stone-900 dark:text-stone-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl w-full mx-auto flex-1 flex flex-col">
        <BatchSearchWorkspace isModal={false} />
      </div>
    </div>
  );
}
