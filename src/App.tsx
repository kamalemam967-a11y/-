import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { BottomNavBar } from './components/BottomNavBar';
import { CartDrawer } from './components/CartDrawer';
import { CategoryView } from './components/CategoryView';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { HomeView } from './components/HomeView';
import {
  NotificationBellButton,
  NotificationToastStack,
} from './components/NotificationCenter';
import { PrescriptionView } from './components/PrescriptionView';
import { ProductDetailView } from './components/ProductDetailView';
import { UserProfileView } from './components/UserProfileView';
import { AdminDashboardView } from './components/AdminDashboardView';
import {
  loadSavedVisitor,
  saveVisitor,
  VisitorIdentity,
  WelcomeGate,
} from './components/WelcomeGate';
import { WhatsAppWidget } from './components/WhatsAppWidget';
import { PRODUCTS } from './data/catalog';
import { fetchLoyaltyProfile, updateLoyaltyProfile } from './services/loyaltyApi';
import { fetchPrescriptions } from './services/prescriptionApi';
import { fetchCustomProducts } from './services/productCatalogApi';
import {
  BrowserNotificationPermission,
  buildStatusNotificationText,
  dispatchBrowserNotification,
  getBrowserNotificationPermission,
  loadSavedAlerts,
  playNotificationChime,
  requestBrowserNotificationPermission,
  saveAlerts,
} from './services/prescriptionNotifications';
import {
  CartItem,
  CategoryId,
  Language,
  PrescriptionAlert,
  PrescriptionStatus,
  PrescriptionSubmission,
  Product,
  UserLoyaltyProfile,
} from './types/pharmacy';

type AppRoute =
  | { view: 'home' }
  | { view: 'category'; categoryId: CategoryId | 'all' | 'offers' }
  | { view: 'product'; productId: string }
  | { view: 'prescription'; mode?: 'patient' | 'staff' }
  | { view: 'profile' }
  | { view: 'admin' };

