import { ReplayImporter } from "@/components/replay-importer";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f7f7f6] text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-12 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold">DevReplay</p>
            <span
              className="h-4 border-l border-neutral-300"
              aria-hidden="true"
            />
            <p className="text-xs text-neutral-500">Session viewer</p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div>
          <h1 className="text-lg font-semibold">Session</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Import a replay to inspect its prompts, commands, edits, and tests.
          </p>
        </div>

        <ReplayImporter />
      </main>
    </div>
  );
}
