import { useDroppable } from '@dnd-kit/core';
import { Badge } from '@/components/ui/badge';

interface DroppableColumnProps {
  id: string;
  children: React.ReactNode;
  color: string;
  label: string;
  count: number;
}

export function DroppableColumn({ id, children, color, label, count }: DroppableColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div 
      ref={setNodeRef} 
      className={`rounded-xl sm:rounded-2xl ${color} p-3 sm:p-4 min-w-0 transition-all ${isOver ? 'ring-2 ring-primary ring-offset-2' : ''}`}
    >
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h2 className="font-bold text-foreground text-sm sm:text-base">{label}</h2>
        <Badge variant="secondary" className="text-xs">{count}</Badge>
      </div>
      
      <div className="space-y-3 sm:space-y-4 max-h-[400px] sm:max-h-[600px] overflow-y-auto min-h-[100px]">
        {children}
      </div>
    </div>
  );
}
