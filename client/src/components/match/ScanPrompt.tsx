import { Card, CardBody, CardHeader } from '../ui/Card';
import Button from '../ui/Button';
import { FolderIcon } from '../ui/icons';

export interface ScanProgress {
  done: number;
  total: number;
}

interface ScanPromptProps {
  scannedRepos: number;
  totalRepos: number;
  scanning: boolean;
  progress: ScanProgress | null;
  message: string | null;
  error: string | null;
  onScan: () => void;
  onStop: () => void;
}

/** Offers to read repositories' dependency files so framework skills (React, Express, MongoDB...) can be checked. */
export default function ScanPrompt({ scannedRepos, totalRepos, scanning, progress, message, error, onScan, onStop }: ScanPromptProps) {
  const remaining = totalRepos - scannedRepos;

  return (
    <Card>
      <CardHeader
        title="Check frameworks from your repositories"
        subtitle={`${scannedRepos} of ${totalRepos} repositories scanned`}
        icon={<FolderIcon className="w-4 h-4" />}
      />
      <CardBody className="space-y-3">
        <p className="text-sm text-ink-muted">
          GitInsight reads each repository&apos;s dependency files (package.json, requirements.txt, pom.xml and similar) to see which
          frameworks you have actually used. Only file names and those few small files are read — no source code is stored.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {scanning ? (
            <>
              <span role="status" className="text-sm text-ink">
                Scanning {progress ? `${Math.min(progress.done + 1, progress.total)} of ${progress.total}` : ''}…
              </span>
              <Button size="sm" variant="ghost" onClick={onStop}>
                Stop
              </Button>
            </>
          ) : (
            <Button variant="primary" size="sm" onClick={onScan} disabled={remaining <= 0}>
              {remaining > 0 ? `Scan ${remaining} repositor${remaining === 1 ? 'y' : 'ies'}` : 'All repositories scanned'}
            </Button>
          )}
        </div>
        {message && <p className="text-xs text-good">{message}</p>}
        {error && (
          <p role="alert" className="text-sm text-bad">
            {error}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
