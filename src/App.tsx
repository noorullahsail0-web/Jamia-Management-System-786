import React, { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { testFirebaseConnection } from './lib/firebase';
import { 
  Users, 
  ClipboardCheck, 
  GraduationCap, 
  LayoutDashboard, 
  LogOut, 
  Menu, 
  X,
  CreditCard,
  BookCopy,
  WifiOff,
  AlertTriangle,
  RefreshCcw,
  MoreVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './lib/utils';
import logo from './assets/logo.png';

// Pages
import Dashboard from './pages/Dashboard';
import Admission from './pages/Admission';
import Attendance from './pages/Attendance';
import Results from './pages/Results';
import DakhilKharij from './pages/DakhilKharij';

type Tab = 'dashboard' | 'admission' | 'attendance' | 'results' | 'register';

function AppMenuDropdown({ onUpdate, darkTheme = false }: { onUpdate: () => void; darkTheme?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleClose = () => setIsOpen(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [isOpen]);

  return (
    <div className="relative inline-block text-right" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "p-2 rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center border",
          darkTheme 
            ? "text-emerald-100 hover:bg-white/10 hover:text-white border-transparent active:scale-95" 
            : "text-gray-600 hover:bg-gray-100 border-transparent active:scale-95"
        )}
        title="سسٹم مینیو"
      >
        <MoreVertical className="w-5 h-5" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className={cn(
              "absolute left-0 mt-2 w-52 rounded-2xl shadow-2xl border z-[100] p-1.5 backdrop-blur-md overflow-hidden",
              darkTheme 
                ? "bg-[#0b3d32]/95 border-emerald-800/50 text-white shadow-black/45" 
                : "bg-white/95 border-gray-100 text-gray-900 shadow-gray-200"
            )}
          >
            <button
              onClick={() => {
                setIsOpen(false);
                onUpdate();
              }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-black text-right transition-all cursor-pointer",
                darkTheme 
                  ? "hover:bg-white/10 text-emerald-100 hover:text-white" 
                  : "hover:bg-gray-50 text-gray-700 hover:text-emerald-600"
              )}
            >
              <RefreshCcw className="w-4 h-4 text-amber-500 animate-spin" />
              <span>ایپ اپڈیٹ کریں (Update App)</span>
            </button>
            
            <div className={cn("h-[1px] my-1", darkTheme ? "bg-white/5" : "bg-gray-100")} />
            
            <div className={cn("px-3.5 py-1.5 text-[10px] leading-tight font-medium select-none", darkTheme ? "text-emerald-400" : "text-gray-400")}>
              جامعہ سسٹم v2.0.0
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'admin' | 'viewer' | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState(true);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isIframe, setIsIframe] = useState(false);
  const [isUpdatingApp, setIsUpdatingApp] = useState(false);

  const handleForceUpdateApp = async () => {
    setIsUpdatingApp(true);
    try {
      console.log('Force updating PWA...');
      
      // 1. Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      
      // 2. Clear all cache storages
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          await caches.delete(cacheName);
        }
      }
      
      // 3. Clear session storage
      sessionStorage.clear();
      
      // Short delay for visual feedback
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      // 4. Force reload from server
      window.location.reload();
    } catch (error) {
      console.error('Error updating app:', error);
      setIsUpdatingApp(false);
    }
  };
  
  // PWA states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [showPwaGuideModal, setShowPwaGuideModal] = useState(false);
  const [swStatus, setSwStatus] = useState<'checking' | 'active' | 'failed'>('checking');

  // Close sidebar on mobile by default & PWA installation detection
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
    // Detect if inside iframe
    try {
      setIsIframe(window.self !== window.top);
    } catch (e) {
      setIsIframe(true);
    }

    // Check Service Worker status
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => {
          setSwStatus('active');
          console.log('Service Worker is active and ready:', reg);
        })
        .catch((err) => {
          setSwStatus('failed');
          console.error('Service Worker ready check failed:', err);
        });
    } else {
      setSwStatus('failed');
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
      console.log('PWA beforeinstallprompt event captured.');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone
    ) {
      setShowInstallBtn(false);
    } else {
      setShowInstallBtn(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      setShowPwaGuideModal(true);
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User prompt response: ${outcome}`);
    setDeferredPrompt(null);
  };

  const checkConnection = async () => {
    setCheckingConnection(true);
    const isConnected = typeof navigator !== 'undefined' ? navigator.onLine : true;
    setIsFirestoreConnected(isConnected);
    setCheckingConnection(false);
  };

  useEffect(() => {
    const handleOnline = () => setIsFirestoreConnected(true);
    const handleOffline = () => setIsFirestoreConnected(false);

    if (typeof window !== 'undefined') {
      setIsFirestoreConnected(navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u && u.email) {
        const emailClean = u.email.toLowerCase().trim();
        if (emailClean === 'noorullahsail0@gmail.com') {
          setUser(u);
          setUserRole('admin');
          setLoading(false);
        } else {
          try {
            const docRef = doc(db, 'authorized_emails', emailClean);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              setUser(u);
              setUserRole(docSnap.data().role || 'viewer');
            } else {
              setUser(u);
              setUserRole(null);
            }
          } catch (error) {
            console.error("Error verifying authorized email:", error);
            setUser(u);
            setUserRole(null);
          } finally {
            setLoading(false);
          }
        }
      } else {
        setUser(null);
        setUserRole(null);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const login = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error: any) {
      console.error(error);
      if (error?.code === 'auth/cancelled-popup-request' || error?.message?.includes('cancelled-popup-request')) {
        setLoginError('لاگ ان پاپ آپ بند ہو گیا یا منسوخ ہو گیا۔ براہِ کرم دوبارہ کوشش کریں یا اوپر "نئے ٹیب میں کھولیں" بٹن استعمال کریں۔');
      } else if (error?.code === 'auth/popup-blocked' || error?.message?.includes('popup-blocked')) {
        setLoginError('براؤزر نے لاگ ان پاپ اپ کو بلاک کر دیا ہے۔ براہِ کرم پاپ اپس کی اجازت دیں یا نئے ٹیب میں کھولیں۔');
      } else {
        setLoginError(error?.message || 'لاگ ان کرنے میں کوئی نامعلوم مسئلہ پیش آیا ہے۔');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const openInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  const logout = () => signOut(auth);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950 text-white select-none relative overflow-hidden" dir="rtl">
        {/* Glow effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 flex flex-col items-center text-center px-4"
        >
          {/* Branded Logo Container with gold/amber glow */}
          <div className="mb-6 relative">
            <div className="absolute inset-0 bg-emerald-500/25 rounded-full blur-xl animate-pulse"></div>
            <img 
              src={logo} 
              alt="Logo" 
              className="w-32 h-32 relative z-10 object-contain bg-white/95 p-4 rounded-full border-2 border-amber-400 shadow-2xl" 
            />
          </div>
          
          {/* Madrasa Name */}
          <h1 className="text-2xl md:text-3xl font-bold font-nastaleeq text-amber-100 drop-shadow-md mb-2">
            جامعہ تعلیم القرآن ناگمان ضلع پشاور
          </h1>
          <p className="text-xs md:text-sm font-medium tracking-widest text-emerald-300 font-sans uppercase mb-8">
            Digital Management System
          </p>
          
          {/* Beautiful Loader */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs text-emerald-200/80 font-medium tracking-wide">
              سسٹم لوڈ ہو رہا ہے، براہِ کرم انتظار کریں...
            </span>
          </div>
        </motion.div>
        
        {/* Footer info */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-emerald-400/50 font-mono tracking-wider whitespace-nowrap">
          v2.0.0 • Digital Management System
        </div>
      </div>
    );
  }

  const isAuthorized = userRole === 'admin' || userRole === 'viewer';
  const isReadOnly = userRole === 'viewer';

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4" dir="rtl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center border border-gray-100"
        >
          <div className="mb-6">
            <img src={logo} alt="Logo" className="w-36 h-36 mx-auto object-contain bg-emerald-50 p-3 rounded-2xl border border-emerald-100/50 shadow-inner" />
          </div>
          <h1 className="text-3xl font-black text-emerald-950 mb-2 font-nastaleeq">جامعہ تعلیم القرآن ناگمان ضلع پشاور</h1>
          <p className="text-sm font-bold text-emerald-600 mb-8 uppercase tracking-widest font-sans">Digital Management System</p>
          
          <div className="space-y-4 font-urdu text-right">
            {isIframe && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900 text-xs leading-relaxed mb-1 shadow-sm">
                <p className="font-bold text-amber-950 mb-1 flex items-center gap-1.5 text-sm">
                  <span>⚠️</span>
                  <span>براؤزر فریم (Iframe) کی پابندیاں:</span>
                </p>
                <p>
                  گوگل سیکیورٹی قوانین کے تحت، اس فریم کے اندر براہِ راست لاگ ان کام نہیں کرے گا۔ براہِ کرم نیچے دیے گئے <strong>"نئے ٹیب میں کھولیں اور لاگ ان کریں"</strong> بٹن پر کلک کر کے ایپ کو نئے ٹیب میں کھولیں اور وہاں لاگ ان کریں۔
                </p>
              </div>
            )}

            {loginError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-900 text-xs leading-relaxed mb-1 shadow-sm">
                <p className="font-bold text-red-950 mb-1 flex items-center gap-1.5 text-sm">
                  <span>❌</span>
                  <span>لاگ ان میں غلطی:</span>
                </p>
                <p>{loginError}</p>
              </div>
            )}

            {isIframe && (
              <button
                onClick={openInNewTab}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg hover:shadow-amber-100 text-sm border border-amber-500/20"
              >
                <span>🔗</span>
                <span>نئے ٹیب میں کھولیں اور لاگ ان کریں</span>
              </button>
            )}

            <button
              onClick={login}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg hover:shadow-emerald-200 text-sm disabled:opacity-50 border border-emerald-600/20 mb-4"
            >
              {isLoggingIn ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              <span>Google کے ساتھ لاگ ان کریں</span>
            </button>

            {/* PWA Install Banner */}
            {showInstallBtn && (
              <div className="mt-6 border-t border-gray-100 pt-6 text-right">
                <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="bg-emerald-100 p-2 rounded-xl shrink-0 text-emerald-700">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-black text-sm text-emerald-950 mb-1">جامعہ سسٹم کی آفیشل ایپ ڈاؤن لوڈ کریں</h3>
                      <p className="text-xs text-emerald-800 leading-relaxed mb-3">
                        اسے اپنے موبائل میں ڈاؤن لوڈ کر کے بالکل ایک عام ایپ (WebAPK) کی طرح چلائیں، جو براؤزر مینو کے بغیر فل اسکرین پر تیز ترین کام کرتی ہے۔
                      </p>
                      <button
                        onClick={handleInstallClick}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition-all shadow-md text-center"
                      >
                        {deferredPrompt ? 'ابھی ایپ انسٹال کریں' : 'ایپ انسٹال کرنے کا طریقہ (شارٹ کٹ فکس)'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  if (user && !isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4" dir="rtl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-red-100 text-center relative overflow-hidden"
        >
          <div className="absolute inset-x-0 top-0 h-1.5 bg-red-650" />
          <div className="mb-6">
            <img src={logo} alt="Logo" className="w-24 h-24 mx-auto object-contain bg-red-50 p-2 rounded-2xl border border-red-100" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 border border-red-100 rounded-full text-red-700 text-xs font-bold mb-4">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>غیر مجاز رسائی</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-3 font-nastaleeq leading-tight">سسٹم تک رسائی کی اجازت نہیں ہے</h1>
          <p className="text-sm font-bold text-gray-600 mb-6 leading-relaxed font-urdu">
            آپ کا لاگ ان کردہ ای میل ایڈریس <span className="font-mono text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100">{user.email}</span> اس ڈیجیٹل سسٹم پر مجاز نہیں ہے۔ اگر آپ مدرسے کے استاد یا ساتھی ہیں تو براہِ کرم ایڈمنسٹریٹر نوراللہ صاحب سے رابطہ کریں تاکہ وہ آپ کا ای میل پتا مجاز فہرست (Authorized List) میں شامل کر سکیں۔
          </p>
          <div className="space-y-3 font-urdu">
            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg hover:shadow-red-200"
            >
              <LogOut className="w-4 h-4" />
              <span>لاگ آؤٹ اور دوسرے اکاؤنٹ سے لاگ ان کریں</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const menuItems = [
    { id: 'dashboard', label: 'ڈیش بورڈ', icon: LayoutDashboard },
    { id: 'admission', label: 'نیا داخلہ / طلباء', icon: Users },
    { id: 'attendance', label: 'حاضری سسٹم', icon: ClipboardCheck },
    { id: 'results', label: 'نتائج سسٹم', icon: GraduationCap },
    { id: 'register', label: 'داخل خارج رجسٹر', icon: BookCopy },
  ];

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden font-urdu" dir="rtl">
      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 right-0 z-50 bg-[#022c22] text-white transition-all duration-300 transform lg:relative lg:translate-x-0 h-full border-l border-emerald-800/30",
          isSidebarOpen ? "w-72" : "translate-x-full lg:translate-x-0 lg:w-20"
        )}
      >
        <div className="p-3 flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between mb-6 mt-1 pb-4 border-b border-white/5">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="bg-white p-1.5 rounded-xl shrink-0 shadow-lg shadow-black/20">
                <img src={logo} alt="Logo" className="w-8 h-8 object-contain" />
              </div>
              <div className={cn("transition-all duration-300 origin-right overflow-hidden", !isSidebarOpen && "lg:w-0 lg:opacity-0")}>
                <h2 className="text-xs font-black whitespace-nowrap leading-tight text-emerald-50">جامعہ تعلیم القرآن ناگمان ضلع پشاور</h2>
                <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider leading-none mt-0.5">Management System</p>
              </div>
            </div>
            {isSidebarOpen && (
              <AppMenuDropdown onUpdate={handleForceUpdateApp} darkTheme={true} />
            )}
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar pr-1 pl-1 text-right">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as Tab);
                  if (window.innerWidth < 1024) {
                    setIsSidebarOpen(false);
                  }
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-300 group text-right relative overflow-hidden",
                  activeTab === item.id 
                    ? "bg-emerald-600/10 text-emerald-400 font-black border border-emerald-500/20" 
                    : "text-emerald-100/60 hover:bg-white/5 hover:text-white"
                )}
              >
                {activeTab === item.id && (
                  <motion.div 
                    layoutId="active-pill"
                    className="absolute right-0 top-1.5 bottom-1.5 w-1 bg-emerald-500 rounded-full"
                  />
                )}
                <item.icon className={cn(
                  "w-4 h-4 transition-transform duration-300 group-hover:scale-110",
                  activeTab === item.id ? "text-emerald-400" : "text-emerald-600 group-hover:text-emerald-400"
                )} />
                <span className={cn("transition-all duration-300 text-sm", !isSidebarOpen && "lg:hidden")}>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-2 border-t border-white/5">
            {/* PWA Install Button inside Sidebar */}
            {showInstallBtn && (
              <button
                onClick={handleInstallClick}
                className={cn(
                  "w-full mb-2.5 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs transition-all shadow-md border border-amber-500/10 shrink-0",
                  !isSidebarOpen && "lg:p-1.5 lg:w-10 lg:h-10 lg:mx-auto"
                )}
                title="ایپ انسٹال کریں"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span className={cn("transition-all duration-300 whitespace-nowrap", !isSidebarOpen && "lg:hidden")}>
                  {deferredPrompt ? 'موبائل ایپ انسٹال کریں' : 'ایپ انسٹالیشن گائیڈ'}
                </span>
              </button>
            )}

            <div className={cn("bg-emerald-950/50 p-2.5 rounded-xl border border-white/5 mb-2 transition-all duration-300", !isSidebarOpen && "lg:p-1.5 lg:items-center lg:flex lg:justify-center")}>
              <div className="flex items-center gap-2.5">
                <img 
                  src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                  className="w-8 h-8 rounded-lg border-2 border-emerald-800/50 shadow-sm"
                  alt="Profile"
                />
                <div className={cn("flex-1 overflow-hidden transition-all duration-300 text-right", !isSidebarOpen && "lg:hidden")}>
                  <p className="text-xs font-black truncate text-emerald-50 leading-tight">{user.displayName}</p>
                  <p className="text-[9px] text-emerald-500 font-bold truncate leading-tight mt-0.5">{user.email}</p>
                </div>
              </div>
              
              <button
                onClick={logout}
                className={cn(
                  "w-full mt-2.5 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white/5 hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-all text-[11px] font-bold border border-white/5",
                  !isSidebarOpen && "lg:hidden"
                )}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>لاگ آؤٹ</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative overflow-y-auto outline-none focus:outline-none">
        {/* Header (Mobile) */}
        <header className="lg:hidden bg-white border-b px-4 py-4 sticky top-0 z-40 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Logo" className="w-8 h-8 object-contain" />
            <h1 className="text-lg font-bold text-emerald-950 font-nastaleeq">جامعہ تعلیم القرآن ناگمان ضلع پشاور</h1>
          </div>
          <div className="flex items-center gap-1.5">
            <AppMenuDropdown onUpdate={handleForceUpdateApp} darkTheme={false} />
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
            >
              {isSidebarOpen ? <X /> : <Menu />}
            </button>
          </div>
        </header>

        <div className="p-4 lg:p-8 w-full">
          {!isFirestoreConnected && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 bg-amber-50 border-2 border-amber-200 p-4 rounded-2xl flex flex-col items-center justify-between gap-4 shadow-sm text-right"
            >
              <div className="flex flex-col md:flex-row items-center gap-4 text-amber-800 w-full">
                <div className="bg-amber-100 p-2.5 rounded-full shrink-0 text-amber-650">
                  <WifiOff className="w-6 h-6" />
                </div>
                <div className="text-right flex-1">
                  <h3 className="font-black text-base text-amber-950">انٹرنیٹ کنکشن دستیاب نہیں ہے (آف لائن موڈ)</h3>
                  <p className="text-xs opacity-90 leading-relaxed mt-0.5">آپ اس وقت انٹرنیٹ کے بغیر کام کر رہے ہیں۔ پریشان نہ ہوں! آپ کا اندراج شدہ ڈیٹا محفوظ رہے گا اور جیسے ہی انٹرنیٹ بحال ہوگا، سلیقے سے خودکار طور پر ڈیٹا بیس میں شامل ہو جائے گا۔</p>
                </div>
                <button 
                  onClick={checkConnection}
                  disabled={checkingConnection}
                  className="flex items-center gap-2 bg-amber-600 text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-amber-700 transition-all disabled:opacity-50 whitespace-nowrap border border-amber-600/20"
                >
                  {checkingConnection ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
                  رابطہ دوبارہ چیک کریں
                </button>
              </div>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab as (tab: string) => void} isReadOnly={isReadOnly} userRole={userRole} />}
              {activeTab === 'admission' && <Admission isReadOnly={isReadOnly} />}
              {activeTab === 'attendance' && <Attendance isReadOnly={isReadOnly} />}
              {activeTab === 'results' && <Results isReadOnly={isReadOnly} />}
              {activeTab === 'register' && <DakhilKharij isReadOnly={isReadOnly} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* PWA Guide Modal */}
      <AnimatePresence>
        {showPwaGuideModal && (
          <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4 animate-fade-in" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="max-w-md w-full bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-emerald-100 text-right font-urdu"
            >
              <div className="bg-[#022c22] p-5 text-white flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">📱</span>
                  <h3 className="font-black text-lg font-nastaleeq leading-tight text-white">ایپ انسٹال کرنے کا حتمی طریقہ</h3>
                </div>
                <button 
                  onClick={() => setShowPwaGuideModal(false)}
                  className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-sm leading-relaxed text-gray-800 overflow-y-auto max-h-[80vh] custom-scrollbar">
                {/* Real-time Diagnostics Card */}
                <div className="bg-emerald-50 border border-emerald-150 rounded-2xl p-4 text-xs space-y-2">
                  <p className="font-black text-emerald-950 mb-1 flex items-center gap-1.5 text-sm">
                    <span>⚙️</span>
                    <span>سسٹم کا لائیو اسٹیٹس (Diagnostics):</span>
                  </p>
                  <div className="flex justify-between items-center py-1 border-b border-emerald-100/50">
                    <span className="text-gray-600 font-medium">سروس ورکر (Service Worker):</span>
                    {swStatus === 'active' ? (
                      <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span>فعال اور تیار ہے</span>
                        <span>✔️</span>
                      </span>
                    ) : swStatus === 'checking' ? (
                      <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span>چیک ہو رہا ہے</span>
                        <span>⏳</span>
                      </span>
                    ) : (
                      <span className="font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span>لوڈ نہیں ہوا</span>
                        <span>❌</span>
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-gray-600 font-medium">براؤزر انسٹالر (Prompt State):</span>
                    {deferredPrompt ? (
                      <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span>کلک کے لیے تیار</span>
                        <span>✔️</span>
                      </span>
                    ) : (
                      <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span>مینو سے دستیاب</span>
                        <span>🔍</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Warning about Incognito */}
                <div className="bg-red-50 border border-red-150 rounded-2xl p-4 text-red-950 text-xs">
                  <p className="font-black mb-1 flex items-center gap-1 text-red-900">
                    <span>⚠️</span>
                    <span>اہم تنبیہ (خفیہ موڈ استعمال نہ کریں):</span>
                  </p>
                  <p>
                    گوگل کروم کے <strong>Incognito (خفیہ/پرائیویٹ) موڈ میں ایپ انسٹالیشن مکمل بند ہوتی ہے</strong>۔ اس بات کو یقینی بنائیں کہ آپ کروم کا عام/نارمل موڈ استعمال کر رہے ہیں۔
                  </p>
                </div>

                <div className="space-y-4 text-right">
                  {/* Step 1: Chrome New Menu */}
                  <div className="flex gap-3 items-start">
                    <span className="bg-emerald-100 text-emerald-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
                    <div>
                      <p className="font-black text-gray-900">کروم کے نئے "محفوظ اور شیئر کریں" مینو میں دیکھیں:</p>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                        گوگل کروم کی نئی اپڈیٹ میں انسٹال کا بٹن تبدیل کر دیا گیا ہے۔ براؤزر کے اوپر دائیں کونے میں تین نقطوں <strong>(⋮)</strong> پر کلک کریں، پھر <strong>"Save and share" (محفوظ کریں اور شیئر کریں)</strong> پر جائیں۔ وہاں آپ کو <strong>"Install app"</strong> یا <strong>"جامعہ سسٹم انسٹال کریں"</strong> کا بٹن مل جائے گا!
                      </p>
                    </div>
                  </div>

                  {/* Step 2: Mobile/Android Chrome */}
                  <div className="flex gap-3 items-start">
                    <span className="bg-emerald-100 text-emerald-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
                    <div>
                      <p className="font-black text-gray-900">موبائل فون پر انسٹال کرنے کا طریقہ:</p>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                        اپنے اینڈرائیڈ فون کے کروم براؤزر میں یہ لنک کھولیں، تین نقطوں <strong>(⋮)</strong> پر کلک کریں اور مینو سے <strong>"Install app"</strong> یا <strong>"Add to Home screen"</strong> پر کلک کریں۔ ایپ فوری طور پر موبائل کی ہوم اسکرین پر آ جائے گی۔
                      </p>
                    </div>
                  </div>

                  {/* Step 3: Clear and reload (Vercel Fix) */}
                  <div className="flex gap-3 items-start">
                    <span className="bg-emerald-100 text-emerald-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</span>
                    <div>
                      <p className="font-black text-gray-900">پرانے ڈیٹا (Cache) کو مکمل ہٹائیں:</p>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                        چونکہ آپ نے ورسل پر پروجیکٹ دوبارہ ڈیپلائے کیا ہے، براؤزر پرانی فائلیں استعمال کر رہا ہو سکتا ہے۔ کروم کے تین نقطوں پر کلک کر کے <strong>Settings &gt; Privacy and security &gt; Clear browsing data</strong> پر جائیں، وہاں صرف <strong>"Cached images and files"</strong> کو منتخب کر کے صاف کریں اور پیج کو 2 بار ریفریش کریں۔
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowPwaGuideModal(false)}
                  className="w-full mt-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold py-3.5 px-4 rounded-xl shadow-md transition-all text-center text-xs"
                >
                  ٹھیک ہے، میں سمجھ گیا
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modern Update Overlay with animation */}
      <AnimatePresence>
        {isUpdatingApp && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#022c22]/98 z-[9999] flex flex-col items-center justify-center text-white font-urdu p-4"
          >
            <div className="absolute inset-0 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
            <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
              <div className="mb-6 relative">
                <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl animate-pulse"></div>
                <img 
                  src={logo} 
                  alt="Logo" 
                  className="w-24 h-24 relative z-10 object-contain bg-white p-3 rounded-full border-2 border-amber-400 shadow-2xl" 
                />
              </div>
              <h2 className="text-2xl font-black font-nastaleeq text-amber-100 mb-2">جامعہ سسٹم اپڈیٹ ہو رہا ہے...</h2>
              <p className="text-xs text-emerald-300 mb-6 font-sans">Updating Digital Management System</p>
              
              <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-6"></div>
              
              <p className="text-sm text-emerald-200/90 font-black leading-relaxed">
                جدید ترین تعلیمی فائلیں، پرچوں کے نئے کالم اور نیا مدرسہ لوگو لوڈ کیا جا رہا ہے۔
              </p>
              <p className="text-xs text-emerald-300/70 font-bold leading-relaxed mt-2">
                براہِ کرم چند سیکنڈ انتظار کریں، سسٹم خودکار طور پر ری اسٹارٹ ہوگا۔
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
