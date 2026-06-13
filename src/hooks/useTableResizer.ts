import React, { useState, useCallback, useRef, useEffect } from 'react';
import { PreferencesService } from '../services/preferencesService';

export interface ColumnWidths {
  [key: string]: number;
}

export function useTableResizer(prefKey: string, initialWidths: ColumnWidths) {
  const [widths, setWidths] = useState<ColumnWidths>(initialWidths);
  const widthsRef = useRef<ColumnWidths>(initialWidths);
  const [isResizing, setIsResizing] = useState(false);
  
  // Debounce saving to backend
  const saveTimeoutRef = useRef<any>(null);

  useEffect(() => {
    // Load saved preferences on mount
    PreferencesService.getPreferences().then(prefs => {
      if (prefs[prefKey]) {
        const savedWidths = prefs[prefKey];
        setWidths(savedWidths);
        widthsRef.current = savedWidths;
      }
    });
  }, [prefKey]);

  const onResizeStart = useCallback((columnId: string, event: React.MouseEvent) => {
    event.preventDefault();
    setIsResizing(true);
    
    const startX = event.pageX;
    const startWidth = widthsRef.current[columnId] || 150;

    const onMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(50, startWidth + (e.pageX - startX));
      const nextWidths = { ...widthsRef.current, [columnId]: newWidth };
      setWidths(nextWidths);
      widthsRef.current = nextWidths;
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      // Save to backend with debounce
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        PreferencesService.savePreference(prefKey, widthsRef.current);
      }, 1000);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [prefKey]);

  return { widths, onResizeStart, isResizing };
}
