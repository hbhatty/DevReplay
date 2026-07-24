export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8 sm:px-10 sm:py-10">
      <header className="flex items-center justify-between border-b border-black/10 pb-5">
        <p className="text-lg font-semibold tracking-tight">DevReplay</p>
        <p className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-neutral-600">
          Local-first
        </p>
      </header>

      <section className="flex flex-1 flex-col justify-center py-20 sm:py-28">
        <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-[#5b4ee8]">
          Development history, made navigable
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.04em] text-neutral-950 sm:text-6xl">
          Turn coding sessions into evidence-backed workflows.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-600">
          DevReplay will let you import an AI-assisted coding session, explore
          what happened on a timeline, and trace every workflow insight back to
          its source evidence.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled
            className="rounded-lg bg-neutral-950 px-5 py-3 text-sm font-semibold text-white opacity-45"
          >
            Import session · Coming next
          </button>
          <button
            type="button"
            disabled
            className="rounded-lg border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-neutral-500"
          >
            Try sample session
          </button>
        </div>
      </section>

      <footer className="border-t border-black/10 pt-5 text-sm text-neutral-500">
        Foundation ready. Session importing and timeline exploration come next.
      </footer>
    </main>
  );
}
