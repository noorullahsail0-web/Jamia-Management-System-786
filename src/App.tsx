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

  // Close sidebar on mobile by default
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, []);

  const checkConnection = async () => {
    setCheckingConnection(true);
    const isConnected = await testFirebaseConnection();
    setIsFirestoreConnected(isConnected);
    setCheckingConnection(false);
  };

  useEffect(() => {
    checkConnection();
    // Re-check periodically
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        testFirebaseConnection().then(isConnected => {
          setIsFirestoreConnected(isConnected);
        });
      }
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      console.error(error);
    }
  };

  const logout = () => signOut(auth);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center"
        >
          <div className="mb-6">
            <img src={logo} alt="Logo" className="w-40 h-40 mx-auto object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2 font-urdu">جامعہ مینجمنٹ سسٹم</h1>
          <p className="text-gray-600 mb-8">براہ کرم سسٹم تک رسائی کے لیے لاگ ان کریں</p>
          <button
            onClick={login}
            className="w-full flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-emerald-200"
          >
            Google کے ساتھ لاگ ان کریں
          </button>
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
        <div className="p-4 flex flex-col h-full overflow-hidden">
          <div className="flex items-center gap-3 mb-10 mt-2 pb-6 border-b border-white/5">
            <div className="bg-white p-2 rounded-2xl shrink-0 shadow-lg shadow-black/20">
              <img src={logo} alt="Logo" className="w-10 h-10 object-contain" />
            </div>
            <div className={cn("transition-all duration-300 origin-right overflow-hidden", !isSidebarOpen && "lg:w-0 lg:opacity-0")}>
              <h2 className="text-xl font-black whitespace-nowrap leading-none mb-1 text-emerald-50">جامعہ تعلیم القرآن</h2>
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider leading-none">Management System</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1.5 overflow-y-auto custom-scrollbar pr-1 pl-1 text-right">
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
                  "w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group text-right relative overflow-hidden",
                  activeTab === item.id 
                    ? "bg-emerald-600/10 text-emerald-400 font-black border border-emerald-500/20" 
                    : "text-emerald-100/60 hover:bg-white/5 hover:text-white"
                )}
              >
                {activeTab === item.id && (
                  <motion.div 
                    layoutId="active-pill"
                    className="absolute right-0 top-2 bottom-2 w-1.5 bg-emerald-500 rounded-full"
                  />
                )}
                <item.icon className={cn(
                  "w-5 h-5 transition-transform duration-300 group-hover:scale-110",
                  activeTab === item.id ? "text-emerald-400" : "text-emerald-600 group-hover:text-emerald-400"
                )} />
                <span className={cn("transition-all duration-300 text-base", !isSidebarOpen && "lg:hidden")}>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-4 border-t border-white/5">
            <div className={cn("bg-emerald-950/50 p-4 rounded-2xl border border-white/5 mb-4 transition-all duration-300", !isSidebarOpen && "lg:p-2 lg:items-center lg:flex lg:justify-center")}>
              <div className="flex items-center gap-3">
                <img 
                  src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                  className="w-10 h-10 rounded-xl border-2 border-emerald-800/50 shadow-sm"
                  alt="Profile"
                />
                <div className={cn("flex-1 overflow-hidden transition-all duration-300 text-right", !isSidebarOpen && "lg:hidden")}>
                  <p className="text-sm font-black truncate text-emerald-50 leading-tight">{user.displayName}</p>
                  <p className="text-[10px] text-emerald-500 font-bold truncate leading-tight mt-1">{user.email}</p>
                </div>
              </div>
              
              <button
                onClick={logout}
                className={cn(
                  "w-full mt-4 flex items-center justify-center gap-2 py-2 rounded-xl bg-white/5 hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-all text-xs font-bold border border-white/5",
                  !isSidebarOpen && "lg:hidden"
                )}
              >
                <LogOut className="w-4 h-4" />
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
            <h1 className="text-lg font-bold">جامعہ تعلیم القرآن</h1>
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
              className="mb-6 bg-red-50 border-2 border-red-200 p-4 rounded-2xl flex flex-col items-center justify-between gap-4 shadow-sm"
            >
              <div className="flex flex-col md:flex-row items-center gap-4 text-red-700 w-full">
                <div className="bg-red-100 p-2 rounded-full shrink-0">
                  <WifiOff className="w-6 h-6" />
                </div>
                <div className="text-right flex-1">
                  <h3 className="font-black text-lg">ڈیٹا بیس سے رابطہ منقطع ہے (Offline)</h3>
                  <p className="text-sm opacity-90">سسٹم انٹرنیٹ کے بغیر کام نہیں کر سکتا۔ اگر آپ کا انٹرنیٹ ٹھیک ہے تو غالباً سرور میں مسئلہ ہے۔</p>
                  <p className="text-[10px] mt-1 font-mono bg-red-100/50 p-1 rounded">Project: paimaish-pro | DB: ai-studio-...</p>
                </div>
                <button 
                  onClick={checkConnection}
                  disabled={checkingConnection}
                  className="flex items-center gap-2 bg-red-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-50 whitespace-nowrap"
                >
                  {checkingConnection ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <RefreshCcw className="w-5 h-5" />}
                  دوبارہ چیک کریں
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
