import { getImageProps } from "next/image";
import { preload } from "react-dom";

import original from "@/public/assets/document-cleaning-comparison.png";
import comparison384 from "@/public/assets/comparison/document-cleaning-384.avif";
import comparison576 from "@/public/assets/comparison/document-cleaning-576.avif";
import comparison660 from "@/public/assets/comparison/document-cleaning-660.avif";
import comparison768 from "@/public/assets/comparison/document-cleaning-768.avif";
import comparison1024 from "@/public/assets/comparison/document-cleaning-1024.avif";
import comparison1320 from "@/public/assets/comparison/document-cleaning-1320.avif";
import comparison1600 from "@/public/assets/comparison/document-cleaning-1600.avif";

const sizes = "(max-width: 600px) calc(100vw - 60px), (max-width: 880px) calc(96vw - 84px), (max-width: 1120px) calc(53vw - 64px), clamp(580px, calc(53.5vw - 64px), 765px)";

// Renditions are generated from the original PNG with Sharp AVIF quality 52.
const avifSrcSet = [
  [comparison384.src, 384],
  [comparison576.src, 576],
  [comparison660.src, 660],
  [comparison768.src, 768],
  [comparison1024.src, 1024],
  [comparison1320.src, 1320],
  [comparison1600.src, 1600],
].map(([src, width]) => `${src} ${width}w`).join(", ");

export function LandingComparison() {
  const { props: { alt, ...imageProps } } = getImageProps({
    className: "comparison-image",
    src: original,
    alt: "The same fictional invoice shown as a stained phone photo and a clean verified scan",
    loading: "eager",
    fetchPriority: "high",
    sizes,
  });
  preload(comparison660.src, {
    as: "image",
    type: "image/avif",
    fetchPriority: "high",
    imageSrcSet: avifSrcSet,
    imageSizes: sizes,
  });
  return (
    <picture className="comparison-picture">
      <source type="image/avif" srcSet={avifSrcSet} sizes={sizes} />
      <img {...imageProps} alt={alt} />
    </picture>
  );
}
