import React from 'react';
import { Language } from '../types/pharmacy';

interface PharmacyLogoProps {
  lang: Language;
  variant?: 'header' | 'hero' | 'footer';
  inverted?: boolean;
}

export const PharmacyLogo: React.FC<PharmacyLogoProps> = ({
  lang,
  variant = 'header',
  inverted = false,
}) => {
  const iconSize = variant === 'hero' ? 'w-8 h-8' : variant === 'footer' ? 'w-8 h-8' : 'w-7 h-7';
  const titleSize =
    variant === 'hero'
      ? 'text-base sm:text-lg font-bold'
      : variant === 'footer'
        ? 'text-sm sm:text-base font-bold'
        : 'text-sm sm:text-[15px] font-bold';

  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
      <svg
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${iconSize} shrink-0`}
        aria-hidden="true"
      >
        <rect
          x="2"
          y="2"
          width="40"
          height="40"
          rx="11"
          className={inverted ? 'fill-blue-500/20 stroke-blue-400/50' : 'fill-blue-50 stroke-blue-200'}
          strokeWidth="1.5"
        />
        {/* Clean clinical cross */}
        <path
          d="M19 10C19 9.44772 19.4477 9 20 9H24C24.5523 9 25 9.44772 25 10V19H34C34.5523 19 35 19.4477 35 20V24C35 24.5523 34.5523 25 34 25H25V34C25 34.5523 24.5523 35 24 35H20C19.4477 35 19 34.5523 19 34V25H10C9.44772 25 9 24.5523 9 24V20C9 19.4477 9.44772 19 10 19H19V10Z"
          className={inverted ? 'fill-blue-400' : 'fill-blue-600'}
        />
        {/* Soft sky-blue apothecary arc */}
        <path
          d="M13 30C17.5 28.5 23.5 24.5 29 14"
          stroke={inverted ? '#93C5FD' : '#0284C7'}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx="29" cy="14" r="2.2" fill={inverted ? '#BFDBFE' : '#38BDF8'} />
      </svg>
      <span
        className={`${titleSize} tracking-tight ${
          inverted ? 'text-white' : 'text-slate-900'
        } whitespace-nowrap`}
      >
        {lang === 'ar' ? 'صيدلية محمد عبد ربه' : 'Mohamed Abd Raboo Pharmacy'}
      </span>
    </span>
  );
};
