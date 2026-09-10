import React from 'react';
import { cn } from '@/lib/utils';

interface CardGridProps<T> {
  items: T[];
  renderCard: (item: T, index: number) => React.ReactNode;
  columns?: number;
  className?: string;
}

export function CardGrid<T>({ items, renderCard, columns = 3, className }: CardGridProps<T>) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-2', 
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
  }[columns] || 'grid-cols-3';

  return (
    <div className={cn('grid gap-4', gridCols, className)}>
      {items.map((item, index) => (
        <div key={index}>{renderCard(item, index)}</div>
      ))}
    </div>
  );
}