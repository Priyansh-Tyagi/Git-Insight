import { useAuth } from '../../context/AuthContext';
import { githubLoginUrl } from '../../api/auth.api';
import Button, { ButtonSize } from '../ui/Button';
import { ArrowRightIcon, GithubIcon } from '../ui/icons';

/** Auth-aware primary call to action: signed-in visitors go to the dashboard, everyone else to GitHub OAuth. */
export default function CtaButton({ size = 'lg', className = '' }: { size?: ButtonSize; className?: string }) {
  const { user, loading } = useAuth();

  if (!loading && user) {
    return (
      <Button variant="primary" size={size} to="/dashboard" className={className} icon={<ArrowRightIcon className="w-4 h-4 order-last" />}>
        Go to dashboard
      </Button>
    );
  }
  return (
    <Button variant="primary" size={size} href={githubLoginUrl()} className={className} icon={<GithubIcon className="w-4 h-4" />}>
      Continue with GitHub
    </Button>
  );
}
