import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  ImagePlus,
  Package,
  PackagePlus,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { CATEGORIES } from '../data/catalog';
import { createCustomProduct, deleteCustomProduct } from '../services/productCatalogApi';
import { CategoryId, Language, Product } from '../types/pharmacy';
import { SmartImage } from './SmartImage';
import { normalizeDigits } from './WelcomeGate';

interface StaffAddProductModalProps {
  isOpen: boolean;
  lang: Language;
  customProducts: Product[];
  onClose: () => void;
  onProductAdded: (product: Product) => void;
  onProductDeleted: (productId: string) => void;
  onAuthRequired: () => void;
}

export const StaffAddProductModal: React.FC<StaffAddProductModalProps> = ({
  isOpen,
  lang,
  customProducts,
  onClose,
  onProductAdded,
  onProductDeleted,
  onAuthRequired,
}) => {
  const isAr = lang === 'ar';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<'create' | 'manage'>('create');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [brandAr, setBrandAr] = useState('');
  const [categoryId, setCategoryId] = useState<CategoryId>('medicines');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [stockCount, setStockCount] = useState('20');
  const [sku, setSku] = useState('');
  const [shortDescAr, setShortDescAr] = useState('');
  const [requiresPrescription, setRequiresPrescription] = useState(false);
  const [isOffer, setIsOffer] = useState(false);
  const [isFeatured, setIsFeatured] = useState(true);
  const [imageBase64, setImageBase64] = useState<string | undefined>(undefined);
  const [imageFileName, setImageFileName] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successProduct, setSuccessProduct] = useState<Product | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setNameAr('');
    setNameEn('');
    setBrandAr('');
    setPrice('');
    setOriginalPrice('');
    setStockCount('20');
    setSku('');
    setShortDescAr('');
    setRequiresPrescription(false);
    setIsOffer(false);
    setIsFeatured(true);
    setImageBase64(undefined);
    setImageFileName(null);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 4.5 * 1024 * 1024) {
      setErrorMsg(
        isAr
          ? 'حجم الصورة يجب أن يكون أقل من 4.5 ميجابايت.'
          : 'Image size must be under 4.5 MB.'
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageBase64(reader.result);
        setImageFileName(file.name);
        setErrorMsg(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const cleanName = nameAr.trim();
    const parsedPrice = Number(normalizeDigits(price).trim());
    const parsedOriginal = originalPrice.trim()
      ? Number(normalizeDigits(originalPrice).trim())
      : undefined;
    const parsedStock = stockCount.trim()
      ? Math.max(0, Math.floor(Number(normalizeDigits(stockCount).trim())))
      : 20;

    if (cleanName.length < 2) {
      setErrorMsg(
        isAr ? 'يرجى إدخال اسم الدواء أو الصنف.' : 'Please enter the product or medicine name.'
      );
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setErrorMsg(
        isAr ? 'يرجى إدخال سعر بيع صحيح أكبر من صفر.' : 'Please enter a valid positive price.'
      );
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessProduct(null);

    try {
      const created = await createCustomProduct({
        nameAr: cleanName,
        nameEn: nameEn.trim() || undefined,
        brandAr: brandAr.trim() || undefined,
        categoryId,
        price: parsedPrice,
        originalPrice:
          parsedOriginal !== undefined && Number.isFinite(parsedOriginal) && parsedOriginal > parsedPrice
            ? parsedOriginal
            : undefined,
        stockCount: Number.isFinite(parsedStock) ? parsedStock : 20,
        sku: sku.trim() || undefined,
        shortDescAr: shortDescAr.trim() || undefined,
        requiresPrescription,
        isOffer: isOffer || (parsedOriginal !== undefined && parsedOriginal > parsedPrice),
        isFeatured,
        imageBase64,
      });

      onProductAdded(created);
      setSuccessProduct(created);
      resetForm();
    } catch (err) {
      if (err instanceof Error && err.message === 'STAFF_AUTH_REQUIRED') {
        onClose();
        onAuthRequired();
      } else {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : isAr
              ? 'تعذر حفظ الصنف، يرجى المحاولة مرة أخرى.'
              : 'Failed to save item.'
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    setErrorMsg(null);
    try {
      await deleteCustomProduct(id);
      onProductDeleted(id);
    } catch (err) {
      if (err instanceof Error && err.message === 'STAFF_AUTH_REQUIRED') {
        onClose();
        onAuthRequired();
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to delete item');
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="relative z-10 w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[92vh]"
        role="dialog"
        aria-modal="true"
        aria-label={isAr ? 'إضافة الأصناف والأدوية يدوياً' : 'Add Medicines & Products Manually'}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <PackagePlus className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isAr ? 'إضافة الأصناف والأدوية يدوياً' : 'Add Medicines & Products Manually'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isAr
                  ? 'أضف أي دواء أو مستحضر ليظهر فوراً للعملاء في المتجر والبحث'
                  : 'Publish new medicines or retail items directly to the storefront'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 cursor-pointer"
            aria-label={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="px-5 pt-3 border-b border-slate-100 flex items-center gap-2 bg-white">
          <button
            type="button"
            onClick={() => setTab('create')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              tab === 'create'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isAr ? 'إضافة صنف جديد' : 'Add New Product'}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('manage')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              tab === 'manage'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              {isAr
                ? `الأصناف المضافة (${customProducts.length})`
                : `Added Items (${customProducts.length})`}
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-medium text-rose-700"
            >
              {errorMsg}
            </div>
          )}

          {tab === 'create' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {successProduct && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs text-emerald-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                    <span>
                      {isAr
                        ? `تمت إضافة "${successProduct.nameAr}" وعرضه للبيع في الصيدلية.`
                        : `"${successProduct.nameEn}" is now live in the store catalog.`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab('manage')}
                    className="font-semibold underline hover:no-underline shrink-0 cursor-pointer"
                  >
                    {isAr ? 'عرض المضاف' : 'View List'}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    {isAr ? 'اسم الدواء / الصنف (عربي) *' : 'Product / Medicine Name (AR) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    placeholder={isAr ? 'مثال: بنادول إكسترا ٢٤ قرص' : 'e.g. Panadol Extra 24 Tablets'}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    {isAr ? 'الاسم بالإنجليزية (اختياري)' : 'English Name (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder="e.g. Panadol Extra 24 Tablets"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    {isAr ? 'القسم / التصنيف *' : 'Department / Category *'}
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value as CategoryId)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white cursor-pointer"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {isAr ? cat.nameAr : cat.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    {isAr ? 'الشركة المصنعة (اختياري)' : 'Brand / Manufacturer (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={brandAr}
                    onChange={(e) => setBrandAr(e.target.value)}
                    placeholder={isAr ? 'مثال: جلاكسو سميث كلاين' : 'e.g. GSK / Pfizer'}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    {isAr ? 'السعر (ج.م) *' : 'Price (EGP) *'}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="120"
                    className="w-full px-3 py-2 text-xs sm:text-sm font-mono-tabular bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    {isAr ? 'قبل الخصم' : 'Was Price'}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(e.target.value)}
                    placeholder="150"
                    className="w-full px-3 py-2 text-xs sm:text-sm font-mono-tabular bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    {isAr ? 'الكمية بالمخزون' : 'Stock Qty'}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={stockCount}
                    onChange={(e) => setStockCount(e.target.value)}
                    placeholder="20"
                    className="w-full px-3 py-2 text-xs sm:text-sm font-mono-tabular bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    {isAr ? 'الباركود / الكود' : 'Barcode / SKU'}
                  </label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="622..."
                    className="w-full px-3 py-2 text-xs sm:text-sm font-mono-tabular bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  {isAr ? 'وصف مختصر / الاستخدام (اختياري)' : 'Short Description (Optional)'}
                </label>
                <textarea
                  rows={2}
                  value={shortDescAr}
                  onChange={(e) => setShortDescAr(e.target.value)}
                  placeholder={
                    isAr
                      ? 'مثال: مسكن فعال للصداع وارتفاع الحرارة وآلام الجسم...'
                      : 'Brief clinical or usage summary...'
                  }
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              {/* Optional Product Image Upload */}
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {imageBase64 ? (
                    <img
                      src={imageBase64}
                      alt={nameAr || 'Preview'}
                      className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 text-blue-600 flex items-center justify-center shrink-0">
                      <ImagePlus className="w-5 h-5" aria-hidden="true" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">
                      {imageFileName || (isAr ? 'صورة العبوة (اختياري)' : 'Product Image (Optional)')}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {isAr
                        ? 'في حالة عدم الرفع سيتم استخدام صورة القسم المناسبة تلقائياً'
                        : 'Uses the matching category image automatically if skipped'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-blue-300 text-xs font-semibold text-blue-700 cursor-pointer"
                  >
                    {imageBase64
                      ? isAr
                        ? 'تغيير الصورة'
                        : 'Change Photo'
                      : isAr
                        ? 'اختيار صورة'
                        : 'Choose Photo'}
                  </button>
                  {imageBase64 && (
                    <button
                      type="button"
                      onClick={() => {
                        setImageBase64(undefined);
                        setImageFileName(null);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs text-rose-600 hover:bg-rose-50 cursor-pointer"
                    >
                      {isAr ? 'إزالة' : 'Remove'}
                    </button>
                  )}
                </div>
              </div>

              {/* Options */}
              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-700">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requiresPrescription}
                    onChange={(e) => setRequiresPrescription(e.target.checked)}
                    className="w-4 h-4 accent-blue-600 rounded"
                  />
                  <span>{isAr ? 'يتطلب روشتة طبية' : 'Requires Prescription'}</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOffer}
                    onChange={(e) => setIsOffer(e.target.checked)}
                    className="w-4 h-4 accent-blue-600 rounded"
                  />
                  <span>{isAr ? 'عرض ضمن العروض الخاصة' : 'List in Special Offers'}</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    className="w-4 h-4 accent-blue-600 rounded"
                  />
                  <span>{isAr ? 'إبراز بالصفحة الرئيسية' : 'Feature on Home'}</span>
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 min-h-[40px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  {isAr ? 'إغلاق' : 'Close'}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-5 py-2 min-h-[40px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs sm:text-sm font-semibold cursor-pointer shadow-xs"
                >
                  <PackagePlus className="w-4 h-4" aria-hidden="true" />
                  <span>
                    {isSaving
                      ? isAr
                        ? 'جاري الحفظ...'
                        : 'Publishing...'
                      : isAr
                        ? 'حفظ وعرض للبيع'
                        : 'Publish for Sale'}
                  </span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {customProducts.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                    <Package className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">
                    {isAr
                      ? 'لا توجد أصناف مضافة يدوياً حتى الآن.'
                      : 'No manually added products yet.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setTab('create')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{isAr ? 'إضافة أول صنف' : 'Add First Item'}</span>
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden">
                  {customProducts.map((item) => {
                    const cat = CATEGORIES.find((c) => c.id === item.categoryId);
                    return (
                      <li
                        key={item.id}
                        className="p-3 bg-white flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                            <SmartImage
                              src={item.image}
                              alt={isAr ? item.nameAr : item.nameEn}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {isAr ? item.nameAr : item.nameEn}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {cat ? (isAr ? cat.nameAr : cat.nameEn) : item.categoryId} ·{' '}
                              <span className="font-mono-tabular">{item.sku}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-end">
                            <p className="text-xs font-bold text-blue-700 font-mono-tabular">
                              {item.price} {isAr ? 'ج.م' : 'EGP'}
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono-tabular">
                              {isAr ? `متوفر: ${item.stockCount}` : `Qty: ${item.stockCount}`}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={deletingId === item.id}
                            onClick={() => void handleDelete(item.id)}
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            aria-label={isAr ? 'حذف الصنف' : 'Delete item'}
                            title={isAr ? 'حذف الصنف' : 'Delete item'}
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
