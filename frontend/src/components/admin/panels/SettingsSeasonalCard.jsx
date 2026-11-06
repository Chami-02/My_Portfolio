// frontend/src/components/admin/panels/SettingsSeasonalCard.jsx
import { useState } from 'react';
import { useAbout, useUpdateAbout } from '../../../hooks/useAbout';
import { useAdminFlash }     from '../../../hooks/useAdminFlash';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges';
import { resetErrorMessage } from '../../../utils/resetError';
import { seasonStatus }      from '../../../utils/seasonalEffect';
import { LoadError }         from '../LoadError';
import styles from './AdminSettingsPanel.module.css';
import a from '../../../styles/admin.module.css';

const FID = 'settings-seasonal';

const CHOICES = Object.freeze([
  { value: 'auto',      label: 'AUTOMATIC' },
  { value: 'snow',      label: 'SNOW NOW' },
  { value: 'halloween', label: 'HALLOWEEN NOW' },
  { value: 'off',       label: 'OFF' },
]);

/**
 * PF-151 — the switch (owner, 2026-11-06: "fully automated… a switch in the
 * admin panel to test it"). AUTOMATIC follows the dates in
 * `utils/seasonalEffect.js`, and the other three override them for EVERY
 * visitor (owner's choice over a browser-only preview).
 *
 * Staged like every toggle that drives the site: nothing changes until SAVE,
 * and REVERT restores the saved choice. The status line describes what is SAVED
 * (what visitors see), never the staged choice.
 *
 * Joins the unsaved-changes guard with NO save: that dialog's Save never
 * publishes (PF-118 b2), and this card's only save does.
 */
export function SettingsSeasonalCard() {
  const aboutQuery = useAbout();
  const update = useUpdateAbout();
  const { showFlash } = useAdminFlash();

  const [open,   setOpen]   = useState(false);
  const [staged, setStaged] = useState(null);
  const [error,  setError]  = useState('');

  const saved  = aboutQuery.data?.seasonalEffect ?? 'auto';
  const choice = staged ?? saved;
  const dirty  = choice !== saved;

  const revert = () => {
    setStaged(null);
    setError('');
  };

  const requestLeave = useUnsavedChanges({ dirty, what: 'your seasonal effect choice' });

  const toggle = () => {
    if (open) {
      requestLeave(() => {
        revert();
        setOpen(false);
      });
    } else {
      setOpen(true);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      // Only this field: PUT /api/about leaves everything it is not sent alone.
      await update.mutateAsync({ seasonalEffect: choice });
      setStaged(null);
      showFlash('Seasonal effects saved');
    } catch (err) {
      setError(resetErrorMessage(err));
    }
  };

  return (
    <section className={a.panel} aria-labelledby={`${FID}-title`}>
      <div className={styles.disclosureHead}>
        <h2 className={a.panelTitle} id={`${FID}-title`}>Seasonal effects</h2>
        <button
          type="button"
          className={styles.disclosure}
          aria-expanded={open}
          aria-controls={`${FID}-body`}
          onClick={toggle}
        >
          CHANGE
          <span className={styles.chevron} aria-hidden="true">▾</span>
        </button>
      </div>

      {aboutQuery.isError && <LoadError what="SEASONAL EFFECTS" query={aboutQuery} />}
      {aboutQuery.isSuccess && <p className={styles.lastChanged}>{seasonStatus(saved)}</p>}

      <div
        id={`${FID}-body`}
        className={`${styles.collapse} ${open ? styles.collapseOpen : ''}`}
        inert={!open}
      >
        <div className={styles.collapseInner}>
          {aboutQuery.isSuccess && (
            <form className={styles.foldBody} onSubmit={save} noValidate>
              <p className={styles.lede}>
                Snow falls from 1 December to 1 January. Autumn leaves and bats fall from
                31 October to 2 November. AUTOMATIC does this every year by itself. The other
                choices apply to every visitor, on any date, as soon as you save.
              </p>

              <fieldset className={styles.choices}>
                <legend className={`${a.labelLead} ${styles.choicesLegend}`}>What shows on the site</legend>
                {CHOICES.map(({ value, label }) => (
                  <label key={value} className={styles.choice}>
                    <input
                      type="radio"
                      name={`${FID}-choice`}
                      value={value}
                      checked={choice === value}
                      onChange={() => { setStaged(value); setError(''); }}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>

              {saved !== 'auto' && (
                <p className={styles.hint}>
                  Set this back to AUTOMATIC when you finish testing, or the dates stay ignored.
                </p>
              )}

              {error && <div className={a.bannerError} role="alert">{error}</div>}

              <div className={styles.actions}>
                <button
                  type="submit"
                  className={`${a.btnPrimary} ${styles.noGlow}`}
                  disabled={!dirty || update.isPending}
                >
                  {update.isPending ? 'SAVING…' : 'SAVE'}
                </button>
                {dirty && !update.isPending && (
                  <>
                    <button type="button" className={a.btnOutline} onClick={revert}>
                      REVERT CHANGES
                    </button>
                    <span className={styles.unsaved}>UNSAVED CHANGES</span>
                  </>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
