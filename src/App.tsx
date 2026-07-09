import React, { useState, useEffect } from 'react';
import { auth } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
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
  RefreshCcw
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

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState(true);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isIframe, setIsIframe] = useState(false);

  // Close sidebar on mobile by default
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
  }, []);

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
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const isAdminEmail = user && user.email && user.email.toLowerCase().trim() === 'noorullahsail0@gmail.com';

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
              className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg hover:shadow-emerald-200 text-sm disabled:opacity-50 border border-emerald-600/20"
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
          </div>
        </motion.div>
      </div>
    );
  }

  if (user && !isAdminEmail) {
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
          <h1 className="text-2xl font-black text-gray-900 mb-3 font-nastaleeq leading-tight">سستم تک رسائی کی اجازت نہیں ہے</h1>
          <p className="text-sm font-bold text-gray-600 mb-6 leading-relaxed font-urdu">
            آپ کا لاگ ان کردہ ای میل ایڈریس <span className="font-mono text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100">{user.email}</span> اس ڈیجیٹل سسٹم پر ایڈمنسٹریٹر الیکٹرانک میل پتے (<span className="font-mono text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100">noorullahsail0@gmail.com</span>) سے میل نہیں کھاتا۔
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
          <div className="flex items-center gap-3 mb-6 mt-1 pb-4 border-b border-white/5">
            <div className="bg-white p-1.5 rounded-xl shrink-0 shadow-lg shadow-black/20">
              <img src={logo} alt="Logo" className="w-8 h-8 object-contain" />
            </div>
            <div className={cn("transition-all duration-300 origin-right overflow-hidden", !isSidebarOpen && "lg:w-0 lg:opacity-0")}>
              <h2 className="text-xs font-black whitespace-nowrap leading-tight text-emerald-50">جامعہ تعلیم القرآن ناگمان ضلع پشاور</h2>
              <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider leading-none mt-0.5">Management System</p>
            </div>
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
            <h1 className="text-lg font-bold">جامعہ تعلیم القرآن ناگمان ضلع پشاور</h1>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            {isSidebarOpen ? <X /> : <Menu />}
          </button>
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
              {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab as (tab: string) => void} />}
              {activeTab === 'admission' && <Admission />}
              {activeTab === 'attendance' && <Attendance />}
              {activeTab === 'results' && <Results />}
              {activeTab === 'register' && <DakhilKharij />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
