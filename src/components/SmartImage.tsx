import React, { useState } from 'react';
import { Cross } from 'lucide-react';

interface SmartImageProps {
  src: string;
  alt: string;
  className?: string;
}

export const SmartImage: React.FC<SmartImageProps> = ({ src, alt, className = '' }) => {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-sky-50 to-blue-50 text-blue-700 p-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <div className="w-11 h-11 rounded-xl bg-white/90 border border-blue-100 flex items-center justify-center mb-2 shadow-xs">
          <Cross className="w-5 h-5 text-blue-600" />
        </div>
        <span className="text-xs font-medium text-slate-600 line-clamp-2 max-w-[180px]">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
      loading="lazy"
    />
  );
};
