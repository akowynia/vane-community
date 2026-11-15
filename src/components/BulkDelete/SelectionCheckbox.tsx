'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectionCheckboxProps {
  checked: boolean;
  disabled?: boolean;
  disabledTooltip?: string;
  onToggle: (shiftKey: boolean) => void;
  className?: string;
}

/**
 * Consistent selection checkbox for bulk deletion mode across list and card views.
 */
export const SelectionCheckbox: React.FC<SelectionCheckboxProps> = ({
  checked,
  disabled = false,
  disabledTooltip,
  onToggle,
  className,
}) => {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!disabled) {
          onToggle(e.shiftKey);
        }
      }}
      title={disabled ? disabledTooltip : undefined}
      aria-checked={checked}
      role="checkbox"
      className={cn(
        'w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition',
        disabled
          ? 'opacity-35 cursor-not-allowed border-light-300 dark:border-[#30271e]'
          : checked
            ? 'bg-[#b8864d] border-[#b8864d] text-[#0c0a09]'
            : 'border-light-300 dark:border-[#3a3026] bg-light-secondary dark:bg-[#1b1612] hover:border-[#b8864d] cursor-pointer',
        className,
      )}
    >
      {checked && <Check size={13} strokeWidth={3} />}
    </button>
  );
};

export default SelectionCheckbox;

