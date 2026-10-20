import { describe, it, expect, vi } from 'vitest';
import { zipSync, strToU8 } from 'fflate';

vi.mock('pdfjs-dist', () => ({ getDocument: vi.fn(), GlobalWorkerOptions: {} }));
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: '/fake-worker.js' }));

import * as pdfjs from 'pdfjs-dist';
import {
  detectResumeKind, docxXmlToText, extractResumeText, MAX_RESUME_FILE_BYTES, normalizeResumeText, pdfPagesToText, ResumeParseError,
} from '../lib/resumeParser';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const docXml = (body: string) => `<?xml version="1.0"?><w:document ${W}><w:body>${body}</w:body></w:document>`;
const para = (...runs: string[]) => `<w:p>${runs.map((r) => `<w:r>${r}</w:r>`).join('')}</w:p>`;
const t = (s: string) => `<w:t>${s}</w:t>`;

function makeDocx(xml: string, name = 'resume.docx'): File {
  const zipped = zipSync({ '[Content_Types].xml': strToU8('<Types/>'), 'word/document.xml': strToU8(xml) });
  return new File([zipped], name);
}
const pdfFile = (name = 'cv.pdf', body = '%PDF-1.7\nrest') => new File([body], name);

describe('detectResumeKind', () => {
  it('accepts a real-looking PDF, DOCX and TXT', async () => {
    expect((await detectResumeKind(pdfFile())).kind).toBe('pdf');
    expect((await detectResumeKind(makeDocx(docXml('')))).kind).toBe('docx');
    expect((await detectResumeKind(new File(['Python, Docker'], 'cv.txt'))).kind).toBe('text');
  });
  it('allows junk bytes before the PDF header', async () => {
    expect((await detectResumeKind(pdfFile('cv.pdf', '\n\n  garbage %PDF-1.4 ...'))).kind).toBe('pdf');
  });
  it('rejects empty, oversized, legacy .doc and unknown types with clear messages', async () => {
    await expect(detectResumeKind(new File([], 'a.pdf'))).rejects.toThrow(/empty/i);
    const big = { size: MAX_RESUME_FILE_BYTES + 1, name: 'big.pdf' } as File;
    await expect(detectResumeKind(big)).rejects.toThrow(/too large/i);
    await expect(detectResumeKind(new File(['x'], 'old.doc'))).rejects.toThrow(/\.doc files are not supported/i);
    await expect(detectResumeKind(new File(['x'], 'photo.png'))).rejects.toThrow(/unsupported file type/i);
  });
  it('does not trust the extension alone', async () => {
    await expect(detectResumeKind(new File(['<html>not a pdf</html>'], 'fake.pdf'))).rejects.toThrow(/real PDF/);
    await expect(detectResumeKind(new File(['plain text'], 'fake.docx'))).rejects.toThrow(/real \.docx/);
  });
  it('is case-insensitive about extensions', async () => {
    expect((await detectResumeKind(pdfFile('CV.PDF'))).kind).toBe('pdf');
  });
});

describe('normalizeResumeText', () => {
  it('normalises newlines, strips control characters and collapses blank runs', () => {
    const { text } = normalizeResumeText('a\r\nb\u0000\u0007  \n\n\n\n\nc\t\n', 1000);
    expect(text).toBe('a\nb\n\nc');
  });
  it('truncates and reports it', () => {
    expect(normalizeResumeText('x'.repeat(50), 20)).toEqual({ text: 'x'.repeat(20), truncated: true });
    expect(normalizeResumeText('short', 20).truncated).toBe(false);
  });
});

describe('pdfPagesToText', () => {
  it('breaks lines on hasEOL, spaces words otherwise, and separates pages', () => {
    const page1 = [{ str: 'Skills', hasEOL: true }, { str: 'Python' }, { str: 'Docker', hasEOL: true }];
    const page2 = [{ str: 'Projects', hasEOL: true }];
    expect(pdfPagesToText([page1, page2])).toBe('Skills\nPython Docker\n\n\nProjects\n');
  });
  it('ignores items without text', () => {
    expect(pdfPagesToText([[{ hasEOL: true }, { str: 'ok', hasEOL: true }]])).toBe('ok\n');
  });
});

