import { Settings } from 'lucide-react';
import { useState, useEffect } from 'react';
import SettingsDialogue from './SettingsDialogue';
import { AnimatePresence } from 'framer-motion';

interface SettingsButtonProps {
  className?: string;
  children?: React.ReactNode;
}

const SettingsButton = ({ className, children }: SettingsButtonProps) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [initialSection, setInitialSection] = useState<string | undefined>(undefined);

  useEffect(() => {
    const handleOpenSettings = (e: Event) => {
      const customEvent = e as CustomEvent<{ section?: string }>;
      if (customEvent.detail?.section) {
        setInitialSection(customEvent.detail.section);
      } else {
        setInitialSection(undefined);
      }
      setIsOpen(true);
    };

    window.addEventListener('open-settings', handleOpenSettings);
    return () => window.removeEventListener('open-settings', handleOpenSettings);
  }, []);

  return (
    <>
      <div
        className={
          className ||
          'p-2.5 rounded-full bg-light-200 text-black/70 dark:bg-dark-200 dark:text-white/70 hover:opacity-70 hover:scale-105 transition duration-200 cursor-pointer active:scale-95'
        }
        onClick={() => {
          setInitialSection(undefined);
          setIsOpen(true);
        }}
      >
        {children || <Settings size={19} className="cursor-pointer" />}
      </div>
      <AnimatePresence>
        {isOpen && (
          <SettingsDialogue
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            initialSection={initialSection}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default SettingsButton;
