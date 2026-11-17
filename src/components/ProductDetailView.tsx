import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Heart,
  Minus,
  Plus,
  ShoppingBag,
  Star,
} from 'lucide-react';
import { CATEGORIES, PRODUCTS } from '../data/catalog';
import { t } from '../data/translations';
import { CategoryId, Language, Product } from '../types/pharmacy';
import { ProductCard } from './ProductCard';
import { SmartImage } from './SmartImage';

interface ProductDetailViewProps {
  product: Product;
  products?: Product[];
  lang: Language;
  isWishlisted: boolean;
  onToggleWishlist: (productId: string) => void;
  onAddToCart: (product: Product, quantity: number) => void;
  onSelectProduct: (product: Product) => void;
  onBackToCategory: (categoryId: CategoryId) => void;
  onBackHome: () => void;
  onOpenPrescription: () => void;
}

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({
  product,
  products = PRODUCTS,
  lang,
  isWishlisted,
  onToggleWishlist,
  onAddToCart,
  onSelectProduct,
  onBackToCategory,
  onBackHome,
  onOpenPrescription,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const copy = t(lang);
  const BackArrow = lang === 'ar' ? ArrowRight : ArrowLeft;

  const category = CATEGORIES.find((c) => c.id === product.categoryId);
  const name = lang === 'ar' ? product.nameAr : product.nameEn;
  const brand = lang === 'ar' ? product.brandAr : product.brandEn;
  const description = lang === 'ar' ? product.descriptionAr : product.descriptionEn;
  const categoryName = category ? (lang === 'ar' ? category.nameAr : category.nameEn) : '';

  const isOutOfStock = product.stockCount <= 0;
  const isLowStock = product.stockCount > 0 && product.stockCount <= 10;

  const discountPercent =
    product.originalPrice && product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : null;

  const relatedProducts = useMemo(() => {
    const sameCategory = products.filter(
      (p) => p.categoryId === product.categoryId && p.id !== product.id
    );
    const extras = products.filter(
      (p) => p.categoryId !== product.categoryId && p.isFeatured
    );
    return [...sameCategory, ...extras].slice(0, 4);
  }, [product, products]);

  const handleAdd = () => {
    if (isOutOfStock) return;
    onAddToCart(product, quantity);
    setAddedFeedback(true);
    window.setTimeout(() => setAddedFeedback(false), 1400);
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-14">
      {/* Breadcrumb Navigation */}
      <nav className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-500">
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-1.5 hover:text-blue-700 transition-colors cursor-pointer"
        >
          <BackArrow className="w-4 h-4" aria-hidden="true" />
          <span>{copy.nav.home}</span>
        </button>
        <span aria-hidden="true">/</span>
        <button
          type="button"
          onClick={() => onBackToCategory(product.categoryId)}
          className="hover:text-blue-700 transition-colors cursor-pointer"
        >
          {categoryName}
        </button>
        <span aria-hidden="true">/</span>
        <span className="text-slate-900 font-medium truncate max-w-xs">{name}</span>
      </nav>

      {/* Contiguous Purchase Module */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Sticky Gallery Column */}
        <div className="lg:col-span-6 lg:sticky lg:top-28">
          <div className="relative aspect-[4/3] w-full bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            <SmartImage src={product.image} alt={name} className="w-full h-full object-cover" />
            {discountPercent !== null && (
              <div className="absolute top-4 start-4 bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg tabular-nums">
                {copy.product.savePercent} {discountPercent}%
              </div>
            )}
          </div>
        </div>

        {/* Sticky Purchase & Specifications Module */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-5">
            {/* Unboxed Brand / SKU / Rating Metadata */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-blue-700">{brand}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular text-slate-500">
                {copy.product.sku}: {product.sku}
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-slate-700 font-medium tabular-nums">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                <span>{product.rating.toFixed(1)}</span>
                <span className="text-slate-400">
                  ({product.reviewCount} {copy.product.reviews})
                </span>
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug text-balance">
              {name}
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{description}</p>

            {/* Price & Discount */}
            <div className="pt-1 flex items-baseline flex-wrap gap-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-slate-900 tabular-nums">
                  {product.price}
                </span>
                <span className="text-xs sm:text-sm font-semibold text-slate-600">{copy.currency}</span>
              </div>
              {product.originalPrice && product.originalPrice > product.price && (
                <span className="text-sm text-slate-400 line-through tabular-nums">
                  {product.originalPrice} {copy.currency}
                </span>
              )}
            </div>

            {/* Available Quantity & Stock Status (Explicit Text + Icon) */}
            <div
              className={`flex items-center gap-2 text-sm font-medium px-3.5 py-2.5 rounded-xl border ${
                isOutOfStock
                  ? 'bg-rose-50/70 border-rose-200 text-rose-800'
                  : isLowStock
                    ? 'bg-amber-50/70 border-amber-200 text-amber-800'
                    : 'bg-blue-50/70 border-blue-200 text-blue-800'
              }`}
            >
              {isOutOfStock ? (
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              ) : (
                <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
              )}
              <span>
                {isOutOfStock
                  ? copy.product.outOfStock
                  : `${isLowStock ? copy.product.lowStock : copy.product.inStock} — ${product.stockCount} ${copy.product.unitsAvailable}`}
              </span>
            </div>

            {/* Prescription Notice if Applicable */}
            {product.requiresPrescription && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-sky-50 border border-sky-200 text-sky-900">
                <div className="flex items-start gap-2.5 text-xs sm:text-sm">
                  <FileText className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{copy.product.rxRequired}</span>
                </div>
                <button
                  type="button"
                  onClick={onOpenPrescription}
                  className="text-xs font-semibold text-sky-800 underline underline-offset-4 hover:text-sky-950 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copy.product.attachRxNow}
                </button>
              </div>
            )}

            {/* Quantity Stepper + Primary Add to Cart + Wishlist */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center border border-slate-300 rounded-xl bg-slate-50 h-12">
                <button
                  type="button"
                  disabled={isOutOfStock || quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-10 h-full flex items-center justify-center text-slate-700 hover:text-slate-900 disabled:opacity-40 cursor-pointer"
                  aria-label={lang === 'ar' ? 'إنقاص الكمية' : 'Decrease quantity'}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-10 text-center text-sm font-bold text-slate-900 tabular-nums">
                  {quantity}
                </span>
                <button
                  type="button"
                  disabled={isOutOfStock || quantity >= product.stockCount}
                  onClick={() => setQuantity((q) => Math.min(product.stockCount, q + 1))}
                  className="w-10 h-full flex items-center justify-center text-slate-700 hover:text-slate-900 disabled:opacity-40 cursor-pointer"
                  aria-label={lang === 'ar' ? 'زيادة الكمية' : 'Increase quantity'}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                disabled={isOutOfStock}
                onClick={handleAdd}
                className={`flex-1 min-w-[180px] h-12 px-6 rounded-xl inline-flex items-center justify-center gap-2 text-sm font-semibold transition-colors cursor-pointer ${
                  isOutOfStock
                    ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                    : addedFeedback
                      ? 'bg-blue-800 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                }`}
              >
                {addedFeedback ? (
                  <>
                    <Check className="w-4 h-4" aria-hidden="true" />
                    <span>{copy.product.added}</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" aria-hidden="true" />
                    <span>{isOutOfStock ? copy.product.outOfStock : copy.product.addToCart}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => onToggleWishlist(product.id)}
                className={`h-12 px-4 rounded-xl border inline-flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  isWishlisted
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
                aria-label={isWishlisted ? copy.product.savedWishlist : copy.product.saveWishlist}
                title={isWishlisted ? copy.product.savedWishlist : copy.product.saveWishlist}
              >
                <Heart
                  className={`w-4 h-4 ${isWishlisted ? 'fill-rose-600 text-rose-600' : ''}`}
                />
              </button>
            </div>
          </div>

          {/* Product Specifications Table */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8">
            <h2 className="text-lg font-bold text-slate-900 mb-4">{copy.product.specsTitle}</h2>
            <dl className="divide-y divide-slate-100 text-sm">
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-slate-500">{copy.product.brand}</dt>
                <dd className="font-semibold text-slate-900 text-end">{brand}</dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-slate-500">{copy.product.category}</dt>
                <dd className="font-semibold text-slate-900 text-end">{categoryName}</dd>
              </div>
              {product.specs.map((spec, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between gap-4">
                  <dt className="text-slate-500">
                    {lang === 'ar' ? spec.labelAr : spec.labelEn}
                  </dt>
                  <dd className="font-semibold text-slate-900 text-end tabular-nums">
                    {lang === 'ar' ? spec.valueAr : spec.valueEn}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Related Products & Recommendations */}
      <section className="space-y-6 pt-4 border-t border-slate-200">
        <h2 className="text-2xl font-bold text-slate-900">{copy.product.relatedTitle}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {relatedProducts.map((rel) => (
            <ProductCard
              key={rel.id}
              product={rel}
              lang={lang}
              onSelectProduct={(p) => {
                setQuantity(1);
                onSelectProduct(p);
              }}
              onAddToCart={(p) => onAddToCart(p, 1)}
            />
          ))}
        </div>
      </section>
    </main>
  );
};
