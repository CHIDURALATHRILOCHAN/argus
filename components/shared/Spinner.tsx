
import React from 'react';

const Spinner: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 border-4 border-argus-primary border-t-transparent rounded-full animate-spin"></div>
      <p className="text-argus-text-secondary dark:text-hc-text-secondary text-lg animate-pulse-fast">Loading...</p>
    </div>
  );
};

export default Spinner;