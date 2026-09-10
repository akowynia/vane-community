/**
 * Zero-dependency robust 5-field Cron parser and next-run calculator.
 * Supports: minute (0-59), hour (0-23), day of month (1-31), month (1-12), day of week (0-6, 0=Sun).
 */

export interface ParsedCron {
  minutes: Set<number>;
  hours: Set<number>;
  daysOfMonth: Set<number>;
  months: Set<number>;
  daysOfWeek: Set<number>;
}

// Map named presets to standard 5-part cron syntax
export const CRON_PRESETS: Record<string, string> = {
  '@hourly': '0 * * * *',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@weekly': '0 0 * * 1',
  '@monthly': '0 0 1 * *',
  'every_hour': '0 * * * *',
  'every_day': '0 8 * * *',
  'weekdays': '0 8 * * 1-5',
  'every_monday': '0 8 * * 1',
};

function parseField(field: string, min: number, max: number, isDayOfWeek = false): Set<number> | null {
  const result = new Set<number>();
  const normalized = field.trim();

  if (!normalized) return null;

  const parts = normalized.split(',');
  for (const part of parts) {
    if (part === '*') {
      for (let i = min; i <= max; i++) result.add(i);
    } else if (part.includes('/')) {
      const [rangePart, stepStr] = part.split('/');
      const step = parseInt(stepStr, 10);
      if (isNaN(step) || step <= 0) return null;

      let start = min;
      let end = max;

      if (rangePart !== '*') {
        if (rangePart.includes('-')) {
          const [rStart, rEnd] = rangePart.split('-').map((v) => parseInt(v, 10));
          if (isNaN(rStart) || isNaN(rEnd) || rStart < min || rEnd > max || rStart > rEnd) return null;
          start = rStart;
          end = rEnd;
        } else {
          const singleStart = parseInt(rangePart, 10);
          if (isNaN(singleStart) || singleStart < min || singleStart > max) return null;
          start = singleStart;
        }
      }

      for (let i = start; i <= end; i += step) {
        result.add(i);
      }
    } else if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      let start = parseInt(startStr, 10);
      let end = parseInt(endStr, 10);

      if (isDayOfWeek && start === 7) start = 0;
      if (isDayOfWeek && end === 7) end = 0;

      if (isNaN(start) || isNaN(end)) return null;

      if (start <= end) {
        if (start < min || end > max) return null;
        for (let i = start; i <= end; i++) result.add(i);
      } else {
        // Wraparound support e.g. 5-1 (Fri to Mon)
        for (let i = start; i <= max; i++) result.add(i);
        for (let i = min; i <= end; i++) result.add(i);
      }
    } else {
      let num = parseInt(part, 10);
      if (isNaN(num)) return null;
      if (isDayOfWeek && num === 7) num = 0; // standard 7=Sun -> 0=Sun
      if (num < min || num > max) return null;
      result.add(num);
    }
  }

  return result.size > 0 ? result : null;
}

export function normalizeCronExpression(expr: string): string {
  const trimmed = expr.trim();
  if (CRON_PRESETS[trimmed]) {
    return CRON_PRESETS[trimmed];
  }
  // If user passes "HH:MM", convert to "MM HH * * *"
  if (/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(trimmed)) {
    const [h, m] = trimmed.split(':').map((n) => parseInt(n, 10));
    return `${m} ${h} * * *`;
  }
  return trimmed;
}

export function parseCron(expr: string): ParsedCron | null {
  const normalized = normalizeCronExpression(expr);
  const parts = normalized.split(/\s+/);
  if (parts.length !== 5) return null;

  const minutes = parseField(parts[0], 0, 59);
  const hours = parseField(parts[1], 0, 23);
  const daysOfMonth = parseField(parts[2], 1, 31);
  const months = parseField(parts[3], 1, 12);
  const daysOfWeek = parseField(parts[4], 0, 6, true);

  if (!minutes || !hours || !daysOfMonth || !months || !daysOfWeek) {
    return null;
  }

  return {
    minutes,
    hours,
    daysOfMonth,
    months,
    daysOfWeek,
  };
}

export function isValidCron(expr: string): boolean {
  return parseCron(expr) !== null;
}

