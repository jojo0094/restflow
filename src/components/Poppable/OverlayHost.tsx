import React, { useEffect, useRef } from 'react';

export default function OverlayHost({ children }: { children?: React.ReactNode }) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let host = document.getElementById('app-overlay');
    if (!host) {
      host = document.createElement('div');
      host.id = 'app-overlay';
      Object.assign(host.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '9999' });
      document.body.appendChild(host);
    }
    hostRef.current = host as HTMLDivElement;
    return () => {
      // don't remove host on unmount - keep it
    };
  }, []);

  if (!hostRef.current) return null;

  return <>{children}</>;
}
