import React from 'react';
import { cn } from '../../utils/cn';

interface ResizableHeaderProps {
  columnId: string;
  width?: number;
  onResizeStart: (columnId: string, event: React.MouseEvent) => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function ResizableHeader({ 
  columnId, 
  width, 
  onResizeStart, 
  children, 
  className,
  style,
  ...props 
}: ResizableHeaderProps) {
  return (
    <th 
      {...props}
      style={{ ...style, width: width ? `${width}px` : undefined, minWidth: width ? '50px' : undefined }}
      className={cn("relative group/resizer select-none", className)}
    >
      <div className="flex items-center h-full w-full gap-1 overflow-hidden">
        {children}
      </div>
      
      {/* Resizer Handle */}
      <div
        onMouseDown={(e) => {
          e.stopPropagation();
          onResizeStart(columnId, e);
        }}
        style={{ 
          cursor: "url(\"data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M16 6V26M10 16L6 16M6 16L9 13M6 16L9 19M22 16L26 16M26 16L23 13M26 16L23 19' stroke='%230061e0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\") 16 16, col-resize" 
        }}
        className={cn(
          "absolute right-0 top-0 bottom-0 w-1 transition-all z-20",
          "hover:bg-primary bg-primary/20", 
          "after:content-[''] after:absolute after:right-0 after:top-0 after:bottom-0 after:w-4 after:-mr-2" // Hit area
        )}
      >
        {/* Visual Handle Dot/Line */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[2px] h-4 bg-primary rounded-full opacity-0 group-hover/resizer:opacity-100 transition-opacity" />
      </div>
    </th>
  );
}