export function getZonedParts(date: Date, timeZone: string = 'UTC') {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || 'UTC',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      weekday: 'short',
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const map: Record<string, string> = {};
    for (const p of parts) {
      map[p.type] = p.value;
    }

    let hour = parseInt(map.hour, 10);
    if (hour === 24) hour = 0;

    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };

    return {
      year: parseInt(map.year, 10),
      month: parseInt(map.month, 10), // 1-12
      day: parseInt(map.day, 10), // 1-31
      hour, // 0-23
      minute: parseInt(map.minute, 10), // 0-59
      second: parseInt(map.second, 10),
      dayOfWeek: weekdayMap[map.weekday] ?? 0,
    };
  } catch {
    // Fallback to UTC if invalid timezone
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      second: date.getUTCSeconds(),
      dayOfWeek: date.getUTCDay(),
    };
  }
}

/**
 * Computes next run timestamp starting strictly after `fromDate` in the specified `timeZone`.
 */
export function computeNextRun(
  expr: string,
  fromDate?: Date,
  timeZone: string = 'UTC',
): Date | null {
  const parsed = parseCron(expr);
  if (!parsed) return null;

  const validZone = timeZone || 'UTC';
  const start = fromDate ? new Date(fromDate.getTime()) : new Date();

  // Round up to the start of the next minute
  let currentMs = Math.floor(start.getTime() / 60000) * 60000 + 60000;
  const maxIterations = 60 * 24 * 366; // Look up to 1 year ahead (minutes)

  for (let i = 0; i < maxIterations; i++) {
    const curDate = new Date(currentMs);
    const zoned = getZonedParts(curDate, validZone);

    if (!parsed.months.has(zoned.month)) {
      // Advance by ~1 day
      currentMs += 24 * 3600 * 1000;
      continue;
    }

    const domMatch = parsed.daysOfMonth.has(zoned.day);
    const dowMatch = parsed.daysOfWeek.has(zoned.dayOfWeek);

    if (!domMatch || !dowMatch) {
      // Advance by ~1 hour
      currentMs += 3600 * 1000;
      continue;
    }

    if (!parsed.hours.has(zoned.hour)) {
      // Advance by 1 minute
      currentMs += 60 * 1000;
      continue;
    }

    if (!parsed.minutes.has(zoned.minute)) {
      // Advance by 1 minute
      currentMs += 60 * 1000;
      continue;
    }

    // Found exact match
    return curDate;
  }

  return null;
}

const SCHEDULE_I18N: Record<
  string,
  {
    everyDay: (time: string) => string;
    weekdays: (time: string) => string;
    monday: (time: string) => string;
    friday: (time: string) => string;
    sunday: (time: string) => string;
    weekends: (time: string) => string;
    everyHour: string;
    everyXHours: (h: string) => string;
    everyXMinutes: (m: string) => string;
    hourlyAtMinute: (m: string) => string;
  }
