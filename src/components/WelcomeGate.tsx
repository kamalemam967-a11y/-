import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Globe,
  Phone,
  ShieldCheck,
  Truck,
  User,
} from 'lucide-react';
import { Language } from '../types/pharmacy';
import { PharmacyLogo } from './PharmacyLogo';

export interface VisitorIdentity {
  fullName: string;
  phone: string;
  onboardedAt: string;
}

export const VISITOR_STORAGE_KEY = 'mar_pharmacy_visitor';
export const VISITOR_ID_KEY = 'mar_pharmacy_visitor_id';

export function getOrCreateVisitorId(): string {
  if (typeof window === 'undefined') return 'default-visitor';
  try {
    let id = localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = `v-${crypto.randomUUID()}`;
      localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    return 'default-visitor';
  }
}

export function normalizeDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

export function loadSavedVisitor(): VisitorIdentity | null {
  if (typeof window === 'undefined') return null;
  getOrCreateVisitorId(); // ensure visitor id exists
  try {
    const raw = localStorage.getItem(VISITOR_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VisitorIdentity>;
    if (
      parsed &&
      typeof parsed.fullName === 'string' &&
      parsed.fullName.trim().length >= 2 &&
      typeof parsed.phone === 'string' &&
      parsed.phone.trim().length >= 8
    ) {
      return {
        fullName: parsed.fullName.trim(),
        phone: parsed.phone.trim(),
        onboardedAt: parsed.onboardedAt || new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveVisitor(visitor: VisitorIdentity): void {
  if (typeof window === 'undefined') return;
  getOrCreateVisitorId();
  try {
    localStorage.setItem(VISITOR_STORAGE_KEY, JSON.stringify(visitor));
  } catch {
    // ignore storage quota errors
  }
}

interface WelcomeGateProps {
  lang: Language;
  onToggleLanguage: () => void;
  onComplete: (identity: VisitorIdentity) => Promise<void> | void;
}

export const WelcomeGate: React.FC<WelcomeGateProps> = ({
  lang,
  onToggleLanguage,
  onComplete,
}) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAr = lang === 'ar';
  const EnterArrow = isAr ? ArrowLeft : ArrowRight;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const cleanName = fullName.trim();
    const normalizedPhone = normalizeDigits(phone).replace(/[\s()-]/g, '').trim();
    const digitsOnly = normalizedPhone.replace(/\D/g, '');

    if (cleanName.length < 2) {
      setErrorMsg(
        isAr
          ? 'يرجى كتابة اسمك الكامل بشكل صحيح للدخول.'
          : 'Please enter your full name to continue.'
      );
      return;
    }

    if (digitsOnly.length < 8 || digitsOnly.length > 15) {
      setErrorMsg(
        isAr
          ? 'يرجى إدخال رقم تليفون صحيح (مثال: 01012345678).'
          : 'Please enter a valid phone number (e.g. 01012345678).'
      );
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await onComplete({
        fullName: cleanName,
        phone: normalizedPhone,
        onboardedAt: new Date().toISOString(),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-gradient-to-b from-[#EEF4FB] via-[#F6F8FC] to-[#F6F8FC] text-slate-800 px-4 py-5 sm:py-8">
      {/* Top Bar: Brand + Language Switch */}
      <header className="max-w-3xl w-full mx-auto flex items-center justify-between gap-4">
        <PharmacyLogo lang={lang} variant="header" />
        <button
          type="button"
          onClick={onToggleLanguage}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200/90 text-xs font-medium text-slate-700 hover:text-blue-700 hover:border-blue-300 transition-colors cursor-pointer"
        >
          <Globe className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
          <span>{isAr ? 'English' : 'العربية'}</span>
        </button>
      </header>

      {/* Center Welcome Form Card */}
      <main className="w-full max-w-md mx-auto my-8">
        <div className="bg-white border border-slate-200/90 rounded-3xl shadow-sm p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center mx-auto">
              <User className="w-5 h-5" aria-hidden="true" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
              {isAr
                ? 'أهلاً بك في صيدلية محمد عبد ربه'
                : 'Welcome to Mohamed Abd Raboo Pharmacy'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              {isAr
                ? 'سجّل اسمك ورقم تليفونك للدخول ومتابعة طلباتك ونقاط الولاء بسهولة.'
                : 'Enter your name and phone number to enter and track orders & loyalty rewards.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label
                htmlFor="welcome-full-name"
                className="block text-xs font-semibold text-slate-700"
              >
                {isAr ? 'الاسم الكامل' : 'Full Name'} *
              </label>
              <div className="relative flex items-center">
                <User
                  className="w-4 h-4 text-slate-400 absolute start-3.5 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="welcome-full-name"
                  type="text"
                  autoFocus
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder={isAr ? 'مثال: محمد أحمد علي' : 'e.g. Mohamed Ahmed'}
                  className="w-full ps-10 pe-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm text-slate-900 placeholder:text-slate-400 transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="welcome-phone"
                className="block text-xs font-semibold text-slate-700"
              >
                {isAr ? 'رقم التليفون' : 'Phone Number'} *
              </label>
              <div className="relative flex items-center">
                <Phone
                  className="w-4 h-4 text-slate-400 absolute start-3.5 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="welcome-phone"
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="01012345678"
                  className="w-full ps-10 pe-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-mono-tabular text-slate-900 placeholder:text-slate-400 text-start transition-all"
                  required
                />
              </div>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-medium text-rose-700"
              >
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 min-h-[46px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <span>
                {isSubmitting
                  ? isAr
                    ? 'جاري الدخول...'
                    : 'Entering...'
                  : isAr
                    ? 'دخول'
                    : 'Enter Pharmacy'}
              </span>
              <EnterArrow className="w-4 h-4" aria-hidden="true" />
            </button>
          </form>

          <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-3 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" aria-hidden="true" />
              <span>{isAr ? 'تسجيل لمرة واحدة فقط' : 'One-time quick entry'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-sky-600 shrink-0" aria-hidden="true" />
              <span>{isAr ? 'تسهيل الطلب والتوصيل' : 'Faster order checkout'}</span>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Subtle Footer */}
      <footer className="max-w-3xl w-full mx-auto text-center text-[11px] text-slate-400">
        {isAr
          ? '© صيدلية محمد عبد ربه · رعاية صيدلانية موثوقة على مدار الساعة'
          : '© Mohamed Abd Raboo Pharmacy · Trusted 24/7 pharmaceutical care'}
      </footer>
    </div>
  );
};