describe('docxXmlToText', () => {
  it('extracts paragraphs, tabs and line breaks', () => {
    const xml = docXml(para(t('Skills')) + para(t('Python'), '<w:tab/>', t('Docker')) + para(t('a'), '<w:br/>', t('b')));
    expect(docxXmlToText(xml)).toBe('Skills\nPython\tDocker\na\nb');
  });
  it('reads text inside tables and nested elements', () => {
    const xml = docXml(`<w:tbl><w:tr><w:tc>${para(t('Java'))}</w:tc><w:tc>${para(t('Go'))}</w:tc></w:tr></w:tbl>`);
    expect(docxXmlToText(xml)).toBe('Java\nGo');
  });
  it('decodes XML entities and ignores non-Word elements', () => {
    const xml = docXml(para(t('C++ &amp; Rust'), '<w:instrText>HYPERLINK "x"</w:instrText>'));
    expect(docxXmlToText(xml)).toBe('C++ & Rust');
  });
  it('rejects malformed XML', () => {
    expect(() => docxXmlToText('<w:document')).toThrow(ResumeParseError);
  });
});

describe('extractResumeText', () => {
  it('reads a DOCX end to end', async () => {
    const out = await extractResumeText(makeDocx(docXml(para(t('Python')) + para(t('Docker')))), 20_000);
    expect(out).toMatchObject({ text: 'Python\nDocker', kind: 'docx', pages: null, truncated: false });
  });
  it('reads a plain-text file and truncates to the limit', async () => {
    const out = await extractResumeText(new File(['x'.repeat(100)], 'cv.txt'), 40);
    expect(out.text).toHaveLength(40);
    expect(out.truncated).toBe(true);
  });
  it('errors on a DOCX with no text, and on a DOCX missing document.xml', async () => {
    await expect(extractResumeText(makeDocx(docXml('')), 100)).rejects.toThrow(/no text found/i);
    const noDoc = new File([zipSync({ 'other.xml': strToU8('<a/>') })], 'x.docx');
    await expect(extractResumeText(noDoc, 100)).rejects.toThrow(/no document text/i);
  });
  it('refuses a DOCX whose document.xml would decompress to an absurd size (zip bomb)', async () => {
    const bomb = makeDocx(docXml(para(t('a'.repeat(21 * 1024 * 1024)))));
    expect(bomb.size).toBeLessThan(MAX_RESUME_FILE_BYTES); // small on disk...
    await expect(extractResumeText(bomb, 100)).rejects.toThrow(/no document text/i); // ...but never inflated
  });
  it('rejects a corrupted zip', async () => {
    const bad = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5])], 'bad.docx');
    await expect(extractResumeText(bad, 100)).rejects.toThrow(/damaged|not a valid/i);
  });

  describe('PDF', () => {
    const mockDoc = (pages: { str: string; hasEOL?: boolean }[][]) => ({
      numPages: pages.length,
      getPage: async (n: number) => ({ getTextContent: async () => ({ items: pages[n - 1] }) }),
      destroy: vi.fn(),
    });

    it('extracts text and page count, with eval disabled', async () => {
      vi.mocked(pdfjs.getDocument).mockReturnValue({ promise: Promise.resolve(mockDoc([[{ str: 'Python', hasEOL: true }], [{ str: 'Docker', hasEOL: true }]])) } as never);
      const out = await extractResumeText(pdfFile(), 20_000);
      expect(out).toMatchObject({ kind: 'pdf', pages: 2 });
      expect(out.text).toContain('Python');
      expect(out.text).toContain('Docker');
      const calls = vi.mocked(pdfjs.getDocument).mock.calls;
      expect(calls[calls.length - 1][0]).toMatchObject({ isEvalSupported: false });
    });
    it('tells the user a scanned PDF has no text layer', async () => {
      vi.mocked(pdfjs.getDocument).mockReturnValue({ promise: Promise.resolve(mockDoc([[{ str: '   ', hasEOL: true }]])) } as never);
      await expect(extractResumeText(pdfFile(), 100)).rejects.toThrow(/scanned/i);
    });
    it('maps a password-protected PDF to a friendly error', async () => {
      vi.mocked(pdfjs.getDocument).mockImplementation(
        () => ({ promise: Promise.reject(Object.assign(new Error('x'), { name: 'PasswordException' })) }) as never
      );
      await expect(extractResumeText(pdfFile(), 100)).rejects.toThrow(/password-protected/i);
    });
    it('maps any other parser failure to a generic read error', async () => {
      vi.mocked(pdfjs.getDocument).mockImplementation(() => ({ promise: Promise.reject(new Error('boom')) }) as never);
      await expect(extractResumeText(pdfFile(), 100)).rejects.toThrow(/could not read this pdf/i);
    });
  });
});
