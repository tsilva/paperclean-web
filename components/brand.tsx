import Image from "next/image";
import Link from "next/link";

import brandMark from "@/public/brand/paperclean-mark.png";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="PaperClean home">
      <Image
        className="brand-mark"
        src={brandMark}
        alt=""
        width={compact ? 38 : 44}
        height={compact ? 38 : 44}
        priority
      />
      <span className="brand-name">
        Paper<span>Clean</span>
      </span>
    </Link>
  );
}
