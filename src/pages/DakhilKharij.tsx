import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  getDocs, 
  orderBy, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Student, Section } from '../types';
import { 
  Search, 
  Printer, 
  Download, 
  UserMinus, 
  UserCheck,
  Calendar,
  FileText,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import logo from '../assets/logo.png';

export default function DakhilKharij() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSection, setSelectedSection] = useState<Section | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'left'>('all');
  
  // Withdrawal Modal State
  const [withdrawingStudent, setWithdrawingStudent] = useState<Student | null>(null);
  const [leavingDate, setLeavingDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [leavingReason, setLeavingReason] = useState('');
  const [leavingClass, setLeavingClass] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'students'), orderBy('admissionDate', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      setStudents(data);
    } catch (error) {
      console.error("Error fetching students:", error);
      alert('طلباء کا ڈیٹا حاصل کرنے میں دشواری پیش آئی۔');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawingStudent || !leavingDate || !leavingReason || !leavingClass) {
      alert('براہ کرم تمام معلومات فراہم کریں۔');
      return;
    }

    try {
      setProcessing(true);
      const studentRef = doc(db, 'students', withdrawingStudent.id);
      await updateDoc(studentRef, {
        status: 'left',
        leavingDate,
        leavingReason,
        leavingClass,
        updatedAt: new Date().toISOString()
      });

      alert('طالب علم کا اخراج کامیابی سے درج کر لیا گیا ہے۔');
      setWithdrawingStudent(null);
      setLeavingReason('');
      setLeavingClass('');
      fetchStudents();
    } catch (error) {
      console.error("Error withdrawing student:", error);
      alert('اخراج درج کرنے میں غلطی ہوئی۔');
    } finally {
      setProcessing(false);
    }
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.includes(searchTerm) || s.regNo.includes(searchTerm);
    const matchesSection = selectedSection === 'all' || s.section === selectedSection;
    const matchesStatus = selectedStatus === 'all' || s.status === selectedStatus;
    return matchesSearch && matchesSection && matchesStatus;
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 font-urdu" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">رجسٹر داخل / خارج</h1>
          <p className="text-gray-500 mt-1">جامعہ کے تمام طلباء کا مکمل ریکارڈ</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-xl text-gray-700 hover:bg-gray-50 transition-all font-bold shadow-sm"
          >
            <Printer className="w-5 h-5" />
            پرنٹ کریں
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
            <UserCheck className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">کل طلباء (موجود)</p>
            <h3 className="text-2xl font-bold text-gray-900">{students.filter(s => s.status === 'active').length}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-red-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
            <UserMinus className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">خارج شدہ طلباء</p>
            <h3 className="text-2xl font-bold text-gray-900">{students.filter(s => s.status === 'left').length}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-blue-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
            <Download className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">کل رجسٹریشنز</p>
            <h3 className="text-2xl font-bold text-gray-900">{students.length}</h3>
          </div>
        </div>
      </div>

      {/* Filters - Hidden on Print */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 no-print">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="نام یا رجسٹریشن نمبر سے تلاش کریں..."
            className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
          value={selectedSection}
          onChange={(e) => setSelectedSection(e.target.value as any)}
        >
          <option value="all">تمام سیکشنز</option>
          {Object.values(Section).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value as any)}
        >
          <option value="all">تمام (Active/Left)</option>
          <option value="active">صرف موجودہ طلباء</option>
          <option value="left">صرف خارج شدہ طلباء</option>
        </select>
      </div>

      {/* Register Table Container */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden print:shadow-none print:border-none">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse print:table">
            <thead>
              <tr className="bg-emerald-900 text-white print:bg-gray-100 print:text-black">
                <th className="px-4 py-3 border border-emerald-800 print:border-gray-300 text-sm font-bold w-20">داخلہ نمبر</th>
                <th className="px-4 py-3 border border-emerald-800 print:border-gray-300 text-sm font-bold w-28">تاریخ داخلہ</th>
                <th className="px-4 py-3 border border-emerald-800 print:border-gray-300 text-sm font-bold">نام طالب علم</th>
                <th className="px-4 py-3 border border-emerald-800 print:border-gray-300 text-sm font-bold">ولدیت</th>
                <th className="px-4 py-3 border border-emerald-800 print:border-gray-300 text-sm font-bold">تاریخ پیدائش</th>
                <th className="px-4 py-3 border border-emerald-800 print:border-gray-300 text-sm font-bold">سکونت (پتہ)</th>
                <th className="px-4 py-3 border border-emerald-800 print:border-gray-300 text-sm font-bold">درجہ (داخلہ)</th>
                <th className="px-4 py-3 border border-emerald-800 print:border-gray-300 text-sm font-bold">درجہ (اخراج)</th>
                <th className="px-4 py-3 border border-emerald-800 print:border-gray-300 text-sm font-bold">تاریخ اخراج</th>
                <th className="px-4 py-3 border border-emerald-800 print:border-gray-300 text-sm font-bold">وجہ اخراج</th>
                <th className="px-4 py-3 border border-emerald-800 print:border-gray-300 text-sm font-bold">کیفیت</th>
                <th className="px-4 py-3 border border-emerald-800 print:border-gray-300 text-sm font-bold no-print">ایکشن</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-gray-500">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-600" />
                    ڈیٹا لوڈ ہو رہا ہے...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-gray-500">
                    کوئی طالب علم نہیں ملا۔
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors even:bg-gray-50/50">
                    <td className="px-4 py-3 border border-gray-100 print:border-gray-300 text-sm font-mono text-center">{s.regNo}</td>
                    <td className="px-4 py-3 border border-gray-100 print:border-gray-300 text-sm text-center">{s.admissionDate}</td>
                    <td className="px-4 py-3 border border-gray-100 print:border-gray-300 text-sm font-bold">{s.name}</td>
                    <td className="px-4 py-3 border border-gray-100 print:border-gray-300 text-sm">{s.fatherName}</td>
                    <td className="px-4 py-3 border border-gray-100 print:border-gray-300 text-sm text-center">{s.dob}</td>
                    <td className="px-4 py-3 border border-gray-100 print:border-gray-300 text-sm truncate max-w-[150px]">{s.address}</td>
                    <td className="px-4 py-3 border border-gray-100 print:border-gray-300 text-sm text-center">{s.currentClass}</td>
                    <td className="px-4 py-3 border border-gray-100 print:border-gray-300 text-sm text-center">{s.leavingClass || '-'}</td>
                    <td className="px-4 py-3 border border-gray-100 print:border-gray-300 text-sm text-center">{s.leavingDate || '-'}</td>
                    <td className="px-4 py-3 border border-gray-100 print:border-gray-300 text-sm">{s.leavingReason || '-'}</td>
                    <td className="px-4 py-3 border border-gray-100 print:border-gray-300 text-sm">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                        s.status === 'active' ? "bg-emerald-100 text-emerald-700" : 
                        s.status === 'left' ? "bg-red-100 text-red-700" :
                        "bg-blue-100 text-blue-700"
                      )}>
                        {s.status === 'active' ? 'موجود' : s.status === 'left' ? 'خارج' : 'فارغ'}
                      </span>
                    </td>
                    <td className="px-4 py-3 border border-gray-100 no-print text-center">
                      {s.status === 'active' && (
                        <button
                          onClick={() => {
                            setWithdrawingStudent(s);
                            setLeavingClass(s.currentClass);
                          }}
                          className="p-1 px-2 text-red-600 hover:bg-red-50 rounded-lg transition-all text-xs flex items-center gap-1 mx-auto border border-red-100"
                          title="اخراج درج کریں"
                        >
                          <UserMinus className="w-3 h-3" />
                          اخراج
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Withdrawal Modal */}
      {withdrawingStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-200">
            <div className="bg-red-600 text-white p-6 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6" />
                <div>
                  <h2 className="text-xl font-bold">طالب علم کا اخراج</h2>
                  <p className="text-red-100 text-xs">براہ کرم اخراج کی تفصیلات فراہم کریں</p>
                </div>
              </div>
              <button onClick={() => setWithdrawingStudent(null)} className="hover:bg-white/10 p-2 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleWithdraw} className="p-8 space-y-5">
              <div className="bg-gray-50 p-4 rounded-2xl mb-4 border border-gray-100 flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center border border-gray-200 shadow-sm">
                  <UserCheck className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-gray-500 text-xs">نام طالب علم</p>
                  <h3 className="font-bold text-gray-900 leading-tight">{withdrawingStudent.name}</h3>
                  <p className="text-xs text-gray-400 font-mono">{withdrawingStudent.regNo}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    تاریخ اخراج
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all"
                    value={leavingDate}
                    onChange={(e) => setLeavingDate(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    جس درجہ سے مدرسہ چھوڑا
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثلاً: درجہ اول"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all"
                    value={leavingClass}
                    onChange={(e) => setLeavingClass(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    وجہ اخراج
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="مدرسہ چھوڑنے کی وجہ لکھیں..."
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all resize-none"
                    value={leavingReason}
                    onChange={(e) => setLeavingReason(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={processing}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-red-200 flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <UserMinus className="w-5 h-5" />
                      اخراج درج کریں
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setWithdrawingStudent(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-all"
                >
                  منسوخ کریں
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print-specific Header */}
      <div className="hidden print:block mb-8 border-b-2 border-emerald-900 pb-4">
        <div className="flex items-center justify-between mb-4">
          <img src={logo} alt="Logo" className="w-16 h-16 object-contain" />
          <div className="text-center">
            <h1 className="text-3xl font-bold text-emerald-900">رجسٹر داخل / خارج</h1>
            <p className="text-lg font-bold text-gray-700 mt-1">جامعہ تعلیم القرآن</p>
          </div>
          <div className="w-16" /> {/* Spacer */}
        </div>
        <div className="text-center border-t border-gray-200 pt-2 text-sm text-gray-500">
          رپورٹ تیار کردہ: {format(new Date(), 'dd MMMM yyyy')}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border: 1px solid #999 !important; font-size: 8px !important; padding: 4px !important; }
          @page { size: landscape; margin: 1cm; }
        }
      `}} />
    </div>
  );
}

function Loader2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function X(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
