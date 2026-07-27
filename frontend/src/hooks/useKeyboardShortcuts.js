// Custom hook for keyboard shortcuts
import { useEffect } from 'react';

export const useKeyboardShortcuts = (shortcuts) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger shortcuts when typing in inputs
      if (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.isContentEditable
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const alt = e.altKey;

      // Check for matching shortcut
      for (const shortcut of shortcuts) {
        const matches =
          (shortcut.ctrl === undefined || shortcut.ctrl === ctrl) &&
          (shortcut.shift === undefined || shortcut.shift === shift) &&
          (shortcut.alt === undefined || shortcut.alt === alt) &&
          shortcut.key === key;

        if (matches) {
          e.preventDefault();
          shortcut.handler();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
};



