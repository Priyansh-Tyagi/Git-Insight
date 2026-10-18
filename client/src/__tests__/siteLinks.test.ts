import { describe, it, expect } from 'vitest';
import { configuredLinks, linkFor } from '../config/siteLinks';

describe('configuredLinks', () => {
  it('omits empty values', () => {
    expect(configuredLinks({ github: '', paper: '', linkedin: '', email: '' })).toEqual([]);
  });
  it('keeps valid https links as external and trims whitespace', () => {
    const out = configuredLinks({ github: '  https://github.com/me ', paper: '', linkedin: '', email: '' });
    expect(out).toEqual([{ label: 'GitHub', href: 'https://github.com/me', external: true }]);
  });
  it('turns an email into a mailto link and rejects a malformed one', () => {
    expect(configuredLinks({ email: 'a@b.co' })[0].href).toBe('mailto:a@b.co');
    expect(configuredLinks({ email: 'not-an-email' })).toEqual([]);
  });
  it('rejects javascript:, data: and protocol-less URLs', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,<script>', 'github.com/me', '//evil.com']) {
      expect(configuredLinks({ github: bad, paper: bad, linkedin: bad })).toEqual([]);
    }
  });
  it('linkFor finds a configured link by key', () => {
    expect(linkFor('paper', { paper: 'https://x.org/p.pdf' })?.label).toBe('Research paper');
    expect(linkFor('paper', {})).toBeUndefined();
  });
});
