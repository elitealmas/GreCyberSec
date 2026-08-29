import { PageLoader } from "@/components/page-loader";

export default function Loading() {
  return <PageLoader label="Loading your course…" detail="Preparing modules and progress." kind="lesson" />;
}
