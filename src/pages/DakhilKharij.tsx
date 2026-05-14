import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  query, 
  getDocs, 
  orderBy, 
  doc, 
  updateDoc,
  deleteDoc,
  where
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
  AlertCircle,
  FileSpreadsheet,
  FileJson,
  X,
  Loader2,
  Trash2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import schoolName from '../assets/school_name.png';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export default function DakhilKharij() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSection, setSelectedSection] = useState<Section | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'left'>('all');
  const printRef = useRef<HTMLDivElement>(null);
  
  // Withdrawal Modal State
  const [withdrawingStudent, setWithdrawingStudent] = useState<Student | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [leavingDate, setLeavingDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [leavingReason, setLeavingReason] = useState('');
  const [leavingClass, setLeavingClass] = useState('');
  const [processing, setProcessing] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      // Fetch all documents first to ensure none are skipped due to missing sort fields
      const q = query(collection(db, 'students'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      
      // Sort in-memory by admissionDate or createdAt
      data.sort((a, b) => {
        const dateA = a.admissionDate || a.createdAt || '';
        const dateB = b.admissionDate || b.createdAt || '';
        return dateB.localeCompare(dateA);
      });
      
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

  const handlePermanentDelete = async () => {
    if (!deletingStudent) return;
    
    try {
      setProcessing(true);
      
      // 1. Delete Attendance records
      const attQ = query(collection(db, 'attendance'), where('studentId', '==', deletingStudent.id));
      const attSnap = await getDocs(attQ);
      const attDeletes = attSnap.docs.map(d => deleteDoc(d.ref));
      
      // 2. Delete Results
      const resQ = query(collection(db, 'results'), where('studentId', '==', deletingStudent.id));
      const resSnap = await getDocs(resQ);
      const resDeletes = resSnap.docs.map(d => deleteDoc(d.ref));
      
      // 3. Delete Student document
      const studentDelete = deleteDoc(doc(db, 'students', deletingStudent.id));
      
      await Promise.all([...attDeletes, ...resDeletes, studentDelete]);

      alert('طالب علم کا مکمل ریکارڈ کامیابی سے ڈیلیٹ کر دیا گیا ہے۔');
      setDeletingStudent(null);
      fetchStudents();
    } catch (error) {
      console.error("Error deleting student record:", error);
      alert('ریکارڈ ڈیلیٹ کرنے میں غلطی ہوئی۔');
    } finally {
      setProcessing(false);
    }
  };

  const filteredStudents = students.filter(s => {
    const search = searchTerm.toLowerCase();
    const name = (s.name || '').toLowerCase();
    const regNo = (s.regNo || '').toLowerCase();
    const fatherName = (s.fatherName || '').toLowerCase();

    const matchesSearch = name.includes(search) || regNo.includes(search) || fatherName.includes(search);
    const matchesSection = selectedSection === 'all' || s.section === selectedSection;
    const matchesStatus = selectedStatus === 'all' || s.status === selectedStatus;
    return matchesSearch && matchesSection && matchesStatus;
  });

  const downloadPDF = async () => {
    if (!printRef.current) return;
    
    try {
      setDownloadingPDF(true);
      const doc = new jsPDF('l', 'mm', 'a4');
      const pages = printRef.current.querySelectorAll('.print-page');
      
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i] as HTMLElement;
        const canvas = await html2canvas(page, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          onclone: (clonedDoc) => {
            const styleTags = clonedDoc.getElementsByTagName('style');
            for (let i = 0; i < styleTags.length; i++) {
              const tag = styleTags[i];
              if (tag.innerHTML.includes('oklch') || tag.innerHTML.includes('oklab')) {
                 // Force hex for main Tailwind 4 color variables
                 tag.innerHTML = tag.innerHTML.replace(/(oklch|oklab)\s*\([^)]*\)/gi, '#10b981');
                 tag.innerHTML = tag.innerHTML.replace(/(oklch|oklab)\s*\([^\)]+\)/gi, '#10b981');
                 tag.innerHTML = tag.innerHTML.replace(/--([a-zA-Z0-9-]+)\s*:\s*[^;}]*(oklch|oklab)[^;}]*;/gi, '--$1: #10b981;');
              }
            }

            const elements = clonedDoc.querySelectorAll('*');
            elements.forEach((el) => {
              if (el instanceof HTMLElement) {
                const styleAttr = el.getAttribute('style');
                if (styleAttr && (styleAttr.includes('oklch') || styleAttr.includes('oklab'))) {
                  el.setAttribute('style', styleAttr.replace(/(oklch|oklab)\s*\([^;}]*\)/gi, '#10b981'));
                }

                const compStyle = window.getComputedStyle(el);
                if (compStyle.backgroundColor.includes('ok') || compStyle.backgroundColor.includes('oklch') || compStyle.backgroundColor.includes('oklab')) {
                  el.style.backgroundColor = '#ffffff';
                }
                if (compStyle.color.includes('ok') || compStyle.color.includes('oklch') || compStyle.color.includes('oklab')) {
                  el.style.color = '#000000';
                }
                if (compStyle.borderColor.includes('ok') || compStyle.borderColor.includes('oklch') || compStyle.borderColor.includes('oklab')) {
                  el.style.borderColor = '#000000';
                }
                
                if (el.classList.contains('bg-emerald-950')) el.style.backgroundColor = '#022c22';
                if (el.classList.contains('bg-emerald-900')) el.style.backgroundColor = '#064e3b';
                if (el.classList.contains('bg-emerald-800')) el.style.backgroundColor = '#065f46';
                if (el.classList.contains('text-emerald-950')) el.style.color = '#022c22';
                if (el.classList.contains('text-emerald-900')) el.style.color = '#064e3b';
                if (el.classList.contains('text-emerald-800')) el.style.color = '#065f46';
                if (el.classList.contains('bg-emerald-50')) el.style.backgroundColor = '#ecfdf5';
                if (el.classList.contains('bg-emerald-600')) el.style.backgroundColor = '#10b981';
                if (el.classList.contains('border-emerald-900')) el.style.borderColor = '#064e3b';
                if (el.classList.contains('border-emerald-950')) el.style.borderColor = '#022c22';
              }
            });
          }
        });
        
        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = doc.internal.pageSize.getWidth();
        const pdfHeight = doc.internal.pageSize.getHeight();
        
        const margin = 8;
        const availableWidth = pdfWidth - (margin * 2);
        const contentWidth = availableWidth;
        const contentHeight = (canvas.height * contentWidth) / canvas.width;
        
        if (i > 0) doc.addPage();
        doc.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight);
      }
      
      doc.save(`Dakhil_Kharij_Register_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert('پی ڈی ایف بنانے میں غلطی ہوئی۔ براہ کرم دوبارہ کوشش کریں یا پرنٹ بٹن استعمال کریں۔');
    } finally {
      setDownloadingPDF(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const downloadExcel = () => {
    const data = filteredStudents.map(s => ({
      'داخلہ نمبر': s.regNo,
      'تاریخ داخلہ': s.admissionDate,
      'نام طالب علم': s.name,
      'ولدیت': s.fatherName,
      'تاریخ پیدائش': s.dob,
      'سکونت': s.address,
      'جماعت (داخلہ)': s.currentClass,
      'جماعت (اخراج)': s.leavingClass || '-',
      'تاریخ اخراج': s.leavingDate || '-',
      'وجہ اخراج': s.leavingReason || '-',
      'کیفیت': s.status === 'active' ? 'موجود' : s.status === 'left' ? 'خارج' : 'فارغ'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dakhil Kharij");
    XLSX.writeFile(wb, `Dakhil_Kharij_Register_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  // Pagination for printing: 15 rows per page
  const rowsPerPage = 15;
  const paginatedStudents = [];
  for (let i = 0; i < filteredStudents.length; i += rowsPerPage) {
    paginatedStudents.push(filteredStudents.slice(i, i + rowsPerPage));
  }

  // If no students match filters but we are ready, still show an empty page
  if (paginatedStudents.length === 0 && !loading) {
    paginatedStudents.push([]);
  }

  return (
    <div className="space-y-8 font-urdu" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">رجسٹر داخل / خارج</h1>
          <p className="text-gray-500 mt-1">جامعہ کے تمام طلباء کا مکمل ریکارڈ</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={downloadExcel}
            className="flex items-center gap-2 bg-white border border-emerald-200 px-4 py-2 rounded-xl text-emerald-700 hover:bg-emerald-50 transition-all font-bold shadow-sm"
          >
            <FileSpreadsheet className="w-5 h-5" />
            ایکسل ڈاؤن لوڈ
          </button>
          <button
            onClick={downloadPDF}
            disabled={downloadingPDF}
            className="flex items-center gap-2 bg-white border border-red-200 px-4 py-2 rounded-xl text-red-700 hover:bg-red-50 transition-all font-bold shadow-sm disabled:opacity-50"
          >
            {downloadingPDF ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileJson className="w-5 h-5" />}
            پی ڈی ایف ڈاؤن لوڈ
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-emerald-900 text-white px-6 py-2 rounded-xl hover:bg-emerald-800 transition-all font-bold shadow-lg shadow-emerald-200"
          >
            <Printer className="w-5 h-5" />
            پرنٹ کریں (A4)
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
        <div className="flex items-center px-4 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-sm">
          کل طلبہ: {filteredStudents.length} / {students.length}
        </div>
      </div>

      {/* Screen View Table - Visible to user */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden no-print">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-4 text-sm font-bold text-gray-600">داخلہ نمبر</th>
                <th className="px-4 py-4 text-sm font-bold text-gray-600">نام طالب علم</th>
                <th className="px-4 py-4 text-sm font-bold text-gray-600">ولدیت</th>
                <th className="px-4 py-4 text-sm font-bold text-gray-600">سیکشن</th>
                <th className="px-4 py-4 text-sm font-bold text-gray-600">جماعت</th>
                <th className="px-4 py-4 text-sm font-bold text-gray-600">درجہ</th>
                <th className="px-4 py-4 text-sm font-bold text-gray-600 text-center">حالت</th>
                <th className="px-4 py-4 text-sm font-bold text-gray-600 text-center">ایکشن</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-600" />
                    ڈیٹا لوڈ ہو رہا ہے...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    کوئی طالب علم نہیں ملا۔
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-emerald-50/30 transition-colors">
                    <td className="px-4 py-4 text-sm font-mono font-bold text-emerald-700">{s.regNo}</td>
                    <td className="px-4 py-4 text-sm font-bold text-gray-900">{s.name}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{s.fatherName}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{s.section}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{s.currentClass}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{s.grade || '-'}</td>
                    <td className="px-4 py-4 text-sm text-center">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold",
                        s.status === 'active' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      )}>
                        {s.status === 'active' ? 'موجود' : 'خارج'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-center">
                      <div className="flex justify-center gap-1">
                        {s.status === 'active' && (
                          <button
                            onClick={() => setWithdrawingStudent(s)}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                            title="خارج کریں"
                          >
                            <UserMinus className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          onClick={() => setDeletingStudent(s)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="مکمل ڈیلیٹ کریں"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register Table Container - Paginated for Print - Hidden on screen */}
      <div className="print-register-pages-container" ref={printRef}>
        {paginatedStudents.map((pageStudents, pageIdx) => (
          <div key={pageIdx} className="print-page bg-white shadow-sm border border-gray-100 overflow-hidden print:shadow-none print:border-none print:px-8 print:pt-2 print:pb-1 print:mb-0 print:break-after-page min-h-[700px] print:min-h-0 page-container-screen">
            {/* Header for each printed page */}
            <div className="hidden print-header-active flex flex-col items-center justify-center mb-1 pt-0">
              <h1 className="text-xl font-bold text-gray-900 underline underline-offset-4 mb-1">رجسٹر داخل / خارج</h1>
              
              <div className="w-full flex justify-between items-center px-4 py-0.5 border-y border-gray-200">
                <div className="flex gap-6 items-center">
                  <span className="text-sm font-bold">جامعہ تعلیم القرآن ناگمان</span>
                  <span className="text-[10px] font-bold text-gray-600">ایڈریس: شبقدرروڈ نزدشبقدرفلورملز ناگمان ضلع پشاور</span>
                  <span className="text-[10px] font-bold text-gray-600">الحاق نمبر: 06838</span>
                </div>
                <div className="text-sm font-bold">
                  سال 2026
                </div>
              </div>
            </div>

            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-right border-collapse print:table table-fixed">
                <thead>
                  <tr className="bg-emerald-900 text-white h-12">
                    <th className="px-1 border border-emerald-800 print:border-gray-600 text-[11.5px] font-bold w-[9%] text-center text-white">داخلہ نمبر</th>
                    <th className="px-1 border border-emerald-800 print:border-gray-600 text-[11.5px] font-bold w-[9%] text-center text-white">تاریخ داخلہ</th>
                    <th className="px-1 border border-emerald-800 print:border-gray-600 text-[11.5px] font-bold w-[11%] text-center text-white">نام طالب علم</th>
                    <th className="px-1 border border-emerald-800 print:border-gray-600 text-[11.5px] font-bold w-[11%] text-center text-white">ولدیت</th>
                    <th className="px-1 border border-emerald-800 print:border-gray-600 text-[11.5px] font-bold w-[9%] text-center text-white">تاریخ پیدائش</th>
                    <th className="px-1 border border-emerald-800 print:border-gray-600 text-[11.5px] font-bold w-[14%] text-center text-white">سکونت</th>
                    <th className="px-1 border border-emerald-800 print:border-gray-600 text-[11.5px] font-bold w-[8%] text-center text-white">جماعت (داخل)</th>
                    <th className="px-1 border border-emerald-800 print:border-gray-600 text-[11.5px] font-bold w-[8%] text-center text-white">جماعت (چھوڑا)</th>
                    <th className="px-1 border border-emerald-800 print:border-gray-600 text-[11.5px] font-bold w-[8%] text-center text-white">تاریخ اخراج</th>
                    <th className="px-1 border border-emerald-800 print:border-gray-600 text-[11.5px] font-bold w-[8%] text-center text-white">وجہ اخراج</th>
                    <th className="px-1 border border-emerald-800 print:border-gray-600 text-[11.5px] font-bold w-[5%] text-center text-white">کیفیت</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="px-6 py-12 text-center text-gray-500">
                        ڈیٹا لوڈ ہو رہا ہے...
                      </td>
                    </tr>
                  ) : pageStudents.length === 0 ? (
                    // Fill 15 rows for empty state
                    Array.from({ length: 15 }).map((_, i) => (
                      <tr key={`empty-${i}`} className="h-10">
                        {Array.from({ length: 11 }).map((_, j) => (
                          <td key={`cell-${i}-${j}`} className="border border-gray-200 print:border-gray-600"></td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <>
                      {pageStudents.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50 transition-colors h-11 even:bg-gray-50/50">
                          <td className="px-1 border border-gray-100 print:border-gray-600 text-[10px] font-mono text-center truncate">{s.regNo}</td>
                          <td className="px-1 border border-gray-100 print:border-gray-600 text-[10px] text-center">{s.admissionDate}</td>
                          <td className="px-1 border border-gray-100 print:border-gray-600 text-[11px] font-bold text-center truncate">{s.name}</td>
                          <td className="px-1 border border-gray-100 print:border-gray-600 text-[11px] text-center truncate">{s.fatherName}</td>
                          <td className="px-1 border border-gray-100 print:border-gray-600 text-[10px] text-center">{s.dob}</td>
                          <td className="px-1 border border-gray-100 print:border-gray-600 text-[10px] text-center truncate">{s.address}</td>
                          <td className="px-1 border border-gray-100 print:border-gray-600 text-[10px] text-center">{s.currentClass}</td>
                          <td className="px-1 border border-gray-100 print:border-gray-600 text-[10px] text-center">{s.leavingClass || '-'}</td>
                          <td className="px-1 border border-gray-100 print:border-gray-600 text-[10px] text-center">{s.leavingDate || '-'}</td>
                          <td className="px-1 border border-gray-100 print:border-gray-600 text-[10px] text-center truncate">{s.leavingReason || '-'}</td>
                          <td className="px-1 border border-gray-100 print:border-gray-600 text-[10px] text-center">
                            <span className={cn(
                              "font-bold",
                              s.status === 'active' ? "text-emerald-700" : "text-red-700"
                            )}>
                              {s.status === 'active' ? 'موجود' : 'خارج'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {/* Fill the rest of 15 rows with empty rows for consistent layout */}
                      {pageStudents.length < rowsPerPage && Array.from({ length: rowsPerPage - pageStudents.length }).map((_, i) => (
                        <tr key={`extra-${i}`} className="h-11">
                          {Array.from({ length: 11 }).map((_, j) => (
                            <td key={`ecell-${i}-${j}`} className="border border-gray-100 print:border-gray-600"></td>
                          ))}
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
              
              {/* Signatures for print */}
              <div className="hidden print:flex justify-between mt-2 px-8 pb-2">
                <p className="text-[10px] font-bold">دستخط مہتمم / ناظم تعلیمات: .................................</p>
                <p className="text-[10px] font-bold">مہر مدرسہ: .................................</p>
                <p className="text-[10px] font-bold">تاریخ: {format(new Date(), 'dd-MM-yyyy')}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Row Selection actions - only visible on screen */}
      <div className="no-print mt-4 flex justify-center gap-2">
        <p className="text-sm text-gray-500">مجموعی صفحات برائے پرنٹ: {paginatedStudents.length}</p>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media screen {
          .print-page {
            position: absolute;
            left: -9999px;
            top: 0;
            width: 297mm;
            min-height: 210mm;
            color: #000000 !important;
            background: #ffffff !important;
          }
          /* Comprehensive fix for html2canvas oklch error by stripping Tailwind 4 variables */
          .print-page, .print-page * {
            border-color: #000000 !important;
            color: #000000 !important;
            background-color: transparent !important;
            --tw-ring-color: transparent !important;
            --tw-ring-offset-shadow: 0 0 #0000 !important;
            --tw-ring-shadow: 0 0 #0000 !important;
            --tw-shadow: 0 0 #0000 !important;
            --tw-shadow-colored: 0 0 #0000 !important;
            --tw-outline-style: none !important;
            box-shadow: none !important;
          }
          .print-page thead tr,
          .print-page th {
            background-color: #104d38 !important;
            color: #ffffff !important;
          }
          .print-page .bg-white {
            background-color: #ffffff !important;
          }
          .print-header-active {
            display: flex !important;
          }
        }
        @media print {
          @page { 
            size: A4 landscape; 
            margin: 0.5cm; 
          }
          body { background: white !important; -webkit-print-color-adjust: exact; color-adjust: exact; }
          .no-print { display: none !important; }
          .print-page { 
            position: static !important;
            display: block !important; 
            width: 100% !important;
            margin: 0 0 1cm 0 !important;
            padding: 0 !important;
            page-break-after: always !important;
          }
          .page-container-screen { border: none !important; }
          table { width: 100% !important; border-collapse: collapse !important; border: 1.5px solid #000 !important; table-layout: fixed !important; }
          th, td { border: 1px solid #000 !important; padding: 1px 2px !important; line-height: 1 !important; height: 35px !important; }
          thead th { background-color: #104d38 !important; color: white !important; -webkit-print-color-adjust: exact; }
          h1, p, img { text-align: center; }
          .print-header-active { display: flex !important; }
        }
      `}} />

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
      {/* Permanent Delete Modal */}
      {deletingStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-200">
            <div className="bg-red-700 text-white p-6 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Trash2 className="w-6 h-6" />
                <div>
                  <h2 className="text-xl font-bold">مکمل ریکارڈ ڈیلیٹ کریں</h2>
                  <p className="text-red-100 text-xs text-right">یہ عمل واپس نہیں کیا جا سکتا</p>
                </div>
              </div>
              <button onClick={() => setDeletingStudent(null)} className="hover:bg-white/10 p-2 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center border-4 border-red-100">
                  <AlertCircle className="w-10 h-10 text-red-600 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900">کیا آپ واقعی مطمئن ہیں؟</h3>
                  <p className="text-gray-500 mt-2">
                    آپ طالب علم <span className="font-bold text-red-600">"{deletingStudent.name}"</span> کا مکمل ڈیٹا ڈیلیٹ کر رہے ہیں۔
                  </p>
                </div>
              </div>

              <div className="bg-red-50 border border-red-100 p-4 rounded-2xl">
                <ul className="text-sm text-red-800 space-y-2 list-disc list-inside font-bold">
                  <li>تمام داخلہ ریکارڈ ختم ہو جائے گا</li>
                  <li>تمام حاضری کا ریکارڈ حذف ہو جائے گا</li>
                  <li>امتحانی نتائج مکمل طور پر ڈیلیٹ ہو جائیں گے</li>
                </ul>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handlePermanentDelete}
                  disabled={processing}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-red-200 flex items-center justify-center gap-2 text-lg"
                >
                  {processing ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-6 h-6" />
                      جی ہاں، مکمل ریکارڈ حذف کریں
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingStudent(null)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-2xl transition-all"
                >
                  منسوخ کریں
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
