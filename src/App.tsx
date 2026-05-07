import React, { useState, useEffect } from 'react';
import { auth } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { 
  Users, 
  ClipboardCheck, 
  GraduationCap, 
  LayoutDashboard, 
  LogOut, 
  Menu, 
  X,
  CreditCard
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

type Tab = 'dashboard' | 'admission' | 'attendance' | 'results' | 'id-cards';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex overflow-hidden font-urdu" dir="rtl">
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
          "fixed inset-y-0 right-0 z-50 w-72 bg-emerald-900 text-white transition-transform duration-300 transform lg:relative lg:translate-x-0 shadow-2xl",
          !isSidebarOpen && "translate-x-full lg:hidden"
        )}
      >
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-10 pb-6 border-b border-emerald-800">
            <div className="bg-white p-1 rounded-lg">
              <img src={logo} alt="Logo" className="w-10 h-10 object-contain" />
            </div>
            <div>
              <h2 className="text-xl font-bold">جامعہ تعلیم القرآن</h2>
              <p className="text-xs text-emerald-300/60 uppercase tracking-wider">Management System</p>
            </div>
          </div>

          <nav className="flex-1 space-y-2">
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
                <span className="font-medium">{item.label}</span>
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
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-semibold truncate">{user.displayName}</p>
                <p className="text-xs text-emerald-400 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-emerald-100/70 hover:bg-red-500/10 hover:text-red-400 transition-all font-urdu"
            >
              <LogOut className="w-5 h-5" />
              <span>لاگ آؤٹ</span>
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

        <div className="p-4 lg:p-10 max-w-7xl mx-auto">
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
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
