import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Printer, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSlug, useBasePath } from '@/hooks/useSlug';
import { useStoreConfig } from '@/hooks/useStore';
import { toast } from 'sonner';

interface TableQRCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableNumber: number | null;
  tableName?: string | null;
}

export function TableQRCodeModal({ open, onOpenChange, tableNumber, tableName }: TableQRCodeModalProps) {
  const slug = useSlug();
  const basePath = useBasePath(slug);
  const { data: store } = useStoreConfig();
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  const menuUrl =
    tableNumber != null
      ? `${window.location.origin}${basePath || ''}/?mesa=${tableNumber}`.replace(/([^:]\/)\/+/g, '$1')
      : '';

  useEffect(() => {
    if (!open || !menuUrl) return;
    setDataUrl(null);
    QRCode.toDataURL(menuUrl, { width: 640, margin: 2 })
      .then(setDataUrl)
      .catch(() => toast.error('Não foi possível gerar o QR Code'));
  }, [open, menuUrl]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `qrcode-mesa-${tableNumber}.png`;
    link.click();
  };

  const handlePrint = () => {
    if (!dataUrl) return;
    const win = window.open('', '_blank', 'width=480,height=640');
    if (!win) return;
    win.document.write(`
      <html><head><title>QR Code Mesa ${tableNumber}</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:24px">
        <h2>${store?.name || ''}</h2>
        <h1>Mesa ${tableNumber}</h1>
        <img src="${dataUrl}" style="width:320px;height:320px" />
        <p>Aponte a câmera para acessar o cardápio</p>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            QR Code — Mesa {tableNumber}
            {tableName ? ` (${tableName})` : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <div className="bg-card border rounded-xl p-4">
            {dataUrl ? (
              <img src={dataUrl} alt={`QR Code da mesa ${tableNumber}`} className="w-56 h-56" />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="w-full space-y-1.5">
            <p className="text-xs text-muted-foreground">Link do cardápio vinculado à mesa</p>
            <Input readOnly value={menuUrl} onFocus={(e) => e.currentTarget.select()} />
          </div>

          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1" onClick={handleDownload} disabled={!dataUrl}>
              <Download className="h-4 w-4 mr-2" /> Baixar
            </Button>
            <Button className="flex-1" onClick={handlePrint} disabled={!dataUrl}>
              <Printer className="h-4 w-4 mr-2" /> Imprimir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
