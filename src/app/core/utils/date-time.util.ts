export const APP_TIME_ZONE = 'America/Mexico_City';

export function parseApiDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const hasExplicitTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(raw);
  const normalized = raw.includes(' ') ? raw.replace(' ', 'T') : raw;
  const candidate = hasExplicitTimezone ? normalized : `${normalized}Z`;
  const parsed = new Date(candidate);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatMexicoDateTime(
  value: string | Date | null | undefined,
  locale = 'es-MX',
  options: Intl.DateTimeFormatOptions = {},
): string {
  const date = parseApiDate(value);
  if (!date) return 'N/A';

  return new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }).format(date);
}

export function formatMexicoDate(
  value: string | Date | null | undefined,
  locale = 'es-MX',
  options: Intl.DateTimeFormatOptions = {},
): string {
  const date = parseApiDate(value);
  if (!date) return 'N/A';

  return new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  }).format(date);
}

export function formatMexicoNow(locale = 'es-MX'): string {
  return formatMexicoDateTime(new Date(), locale);
}
