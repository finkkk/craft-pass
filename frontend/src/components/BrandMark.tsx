import { useEffect, useState } from 'react';

export function BrandMark({
  className = 'brand-mark',
  logoUrl = '/api/site-logo',
}: {
  className?: string;
  logoUrl?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [logoUrl]);

  return (
    <span
      className={`${className}${loaded && !failed ? ' has-logo-image' : ''}`}
      aria-hidden="true"
    >
      {failed ? (
        'CP'
      ) : (
        <img
          src={logoUrl}
          alt=""
          onLoad={() => setLoaded(true)}
          onError={() => {
            setFailed(true);
            setLoaded(false);
          }}
        />
      )}
    </span>
  );
}
