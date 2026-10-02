interface AuthenticityBadgeProps {
  flag: 'likely_original' | 'possible_tutorial_clone' | 'insufficient_data' | null;
}

export default function AuthenticityBadge({ flag }: AuthenticityBadgeProps) {
  if (!flag || flag === 'likely_original') return null; // only show when there's something worth flagging

  if (flag === 'possible_tutorial_clone') {
    return (
      <span className="text-xs px-2 py-1 border border-yellow-600 text-yellow-500 rounded" title="Structurally similar to a common tutorial/starter template">
        possible template match
      </span>
    );
  }

  return (
    <span className="text-xs px-2 py-1 border border-zinc-700 text-zinc-500 rounded" title="Not enough commit/file history to judge">
      insufficient data
    </span>
  );
}
