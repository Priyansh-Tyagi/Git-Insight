import { unzipSync } from 'fflate';

/**
 * Resume text extraction — runs entirely in the browser. The file itself is never uploaded: only the extracted,
 * user-reviewable text is sent to the API when the user clicks "Analyze match".
 *
 * Supported: PDF (text layer), DOCX, and plain text. Scanned/image-only PDFs have no text layer and are reported as such.
 */

export const MAX_RESUME_FILE_BYTES = 5 * 1024 * 1024;
const MAX_PDF_PAGES = 30;
const MAX_DOCX_XML_BYTES = 20 * 1024 * 1024; // decompressed size cap — guards against zip bombs
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

export type ResumeKind = 'pdf' | 'docx' | 'text';

export class ResumeParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResumeParseError';
  }
}

export interface ExtractedResume {
  text: string;
  kind: ResumeKind;
  /** Page count for PDFs, otherwise null. */
  pages: number | null;
}

function readBytes(file: Blob): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer().then((b) => new Uint8Array(b));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(new ResumeParseError('Could not read the file'));
    reader.readAsArrayBuffer(file);
  });
}

/** Checks name, size and magic bytes (extension alone is not trusted). Returns the detected kind. */
export async function detectResumeKind(file: File): Promise<{ kind: ResumeKind; bytes: Uint8Array }> {
  if (file.size === 0) throw new ResumeParseError('The file is empty');
  if (file.size > MAX_RESUME_FILE_BYTES) throw new ResumeParseError('The file is too large (maximum 5 MB)');

  const name = file.name.toLowerCase();
  if (name.endsWith('.doc')) throw new ResumeParseError('Old .doc files are not supported — save the resume as .docx or PDF and try again');

  const bytes = await readBytes(file);

  if (name.endsWith('.pdf')) {
    // PDFs may carry a few junk bytes before the header, so look in the first KB rather than at byte 0.
    if (!new TextDecoder('latin1').decode(bytes.subarray(0, 1024)).includes('%PDF-')) {
      throw new ResumeParseError("This file doesn't look like a real PDF");
    }
    return { kind: 'pdf', bytes };
  }
  if (name.endsWith('.docx')) {
    if (!(bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04)) {
      throw new ResumeParseError("This file doesn't look like a real .docx document");
    }
    return { kind: 'docx', bytes };
  }
  if (name.endsWith('.txt') || name.endsWith('.md')) return { kind: 'text', bytes };

  throw new ResumeParseError('Unsupported file type — upload a PDF, .docx or .txt file');
}

/** Tidies extracted text: normalises newlines, strips control characters, collapses runs of blank lines. */
export function normalizeResumeText(raw: string, maxChars: number): { text: string; truncated: boolean } {
  let text = raw
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const truncated = text.length > maxChars;
  if (truncated) text = text.slice(0, maxChars);
  return { text, truncated };
}

// ---------- PDF ----------

export interface PdfTextItem {
  str?: string;
  hasEOL?: boolean;
}

/** Joins pdf.js text items into lines (pdf.js marks line ends with hasEOL). Pure, so it is unit-testable. */
export function pdfPagesToText(pages: PdfTextItem[][]): string {
  return pages
    .map((items) => {
      let out = '';
      for (const item of items) {
        if (typeof item.str !== 'string') continue;
        out += item.str;
        if (item.hasEOL) out += '\n';
        else if (item.str && !out.endsWith(' ')) out += ' ';
      }
      return out;
    })
    .join('\n\n');
}

async function extractPdf(bytes: Uint8Array): Promise<{ text: string; pages: number }> {
  // Loaded on demand so the PDF engine isn't part of the initial bundle.
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  let doc;
  try {
    // isEvalSupported:false keeps pdf.js from compiling font programs with eval (the class of bug behind CVE-2024-4367).
    doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
  } catch (err) {
    if ((err as { name?: string })?.name === 'PasswordException') throw new ResumeParseError('This PDF is password-protected — remove the password and try again');
    throw new ResumeParseError('Could not read this PDF. It may be corrupted');
  }

  try {
    const pageCount = Math.min(doc.numPages, MAX_PDF_PAGES);
    const pages: PdfTextItem[][] = [];
    for (let i = 1; i <= pageCount; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items as PdfTextItem[]);
    }
    return { text: pdfPagesToText(pages), pages: doc.numPages };
  } finally {
    void doc.destroy();
  }
}

// ---------- DOCX ----------

/** Pulls paragraph text out of word/document.xml. Pure given the XML string. */
export function docxXmlToText(xml: string): string {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) throw new ResumeParseError('This .docx file is damaged');

  const lines: string[] = [];
  for (const p of Array.from(doc.getElementsByTagNameNS(W_NS, 'p'))) {
    let line = '';
    const walk = (node: Node) => {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType !== 1) continue;
        const el = child as Element;
        if (el.namespaceURI !== W_NS) {
          walk(el);
          continue;
        }
        if (el.localName === 't') line += el.textContent ?? '';
        else if (el.localName === 'tab') line += '\t';
        else if (el.localName === 'br' || el.localName === 'cr') line += '\n';
        else walk(el);
      }
    };
    walk(p);
    lines.push(line);
  }
  return lines.join('\n');
}

function extractDocx(bytes: Uint8Array): string {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      // Only inflate the one part we need, and refuse it if it would expand absurdly (zip-bomb guard).
      filter: (f) => f.name === 'word/document.xml' && f.originalSize <= MAX_DOCX_XML_BYTES,
    });
  } catch {
    throw new ResumeParseError('This .docx file is damaged or not a valid document');
  }
  const xml = files['word/document.xml'];
  if (!xml) throw new ResumeParseError('No document text found in this .docx file');
  return docxXmlToText(new TextDecoder('utf-8').decode(xml));
}

// ---------- entry point ----------

export async function extractResumeText(file: File, maxChars: number): Promise<ExtractedResume & { truncated: boolean }> {
  const { kind, bytes } = await detectResumeKind(file);

  let raw: string;
  let pages: number | null = null;
  if (kind === 'pdf') {
    const r = await extractPdf(bytes);
    raw = r.text;
    pages = r.pages;
  } else if (kind === 'docx') {
    raw = extractDocx(bytes);
  } else {
    raw = new TextDecoder('utf-8').decode(bytes);
  }

  const { text, truncated } = normalizeResumeText(raw, maxChars);
  if (!text) {
    throw new ResumeParseError(
      kind === 'pdf'
        ? 'No text found — this looks like a scanned/image PDF. Paste the text instead'
        : 'No text found in this file'
    );
  }
  return { text, kind, pages, truncated };
}
