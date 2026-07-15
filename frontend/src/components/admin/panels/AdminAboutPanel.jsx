import { useState, useEffect }                         from 'react';
import { useAbout, useUpdateAbout, useToggleAvailability } from '../../../hooks/useAbout';

const INPUT = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: '0.5rem', padding: '0.625rem 0.875rem', color: 'var(--text-primary)',
  fontFamily: 'var(--font-sans)', fontSize: '0.875rem', outline: 'none', transition: 'border-color 0.2s',
};

export function AdminAboutPanel() {
  const { data: about, isLoading } = useAbout();
  const updateAbout          = useUpdateAbout();
  const toggleAvailability   = useToggleAvailability();

  const [form, setForm] = useState({
    name: '', title: '', location: '', email: '',
    bio: ['', ''], availabilityNote: '',
    social: { github: '', linkedin: '', twitter: '', email: '' },
  });
  const [saved, setSaved] = useState(false);

  // Pre-fill form when data loads
  useEffect(() => {
    if (about) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        name:             about.name             || '',
        title:            about.title            || '',
        location:         about.location         || '',
        email:            about.email            || '',
        bio:              about.bio?.length ? about.bio : ['', ''],
        availabilityNote: about.availabilityNote || '',
        social: {
          github:   about.social?.github   || '',
          linkedin: about.social?.linkedin || '',
          twitter:  about.social?.twitter  || '',
          email:    about.social?.email    || '',
        },
      });
    }
  }, [about]);

  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSocialChange = (e) =>
    setForm((p) => ({ ...p, social: { ...p.social, [e.target.name]: e.target.value } }));

  const handleBioChange = (index, value) =>
    setForm((p) => { const bio = [...p.bio]; bio[index] = value; return { ...p, bio }; });

  const addBioParagraph    = () => setForm((p) => ({ ...p, bio: [...p.bio, ''] }));
  const removeBioParagraph = (i) => setForm((p) => ({ ...p, bio: p.bio.filter((_, idx) => idx !== i) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    await updateAbout.mutateAsync(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {[1,2,3].map(n => <div key={n} className="skeleton" style={{ height: '48px', borderRadius: '0.5rem' }} />)}
      </div>
    );
  }

  const FocusInput = { onFocus: (e) => { e.target.style.borderColor = 'var(--accent)'; }, onBlur: (e) => { e.target.style.borderColor = 'var(--border)'; } };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>About / Profile</h2>

        {/* Availability toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-body)' }}>
            Status:{' '}
            <span style={{ color: about?.availableForWork ? 'var(--green)' : '#f87171', fontWeight: 600 }}>
              {about?.availableForWork ? 'Open to Work ✅' : 'Not Available ❌'}
            </span>
          </span>
          <button onClick={() => toggleAvailability.mutate()} className="btn-outline"
            style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}>
            Toggle
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Basic Info */}
        <div className="glass" style={{ borderRadius: '0.875rem', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1.25rem' }}>Basic Info</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.875rem' }}>
            {[
              { name: 'name',     label: 'Full Name',       placeholder: 'Parindra Chameekara' },
              { name: 'title',    label: 'Job Title',        placeholder: 'Full-Stack Developer' },
              { name: 'location', label: 'Location',         placeholder: 'Sri Lanka' },
              { name: 'email',    label: 'Contact Email',    placeholder: 'your@email.com' },
              { name: 'availabilityNote', label: 'Availability Note', placeholder: 'Open to junior roles' },
            ].map(({ name, label, placeholder }) => (
              <div key={name}>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.7rem',
                  fontFamily: 'var(--font-mono)', marginBottom: '0.375rem', textTransform: 'uppercase' }}>{label}</label>
                <input name={name} placeholder={placeholder} value={form[name]}
                  onChange={handleChange} style={INPUT} {...FocusInput} />
              </div>
            ))}
          </div>
        </div>

        {/* Bio paragraphs */}
        <div className="glass" style={{ borderRadius: '0.875rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Bio Paragraphs</h3>
            <button type="button" onClick={addBioParagraph} className="btn-outline"
              style={{ fontSize: '0.8rem', padding: '0.375rem 0.875rem' }}>
              + Add Paragraph
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {form.bio.map((para, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)',
                  marginTop: '0.625rem', minWidth: '1.25rem', textAlign: 'right' }}>{i + 1}.</span>
                <textarea rows={3} placeholder={`Paragraph ${i + 1}...`} value={para}
                  onChange={(e) => handleBioChange(i, e.target.value)}
                  style={{ ...INPUT, resize: 'vertical', flexGrow: 1 }} {...FocusInput} />
                {form.bio.length > 1 && (
                  <button type="button" onClick={() => removeBioParagraph(i)}
                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer',
                      fontSize: '1.25rem', lineHeight: 1, marginTop: '0.5rem', padding: '0 0.25rem' }}>
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Social links */}
        <div className="glass" style={{ borderRadius: '0.875rem', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1.25rem' }}>Social Links</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.875rem' }}>
            {[
              { name: 'github',   label: 'GitHub URL',   placeholder: 'https://github.com/Chami-02' },
              { name: 'linkedin', label: 'LinkedIn URL',  placeholder: 'https://linkedin.com/in/...' },
              { name: 'twitter',  label: 'Twitter URL',   placeholder: 'https://twitter.com/...' },
              { name: 'email',    label: 'Email Address', placeholder: 'your@email.com' },
            ].map(({ name, label, placeholder }) => (
              <div key={name}>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.7rem',
                  fontFamily: 'var(--font-mono)', marginBottom: '0.375rem', textTransform: 'uppercase' }}>{label}</label>
                <input name={name} placeholder={placeholder} value={form.social[name] || ''}
                  onChange={handleSocialChange} style={INPUT} {...FocusInput} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button type="submit" disabled={updateAbout.isPending} className="btn-primary"
            style={{ opacity: updateAbout.isPending ? 0.7 : 1 }}>
            {updateAbout.isPending ? 'Saving...' : 'Save Profile'}
          </button>
          {saved && (
            <span style={{ color: 'var(--green)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
              ✓ Saved successfully
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
