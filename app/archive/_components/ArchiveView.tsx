import Link from "next/link";
import styles from "../archive.module.css";
import type { ArchivePage } from "../archive-data";

type ArchiveViewProps = {
  page: ArchivePage;
};

function ToneClass(tone: ArchivePage["stats"][number]["tone"]) {
  return styles[tone];
}

export function ArchiveIndex({ pages }: { pages: ArchivePage[] }) {
  return (
    <main className={styles.shell}>
      <div className={styles.inner}>
        <header className={styles.topbar}>
          <div className={styles.brand}>
            <div className={styles.mark}>A</div>
            <div>
              <p className={styles.eyebrow}>Archive Route Book</p>
              <h1>V2X legacy HTML, rebuilt in TypeScript</h1>
              <p>
                The old snapshots are now represented as structured Next.js pages with a shared
                archive theme, so the history is easier to read and maintain.
              </p>
            </div>
          </div>
          <div className={styles.badge}>Next.js TSX archive</div>
        </header>

        <section className={styles.hero}>
          <div className={styles.heroCard}>
            <p className={styles.eyebrow}>What changed</p>
            <h2>Every archived page now has a typed route and shared styling.</h2>
            <p>
              The original HTML snapshots were noisy, duplicated, and hard to reason about. This
              archive layer turns them into data-driven TSX pages with one styling system and one
              content model.
            </p>
            <div className={styles.sourceList}>
              <div className={styles.sourceChip}>
                <span>10</span> archive routes
              </div>
              <div className={styles.sourceChip}>
                <span>2</span> legacy source sets
              </div>
              <div className={styles.sourceChip}>
                <span>TSX</span> shared shell
              </div>
            </div>
          </div>

          <aside className={styles.panel}>
            <h3>Archive rules</h3>
            <div className={styles.stats}>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Routing</span>
                <div className={`${styles.statValue} ${styles.cyan}`}>Next</div>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Source</span>
                <div className={`${styles.statValue} ${styles.blue}`}>Legacy HTML</div>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Theme</span>
                <div className={`${styles.statValue} ${styles.amber}`}>Archive glass</div>
              </div>
            </div>
          </aside>
        </section>

        <section className={styles.grid}>
          {pages.map((page) => (
            <article key={page.slug} className={styles.routeCard}>
              <p className={styles.eyebrow}>{page.badge}</p>
              <h3>{page.title}</h3>
              <p>{page.subtitle}</p>
              <div className={styles.routeMeta}>
                <span>
                  <strong>{page.slug}</strong>
                </span>
                <Link className={styles.routeLink} href={`/archive/${page.slug}`}>
                  Open snapshot →
                </Link>
              </div>
            </article>
          ))}
        </section>

        <div className={styles.footer}>
          Archived HTML has been converted into TypeScript pages. Source snapshots are preserved as
          reference only.
        </div>
      </div>
    </main>
  );
}

export function ArchiveDetail({ page }: ArchiveViewProps) {
  return (
    <main className={styles.shell}>
      <div className={styles.inner}>
        <header className={styles.topbar}>
          <div className={styles.brand}>
            <div className={styles.mark}>A</div>
            <div>
              <p className={styles.eyebrow}>{page.badge}</p>
              <h1>{page.title}</h1>
              <p>{page.subtitle}</p>
            </div>
          </div>
          <div className={styles.badge}>TypeScript archive</div>
        </header>

        <section className={styles.hero}>
          <div className={styles.heroCard}>
            <p className={styles.eyebrow}>Snapshot summary</p>
            <h2>{page.summary}</h2>
            <p>
              This route preserves the old page structure as a typed archive entry. The content is
              cleaner, the CSS is shared, and the page no longer reads like a live production UI.
            </p>
            <div className={styles.ctaWrap}>
              <Link className={styles.cta} href={page.ctaHref}>
                {page.ctaLabel}
              </Link>
              <Link className={styles.cta} href="/archive">
                Back to archive
              </Link>
            </div>
          </div>

          <aside className={styles.panel}>
            <h3>Snapshot stats</h3>
            <div className={styles.stats}>
              {page.stats.map((stat) => (
                <div key={stat.label} className={styles.stat}>
                  <span className={styles.statLabel}>{stat.label}</span>
                  <div className={`${styles.statValue} ${ToneClass(stat.tone)}`}>{stat.value}</div>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section className={styles.content}>
          <div className={styles.sections}>
            {page.sections.map((section) => (
              <article key={section.heading} className={`${styles.panel} ${styles.section}`}>
                <h3>{section.heading}</h3>
                <p>{section.body}</p>
              </article>
            ))}
          </div>

          <aside className={`${styles.panel} ${styles.sourcePanel}`}>
            <h3>Source snapshots</h3>
            <p>
              The original HTML snapshots are preserved in two archive folders. The Next route is
              now the readable TypeScript version.
            </p>
            <ul>
              {page.sourcePaths.map((sourcePath) => (
                <li key={sourcePath}>{sourcePath}</li>
              ))}
            </ul>
          </aside>
        </section>

        <div className={styles.footer}>
          All archive pages now share one TypeScript shell and one visual system.
        </div>
      </div>
    </main>
  );
}
