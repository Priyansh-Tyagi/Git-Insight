const STEPS = [
  { n: '1', title: 'Connect GitHub', body: 'Sign in with GitHub OAuth. Your repositories and languages are synced once, then cached.' },
  { n: '2', title: 'Analyze a repo', body: 'One click scores it against the rubric and runs the authenticity check. No AI is involved in the score.' },
  { n: '3', title: 'Read the evidence', body: 'See strengths, gaps and skill trends — and optionally an AI summary that is verified against the score.' },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="border-y border-hairline bg-surface/60">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-accent">How it works</p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight text-ink">From sign-in to insight in three steps</h2>
        </div>

        <ol className="mt-10 grid md:grid-cols-3 gap-6">
          {STEPS.map((s) => (
            <li key={s.n} className="relative rounded-xl border border-hairline bg-canvas p-5">
              <span className="grid place-items-center w-8 h-8 rounded-full bg-accent text-on-accent text-sm font-semibold font-mono">{s.n}</span>
              <h3 className="mt-4 font-semibold text-ink">{s.title}</h3>
              <p className="mt-1.5 text-sm text-ink-muted leading-relaxed">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
