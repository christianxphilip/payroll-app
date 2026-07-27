import { useState, useRef, useEffect } from 'react';

const ResponsiveTableWrapper = ({ children, stickyFirstColumn = true, className = '' }) => {
  const scrollRef = useRef(null);
  const [showRightShadow, setShowRightShadow] = useState(false);
  const [showLeftShadow, setShowLeftShadow] = useState(false);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeftShadow(scrollLeft > 5);
    setShowRightShadow(scrollLeft < scrollWidth - clientWidth - 5);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  return (
    <div className={`relative w-full my-3 ${className}`}>
      {/* Scroll indicator overlay shadows */}
      {showLeftShadow && (
        <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-gray-900/10 to-transparent pointer-events-none z-20" />
      )}
      {showRightShadow && (
        <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-gray-900/10 to-transparent pointer-events-none z-20" />
      )}

      {/* Touch horizontal scroll container */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className={`overflow-x-auto w-full border border-gray-200 rounded-lg shadow-sm bg-white ${
          stickyFirstColumn ? 'sticky-first-col' : ''
        }`}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {children}
      </div>
    </div>
  );
};

export default ResponsiveTableWrapper;
