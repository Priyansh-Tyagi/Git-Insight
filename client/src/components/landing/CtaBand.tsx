import CtaButton from './CtaButton';

export default function CtaBand() {
  return (
    <section className="px-6 pb-20">
      <div className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl border border-hairline bg-surface shadow-card text-center px-6 py-14">
        <div className="absolute inset-0 bg-glow pointer-events-none" aria-hidden="true" />
        <h2 className="relative text-3xl sm:text-4xl font-semibold tracking-tight text-ink">See what your code says about you</h2>
        <p className="relative mt-3 text-ink-muted">It takes one GitHub sign-in and about a minute.</p>
        <div className="relative mt-7 flex justify-center">
          <CtaButton />
        </div>
      </div>
    </section>
  );
}
