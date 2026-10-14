// frontend/src/utils/dashboard.js
//
// PF-110. React-free, like the rest of utils/.

/**
 * The Overview eyebrow's time-of-day word — Admin.dc.html:999-1000:
 *
 *   const hr = new Date().getHours();
 *   hr < 12 ? 'GOOD MORNING' : hr < 18 ? 'GOOD AFTERNOON' : 'GOOD EVENING'
 *
 * Takes the Date rather than reading the clock itself so the boundaries
 * are testable without faking timers. Local hours, as the prototype.
 */
export function greetingFor(date = new Date()) {
  const hr = date.getHours();
  if (hr < 12) return 'GOOD MORNING';
  if (hr < 18) return 'GOOD AFTERNOON';
  return 'GOOD EVENING';
}
