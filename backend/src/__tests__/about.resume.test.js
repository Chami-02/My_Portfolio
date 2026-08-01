const About = require('../models/About');

describe('About — resume slot (PF-60 Step 2)', () => {

  const FILLED = {
    url:        'https://res.cloudinary.com/x/raw/upload/v1/portfolio/documents/cv.pdf',
    publicId:   'portfolio/documents/cv',
    fileName:   'Parindra_CV.pdf',
    ext:        'PDF',
    bytes:      108544,
    uploadedAt: new Date(),
  };

  it('defaults to an empty slot', () => {
    const a = new About({});

    expect(a.resume.url).toBe('');
    expect(a.resume.publicId).toBe('');
    expect(a.resume.fileName).toBe('');
    expect(a.resume.ext).toBe('');
    expect(a.resume.bytes).toBe(0);
    expect(a.resume.uploadedAt).toBeNull();
  });

  it('an empty slot is valid — a missing résumé is not an error', () => {
    expect(new About({}).validateSync()).toBeUndefined();
  });

  it('stores every field the admin card renders', () => {
    const a = new About({ resume: FILLED });

    expect(a.validateSync()).toBeUndefined();
    expect(a.resume.url).toBe(FILLED.url);
    expect(a.resume.publicId).toBe(FILLED.publicId);
    expect(a.resume.fileName).toBe('Parindra_CV.pdf');
    expect(a.resume.ext).toBe('PDF');
    expect(a.resume.bytes).toBe(108544);
    expect(a.resume.uploadedAt).toBeInstanceOf(Date);
  });

  it('keeps publicId — without it the old file can never be deleted', () => {
    const a = new About({ resume: FILLED });

    expect(a.resume.publicId).toBeTruthy();
  });

  it('rejects a data: URI in the résumé url', () => {
    const a = new About({ resume: { url: 'data:application/pdf;base64,AAAA' } });

    expect(a.validateSync().errors['resume.url']).toBeDefined();
  });

  it('coerces a numeric-string byte count', () => {
    const a = new About({ resume: { ...FILLED, bytes: '108544' } });

    expect(a.resume.bytes).toBe(108544);
  });

  it('no longer has the old flat resumeUrl field', () => {
    const a = new About({ resumeUrl: 'https://example.com/old.pdf' });

    expect(a.resumeUrl).toBeUndefined();
  });

  describe('hasResume virtual (Step 3)', () => {

    it('is false on an empty slot', () => {
      expect(new About({}).hasResume).toBe(false);
    });

    it('is true once a url is set', () => {
      expect(new About({ resume: FILLED }).hasResume).toBe(true);
    });

    it('keys off url alone — metadata without a url is still MISSING', () => {
      const a = new About({
        resume: { publicId: 'portfolio/documents/orphan', fileName: 'cv.pdf', bytes: 999 },
      });

      expect(a.hasResume).toBe(false);
    });

    it('reaches the client — virtuals are enabled in toJSON', () => {
      const json = new About({ resume: FILLED }).toJSON();

      expect(json).toHaveProperty('hasResume');
      expect(json.hasResume).toBe(true);
    });

    it('is present and false in JSON when no résumé exists', () => {
      expect(new About({}).toJSON().hasResume).toBe(false);
    });

    it('is not writable — it is derived, never stored', () => {
      const a = new About({ hasResume: true });

      expect(a.hasResume).toBe(false);
      expect(a.toObject().resume.url).toBe('');
    });

  });

});
