export default function AppFooter() {
  const year = 2026;
  const githubUrl = "https://github.com/shield44-project/v2v-v2i";
  const docsUrl = `${githubUrl}#readme`;
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();

  return (
    <footer className="mt-12 border-t border-zinc-800/80 bg-black/40 px-6 py-6 text-xs text-zinc-400">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3">
        <p>© {year} Shield44 Project · V2X Connect High-End Demo</p>
        <div className="flex flex-wrap items-center gap-3">
          <a className="text-cyan-300 hover:text-cyan-200" href={githubUrl} target="_blank" rel="noreferrer">
            GitHub
          </a>
          {supportEmail && (
            <a className="text-cyan-300 hover:text-cyan-200" href={`mailto:${supportEmail}`}>
              Email
            </a>
          )}
          <a className="text-cyan-300 hover:text-cyan-200" href={docsUrl} target="_blank" rel="noreferrer">
            Documentation
          </a>
        </div>
      </div>
    </footer>
  );
}
