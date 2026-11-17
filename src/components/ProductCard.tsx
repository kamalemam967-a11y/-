import React, { useState } from 'react';
import { Check, FileText, ShoppingBag, AlertCircle } from 'lucide-react';
import { Language, Product } from '../types/pharmacy';
import { t } from '../data/translations';
import { SmartImage } from './SmartImage';

interface ProductCardProps {
  product: Product;
  lang: Language;
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  lang,
  onSelectProduct,
  onAddToCart,
}) => {
  const [justAdded, setJustAdded] = useState(false);
  const copy = t(lang);

  const name = lang === 'ar' ? product.nameAr : product.nameEn;
  const brand = lang === 'ar' ? product.brandAr : product.brandEn;
  const shortDesc = lang === 'ar' ? product.shortDescAr : product.shortDescEn;

  const isOutOfStock = product.stockCount <= 0;
  const isLowStock = product.stockCount > 0 && product.stockCount <= 10;

  const discountPercent =
    product.originalPrice && product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : null;

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOutOfStock) return;
    onAddToCart(product);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1200);
  };

  return (
    <article
      onClick={() => onSelectProduct(product)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelectProduct(product);
        }
      }}
      tabIndex={0}
      role="button"
      className="group flex flex-col h-full bg-white rounded-2xl border border-slate-200/90 overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-blue-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 text-start"
    >
      {/* Image area taking ~65% visual weight on clean neutral backdrop */}
      <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden">
        <SmartImage
          src={product.image}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {discountPercent !== null && (
          <div className="absolute top-3 start-3 bg-blue-700 text-white text-xs font-semibold px-2.5 py-1 rounded-md tabular-nums">
            {copy.product.savePercent} {discountPercent}%
          </div>
        )}
      </div>

      {/* Content area with strict uniform field order */}
      <div className="flex flex-col flex-1 p-3.5 sm:p-4">
        {/* Unboxed metadata row with typographic separator */}
        <div className="flex items-center flex-wrap gap-1.5 text-[11px] text-slate-500 mb-1">
          <span className="font-medium text-slate-600 truncate max-w-[130px]">{brand}</span>
          <span aria-hidden="true">·</span>
          <span
            className={`inline-flex items-center gap-1 font-medium ${
              isOutOfStock
                ? 'text-rose-700'
                : isLowStock
                  ? 'text-amber-700'
                  : 'text-blue-700'
            }`}
          >
            {isOutOfStock ? (
              <AlertCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
            ) : (
              <Check className="w-3 h-3 shrink-0" aria-hidden="true" />
            )}
            <span>
              {isOutOfStock
                ? copy.product.outOfStock
                : isLowStock
                  ? copy.product.lowStock
                  : copy.product.inStock}
            </span>
          </span>
          {product.requiresPrescription && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-sky-700 font-medium">
                <FileText className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span>Rx</span>
              </span>
            </>
          )}
        </div>

        {/* Product Title */}
        <h3 className="text-[13px] sm:text-sm font-semibold text-slate-800 leading-snug line-clamp-2 mb-1 group-hover:text-blue-700 transition-colors">
          {name}
        </h3>

        {/* Short Description */}
        <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mb-3 flex-1">
          {shortDesc}
        </p>

        {/* Price & Action Baseline */}
        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2.5 mt-auto">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1">
              <span className="text-sm sm:text-[15px] font-bold text-slate-900 tabular-nums">
                {product.price}
              </span>
              <span className="text-[11px] font-medium text-slate-500">{copy.currency}</span>
            </div>
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="text-[11px] text-slate-400 line-through tabular-nums">
                {product.originalPrice} {copy.currency}
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={isOutOfStock}
            onClick={handleAdd}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-xl text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              isOutOfStock
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : justAdded
                  ? 'bg-blue-800 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {justAdded ? (
              <>
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{copy.product.added}</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isOutOfStock ? copy.product.outOfStock : copy.product.addToCart}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
};
