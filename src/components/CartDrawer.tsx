import React, { useEffect, useRef, useState } from 'react';
import {
  Award,
  Camera,
  CheckCircle2,
  FileText,
  FileUp,
  Minus,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { t } from '../data/translations';
import {
  getMaxRedeemablePoints,
  POINTS_STEP,
  pointsToEgpDiscount,
  previewEarnedPoints,
  recordLoyaltyOrder,
} from '../services/loyaltyApi';
import {
  createPrescriptionOrder,
  fileToStagedUpload,
  formatFileSize,
  MAX_FILES_PER_ORDER,
  StagedUploadFile,
} from '../services/prescriptionApi';
import {
  CartItem,
  Language,
  OrderReceipt,
  PrescriptionSubmission,
  UserLoyaltyProfile,
} from '../types/pharmacy';
import { PrescriptionCameraModal } from './PrescriptionCameraModal';
import { PrescriptionStatusIndicator } from './PrescriptionStatusBadge';
import { SmartImage } from './SmartImage';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  items: CartItem[];
  onUpdateQuantity: (productId: string, delta: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onBrowseCatalog: () => void;
  onPrescriptionCreated?: (submission: PrescriptionSubmission) => void;
  loyaltyProfile?: UserLoyaltyProfile | null;
  onLoyaltyUpdated?: (updated: UserLoyaltyProfile) => void;
}

const FREE_DELIVERY_THRESHOLD = 500;
const DELIVERY_FEE = 35;

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  lang,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onBrowseCatalog,
  onPrescriptionCreated,
  loyaltyProfile,
  onLoyaltyUpdated,
}) => {
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState(false);
  const [step, setStep] = useState<'cart' | 'checkout' | 'receipt'>('cart');

  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'card'>('cod');
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);

  const [showOptionalRx, setShowOptionalRx] = useState(false);
  const [stagedRxFiles, setStagedRxFiles] = useState<StagedUploadFile[]>([]);
  const [existingRxId, setExistingRxId] = useState('');
  const [rxUploadError, setRxUploadError] = useState<string | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const rxInputRef = useRef<HTMLInputElement>(null);

  const copy = t(lang);
  const hasRxItem = items.some((item) => item.product.requiresPrescription);

  // Pre-fill saved profile details into empty checkout fields
  useEffect(() => {
    if (isOpen && loyaltyProfile) {
      setCustomerName((prev) => prev || loyaltyProfile.fullName || '');
      setPhone((prev) => prev || loyaltyProfile.phone || '');
      setAddress((prev) => prev || loyaltyProfile.address || '');
    }
  }, [isOpen, loyaltyProfile]);

  if (!isOpen) return null;

  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const discount = promoApplied ? Math.round(subtotal * 0.1) : 0;
  const discountedSubtotal = Math.max(0, subtotal - discount);
  const maxRedeemable = getMaxRedeemablePoints(
    loyaltyProfile?.pointsBalance ?? 0,
    discountedSubtotal
  );
  const activeRedeemPoints = Math.min(redeemPoints, maxRedeemable);
  const loyaltyDiscount = pointsToEgpDiscount(activeRedeemPoints);
  const netAfterLoyalty = Math.max(0, discountedSubtotal - loyaltyDiscount);
  const deliveryFee =
    items.length === 0 || discountedSubtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const total = netAfterLoyalty + deliveryFee;
  const estimatedPointsToEarn = previewEarnedPoints(
    netAfterLoyalty,
    loyaltyProfile?.lifetimeEarned ?? 0
  );
  const remainingForFreeDelivery = Math.max(0, FREE_DELIVERY_THRESHOLD - discountedSubtotal);
  const progressPercent = Math.min(100, (discountedSubtotal / FREE_DELIVERY_THRESHOLD) * 100);

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (promoCode.trim().toUpperCase() === 'CARE10') {
      setPromoApplied(true);
      setPromoError(false);
    } else {
      setPromoApplied(false);
      setPromoError(true);
    }
  };

  const handleCheckoutRxFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setRxUploadError(null);
    const incoming = Array.from(fileList);
    if (stagedRxFiles.length + incoming.length > MAX_FILES_PER_ORDER) {
      setRxUploadError(copy.prescription.fileLimitError);
      return;
    }
    const next: StagedUploadFile[] = [];
    for (const file of incoming) {
      try {
        next.push(await fileToStagedUpload(file));
      } catch (err) {
        const code = err instanceof Error ? err.message : '';
        setRxUploadError(
          code === 'FILE_TOO_LARGE'
            ? copy.prescription.fileLimitError
            : copy.prescription.fileTypeError
        );
      }
    }
    if (next.length > 0) {
      setStagedRxFiles((prev) => [...prev, ...next].slice(0, MAX_FILES_PER_ORDER));
    }
    e.target.value = '';
  };

  const handleCheckoutCameraCapture = async (file: File) => {
    setRxUploadError(null);
    if (stagedRxFiles.length >= MAX_FILES_PER_ORDER) {
      setRxUploadError(copy.prescription.fileLimitError);
      return;
    }
    try {
      const staged = await fileToStagedUpload(file);
      setStagedRxFiles((prev) => [...prev, staged].slice(0, MAX_FILES_PER_ORDER));
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      setRxUploadError(
        code === 'FILE_TOO_LARGE'
          ? copy.prescription.fileLimitError
          : copy.prescription.fileTypeError
      );
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !phone.trim() || !address.trim() || isPlacingOrder) return;

    setIsPlacingOrder(true);
    setRxUploadError(null);

    const orderNumber = `MAR-${Math.floor(10000 + Math.random() * 90000)}`;
    let linkedPrescriptionId = existingRxId.trim() || undefined;
    let linkedPrescriptionStatus: OrderReceipt['prescriptionStatus'];
    let uploadedFilesCount: number | undefined;

    try {
      if (stagedRxFiles.length > 0) {
        const createdRx = await createPrescriptionOrder({
          patientName: customerName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          notes: `Attached during cart checkout for order #${orderNumber}`,
          linkedOrderNumber: orderNumber,
          linkedItems: items.map(({ product, quantity }) => ({
            productId: product.id,
            sku: product.sku,
            nameAr: product.nameAr,
            nameEn: product.nameEn,
            quantity,
            price: product.price,
            requiresPrescription: product.requiresPrescription,
          })),
          files: stagedRxFiles.map(({ name, mimeType, size, base64Data }) => ({
            name,
            mimeType,
            size,
            base64Data,
          })),
        });
        linkedPrescriptionId = createdRx.id;
        linkedPrescriptionStatus = createdRx.status;
        uploadedFilesCount = createdRx.files.length;
        onPrescriptionCreated?.(createdRx);
      }

      let pointsRedeemed = 0;
      let pointsDiscount = 0;
      let pointsEarned = estimatedPointsToEarn;
      let newPointsBalance = loyaltyProfile?.pointsBalance;

      try {
        const loyaltyRes = await recordLoyaltyOrder({
          orderNumber,
          customerName: customerName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          subtotalPaidAfterDiscounts: discountedSubtotal,
          redeemPoints: activeRedeemPoints,
        });
        pointsRedeemed = loyaltyRes.pointsRedeemed;
        pointsDiscount = loyaltyRes.pointsDiscount;
        pointsEarned = loyaltyRes.pointsEarned;
        newPointsBalance = loyaltyRes.profile.pointsBalance;
        onLoyaltyUpdated?.(loyaltyRes.profile);
      } catch {
        // allow checkout confirmation even if loyalty endpoint has transient failure
      }

      const newReceipt: OrderReceipt = {
        orderNumber,
        customerName: customerName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        paymentMethod,
        items: [...items],
        subtotal,
        discount: discount + pointsDiscount,
        deliveryFee,
        total: Math.max(0, discountedSubtotal - pointsDiscount) + deliveryFee,
        createdAt: new Date().toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US'),
        prescriptionId: linkedPrescriptionId,
        prescriptionStatus: linkedPrescriptionStatus,
        uploadedFilesCount,
        pointsRedeemed,
        pointsDiscount,
        pointsEarned,
        newPointsBalance,
      };
      setReceipt(newReceipt);
      setStep('receipt');
      onClearCart();
      setPromoApplied(false);
      setPromoCode('');
      setRedeemPoints(0);
      setStagedRxFiles([]);
      setExistingRxId('');
      setShowOptionalRx(false);
    } catch (err) {
      setRxUploadError(err instanceof Error ? err.message : copy.prescription.submitError);
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleResetAndClose = () => {
    setStep('cart');
    setReceipt(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs"
        onClick={handleResetAndClose}
        aria-hidden="true"
      />

      {/* Drawer Panel (respects RTL start/end naturally via flex justify-end) */}
      <aside
        className="relative z-10 w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-s border-slate-200"
        aria-label={copy.cart.title}
      >
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-slate-200/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-blue-700" aria-hidden="true" />
            <h2 className="text-base font-bold text-slate-900">
              {step === 'checkout'
                ? copy.cart.checkoutTitle
                : step === 'receipt'
                  ? copy.cart.orderSuccessTitle
                  : copy.cart.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
            aria-label={lang === 'ar' ? 'إغلاق السلة' : 'Close cart'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {step === 'receipt' && receipt ? (
            <div className="space-y-6 py-4">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">{copy.cart.orderSuccessTitle}</h3>
                <p className="text-xs text-slate-600">
                  {copy.cart.orderNumber}:{' '}
                  <span className="font-mono-tabular font-bold text-blue-800">
                    #{receipt.orderNumber}
                  </span>
                </p>
                <p className="text-sm text-slate-600 leading-relaxed">{copy.cart.orderSuccessDesc}</p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs sm:text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">{copy.cart.fullName}</span>
                  <span className="font-semibold text-slate-900">{receipt.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{copy.cart.phone}</span>
                  <span className="font-semibold text-slate-900 tabular-nums">{receipt.phone}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500 shrink-0">{copy.cart.address}</span>
                  <span className="font-semibold text-slate-900 text-end">{receipt.address}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                  <span>{copy.cart.total}</span>
                  <span className="tabular-nums">
                    {receipt.total} {copy.currency}
                  </span>
                </div>
              </div>

              {(receipt.pointsEarned || receipt.pointsRedeemed) && (
                <div className="bg-blue-50/75 border border-blue-200/80 rounded-2xl p-4 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-blue-900">
                    <Award className="w-4 h-4 text-blue-700" aria-hidden="true" />
                    <span>{copy.loyalty.pageTitle}</span>
                  </div>
                  {receipt.pointsRedeemed ? (
                    <div className="flex justify-between text-slate-700">
                      <span>{copy.cart.loyaltyPointsSavedReceipt}</span>
                      <span className="font-mono-tabular font-semibold">
                        -{receipt.pointsRedeemed} {copy.loyalty.pointsUnit} (-{receipt.pointsDiscount}{' '}
                        {copy.currency})
                      </span>
                    </div>
                  ) : null}
                  {receipt.pointsEarned ? (
                    <div className="flex justify-between text-blue-800 font-semibold">
                      <span>{copy.cart.loyaltyPointsEarnedReceipt}</span>
                      <span className="font-mono-tabular">
                        +{receipt.pointsEarned} {copy.loyalty.pointsUnit}
                      </span>
                    </div>
                  ) : null}
                  {receipt.newPointsBalance !== undefined && (
                    <div className="flex justify-between text-slate-800 font-bold pt-1 border-t border-blue-200/70">
                      <span>{copy.cart.loyaltyNewBalanceReceipt}</span>
                      <span className="font-mono-tabular text-blue-900">
                        {receipt.newPointsBalance} {copy.loyalty.pointsUnit}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {receipt.prescriptionId && (
                <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 space-y-2 text-xs">
                  <p className="font-semibold text-sky-950">{copy.cart.rxAttachedSuccess}</p>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-mono-tabular font-bold text-blue-800">
                      {receipt.prescriptionId}
                      {receipt.uploadedFilesCount
                        ? ` · ${receipt.uploadedFilesCount} ${
                            receipt.uploadedFilesCount === 1
                              ? copy.prescription.fileSingle
                              : copy.prescription.filesCount
                          }`
                        : ''}
                    </span>
                    {receipt.prescriptionStatus && (
                      <PrescriptionStatusIndicator status={receipt.prescriptionStatus} lang={lang} />
                    )}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleResetAndClose}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold cursor-pointer"
              >
                {copy.cart.continueShopping}
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <ShoppingBag className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">{copy.cart.emptyTitle}</h3>
                <p className="text-sm text-slate-500 max-w-xs mx-auto">{copy.cart.emptyDesc}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onBrowseCatalog();
                }}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold cursor-pointer"
              >
                {copy.cart.browseCatalog}
              </button>
            </div>
          ) : step === 'cart' ? (
            <>
              {/* Free Delivery Progress */}
              <div className="bg-sky-50/80 border border-sky-200/80 rounded-2xl p-3.5 space-y-2">
                <p className="text-xs font-medium text-sky-950">
                  {remainingForFreeDelivery === 0 ? (
                    copy.cart.freeDeliveryAchieved
                  ) : (
                    <>
                      {copy.cart.freeDeliveryRemaining}{' '}
                      <span className="font-bold tabular-nums">
                        {remainingForFreeDelivery} {copy.currency}
                      </span>{' '}
                      {copy.cart.freeDeliveryTail}
                    </>
                  )}
                </p>
                <div className="h-1.5 w-full bg-sky-200/70 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Cart Items */}
              <ul className="divide-y divide-slate-100">
                {items.map(({ product, quantity }) => (
                  <li key={product.id} className="py-3.5 flex gap-3">
                    <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200/80 overflow-hidden shrink-0">
                      <SmartImage
                        src={product.image}
                        alt={lang === 'ar' ? product.nameAr : product.nameEn}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-xs sm:text-sm font-semibold text-slate-800 line-clamp-2 leading-snug">
                          {lang === 'ar' ? product.nameAr : product.nameEn}
                        </h3>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(product.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                          aria-label={lang === 'ar' ? 'حذف المنتج' : 'Remove item'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {lang === 'ar' ? product.brandAr : product.brandEn}
                      </p>
                      <div className="flex items-center justify-between pt-1">
                        <div className="inline-flex items-center border border-slate-200 rounded-lg bg-slate-50 h-8">
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(product.id, -1)}
                            className="w-7 h-full flex items-center justify-center text-slate-600 hover:text-slate-900 cursor-pointer"
                            aria-label={lang === 'ar' ? 'إنقاص' : 'Decrease'}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-7 text-center text-xs font-bold tabular-nums">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            disabled={quantity >= product.stockCount}
                            onClick={() => onUpdateQuantity(product.id, 1)}
                            className="w-7 h-full flex items-center justify-center text-slate-600 hover:text-slate-900 disabled:opacity-40 cursor-pointer"
                            aria-label={lang === 'ar' ? 'زيادة' : 'Increase'}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <span className="text-sm font-bold text-slate-900 tabular-nums">
                          {product.price * quantity} {copy.currency}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Promo Code */}
              <form onSubmit={handleApplyPromo} className="space-y-1.5">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder={copy.cart.promoCodePlaceholder}
                    className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                  >
                    {copy.cart.applyPromo}
                  </button>
                </div>
                {promoApplied && (
                  <p className="text-xs font-medium text-blue-700">{copy.cart.promoApplied}</p>
                )}
                {promoError && (
                  <p className="text-xs font-medium text-rose-600">{copy.cart.promoInvalid}</p>
                )}
              </form>
            </>
          ) : (
            /* Checkout Form */
            <form id="checkout-form" onSubmit={handlePlaceOrder} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  {copy.cart.fullName} *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  {copy.cart.phone} *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 tabular-nums"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  {copy.cart.address} *
                </label>
                <textarea
                  rows={2}
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="space-y-2 pt-1">
                <span className="block text-xs font-semibold text-slate-700">
                  {copy.cart.paymentMethod}
                </span>
                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 cursor-pointer hover:border-blue-300">
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'cod'}
                    onChange={() => setPaymentMethod('cod')}
                    className="accent-blue-600"
                  />
                  <span className="text-sm font-medium text-slate-800">{copy.cart.cod}</span>
                </label>
                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 cursor-pointer hover:border-blue-300">
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'card'}
                    onChange={() => setPaymentMethod('card')}
                    className="accent-blue-600"
                  />
                  <span className="text-sm font-medium text-slate-800">{copy.cart.card}</span>
                </label>
              </div>

              {/* Loyalty Points Redemption at Checkout */}
              {loyaltyProfile && (
                <div className="pt-2 border-t border-slate-200 space-y-2.5">
                  <div className="rounded-2xl bg-blue-50/60 border border-blue-200/80 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-blue-950">
                        <Award className="w-4 h-4 text-blue-700" aria-hidden="true" />
                        <span>{copy.cart.loyaltyTitle}</span>
                      </div>
                      <span className="text-[11px] font-mono-tabular font-semibold text-blue-800">
                        {copy.cart.loyaltyAvailable} {loyaltyProfile.pointsBalance}{' '}
                        {copy.loyalty.pointsUnit}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600">{copy.cart.loyaltyValueHint}</p>

                    {maxRedeemable >= 20 && (
                      <>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setRedeemPoints(0)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors ${
                              activeRedeemPoints === 0
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                            }`}
                          >
                            {copy.cart.loyaltyRedeemNone}
                          </button>
                          {[20, 50, 100]
                            .filter((preset) => preset < maxRedeemable)
                            .map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setRedeemPoints(preset)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold font-mono-tabular border cursor-pointer transition-colors ${
                                  activeRedeemPoints === preset
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                                }`}
                              >
                                {preset} (-{pointsToEgpDiscount(preset)} {copy.currency})
                              </button>
                            ))}
                          <button
                            type="button"
                            onClick={() => setRedeemPoints(maxRedeemable)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors ${
                              activeRedeemPoints === maxRedeemable
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                            }`}
                          >
                            {copy.cart.loyaltyRedeemMax} ({maxRedeemable})
                          </button>
                        </div>

                        <input
                          type="range"
                          min={0}
                          max={maxRedeemable}
                          step={POINTS_STEP}
                          value={activeRedeemPoints}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setRedeemPoints(val > 0 && val < 20 ? 20 : val);
                          }}
                          className="w-full accent-blue-600 cursor-pointer"
                          aria-label={copy.cart.loyaltyTitle}
                        />
                      </>
                    )}

                    {estimatedPointsToEarn > 0 && (
                      <div className="flex items-center justify-between gap-2 text-[11px] text-blue-900 pt-1 border-t border-blue-200/70">
                        <span className="inline-flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-blue-700" aria-hidden="true" />
                          {copy.cart.loyaltyWillEarn}
                        </span>
                        <span className="font-bold font-mono-tabular">
                          +{estimatedPointsToEarn} {copy.loyalty.pointsUnit}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Multi-File Prescription Upload inside Checkout */}
              <div className="pt-2 border-t border-slate-200 space-y-3">
                {hasRxItem ? (
                  <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-950 leading-relaxed">
                    {copy.cart.rxRequiredNotice}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowOptionalRx((prev) => !prev)}
                    className="text-xs font-semibold text-blue-700 hover:text-blue-800 cursor-pointer"
                  >
                    {copy.cart.rxOptionalToggle}
                  </button>
                )}

                {(hasRxItem || showOptionalRx) && (
                  <div className="space-y-2.5 bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
                    <input
                      ref={rxInputRef}
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/gif,.pdf,application/pdf"
                      onChange={handleCheckoutRxFiles}
                      className="hidden"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => rxInputRef.current?.click()}
                        className="py-2 px-3 rounded-xl border border-dashed border-slate-300 hover:border-blue-500 bg-white text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <FileUp className="w-3.5 h-3.5 text-blue-700 shrink-0" aria-hidden="true" />
                        <span className="truncate">{copy.cart.rxAttachFiles}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsCameraOpen(true)}
                        className="py-2 px-3 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100/70 text-xs font-semibold text-blue-900 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5 text-blue-700 shrink-0" aria-hidden="true" />
                        <span className="truncate">{copy.prescription.camera.openCameraBtn}</span>
                      </button>
                    </div>

                    {rxUploadError && (
                      <p className="text-[11px] font-medium text-rose-600">{rxUploadError}</p>
                    )}

                    {stagedRxFiles.length > 0 && (
                      <ul className="space-y-1.5">
                        {stagedRxFiles.map((file) => (
                          <li
                            key={file.localId}
                            className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {file.previewUrl ? (
                                <img
                                  src={file.previewUrl}
                                  alt={file.name}
                                  className="w-7 h-7 rounded-md object-cover shrink-0 border border-slate-200"
                                />
                              ) : (
                                <FileText className="w-4 h-4 text-rose-600 shrink-0" />
                              )}
                              <span className="truncate font-medium text-slate-800">
                                {file.name}
                              </span>
                              <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                                {formatFileSize(file.size)}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setStagedRxFiles((prev) =>
                                  prev.filter((f) => f.localId !== file.localId)
                                )
                              }
                              className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer shrink-0"
                              aria-label={copy.prescription.removeFile}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    <input
                      type="text"
                      value={existingRxId}
                      onChange={(e) => setExistingRxId(e.target.value)}
                      placeholder={copy.cart.rxOrExistingId}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 font-mono-tabular"
                    />
                  </div>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Footer Totals & CTA */}
        {items.length > 0 && step !== 'receipt' && (
          <div className="p-5 border-t border-slate-200 bg-slate-50/80 space-y-4">
            <div className="space-y-1.5 text-xs sm:text-sm">
              <div className="flex justify-between text-slate-600">
                <span>{copy.cart.subtotal}</span>
                <span className="tabular-nums font-medium">
                  {subtotal} {copy.currency}
                </span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-blue-700">
                  <span>{copy.cart.discount}</span>
                  <span className="tabular-nums font-medium">
                    -{discount} {copy.currency}
                  </span>
                </div>
              )}
              {loyaltyDiscount > 0 && (
                <div className="flex justify-between text-blue-700">
                  <span>
                    {copy.cart.loyaltyDiscountLine} ({activeRedeemPoints} {copy.loyalty.pointsUnit})
                  </span>
                  <span className="tabular-nums font-medium">
                    -{loyaltyDiscount} {copy.currency}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>{copy.cart.delivery}</span>
                <span className="tabular-nums font-medium">
                  {deliveryFee === 0 ? copy.cart.free : `${deliveryFee} ${copy.currency}`}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between text-base font-bold text-slate-900">
                <span>{copy.cart.total}</span>
                <span className="tabular-nums">
                  {total} {copy.currency}
                </span>
              </div>
            </div>

            {step === 'cart' ? (
              <button
                type="button"
                onClick={() => setStep('checkout')}
                className="w-full py-2.5 min-h-[40px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                {copy.cart.proceedCheckout}
              </button>
            ) : (
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep('cart')}
                  className="px-4 py-2.5 min-h-[40px] rounded-xl border border-slate-300 bg-white text-slate-700 text-xs sm:text-sm font-semibold cursor-pointer"
                >
                  {copy.cart.backToCart}
                </button>
                <button
                  type="submit"
                  form="checkout-form"
                  disabled={isPlacingOrder}
                  className="flex-1 py-2.5 min-h-[40px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs sm:text-sm font-semibold cursor-pointer"
                >
                  {isPlacingOrder ? copy.prescription.submitting : copy.cart.confirmOrder}
                </button>
              </div>
            )}
          </div>
        )}
      </aside>

      <PrescriptionCameraModal
        isOpen={isCameraOpen}
        lang={lang}
        onClose={() => setIsCameraOpen(false)}
        onCaptureFile={handleCheckoutCameraCapture}
      />
    </div>
  );
};
