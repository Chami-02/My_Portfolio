// frontend/src/hooks/useAdminFlash.js
import { useContext } from 'react';
import { AdminFlashContext } from '../components/admin/AdminFlashContext';

/**
 * PF-107. Read and raise the admin shell's saved-flash banner.
 *
 *     const { showFlash } = useAdminFlash();
 *     showFlash('Profile saved');
 *
 * Outside an AdminFlashProvider this returns working no-ops rather
 * than throwing — see AdminFlashContext.js.
 *
 * ⚠️ Read and write are NOT split into two hooks the way
 * useSplashReady/useSplashControls are. There the split exists because
 * most consumers only read splash state and should not be able to
 * drive it. Here the shape is the opposite: the shell is the only
 * reader and every panel is a writer, so a second hook would guard
 * nothing.
 */
export const useAdminFlash = () => useContext(AdminFlashContext);
