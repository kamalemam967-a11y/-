import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileUp,
  Search,
  ShieldCheck,
  Stethoscope,
  Truck,
  X,
} from 'lucide-react';
import { CATEGORIES, IMAGES, PRODUCTS, PROMO_BANNERS } from '../data/catalog';
import { t } from '../data/translations';
import { CategoryId, Language, Product } from '../types/pharmacy';
import { CategoryIcon } from './CategoryIcon';
import { PharmacyLogo } from './PharmacyLogo';
import { ProductCard } from './ProductCard';
import { SmartImage } from './SmartImage';

interface HomeViewProps {
  lang: Language;
  products?: Product[];
  onSelectCategory: (categoryId: CategoryId) => void;
  onSelectAllCategories: () => void;
  onSelectOffers: () => void;
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onOpenPrescription: () => void;
}

type CollectionTab = 'featured' | 'bestSellers' | 'newArrivals' | 'offers';

export const HomeView: React.FC<HomeViewProps> = ({
  lang,
  products = PRODUCTS,
  onSelectCategory,
  onSelectAllCategories,
  onSelectOffers,
  onSelectProduct,
  onAddToCart,
  onOpenPrescription,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<CollectionTab>('featured');
  const [isDraggingCategories, setIsDraggingCategories] = useState(false);
  const [isDraggingPromos, setIsDraggingPromos] = useState(false);
  const categoriesTrackRef = useRef<HTMLDivElement>(null);
  const promosTrackRef = useRef<HTMLDivElement>(null);
  const isDraggingCatRef = useRef(false);
  const didDragCatRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartScrollLeftRef = useRef(0);
  const isDraggingPromoRef = useRef(false);
  const didDragPromoRef = useRef(false);
  const promoDragStartXRef = useRef(0);
  const promoDragStartScrollLeftRef = useRef(0);
  const copy = t(lang);
  const DirectionalArrow = lang === 'ar' ? ArrowLeft : ArrowRight;

  const handleCategoryMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !categoriesTrackRef.current) return;
    isDraggingCatRef.current = true;
    didDragCatRef.current = false;
    dragStartXRef.current = e.clientX;
    dragStartScrollLeftRef.current = categoriesTrackRef.current.scrollLeft;
    setIsDraggingCategories(true);
  };

  const handleCategoryMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingCatRef.current || !categoriesTrackRef.current) return;
    const deltaX = e.clientX - dragStartXRef.current;
    if (Math.abs(deltaX) > 6) {
      didDragCatRef.current = true;
    }
    categoriesTrackRef.current.scrollLeft = dragStartScrollLeftRef.current - deltaX;
  };

  const handleCategoryDragEnd = () => {
    if (!isDraggingCatRef.current) return;
    isDraggingCatRef.current = false;
    setIsDraggingCategories(false);
    window.setTimeout(() => {
      didDragCatRef.current = false;
    }, 0);
  };

  const scrollCategoriesBy = (delta: number) => {
    categoriesTrackRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const handlePromoMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !promosTrackRef.current) return;
    isDraggingPromoRef.current = true;
    didDragPromoRef.current = false;
    promoDragStartXRef.current = e.clientX;
    promoDragStartScrollLeftRef.current = promosTrackRef.current.scrollLeft;
    setIsDraggingPromos(true);
  };

  const handlePromoMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingPromoRef.current || !promosTrackRef.current) return;
    const deltaX = e.clientX - promoDragStartXRef.current;
    if (Math.abs(deltaX) > 6) {
      didDragPromoRef.current = true;
    }
    promosTrackRef.current.scrollLeft = promoDragStartScrollLeftRef.current - deltaX;
  };

  const handlePromoDragEnd = () => {
    if (!isDraggingPromoRef.current) return;
    isDraggingPromoRef.current = false;
    setIsDraggingPromos(false);
    window.setTimeout(() => {
      didDragPromoRef.current = false;
    }, 0);
  };

  const scrollPromosBy = (delta: number) => {
    promosTrackRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  // Live instant search across Arabic & English product names, brands, and SKUs
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => {
      return (
        p.nameAr.toLowerCase().includes(q) ||
        p.nameEn.toLowerCase().includes(q) ||
        p.brandAr.toLowerCase().includes(q) ||
        p.brandEn.toLowerCase().includes(q) ||
        p.shortDescAr.toLowerCase().includes(q) ||
        p.shortDescEn.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
      );
    }).slice(0, 6);
  }, [searchQuery, products]);

  const tabProducts = useMemo(() => {
    switch (activeTab) {
      case 'featured':
        return products.filter((p) => p.isFeatured).slice(0, 6);
      case 'bestSellers':
        return products.filter((p) => p.isBestSeller).slice(0, 6);
      case 'newArrivals':
        return products.filter((p) => p.isNewArrival).slice(0, 6);
      case 'offers':
        return products.filter((p) => p.isOffer || (p.originalPrice && p.originalPrice > p.price)).slice(0, 6);
    }
  }, [activeTab, products]);

  const pharmacistRecommendations = useMemo(() => {
    return products.filter((p) => ['vit-1', 'skin-1', 'dev-1', 'aid-1'].includes(p.id));
  }, [products]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of products) {
      counts[p.categoryId] = (counts[p.categoryId] || 0) + 1;
    }
    return counts;
  }, [products]);

  return (
    <main className="space-y-10 sm:space-y-12 pb-14">
      {/* 1. Welcome Hero + Search Bar */}
      <section className="bg-gradient-to-b from-[#EEF4FB] via-[#F5F8FD] to-[#F6F8FC] border-b border-slate-200/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-8 sm:pt-9 sm:pb-11">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-9 items-stretch">
            {/* Hero Text & Live Search Column */}
            <div className="lg:col-span-7 flex flex-col justify-center space-y-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2.5">
                  <PharmacyLogo lang={lang} variant="hero" />
                </div>
                <p className="text-[11px] font-semibold text-blue-700 tracking-wide">
                  {copy.hero.kicker}
                </p>
                <h1 className="text-xl sm:text-2xl lg:text-[1.75rem] font-bold text-slate-900 leading-[1.3] text-balance max-w-2xl">
                  {copy.hero.title}
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xl">
                  {copy.hero.subtitle}
                </p>
              </div>

              {/* Live Medicine & Product Search Bar */}
              <div className="relative max-w-xl">
                <div className="relative flex items-center bg-white border border-slate-200/90 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 rounded-xl shadow-xs transition-all">
                  <Search
                    className="w-4 h-4 text-slate-400 ms-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={copy.hero.searchPlaceholder}
                    aria-label={copy.hero.searchPlaceholder}
                    className="w-full py-2.5 px-2.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 bg-transparent focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="p-2 me-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                      aria-label={lang === 'ar' ? 'مسح البحث' : 'Clear search'}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Live Autocomplete Results Dropdown */}
                {searchQuery.trim().length > 0 && (
                  <div className="absolute z-30 top-full mt-2 w-full bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500">
                      {copy.hero.searchResultsLabel}
                    </div>
                    {searchResults.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-slate-500">
                        {copy.hero.searchEmpty}
                      </div>
                    ) : (
                      <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                        {searchResults.map((item) => (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setSearchQuery('');
                                onSelectProduct(item);
                              }}
                              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-blue-50/60 transition-colors text-start cursor-pointer"
                            >
                              <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                                <SmartImage
                                  src={item.image}
                                  alt={lang === 'ar' ? item.nameAr : item.nameEn}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-900 truncate">
                                  {lang === 'ar' ? item.nameAr : item.nameEn}
                                </p>
                                <p className="text-xs text-slate-500 truncate">
                                  {lang === 'ar' ? item.brandAr : item.brandEn}
                                </p>
                              </div>
                              <div className="text-sm font-bold text-blue-700 tabular-nums whitespace-nowrap shrink-0">
                                {item.price} {copy.currency}
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Hero CTAs (Primary + Quick Prescription Access) */}
              <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
                <button
                  type="button"
                  onClick={onSelectAllCategories}
                  className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[38px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
                >
                  <span>{copy.hero.shopNow}</span>
                  <DirectionalArrow className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={onOpenPrescription}
                  className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[38px] rounded-xl bg-white hover:bg-blue-50 text-blue-800 border border-blue-200/90 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FileUp className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
                  <span>{copy.hero.uploadRx}</span>
                </button>
              </div>
            </div>

            {/* Hero Editorial Visual Column */}
            <div className="lg:col-span-5">
              <div className="relative h-56 sm:h-72 lg:h-full min-h-[260px] rounded-2xl overflow-hidden border border-slate-200/80 bg-slate-100">
                <SmartImage
                  src={IMAGES.hero}
                  alt={copy.brandName}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/10 to-transparent" />
                <div className="absolute bottom-3.5 inset-x-4 text-white">
                  <p className="text-[11px] font-medium text-blue-200 mb-0.5">
                    {lang === 'ar' ? 'خدمة صيدلانية متواصلة' : '24/7 Licensed Pharmacy Care'}
                  </p>
                  <p className="text-xs sm:text-sm font-semibold">
                    {copy.brandTagline}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 4-Column Trust Strip Full-Width Below Hero Split */}
          <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/90 border border-slate-200/70">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-slate-800">{copy.trust.authenticTitle}</h2>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  {copy.trust.authenticDesc}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/90 border border-slate-200/70">
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
                <Stethoscope className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-slate-800">{copy.trust.pharmacistTitle}</h2>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  {copy.trust.pharmacistDesc}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/90 border border-slate-200/70">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                <Truck className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-slate-800">{copy.trust.deliveryTitle}</h2>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  {copy.trust.deliveryDesc}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenPrescription}
              className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/90 border border-slate-200/70 hover:border-blue-300 transition-colors text-start cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-slate-800">{copy.trust.rxTitle}</h2>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  {copy.trust.rxDesc}
                </p>
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Promotional Banners — Horizontal Hand-Swipeable Carousel (RTL right-to-left) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">{copy.sections.promosTitle}</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{copy.sections.promosSubtitle}</p>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-2.5">
            <div className="hidden sm:flex items-center gap-1">
              <button
                type="button"
                onClick={() => scrollPromosBy(460)}
                aria-label={lang === 'ar' ? 'تمرير العروض لليمين' : 'Scroll promotions right'}
                className="w-7 h-7 rounded-lg bg-white border border-slate-200/90 text-slate-600 hover:text-blue-700 hover:border-blue-300 flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollPromosBy(-460)}
                aria-label={lang === 'ar' ? 'تمرير العروض لليسار' : 'Scroll promotions left'}
                className="w-7 h-7 rounded-lg bg-white border border-slate-200/90 text-slate-600 hover:text-blue-700 hover:border-blue-300 flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={onSelectOffers}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{copy.sections.tabs.offers}</span>
              <DirectionalArrow className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          ref={promosTrackRef}
          onMouseDown={handlePromoMouseDown}
          onMouseMove={handlePromoMouseMove}
          onMouseUp={handlePromoDragEnd}
          onMouseLeave={handlePromoDragEnd}
          className={`flex items-stretch gap-4 overflow-x-auto no-scrollbar pb-2 pt-0.5 select-none touch-pan-x ${
            isDraggingPromos ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        >
          {PROMO_BANNERS.map((promo) => (
            <div
              key={promo.id}
              draggable={false}
              onClick={(e) => {
                if (didDragPromoRef.current) {
                  e.preventDefault();
                  return;
                }
                if (promo.targetCategory && promo.targetCategory !== 'offers') {
                  onSelectCategory(promo.targetCategory);
                } else {
                  onSelectOffers();
                }
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (promo.targetCategory && promo.targetCategory !== 'offers') {
                    onSelectCategory(promo.targetCategory);
                  } else {
                    onSelectOffers();
                  }
                }
              }}
              className={`group shrink-0 w-[86%] sm:w-[440px] lg:w-[480px] grid grid-cols-1 sm:grid-cols-12 rounded-2xl border overflow-hidden transition-all duration-200 hover:shadow-sm ${
                isDraggingPromos ? 'cursor-grabbing' : 'cursor-pointer'
              } ${
                promo.tone === 'blue'
                  ? 'bg-blue-50/80 border-blue-200/80 hover:border-blue-300'
                  : 'bg-sky-50/80 border-sky-200/80 hover:border-sky-300'
              }`}
            >
              <div className="sm:col-span-7 p-4 sm:p-5 flex flex-col justify-between gap-3">
                <div>
                  <p
                    className={`text-[11px] font-semibold mb-1 ${
                      promo.tone === 'blue' ? 'text-blue-700' : 'text-sky-700'
                    }`}
                  >
                    {lang === 'ar' ? promo.discountTextAr : promo.discountTextEn}
                  </p>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug line-clamp-2">
                    {lang === 'ar' ? promo.titleAr : promo.titleEn}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed line-clamp-2">
                    {lang === 'ar' ? promo.subtitleAr : promo.subtitleEn}
                  </p>
                </div>
                <div>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                      promo.tone === 'blue'
                        ? 'text-blue-800 group-hover:text-blue-950'
                        : 'text-sky-800 group-hover:text-sky-950'
                    }`}
                  >
                    <span>{lang === 'ar' ? promo.ctaAr : promo.ctaEn}</span>
                    <DirectionalArrow className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
                  </span>
                </div>
              </div>
              <div className="sm:col-span-5 h-36 sm:h-auto bg-slate-100 overflow-hidden [&_img]:pointer-events-none">
                <SmartImage
                  src={promo.image}
                  alt={lang === 'ar' ? promo.titleAr : promo.titleEn}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. All 10 Product Categories — Horizontal Hand-Swipeable Icon Strip (RTL right-to-left) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">{copy.sections.categoriesTitle}</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{copy.sections.categoriesSubtitle}</p>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-2.5">
            <div className="hidden sm:flex items-center gap-1">
              <button
                type="button"
                onClick={() => scrollCategoriesBy(260)}
                aria-label={lang === 'ar' ? 'تمرير الأقسام لليمين' : 'Scroll categories right'}
                className="w-7 h-7 rounded-lg bg-white border border-slate-200/90 text-slate-600 hover:text-blue-700 hover:border-blue-300 flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollCategoriesBy(-260)}
                aria-label={lang === 'ar' ? 'تمرير الأقسام لليسار' : 'Scroll categories left'}
                className="w-7 h-7 rounded-lg bg-white border border-slate-200/90 text-slate-600 hover:text-blue-700 hover:border-blue-300 flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={onSelectAllCategories}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{copy.sections.viewAllCategories}</span>
              <DirectionalArrow className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          ref={categoriesTrackRef}
          onMouseDown={handleCategoryMouseDown}
          onMouseMove={handleCategoryMouseMove}
          onMouseUp={handleCategoryDragEnd}
          onMouseLeave={handleCategoryDragEnd}
          className={`flex items-stretch gap-2.5 sm:gap-3 overflow-x-auto no-scrollbar pb-2 pt-1 select-none touch-pan-x ${
            isDraggingCategories ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        >
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              draggable={false}
              onClick={(e) => {
                if (didDragCatRef.current) {
                  e.preventDefault();
                  return;
                }
                onSelectCategory(category.id);
              }}
              className={`group shrink-0 w-[96px] sm:w-[112px] bg-white hover:bg-blue-50/40 rounded-2xl border border-slate-200/80 hover:border-blue-300 px-2.5 py-3.5 flex flex-col items-center justify-start text-center gap-2 transition-all duration-200 shadow-2xs hover:shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                isDraggingCategories ? 'cursor-grabbing' : 'cursor-pointer'
              }`}
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-blue-50/90 border border-blue-100/90 text-blue-700 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 group-hover:scale-105 transition-all duration-200 flex items-center justify-center shrink-0">
                <CategoryIcon name={category.iconName} className="w-5 h-5 sm:w-[22px] sm:h-[22px]" />
              </div>
              <span className="text-[11px] sm:text-xs font-semibold text-slate-800 leading-tight line-clamp-2 min-h-[2em] flex items-center justify-center group-hover:text-blue-700 transition-colors">
                {lang === 'ar' ? category.nameAr : category.nameEn}
              </span>
              <span className="text-[10px] text-slate-400 tabular-nums">
                {categoryCounts[category.id] || 0} {copy.sections.productsCount}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* 4. Curated Product Collections (Featured / Best Sellers / New Arrivals / Offers) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">{copy.sections.showcaseTitle}</h2>

          {/* Interactive Segmented Control Tabs */}
          <div
            className="inline-flex items-center gap-1 p-1 bg-slate-200/60 rounded-xl overflow-x-auto no-scrollbar max-w-full"
            role="tablist"
          >
            {(
              [
                ['featured', copy.sections.tabs.featured],
                ['bestSellers', copy.sections.tabs.bestSellers],
                ['newArrivals', copy.sections.tabs.newArrivals],
                ['offers', copy.sections.tabs.offers],
              ] as [CollectionTab, string][]
            ).map(([tabKey, label]) => (
              <button
                key={tabKey}
                type="button"
                role="tab"
                aria-selected={activeTab === tabKey}
                onClick={() => setActiveTab(tabKey)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  activeTab === tabKey
                    ? 'bg-white text-blue-800 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {tabProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              lang={lang}
              onSelectProduct={onSelectProduct}
              onAddToCart={onAddToCart}
            />
          ))}
        </div>
      </section>

      {/* 5. Pharmacist Recommendations Strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="bg-[#EEF5FC] border border-blue-200/60 rounded-3xl p-5 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-5">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                {copy.sections.recommendationsTitle}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                {copy.sections.recommendationsSubtitle}
              </p>
            </div>
            <button
              type="button"
              onClick={onSelectAllCategories}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-blue-700 hover:text-blue-900 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{copy.sections.viewAllCategories}</span>
              <DirectionalArrow className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {pharmacistRecommendations.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                lang={lang}
                onSelectProduct={onSelectProduct}
                onAddToCart={onAddToCart}
              />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
};
