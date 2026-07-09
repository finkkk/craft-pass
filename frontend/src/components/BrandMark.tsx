import { useEffect, useState } from 'react';

export function BrandMark({
  className = 'brand-mark',
  logoUrl = '/api/site-logo',
}: {
  className?: string;
  logoUrl?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [logoUrl]);

  return (
    <span className={className} aria-hidden="true">
      {failed ? (
        'CP'
      ) : (
        <img
          src={logoUrl}
          alt=""
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
