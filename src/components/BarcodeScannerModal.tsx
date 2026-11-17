import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Eye,
  FileUp,
  RefreshCw,
  ScanBarcode,
  Search,
  ShoppingBag,
  SwitchCamera,
  X,
} from 'lucide-react';
import { PRODUCTS } from '../data/catalog';
import { t } from '../data/translations';
import { Language, Product } from '../types/pharmacy';
import { SmartImage } from './SmartImage';
import { normalizeDigits } from './WelcomeGate';

interface DetectedBarcode {
  rawValue: string;
  format?: string;
}

interface BarcodeDetectorInstance {
  detect: (source: ImageBitmapSource) => Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance;
}

function getBarcodeDetectorCtor(): BarcodeDetectorConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor };
  return typeof win.BarcodeDetector === 'function' ? win.BarcodeDetector : null;
}

export function getProductEan13(index: number): string {
  const base12 = `6221045${String(index + 101).padStart(5, '0')}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(base12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return `${base12}${check}`;
}

function playScanBeep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
    window.setTimeout(() => void ctx.close().catch(() => {}), 250);
  } catch {
    // ignore Web Audio restrictions
  }
}

interface BarcodeScannerModalProps {
  isOpen: boolean;
  lang: Language;
  products?: Product[];
  onClose: () => void;
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onAskPharmacist?: () => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  lang,
  products = PRODUCTS,
  onClose,
  onSelectProduct,
  onAddToCart,
  onAskPharmacist,
}) => {
  const copy = t(lang);
  const isAr = lang === 'ar';

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isStarting, setIsStarting] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [detectorSupported, setDetectorSupported] = useState(true);
  const [manualQuery, setManualQuery] = useState('');
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);

  const indexedCatalog = useMemo(
    () =>
      products.map((product, index) => ({
        product,
        ean13: getProductEan13(index),
      })),
    [products]
  );

  const sampleProducts = useMemo(() => indexedCatalog.slice(0, 3), [indexedCatalog]);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const lookupProduct = useCallback(
    (rawInput: string, allowNameMatch: boolean): Product | null => {
      const normalized = normalizeDigits(rawInput).trim();
      if (!normalized) return null;
      const lower = normalized.toLowerCase();

      const exact = indexedCatalog.find(
        ({ product, ean13 }) =>
          ean13 === normalized ||
          product.sku.toLowerCase() === lower ||
          product.id.toLowerCase() === lower ||
          product.sku.toLowerCase().endsWith(`-${lower}`)
      );
      if (exact) return exact.product;

      if (allowNameMatch && lower.length >= 2) {
        const byName = indexedCatalog.find(
          ({ product }) =>
            product.nameAr.toLowerCase().includes(lower) ||
            product.nameEn.toLowerCase().includes(lower) ||
            product.brandAr.toLowerCase().includes(lower) ||
            product.brandEn.toLowerCase().includes(lower)
        );
        if (byName) return byName.product;
      }

      return null;
    },
    [indexedCatalog]
  );

  const handleResolvedCode = useCallback(
    (rawCode: string, allowNameMatch = false) => {
      const cleaned = normalizeDigits(rawCode).trim();
      if (!cleaned) return;
      const found = lookupProduct(cleaned, allowNameMatch);
      playScanBeep();
      stopStream();
      setScannedCode(cleaned);
      setMatchedProduct(found);
      setAddedFeedback(false);
      setScanNotice(null);
    },
    [lookupProduct, stopStream]
  );

  const startCamera = useCallback(
    async (mode: 'environment' | 'user') => {
      stopStream();
      setIsStarting(true);
      setCameraError(false);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setIsStarting(false);
        setCameraError(true);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraError(false);
      } catch {
        setCameraError(true);
      } finally {
        setIsStarting(false);
      }
    },
    [stopStream]
  );

  useEffect(() => {
    if (!isOpen) {
      stopStream();
      setScannedCode(null);
      setMatchedProduct(null);
      setManualQuery('');
      setScanNotice(null);
      setAddedFeedback(false);
      setCameraError(false);
      return;
    }

    const Ctor = getBarcodeDetectorCtor();
    if (Ctor) {
      try {
        detectorRef.current = new Ctor({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
        });
        setDetectorSupported(true);
      } catch {
        detectorRef.current = null;
        setDetectorSupported(false);
      }
    } else {
      detectorRef.current = null;
      setDetectorSupported(false);
    }

    if (!scannedCode) {
      void startCamera(facingMode);
    }

    return () => {
      stopStream();
    };
  }, [isOpen, facingMode, scannedCode, startCamera, stopStream]);

  // Continuous live barcode detection while camera feed is active
  useEffect(() => {
    if (!isOpen || scannedCode || cameraError || !detectorSupported || !detectorRef.current) {
      return;
    }

    let cancelled = false;
    let timerId: number | null = null;

    const scanFrame = async () => {
      if (cancelled || !videoRef.current || !detectorRef.current) return;
      const video = videoRef.current;
      if (video.readyState >= 2 && video.videoWidth > 0) {
        try {
          const results = await detectorRef.current.detect(video);
          if (!cancelled && results.length > 0 && results[0].rawValue) {
            handleResolvedCode(results[0].rawValue, false);
            return;
          }
        } catch {
          // ignore transient frame decode error
        }
      }
      if (!cancelled) {
        timerId = window.setTimeout(() => void scanFrame(), 260);
      }
    };

    timerId = window.setTimeout(() => void scanFrame(), 350);
    return () => {
      cancelled = true;
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, [isOpen, scannedCode, cameraError, detectorSupported, handleResolvedCode]);

  if (!isOpen) return null;

  const handleClose = () => {
    stopStream();
    onClose();
  };

  const handleResetScan = () => {
    setScannedCode(null);
    setMatchedProduct(null);
    setAddedFeedback(false);
    setScanNotice(null);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualQuery.trim()) return;
    handleResolvedCode(manualQuery, true);
  };

  const handlePhotoUploadScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const detector = detectorRef.current;
    if (!detector) {
      setScanNotice(
        isAr
          ? 'المتصفح الحالي لا يدعم قراءة الباركود التلقائية من الصور؛ يمكنك كتابة رقم الباركود أو كود الصنف بالأسفل.'
          : 'Automatic image barcode decoding is unavailable in this browser. Please type the barcode or SKU below.'
      );
      return;
    }

    try {
      const bitmap = await createImageBitmap(file);
      const results = await detector.detect(bitmap);
      bitmap.close?.();
      if (results.length > 0 && results[0].rawValue) {
        handleResolvedCode(results[0].rawValue, false);
      } else {
        setScanNotice(
          isAr
            ? 'لم يتم العثور على باركود واضح في الصورة. حاول التقريب أكثر أو كتابة الكود يدوياً.'
            : 'No readable barcode detected in that image. Try a closer shot or enter the code manually.'
        );
      }
    } catch {
      setScanNotice(
        isAr
          ? 'تعذر قراءة الصورة، يرجى المحاولة بصورة أوضح أو إدخال الكود يدوياً.'
          : 'Could not read that image. Please try a clearer photo or enter the code manually.'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        className="relative z-10 w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[92vh]"
        role="dialog"
        aria-modal="true"
        aria-label={isAr ? 'قراءة باركود الأصناف' : 'Product Barcode Scanner'}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center">
              <ScanBarcode className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isAr ? 'قراءة باركود الأصناف' : 'Scan Product Barcode'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isAr
                  ? 'وجّه الكاميرا نحو باركود العبوة أو ابحث بالكود'
                  : 'Point camera at package barcode or look up SKU'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 cursor-pointer"
            aria-label={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4">
          {/* Live Camera Viewfinder OR Scan Result */}
          {!scannedCode ? (
            <div className="space-y-3">
              <div className="relative aspect-[16/10] w-full rounded-2xl bg-slate-950 overflow-hidden flex items-center justify-center">
                {cameraError ? (
                  <div className="p-5 text-center space-y-2.5 max-w-xs">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 text-blue-300 flex items-center justify-center mx-auto">
                      <Camera className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <p className="text-xs font-semibold text-white">
                      {isAr
                        ? 'تعذر فتح الكاميرا مباشرة'
                        : 'Live camera access unavailable'}
                    </p>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      {isAr
                        ? 'يمكنك رفع صورة الباركود أو كتابة رقم الباركود / كود الصنف بالأسفل.'
                        : 'Upload a barcode photo or type the barcode / SKU manually below.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => void startCamera(facingMode)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{isAr ? 'إعادة المحاولة' : 'Retry Camera'}</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      className="w-full h-full object-cover"
                    />

                    {/* Target Laser Guide Overlay */}
                    <div
                      className="pointer-events-none absolute inset-x-8 inset-y-6 border border-white/35 rounded-xl flex items-center justify-center"
                      aria-hidden="true"
                    >
                      <span className="absolute -top-0.5 -start-0.5 w-5 h-5 border-t-2 border-s-2 border-blue-400 rounded-tl-md" />
                      <span className="absolute -top-0.5 -end-0.5 w-5 h-5 border-t-2 border-e-2 border-blue-400 rounded-tr-md" />
                      <span className="absolute -bottom-0.5 -start-0.5 w-5 h-5 border-b-2 border-s-2 border-blue-400 rounded-bl-md" />
                      <span className="absolute -bottom-0.5 -end-0.5 w-5 h-5 border-b-2 border-e-2 border-blue-400 rounded-br-md" />
                      <div className="w-[82%] h-0.5 bg-blue-400/80 shadow-[0_0_8px_rgba(96,165,250,0.9)]" />
                    </div>

                    {isStarting && (
                      <div className="absolute inset-0 bg-slate-950/75 flex items-center justify-center text-xs text-slate-200">
                        {isAr ? 'جاري تشغيل الكاميرا...' : 'Starting camera...'}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Camera Controls + Upload Barcode Photo */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={cameraError || isStarting}
                    onClick={() =>
                      setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 text-xs font-medium cursor-pointer"
                  >
                    <SwitchCamera className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{isAr ? 'تبديل الكاميرا' : 'Flip Camera'}</span>
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoUploadScan}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium cursor-pointer"
                  >
                    <FileUp className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
                    <span>{isAr ? 'قراءة من صورة' : 'Scan Photo'}</span>
                  </button>
                </div>

                {!detectorSupported && !cameraError && (
                  <span className="text-[11px] text-amber-700 font-medium">
                    {isAr
                      ? 'المتصفح لا يدعم القراءة التلقائية، استخدم البحث بالكود أدناه'
                      : 'Auto-decode unsupported in this browser; use manual lookup below'}
                  </span>
                )}
              </div>

              {scanNotice && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                  {scanNotice}
                </div>
              )}
            </div>
          ) : matchedProduct ? (
            /* Matched Product Card */
            <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-blue-800">
                  <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                  {isAr ? 'تم التعرف على الصنف' : 'Product Matched'}
                </span>
                <span className="font-mono-tabular text-[11px] text-slate-500">
                  {matchedProduct.sku}
                </span>
              </div>

              <div className="flex items-start gap-3.5 bg-white rounded-xl border border-slate-200/80 p-3">
                <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                  <SmartImage
                    src={matchedProduct.image}
                    alt={isAr ? matchedProduct.nameAr : matchedProduct.nameEn}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-[11px] font-medium text-blue-700">
                    {isAr ? matchedProduct.brandAr : matchedProduct.brandEn}
                  </p>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                    {isAr ? matchedProduct.nameAr : matchedProduct.nameEn}
                  </h4>
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-sm font-bold text-slate-900 font-mono-tabular">
                      {matchedProduct.price} {copy.currency}
                    </span>
                    {matchedProduct.originalPrice && (
                      <span className="text-xs text-slate-400 line-through font-mono-tabular">
                        {matchedProduct.originalPrice} {copy.currency}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={matchedProduct.stockCount <= 0}
                  onClick={() => {
                    onAddToCart(matchedProduct);
                    setAddedFeedback(true);
                    window.setTimeout(() => setAddedFeedback(false), 2000);
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[40px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white text-xs font-semibold cursor-pointer transition-colors"
                >
                  {addedFeedback ? (
                    <>
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{isAr ? 'تمت الإضافة للسلة' : 'Added to Cart'}</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{copy.product.addToCart}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onSelectProduct(matchedProduct);
                    handleClose();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 min-h-[40px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isAr ? 'التفاصيل' : 'Details'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetScan}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 min-h-[40px] rounded-xl border border-blue-200 bg-white hover:bg-blue-50 text-blue-700 text-xs font-semibold cursor-pointer"
                >
                  <ScanBarcode className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isAr ? 'مسح آخر' : 'Scan Again'}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Scanned Barcode Not Found in Catalog */
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3 text-center">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-600 flex items-center justify-center mx-auto">
                <ScanBarcode className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-900">
                  {isAr
                    ? 'لم يُطابق هذا الباركود صنفاً مسجلاً بالكتالوج الإلكتروني'
                    : 'Barcode not matched in the online catalog'}
                </p>
                <p className="text-xs font-mono-tabular text-blue-700 font-semibold">
                  {scannedCode}
                </p>
                <p className="text-[11px] text-slate-500">
                  {isAr
                    ? 'يمكنك إرسال طلب توفير الدواء للصيدلي أو إعادة المسح.'
                    : 'You can request this medicine from our pharmacist or scan again.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                {onAskPharmacist && (
                  <button
                    type="button"
                    onClick={() => {
                      handleClose();
                      onAskPharmacist();
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    <span>{isAr ? 'اسأل الصيدلي / روشتة' : 'Ask Pharmacist'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleResetScan}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isAr ? 'مسح مرة أخرى' : 'Scan Again'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Manual Barcode / SKU Lookup & Quick Sample Codes */}
          <div className="pt-3 border-t border-slate-100 space-y-2.5">
            <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
              <div className="relative flex-1 flex items-center">
                <Search
                  className="w-3.5 h-3.5 text-slate-400 absolute start-3 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={manualQuery}
                  onChange={(e) => setManualQuery(e.target.value)}
                  placeholder={
                    isAr
                      ? 'أدخل رقم الباركود أو كود الصنف (مثال: MAR-MED-101)...'
                      : 'Enter barcode, SKU (e.g. MAR-MED-101), or name...'
                  }
                  className="w-full ps-8 pe-3 py-2 min-h-[38px] rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-xs text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <button
                type="submit"
                className="px-3.5 py-2 min-h-[38px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer shrink-0"
              >
                {isAr ? 'بحث' : 'Lookup'}
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
              <span>{isAr ? 'تجربة سريعة:' : 'Quick test:'}</span>
              {sampleProducts.map(({ product, ean13 }) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleResolvedCode(ean13, false)}
                  className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-blue-50 border border-slate-200/80 hover:border-blue-200 font-mono-tabular text-[10px] text-slate-700 hover:text-blue-800 cursor-pointer transition-colors"
                >
                  {product.sku}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
