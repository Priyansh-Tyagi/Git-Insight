import { githubLoginUrl } from '../api/auth.api';

export default function Login() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center font-mono text-green-400">
      <div className="border border-green-500 rounded-md p-8 w-full max-w-sm bg-zinc-950 shadow-[0_0_20px_rgba(34,197,94,0.15)]">
        <p className="text-sm opacity-70 mb-1">$ whoami</p>
        <h1 className="text-2xl mb-6">GitInsight_AI</h1>
        <p className="text-sm opacity-70 mb-6">
          &gt; developer intelligence, derived from real commit history.
        </p>
        <a
          href={githubLoginUrl()}
          className="block text-center border border-green-500 rounded px-4 py-2 hover:bg-green-500 hover:text-black transition-colors"
        >
          Connect GitHub account
        </a>
      </div>
    </div>
  );
}
