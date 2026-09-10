'use client';

import { getMeasurementUnit } from '@/lib/config/clientRegistry';
import { Wind, Droplets, Gauge } from 'lucide-react';
import { useMemo, useEffect, useState } from 'react';

type WeatherWidgetProps = {
  location: string;
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    is_day: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m?: number;
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
  };
  timezone: string;
};

const getWeatherInfo = (code: number, isDay: boolean, isDarkMode: boolean) => {
  const dayNight = isDay ? 'day' : 'night';

  const weatherMap: Record<
    number,
    { icon: string; description: string; gradient: string }
  > = {
    0: {
      icon: `clear-${dayNight}.svg`,
      description: 'Clear',
      gradient: isDarkMode
        ? isDay
          ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #254467, #1d3652 35%, #15283e 60%, #0e1b2b)'
          : 'radial-gradient(ellipse 150% 100% at 50% 100%, #5A6A7E, #3E4E63 40%, #2A3544 65%, #1A2230)'
        : isDay
          ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #FFFFFF, #DBEAFE 30%, #93C5FD 60%, #60A5FA)'
          : 'radial-gradient(ellipse 150% 100% at 50% 100%, #7B8694, #475569 45%, #334155 70%, #1E293B)',
    },
    1: {
      icon: `clear-${dayNight}.svg`,
      description: 'Mostly Clear',
      gradient: isDarkMode
        ? isDay
          ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #254467, #1d3652 35%, #15283e 60%, #0e1b2b)'
          : 'radial-gradient(ellipse 150% 100% at 50% 100%, #5A6A7E, #3E4E63 40%, #2A3544 65%, #1A2230)'
        : isDay
          ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #FFFFFF, #DBEAFE 30%, #93C5FD 60%, #60A5FA)'
          : 'radial-gradient(ellipse 150% 100% at 50% 100%, #7B8694, #475569 45%, #334155 70%, #1E293B)',
    },
    2: {
      icon: `cloudy-1-${dayNight}.svg`,
      description: 'Partly Cloudy',
      gradient: isDarkMode
        ? isDay
          ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #2e4358, #233445 35%, #1a2633 60%, #121b24)'
          : 'radial-gradient(ellipse 150% 100% at 50% 100%, #6B7583, #4A5563 40%, #3A4450 65%, #2A3340)'
        : isDay
          ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #FFFFFF, #E0F2FE 28%, #BFDBFE 58%, #93C5FD)'
          : 'radial-gradient(ellipse 150% 100% at 50% 100%, #8B99AB, #64748B 45%, #475569 70%, #334155)',
    },
    3: {
      icon: `cloudy-1-${dayNight}.svg`,
      description: 'Cloudy',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #36414c, #29323b 38%, #1e252c 65%, #151a1f)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #F5F8FA, #CBD5E1 32%, #94A3B8 65%, #64748B)',
    },
    45: {
      icon: `fog-${dayNight}.svg`,
      description: 'Foggy',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #3a4552, #2c353f 38%, #20272e 65%, #161b20)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #FFFFFF, #E2E8F0 30%, #CBD5E1 62%, #94A3B8)',
    },
    48: {
      icon: `fog-${dayNight}.svg`,
      description: 'Rime Fog',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #3a4552, #2c353f 38%, #20272e 65%, #161b20)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #FFFFFF, #E2E8F0 30%, #CBD5E1 62%, #94A3B8)',
    },
    51: {
      icon: `rainy-1-${dayNight}.svg`,
      description: 'Light Drizzle',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #294458, #1e3343 35%, #162632 60%, #101b24)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #E5FBFF, #A5F3FC 28%, #67E8F9 60%, #22D3EE)',
    },
    53: {
      icon: `rainy-1-${dayNight}.svg`,
      description: 'Drizzle',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #294458, #1e3343 35%, #162632 60%, #101b24)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #E5FBFF, #A5F3FC 28%, #67E8F9 60%, #22D3EE)',
    },
    55: {
      icon: `rainy-2-${dayNight}.svg`,
      description: 'Heavy Drizzle',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #253e52, #1c303f 35%, #152430 60%, #0f1922)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #D4F3FF, #7DD3FC 30%, #38BDF8 62%, #0EA5E9)',
    },
    61: {
      icon: `rainy-2-${dayNight}.svg`,
      description: 'Light Rain',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #253e52, #1c303f 35%, #152430 60%, #0f1922)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #D4F3FF, #7DD3FC 30%, #38BDF8 62%, #0EA5E9)',
    },
    63: {
      icon: `rainy-2-${dayNight}.svg`,
      description: 'Rain',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #203647, #182936 38%, #121e28 65%, #0c151c)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #B8E8FF, #38BDF8 32%, #0EA5E9 65%, #0284C7)',
    },
    65: {
      icon: `rainy-3-${dayNight}.svg`,
      description: 'Heavy Rain',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #1d3240, #152530 38%, #0f1b23 65%, #0a1218)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #9CD9F5, #0EA5E9 32%, #0284C7 65%, #0369A1)',
    },
    71: {
      icon: `snowy-1-${dayNight}.svg`,
      description: 'Light Snow',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #2d3e52, #222f3e 32%, #1a2430 58%, #121a22)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #FFFFFF, #F0F9FF 25%, #E0F2FE 55%, #BAE6FD)',
    },
    73: {
      icon: `snowy-2-${dayNight}.svg`,
      description: 'Snow',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #293949, #1e2b38 35%, #16202a 60%, #10161e)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #FAFEFF, #E0F2FE 28%, #BAE6FD 60%, #7DD3FC)',
    },
    75: {
      icon: `snowy-3-${dayNight}.svg`,
      description: 'Heavy Snow',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #243442, #1b2732 35%, #131c25 60%, #0d1319)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #F0FAFF, #BAE6FD 30%, #7DD3FC 62%, #38BDF8)',
    },
    77: {
      icon: `snowy-1-${dayNight}.svg`,
      description: 'Snow Grains',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #2d3e52, #222f3e 32%, #1a2430 58%, #121a22)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #FFFFFF, #F0F9FF 25%, #E0F2FE 55%, #BAE6FD)',
    },
    80: {
      icon: `rainy-2-${dayNight}.svg`,
      description: 'Light Showers',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #253e52, #1c303f 35%, #152430 60%, #0f1922)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #D4F3FF, #7DD3FC 30%, #38BDF8 62%, #0EA5E9)',
    },
    81: {
      icon: `rainy-2-${dayNight}.svg`,
      description: 'Showers',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #203647, #182936 38%, #121e28 65%, #0c151c)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #B8E8FF, #38BDF8 32%, #0EA5E9 65%, #0284C7)',
    },
    82: {
      icon: `rainy-3-${dayNight}.svg`,
      description: 'Heavy Showers',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #1d3240, #152530 38%, #0f1b23 65%, #0a1218)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #9CD9F5, #0EA5E9 32%, #0284C7 65%, #0369A1)',
    },
    85: {
      icon: `snowy-2-${dayNight}.svg`,
      description: 'Light Snow Showers',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #293949, #1e2b38 35%, #16202a 60%, #10161e)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #FAFEFF, #E0F2FE 28%, #BAE6FD 60%, #7DD3FC)',
    },
    86: {
      icon: `snowy-3-${dayNight}.svg`,
      description: 'Snow Showers',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #243442, #1b2732 35%, #131c25 60%, #0d1319)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #F0FAFF, #BAE6FD 30%, #7DD3FC 62%, #38BDF8)',
    },
    95: {
      icon: `scattered-thunderstorms-${dayNight}.svg`,
      description: 'Thunderstorm',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #2d343e, #20252c 38%, #171b20 65%, #0e1114)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #C8D1DD, #94A3B8 32%, #64748B 65%, #475569)',
    },
    96: {
      icon: 'severe-thunderstorm.svg',
      description: 'Thunderstorm + Hail',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #29303a, #1d2229 38%, #15191e 65%, #0d1013)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #B0BBC8, #64748B 32%, #475569 65%, #334155)',
    },
    99: {
      icon: 'severe-thunderstorm.svg',
      description: 'Severe Thunderstorm',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #242b34, #1a1e24 40%, #12151a 68%, #0b0d10)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #9BA8B8, #475569 35%, #334155 68%, #1E293B)',
    },
  };

  return weatherMap[code] || weatherMap[0];
};

