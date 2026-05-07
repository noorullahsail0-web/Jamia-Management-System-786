import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { Section, Student, AttendanceRecord } from '../types';
import { CLASS_DATA, SECTION_PREFIXES } from '../constants';
import { ClipboardCheck, UserCheck, UserX, UserMinus, Send, Loader2, Calendar as CalendarIcon, CheckCircle2, Printer, FileText, Download, FileSpreadsheet } from 'lucide-react';
import { cn } from '../lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
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
      const row: any = {
        'S.No': index + 1,
        'Student Name': student.name,
      };

      days.forEach(day => {
        const record = monthlyData.find(r => r.studentId === student.id && isSameDay(new Date(r.date), day));
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
      const element = printRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Attendance_${currentClass}_${URDU_MONTHS[selectedMonth]}.pdf`);
    } catch (e) {
      console.error('PDF Export Error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (section && currentClass) {
      if (viewMode === 'daily') {
        fetchStudents();
      } else {
        fetchMonthlyData();
      }
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
      
      // Initialize attendance map
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
      // 1. Fetch Students
      const sq = query(
        collection(db, 'students'),
        where('section', '==', section),
        where('currentClass', '==', currentClass),
        where('status', '==', 'active')
      );
      const sSnapshot = await getDocs(sq);
      const sDocs = sSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      setStudents(sDocs);

      // 2. Fetch Attendance for the month
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
      const aDocs = aSnapshot.docs.map(doc => ({ ...doc.data() } as AttendanceRecord));
      setMonthlyData(aDocs);
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
      const batch: any[] = [];
      for (const [studentId, status] of Object.entries(attendanceMap)) {
        await addDoc(collection(db, 'attendance'), {
          studentId,
          date,
          status,
          section,
          class: currentClass,
          createdAt: serverTimestamp()
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
      ? `محترم ${student.fatherName} صاحب! آپ کا بیٹا ${student.name} رول نمبر ${student.regNo} درجہ ${student.currentClass} آج بتاریخ ${date} مدرسے میں حاضری کے وقت موجود نہیں تھا۔ کیا آپ کو اس کی خبر ہے؟ اگر نہیں ہے تو برائے مہربانی اپنے بچے کی خبر لیں۔`
      : `محترم ${student.fatherName} صاحب! آپ کا بیٹا ${student.name} رول نمبر ${student.regNo} درجہ ${student.currentClass} آج بتاریخ ${date} مدرسے سے چھٹی پر ہے کیا آپ کو اپنے بچے کی خبر ہے؟ اگر نہیں ہے تو برائے مہربانی اپنے بچے کی خبر لیں۔`;
    
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
          <button 
            onClick={() => setViewMode('daily')}
            className={cn(
              "px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2",
              viewMode === 'daily' ? "bg-emerald-600 text-white shadow-lg" : "text-emerald-700 hover:bg-emerald-100"
            )}
          >
            <UserCheck className="w-4 h-4" />
            روزانہ
          </button>
          <button 
            onClick={() => setViewMode('monthly')}
            className={cn(
              "px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2",
              viewMode === 'monthly' ? "bg-emerald-600 text-white shadow-lg" : "text-emerald-700 hover:bg-emerald-100"
            )}
          >
            <FileText className="w-4 h-4" />
            ماہانہ رجسٹر
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-xl shadow-gray-100 border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2 text-right">
          <label className="text-sm font-bold text-gray-700">سیکشن منتخب کریں</label>
          <select 
            value={section} 
            onChange={(e) => { setSection(e.target.value as Section); setCurrentClass(''); }}
            className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-bold"
          >
            <option value="">سیکشن منتخب کریں</option>
            {Object.values(Section).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-2 text-right">
          <label className="text-sm font-bold text-gray-700">درجہ منتخب کریں</label>
          <select 
            value={currentClass} 
            onChange={(e) => setCurrentClass(e.target.value)}
            disabled={!section}
            className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-bold disabled:opacity-50"
          >
            <option value="">درجہ منتخب کریں</option>
            {section && CLASS_DATA[section as Section].map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div className="space-y-2 text-right">
          {viewMode === 'daily' ? (
            <>
              <label className="text-sm font-bold text-gray-700">تاریخ</label>
              <div className="relative">
                <CalendarIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                  type="date" 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-5 py-4 pr-12 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-bold"
                />
              </div>
            </>
          ) : (
            <>
              <label className="text-sm font-bold text-gray-700">مہینہ منتخب کریں</label>
              <div className="grid grid-cols-2 gap-2">
                <select 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full px-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-bold"
                >
                  {URDU_MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
                <select 
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full px-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-bold"
                >
                  {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </>
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
                    <th className="px-8 py-5 font-black text-lg">طالب علم</th>
                    <th className="px-8 py-5 font-black text-lg text-center">حاضری کی صورتحال</th>
                    <th className="px-8 py-5 font-black text-lg">اطلاع (WhatsApp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-emerald-50/30 transition-colors">
                      <td className="px-8 py-5">
                        <p className="font-black text-emerald-950 text-lg">{student.name}</p>
                        <p className="text-sm font-bold text-gray-500">{student.fatherName} • {student.regNo}</p>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex justify-center items-center gap-3">
                          {[
                            { val: 'present', label: 'حاضر', icon: UserCheck, color: 'text-emerald-600', active: 'bg-emerald-600 text-white shadow-emerald-200' },
                            { val: 'absent', label: 'غیر حاضر', icon: UserX, color: 'text-red-600', active: 'bg-red-600 text-white shadow-red-200' },
                            { val: 'leave', label: 'چھٹی', icon: UserMinus, color: 'text-blue-600', active: 'bg-blue-600 text-white shadow-blue-200' }
                          ].map((btn) => (
                            <button
                              key={btn.val}
                              onClick={() => handleStatusChange(student.id, btn.val as any)}
                              className={cn(
                                "flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all w-28 border-2 border-transparent",
                                attendanceMap[student.id] === btn.val 
                                  ? `${btn.active} shadow-lg scale-105` 
                                  : "text-gray-400 hover:bg-gray-100 hover:border-gray-200"
                              )}
                            >
                              <btn.icon className="w-6 h-6" />
                              <span className="text-xs font-black uppercase">{btn.label}</span>
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        {attendanceMap[student.id] !== 'present' && (
                          <a 
                            href={getWhatsAppLink(student, attendanceMap[student.id] as 'absent' | 'leave')}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-3 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-5 py-3 rounded-xl transition-all font-black text-sm w-fit group"
                          >
                            <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                            <span>اطلاع بھیجیں</span>
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between bg-white p-6 rounded-3xl shadow-lg border border-gray-100">
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-500">کل طلباء</p>
                  <p className="text-xl font-black text-emerald-950">{students.length}</p>
                </div>
                <div className="w-px h-8 bg-gray-200" />
                <div className="text-right">
                  <p className="text-xs font-bold text-emerald-500">حاضر</p>
                  <p className="text-xl font-black text-emerald-600">{Object.values(attendanceMap).filter(v => v === 'present').length}</p>
                </div>
                <div className="w-px h-8 bg-gray-200" />
                <div className="text-right">
                  <p className="text-xs font-bold text-red-500">غیر حاضر</p>
                  <p className="text-xl font-black text-red-600">{Object.values(attendanceMap).filter(v => v === 'absent').length}</p>
                </div>
              </div>
              <button
                onClick={saveAttendance}
                disabled={saving}
                className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-black py-5 px-14 rounded-2xl shadow-xl shadow-emerald-200 border-none transition-all active:scale-95 group"
              >
                {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6 group-hover:scale-110 transition-transform" />}
                <span className="text-lg">{savedSuccess ? 'حاضری محفوظ ہوگئی!' : 'حاضری محفوظ کریں'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-end gap-3 pr-4">
              <button 
                onClick={exportToPDF}
                className="flex items-center gap-3 bg-red-600 text-white font-black px-6 py-3 rounded-2xl hover:bg-red-700 transition-all shadow-xl shadow-red-900/20 active:scale-95 text-sm"
              >
                <Download className="w-5 h-5" />
                پی ڈی ایف
              </button>
              <button 
                onClick={exportToExcel}
                className="flex items-center gap-3 bg-emerald-600 text-white font-black px-6 py-3 rounded-2xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-900/20 active:scale-95 text-sm"
              >
                <FileSpreadsheet className="w-5 h-5" />
                ایکسل فائل
              </button>
              <button 
                onClick={() => handlePrint()}
                className="flex items-center gap-3 bg-emerald-950 text-white font-black px-6 py-3 rounded-2xl hover:bg-black transition-all shadow-xl shadow-emerald-900/20 active:scale-95 text-sm"
              >
                <Printer className="w-5 h-5" />
                پرنٹ کریں
              </button>
            </div>

            <div className="overflow-x-auto pb-4 custom-scrollbar">
              <div 
                ref={printRef} 
                className="p-8 min-w-[1100px] print-only-landscape" 
                style={{ direction: 'rtl', color: '#064e3b', backgroundColor: '#ffffff' }}
              >
                <div>
                  {/* Register Header */}
                  <div className="text-center mb-8 pb-6" style={{ borderBottom: '4px double #064e3b' }}>
                    <h1 className="text-4xl font-black mb-2" style={{ color: '#064e3b' }}>حاضری رجسٹر</h1>
                    <h2 className="text-2xl font-bold" style={{ color: '#1f2937' }}>جامعہ تعلیم القرآن ناگمان ضلع پشاور</h2>
                    
                    <div className="flex justify-between items-center mt-8 px-4 text-lg">
                      <div className="flex gap-8">
                        <div>
                          <span className="font-black">سیکشن:</span>
                          <span className="mr-2 underline decoration-dotted" style={{ color: '#1f2937' }}>{section}</span>
                        </div>
                        <div>
                          <span className="font-black">درجہ:</span>
                          <span className="mr-2 underline decoration-dotted" style={{ color: '#1f2937' }}>{currentClass}</span>
                        </div>
                        <div>
                          <span className="font-black">کوڈ:</span>
                          <span className="mr-2 underline decoration-dotted" style={{ color: '#1f2937' }}>
                            {SECTION_PREFIXES[section as Section]}{selectedYear}-{String(selectedMonth + 1).padStart(2, '0')}
                          </span>
                        </div>
                      </div>
                      <div>
                        <span className="font-black text-xl">ماہ:</span>
                        <span className="mr-2 font-black text-xl underline decoration-double" style={{ color: '#1f2937' }}>{URDU_MONTHS[selectedMonth]} {selectedYear}</span>
                      </div>
                    </div>
                  </div>

                  {/* Attendance Table */}
                  <table className="w-full border-collapse border-2 text-[10px]" style={{ borderColor: '#064e3b' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#ecfdf5' }}>
                        <th className="border-2 p-1 w-10 text-center font-black" style={{ borderColor: '#064e3b', color: '#064e3b' }}>نمبر شمار</th>
                        <th className="border-2 p-1 w-48 text-right font-black pr-4" style={{ borderColor: '#064e3b', color: '#064e3b' }}>نام طالب علم</th>
                        {eachDayOfInterval({
                          start: startOfMonth(new Date(selectedYear, selectedMonth)),
                          end: endOfMonth(new Date(selectedYear, selectedMonth))
                        }).map((day, i) => (
                          <th key={i} className="border-2 p-0 text-center w-6 text-[8px] font-bold" style={{ borderColor: '#064e3b', color: '#064e3b' }}>
                            {format(day, 'd')}
                          </th>
                        ))}
                        <th className="border-2 p-1 w-10 text-center font-black" style={{ borderColor: '#064e3b', color: '#064e3b' }}>کل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, index) => {
                        const days = eachDayOfInterval({
                          start: startOfMonth(new Date(selectedYear, selectedMonth)),
                          end: endOfMonth(new Date(selectedYear, selectedMonth))
                        });
                        
                        let presentCount = 0;

                        return (
                          <tr key={student.id} className="h-7" style={{ backgroundColor: '#ffffff' }}>
                            <td className="border text-center font-bold" style={{ borderColor: '#064e3b', color: '#1f2937' }}>{index + 1}</td>
                            <td className="border pr-4 font-bold text-[11px]" style={{ borderColor: '#064e3b', color: '#1f2937' }}>{student.name}</td>
                            {days.map((day, i) => {
                              const record = monthlyData.find(r => r.studentId === student.id && isSameDay(new Date(r.date), day));
                              const status = record?.status;
                              if (status === 'present') presentCount++;
                              
                              const getCellStyle = () => {
                                if (status === 'absent') return { color: '#dc2626', backgroundColor: '#fef2f2' };
                                if (status === 'leave') return { color: '#2563eb', backgroundColor: '#eff6ff' };
                                if (status === 'present') return { color: '#047857', backgroundColor: '#ffffff' };
                                return { backgroundColor: '#ffffff', color: '#000000' };
                              };

                              return (
                                <td key={i} className="border text-center font-black text-sm" style={{ ...getCellStyle(), borderColor: '#064e3b' }}>
                                  {status === 'present' ? '✓' : status === 'absent' ? 'x' : status === 'leave' ? 'ر' : ''}
                                </td>
                              );
                            })}
                            <td className="border text-center font-black" style={{ borderColor: '#064e3b', backgroundColor: '#ecfdf5', color: '#064e3b' }}>{presentCount}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  
                  {/* Signatures */}
                  <div className="mt-16 flex justify-between px-20">
                    <div className="pt-2 px-12 font-black" style={{ borderTop: '2px solid #064e3b', color: '#1f2937' }}>دستخط معلم</div>
                    <div className="pt-2 px-12 font-black" style={{ borderTop: '2px solid #064e3b', color: '#1f2937' }}>دستخط ناظم صاحب</div>
                  </div>
                </div>
              </div>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                @page { 
                  size: A4 landscape; 
                  margin: 1cm;
                }
                body * { visibility: hidden; }
                .print-only-landscape, .print-only-landscape * { visibility: visible; }
                .print-only-landscape { 
                  position: absolute; 
                  left: 0; 
                  top: 0; 
                  width: 100%;
                  direction: rtl;
                }
                button { display: none !important; }
              }
              .custom-scrollbar::-webkit-scrollbar {
                height: 8px;
              }
              .custom-scrollbar::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 10px;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb {
                background: #10b981;
                border-radius: 10px;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                background: #059669;
              }
            ` }} />
          </div>
        )
      ) : (
        section && currentClass && (
          <div className="bg-white p-24 rounded-3xl border-4 border-dashed border-gray-100 text-center text-gray-400 font-bold italic animate-in zoom-in duration-500">
            <ClipboardCheck className="w-16 h-16 mx-auto mb-4 opacity-20" />
            اس درجہ میں کوئی طالب علم نہیں ہے
          </div>
        )
      )}
    </div>
  );
}
