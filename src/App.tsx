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
import IDGenerator from './pages/IDGenerator';
import DakhilKharij from './pages/DakhilKharij';

type Tab = 'dashboard' | 'admission' | 'attendance' | 'results' | 'id-cards' | 'register';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState(true);
  const [checkingConnection, setCheckingConnection] = useState(false);

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
    { id: 'id-cards', label: 'آئی ڈی کارڈز', icon: CreditCard },
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
          "fixed inset-y-0 right-0 z-50 bg-emerald-900 text-white transition-all duration-300 transform lg:relative lg:translate-x-0 shadow-2xl h-full",
          isSidebarOpen ? "w-72" : "translate-x-full lg:translate-x-0 lg:w-20"
        )}
      >
        <div className="p-4 flex flex-col h-full overflow-hidden">
          <div className="flex items-center gap-3 mb-8 pb-4 border-b border-emerald-800">
            <div className="bg-white p-1.5 rounded-xl shrink-0">
              <img src={logo} alt="Logo" className="w-8 h-8 object-contain" />
            </div>
            <div className={cn("transition-all duration-300 origin-right overflow-hidden", !isSidebarOpen && "lg:w-0 lg:opacity-0")}>
              <h2 className="text-xl font-bold whitespace-nowrap leading-none mb-1">جامعہ تعلیم القرآن</h2>
              <p className="text-[10px] text-emerald-300/60 uppercase tracking-widest leading-none">Management System</p>
            </div>
          </div>
          {/* Toggle Button for Desktop - Floating outside sidebar when closed */}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="hidden lg:flex absolute -left-4 top-10 bg-emerald-600 p-2 rounded-full shadow-lg border-2 border-white hover:bg-emerald-700 transition-all z-50"
          >
            <Menu className="w-4 h-4" />
          </button>

          <nav className="flex-1 space-y-2 overflow-y-auto custom-scrollbar">
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
                  "w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group text-right",
                  activeTab === item.id 
                    ? "bg-emerald-600 text-white shadow-lg" 
                    : "text-emerald-100/70 hover:bg-white/5 hover:text-white"
                )}
              >
                <item.icon className={cn(
                  "w-5 h-5 transition-colors",
                  activeTab === item.id ? "text-white" : "text-emerald-400 group-hover:text-emerald-300"
                )} />
                <span className={cn("font-medium transition-all duration-300", !isSidebarOpen && "lg:hidden")}>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-6 border-t border-emerald-800">
            <div className="flex items-center gap-3 px-4 py-3 mb-4">
              <img 
                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                className="w-10 h-10 rounded-full border-2 border-emerald-700"
                alt="Profile"
              />
              <div className={cn("flex-1 overflow-hidden transition-all duration-300", !isSidebarOpen && "lg:hidden")}>
                <p className="text-sm font-semibold truncate">{user.displayName}</p>
                <p className="text-xs text-emerald-400 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-emerald-100/70 hover:bg-red-500/10 hover:text-red-400 transition-all font-urdu"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              <span className={cn("transition-all duration-300", !isSidebarOpen && "lg:hidden")}>لاگ آؤٹ</span>
            </button>
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
              className="mb-6 bg-red-50 border-2 border-red-200 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm"
            >
              <div className="flex items-center gap-4 text-red-700">
                <div className="bg-red-100 p-2 rounded-full">
                  <WifiOff className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-lg">ڈیٹا بیس سے رابطہ منقطع ہے</h3>
                  <p className="text-sm opacity-90">سسٹم انٹرنیٹ کے بغیر کام نہیں کر سکتا۔ براہ کرم اپنا نیٹ ورک چیک کریں۔</p>
                </div>
              </div>
              <button 
                onClick={checkConnection}
                disabled={checkingConnection}
                className="flex items-center gap-2 bg-red-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-50"
              >
                {checkingConnection ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <RefreshCcw className="w-5 h-5" />}
                دوبارہ چیک کریں
              </button>
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
              {activeTab === 'dashboard' && <Dashboard />}
              {activeTab === 'admission' && <Admission />}
              {activeTab === 'attendance' && <Attendance />}
              {activeTab === 'results' && <Results />}
              {activeTab === 'id-cards' && <IDGenerator />}
              {activeTab === 'register' && <DakhilKharij />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
