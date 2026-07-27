// Loading skeleton component for better UX
const LoadingSkeleton = ({ type = 'table', rows = 5, cols = 4 }) => {
  if (type === 'table') {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="animate-pulse">
          {/* Table Header */}
          <div className="bg-gray-200 h-12 mb-4"></div>
          {/* Table Rows */}
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex gap-4 mb-4 px-4">
              {Array.from({ length: cols }).map((_, j) => (
                <div key={j} className="flex-1 h-10 bg-gray-200 rounded"></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'card') {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow p-4 animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
    </div>
  );
};

export default LoadingSkeleton;



