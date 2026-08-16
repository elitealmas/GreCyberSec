import Image from "next/image";

export function BrandMark() {
  return <span aria-hidden="true" className="brand-mark"><Image src="/images/grecybersec-logo.jpg" alt="" width={64} height={64} sizes="50px" /></span>;
}
