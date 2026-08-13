import { useState, useEffect } from 'react';
import { QrCode, Download, X } from 'lucide-react';
import { buildRestaurantUrl } from '@/lib/getSubdomain';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QRCodeSVG } from 'qrcode.react';

interface TableQRCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableNumber: number;
  slug: string;
}

export function TableQRCodeModal({ open, onOpenChange, tableNumber, slug }: TableQRCodeModalProps) {
  const [qrUrl, setQrUrl] = useState('');

  useEffect(() => {
    if (open) {
      // Constructing public URL linking table to menu using helper for cross-environment consistency
      const baseUrl = buildRestaurantUrl(slug);
      const url = `${baseUrl}?table=${tableNumber}`;
      setQrUrl(url);
    }
  }, [open, tableNumber, slug]);

  const downloadQR = () => {
    const svg = document.getElementById('table-qrcode');
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        const pngFile = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.download = `mesa-${tableNumber}-qrcode.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader>
          <DialogTitle>QR Code - Mesa {tableNumber}</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center gap-6 py-6">
          <div className="p-4 bg-white rounded-2xl shadow-sm border">
            <QRCodeSVG
              id="table-qrcode"
              value={qrUrl}
              size={200}
              level="H"
              includeMargin={true}
            />
          </div>
          
          <div className="space-y-2 w-full">
            <p className="text-sm text-muted-foreground">
              O cliente acessará o cardápio vinculado a esta mesa
            </p>
            <Button onClick={downloadQR} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Baixar QR Code
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
