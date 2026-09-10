'use client';

import { Waypoints, ChevronDown, Plus, Check } from 'lucide-react';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from '@headlessui/react';
import { Fragment, useState, useEffect } from 'react';
import { useChat } from '@/lib/hooks/useChat';
import { useTranslation } from '@/lib/i18n';
import WaypointIcon from '@/components/Waypoints/WaypointIcon';
import CreateEditWaypointDialog, {
  WaypointItem,
} from '@/components/Waypoints/CreateEditWaypointDialog';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';

interface WaypointSelectorProps {
  position?: 'top' | 'bottom';
  align?: 'left' | 'right';
}

const WaypointSelector = ({
  position = 'bottom',
  align = 'right',
}: WaypointSelectorProps) => {
  const { waypointId, setWaypointId, waypointInfo, chatId } = useChat();
  const { t } = useTranslation();

  const [waypoints, setWaypoints] = useState<WaypointItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const fetchWaypoints = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/waypoints');
      if (res.ok) {
        const data = await res.json();
        setWaypoints(Array.isArray(data.waypoints) ? data.waypoints : []);
      }
    } catch {
      setWaypoints([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWaypoints();
  }, []);

  const activeWaypoint =
    waypoints.find((w) => w.id === waypointId) || waypointInfo;

  return (
    <>
      <Popover className="relative">
        {({ open, close }) => (
          <>
            <PopoverButton
              type="button"
              onClick={() => fetchWaypoints()}
              title={
                activeWaypoint
                  ? t('waypoints.selectorTooltip', { name: activeWaypoint.name })
                  : t('waypoints.selectorTooltipDefault')
              }
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-xs transition duration-200 focus:outline-none ${
                activeWaypoint
                  ? 'bg-gradient-to-r from-[#b8864d]/25 to-[#b8864d]/10 border border-[#b8864d]/50 text-black dark:text-[#f3d5ab] font-medium shadow-sm'
                  : 'text-black/50 dark:text-stone-400 hover:text-black dark:hover:text-stone-100 hover:bg-light-secondary dark:hover:bg-[#201b16]'
              }`}
            >
              {activeWaypoint ? (
                <WaypointIcon name={activeWaypoint.icon} size={14} className="text-[#b8864d]" />
              ) : (
                <Waypoints size={15} />
              )}
              <span className="truncate max-w-[110px] hidden sm:inline">
                {activeWaypoint ? activeWaypoint.name : 'Waypoint'}
              </span>
              <ChevronDown size={12} className="opacity-60" />
            </PopoverButton>

            <Transition
              as={Fragment}
              enter="transition ease-out duration-150"
              enterFrom="opacity-0 translate-y-1"
              enterTo="opacity-100 translate-y-0"
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-1"
            >
              <PopoverPanel
                className={cn(
                  'absolute z-[60] w-72 rounded-2xl bg-light-primary dark:bg-[#161311] border border-light-200 dark:border-[#2e261f] p-2 shadow-2xl',
                  align === 'left' ? 'left-0' : 'right-0',
                  position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
                  position === 'top'
                    ? (align === 'left' ? 'origin-bottom-left' : 'origin-bottom-right')
                    : (align === 'left' ? 'origin-top-left' : 'origin-top-right'),
                )}
              >
                <div className="px-2 py-1.5 border-b border-light-200/50 dark:border-[#261f18] flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#b8864d]">
                    {t('waypoints.selectSpaceHeader')}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      setIsCreateOpen(true);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] text-[#b8864d] hover:underline font-medium"
                  >
                    <Plus size={12} />
                    <span>{t('waypoints.newSpaceButton')}</span>
                  </button>
                </div>

                <div className="max-h-56 overflow-y-auto py-1 space-y-0.5">
                  {/* Default / No space option */}
                  <button
                    type="button"
                    onClick={async () => {
                      setWaypointId(null, null);
                      close();
                      if (chatId) {
                        try {
                          const res = await fetch(`/api/chats/${chatId}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ waypointId: null }),
                          });
                          if (res.ok) {
                            toast.success(t('waypoints.unlinkedToast'));
                          }
                        } catch (err) {
                          console.error('Failed to unlink chat from waypoint:', err);
                        }
                      }
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition ${
                      !waypointId
                        ? 'bg-light-secondary dark:bg-[#231d17] text-black dark:text-stone-100 font-medium'
                        : 'text-black/70 dark:text-stone-400 hover:bg-light-secondary/60 dark:hover:bg-[#1e1914] hover:text-black dark:hover:text-stone-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-light-200 dark:bg-[#201b16] text-black/50 dark:text-stone-400">
                        <Waypoints size={13} />
                      </div>
                      <div>
                        <div className="leading-tight">{t('waypoints.defaultSpaceName')}</div>
                        <div className="text-[10px] text-black/40 dark:text-stone-500">{t('waypoints.noMasterprompt')}</div>
                      </div>
                    </div>
                    {!waypointId && <Check size={14} className="text-[#b8864d]" />}
                  </button>

                  {/* Waypoints list */}
                  {waypoints.map((wp) => {
                    const isSelected = waypointId === wp.id;
                    return (
                      <button
                        key={wp.id}
                        type="button"
                        onClick={async () => {
                          setWaypointId(wp.id, wp);
                          close();
                          if (chatId) {
                            try {
                              const res = await fetch(`/api/chats/${chatId}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ waypointId: wp.id }),
                              });
                              if (res.ok) {
                                toast.success(t('waypoints.linkedToast', { name: wp.name }));
                              }
                            } catch (err) {
                              console.error('Failed to link chat to waypoint:', err);
                            }
                          }
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition ${
                          isSelected
                            ? 'bg-[#b8864d]/15 border border-[#b8864d]/30 text-black dark:text-[#f3d5ab] font-medium'
                            : 'text-black/70 dark:text-stone-400 hover:bg-light-secondary/60 dark:hover:bg-[#1e1914] hover:text-black dark:hover:text-stone-100 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="p-1.5 rounded-lg bg-light-200 dark:bg-[#201b16] text-[#b8864d] shrink-0">
                            <WaypointIcon name={wp.icon} size={13} />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate leading-tight">{wp.name}</div>
                            <div className="text-[10px] text-black/40 dark:text-stone-500 truncate">
                              {wp.systemInstructions
                                ? `${wp.systemInstructions.slice(0, 32)}...`
                                : t('waypoints.masterpromptActive')}
                            </div>
                          </div>
                        </div>
                        {isSelected && <Check size={14} className="text-[#b8864d] shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </PopoverPanel>
            </Transition>
          </>
        )}
      </Popover>

      <CreateEditWaypointDialog
        isOpen={isCreateOpen}
        setIsOpen={setIsCreateOpen}
        onSaved={(newWp) => {
          setWaypoints((prev) => [newWp, ...prev]);
          setWaypointId(newWp.id);
        }}
      />
    </>
  );
};

export default WaypointSelector;
