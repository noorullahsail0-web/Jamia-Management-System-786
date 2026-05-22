import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Sparkles } from 'lucide-react';
import logo from '../assets/logo.png';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error captured by Jamia System ErrorBoundary:", error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  private handleResetAndReload = () => {
    try {
      // Clear localStorage or sessionStorage to remove any corrupted temporary state
      localStorage.clear();
      sessionStorage.clear();
      
      // Try unregistering service workers if any are stuck
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (let registration of registrations) {
            registration.unregister();
          }
        });
      }
    } catch (e) {
      console.error("Error clearing state:", e);
    }
    
    // Hard refresh to reload clean code assets
    window.location.replace('/');
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 md:p-8" dir="rtl">
          <div className="max-w-xl w-full bg-white rounded-[2.5rem] shadow-2xl border border-red-100 overflow-hidden relative">
            {/* Top red header banner */}
            <div className="bg-gradient-to-l from-red-800 via-orange-850 to-red-950 p-6 text-white text-center relative">
              <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
              <img src={logo} alt="Logo" className="w-20 h-20 mx-auto object-contain mb-3 bg-white p-2 rounded-2xl shadow-md rotate-12" />
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-full text-red-200 text-xs font-bold font-sans mb-2">
                <AlertTriangle className="w-3.5 h-3.5 animate-pulse text-yellow-400" />
                <span>سسٹم خودکار تحفظ فعال</span>
              </div>
              <h1 className="text-3xl font-black font-nastaleeq leading-tight text-white">اوپس! سسٹم میں عارضی خرابی آئی ہے</h1>
            </div>

            <div className="p-8 space-y-6">
              <div className="bg-red-50/70 border border-red-250 p-5 rounded-2xl text-right">
                <p className="text-sm font-black text-red-900 leading-relaxed font-urdu">
                  گھبرانے کی کوئی بات نہیں! آپ کا قیمتی فارم اور تمام محفوظ شدہ تعلیمی ڈیٹا بالکل محفوظ اور محفوظ Firebase کلاؤڈ میں موجود ہے۔ یہ محض براؤزر یا اسکرین کے عارضی لوڈنگ کا عارضی مسئلہ ہے۔
                </p>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-bold text-gray-500 text-center uppercase tracking-wider">سسٹم کی بحالی کا خودکار طریقہ</p>
                
                <button
                  onClick={this.handleResetAndReload}
                  className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold py-4 px-6 rounded-2xl transition-all shadow-xl hover:shadow-emerald-100 transform active:scale-95 text-base md:text-lg"
                >
                  <RefreshCcw className="w-5 h-5 animate-spin" />
                  <span>سسٹم ری سیٹ کریں اور دوبارہ شروع کریں</span>
                </button>
              </div>

              {/* Technical Details Accordion (for admin/developer reassurance) */}
              <div className="border-t border-gray-100 pt-5 mt-4">
                <details className="group">
                  <summary className="flex justify-between items-center font-bold text-xs text-gray-400 cursor-pointer list-none select-none">
                    <span>تکنیکی تفصیلات (صرف معلومات کے لیے)</span>
                    <span className="transition group-open:rotate-180">↓</span>
                  </summary>
                  <div className="mt-3 p-4 bg-gray-50 rounded-xl text-left font-mono text-[10px] text-red-700 overflow-x-auto max-h-40 border border-gray-100">
                    <p className="font-extrabold mb-1">Error Message:</p>
                    <p className="whitespace-pre-wrap">{this.state.error?.toString() || 'Unknown Javascript Exception'}</p>
                    {this.state.errorInfo && (
                      <>
                        <p className="font-extrabold mt-3 mb-1">Component Stack:</p>
                        <p className="whitespace-pre-wrap text-gray-500">{this.state.errorInfo.componentStack}</p>
                      </>
                    )}
                  </div>
                </details>
              </div>

              {/* Secure certification footer */}
              <div className="flex items-center justify-center gap-2 text-emerald-700 text-xs font-bold">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>جامعہ تعلیم القرآن ناگمان ڈیجیٹل سسٹم</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
