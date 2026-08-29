import { PageLoader } from "@/components/page-loader";

export default function Loading() {
  return <PageLoader label="Loading assessment…" detail="Preparing your questions." kind="quiz" />;
}
