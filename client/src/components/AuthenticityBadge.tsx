import Badge from './ui/Badge';

interface AuthenticityBadgeProps {
  flag: 'likely_original' | 'possible_tutorial_clone' | 'insufficient_data' | null;
}

export default function AuthenticityBadge({ flag }: AuthenticityBadgeProps) {
  if (!flag || flag === 'likely_original') return null; // only show when there's something worth flagging

  if (flag === 'possible_tutorial_clone') {
    return (
      <Badge tone="warn" title="Structurally similar to a common tutorial/starter template">
        possible template match
      </Badge>
    );
  }

  return (
    <Badge tone="neutral" title="Not enough commit/file history to judge">
      insufficient data
    </Badge>
  );
}
