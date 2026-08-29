import { PageLoader } from "@/components/page-loader";

export default function Loading() {
  return <PageLoader label="Preparing lesson…" detail="Loading lesson content and progress." kind="lesson" />;
}
