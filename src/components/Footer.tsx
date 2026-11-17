import React from 'react';
import { Clock, MapPin, MessageCircle, Phone } from 'lucide-react';
import { CATEGORIES } from '../data/catalog';
import { t } from '../data/translations';
import { CategoryId, Language } from '../types/pharmacy';
import { PharmacyLogo } from './PharmacyLogo';

interface FooterProps {
  lang: Language;
  onSelectCategory: (id: CategoryId) => void;
  onNavigateOffers: () => void;
  onOpenPrescription: () => void;
  onOpenStaffPortal: () => void;
  onOpenAdmin: () => void;
  onOpenProfile: () => void;
  onToggleLanguage: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  lang,
  onSelectCategory,
  onNavigateOffers,
  onOpenPrescription,
  onOpenStaffPortal,
  onOpenAdmin,
  onOpenProfile,
  onToggleLanguage,
}) => {
  const copy = t(lang);

  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-10">
          {/* Brand Summary */}
          <div className="md:col-span-4 space-y-3">
            <PharmacyLogo lang={lang} variant="footer" inverted />
            <p className="text-xs sm:text-[13px] text-slate-400 leading-relaxed max-w-sm">
              {copy.footer.about}
            </p>
            <button
              type="button"
              onClick={onToggleLanguage}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 cursor-pointer"
            >
              {lang === 'ar' ? 'Switch to English (LTR)' : 'التبديل إلى العربية (RTL)'}
            </button>
          </div>

          {/* 10 Departments Quick Links */}
          <div className="md:col-span-5 space-y-2.5">
            <h3 className="text-xs font-bold text-white">{copy.footer.categoriesHeading}</h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              {CATEGORIES.map((cat) => (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => onSelectCategory(cat.id)}
                    className="text-slate-400 hover:text-white transition-colors text-start cursor-pointer"
                  >
                    {lang === 'ar' ? cat.nameAr : cat.nameEn}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Services & Contact */}
          <div className="md:col-span-3 space-y-4">
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-white">{copy.footer.servicesHeading}</h3>
              <ul className="space-y-1.5 text-xs">
                <li>
                  <button
                    type="button"
                    onClick={onOpenPrescription}
                    className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {copy.nav.prescription}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={onNavigateOffers}
                    className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {copy.nav.offers}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={onOpenProfile}
                    className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {copy.nav.profile}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={onOpenStaffPortal}
                    className="text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                  >
                    {copy.prescription.staffTab}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={onOpenAdmin}
                    className="text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer font-semibold"
                  >
                    {lang === 'ar' ? '📊 لوحة تحكم الإدارة الشاملة' : '📊 Admin & Management Center'}
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-800">
              <h3 className="text-xs font-bold text-white">{copy.footer.contactHeading}</h3>
              <ul className="space-y-1.5 text-xs text-slate-400">
                <li className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{copy.footer.address}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-blue-400 shrink-0" aria-hidden="true" />
                  <a
                    href="tel:0228757261"
                    className="tabular-nums hover:text-white transition-colors"
                  >
                    {copy.footer.hotline}
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <MessageCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" aria-hidden="true" />
                  <a
                    href="https://wa.me/201149737685"
                    className="tabular-nums hover:text-white transition-colors"
                  >
                    {copy.footer.whatsapp}
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" aria-hidden="true" />
                  <span>{copy.footer.hours}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-800 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>{copy.footer.copyright}</p>
          <p className="text-slate-500">{copy.brandTagline}</p>
        </div>
      </div>
    </footer>
  );
};
