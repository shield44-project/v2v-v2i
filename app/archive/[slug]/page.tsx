import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { archivePages, getArchivePage } from "../archive-data";
import { ArchiveDetail } from "../_components/ArchiveView";

type PageParams = {
  slug: string;
};

export function generateStaticParams() {
  return archivePages.map((page) => ({ slug: page.slug }));
}

export function generateMetadata({ params }: { params: PageParams }): Metadata {
  const page = getArchivePage(params.slug);

  if (!page) {
    return {
      title: "Archive | V2X Connect"
    };
  }

  return {
    title: `${page.title} | Archive | V2X Connect`,
    description: page.subtitle
  };
}

export default function ArchivePage({ params }: { params: PageParams }) {
  const page = getArchivePage(params.slug);

  if (!page) {
    notFound();
  }

  return <ArchiveDetail page={page} />;
}
