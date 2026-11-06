import { agoText } from './audienceStats';

/**
 * 999 → '999', 1,299 → '1.2k', 2,500,000 → '2.5M'. Always rounded DOWN, so the
 * box never claims more than really happened.
 */
export function shortCount(value) {
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${Math.floor(value / 100) / 10}k`;
  return `${Math.floor(value / 100_000) / 10}M`;
}

/** 'Updated just now' / 'Updated 12 minutes ago'. A fast clock reads as just now. */
export function updatedText(updatedAt, now) {
  const age = now - new Date(updatedAt).getTime();
  return age < 60_000 ? 'Updated just now' : `Updated ${agoText(age)}`;
}
