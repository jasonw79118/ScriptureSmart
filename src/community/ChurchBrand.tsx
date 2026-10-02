import { useMemo, useState } from 'react';
import type { ChurchIdentity, ChurchSource } from './models';

export function ChurchImage({
  church,
  source,
  className = '',
}: {
  church?: ChurchIdentity;
  source?: ChurchSource;
  className?: string;
}) {
  const sources = useMemo(() => {
    let favicon = '';
    try {
      if (church?.website_url) favicon = `${new URL(church.website_url).origin}/favicon.ico`;
    } catch {
      favicon = '';
    }
    const cachedFavicon = source?.items?.find((item) => item.sourceType === 'favicon')?.imageUrl;
    const openGraph = source?.items?.find((item) => item.sourceType === 'open-graph')?.imageUrl;
    return [
      source?.logoUrl,
      church?.image_url,
      cachedFavicon || favicon,
      openGraph,
      source?.imageUrl,
    ].filter((value): value is string => !!value);
  }, [church?.image_url, church?.website_url, source?.imageUrl, source?.items, source?.logoUrl]);
  const [index, setIndex] = useState(0);
  const src = sources[index];

  if (!src) {
    return (
      <span className={`church-image church-image-fallback ${className}`} aria-hidden="true">
        <svg viewBox="0 0 48 48" focusable="false">
          <path d="M7 40h34M11 40V21l13-10 13 10v19M19 40V28h10v12M22 20h4m-2-4v8" />
        </svg>
      </span>
    );
  }

  return (
    <img
      className={`church-image ${className}`}
      src={src}
      alt=""
      aria-hidden="true"
      referrerPolicy="no-referrer"
      onError={() => setIndex((current) => current + 1)}
    />
  );
}
