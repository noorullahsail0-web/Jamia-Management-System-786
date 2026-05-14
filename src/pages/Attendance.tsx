import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { Section, Student, AttendanceRecord } from '../types';
import { CLASS_DATA, SECTION_PREFIXES } from '../constants';
import { ClipboardCheck, UserCheck, UserX, UserMinus, Send, Loader2, Calendar as CalendarIcon, CheckCircle2, Printer, FileText, Download, FileSpreadsheet } from 'lucide-react';
import { cn } from '../lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const URDU_MONTHS = [
  'جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون',
  'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'
];

export default function Attendance() {
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
  const [section, setSection] = useState<Section | ''>('');
  const [currentClass, setCurrentClass] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, 'present' | 'absent' | 'leave'>>({});
  const [monthlyData, setMonthlyData] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [savedSuccess, setSavedSuccess] = useState(false);
  
  const printRef = React.useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const exportToExcel = () => {
    if (students.length === 0) return;
    const days = eachDayOfInterval({
      start: startOfMonth(new Date(selectedYear, selectedMonth)),
      end: endOfMonth(new Date(selectedYear, selectedMonth))
    });
    const headers = ['S.No', 'Student Name', ...days.map(d => format(d, 'd')), 'Total'];
    const data = students.map((student, index) => {
      let presentCount = 0;
      const row: any = { 'S.No': index + 1, 'Student Name': student.name };
      days.forEach(day => {
        const record = monthlyData.find(r => r.studentId === student.id && r.date === format(day, 'yyyy-MM-dd'));
        const status = record?.status;
        if (status === 'present') presentCount++;
        row[format(day, 'd')] = status === 'present' ? 'P' : status === 'absent' ? 'A' : status === 'leave' ? 'L' : '-';
      });
      row['Total'] = presentCount;
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, `Attendance_${currentClass}_${URDU_MONTHS[selectedMonth]}.xlsx`);
  };

  const exportToPDF = async () => {
    if (!printRef.current) return;
    setLoading(true);
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          const styleTags = clonedDoc.getElementsByTagName('style');
          for (let i = 0; i < styleTags.length; i++) {
            const tag = styleTags[i];
            if (tag.innerHTML.includes('oklch') || tag.innerHTML.includes('oklab')) {
               // Use a very aggressive regex to replace any color function starting with ok
               tag.innerHTML = tag.innerHTML.replace(/(oklch|oklab)\s*\([^)]*\)/gi, '#10b981');
               tag.innerHTML = tag.innerHTML.replace(/(oklch|oklab)\s*\([^\)]+\)/gi, '#10b981');
               // Also catch variables
               tag.innerHTML = tag.innerHTML.replace(/--([a-zA-Z0-9-]+)\s*:\s*[^;}]*(oklch|oklab)[^;}]*;/gi, '--$1: #10b981;');
            }
          }

          const elements = clonedDoc.querySelectorAll('*');
          elements.forEach((el) => {
            if (el instanceof HTMLElement) {
              // Explicitly strip any inline style properties that might contain ok colors
              const styleAttr = el.getAttribute('style');
              if (styleAttr && (styleAttr.includes('oklch') || styleAttr.includes('oklab'))) {
                el.setAttribute('style', styleAttr.replace(/(oklch|oklab)\s*\([^;}]*\)/gi, '#10b981'));
              }

              // Also check computed styles and overwrite them if they contain ok colors
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
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Attendance_${currentClass}_${URDU_MONTHS[selectedMonth]}.pdf`);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (section && currentClass) {
      if (viewMode === 'daily') fetchStudents();
      else fetchMonthlyData();
    } else {
      setStudents([]);
    }
  }, [section, currentClass, viewMode, selectedMonth, selectedYear]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'students'),
        where('section', '==', section),
        where('currentClass', '==', currentClass),
        where('status', '==', 'active')
      );
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      setStudents(docs);
      const initialMap: Record<string, 'present' | 'absent' | 'leave'> = {};
      docs.forEach(s => initialMap[s.id] = 'present');
      setAttendanceMap(initialMap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyData = async () => {
    setLoading(true);
    try {
      const sq = query(
        collection(db, 'students'),
        where('section', '==', section),
        where('currentClass', '==', currentClass),
        where('status', '==', 'active')
      );
      const sSnapshot = await getDocs(sq);
      const sDocs = sSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      setStudents(sDocs);
      const start = format(startOfMonth(new Date(selectedYear, selectedMonth)), 'yyyy-MM-dd');
      const end = format(endOfMonth(new Date(selectedYear, selectedMonth)), 'yyyy-MM-dd');
      const aq = query(
        collection(db, 'attendance'),
        where('section', '==', section),
        where('class', '==', currentClass),
        where('date', '>=', start),
        where('date', '<=', end)
      );
      const aSnapshot = await getDocs(aq);
      setMonthlyData(aSnapshot.docs.map(doc => doc.data() as AttendanceRecord));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (studentId: string, status: 'present' | 'absent' | 'leave') => {
    setAttendanceMap(prev => ({ ...prev, [studentId]: status }));
  };

  const saveAttendance = async () => {
    setSaving(true);
    try {
      for (const [studentId, status] of Object.entries(attendanceMap)) {
        await addDoc(collection(db, 'attendance'), {
          studentId, date, status, section, class: currentClass, createdAt: serverTimestamp()
        });
      }
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const getWhatsAppLink = (student: Student, status: 'absent' | 'leave') => {
    const message = status === 'absent' 
      ? `محترم ${student.fatherName} صاحب! آپ کا بیٹا ${student.name} رول نمبر ${student.regNo} درجہ ${student.currentClass} آج بتاریخ ${date} مدرسے میں حاضری کے وقت موجود نہیں تھا۔`
      : `محترم ${student.fatherName} صاحب! آپ کا بیٹا ${student.name} رول نمبر ${student.regNo} درجہ ${student.currentClass} آج بتاریخ ${date} مدرسے سے چھٹی پر ہے۔`;
    return `https://wa.me/${student.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-emerald-950 flex items-center gap-3">
            <ClipboardCheck className="w-8 h-8 text-emerald-600" />
            روزانہ حاضری و رجسٹر
          </h1>
          <p className="text-gray-500 font-bold">طلباء کی حاضری لگائیں اور ماہانہ رجسٹر تیار کریں</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 p-1.5 rounded-2xl border border-emerald-100">
          <button onClick={() => setViewMode('daily')} className={cn("px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2", viewMode === 'daily' ? "bg-emerald-600 text-white shadow-lg" : "text-emerald-700 hover:bg-emerald-100")}><UserCheck className="w-4 h-4" />روزانہ</button>
          <button onClick={() => setViewMode('monthly')} className={cn("px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2", viewMode === 'monthly' ? "bg-emerald-600 text-white shadow-lg" : "text-emerald-700 hover:bg-emerald-100")}><FileText className="w-4 h-4" />ماہانہ رجسٹر</button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-xl shadow-gray-100 border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2 text-right">
          <label className="text-sm font-bold text-gray-700">سیکشن منتخب کریں</label>
          <select value={section} onChange={(e) => { setSection(e.target.value as Section); setCurrentClass(''); }} className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-bold">
            <option value="">سیکشن منتخب کریں</option>
            {Object.values(Section).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-2 text-right">
          <label className="text-sm font-bold text-gray-700">درجہ منتخب کریں</label>
          <select value={currentClass} onChange={(e) => setCurrentClass(e.target.value)} disabled={!section} className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-bold disabled:opacity-50">
            <option value="">درجہ منتخب کریں</option>
            {section && CLASS_DATA[section as Section].map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div className="space-y-2 text-right">
          {viewMode === 'daily' ? (
            <div className="relative">
              <CalendarIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-5 py-4 pr-12 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="w-full px-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold">
                {URDU_MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="w-full px-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold">
                {Array.from({ length: 10 }, (_, i) => 2024 + i).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-emerald-600" />
          <p className="text-gray-500 font-bold animate-pulse">ڈیٹا لوڈ ہو رہا ہے...</p>
        </div>
      ) : students.length > 0 ? (
        viewMode === 'daily' ? (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-3xl shadow-xl shadow-gray-100 border border-gray-100 overflow-hidden">
              <table className="w-full text-right">
                <thead>
                  <tr className="bg-emerald-950 text-white">
                    <th className="px-4 md:px-8 py-5 font-black text-lg text-right">طالب علم</th>
                    <th className="px-4 md:px-8 py-5 font-black text-lg text-center">حاضری</th>
                    <th className="px-4 md:px-8 py-5 font-black text-lg text-right">اطلاع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-emerald-50/30 transition-colors">
                      <td className="px-4 md:px-8 py-5">
                        <p className="font-black text-emerald-950 text-base md:text-lg">{student.name}</p>
                        <p className="text-[10px] md:text-sm font-bold text-gray-500">{student.fatherName} • {student.regNo}</p>
                      </td>
                      <td className="px-2 md:px-8 py-5 text-center">
                        <div className="flex justify-center items-center gap-1 md:gap-3">
                          {['present', 'absent', 'leave'].map((v) => (
                            <button key={v} onClick={() => handleStatusChange(student.id, v as any)} className={cn("p-2 md:p-3 rounded-xl transition-all w-16 md:w-28", attendanceMap[student.id] === v ? "bg-emerald-600 text-white" : "text-gray-400 hover:bg-gray-100")}>
                              {v === 'present' ? 'حاضر' : v === 'absent' ? 'غیر حاضر' : 'چھٹی'}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 md:px-8 py-5 text-right">
                        {attendanceMap[student.id] !== 'present' && (
                          <a href={getWhatsAppLink(student, attendanceMap[student.id] as any)} target="_blank" rel="noreferrer" className="text-emerald-700 bg-emerald-50 px-4 py-2 rounded-lg font-bold">اطلاع بھیجیں</a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={saveAttendance} disabled={saving} className="w-full md:w-auto bg-emerald-600 text-white font-black py-4 px-12 rounded-2xl shadow-xl">
              {saving ? 'محفوظ ہو رہا ہے...' : (savedSuccess ? 'محفوظ ہوگئی!' : 'حاضری محفوظ کریں')}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-end gap-3 no-print">
              <button 
                onClick={exportToPDF} 
                disabled={loading}
                className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                پی ڈی ایف
              </button>
              <button onClick={exportToExcel} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                ایکسل فائل
              </button>
              <button onClick={handlePrint} className="bg-black text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2">
                <Printer className="w-4 h-4" />
                پرنٹ کریں
              </button>
            </div>
            
            <div className="overflow-x-auto pb-4 custom-scrollbar">
              <div 
                id="print-area" 
                ref={printRef} 
                className="pt-2 px-12 pb-12 min-w-[1100px] bg-white mx-auto shadow-sm border border-gray-100" 
                style={{ direction: 'rtl', width: '297mm', fontFamily: 'system-ui' }}
              >
                <div className="w-full mb-2">
                  <div className="text-center mb-1">
                    <h1 className="text-5xl font-bold text-black" style={{ fontFamily: 'Jameel Noori Nastaleeq, system-ui' }}>حاضری رجسٹر</h1>
                  </div>
                  
                  <div className="flex justify-between items-end border-b-2 border-black pb-1 px-2 text-xl font-bold text-black" style={{ fontFamily: 'Jameel Noori Nastaleeq, system-ui' }}>
                    <div className="text-2xl font-bold">
                      جامعہ تعلیم القرآن ناگمان ضلع پشاور
                    </div>

                    <div className="flex gap-12">
                      <div className="flex gap-2">
                        <span className="whitespace-nowrap">سیکشن:</span>
                        <span className="px-1">{section}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="whitespace-nowrap">درجہ:</span>
                        <span className="px-1">{currentClass}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="whitespace-nowrap">کوڈ:</span>
                        <span className="px-1 font-sans">
                          DN{selectedYear}-{String(selectedMonth + 1).padStart(2, '0')}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="whitespace-nowrap">ماہ:</span>
                        <span className="px-1">{URDU_MONTHS[selectedMonth]} {selectedYear}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-full">
                  <table className="w-full border-collapse" style={{ border: '1.5px solid #064e3b' }}>
                    <thead>
                      <tr className="bg-emerald-950 text-white h-12" style={{ fontFamily: 'Jameel Noori Nastaleeq, system-ui' }}>
                        <th className="border border-emerald-900 p-1 w-10 text-center text-sm font-black">ن-ش</th>
                        <th className="border border-emerald-900 p-1 w-52 text-right pr-3 text-sm font-black">نام طالب علم</th>
                        {eachDayOfInterval({ start: startOfMonth(new Date(selectedYear, selectedMonth)), end: endOfMonth(new Date(selectedYear, selectedMonth)) }).map(d => (
                          <th key={d.toString()} className="border border-emerald-900 p-0 text-[10px] w-7 text-center font-bold font-sans">{format(d, 'd')}</th>
                        ))}
                        <th className="border border-emerald-900 p-1 w-12 text-center text-sm font-black">کل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, index) => {
                         const days = eachDayOfInterval({ start: startOfMonth(new Date(selectedYear, selectedMonth)), end: endOfMonth(new Date(selectedYear, selectedMonth)) });
                         let presentCount = 0;
                         return (
                           <tr key={index} className="h-9 transition-colors even:bg-gray-50/50">
                             <td className="border border-emerald-900 text-center text-xs font-bold">{index + 1}</td>
                             <td className="border border-emerald-900 pr-3 text-[18px] font-bold text-gray-900 truncate" style={{ fontFamily: 'Jameel Noori Nastaleeq, system-ui' }}>{student.name}</td>
                             {days.map(day => {
                               const record = monthlyData.find(r => r.studentId === student.id && r.date === format(day, 'yyyy-MM-dd'));
                               if (record?.status === 'present') presentCount++;
                               return (
                                 <td key={day.toString()} className="border border-emerald-900 text-center p-0 h-9">
                                   <div className="w-full h-full flex items-center justify-center text-[13px] font-black">
                                     {record?.status === 'present' ? '✓' : record?.status === 'absent' ? 'x' : record?.status === 'leave' ? 'ر' : ''}
                                   </div>
                                 </td>
                               );
                             })}
                             <td className="border border-emerald-900 text-center font-black text-xs bg-emerald-50 text-emerald-900">{presentCount}</td>
                           </tr>
                         );
                      })}
                    </tbody>
                  </table>
                  
                  <div className="mt-8 flex justify-between px-8 text-xl font-bold text-emerald-900 border-t border-gray-100 pt-6" style={{ fontFamily: 'Jameel Noori Nastaleeq, system-ui' }}>
                    <p>دستخط استاد جی: .................................</p>
                    <p>دستخط ناظم: .................................</p>
                    <p>مہر جامعہ: .................................</p>
                  </div>
                </div>
              </div>
            </div>
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                @page { size: A4 landscape; margin: 1cm; }
                body * { visibility: hidden; }
                #print-area, #print-area * { visibility: visible; }
                #print-area { position: absolute; left: 0; top: 0; width: 100%; }
              }
            ` }} />
          </div>
        )
      ) : (
        section && currentClass && <div className="bg-white p-20 rounded-3xl text-center text-gray-400 font-bold italic border-4 border-dashed border-gray-100">اس درجہ میں کوئی طالب علم نہیں ہے</div>
      )}
    </div>
  );
}
