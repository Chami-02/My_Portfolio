// frontend/src/components/icons/index.js
// Barrel, matching components/motion/index.js. Import from '../icons',
// never from the file, so a later split into per-brand modules does not
// touch five call sites.
export {
  MailIcon,
  GitHubIcon,
  LinkedInIcon,
  FacebookIcon,
  InstagramIcon,
  // PF-112. ⚠️ A new icon needs an entry HERE as well as an export in the file:
  // the barrel is what every consumer imports from, and a missing line resolves
  // to `undefined`, which renders as nothing with no error at all.
  TwitterIcon,
  LinkIcon,
} from './BrandIcons';

// The key→glyph map. Separate module because a file exporting components may
// not also export constants — see socialIcons.js's own header.
export { SOCIAL_ICONS, iconFor } from './socialIcons';
