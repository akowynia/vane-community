'use client';

import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import EmptyChatMessageInput from './EmptyChatMessageInput';
import { File } from './ChatWindow';
import Link from 'next/link';
import WeatherWidget from './WeatherWidget';
import NewsArticleWidget from './NewsArticleWidget';
import SettingsButtonMobile from '@/components/Settings/SettingsButtonMobile';
import {
  getShowNewsWidget,
  getShowWeatherWidget,
} from '@/lib/config/clientRegistry';
import { useTranslation } from '@/lib/i18n';

import CompassBackground from './CompassBackground';

const EmptyChat = () => {
  const { t } = useTranslation();
  const [showWeather, setShowWeather] = useState(() =>
    typeof window !== 'undefined' ? getShowWeatherWidget() : true,
  );
  const [showNews, setShowNews] = useState(() =>
    typeof window !== 'undefined' ? getShowNewsWidget() : true,
  );

  useEffect(() => {
    const updateWidgetVisibility = () => {
      setShowWeather(getShowWeatherWidget());
      setShowNews(getShowNewsWidget());
    };

    updateWidgetVisibility();

    window.addEventListener('client-config-changed', updateWidgetVisibility);
    window.addEventListener('storage', updateWidgetVisibility);

    return () => {
      window.removeEventListener(
        'client-config-changed',
        updateWidgetVisibility,
      );
      window.removeEventListener('storage', updateWidgetVisibility);
    };
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col justify-center items-center overflow-hidden">
      {/* Nautical Compass Rose & Celestial Glow in background */}
      <CompassBackground />

      {/* Mobile settings button */}
      <div className="absolute w-full flex flex-row items-center justify-end pr-5 pt-5 top-0 right-0 z-20 lg:hidden">
        <SettingsButtonMobile />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col items-center justify-center w-full space-y-6 relative z-30">
          <h2 className="text-black/85 dark:text-stone-100 text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-center drop-shadow-sm">
            {t('chat.researchBeginsHere')}
          </h2>
          <div className="w-full relative z-30">
            <EmptyChatMessageInput />
          </div>
        </div>

        {(showWeather || showNews) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full pt-1 relative z-10">
            {showWeather && (
              <div className="w-full">
                <WeatherWidget />
              </div>
            )}
            {showNews && (
              <div className="w-full">
                <NewsArticleWidget />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmptyChat;
