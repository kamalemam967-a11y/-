import React from 'react';
import { FileUp, Home, LayoutGrid, Tag, User } from 'lucide-react';
import { Language } from '../types/pharmacy';

export type BottomNavActiveView =
  | 'home'
  | 'category'
  | 'product'
  | 'offers'
  | 'prescription'
  | 'profile';

interface BottomNavBarProps {
  lang: Language;
  activeView: BottomNavActiveView;
  onNavigateHome: () => void;
  onNavigateCategories: () => void;
  onNavigateOffers: () => void;
  onOpenPrescription: () => void;
  onOpenProfile: () => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  lang,
  activeView,
  onNavigateHome,
  onNavigateCategories,
  onNavigateOffers,
  onOpenPrescription,
  onOpenProfile,
}) => {
  const isAr = lang === 'ar';

  const items = [
    {
      key: 'home',
      label: isAr ? 'الرئيسية' : 'Home',
      icon: Home,
      isActive: activeView === 'home',
      onClick: onNavigateHome,
    },
    {
      key: 'categories',
      label: isAr ? 'التصنيفات' : 'Categories',
      icon: LayoutGrid,
      isActive: activeView === 'category' || activeView === 'product',
      onClick: onNavigateCategories,
    },
    {
      key: 'offers',
      label: isAr ? 'العروض' : 'Offers',
      icon: Tag,
      isActive: activeView === 'offers',
      onClick: onNavigateOffers,
    },
    {
      key: 'prescription',
      label: isAr ? 'رفع الروشتة' : 'Prescription',
      icon: FileUp,
      isActive: activeView === 'prescription',
      onClick: onOpenPrescription,
    },
    {
      key: 'profile',
      label: isAr ? 'حسابي' : 'Account',
      icon: User,
      isActive: activeView === 'profile',
      onClick: onOpenProfile,
    },
  ];

  return (
    <nav
      aria-label={isAr ? 'شريط التنقل السفلي' : 'Bottom navigation'}
      className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-2px_12px_rgba(15,23,42,0.05)]"
    >
      <div className="max-w-7xl mx-auto px-1 sm:px-6">
        <div className="grid grid-cols-5 h-16">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={item.onClick}
                aria-current={item.isActive ? 'page' : undefined}
                className="group relative flex flex-col items-center justify-center gap-1 px-1 text-center cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-blue-600 rounded-lg"
              >
                {item.isActive && (
                  <span
                    className="absolute top-0 w-8 h-0.5 rounded-full bg-blue-600"
                    aria-hidden="true"
                  />
                )}
                <span
                  className={`inline-flex items-center justify-center w-9 h-6 rounded-lg transition-colors ${
                    item.isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100/70'
                  }`}
                >
                  <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
                </span>
                <span
                  className={`text-[10px] sm:text-[11px] leading-none truncate max-w-full transition-colors ${
                    item.isActive
                      ? 'font-semibold text-blue-700'
                      : 'font-medium text-slate-600 group-hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
