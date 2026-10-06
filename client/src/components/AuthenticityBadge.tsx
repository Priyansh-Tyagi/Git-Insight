interface AuthenticityBadgeProps {
  flag: 'likely_original' | 'possible_tutorial_clone' | 'insufficient_data' | null;
}

export default function AuthenticityBadge({ flag }: AuthenticityBadgeProps) {
  if (!flag || flag === 'likely_original') return null; // only show when there's something worth flagging

  if (flag === 'possible_tutorial_clone') {
    return (
      <span
        className="text-[11px] px-2 py-0.5 rounded-full bg-warn/10 text-warn border border-warn/30"
        title="Structurally similar to a common tutorial/starter template"
      >
        possible template match
      </span>
    );
  }

  return (
    <span
      className="text-[11px] px-2 py-0.5 rounded-full bg-surface-raised text-ink-faint border border-hairline"
      title="Not enough commit/file history to judge"
    >
      insufficient data
    </span>
  );
}