export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('mar_pharmacy_lang');
      return saved === 'en' ? 'en' : 'ar';
    } catch {
      return 'ar';
    }
  });

  const [visitor, setVisitor] = useState<VisitorIdentity | null>(() => loadSavedVisitor());
  const [route, setRoute] = useState<AppRoute>({ view: 'home' });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);

  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem('mar_pharmacy_cart');
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Array<{ productId: string; quantity: number }>;
      return parsed
        .map((entry) => {
          const product = PRODUCTS.find((p) => p.id === entry.productId);
          return product ? { product, quantity: Math.max(1, entry.quantity) } : null;
        })
        .filter((x): x is CartItem => x !== null);
    } catch {
      return [];
    }
  });

  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('mar_pharmacy_wishlist');
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  const [prescriptions, setPrescriptions] = useState<PrescriptionSubmission[]>([]);
  const [isLoadingPrescriptions, setIsLoadingPrescriptions] = useState(false);
  const [loyaltyProfile, setLoyaltyProfile] = useState<UserLoyaltyProfile | null>(null);
  const [customProducts, setCustomProducts] = useState<Product[]>([]);

  const allProducts = useMemo(() => [...customProducts, ...PRODUCTS], [customProducts]);

  const [alerts, setAlerts] = useState<PrescriptionAlert[]>(() => loadSavedAlerts());
  const [toasts, setToasts] = useState<PrescriptionAlert[]>([]);
  const [notificationPermission, setNotificationPermission] =
    useState<BrowserNotificationPermission>(() => getBrowserNotificationPermission());

  const previousStatusesRef = useRef<Map<string, PrescriptionStatus>>(new Map());
  const hasInitializedStatusesRef = useRef(false);
  const langRef = useRef(lang);

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  useEffect(() => {
    saveAlerts(alerts);
  }, [alerts]);

  const enqueueStatusAlert = useCallback(
    (order: PrescriptionSubmission, previousStatus: PrescriptionStatus) => {
      const alert: PrescriptionAlert = {
        id: `${order.id}-${order.status}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        rxId: order.id,
        patientName: order.patientName,
        previousStatus,
        newStatus: order.status,
        reviewNotes: order.reviewNotes,
        timestamp: order.updatedAt || new Date().toISOString(),
        read: false,
      };

      setAlerts((prev) => [alert, ...prev].slice(0, 20));
      setToasts((prev) => [alert, ...prev].slice(0, 3));

      window.setTimeout(() => {
        setToasts((prev) => prev.filter((tItem) => tItem.id !== alert.id));
      }, 9000);

      const { title, body } = buildStatusNotificationText(
        langRef.current,
        order.id,
        order.patientName,
        order.status,
        order.reviewNotes
      );

      dispatchBrowserNotification({
        title,
        body,
        tag: `mar-rx-${order.id}-${order.status}`,
        onClick: () => {
          setRoute({ view: 'prescription', mode: 'patient' });
          setAlerts((prev) =>
            prev.map((item) => (item.id === alert.id ? { ...item, read: true } : item))
          );
        },
      });
      playNotificationChime();
    },
    []
  );

  const reconcileSubmissions = useCallback(
    (incomingList: PrescriptionSubmission[]) => {
      if (!hasInitializedStatusesRef.current) {
        const initialMap = new Map<string, PrescriptionStatus>();
        for (const sub of incomingList) {
          initialMap.set(sub.id, sub.status);
        }
        previousStatusesRef.current = initialMap;
        hasInitializedStatusesRef.current = true;
        return;
      }

      for (const sub of incomingList) {
        const prevStatus = previousStatusesRef.current.get(sub.id);
        if (prevStatus && prevStatus !== sub.status) {
          enqueueStatusAlert(sub, prevStatus);
        }
        previousStatusesRef.current.set(sub.id, sub.status);
      }
    },
    [enqueueStatusAlert]
  );

  const loadPrescriptions = useCallback(async () => {
    setIsLoadingPrescriptions(true);
    try {
      const data = await fetchPrescriptions();
      reconcileSubmissions(data);
      setPrescriptions(data);
    } catch {
      // keep existing state on transient network error
    } finally {
      setIsLoadingPrescriptions(false);
    }
  }, [reconcileSubmissions]);

  const onboardingSyncedRef = useRef(false);

  useEffect(() => {
    void loadPrescriptions();
    void fetchLoyaltyProfile()
      .then((profile) => {
        setLoyaltyProfile((prev) => {
          if (onboardingSyncedRef.current && prev) return prev;
          return profile;
        });
      })
      .catch(() => {});
    void fetchCustomProducts()
      .then(setCustomProducts)
      .catch(() => {});
  }, [loadPrescriptions]);

  const handleCompleteOnboarding = useCallback(
    async (identity: VisitorIdentity) => {
      onboardingSyncedRef.current = true;
      saveVisitor(identity);
      setVisitor(identity);
      setLoyaltyProfile((prev) =>
        prev
          ? { ...prev, fullName: identity.fullName, phone: identity.phone }
          : prev
      );
      try {
        const updatedProfile = await updateLoyaltyProfile({
          fullName: identity.fullName,
          phone: identity.phone,
          address: loyaltyProfile?.address || '',
        });
        setLoyaltyProfile(updatedProfile);
      } catch {
        // visitor already saved locally so user can enter smoothly even if offline
      }
    },
    [loyaltyProfile?.address]
  );

  // Real-time Server-Sent Events stream for instant browser & in-app alerts across tabs
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') {
      return;
    }

    const source = new window.EventSource('/api/prescriptions/events');
    const onPrescriptionUpdated = (event: MessageEvent<string>) => {
      try {
        const updated = JSON.parse(event.data) as PrescriptionSubmission;
        if (!updated || !updated.id) return;

        const prevStatus = previousStatusesRef.current.get(updated.id);
        if (hasInitializedStatusesRef.current && prevStatus && prevStatus !== updated.status) {
          enqueueStatusAlert(updated, prevStatus);
        }
        previousStatusesRef.current.set(updated.id, updated.status);

        setPrescriptions((prev) => {
          const exists = prev.some((p) => p.id === updated.id);
          if (!exists) return [updated, ...prev];
          return prev.map((p) => (p.id === updated.id ? updated : p));
        });
      } catch {
        // ignore malformed SSE payloads
      }
    };

    source.addEventListener('prescription_updated', onPrescriptionUpdated as EventListener);
    return () => {
      source.removeEventListener('prescription_updated', onPrescriptionUpdated as EventListener);
      source.close();
    };
  }, [enqueueStatusAlert]);

  // Fallback global polling + focus refresh so customers stay alerted anywhere in the app
  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadPrescriptions();
    }, 10000);

    const handleFocus = () => {
      setNotificationPermission(getBrowserNotificationPermission());
      void loadPrescriptions();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadPrescriptions]);

  const handleRequestNotificationPermission = useCallback(async () => {
    const result = await requestBrowserNotificationPermission();
    setNotificationPermission(result);
  }, []);

  const handleSendTestNotification = useCallback(async () => {
    let perm = getBrowserNotificationPermission();
    if (perm === 'default') {
      perm = await requestBrowserNotificationPermission();
      setNotificationPermission(perm);
    }
    const sampleOrder = prescriptions[0];
    const sampleRxId = sampleOrder?.id || 'RX-2026-4102';
    const sampleName = sampleOrder?.patientName || (lang === 'ar' ? 'طلب روشتة تجريبي' : 'Sample Patient');
    const nextSampleStatus: PrescriptionStatus =
      sampleOrder?.status === 'ready_for_pickup' ? 'out_for_delivery' : 'ready_for_pickup';

    enqueueStatusAlert(
      {
        id: sampleRxId,
        patientName: sampleName,
        phone: sampleOrder?.phone || '01000000000',
        address: sampleOrder?.address || '',
        notes: '',
        files: sampleOrder?.files || [],
        status: nextSampleStatus,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        statusHistory: [],
        reviewNotes:
          lang === 'ar'
            ? 'تنبيه تجريبي: الروشتة جاهزة ويمكنك متابعتها الآن.'
            : 'Test notification: Your prescription status has been updated.',
      },
      sampleOrder?.status || 'preparing'
    );
  }, [prescriptions, lang, enqueueStatusAlert]);

  // Synchronize HTML lang & dir attributes dynamically for Arabic RTL / English LTR
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try {
      localStorage.setItem('mar_pharmacy_lang', lang);
    } catch {
      // ignore storage quota errors
    }
  }, [lang]);

  useEffect(() => {
    try {
      const compact = cartItems.map((c) => ({
        productId: c.product.id,
        quantity: c.quantity,
      }));
      localStorage.setItem('mar_pharmacy_cart', JSON.stringify(compact));
    } catch {
      // ignore storage errors
    }
  }, [cartItems]);

  useEffect(() => {
    try {
      localStorage.setItem('mar_pharmacy_wishlist', JSON.stringify(wishlist));
    } catch {
      // ignore storage errors
    }
  }, [wishlist]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleLanguage = () => {
    setLang((prev) => (prev === 'ar' ? 'en' : 'ar'));
  };

  const handleNavigateHome = () => {
    setRoute({ view: 'home' });
    scrollToTop();
  };

  const handleSelectCategory = (categoryId: CategoryId | 'all' | 'offers') => {
    setRoute({ view: 'category', categoryId });
    scrollToTop();
  };

  const handleSelectProduct = (product: Product) => {
    setRoute({ view: 'product', productId: product.id });
    scrollToTop();
  };

  const handleOpenPrescription = (mode: 'patient' | 'staff' = 'patient') => {
    setRoute({ view: 'prescription', mode });
    void loadPrescriptions();
    scrollToTop();
  };

  const handleOpenProfile = () => {
    setRoute({ view: 'profile' });
    void fetchLoyaltyProfile()
      .then(setLoyaltyProfile)
      .catch(() => {});
    scrollToTop();
  };

  const handleAddToCart = (product: Product, quantity = 1) => {
    if (product.stockCount <= 0) return;
    setCartItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: Math.min(product.stockCount, item.quantity + quantity),
              }
            : item
        );
      }
      return [
        ...prev,
        { product, quantity: Math.min(product.stockCount, Math.max(1, quantity)) },
      ];
    });
  };

  const handleUpdateCartQuantity = (productId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.product.id !== productId) return item;
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return null;
          return {
            ...item,
            quantity: Math.min(item.product.stockCount, nextQty),
          };
        })
        .filter((x): x is CartItem => x !== null)
    );
  };

  const handleRemoveCartItem = (productId: string) => {
    setCartItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  const handleToggleWishlist = (productId: string) => {
    setWishlist((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const handleOrderCreated = (submission: PrescriptionSubmission) => {
    previousStatusesRef.current.set(submission.id, submission.status);
    setPrescriptions((prev) => [submission, ...prev.filter((p) => p.id !== submission.id)]);
  };

  const handleOrderUpdated = (updated: PrescriptionSubmission) => {
    const prevStatus = previousStatusesRef.current.get(updated.id);
    if (prevStatus && prevStatus !== updated.status) {
      enqueueStatusAlert(updated, prevStatus);
    }
    previousStatusesRef.current.set(updated.id, updated.status);
    setPrescriptions((prev) => {
      const exists = prev.some((p) => p.id === updated.id);
      if (!exists) return [updated, ...prev];
      return prev.map((p) => (p.id === updated.id ? updated : p));
    });
  };

  const totalCartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const activeHeaderView:
    | 'home'
    | 'category'
    | 'product'
    | 'offers'
    | 'prescription'
    | 'profile' =
    route.view === 'admin'
      ? 'home'
      : route.view === 'category' && route.categoryId === 'offers'
        ? 'offers'
        : route.view;

  const selectedProduct =
    route.view === 'product'
      ? allProducts.find((p) => p.id === route.productId) || allProducts[0]
      : null;

  if (!visitor) {
    return (
      <WelcomeGate
        lang={lang}
        onToggleLanguage={handleToggleLanguage}
        onComplete={handleCompleteOnboarding}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F8FC] text-slate-800 pb-16">
      <Header
        lang={lang}
        onToggleLanguage={handleToggleLanguage}
        cartCount={totalCartCount}
        onOpenCart={() => setIsCartOpen(true)}
        onNavigateHome={handleNavigateHome}
        onNavigateAllCategories={() => handleSelectCategory('all')}
        onNavigateOffers={() => handleSelectCategory('offers')}
        onOpenPrescription={handleOpenPrescription}
        onOpenProfile={handleOpenProfile}
        onOpenBarcodeScanner={() => setIsBarcodeScannerOpen(true)}
        loyaltyPoints={loyaltyProfile?.pointsBalance ?? 0}
        activeView={activeHeaderView}
        notificationSlot={
          <NotificationBellButton
            lang={lang}
            alerts={alerts}
            permission={notificationPermission}
            onRequestPermission={handleRequestNotificationPermission}
            onMarkAllRead={() =>
              setAlerts((prev) => prev.map((item) => ({ ...item, read: true })))
            }
            onMarkRead={(id) =>
              setAlerts((prev) =>
                prev.map((item) => (item.id === id ? { ...item, read: true } : item))
              )
            }
            onClearAll={() => setAlerts([])}
            onSelectAlert={() => handleOpenPrescription('patient')}
            onSendTestAlert={() => void handleSendTestNotification()}
          />
        }
      />

      <div className="flex-1">
        {route.view === 'home' && (
          <HomeView
            lang={lang}
            products={allProducts}
            onSelectCategory={(catId) => handleSelectCategory(catId)}
            onSelectAllCategories={() => handleSelectCategory('all')}
            onSelectOffers={() => handleSelectCategory('offers')}
            onSelectProduct={handleSelectProduct}
            onAddToCart={(product) => handleAddToCart(product, 1)}
            onOpenPrescription={handleOpenPrescription}
          />
        )}

        {route.view === 'category' && (
          <CategoryView
            lang={lang}
            products={allProducts}
            selectedCategoryId={route.categoryId}
            onChangeCategory={(id) => handleSelectCategory(id)}
            onSelectProduct={handleSelectProduct}
            onAddToCart={(product) => handleAddToCart(product, 1)}
            onBackHome={handleNavigateHome}
          />
        )}

        {route.view === 'product' && selectedProduct && (
          <ProductDetailView
            product={selectedProduct}
            products={allProducts}
            lang={lang}
            isWishlisted={wishlist.includes(selectedProduct.id)}
            onToggleWishlist={handleToggleWishlist}
            onAddToCart={handleAddToCart}
            onSelectProduct={handleSelectProduct}
            onBackToCategory={(catId) => handleSelectCategory(catId)}
            onBackHome={handleNavigateHome}
            onOpenPrescription={handleOpenPrescription}
          />
        )}

        {route.view === 'prescription' && (
          <PrescriptionView
            key={route.mode || 'patient'}
            lang={lang}
            initialMode={route.mode || 'patient'}
            submissions={prescriptions}
            isLoading={isLoadingPrescriptions}
            onRefresh={() => void loadPrescriptions()}
            onOrderCreated={handleOrderCreated}
            onOrderUpdated={handleOrderUpdated}
            onBackHome={handleNavigateHome}
            notificationPermission={notificationPermission}
            onRequestNotificationPermission={handleRequestNotificationPermission}
            onSendTestNotification={() => void handleSendTestNotification()}
            defaultCustomerName={loyaltyProfile?.fullName || visitor.fullName}
            defaultCustomerPhone={loyaltyProfile?.phone || visitor.phone}
            defaultCustomerAddress={loyaltyProfile?.address || ''}
            customProducts={customProducts}
            onProductAdded={(product) =>
              setCustomProducts((prev) => [product, ...prev.filter((p) => p.id !== product.id)])
            }
            onProductDeleted={(productId) => {
              setCustomProducts((prev) => prev.filter((p) => p.id !== productId));
              setCartItems((prev) => prev.filter((c) => c.product.id !== productId));
            }}
          />
        )}

        {route.view === 'profile' && (
          <UserProfileView
            lang={lang}
            profile={loyaltyProfile}
            onProfileUpdated={setLoyaltyProfile}
            onBackHome={handleNavigateHome}
            onBrowseCatalog={() => handleSelectCategory('all')}
            onOpenCart={() => setIsCartOpen(true)}
          />
        )}

        {route.view === 'admin' && (
          <AdminDashboardView
            lang={lang}
            submissions={prescriptions}
            onOrderUpdated={handleOrderUpdated}
            customProducts={customProducts}
            onProductAdded={(product) =>
              setCustomProducts((prev) => [product, ...prev.filter((p) => p.id !== product.id)])
            }
            onProductDeleted={(productId) => {
              setCustomProducts((prev) => prev.filter((p) => p.id !== productId));
              setCartItems((prev) => prev.filter((c) => c.product.id !== productId));
            }}
            onBackHome={handleNavigateHome}
          />
        )}
      </div>

      <Footer
        lang={lang}
        onSelectCategory={(id) => handleSelectCategory(id)}
        onNavigateOffers={() => handleSelectCategory('offers')}
        onOpenPrescription={() => handleOpenPrescription('patient')}
        onOpenStaffPortal={() => handleOpenPrescription('staff')}
        onOpenAdmin={() => {
          setRoute({ view: 'admin' });
          scrollToTop();
        }}
        onOpenProfile={handleOpenProfile}
        onToggleLanguage={handleToggleLanguage}
      />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        lang={lang}
        items={cartItems}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={handleClearCart}
        onBrowseCatalog={() => handleSelectCategory('all')}
        onPrescriptionCreated={handleOrderCreated}
        loyaltyProfile={loyaltyProfile}
        onLoyaltyUpdated={setLoyaltyProfile}
      />

      <BarcodeScannerModal
        isOpen={isBarcodeScannerOpen}
        lang={lang}
        products={allProducts}
        onClose={() => setIsBarcodeScannerOpen(false)}
        onSelectProduct={handleSelectProduct}
        onAddToCart={(product) => handleAddToCart(product, 1)}
        onAskPharmacist={() => handleOpenPrescription('patient')}
      />

      <NotificationToastStack
        lang={lang}
        toasts={toasts}
        onDismissToast={(id) => setToasts((prev) => prev.filter((item) => item.id !== id))}
        onTrackOrder={(alert) => {
          setAlerts((prev) =>
            prev.map((item) => (item.id === alert.id ? { ...item, read: true } : item))
          );
          setToasts((prev) => prev.filter((item) => item.id !== alert.id));
          handleOpenPrescription('patient');
        }}
      />

      <WhatsAppWidget lang={lang} onOpenPrescription={() => handleOpenPrescription('patient')} />

      <BottomNavBar
        lang={lang}
        activeView={activeHeaderView}
        onNavigateHome={handleNavigateHome}
        onNavigateCategories={() => handleSelectCategory('all')}
        onNavigateOffers={() => handleSelectCategory('offers')}
        onOpenPrescription={() => handleOpenPrescription('patient')}
        onOpenProfile={handleOpenProfile}
      />
    </div>
  );
}
