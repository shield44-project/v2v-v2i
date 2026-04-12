import type { Metadata } from "next";
import { archivePages } from "./archive-data";
import { ArchiveIndex } from "./_components/ArchiveView";

export const metadata: Metadata = {
  title: "Archive | V2X Connect",
  description: "TypeScript archive of the legacy V2X HTML pages"
};

export default function ArchiveHome() {
  return <ArchiveIndex pages={archivePages} />;
}
