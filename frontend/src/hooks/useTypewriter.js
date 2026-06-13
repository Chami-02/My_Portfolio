import { useEffect, useState } from 'react';

const ROLES = [
  'Full-Stack Developer',
  'MERN Stack Engineer',
  'React Developer',
  'Docker Enthusiast',
];

/**
 * Returns the currently displayed text for a cycling typewriter animation.
 * Automatically cycles through all ROLES strings.
 */
export function useTypewriter() {
  const [displayText, setDisplayText] = useState('');
  const [roleIndex,   setRoleIndex]   = useState(0);
  const [isDeleting,  setIsDeleting]  = useState(false);
  const [isPaused,    setIsPaused]    = useState(false);

  useEffect(() => {
    const current = ROLES[roleIndex];

    if (isPaused) {
      const t = setTimeout(() => { setIsPaused(false); setIsDeleting(true); }, 2200);
      return () => clearTimeout(t);
    }

    const speed = isDeleting ? 45 : 90;
    const t = setTimeout(() => {
      if (!isDeleting) {
        const next = current.substring(0, displayText.length + 1);
        setDisplayText(next);
        if (next === current) setIsPaused(true);
      } else {
        const next = displayText.substring(0, displayText.length - 1);
        setDisplayText(next);
        if (next === '') {
          setIsDeleting(false);
          setRoleIndex((i) => (i + 1) % ROLES.length);
        }
      }
    }, speed);

    return () => clearTimeout(t);
  }, [displayText, isDeleting, isPaused, roleIndex]);

  return displayText;
}