'use client';

import { Dialog, DialogPanel } from '@headlessui/react';
import { LogIn, LogOut, User, Lock, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';

interface LoginDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  currentUser: { id: string; username: string; role: string; displayName?: string | null } | null;
  onAuthChange: () => void;
}

export const LoginDialog = ({
  isOpen,
  setIsOpen,
  currentUser,
  onAuthChange,
}: LoginDialogProps) => {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error(t('auth.invalidCredentials') || 'Enter a username and password');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || t('auth.invalidCredentials') || 'Login error');
      }

      toast.success(t('auth.loginSuccess') || 'Logged in successfully');
      setUsername('');
      setPassword('');
      setIsOpen(false);
      onAuthChange();
    } catch (err: any) {
      toast.error(err.message || t('auth.loginFailed') || 'Failed to log in');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      toast.success(t('auth.logoutSuccess') || 'Logged out');
      setIsOpen(false);
      onAuthChange();
    } catch (err) {
      toast.error(t('auth.logoutFailed') || 'Failed to log out');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="relative z-50">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 flex w-screen items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      >
        <DialogPanel className="border border-light-200 dark:border-[#2b241c] bg-light-primary dark:bg-[#120f0c] rounded-2xl w-full max-w-sm p-6 overflow-hidden shadow-2xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-light-200 dark:border-[#221c16]">
            <div className="flex items-center space-x-2 text-[#b8864d]">
              <LogIn size={20} />
              <h3 className="text-sm font-semibold text-black dark:text-stone-100">
                {currentUser ? t('auth.loggedInAs') : t('auth.login')}
              </h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded text-stone-400 hover:text-stone-200"
            >
              <X size={16} />
            </button>
          </div>

          {currentUser ? (
            <div className="space-y-4 py-2">
              <div className="flex items-center space-x-3 p-3 rounded-xl bg-light-secondary/50 dark:bg-[#1a1511] border border-[#2e251a]">
                <div className="p-2 rounded-full bg-[#b8864d]/20 text-[#b8864d]">
                  <User size={20} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-stone-200">
                    {currentUser.username}
                  </p>
                  <p className="text-[11px] text-stone-400">
                    {t('auth.roleLabel') || 'Role'}: <span className="text-[#b8864d] font-medium">{currentUser.role}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={handleLogout}
                disabled={loading}
                className="w-full flex items-center justify-center space-x-2 py-2 px-4 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold transition"
              >
                <LogOut size={15} />
                <span>{t('auth.logout')}</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div>
                <label className="text-xs text-stone-400">{t('auth.username')}</label>
                <div className="relative mt-1">
                  <User size={14} className="absolute left-3 top-2.5 text-stone-500" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t('auth.usernamePlaceholder') || 'Enter username'}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-light-200 dark:border-[#382d20] bg-light-secondary dark:bg-[#0c0a08] text-xs text-stone-200 focus:outline-none focus:border-[#b8864d]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-stone-400">{t('auth.password')}</label>
                <div className="relative mt-1">
                  <Lock size={14} className="absolute left-3 top-2.5 text-stone-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-light-200 dark:border-[#382d20] bg-light-secondary dark:bg-[#0c0a08] text-xs text-stone-200 focus:outline-none focus:border-[#b8864d]"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 px-4 rounded-xl bg-[#b8864d] hover:bg-[#a37540] text-white text-xs font-semibold shadow-sm transition active:scale-95 mt-2"
              >
                {loading ? t('auth.signingIn') : t('auth.signIn')}
              </button>
            </form>
          )}
        </DialogPanel>
      </motion.div>
    </Dialog>
  );
};

export default LoginDialog;
