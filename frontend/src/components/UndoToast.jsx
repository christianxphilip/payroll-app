// Undo toast notification component
import { useEffect } from 'react';

const UndoToast = ({ action, onUndo, onDismiss, duration = 10000 }) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onDismiss();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onDismiss]);

  if (!action || !action.message) return null;

  return (
    <div
      className="bg-blue-600 text-white px-6 py-4 rounded-lg shadow-lg mb-4 flex items-center gap-3 animate-slide-in-right min-w-[300px] max-w-md"
      style={{
        animation: 'slideInRight 0.3s ease-out',
      }}
    >
      <div className="flex-shrink-0">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
        </svg>
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{action.message || 'Action completed'}</p>
      </div>
      <button
        onClick={() => {
          onUndo();
          onDismiss();
        }}
        className="flex-shrink-0 px-3 py-1 bg-white text-blue-600 rounded hover:bg-blue-50 transition-colors text-sm font-medium"
      >
        Undo
      </button>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 hover:opacity-75 transition-opacity"
        aria-label="Close"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default UndoToast;

