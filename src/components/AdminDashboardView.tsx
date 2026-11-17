import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  PackagePlus,
  Users,
  DollarSign,
  TrendingUp,
  ClipboardList,
  Store,
  Truck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Lock,
  KeyRound,
  LogOut,
  FileText,
  Trash2,
  Eye,
  EyeOff,
  XCircle,
  Maximize2,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { Language, PrescriptionSubmission, Product, PrescriptionStatus, PrescriptionFileStatus } from '../types/pharmacy';
import {
  getStoredStaffSession,
  loginStaffPortal,
  logoutStaffPortal,
  verifyStaffSession,
  reviewPrescription,
  StaffSessionInfo,
  formatFileSize,
} from '../services/prescriptionApi';
import { StaffAddProductModal } from './StaffAddProductModal';
import { PrescriptionFileViewer } from './PrescriptionFileViewer';
import { FileVerificationLabel, PrescriptionStatusIndicator } from './PrescriptionStatusBadge';

interface AdminDashboardViewProps {
  lang: Language;
  submissions: PrescriptionSubmission[];
  onOrderUpdated: (updated: PrescriptionSubmission) => void;
  customProducts?: Product[];
  onProductAdded?: (product: Product) => void;
  onProductDeleted?: (productId: string) => void;
  onBackHome: () => void;
}

