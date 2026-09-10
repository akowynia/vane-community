'use client';

import { cn } from '@/lib/utils';
import {
  Folder,
  Compass,
  Settings,
  Plus,
  LayoutGrid,
  ShieldCheck,
  User,
  Waypoints,
  NotebookPen,
  KeyRound,
  Layers,
} from 'lucide-react';
import Link from 'next/link';
import { useSelectedLayoutSegments, useRouter, usePathname } from 'next/navigation';
import React, { useState, useEffect, type ReactNode } from 'react';
import Layout from './Layout';
import SettingsButton from './Settings/SettingsButton';
import AccessControlDialog from './Settings/AccessControlDialog';
import LoginDialog from './Auth/LoginDialog';
import { useTranslation } from '@/lib/i18n';
import { useChat } from '@/lib/hooks/useChat';
import VaneLogo from './VaneLogo';
import { toast } from 'sonner';
import QueueTrigger from './Queue/QueueTrigger';

const VerticalIconContainer = ({ children }: { children: ReactNode }) => {
  return <div className="flex flex-col items-center w-full space-y-2">{children}</div>;
};

const Sidebar = ({ children }: { children: React.ReactNode }) => {
  const segments = useSelectedLayoutSegments();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { resetChat } = useChat();
  const router = useRouter();

  const [isAccessControlOpen, setIsAccessControlOpen] = useState(false);
  const [accessControlTab, setAccessControlTab] = useState<
    'users' | 'models' | 'limits' | 'security'
  >('users');
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [instanceMode, setInstanceMode] = useState<'single' | 'multi'>('single');
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    role: string;
    displayName?: string | null;
  } | null>(null);

  useEffect(() => {
    const handleOpenAccessControl = (e: Event) => {
      const customEvent = e as CustomEvent<{
        tab?: 'users' | 'models' | 'limits' | 'security';
      }>;
      if (customEvent.detail?.tab) {
        setAccessControlTab(customEvent.detail.tab);
      } else {
        setAccessControlTab('users');
      }
      setIsAccessControlOpen(true);
    };

    const handleOpenSettings = (e: Event) => {
      const customEvent = e as CustomEvent<{ section?: string }>;
      if (customEvent.detail?.section === 'limits') {
        setAccessControlTab('limits');
        setIsAccessControlOpen(true);
      }
    };

    window.addEventListener('open-access-control', handleOpenAccessControl);
    window.addEventListener('open-settings', handleOpenSettings);
    return () => {
      window.removeEventListener('open-access-control', handleOpenAccessControl);
      window.removeEventListener('open-settings', handleOpenSettings);
    };
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user || null);
        if (data.instanceMode) {
          setInstanceMode(data.instanceMode);
        }
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const isSoloMode = instanceMode === 'single';
  const isAdmin = currentUser?.role === 'admin' || (isSoloMode && !currentUser);
  const isHomeActive = segments.length === 0 || segments.includes('c');

  const handleStartNewChat = () => {
    if (pathname === '/') {
      resetChat();
    } else {
      router.push('/');
    }
  };

  const navLinks = [
    {
      icon: Compass,
      href: '/discover',
      active: segments.includes('discover'),
      label: t('navigation.discover'),
    },
    {
      icon: Waypoints,
      href: '/waypoints',
      active: segments.includes('waypoints'),
      label: t('navigation.waypoints') || 'Waypoints',
    },
    {
      icon: NotebookPen,
      href: '/scratchpad',
      active: segments.includes('scratchpad'),
      label: t('navigation.scratchpad') || 'Scratchpad',
    },
    ...(currentUser || isSoloMode
      ? [
          {
            icon: KeyRound,
            href: '/api-access',
            active: segments.includes('api-access'),
            label: t('navigation.apiAccess') || 'API Access',
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            icon: LayoutGrid,
            href: '/statistics',
            active: segments.includes('statistics'),
            label: t('navigation.stats'),
          },
        ]
      : []),
    {
      icon: Folder,
      href: '/library',
      active: segments.includes('library'),
      label: t('navigation.library'),
    },
  ];

  return (
    <div>
      {/* Desktop Sidebar Rail */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-[72px] lg:flex-col border-r border-light-200 dark:border-[#221c16] bg-light-secondary dark:bg-[#090807] shadow-sm shadow-light-200/10 dark:shadow-black/40">
        {/* Top: Vane Logo & Brand (Fixed) */}
        <div className="shrink-0 flex flex-col items-center w-full pt-4 pb-2 px-2">
          <Link
            href="/"
            onClick={handleStartNewChat}
            title="Vane - Community"
            className="flex flex-col items-center justify-center p-1.5 rounded-xl hover:scale-105 transition-transform duration-200 text-center w-full group"
          >
            <VaneLogo size={28} />
            <span className="text-[10px] font-bold text-black dark:text-stone-100 mt-1 leading-tight tracking-tight">
              Vane
            </span>
            <span className="text-[7.5px] font-medium text-[#b8864d] tracking-wider uppercase -mt-0.5">
              Community
            </span>
          </Link>
        </div>

        {/* Scrollable Navigation Rail */}
        <div className="flex-1 w-full overflow-y-auto overflow-x-hidden px-2 py-1 min-h-0 space-y-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {/* New query button - also acts as Home */}
          <Link
            href="/"
            onClick={handleStartNewChat}
            title={
              t('navigation.newQuery') ||
              t('chat.startNewChat') ||
              'New Query'
            }
            className={cn(
              'flex flex-col items-center justify-center w-full py-2 px-1 rounded-xl transition duration-200 group shadow-sm active:scale-95',
              isHomeActive
                ? 'bg-gradient-to-b from-[#b8864d]/30 to-[#b8864d]/15 border border-[#b8864d]/70 text-black dark:text-[#f3d5ab] shadow-sm shadow-[#b8864d]/10'
                : 'bg-gradient-to-b from-[#b8864d]/25 to-[#b8864d]/10 hover:from-[#b8864d]/35 hover:to-[#b8864d]/20 border border-[#b8864d]/40 hover:border-[#b8864d]/70 text-black dark:text-[#f3d5ab]',
            )}
          >
            <Plus size={19} className="group-hover:scale-110 transition-transform duration-200 text-[#b8864d]" />
            <span className="text-[9px] font-medium tracking-tight mt-1 text-center leading-tight">
              {t('navigation.newQuery') ||
                t('chat.startNewChat') ||
                'New Query'}
            </span>
          </Link>

          {/* Navigation Links */}
          <VerticalIconContainer>
            {navLinks.map((link, i) => (
              <Link
                key={i}
                href={link.href}
                onClick={() => {
                  if (link.href === '/') {
                    handleStartNewChat();
                  }
                }}
                title={link.label}
                className={cn(
                  'group relative flex flex-col items-center justify-center cursor-pointer w-full py-2 px-1 rounded-xl transition duration-200',
                  link.active
                    ? 'text-black dark:text-[#f3d5ab] bg-light-200 dark:bg-[#221c15] border border-transparent dark:border-[#382d20]'
                    : 'text-black/60 dark:text-stone-400 hover:text-black dark:hover:text-stone-100 hover:bg-light-200/60 dark:hover:bg-[#161310]',
                )}
              >
                <link.icon
                  size={20}
                  className={cn(
                    !link.active && 'group-hover:scale-110',
                    'transition-transform duration-200',
                  )}
                />
                <span className="text-[9px] font-medium tracking-tight mt-1 opacity-75 group-hover:opacity-100 transition-opacity text-center leading-tight">
                  {link.label}
                </span>
              </Link>
            ))}

            {/* Settings Item in rail */}
            {isAdmin ? (
              <SettingsButton
                className="group relative flex flex-col items-center justify-center cursor-pointer w-full py-2 px-1 rounded-xl text-black/60 dark:text-stone-400 hover:text-black dark:hover:text-stone-100 hover:bg-light-200/60 dark:hover:bg-[#161310] transition duration-200"
              >
                <Settings
                  size={20}
                  className="group-hover:scale-110 group-hover:rotate-45 transition-transform duration-200"
                />
                <span className="text-[9px] font-medium tracking-tight mt-1 opacity-75 group-hover:opacity-100 transition-opacity text-center leading-tight">
                  {t('navigation.settings')}
                </span>
              </SettingsButton>
            ) : (
              <button
                type="button"
                onClick={() => {
                  toast.error(
                    t('auth.loginRequiredAdmin') ||
                      'Admin login required to access settings.',
                  );
                  setIsLoginOpen(true);
                }}
                title={t('navigation.settings')}
                className="group relative flex flex-col items-center justify-center cursor-pointer w-full py-2 px-1 rounded-xl text-black/60 dark:text-stone-400 hover:text-black dark:hover:text-stone-100 hover:bg-light-200/60 dark:hover:bg-[#161310] transition duration-200"
              >
                <Settings
                  size={20}
                  className="group-hover:scale-110 group-hover:rotate-45 transition-transform duration-200 opacity-60"
                />
                <span className="text-[9px] font-medium tracking-tight mt-1 opacity-75 group-hover:opacity-100 transition-opacity text-center leading-tight">
                  {t('navigation.settings')}
                </span>
              </button>
            )}

            {/* Access Control Item in rail */}
            {isAdmin && (
              <button
                onClick={() => setIsAccessControlOpen(true)}
                title={t('accessControl.title') || 'Access Control'}
                className="group relative flex flex-col items-center justify-center cursor-pointer w-full py-2 px-1 rounded-xl text-black/60 dark:text-stone-400 hover:text-black dark:hover:text-stone-100 hover:bg-light-200/60 dark:hover:bg-[#161310] transition duration-200"
              >
                <ShieldCheck
                  size={20}
                  className="group-hover:scale-110 text-[#b8864d] transition-transform duration-200"
                />
                <span className="text-[8.5px] font-medium tracking-tight mt-1 opacity-75 group-hover:opacity-100 transition-opacity text-center leading-tight">
                  {t('accessControl.navAccess') || 'Access'}
                </span>
              </button>
            )}

            {/* Queue Drawer Button in Rail */}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-queue-drawer'))}
              title={t('queue.title') || 'Model Task Queue'}
              className="group relative flex flex-col items-center justify-center cursor-pointer w-full py-2 px-1 rounded-xl text-black/60 dark:text-stone-400 hover:text-black dark:hover:text-stone-100 hover:bg-light-200/60 dark:hover:bg-[#161310] transition duration-200"
            >
              <Layers
                size={20}
                className="group-hover:scale-110 transition-transform duration-200"
              />
              <span className="text-[9px] font-medium tracking-tight mt-1 opacity-75 group-hover:opacity-100 transition-opacity text-center leading-tight">
                {t('queue.tabQueue') || 'Queue'}
              </span>
            </button>
          </VerticalIconContainer>
        </div>

        {/* User Profile / Auth button at bottom of rail (Fixed & Non-scrollable) */}
        <div className="shrink-0 flex flex-col items-center w-full py-3 px-2 border-t border-light-200/40 dark:border-[#1e1914]">
          <button
            onClick={() => setIsLoginOpen(true)}
            title={
              currentUser
                ? `${t('auth.loggedInAs') || 'Logged in as'}: ${currentUser.username} (${currentUser.role})`
                : t('auth.login') || 'Log in'
            }
            className="p-2 rounded-xl text-black/50 dark:text-stone-400 hover:text-black dark:hover:text-stone-100 hover:bg-light-200/60 dark:hover:bg-[#161310] transition"
          >
            <User size={18} className={currentUser ? 'text-[#b8864d]' : ''} />
          </button>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="fixed bottom-0 w-full z-50 flex flex-row items-center justify-around gap-x-2 bg-light-secondary/95 dark:bg-[#0c0a09]/95 backdrop-blur-lg border-t border-light-200 dark:border-[#221c16] px-3 py-3 shadow-sm lg:hidden overflow-x-auto">
        <Link
          href="/"
          onClick={handleStartNewChat}
          className={cn(
            'relative flex flex-col items-center space-y-1 text-center py-1 px-2 rounded-lg flex-1 min-w-[54px]',
            isHomeActive
              ? 'text-black dark:text-[#f3d5ab]'
              : 'text-black/60 dark:text-stone-400',
          )}
        >
          {isHomeActive && (
            <div className="absolute top-0 -mt-3 h-0.5 w-8 rounded-full bg-black dark:bg-[#b8864d]" />
          )}
          <Plus size={20} />
          <p className="text-[10px] font-medium leading-tight truncate">
            {t('navigation.newQuery') || 'New query'}
          </p>
        </Link>

        {navLinks.map((link, i) => (
          <Link
            href={link.href}
            key={i}
            className={cn(
              'relative flex flex-col items-center space-y-1 text-center py-1 px-2 rounded-lg flex-1 min-w-[54px]',
              link.active
                ? 'text-black dark:text-[#f3d5ab]'
                : 'text-black/60 dark:text-stone-400',
            )}
          >
            {link.active && (
              <div className="absolute top-0 -mt-3 h-0.5 w-8 rounded-full bg-black dark:bg-[#b8864d]" />
            )}
            <link.icon size={20} />
            <p className="text-[10px] font-medium leading-tight truncate">{link.label}</p>
          </Link>
        ))}

        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-queue-drawer'))}
          className="relative flex flex-col items-center space-y-1 text-center py-1 px-2 rounded-lg flex-1 min-w-[54px] text-black/60 dark:text-stone-400"
        >
          <Layers size={20} />
          <p className="text-[10px] font-medium leading-tight truncate">{t('queue.tabQueue') || 'Queue'}</p>
        </button>

        {isAdmin && (
          <button
            onClick={() => setIsAccessControlOpen(true)}
            className="relative flex flex-col items-center space-y-1 text-center py-1 px-2 rounded-lg flex-1 min-w-[54px] text-black/60 dark:text-stone-400"
          >
            <ShieldCheck size={20} className="text-[#b8864d]" />
            <p className="text-[10px] font-medium leading-tight truncate">{t('accessControl.navAccess') || 'Access'}</p>
          </button>
        )}
      </div>

      <Layout>{children}</Layout>

      <QueueTrigger />

      <AccessControlDialog
        isOpen={isAccessControlOpen}
        setIsOpen={setIsAccessControlOpen}
        initialTab={accessControlTab}
      />
      <LoginDialog
        isOpen={isLoginOpen}
        setIsOpen={setIsLoginOpen}
        currentUser={currentUser}
        onAuthChange={fetchCurrentUser}
      />
    </div>
  );
};

export default Sidebar;
