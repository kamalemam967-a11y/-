import React, { useState } from 'react';
import { Award, Globe, Menu, ScanBarcode, ShoppingBag, X } from 'lucide-react';
import { Language } from '../types/pharmacy';
import { t } from '../data/translations';
import { PharmacyLogo } from './PharmacyLogo';

interface HeaderProps {
  lang: Language;
  onToggleLanguage: () => void;
  cartCount: number;
  onOpenCart: () => void;
  onNavigateHome: () => void;
  onNavigateAllCategories: () => void;
  onNavigateOffers: () => void;
  onOpenPrescription: () => void;
  onOpenProfile: () => void;
  onOpenBarcodeScanner: () => void;
  loyaltyPoints?: number;
  activeView: 'home' | 'category' | 'product' | 'offers' | 'prescription' | 'profile';
  notificationSlot?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  lang,
  onToggleLanguage,
  cartCount,
  onOpenCart,
  onNavigateHome,
  onNavigateAllCategories,
  onNavigateOffers,
  onOpenPrescription,
  onOpenProfile,
  onOpenBarcodeScanner,
  loyaltyPoints = 0,
  activeView,
  notificationSlot,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const copy = t(lang);

  const handleMobileNav = (action: () => void) => {
    action();
    setMobileMenuOpen(false);
  };

  return (
    <div className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80">
      {/* Slim Utility Announcement Bar (<= 28px) */}
      <div className="bg-slate-900 text-blue-100/90 text-[11px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-7 flex items-center justify-between gap-4">
          <p className="truncate font-normal text-slate-200">{copy.utilityBanner}</p>
          <button
            type="button"
            onClick={onToggleLanguage}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-white hover:text-blue-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded"
          >
            <Globe className="w-3 h-3" aria-hidden="true" />
            <span>{lang === 'ar' ? 'English' : 'العربية'}</span>
          </button>
        </div>
      </div>

      {/* Main 3-Zone Header Contract */}
      <header className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={onNavigateHome}
          className="text-start cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 rounded-lg"
        >
          <PharmacyLogo lang={lang} variant="header" />
        </button>

        {/* Zone 2: 4 Concise Single-Line Navigation Links */}
        <nav
          className="hidden md:flex items-center gap-6 text-[13px] font-medium text-slate-600"
          aria-label={lang === 'ar' ? 'التنقل الرئيسي' : 'Primary navigation'}
        >
          <button
            type="button"
            onClick={onNavigateHome}
            className={`py-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors border-b-2 ${
              activeView === 'home'
                ? 'text-blue-700 border-blue-600 font-semibold'
                : 'border-transparent hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            {copy.nav.home}
          </button>
          <button
            type="button"
            onClick={onNavigateAllCategories}
            className={`py-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors border-b-2 ${
              activeView === 'category'
                ? 'text-blue-700 border-blue-600 font-semibold'
                : 'border-transparent hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            {copy.nav.categories}
          </button>
          <button
            type="button"
            onClick={onNavigateOffers}
            className={`py-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors border-b-2 ${
              activeView === 'offers'
                ? 'text-blue-700 border-blue-600 font-semibold'
                : 'border-transparent hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            {copy.nav.offers}
          </button>
          <button
            type="button"
            onClick={onOpenPrescription}
            className={`py-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors border-b-2 ${
              activeView === 'prescription'
                ? 'text-blue-700 border-blue-600 font-semibold'
                : 'border-transparent hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            {copy.nav.prescription}
          </button>
        </nav>

        {/* Zone 3: Barcode Scanner + Notification Bell + Profile Points + Cart Button + Mobile Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenBarcodeScanner}
            title={lang === 'ar' ? 'قراءة باركود الأصناف' : 'Scan product barcode'}
            aria-label={lang === 'ar' ? 'قراءة باركود الأصناف' : 'Scan product barcode'}
            className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 hover:border-blue-300 text-slate-700 hover:text-blue-700 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 shrink-0"
          >
            <ScanBarcode className="w-4 h-4" aria-hidden="true" />
          </button>
          {notificationSlot}
          <button
            type="button"
            onClick={onOpenProfile}
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 h-9 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeView === 'profile'
                ? 'border-blue-500 bg-blue-50 text-blue-800'
                : 'border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700'
            }`}
            aria-label={copy.nav.profile}
          >
            <Award className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
            <span className="font-mono-tabular">{loyaltyPoints}</span>
          </button>
          <button
            type="button"
            onClick={onOpenCart}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 min-h-[36px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{copy.nav.cart}</span>
            <span className="tabular-nums font-mono-tabular text-[11px] bg-blue-800/70 px-1.5 py-0.5 rounded-md">
              {cartCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label={lang === 'ar' ? 'فتح القائمة' : 'Toggle menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Dropdown Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
          <button
            type="button"
            onClick={() => handleMobileNav(onNavigateHome)}
            className="w-full text-start px-3 py-2.5 rounded-lg text-sm font-medium text-slate-800 hover:bg-blue-50 hover:text-blue-800 transition-colors"
          >
            {copy.nav.home}
          </button>
          <button
            type="button"
            onClick={() => handleMobileNav(onNavigateAllCategories)}
            className="w-full text-start px-3 py-2.5 rounded-lg text-sm font-medium text-slate-800 hover:bg-blue-50 hover:text-blue-800 transition-colors"
          >
            {copy.nav.categories}
          </button>
          <button
            type="button"
            onClick={() => handleMobileNav(onNavigateOffers)}
            className="w-full text-start px-3 py-2.5 rounded-lg text-sm font-medium text-slate-800 hover:bg-blue-50 hover:text-blue-800 transition-colors"
          >
            {copy.nav.offers}
          </button>
          <button
            type="button"
            onClick={() => handleMobileNav(onOpenPrescription)}
            className="w-full text-start px-3 py-2.5 rounded-lg text-sm font-medium text-slate-800 hover:bg-blue-50 hover:text-blue-800 transition-colors"
          >
            {copy.nav.prescription}
          </button>
          <button
            type="button"
            onClick={() => handleMobileNav(onOpenProfile)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-blue-800 hover:bg-blue-50 transition-colors"
          >
            <span>{copy.nav.profile}</span>
            <span className="font-mono-tabular text-xs font-bold">
              {loyaltyPoints} {copy.loyalty.pointsUnit}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
