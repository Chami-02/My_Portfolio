// frontend/src/components/icons/socialIcons.js
//
// PF-112 — which glyph fronts which social key.
//
// ⚠️ ITS OWN MODULE, and not by preference. `react-refresh/only-export-components`
// fails CI at --max-warnings=0 for any file that exports both components and
// something else, so this map cannot live in BrandIcons.jsx beside the glyphs it
// names. Same rule, same shape as providers/*Context.js living apart from their
// providers — a pattern this repo has already paid for three times.
//
// ⚠️ AND NOT IN `utils/social.js` either. Everything under utils/ here is
// React-free and directly unit-testable; a util exporting component references
// would break that silently and set the example for the next one. The split is:
// utils/social.js decides which rows exist and in what ORDER, this decides how
// they LOOK.

import {
  MailIcon, GitHubIcon, LinkedInIcon,
  FacebookIcon, InstagramIcon, TwitterIcon, LinkIcon,
} from './BrandIcons';

export const SOCIAL_ICONS = {
  github:    GitHubIcon,
  linkedin:  LinkedInIcon,
  facebook:  FacebookIcon,
  instagram: InstagramIcon,
  twitter:   TwitterIcon,
  email:     MailIcon,
};

/**
 * ⚠️ FALLS BACK rather than returning undefined, and that matters. React does
 * not reliably throw for `<undefined />` — depending on the shape it renders
 * nothing at all — so an unmapped key would produce a link with its text label
 * and no glyph, which looks like a CSS problem. Every custom link lands here.
 */
export const iconFor = (key) => SOCIAL_ICONS[key] ?? LinkIcon;
