import { ChangeEvent, useRef, useState } from 'react';
import AppShell from '../components/layout/AppShell';
import MatchResults from '../components/match/MatchResults';
import ScanPrompt, { ScanProgress } from '../components/match/ScanPrompt';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { JobMatchResult, MAX_TEXT_CHARS, matchErrorMessage, runJobMatch } from '../api/match.api';
import { extractResumeText, ResumeParseError } from '../lib/resumeParser';
import { fetchRepos } from '../api/profile.api';
import { scanErrorStatus, scanRepoFrameworks } from '../api/frameworks.api';

const MIN_JD_CHARS = 20;
/** Per click; keeps one scan well inside GitHub's and our own rate limits. Click again for the rest. */
const MAX_SCANS_PER_RUN = 25;

function Counter({ value }: { value: string }) {
  const over = value.length > MAX_TEXT_CHARS;
  return (
    <span className={`text-[11px] font-mono ${over ? 'text-bad' : 'text-ink-faint'}`}>
      {value.length.toLocaleString()} / {MAX_TEXT_CHARS.toLocaleString()}
    </span>
  );
}

export default function JobMatch() {
  const [jd, setJd] = useState('');
  const [resume, setResume] = useState('');
  const [showResume, setShowResume] = useState(false);
  const [result, setResult] = useState<JobMatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [resumeNote, setResumeNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Framework scan state. `lastInput` is what was analyzed, so the match can be re-run after scanning.
  const [lastInput, setLastInput] = useState<{ jd: string; resume: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const stopScan = useRef(false);

  const jdTooShort = jd.trim().length < MIN_JD_CHARS;
  const tooLong = jd.length > MAX_TEXT_CHARS || resume.length > MAX_TEXT_CHARS;
  const canSubmit = !jdTooShort && !tooLong && !loading;

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const input = { jd, resume: showResume ? resume : '' };
      setResult(await runJobMatch(input.jd, input.resume));
      setLastInput(input);
      setScanMessage(null);
      setScanError(null);
    } catch (err) {
      setResult(null);
      setError(matchErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets the same file be chosen again after an error
    if (!file) return;
    setParsing(true);
    setResumeError(null);
    setResumeNote(null);
    try {
      const out = await extractResumeText(file, MAX_TEXT_CHARS);
      setResume(out.text);
      setResumeNote(
        `Read ${file.name}${out.pages ? ` (${out.pages} page${out.pages === 1 ? '' : 's'})` : ''} — ${out.text.length.toLocaleString()} characters` +
          (out.truncated ? `, shortened to the ${MAX_TEXT_CHARS.toLocaleString()}-character limit` : '') +
          '. Check the text below; you can edit it.'
      );
    } catch (err) {
      setResumeError(err instanceof ResumeParseError ? err.message : 'Could not read this file. Try pasting the text instead');
    } finally {
      setParsing(false);
    }
  }

  function closeResume() {
    setShowResume(false);
    setResume('');
    setResumeError(null);
    setResumeNote(null);
  }

  async function handleScan() {
    if (!lastInput) return;
    stopScan.current = false;
    setScanning(true);
    setScanError(null);
    setScanMessage(null);
    try {
      // Original work first — it is what the match cares about most — then forks, each group alphabetical.
      const pending = (await fetchRepos())
        .filter((r) => r.detected_frameworks === null)
        .sort((a, b) => Number(a.is_fork) - Number(b.is_fork) || a.name.localeCompare(b.name))
        .slice(0, MAX_SCANS_PER_RUN);

      let scanned = 0;
      let failed = 0;
      let rateLimited = false;
      setProgress({ done: 0, total: pending.length });
      for (const repo of pending) {
        if (stopScan.current) break;
        try {
          await scanRepoFrameworks(repo.id);
          scanned++;
        } catch (err) {
          failed++;
          if (scanErrorStatus(err) === 429) {
            rateLimited = true;
            break; // more requests would only be refused
          }
        }
        setProgress({ done: scanned + failed, total: pending.length });
      }

      // Refresh the match with whatever was learned, even after a stop or a rate limit.
      if (scanned > 0) setResult(await runJobMatch(lastInput.jd, lastInput.resume));

      if (rateLimited) setScanError('GitHub scanning limit reached — wait a few minutes and scan again.');
      else if (pending.length === 0) setScanMessage('Every repository has already been scanned.');
      else
        setScanMessage(
          `Scanned ${scanned} repositor${scanned === 1 ? 'y' : 'ies'}${failed > 0 ? ` (${failed} could not be read)` : ''}.` +
            (stopScan.current ? ' Stopped early.' : '')
        );
    } catch (err) {
      setScanError(matchErrorMessage(err));
    } finally {
      setScanning(false);
      setProgress(null);
    }
  }

  function handleClear() {
    setJd('');
    closeResume();
    setResult(null);
    setError(null);
    setLastInput(null);
    setScanMessage(null);
    setScanError(null);
  }

  const textareaClass =
    'w-full rounded-lg border border-hairline bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent resize-y';

  return (
    <AppShell profile={null} syncing={false} title="Job match">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Job match</h2>
          <p className="text-sm text-ink-muted mt-1">
            Paste a job description to see which of its skills your GitHub actually backs up.
          </p>
        </div>

        <Card>
          <CardHeader title="Job description" subtitle="Required and nice-to-have sections are detected automatically" />
          <CardBody className="space-y-4">
            <div>
              <label htmlFor="jd" className="sr-only">Job description</label>
              <textarea
                id="jd"
                rows={9}
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                placeholder={'Requirements\n- 2+ years of Python\n- Docker and CI/CD\n\nNice to have\n- Rust'}
                className={textareaClass}
              />
              <div className="flex justify-end mt-1">
                <Counter value={jd} />
              </div>
            </div>

            {showResume ? (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="resume" className="text-xs font-medium text-ink-muted">Resume text (optional)</label>
                  <button type="button" className="text-xs text-ink-faint hover:text-ink" onClick={closeResume}>
                    Remove
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    onChange={handleFile}
                    className="sr-only"
                    aria-label="Upload resume file"
                    tabIndex={-1}
                  />
                  <Button size="sm" onClick={() => fileInput.current?.click()} disabled={parsing}>
                    {parsing ? 'Reading file…' : 'Upload PDF or DOCX'}
                  </Button>
                  <span className="text-xs text-ink-faint">
                    The file is read in your browser — only the text below is sent for analysis. From Google Docs, use File → Download → PDF or .docx.
                  </span>
                </div>
                {resumeError && (
                  <p role="alert" className="text-sm text-bad mb-2">
                    {resumeError}
                  </p>
                )}
                {resumeNote && <p className="text-xs text-good mb-2">{resumeNote}</p>}
                <textarea
                  id="resume"
                  rows={6}
                  value={resume}
                  onChange={(e) => setResume(e.target.value)}
                  placeholder="Upload a file above, or paste your resume's skills / experience section here"
                  className={textareaClass}
                />
                <div className="flex justify-end mt-1">
                  <Counter value={resume} />
                </div>
              </div>
            ) : (
              <button type="button" className="text-sm text-accent hover:underline" onClick={() => setShowResume(true)}>
                + Also check my resume claims
              </button>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" onClick={handleSubmit} disabled={!canSubmit}>
                {loading ? 'Analyzing…' : 'Analyze match'}
              </Button>
              <Button variant="ghost" onClick={handleClear} disabled={loading || (!jd && !resume && !result)}>
                Clear
              </Button>
              <p className="text-xs text-ink-faint">Nothing you paste is stored. The comparison uses only your GitHub-derived skills.</p>
            </div>

            {error && (
              <p role="alert" className="text-sm text-bad">
                {error}
              </p>
            )}
          </CardBody>
        </Card>

        {result && <MatchResults result={result} />}

        {result && result.requirements.some((r) => r.frameworkVerifiable) && (result.coverage.scannedRepos < result.coverage.totalRepos || scanning || scanMessage) && (
          <ScanPrompt
            scannedRepos={result.coverage.scannedRepos}
            totalRepos={result.coverage.totalRepos}
            scanning={scanning}
            progress={progress}
            message={scanMessage}
            error={scanError}
            onScan={handleScan}
            onStop={() => {
              stopScan.current = true;
            }}
          />
        )}
      </div>
    </AppShell>
  );
}
