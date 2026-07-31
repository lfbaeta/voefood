import { useDraggable } from '@dnd-kit/core';
import { Order } from '@/hooks/useOrders';
import { OrderCardContent } from './OrderCardContent';

interface DraggableOrderCardProps {
  order: Order;
  store: any;
  onOpenDetails: (order: Order) => void;
}

export function DraggableOrderCard({ order, store, onOpenDetails }: DraggableOrderCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id.toString(),
    data: { order },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  } : undefined;

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <OrderCardContent order={order} store={store} onOpenDetails={onOpenDetails} dragListeners={listeners} />
    </div>
  );
}