> = {
  pl: {
    everyDay: (t) => `Codziennie o ${t}`,
    weekdays: (t) => `W dni robocze (pon-pt) o ${t}`,
    monday: (t) => `W każdy poniedziałek o ${t}`,
    friday: (t) => `W każdy piątek o ${t}`,
    sunday: (t) => `W każdą niedzielę o ${t}`,
    weekends: (t) => `W weekendy o ${t}`,
    everyHour: 'Co godzinę',
    everyXHours: (h) => `Co ${h} godz.`,
    everyXMinutes: (m) => `Co ${m} min.`,
    hourlyAtMinute: (m) => `Co godzinę w minucie ${m}`,
  },
  en: {
    everyDay: (t) => `Every day at ${t}`,
    weekdays: (t) => `Weekdays (Mon-Fri) at ${t}`,
    monday: (t) => `Every Monday at ${t}`,
    friday: (t) => `Every Friday at ${t}`,
    sunday: (t) => `Every Sunday at ${t}`,
    weekends: (t) => `Weekends at ${t}`,
    everyHour: 'Every hour',
    everyXHours: (h) => `Every ${h} hours`,
    everyXMinutes: (m) => `Every ${m} minutes`,
    hourlyAtMinute: (m) => `Every hour at minute ${m}`,
  },
  de: {
    everyDay: (t) => `Täglich um ${t}`,
    weekdays: (t) => `Wochentags (Mo-Fr) um ${t}`,
    monday: (t) => `Jeden Montag um ${t}`,
    friday: (t) => `Jeden Freitag um ${t}`,
    sunday: (t) => `Jeden Sonntag um ${t}`,
    weekends: (t) => `Am Wochenende um ${t}`,
    everyHour: 'Jede Stunde',
    everyXHours: (h) => `Alle ${h} Stunden`,
    everyXMinutes: (m) => `Alle ${m} Minuten`,
    hourlyAtMinute: (m) => `Jede Stunde in Minute ${m}`,
  },
  es: {
    everyDay: (t) => `Todos los días a las ${t}`,
    weekdays: (t) => `Días laborables (Lun-Vie) a las ${t}`,
    monday: (t) => `Todos los lunes a las ${t}`,
    friday: (t) => `Todos los viernes a las ${t}`,
    sunday: (t) => `Todos los domingos a las ${t}`,
    weekends: (t) => `Fines de semana a las ${t}`,
    everyHour: 'Cada hora',
    everyXHours: (h) => `Cada ${h} horas`,
    everyXMinutes: (m) => `Cada ${m} minutos`,
    hourlyAtMinute: (m) => `Cada hora en el minuto ${m}`,
  },
  fr: {
    everyDay: (t) => `Tous les jours à ${t}`,
    weekdays: (t) => `En semaine (lun-ven) à ${t}`,
    monday: (t) => `Chaque lundi à ${t}`,
    friday: (t) => `Chaque vendredi à ${t}`,
    sunday: (t) => `Chaque dimanche à ${t}`,
    weekends: (t) => `Le week-end à ${t}`,
    everyHour: 'Toutes les heures',
    everyXHours: (h) => `Toutes les ${h} heures`,
    everyXMinutes: (m) => `Toutes les ${m} minutes`,
    hourlyAtMinute: (m) => `Toutes les heures à la minute ${m}`,
  },
  it: {
    everyDay: (t) => `Ogni giorno alle ${t}`,
    weekdays: (t) => `Giorni feriali (lun-ven) alle ${t}`,
    monday: (t) => `Ogni lunedì alle ${t}`,
    friday: (t) => `Ogni venerdì alle ${t}`,
    sunday: (t) => `Ogni domenica alle ${t}`,
    weekends: (t) => `Nei fine settimana alle ${t}`,
    everyHour: 'Ogni ora',
    everyXHours: (h) => `Ogni ${h} ore`,
    everyXMinutes: (m) => `Ogni ${m} minuti`,
    hourlyAtMinute: (m) => `Ogni ora al minuto ${m}`,
  },
  pt: {
    everyDay: (t) => `Todos os dias às ${t}`,
    weekdays: (t) => `Dias de semana (seg-sex) às ${t}`,
    monday: (t) => `Toda segunda-feira às ${t}`,
    friday: (t) => `Toda sexta-feira às ${t}`,
    sunday: (t) => `Todo domingo às ${t}`,
    weekends: (t) => `Nos fins de semana às ${t}`,
    everyHour: 'A cada hora',
    everyXHours: (h) => `A cada ${h} horas`,
    everyXMinutes: (m) => `A cada ${m} minutos`,
    hourlyAtMinute: (m) => `A cada hora no minuto ${m}`,
  },
  ru: {
    everyDay: (t) => `Каждый день в ${t}`,
    weekdays: (t) => `По будням (пн-пт) в ${t}`,
    monday: (t) => `Каждый понедельник в ${t}`,
    friday: (t) => `Каждую пятницу в ${t}`,
    sunday: (t) => `Каждое воскресенье в ${t}`,
    weekends: (t) => `По выходным в ${t}`,
    everyHour: 'Каждый час',
    everyXHours: (h) => `Каждые ${h} ч.`,
    everyXMinutes: (m) => `Каждые ${m} мин.`,
    hourlyAtMinute: (m) => `Каждый час на минуте ${m}`,
  },
  uk: {
    everyDay: (t) => `Щодня о ${t}`,
    weekdays: (t) => `У робочі дні (пн-пт) о ${t}`,
    monday: (t) => `Щопонеділка о ${t}`,
    friday: (t) => `Щоп'ятниці о ${t}`,
    sunday: (t) => `Щонеділі о ${t}`,
    weekends: (t) => `У вихідні о ${t}`,
    everyHour: 'Щогодини',
    everyXHours: (h) => `Кожні ${h} год.`,
    everyXMinutes: (m) => `Кожні ${m} хв.`,
    hourlyAtMinute: (m) => `Щогодини на хвилині ${m}`,
  },
  zh: {
    everyDay: (t) => `每天 ${t}`,
    weekdays: (t) => `工作日（周一至周五）${t}`,
    monday: (t) => `每周一 ${t}`,
    friday: (t) => `每周五 ${t}`,
    sunday: (t) => `每周日 ${t}`,
    weekends: (t) => `周末 ${t}`,
    everyHour: '每小时',
    everyXHours: (h) => `每 ${h} 小时`,
    everyXMinutes: (m) => `每 ${m} 分钟`,
    hourlyAtMinute: (m) => `每小时第 ${m} 分钟`,
  },
  ja: {
    everyDay: (t) => `毎日 ${t}`,
    weekdays: (t) => `平日（月〜金）${t}`,
    monday: (t) => `毎週月曜日 ${t}`,
    friday: (t) => `毎週金曜日 ${t}`,
    sunday: (t) => `毎週日曜日 ${t}`,
    weekends: (t) => `週末 ${t}`,
    everyHour: '毎時',
    everyXHours: (h) => `${h}時間ごと`,
    everyXMinutes: (m) => `${m}分ごと`,
    hourlyAtMinute: (m) => `毎時 ${m}分`,
  },
  ko: {
    everyDay: (t) => `매일 ${t}`,
    weekdays: (t) => `주중 (월-금) ${t}`,
    monday: (t) => `매주 월요일 ${t}`,
    friday: (t) => `매주 금요일 ${t}`,
    sunday: (t) => `매주 일요일 ${t}`,
    weekends: (t) => `주말 ${t}`,
    everyHour: '매시간',
    everyXHours: (h) => `${h}시간마다`,
    everyXMinutes: (m) => `${m}분마다`,
    hourlyAtMinute: (m) => `매시간 ${m}분`,
  },
};

