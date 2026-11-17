import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Award,
  CheckCircle2,
  Gift,
  ShoppingBag,
  Sparkles,
  Tag,
  User,
} from 'lucide-react';
import { t } from '../data/translations';
import {
  calculateLoyaltyTier,
  pointsToEgpDiscount,
  updateLoyaltyProfile,
} from '../services/loyaltyApi';
import {
  Language,
  LoyaltyTransactionType,
  UserLoyaltyProfile,
} from '../types/pharmacy';
import { loadSavedVisitor, saveVisitor } from './WelcomeGate';

interface UserProfileViewProps {
  lang: Language;
  profile: UserLoyaltyProfile | null;
  onProfileUpdated: (updated: UserLoyaltyProfile) => void;
  onBackHome: () => void;
  onBrowseCatalog: () => void;
  onOpenCart: () => void;
}

type HistoryFilter = 'all' | LoyaltyTransactionType;

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  lang,
  profile,
  onProfileUpdated,
  onBackHome,
  onBrowseCatalog,
  onOpenCart,
}) => {
  const copy = t(lang);
  const lCopy = copy.loyalty;
  const BackArrow = lang === 'ar' ? ArrowRight : ArrowLeft;

  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [address, setAddress] = useState(profile?.address || '');
  const [isSaving, setIsSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName);
      setPhone(profile.phone);
      setAddress(profile.address);
    }
  }, [profile?.memberId, profile?.updatedAt]);

  const tierSummary = useMemo(
    () => calculateLoyaltyTier(profile?.lifetimeEarned ?? 0),
    [profile?.lifetimeEarned]
  );

  const filteredTransactions = useMemo(() => {
    const list = profile?.transactions ?? [];
    if (historyFilter === 'all') return list;
    return list.filter((tx) => tx.type === historyFilter);
  }, [profile?.transactions, historyFilter]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    setSavedNotice(false);
    try {
      const updated = await updateLoyaltyProfile({
        fullName: fullName.trim(),
        phone: phone.trim(),
        address: address.trim(),
      });
      const existingVisitor = loadSavedVisitor();
      saveVisitor({
        fullName: updated.fullName,
        phone: updated.phone,
        onboardedAt: existingVisitor?.onboardedAt || new Date().toISOString(),
      });
      onProfileUpdated(updated);
      setSavedNotice(true);
      window.setTimeout(() => setSavedNotice(false), 3500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const balance = profile?.pointsBalance ?? 0;
  const discountValue = pointsToEgpDiscount(balance);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Breadcrumb & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-700 transition-colors cursor-pointer"
        >
          <BackArrow className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{copy.product.backToHome}</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBrowseCatalog}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 min-h-[34px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
            <span>{lCopy.shopEarnBtn}</span>
          </button>
          <button
            type="button"
            onClick={onOpenCart}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 min-h-[34px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{lCopy.useInCartBtn}</span>
          </button>
        </div>
      </div>

      {/* Loyalty Hero Card */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-7 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-slate-100 pb-5">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Award className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                  {lCopy.pageTitle}
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
                {lCopy.pageSubtitle}
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                <span className="font-mono-tabular font-semibold text-blue-800">
                  {lCopy.memberIdLabel}: {profile?.memberId || 'MAR-CLUB-1042'}
                </span>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 font-semibold">
                  {lCopy.tiers[tierSummary.tier]}
                </span>
              </div>
            </div>
          </div>

          {/* Primary Balance Highlight */}
          <div className="grid grid-cols-2 gap-3 sm:min-w-[290px]">
            <div className="rounded-xl bg-blue-50/70 border border-blue-200/80 p-3.5 space-y-0.5">
              <p className="text-[11px] font-medium text-blue-900">{lCopy.availableBalance}</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-950 font-mono-tabular">
                {balance}{' '}
                <span className="text-xs font-semibold text-blue-700">{lCopy.pointsUnit}</span>
              </p>
            </div>

            <div className="rounded-xl bg-sky-50/70 border border-sky-200/80 p-3.5 space-y-0.5">
              <p className="text-[11px] font-medium text-sky-900">{lCopy.redeemableValue}</p>
              <p className="text-xl sm:text-2xl font-bold text-sky-950 font-mono-tabular">
                {discountValue}{' '}
                <span className="text-xs font-semibold text-sky-700">{copy.currency}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Tier Progress & Stats Strip */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          <div className="lg:col-span-6 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800">{lCopy.tierProgressTitle}</span>
              <span className="text-slate-600 tabular-nums">
                {tierSummary.nextTier ? (
                  <>
                    {tierSummary.pointsToNextTier} {lCopy.nextTierHint}{' '}
                    <span className="font-semibold text-blue-800">
                      {lCopy.tiers[tierSummary.nextTier]}
                    </span>
                  </>
                ) : (
                  <span className="font-semibold text-blue-800">{lCopy.topTierReached}</span>
                )}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${tierSummary.progressPercent}%` }}
              />
            </div>
          </div>

          <div className="lg:col-span-6 grid grid-cols-3 gap-2.5">
            <div className="rounded-xl bg-slate-50/80 border border-slate-200/75 p-3 space-y-0.5">
              <p className="text-[11px] text-slate-500">{lCopy.lifetimeEarned}</p>
              <p className="text-sm sm:text-base font-bold text-slate-900 font-mono-tabular">
                {profile?.lifetimeEarned ?? 0}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50/80 border border-slate-200/75 p-3 space-y-0.5">
              <p className="text-[11px] text-slate-500">{lCopy.lifetimeRedeemed}</p>
              <p className="text-sm sm:text-base font-bold text-slate-900 font-mono-tabular">
                {profile?.lifetimeRedeemed ?? 0}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50/80 border border-slate-200/75 p-3 space-y-0.5">
              <p className="text-[11px] text-slate-500">{lCopy.ordersCount}</p>
              <p className="text-sm sm:text-base font-bold text-slate-900 font-mono-tabular">
                {profile?.ordersCount ?? 0}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main 2-Column Content: Profile Form + Rules | Points Activity Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-5 space-y-5">
          {/* Editable User Profile */}
          <section className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <User className="w-4 h-4 text-blue-700" aria-hidden="true" />
              <h2 className="text-sm font-bold text-slate-900">{lCopy.profileCardTitle}</h2>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  {copy.cart.fullName} *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  {copy.cart.phone} *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white tabular-nums"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  {copy.cart.address}
                </label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              {saveError && (
                <p className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  {saveError}
                </p>
              )}

              {savedNotice && (
                <p className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-800 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 w-full">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{lCopy.profileSavedMsg}</span>
                </p>
              )}

              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-2 min-h-[38px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                {lCopy.saveProfileBtn}
              </button>
            </form>
          </section>

          {/* Rules Summary */}
          <section className="bg-[#EEF5FC] border border-blue-100 rounded-2xl p-5 space-y-2.5">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900">
              {lCopy.howItWorksTitle}
            </h3>
            <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
              <li className="flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-blue-700 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{lCopy.earnRule}</span>
              </li>
              <li className="flex items-start gap-2">
                <Tag className="w-3.5 h-3.5 text-blue-700 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{lCopy.redeemRule}</span>
              </li>
            </ul>
          </section>
        </div>

        {/* Points Activity Ledger */}
        <section className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-slate-900">{lCopy.historyTitle}</h2>
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
              {(
                [
                  ['all', lCopy.historyAll],
                  ['earned', lCopy.txTypes.earned],
                  ['redeemed', lCopy.txTypes.redeemed],
                  ['bonus', lCopy.txTypes.bonus],
                ] as [HistoryFilter, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setHistoryFilter(key)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-lg whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    historyFilter === key
                      ? 'bg-white text-blue-800 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="p-8 text-center text-xs sm:text-sm text-slate-500">
              {lCopy.historyEmpty}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filteredTransactions.map((tx) => {
                const isDebit = tx.type === 'redeemed';
                return (
                  <li
                    key={tx.id}
                    className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                          tx.type === 'earned'
                            ? 'bg-blue-50 border-blue-100 text-blue-700'
                            : tx.type === 'redeemed'
                              ? 'bg-slate-100 border-slate-200 text-slate-700'
                              : 'bg-sky-50 border-sky-100 text-sky-700'
                        }`}
                      >
                        {tx.type === 'earned' ? (
                          <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                        ) : tx.type === 'redeemed' ? (
                          <Tag className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <Gift className="w-4 h-4" aria-hidden="true" />
                        )}
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <p className="text-xs sm:text-sm font-medium text-slate-800 truncate">
                          {lang === 'ar' ? tx.descriptionAr : tx.descriptionEn}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span>{lCopy.txTypes[tx.type]}</span>
                          {tx.orderNumber && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-tabular">#{tx.orderNumber}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">{formatDate(tx.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-xs sm:text-sm font-bold font-mono-tabular whitespace-nowrap shrink-0 ${
                        isDebit ? 'text-slate-700' : 'text-blue-700'
                      }`}
                    >
                      {isDebit ? '-' : '+'}
                      {tx.points} {lCopy.pointsUnit}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
};