const Weather = ({
  location,
  current,
  daily,
  timezone,
}: WeatherWidgetProps) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const unit = getMeasurementUnit();
  const isImperial = unit === 'imperial';
  const tempUnitLabel = isImperial ? '°F' : '°C';
  const windUnitLabel = isImperial ? 'mph' : 'km/h';

  const formatTemp = (celsius: number) => {
    if (!Number.isFinite(celsius)) return 0;
    return Math.round(isImperial ? (celsius * 9) / 5 + 32 : celsius);
  };

  const formatWind = (speedKmh: number) => {
    if (!Number.isFinite(speedKmh)) return 0;
    return Math.round(isImperial ? speedKmh * 0.621371 : speedKmh);
  };

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };

    checkDarkMode();

    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  const weatherInfo = useMemo(
    () =>
      getWeatherInfo(
        current?.weather_code || 0,
        current?.is_day === 1,
        isDarkMode,
      ),
    [current?.weather_code, current?.is_day, isDarkMode],
  );

  const forecast = useMemo(() => {
    if (!daily?.time || daily.time.length === 0) return [];

    return daily.time.slice(1, 7).map((time, idx) => {
      const date = new Date(time);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const isDay = true;
      const weatherCode = daily.weather_code[idx + 1];
      const info = getWeatherInfo(weatherCode, isDay, isDarkMode);

      return {
        day: dayName,
        icon: info.icon,
        high: formatTemp(daily.temperature_2m_max[idx + 1]),
        low: formatTemp(daily.temperature_2m_min[idx + 1]),
        precipitation: daily.precipitation_probability_max[idx + 1] || 0,
      };
    });
  }, [daily, isDarkMode, isImperial]);

  if (!current || !daily || !daily.time || daily.time.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-lg shadow-md bg-gray-200 dark:bg-gray-800">
        <div className="p-4 text-black dark:text-white">
          <p className="text-sm">Weather data unavailable for {location}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg shadow-md">
      <div
        className="absolute inset-0"
        style={{
          background: weatherInfo.gradient,
        }}
      />

      <div className="relative p-4 text-gray-900 dark:text-white">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <img
              src={`/weather-ico/${weatherInfo.icon}`}
              alt={weatherInfo.description}
              className="w-16 h-16 drop-shadow-lg object-contain flex-shrink-0"
            />
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold drop-shadow-md">
                  {formatTemp(current.temperature_2m)}°
                </span>
                <span className="text-lg">{tempUnitLabel}</span>
              </div>
              <p className="text-sm font-medium drop-shadow mt-0.5">
                {weatherInfo.description}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold opacity-90">
              {formatTemp(daily.temperature_2m_max[0])}°{' '}
              {formatTemp(daily.temperature_2m_min[0])}°
            </p>
          </div>
        </div>

        <div className="mb-3 pb-3 border-b border-gray-800/20 dark:border-white/20">
          <h3 className="text-base font-semibold drop-shadow-md">{location}</h3>
          <p className="text-xs text-gray-700 dark:text-white/80 drop-shadow mt-0.5">
            {new Date(current.time).toLocaleString('en-US', {
              weekday: 'short',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        </div>

        <div className="grid grid-cols-6 gap-2 mb-3 pb-3 border-b border-gray-800/20 dark:border-white/20">
          {forecast.map((day, idx) => (
            <div
              key={idx}
              className="flex flex-col items-center bg-white/50 dark:bg-black/40 backdrop-blur-sm border border-black/10 dark:border-white/10 rounded-md p-2 shadow-sm"
            >
              <p className="text-xs font-semibold mb-1 text-gray-800 dark:text-white/90">{day.day}</p>
              <img
                src={`/weather-ico/${day.icon}`}
                alt=""
                className="w-8 h-8 mb-1 object-contain"
              />
              <div className="flex items-center gap-1 text-xs">
                <span className="font-semibold text-gray-900 dark:text-white">{day.high}°</span>
                <span className="text-gray-600 dark:text-white/70">
                  {day.low}°
                </span>
              </div>
              {day.precipitation > 0 && (
                <div className="flex items-center gap-0.5 mt-1">
                  <Droplets className="w-3 h-3 text-blue-600 dark:text-blue-300" />
                  <span className="text-[10px] font-medium text-gray-700 dark:text-white/80">
                    {day.precipitation}%
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-2 bg-white/50 dark:bg-black/40 backdrop-blur-sm border border-black/10 dark:border-white/10 rounded-md p-2 shadow-sm">
            <Wind className="w-4 h-4 text-gray-800 dark:text-white/90 flex-shrink-0" />
            <div>
              <p className="text-[10px] font-medium text-gray-700 dark:text-white/75">
                Wind
              </p>
              <p className="font-bold text-gray-900 dark:text-white">
                {formatWind(current.wind_speed_10m)} {windUnitLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/50 dark:bg-black/40 backdrop-blur-sm border border-black/10 dark:border-white/10 rounded-md p-2 shadow-sm">
            <Droplets className="w-4 h-4 text-gray-800 dark:text-white/90 flex-shrink-0" />
            <div>
              <p className="text-[10px] font-medium text-gray-700 dark:text-white/75">
                Humidity
              </p>
              <p className="font-bold text-gray-900 dark:text-white">
                {Math.round(current.relative_humidity_2m)}%
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/50 dark:bg-black/40 backdrop-blur-sm border border-black/10 dark:border-white/10 rounded-md p-2 shadow-sm">
            <Gauge className="w-4 h-4 text-gray-800 dark:text-white/90 flex-shrink-0" />
            <div>
              <p className="text-[10px] font-medium text-gray-700 dark:text-white/75">
                Feels Like
              </p>
              <p className="font-bold text-gray-900 dark:text-white">
                {formatTemp(current.apparent_temperature)}
                {tempUnitLabel}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Weather;