type AdminTab = 'overview' | 'orders' | 'catalog' | 'customers';
type OrderFilterTab = 'all' | PrescriptionStatus;

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  lang,
  submissions,
  onOrderUpdated,
  customProducts = [],
  onProductAdded,
  onProductDeleted,
  onBackHome,
}) => {
  const isAr = lang === 'ar';
  const ArrowBack = isAr ? ChevronRight : ChevronLeft;

  const [staffSession, setStaffSession] = useState<StaffSessionInfo | null>(() => getStoredStaffSession());
  const [loginName, setLoginName] = useState('');
  const [loginPasscode, setLoginPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [orderFilter, setOrderFilter] = useState<OrderFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(submissions[0]?.id ?? null);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [modalFile, setModalFile] = useState<any | null>(null);

  const [pharmacistName, setPharmacistName] = useState('mohamed');
  const [reviewNotes, setReviewNotes] = useState('');
  const [estimatedTotal, setEstimatedTotal] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);

  useEffect(() => {
    let active = true;
    if (getStoredStaffSession()) {
      void verifyStaffSession().then((verified) => {
        if (!active) return;
        if (!verified) {
          setStaffSession(null);
          setAuthError(isAr ? 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً.' : 'Staff session expired. Please sign in again.');
        }
      });
    }
    return () => {
      active = false;
    };
  }, [isAr]);

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginName.trim() || !loginPasscode.trim() || isAuthenticating) return;
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const session = await loginStaffPortal(loginName.trim(), loginPasscode.trim());
      setStaffSession(session);
      setLoginPasscode('');
    } catch {
      setAuthError(isAr ? 'اسم الصيدلي أو كلمة المرور غير صحيحة.' : 'Invalid pharmacist name or passcode.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleStaffLogout = async () => {
    await logoutStaffPortal();
    setStaffSession(null);
  };

  // Metrics calculation
  const metrics = useMemo(() => {
    const totalOrders = submissions.length;
    const pendingOrders = submissions.filter((s) => s.status === 'pending_review').length;
    const activeOrders = submissions.filter((s) => ['under_review', 'approved', 'preparing', 'ready_for_pickup', 'out_for_delivery'].includes(s.status)).length;
    const completedOrders = submissions.filter((s) => s.status === 'ready_for_delivery' || s.status === 'approved').length;
    const estimatedRevenue = submissions.reduce((sum, s) => sum + (s.estimatedTotal || 0), 0);
    return {
      totalOrders,
      pendingOrders,
      activeOrders,
      completedOrders,
      estimatedRevenue,
      customProductsCount: customProducts.length,
    };
  }, [submissions, customProducts]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return submissions.filter((sub) => {
      if (orderFilter !== 'all' && sub.status !== orderFilter) return false;
      if (!q) return true;
      return (
        sub.id.toLowerCase().includes(q) ||
        sub.patientName.toLowerCase().includes(q) ||
        sub.phone.toLowerCase().includes(q) ||
        (sub.linkedOrderNumber && sub.linkedOrderNumber.toLowerCase().includes(q))
      );
    });
  }, [submissions, orderFilter, searchQuery]);

  const selectedOrder = useMemo(() => {
    return (
      filteredOrders.find((o) => o.id === selectedOrderId) ||
      submissions.find((o) => o.id === selectedOrderId) ||
      filteredOrders[0] ||
      null
    );
  }, [filteredOrders, submissions, selectedOrderId]);

  useEffect(() => {
    if (selectedOrder) {
      setReviewNotes(selectedOrder.reviewNotes || '');
      setEstimatedTotal(selectedOrder.estimatedTotal !== undefined ? String(selectedOrder.estimatedTotal) : '');
      setActiveFileId(selectedOrder.files[0]?.id ?? null);
      setActionError(null);
    }
  }, [selectedOrder?.id]);

  const activeFile = useMemo(() => {
    if (!selectedOrder || selectedOrder.files.length === 0) return null;
    return selectedOrder.files.find((f) => f.id === activeFileId) || selectedOrder.files[0];
  }, [selectedOrder, activeFileId]);

  const handleStatusDecision = async (nextStatus: PrescriptionStatus) => {
    if (!selectedOrder || isSaving) return;
    setIsSaving(true);
    setActionError(null);
    try {
      const parsedTotal = estimatedTotal.trim() ? Number(estimatedTotal.trim()) : null;
      const updated = await reviewPrescription(selectedOrder.id, {
        status: nextStatus,
        reviewedBy: pharmacistName.trim() || 'Mohamed Abd Raboo',
        reviewNotes: reviewNotes.trim(),
        estimatedTotal: parsedTotal !== null && Number.isFinite(parsedTotal) ? parsedTotal : null,
      });
      onOrderUpdated(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update order status');
    } finally {
      setIsSaving(false);
    }
  };

  const formatTimestamp = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(isAr ? 'ar-EG' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  if (!staffSession) {
    return (
      <div className="min-h-screen bg-[#F6F8FC] py-8 px-4 flex flex-col justify-center items-center">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl shadow-sm p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-7 h-7" aria-hidden="true" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">
              {isAr ? 'بوابة إدارة صيدلية محمد عبد ربه' : 'Admin & Management Control Portal'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              {isAr
                ? 'يرجى تسجيل الدخول برقم اعتماد الصيدلي للوصول إلى لوحة الإدارة الشاملة ومتابعة الطلبات والعملاء.'
                : 'Please sign in with pharmacist credentials to access the comprehensive management dashboard.'}
            </p>
          </div>

          <form onSubmit={handleStaffLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                {isAr ? 'اسم الصيدلي (المعرف)' : 'Pharmacist Username'}
              </label>
              <input
                type="text"
                required
                autoComplete="username"
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                placeholder="mohamed"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                {isAr ? 'كلمة المرور / الرمز السري' : 'Passcode'}
              </label>
              <div className="relative">
                <input
                  type={showPasscode ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={loginPasscode}
                  onChange={(e) => setLoginPasscode(e.target.value)}
                  placeholder="01149737685"
                  className="w-full ps-3.5 pe-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white font-mono-tabular"
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode((prev) => !prev)}
                  className="absolute top-1/2 -translate-y-1/2 end-2.5 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {authError && (
              <p className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={isAuthenticating || !loginName.trim() || !loginPasscode.trim()}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <KeyRound className="w-4 h-4" aria-hidden="true" />
              <span>{isAuthenticating ? (isAr ? 'جاري التحقق...' : 'Verifying...') : (isAr ? 'دخول لوحة الإدارة' : 'Enter Admin Dashboard')}</span>
            </button>
          </form>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <button
              type="button"
              onClick={onBackHome}
              className="inline-flex items-center gap-1 text-blue-700 hover:underline cursor-pointer font-medium"
            >
              <ArrowBack className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isAr ? 'العودة للواجهة الرئيسية' : 'Back to Storefront'}</span>
            </button>
            <span>صيدلية محمد عبد ربه</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F8FC] pb-12">
      {/* Admin Header Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                {isAr ? 'لوحة تحكم الإدارة الشاملة' : 'Admin & Management Control Center'}
              </h1>
              <p className="text-xs text-slate-500">
                {isAr ? 'صيدلية محمد عبد ربه · إدارة الطلبات والعملاء والمنتجات' : 'Mohamed Abd Raboo Pharmacy · Orders & Catalog Management'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setIsAddProductOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            >
              <PackagePlus className="w-4 h-4" aria-hidden="true" />
              <span>{isAr ? 'إضافة صنف جديد للبيع' : 'Add New Product'}</span>
            </button>

            <button
              type="button"
              onClick={onBackHome}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
            >
              <span>{isAr ? 'عرض المتجر' : 'View Storefront'}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleStaffLogout()}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-700 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isAr ? 'خروج' : 'Logout'}</span>
            </button>
          </div>
        </div>

        {/* Tab Selector Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-2 overflow-x-auto no-scrollbar border-t border-slate-100 py-2">
          {[
            ['overview', isAr ? '📊 نظرة عامة والنظام' : '📊 System Overview'],
            ['orders', isAr ? `📋 إدارة الطلبات والروشتات (${metrics.totalOrders})` : `📋 Orders & Prescriptions (${metrics.totalOrders})`],
            ['catalog', isAr ? `🏷️ إدارة المنتجات والأصناف (${customProducts.length})` : `🏷️ Product Catalog (${customProducts.length})`],
            ['customers', isAr ? '👥 العملاء ونقاط الولاء' : '👥 Customers & Loyalty'],
          ].map(([tabKey, label]) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setActiveTab(tabKey as AdminTab)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === tabKey
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Tab 1: System Overview & KPIs */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold">{isAr ? 'إجمالي الطلبات والروشتات' : 'Total Orders & Prescriptions'}</span>
                  <ClipboardList className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-3xl font-bold text-slate-900 font-mono-tabular">{metrics.totalOrders}</p>
                <p className="text-xs text-amber-600 font-medium">
                  {metrics.pendingOrders} {isAr ? 'طلبات بانتظار المراجعة الفورية' : 'pending review'}
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold">{isAr ? 'الطلبات النشطة والجارية' : 'Active & In-Progress Orders'}</span>
                  <Clock className="w-5 h-5 text-sky-600" />
                </div>
                <p className="text-3xl font-bold text-slate-900 font-mono-tabular">{metrics.activeOrders}</p>
                <p className="text-xs text-sky-600 font-medium">
                  {isAr ? 'تحت التجهيز والتوصيل الفوري' : 'preparing & out for delivery'}
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold">{isAr ? 'إجمالي المبيعات التقديرية' : 'Estimated Revenue'}</span>
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <p className="text-3xl font-bold text-emerald-700 font-mono-tabular">{metrics.estimatedRevenue} <span className="text-sm">ج.م</span></p>
                <p className="text-xs text-slate-500">{isAr ? 'من إجمالي الطلبات المقدرة' : 'From estimated order totals'}</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold">{isAr ? 'الأصناف المضافة للبيع' : 'Custom Display Products'}</span>
                  <Store className="w-5 h-5 text-indigo-600" />
                </div>
                <p className="text-3xl font-bold text-slate-900 font-mono-tabular">{metrics.customProductsCount}</p>
                <p className="text-xs text-indigo-600 font-medium">
                  {isAr ? 'معروضة فوراً للجميع على المتجر' : 'Visible to all visitors'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <span>{isAr ? 'حالة النظام والخدمات السحابية' : 'System & Cloud Status'}</span>
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="font-medium text-slate-700">{isAr ? 'خادم العمليات والربط السريع (Express API)' : 'Express API Backend'}</span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ● {isAr ? 'متصل ويعمل بكفاءة' : 'Operational'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="font-medium text-slate-700">{isAr ? 'تنبيهات حالة الطلبات الفورية (SSE Stream)' : 'Real-time SSE Notifications'}</span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ● {isAr ? 'نشط ومستقر' : 'Active'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="font-medium text-slate-700">{isAr ? 'بيانات الزوار ونقاط الولاء (Multi-Visitor Isolation)' : 'Multi-Visitor Data Isolation'}</span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ● {isAr ? 'مفعل ومؤمن' : 'Secured'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  <span>{isAr ? 'إجراءات الإدارة السريعة' : 'Quick Admin Actions'}</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('orders')}
                    className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-50 text-start space-y-1 transition-colors cursor-pointer"
                  >
                    <p className="text-xs font-bold text-blue-900">{isAr ? 'مراجعة الطلبات المعلقة' : 'Review Pending Orders'}</p>
                    <p className="text-[11px] text-slate-600">{metrics.pendingOrders} {isAr ? 'طلب بانتظار الاعتماد' : 'orders waiting'}</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAddProductOpen(true)}
                    className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 text-start space-y-1 transition-colors cursor-pointer"
                  >
                    <p className="text-xs font-bold text-indigo-900">{isAr ? 'إضافة دواء أو صنف جديد' : 'Add Medicine / Product'}</p>
                    <p className="text-[11px] text-slate-600">{isAr ? 'عرض فوري للعملاء' : 'Instant storefront display'}</p>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Orders & Prescriptions Management */}
        {activeTab === 'orders' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Queue List */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    {isAr ? 'قائمة الطلبات والروشتات' : 'Orders Queue'}
                  </h3>
                  <span className="text-xs font-mono-tabular text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    {filteredOrders.length}
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isAr ? 'بحث برقم الطلب أو اسم المريض...' : 'Search order, patient...'}
                    className="w-full ps-9 pe-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
                  {(
                    [
                      ['all', isAr ? 'الكل' : 'All'],
                      ['pending_review', isAr ? 'معلق' : 'Pending'],
                      ['approved', isAr ? 'معتمد' : 'Approved'],
                      ['preparing', isAr ? 'تحت التجهيز' : 'Preparing'],
                      ['out_for_delivery', isAr ? 'جاري التوصيل' : 'Delivery'],
                    ] as [OrderFilterTab, string][]
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setOrderFilter(key)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                        orderFilter === key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredOrders.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  {isAr ? 'لا توجد طلبات مطابقة للبحث.' : 'No matching orders found.'}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                  {filteredOrders.map((order) => {
                    const isSelected = selectedOrder?.id === order.id;
                    return (
                      <button
                        key={order.id}
                        type="button"
                        onClick={() => setSelectedOrderId(order.id)}
                        className={`w-full text-start p-4 transition-colors cursor-pointer space-y-1.5 ${
                          isSelected ? 'bg-blue-50/70 border-s-4 border-blue-600' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono-tabular text-sm font-bold text-blue-800">{order.id}</span>
                          <PrescriptionStatusIndicator status={order.status} lang={lang} />
                        </div>
                        <p className="text-sm font-semibold text-slate-900 truncate">{order.patientName}</p>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{order.files.length} {isAr ? 'ملفات مرفقة' : 'files'}</span>
                          <span className="tabular-nums">{formatTimestamp(order.submittedAt)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected Order Details & Management */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-xs">
              {!selectedOrder ? (
                <div className="py-16 text-center text-slate-500">
                  {isAr ? 'اختر طلباً من القائمة لعرض التفاصيل والمراجعة.' : 'Select an order from the queue to inspect and review.'}
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-mono-tabular">
                        <span className="text-base font-bold text-blue-800">{selectedOrder.id}</span>
                        {selectedOrder.linkedOrderNumber && <span>· #{selectedOrder.linkedOrderNumber}</span>}
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mt-0.5">{selectedOrder.patientName}</h3>
                      <p className="text-sm text-slate-600 tabular-nums">{selectedOrder.phone} · {selectedOrder.address}</p>
                    </div>
                    <PrescriptionStatusIndicator status={selectedOrder.status} lang={lang} />
                  </div>

                  {selectedOrder.notes && (
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                      <span className="font-bold block mb-1">{isAr ? 'ملاحظات العميل:' : 'Customer Notes:'}</span>
                      {selectedOrder.notes}
                    </div>
                  )}

                  {/* Files preview */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-700">{isAr ? 'الملفات الطبية والروشتات المرفقة:' : 'Attached Prescription Files:'}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedOrder.files.map((file) => {
                        const isActive = activeFile?.id === file.id;
                        return (
                          <div
                            key={file.id}
                            onClick={() => setActiveFileId(file.id)}
                            className={`p-3 rounded-xl border cursor-pointer transition-all space-y-2 ${
                              isActive ? 'bg-blue-50 border-blue-300' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                                {file.fileType === 'image' ? (
                                  <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                                ) : (
                                  <FileText className="w-5 h-5 text-rose-600" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-slate-900 truncate">{file.name}</p>
                                <p className="text-[11px] text-slate-500">{formatFileSize(file.size)}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {activeFile && (
                      <div className="rounded-xl border border-slate-200 bg-slate-100 overflow-hidden">
                        <div className="px-3 py-2 bg-white border-b border-slate-200 flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-800 truncate">{activeFile.name}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setModalFile({
                                name: activeFile.name,
                                url: activeFile.url,
                                fileType: activeFile.fileType,
                                size: activeFile.size,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                            <span>{isAr ? 'تكبير المعاينة' : 'Maximize'}</span>
                          </button>
                        </div>
                        <div className="p-2 flex items-center justify-center max-h-[300px] overflow-auto">
                          {activeFile.fileType === 'image' ? (
                            <img src={activeFile.url} alt={activeFile.name} className="max-h-[280px] rounded-lg object-contain bg-white" />
                          ) : (
                            <iframe src={activeFile.url} title={activeFile.name} className="w-full h-[260px] rounded-lg bg-white" />
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Review & Status Actions */}
                  <div className="border-t border-slate-200 pt-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2 space-y-1">
                        <label className="block text-xs font-semibold text-slate-700">
                          {isAr ? 'ملاحظات الصيدلي للعميل' : 'Pharmacist Notes'}
                        </label>
                        <input
                          type="text"
                          value={reviewNotes}
                          onChange={(e) => setReviewNotes(e.target.value)}
                          placeholder={isAr ? 'مثال: تم توفير الأدوية وجاري التوصيل...' : 'e.g. All medications verified...'}
                          className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-700">
                          {isAr ? 'إجمالي السعر (ج.م)' : 'Estimated Total (EGP)'}
                        </label>
                        <input
                          type="number"
                          value={estimatedTotal}
                          onChange={(e) => setEstimatedTotal(e.target.value)}
                          placeholder="350"
                          className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 tabular-nums"
                        />
                      </div>
                    </div>

                    {actionError && (
                      <p className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{actionError}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleStatusDecision('approved')}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                      >
                        {isAr ? '✓ اعتماد الطلب' : 'Approve Order'}
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleStatusDecision('preparing')}
                        className="px-4 py-2 rounded-xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-900 text-xs font-semibold cursor-pointer"
                      >
                        {isAr ? '📦 تحت التجهيز' : 'Preparing'}
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleStatusDecision('out_for_delivery')}
                        className="px-4 py-2 rounded-xl bg-sky-100 border border-sky-300 hover:bg-sky-200 text-sky-950 text-xs font-semibold cursor-pointer"
                      >
                        {isAr ? '🚚 خرج للتوصيل' : 'Out for Delivery'}
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleStatusDecision('needs_clarification')}
                        className="px-4 py-2 rounded-xl bg-orange-50 border border-orange-200 hover:bg-orange-100 text-orange-900 text-xs font-semibold cursor-pointer"
                      >
                        {isAr ? '⚠️ طلب توضيح' : 'Clarification Needed'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Catalog & Product Management */}
        {activeTab === 'catalog' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {isAr ? 'إدارة الأصناف والمنتجات المعروضة للجميع' : 'Catalog & Storefront Products'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500">
                  {isAr ? 'الأصناف المضافة هنا تظهر فوراً لجميع الزوار على المتجر وقارئ الباركود.' : 'Products added here appear instantly on the customer store and barcode scanner.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddProductOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-xs"
              >
                <PackagePlus className="w-4 h-4" aria-hidden="true" />
                <span>{isAr ? 'إضافة صنف جديد' : 'Add New Product'}</span>
              </button>
            </div>

            {customProducts.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-3">
                <p className="text-sm">{isAr ? 'لا توجد أصناف مضافة يدوياً حتى الآن.' : 'No custom products added yet.'}</p>
                <button
                  type="button"
                  onClick={() => setIsAddProductOpen(true)}
                  className="px-4 py-2 bg-blue-50 text-blue-700 font-semibold text-xs rounded-xl hover:bg-blue-100 cursor-pointer"
                >
                  {isAr ? 'إضافة أول صنف الآن' : 'Add First Product Now'}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {customProducts.map((prod) => (
                  <div key={prod.id} className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3 relative flex flex-col justify-between">
                    <div className="flex items-start gap-3">
                      <img src={prod.image} alt={prod.nameAr} className="w-16 h-16 rounded-xl object-cover border border-slate-200 bg-white" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-mono-tabular uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                          {prod.sku || 'SKU'}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 truncate mt-1">{isAr ? prod.nameAr : prod.nameEn}</h4>
                        <p className="text-xs font-mono-tabular text-emerald-700 font-bold mt-0.5">{prod.price} ج.م</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                      <span>{isAr ? `المخزون: ${prod.stockCount}` : `Stock: ${prod.stockCount}`}</span>
                      <button
                        type="button"
                        onClick={() => onProductDeleted?.(prod.id)}
                        className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{isAr ? 'حذف' : 'Delete'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Customers & Loyalty */}
        {activeTab === 'customers' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-xs">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {isAr ? 'إدارة العملاء ونادي الولاء' : 'Customers & Loyalty Management'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500">
                {isAr ? 'متابعة العملاء المسجلين ونقاط الولاء الخاصة بكل زائر.' : 'Monitor customer profiles and loyalty points across visitors.'}
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-blue-50/70 border border-blue-200 text-center space-y-3">
              <Users className="w-10 h-10 text-blue-600 mx-auto" />
              <h4 className="text-base font-bold text-blue-950">
                {isAr ? 'نظام زوار مستقل ومعزول لكل رابط مشاركة' : 'Isolated Multi-Visitor Architecture Active'}
              </h4>
              <p className="text-xs text-blue-800 max-w-xl mx-auto leading-relaxed">
                {isAr
                  ? 'كل زائر يفتح رابط التطبيق يتمتع بملف ولاء ونقاط وطلبات خاصه به تماماً دون تداخل مع أي مستخدم آخر، مما يتيح لأكثر من شخص استخدام نفس الرابط بأمان تام.'
                  : 'Every visitor opening the shared link enjoys their own completely independent loyalty profile, points balance, and order history.'}
              </p>
            </div>
          </div>
        )}
      </main>

      <PrescriptionFileViewer file={modalFile} lang={lang} onClose={() => setModalFile(null)} />

      <StaffAddProductModal
        isOpen={isAddProductOpen}
        lang={lang}
        customProducts={customProducts}
        onClose={() => setIsAddProductOpen(false)}
        onProductAdded={(p) => onProductAdded?.(p)}
        onProductDeleted={(id) => onProductDeleted?.(id)}
        onAuthRequired={() => {
          setStaffSession(null);
          setAuthError(isAr ? 'انتهت صلاحية الجلسة' : 'Session expired');
        }}
      />
    </div>
  );
};
