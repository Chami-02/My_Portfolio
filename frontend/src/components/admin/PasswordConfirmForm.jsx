// frontend/src/components/admin/PasswordConfirmForm.jsx
import { useState } from 'react';
import { fieldProps, errorId } from '../../utils/formErrors';
import { EyeIcon, EyeOffIcon } from '../icons/BrandIcons';
import a from '../../styles/admin.module.css';

/**
 * "Confirm with your password" — the form inside a ConfirmDialog before a
 * sensitive action (OWASP ASVS 5.0 V7.5: authenticate again first).
 * PF-132's Sessions card built it; PF-135's Backup card is the second user,
 * so it lives here once.
 *
 * The caller owns the value, the guard (`useFormGuard`) and the server's
 * error; this owns only the eye toggle. The dialog unmounts on close, so the
 * password is hidden again every time it opens.
 *
 * `noValidate` — the guard marks an empty field, never the browser.
 *
 * @param fid         id namespace: the input is `${fid}-password`
 * @param guard       the caller's useFormGuard result
 * @param inputRef    give it to ConfirmDialog's `initialFocusRef` too
 * @param error       the server's refusal ("Your password is wrong."), or ''
 */
export function PasswordConfirmForm({ fid, guard, inputRef, password, onPasswordChange, error, onSubmit }) {
  const [shown, setShown] = useState(false);

  return (
    <form className={a.form} onSubmit={onSubmit} noValidate>
      {error && (
        <div className={a.bannerError} role="alert">
          <span className={a.bannerDot} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
      <div>
        <label className={a.label} htmlFor={`${fid}-password`}>Your password</label>
        <div className={a.passwordWrap}>
          <input
            {...fieldProps(guard.errors, fid, 'password')}
            ref={inputRef}
            className={a.input}
            type={shown ? 'text' : 'password'}
            name="password"
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={password}
            onChange={(e) => { onPasswordChange(e.target.value); guard.clearField('password'); }}
          />
          <button
            type="button"
            className={a.reveal}
            aria-label="Show password"
            aria-pressed={shown}
            aria-controls={`${fid}-password`}
            onClick={() => setShown((v) => !v)}
          >
            {shown ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
          </button>
        </div>
        {guard.errorFor('password') && (
          <p className={a.fieldError} id={errorId(fid, 'password')} role="alert">
            {guard.errorFor('password')}
          </p>
        )}
      </div>
    </form>
  );
}
