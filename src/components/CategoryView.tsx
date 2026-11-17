import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { CATEGORIES, PRODUCTS } from '../data/catalog';
import { t } from '../data/translations';
import { CategoryId, Language, PriceRangeFilter, Product, SortOption } from '../types/pharmacy';
import { CategoryIcon } from './CategoryIcon';
import { ProductCard } from './ProductCard';

interface CategoryViewProps {
  lang: Language;
  products?: Product[];
  selectedCategoryId: CategoryId | 'all' | 'offers';
  onChangeCategory: (id: CategoryId | 'all' | 'offers') => void;
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onBackHome: () => void;
}

export const CategoryView: React.FC<CategoryViewProps> = ({
  lang,
  products = PRODUCTS,
  selectedCategoryId,
  onChangeCategory,
  onSelectProduct,
  onAddToCart,
  onBackHome,
}) => {
  const [localSearch, setLocalSearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [priceRange, setPriceRange] = useState<PriceRangeFilter>('all');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [offersOnly, setOffersOnly] = useState(selectedCategoryId === 'offers');
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const copy = t(lang);
  const BackArrow = lang === 'ar' ? ArrowRight : ArrowLeft;

  const activeCategory = useMemo(
    () => CATEGORIES.find((c) => c.id === selectedCategoryId) || null,
    [selectedCategoryId]
  );

  const baseProducts = useMemo(() => {
    if (selectedCategoryId === 'all') return products;
    if (selectedCategoryId === 'offers') {
      return products.filter(
        (p) => p.isOffer || (p.originalPrice && p.originalPrice > p.price)
      );
    }
    return products.filter((p) => p.categoryId === selectedCategoryId);
  }, [selectedCategoryId, products]);

  const availableBrands = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of baseProducts) {
      map.set(p.brandEn, lang === 'ar' ? p.brandAr : p.brandEn);
    }
    return Array.from(map.entries());
  }, [baseProducts, lang]);

  const filteredProducts = useMemo(() => {
    const q = localSearch.trim().toLowerCase();
    const list = baseProducts.filter((p) => {
      if (q) {
        const matches =
          p.nameAr.toLowerCase().includes(q) ||
          p.nameEn.toLowerCase().includes(q) ||
          p.brandAr.toLowerCase().includes(q) ||
          p.brandEn.toLowerCase().includes(q) ||
          p.shortDescAr.toLowerCase().includes(q) ||
          p.shortDescEn.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (selectedBrand !== 'all' && p.brandEn !== selectedBrand) return false;
      if (priceRange === 'under-200' && p.price >= 200) return false;
      if (priceRange === '200-500' && (p.price < 200 || p.price > 500)) return false;
      if (priceRange === 'over-500' && p.price <= 500) return false;
      if (inStockOnly && p.stockCount <= 0) return false;
      if (offersOnly && !(p.isOffer || (p.originalPrice && p.originalPrice > p.price))) {
        return false;
      }
      return true;
    });

    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'price-asc':
          return a.price - b.price;
        case 'price-desc':
          return b.price - a.price;
        case 'best-selling':
          return (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0) || b.reviewCount - a.reviewCount;
        case 'newest':
          return (b.isNewArrival ? 1 : 0) - (a.isNewArrival ? 1 : 0);
        case 'featured':
        default:
          return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
      }
    });
    return sorted;
  }, [baseProducts, localSearch, selectedBrand, priceRange, inStockOnly, offersOnly, sortBy]);

  const handleResetFilters = () => {
    setLocalSearch('');
    setSelectedBrand('all');
    setPriceRange('all');
    setInStockOnly(false);
    setOffersOnly(selectedCategoryId === 'offers');
    setSortBy('featured');
  };

  const handleCategorySwitch = (id: CategoryId | 'all' | 'offers') => {
    setSelectedBrand('all');
    setLocalSearch('');
    setOffersOnly(id === 'offers');
    onChangeCategory(id);
  };

  const pageTitle =
    selectedCategoryId === 'all'
      ? copy.nav.allProducts
      : selectedCategoryId === 'offers'
        ? copy.sections.tabs.offers
        : activeCategory
          ? lang === 'ar'
            ? activeCategory.nameAr
            : activeCategory.nameEn
          : copy.nav.categories;

  const pageDescription =
    selectedCategoryId === 'all'
      ? copy.sections.categoriesSubtitle
      : selectedCategoryId === 'offers'
        ? copy.sections.promosSubtitle
        : activeCategory
          ? lang === 'ar'
            ? activeCategory.descriptionAr
            : activeCategory.descriptionEn
          : '';

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      {/* Breadcrumb & Category Header */}
      <div className="space-y-4">
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-700 transition-colors cursor-pointer"
        >
          <BackArrow className="w-4 h-4" aria-hidden="true" />
          <span>{copy.product.backToHome}</span>
        </button>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              {activeCategory ? (
                <CategoryIcon name={activeCategory.iconName} className="w-5 h-5" />
              ) : (
                <SlidersHorizontal className="w-5 h-5" />
              )}
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900">{pageTitle}</h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5 max-w-2xl">{pageDescription}</p>
            </div>
          </div>

          <div className="text-xs sm:text-sm text-slate-500 tabular-nums whitespace-nowrap shrink-0">
            {copy.categoryPage.showing}{' '}
            <span className="font-semibold text-slate-900">{filteredProducts.length}</span>{' '}
            {copy.categoryPage.of}{' '}
            <span className="font-semibold text-slate-900">{baseProducts.length}</span>{' '}
            {copy.sections.productsCount}
          </div>
        </div>
      </div>

      {/* Horizontal Category Switcher Bar */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          type="button"
          onClick={() => handleCategorySwitch('all')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border transition-colors cursor-pointer ${
            selectedCategoryId === 'all'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
          }`}
        >
          {copy.nav.allProducts}
        </button>
        <button
          type="button"
          onClick={() => handleCategorySwitch('offers')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border transition-colors cursor-pointer ${
            selectedCategoryId === 'offers'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
          }`}
        >
          {copy.nav.offers}
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => handleCategorySwitch(cat.id)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border transition-colors cursor-pointer ${
              selectedCategoryId === cat.id
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
            }`}
          >
            <CategoryIcon name={cat.iconName} className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? cat.nameAr : cat.nameEn}</span>
          </button>
        ))}
      </div>

      {/* Filters Sidebar + Product Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Filter Panel */}
        <aside className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-5 space-y-6">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">{copy.categoryPage.filtersTitle}</h2>
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{copy.categoryPage.resetFilters}</span>
            </button>
          </div>

          {/* Search within category */}
          <div className="space-y-2">
            <div className="relative">
              <Search
                className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3"
                aria-hidden="true"
              />
              <input
                type="search"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder={copy.categoryPage.searchInCategory}
                className="w-full ps-9 pe-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Brand Filter */}
          <div className="space-y-2">
            <label
              htmlFor="brand-filter"
              className="block text-xs font-semibold text-slate-700"
            >
              {copy.categoryPage.brandFilter}
            </label>
            <select
              id="brand-filter"
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-600"
            >
              <option value="all">{copy.categoryPage.allBrands}</option>
              {availableBrands.map(([brandKey, brandLabel]) => (
                <option key={brandKey} value={brandKey}>
                  {brandLabel}
                </option>
              ))}
            </select>
          </div>

          {/* Price Range */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold text-slate-700">
              {copy.categoryPage.priceFilter}
            </span>
            <div className="space-y-1.5">
              {(
                [
                  ['all', copy.categoryPage.priceAll],
                  ['under-200', copy.categoryPage.priceUnder200],
                  ['200-500', copy.categoryPage.price200To500],
                  ['over-500', copy.categoryPage.priceOver500],
                ] as [PriceRangeFilter, string][]
              ).map(([rangeKey, label]) => (
                <label
                  key={rangeKey}
                  className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer py-1"
                >
                  <input
                    type="radio"
                    name="priceRange"
                    checked={priceRange === rangeKey}
                    onChange={() => setPriceRange(rangeKey)}
                    className="accent-blue-600"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="w-4 h-4 accent-blue-600 rounded"
              />
              <span>{copy.categoryPage.inStockOnly}</span>
            </label>
            <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={offersOnly}
                onChange={(e) => setOffersOnly(e.target.checked)}
                className="w-4 h-4 accent-blue-600 rounded"
              />
              <span>{copy.categoryPage.offersOnly}</span>
            </label>
          </div>
        </aside>

        {/* Sort Toolbar & Product Grid */}
        <div className="lg:col-span-9 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3">
            <span className="text-xs font-medium text-slate-600 tabular-nums">
              {filteredProducts.length} {copy.sections.productsCount}
            </span>

            <div className="flex items-center gap-2">
              <label htmlFor="sort-select" className="text-xs font-medium text-slate-500">
                {copy.categoryPage.sortBy}:
              </label>
              <select
                id="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-600"
              >
                <option value="featured">{copy.categoryPage.sortOptions.featured}</option>
                <option value="best-selling">{copy.categoryPage.sortOptions['best-selling']}</option>
                <option value="price-asc">{copy.categoryPage.sortOptions['price-asc']}</option>
                <option value="price-desc">{copy.categoryPage.sortOptions['price-desc']}</option>
                <option value="newest">{copy.categoryPage.sortOptions.newest}</option>
              </select>
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
              <p className="text-sm font-medium text-slate-700">{copy.categoryPage.emptyResults}</p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
              >
                {copy.categoryPage.resetFilters}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  lang={lang}
                  onSelectProduct={onSelectProduct}
                  onAddToCart={onAddToCart}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
};
