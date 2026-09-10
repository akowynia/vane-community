import { cn } from '@/lib/utils';
import { useChat } from '@/lib/hooks/useChat';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Switch,
} from '@headlessui/react';
import {
  GlobeIcon,
  GraduationCapIcon,
  NetworkIcon,
} from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from '@/lib/i18n';

interface SourcesProps {
  position?: 'top' | 'bottom';
  align?: 'left' | 'right';
}

const Sources = ({ position = 'bottom', align = 'right' }: SourcesProps) => {
  const { sources, setSources } = useChat();
  const { t } = useTranslation();

  const sourcesList = [
    {
      name: t('focusModes.web'),
      key: 'web',
      icon: <GlobeIcon className="h-[16px] w-auto" />,
    },
    {
      name: t('focusModes.academic'),
      key: 'academic',
      icon: <GraduationCapIcon className="h-[16px] w-auto" />,
    },
    {
      name: t('focusModes.discussions'),
      key: 'discussions',
      icon: <NetworkIcon className="h-[16px] w-auto" />,
    },
  ];

  return (
    <Popover className="relative">
      {({ open }) => (
        <>
          <PopoverButton className="flex items-center justify-center active:border-none hover:bg-light-200 hover:dark:bg-dark-200 p-2 rounded-lg focus:outline-none text-black/50 dark:text-white/50 active:scale-95 transition duration-200 hover:text-black dark:hover:text-white">
            <GlobeIcon className="h-[18px] w-auto" />
          </PopoverButton>
          <AnimatePresence>
            {open && (
              <PopoverPanel
                static
                className={cn(
                  'absolute z-[60] w-64 md:w-[225px]',
                  align === 'left' ? 'left-0' : 'right-0',
                  position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
                )}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.1, ease: 'easeOut' }}
                  className={cn(
                    'flex flex-col bg-light-primary dark:bg-dark-primary border rounded-lg border-light-200 dark:border-dark-200 w-full p-1 max-h-[200px] md:max-h-none overflow-y-auto shadow-xl',
                    position === 'top'
                      ? (align === 'left' ? 'origin-bottom-left' : 'origin-bottom-right')
                      : (align === 'left' ? 'origin-top-left' : 'origin-top-right'),
                  )}
                >
                  {sourcesList.map((source, i) => (
                    <div
                      key={i}
                      className="flex flex-row justify-between hover:bg-light-100 hover:dark:bg-dark-100 rounded-md py-3 px-2 cursor-pointer"
                      onClick={() => {
                        if (!sources.includes(source.key)) {
                          setSources([...sources, source.key]);
                        } else {
                          setSources(sources.filter((s) => s !== source.key));
                        }
                      }}
                    >
                      <div className="flex flex-row space-x-1.5 text-black/80 dark:text-white/80">
                        {source.icon}
                        <p className="text-xs">{source.name}</p>
                      </div>
                      <Switch
                        checked={sources.includes(source.key)}
                        className="group relative flex h-4 w-7 shrink-0 cursor-pointer rounded-full bg-light-200 dark:bg-white/10 p-0.5 duration-200 ease-in-out focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed data-[checked]:bg-sky-500 dark:data-[checked]:bg-sky-500"
                      >
                        <span
                          aria-hidden="true"
                          className="pointer-events-none inline-block size-3 translate-x-[1px] group-data-[checked]:translate-x-3 rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out"
                        />
                      </Switch>
                    </div>
                  ))}
                </motion.div>
              </PopoverPanel>
            )}
          </AnimatePresence>
        </>
      )}
    </Popover>
  );
};

export default Sources;
