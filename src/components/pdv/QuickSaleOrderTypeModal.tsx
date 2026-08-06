import { ShoppingBag, Truck, Store, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type OrderType = 'pickup' | 'counter' | 'delivery';

interface QuickSaleOrderTypeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: OrderType) => void;
}

export function QuickSaleOrderTypeModal({ open, onOpenChange, onSelect }: QuickSaleOrderTypeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Tipo de Pedido</DialogTitle>
          </div>
        </DialogHeader>
        
        <div className="grid grid-cols-1 gap-4 py-4">
          <Button
            variant="outline"
            className="h-20 flex flex-col items-center justify-center gap-2 border-2 hover:border-primary hover:bg-primary/5 group"
            onClick={() => onSelect('pickup')}
          >
            <Store className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
            <span className="font-semibold">Retirada</span>
          </Button>

          <Button
            variant="outline"
            className="h-20 flex flex-col items-center justify-center gap-2 border-2 hover:border-primary hover:bg-primary/5 group"
            onClick={() => onSelect('counter')}
          >
            <ShoppingBag className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
            <span className="font-semibold">Balcão</span>
          </Button>

          <Button
            variant="outline"
            className="h-20 flex flex-col items-center justify-center gap-2 border-2 hover:border-primary hover:bg-primary/5 group"
            onClick={() => onSelect('delivery')}
          >
            <Truck className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
            <span className="font-semibold">Delivery</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
