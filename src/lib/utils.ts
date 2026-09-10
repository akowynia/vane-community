import clsx, { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...classes: ClassValue[]) => twMerge(clsx(...classes));

export const formatTimeDifference = (
  date1: Date | string,
  date2?: Date | string,
  locale: string = 'en',
): string => {
  let baseDate: Date;
  let targetDate: Date;
  let loc = locale || 'en';

  if (date2 === undefined) {
    baseDate = new Date();
    targetDate = new Date(date1);
  } else if (
    typeof date2 === 'string' &&
    (date2.length <= 8 || isNaN(Date.parse(date2))) &&
    !date2.includes('-') &&
    !date2.includes(':') &&
    !date2.includes('/')
  ) {
    baseDate = new Date();
    targetDate = new Date(date1);
    loc = date2;
  } else {
    baseDate = new Date(date1);
    targetDate = new Date(date2);
  }

  if (isNaN(baseDate.getTime()) || isNaN(targetDate.getTime())) {
    return '—';
  }

  // diff = past - now (negative for past time)
  const diffInSeconds = Math.floor(
    (targetDate.getTime() - baseDate.getTime()) / 1000,
  );

  const absDiff = Math.abs(diffInSeconds);
  if (isNaN(absDiff)) {
    return '—';
  }

  try {
    const rtf = new Intl.RelativeTimeFormat(loc || 'en', {
      numeric: 'auto',
    });

    if (absDiff < 60) {
      return rtf.format(diffInSeconds, 'second');
    } else if (absDiff < 3600) {
      return rtf.format(Math.floor(diffInSeconds / 60), 'minute');
    } else if (absDiff < 86400) {
      return rtf.format(Math.floor(diffInSeconds / 3600), 'hour');
    } else if (absDiff < 31536000) {
      return rtf.format(Math.floor(diffInSeconds / 86400), 'day');
    } else {
      return rtf.format(Math.floor(diffInSeconds / 31536000), 'year');
    }
  } catch {
    if (absDiff < 60) return diffInSeconds < 0 ? `${absDiff}s ago` : `in ${absDiff}s`;
    if (absDiff < 3600) return diffInSeconds < 0 ? `${Math.floor(absDiff / 60)}m ago` : `in ${Math.floor(absDiff / 60)}m`;
    if (absDiff < 86400) return diffInSeconds < 0 ? `${Math.floor(absDiff / 3600)}h ago` : `in ${Math.floor(absDiff / 3600)}h`;
    return diffInSeconds < 0 ? `${Math.floor(absDiff / 86400)}d ago` : `in ${Math.floor(absDiff / 86400)}d`;
  }
};

