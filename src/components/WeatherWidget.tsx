'use client';

import { Wind, MoreVertical } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getApproxLocation } from '@/lib/actions';
import { useTranslation } from '@/lib/i18n';

const WeatherWidget = () => {
  const { t } = useTranslation();
  const [data, setData] = useState({
    temperature: 0,
    condition: '',
    location: '',
    humidity: 0,
    windSpeed: 0,
    icon: '',
    temperatureUnit: 'C',
    windSpeedUnit: 'm/s',
  });

  const [loading, setLoading] = useState(true);

  const getLocation = async (
    callback: (location: {
      latitude: number;
      longitude: number;
      city: string;
    }) => void,
  ) => {
    if (navigator.geolocation) {
      const result = await navigator.permissions.query({
        name: 'geolocation',
      });

      if (result.state === 'granted') {
        navigator.geolocation.getCurrentPosition(async (position) => {
          const res = await fetch(
            `https://api-bdc.io/data/reverse-geocode-client?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&localityLanguage=en`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
            },
          );

          const data = await res.json();

          callback({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            city: data.locality,
          });
        });
      } else if (result.state === 'prompt') {
        callback(await getApproxLocation());
        navigator.geolocation.getCurrentPosition((position) => {});
      } else if (result.state === 'denied') {
        callback(await getApproxLocation());
      }
    } else {
      callback(await getApproxLocation());
    }
  };

  const updateWeather = async () => {
    getLocation(async (location) => {
      const res = await fetch(`/api/weather`, {
        method: 'POST',
        body: JSON.stringify({
          lat: location.latitude,
          lng: location.longitude,
          measureUnit: localStorage.getItem('measureUnit') ?? 'Metric',
        }),
      });

      const data = await res.json();

      if (res.status !== 200) {
        console.error('Error fetching weather data');
        setLoading(false);
        return;
      }

      setData({
        temperature: data.temperature,
        condition: data.condition,
        location: location.city,
        humidity: data.humidity,
        windSpeed: data.windSpeed,
        icon: data.icon,
        temperatureUnit: data.temperatureUnit,
        windSpeedUnit: data.windSpeedUnit,
      });
      setLoading(false);
    });
  };

  useEffect(() => {
    updateWeather();
    const intervalId = setInterval(updateWeather, 30 * 1000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="bg-light-secondary/90 dark:bg-[#161412]/85 backdrop-blur-md rounded-2xl border border-light-200 dark:border-[#28221b] shadow-lg shadow-black/20 hover:border-light-300 dark:hover:border-[#3d342a] p-4 flex flex-col justify-between w-full h-[128px] transition duration-200">
      {loading ? (
        <div className="animate-pulse flex flex-col justify-between h-full">
          <div className="flex flex-row items-center justify-between">
            <div className="h-3 w-16 rounded bg-light-200 dark:bg-[#25201a]" />
            <div className="h-3 w-3 rounded-full bg-light-200 dark:bg-[#25201a]" />
          </div>
          <div className="flex flex-row items-center space-x-3 my-1">
            <div className="h-10 w-10 rounded-full bg-light-200 dark:bg-[#25201a]" />
            <div className="h-7 w-20 rounded bg-light-200 dark:bg-[#25201a]" />
          </div>
          <div className="flex flex-row justify-between pt-1 border-t border-light-200/50 dark:border-[#28221b]/60">
            <div className="h-3 w-20 rounded bg-light-200 dark:bg-[#25201a]" />
            <div className="h-3 w-14 rounded bg-light-200 dark:bg-[#25201a]" />
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-row items-center justify-between text-xs text-black/60 dark:text-stone-400 font-medium">
            <span>Weather</span>
            <button
              onClick={updateWeather}
              title="Refresh"
              className="text-black/40 dark:text-stone-500 hover:text-black dark:hover:text-stone-300 transition"
            >
              <MoreVertical size={14} />
            </button>
          </div>
          <div className="flex flex-row items-center justify-between my-0.5">
            <div className="flex flex-row items-center space-x-2.5">
              <img
                src={`/weather-ico/${data.icon}.svg`}
                alt={data.condition}
                className="h-9 w-auto object-contain"
              />
              <span className="text-3xl font-light text-black dark:text-stone-100">
                {data.temperature}°{data.temperatureUnit}
              </span>
            </div>
            <div className="flex flex-col items-end text-right">
              <span className="flex items-center text-xs font-medium text-black/70 dark:text-stone-300">
                <Wind className="w-3 h-3 mr-1 text-black/40 dark:text-stone-500" />
                {data.windSpeed} {data.windSpeedUnit}
              </span>
              <span className="text-[10px] text-black/50 dark:text-stone-500 italic">
                {data.condition}
              </span>
            </div>
          </div>
          <div className="flex flex-row justify-between w-full pt-2 border-t border-light-200/50 dark:border-[#28221b]/60 text-[11px] text-black/50 dark:text-stone-400 font-medium">
            <span className="truncate max-w-[150px]">{data.location}</span>
            <span>{t('widgets.humidity', { value: data.humidity })}</span>
          </div>
        </>
      )}
    </div>
  );
};

export default WeatherWidget;
