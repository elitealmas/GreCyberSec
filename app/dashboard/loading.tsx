import { PageLoader } from "@/components/page-loader";

export default function Loading() {
  return <PageLoader label="Loading your dashboard…" detail="Loading your learning progress." kind="cards" />;
}
