import { useEffect, useState } from 'react';
import * as QRCode from 'qrcode';
import { Loader2 } from 'lucide-react';

type QrCodeImageProps = {
  value: string;
  alt?: string;
  className?: string;
};

function isImageDataUrl(value: string) {
  return value.startsWith('data:image/');
}

function isLikelyImageBase64(value: string) {
  return /^(iVBOR|\/9j\/|R0lGOD|UklGR)/.test(value.trim());
}

function directImageSrc(value: string) {
  const trimmed = value.trim();
  if (isImageDataUrl(trimmed)) return trimmed;
  if (isLikelyImageBase64(trimmed)) return `data:image/png;base64,${trimmed}`;
  return null;
}

export function QrCodeImage({ value, alt = 'QR Code', className }: QrCodeImageProps) {
  const [src, setSrc] = useState<string | null>(() => directImageSrc(value));
  const [loading, setLoading] = useState(!directImageSrc(value));

  useEffect(() => {
    const direct = directImageSrc(value);
    if (direct) {
      setSrc(direct);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    QRCode.toDataURL(value.trim(), { errorCorrectionLevel: 'M', margin: 1, width: 288 })
      .then((generated) => {
        if (!cancelled) setSrc(generated);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [value]);

  if (loading || !src) {
    return <Loader2 className="h-8 w-8 animate-spin text-primary" />;
  }

  return <img src={src} alt={alt} className={className} />;
}