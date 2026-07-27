// Custom hook for undo functionality
import { useState, useCallback, useRef, useEffect } from 'react';

export const useUndo = () => {
  const [history, setHistory] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const timeoutRef = useRef(null);

  const addAction = useCallback((action) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Add new action to history
    const newAction = { ...action, timestamp: Date.now() };
    setHistory((prev) => {
      const newHistory = prev.slice(0, currentIndex + 1);
      return [...newHistory, newAction];
    });
    setCurrentIndex((prev) => {
      const newIndex = prev + 1;
      return newIndex;
    });

    // Auto-remove after 10 seconds
    timeoutRef.current = setTimeout(() => {
      setHistory((prev) => prev.slice(1));
      setCurrentIndex((prev) => Math.max(-1, prev - 1));
    }, 10000);
  }, [currentIndex]);

  const undo = useCallback(async () => {
    if (currentIndex < 0 || !history[currentIndex]) {
      return false;
    }

    const action = history[currentIndex];
    
    try {
      // Execute undo function
      if (action.undo) {
        await action.undo();
      }
      
      // Remove from history
      setHistory((prev) => prev.slice(0, currentIndex));
      setCurrentIndex((prev) => prev - 1);
      
      return true;
    } catch (error) {
      console.error('Undo failed:', error);
      return false;
    }
  }, [currentIndex, history]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setCurrentIndex(-1);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    addAction,
    undo,
    canUndo: currentIndex >= 0 && history.length > 0,
    lastAction: history[currentIndex] || null,
    clearHistory
  };
};