/**
 * Generates human readable description of a cron schedule.
 */
export function describeSchedule(expr: string, locale: string = 'en'): string {
  const langKey = locale ? locale.toLowerCase().split(/[-_]/)[0] : 'en';
  const i18n = SCHEDULE_I18N[langKey] || SCHEDULE_I18N['en'];
  const normalized = normalizeCronExpression(expr);
  const parts = normalized.split(/\s+/);

  if (parts.length !== 5) {
    return expr;
  }

  const [minStr, hourStr, domStr, monthStr, dowStr] = parts;

  const pad = (n: number) => n.toString().padStart(2, '0');

  // Exact time daily: "M H * * *"
  if (/^\d+$/.test(minStr) && /^\d+$/.test(hourStr) && domStr === '*' && monthStr === '*') {
    const timeStr = `${pad(parseInt(hourStr, 10))}:${pad(parseInt(minStr, 10))}`;

    if (dowStr === '*') {
      return i18n.everyDay(timeStr);
    }
    if (dowStr === '1-5') {
      return i18n.weekdays(timeStr);
    }
    if (dowStr === '1') {
      return i18n.monday(timeStr);
    }
    if (dowStr === '5') {
      return i18n.friday(timeStr);
    }
    if (dowStr === '0' || dowStr === '7') {
      return i18n.sunday(timeStr);
    }
    if (dowStr === '6,0' || dowStr === '0,6') {
      return i18n.weekends(timeStr);
    }
  }

  // Every X hours: "0 */X * * *"
  if (minStr === '0' && hourStr.startsWith('*/') && domStr === '*' && monthStr === '*' && dowStr === '*') {
    const step = hourStr.slice(2);
    if (step === '1') {
      return i18n.everyHour;
    }
    return i18n.everyXHours(step);
  }

  // Every X minutes: "*/X * * * *"
  if (minStr.startsWith('*/') && hourStr === '*' && domStr === '*' && monthStr === '*' && dowStr === '*') {
    const step = minStr.slice(2);
    return i18n.everyXMinutes(step);
  }

  // Hourly at minute X: "M * * * *"
  if (/^\d+$/.test(minStr) && hourStr === '*' && domStr === '*' && monthStr === '*' && dowStr === '*') {
    return i18n.hourlyAtMinute(minStr);
  }

  return expr;
}

