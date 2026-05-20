import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { Section, Student, ExamResult, ExamType } from '../types';
import { CLASS_DATA } from '../constants';
import { GraduationCap, Search, Save, FileText, ChevronRight, Loader2, Info, FileSpreadsheet, Download } from 'lucide-react';
import { cn, sanitizeHtml2Canvas } from '../lib/utils';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import logo from '../assets/logo.png';

export default function Results() {
  const [activeTab, setActiveTab] = useState<'report-card' | 'reports' | 'class-entry'>('class-entry');
  const [regNoSearch, setRegNoSearch] = useState('');
  const [student, setStudent] = useState<Student | null>(null);
  const [studentAllResults, setStudentAllResults] = useState<Record<string, any>>({});
  const [examType, setExamType] = useState<ExamType>(ExamType.QUARTERLY);
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [hifzMarks, setHifzMarks] = useState({
    q1: 0, q2: 0, q3: 0, lahja: 0, safai: 0, adiya: 0
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connectionError, setConnectionError] = useState(false);

  // Report Card Filter State
  const [rcSection, setRcSection] = useState<Section | ''>('');
  const [rcClass, setRcClass] = useState('');
  const [rcStudents, setRcStudents] = useState<any[]>([]);

  // Class Entry State
  const [selectedSection, setSelectedSection] = useState<Section | ''>('');
  const [selectedClass, setSelectedClass] = useState('');
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [classResults, setClassResults] = useState<Record<string, any>>({}); // studentId -> { subjects: {}, hifz: {} }

  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const collectiveRef = useRef<HTMLDivElement>(null);
  const individualRef = useRef<HTMLDivElement>(null);

  const searchStudent = async () => {
    if (!regNoSearch) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'students'), where('regNo', '==', regNoSearch.toUpperCase()));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const studentData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Student;
        setStudent(studentData);
        
        // If in report-card tab, fetch all results
        if (activeTab === 'report-card') {
          const fullResults = await fetchFullStudentResults(studentData.id);
          setStudentAllResults(fullResults);
        } else {
          // Fetch existing result for specific exam type
          const rq = query(
            collection(db, 'results'),
            where('studentId', '==', studentData.id),
            where('examType', '==', examType)
          );
          const rSnap = await getDocs(rq);
          if (!rSnap.empty) {
            const res = rSnap.docs[0].data();
            if (res.subjects) setMarks(res.subjects);
            if (res.hifzBreakdown) setHifzMarks(res.hifzBreakdown);
          } else {
            setMarks({});
            setHifzMarks({ q1: 0, q2: 0, q3: 0, lahja: 0, safai: 0, adiya: 0 });
          }
        }
      } else {
        alert('طالب علم نہیں ملا');
        setStudent(null);
      }
    } catch (e: any) {
      console.error(e);
      if (e.code === 'unavailable') {
        setConnectionError(true);
        alert('کلاؤڈ فایر اسٹور سے رابطہ نہیں ہو سکا (نیٹ ورک کا مسئلہ)۔ براہ کرم اپنا انٹرنیٹ چیک کریں۔');
      } else {
        handleFirestoreError(e, OperationType.GET, 'students');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchClassStudents = async () => {
    if (!selectedSection || !selectedClass) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'students'),
        where('section', '==', selectedSection),
        where('currentClass', '==', selectedClass),
        where('status', '==', 'active')
      );
      const snapshot = await getDocs(q);
      const students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      setClassStudents(students);

      // Fetch existing results for this class and exam type
      const rq = query(
        collection(db, 'results'),
        where('class', '==', selectedClass),
        where('examType', '==', examType)
      );
      const rSnap = await getDocs(rq);
      const resultsMap: Record<string, any> = {};
      rSnap.forEach(doc => {
        const data = doc.data();
        resultsMap[data.studentId] = data;
      });
      
      const initialResults: Record<string, any> = {};
      students.forEach(s => {
        initialResults[s.id] = resultsMap[s.id] || { subjects: {}, hifzBreakdown: { q1: 0, q2: 0, q3: 0, lahja: 0, safai: 0, adiya: 0 } };
      });
      setClassResults(initialResults);
    } catch (e: any) {
      console.error(e);
      if (e.code === 'unavailable') {
        alert('فائر اسٹور سرور سے رابطہ نہیں ہو سکا (نیٹیورک کا مسئلہ)');
      } else {
        handleFirestoreError(e, OperationType.GET, 'class-students');
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateGrade = (percentage: number) => {
    if (percentage >= 80) return 'ممتاز';
    if (percentage >= 70) return 'جید جدا';
    if (percentage >= 60) return 'جید';
    if (percentage >= 50) return 'مقبول';
    return 'راسب';
  };

  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    colIndex: number,
    maxRows: number,
    maxCols: number
  ) => {
    let targetRow = rowIndex;
    let targetCol = colIndex;

    if (e.key === 'ArrowUp') {
      targetRow = rowIndex - 1;
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      targetRow = rowIndex + 1;
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      // In RTL table, Left Arrow should move visually to the Left column.
      // Columns layout as Col 0 (Rightmost) to Col Max (Leftmost).
      // So moving Left physically means INCREASING colIndex (towards left)
      targetCol = colIndex + 1;
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      // Moving Right physically means DECREASING colIndex
      targetCol = colIndex - 1;
      e.preventDefault();
    } else if (e.key === 'Enter') {
      targetRow = rowIndex + 1;
      e.preventDefault();
    } else {
      return;
    }

    // Check bounds and focus
    if (targetRow >= 0 && targetRow < maxRows && targetCol >= 0 && targetCol < maxCols) {
      const nextInput = document.getElementById(`cell-${targetRow}-${targetCol}`);
      if (nextInput) {
        nextInput.focus();
        (nextInput as HTMLInputElement).select();
      }
    }
  };

  const saveClassResults = async () => {
    setSaving(true);
    try {
      const classData = CLASS_DATA[selectedSection as Section].find(c => c.name === selectedClass);
      const isHifz = selectedSection === Section.BANIN_HIFZ;
      const subjects = classData?.subjects || [];

      for (const student of classStudents) {
        const studentResult = classResults[student.id];
        let total = 0;
        
        if (isHifz) {
          const h = studentResult.hifzBreakdown;
          total = Number(h.q1) + Number(h.q2) + Number(h.q3) + Number(h.lahja) + Number(h.safai) + Number(h.adiya);
        } else {
          total = subjects.reduce((sum, s) => sum + (Number(studentResult.subjects?.[s]) || 0), 0);
        }

        const maxTotal = isHifz ? 100 : subjects.length * 100;
        const percentage = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
        const grade = calculateGrade(percentage);

        const resultData: any = {
          studentId: student.id,
          regNo: student.regNo,
          examType,
          year: new Date().getFullYear().toString(),
          class: selectedClass,
          subjects: studentResult.subjects || {},
          hifzBreakdown: isHifz ? studentResult.hifzBreakdown : null,
          totalMarks: total,
          percentage,
          grade,
          updatedAt: serverTimestamp()
        };

        const q = query(
          collection(db, 'results'),
          where('studentId', '==', student.id),
          where('examType', '==', examType)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          await updateDoc(doc(db, 'results', snapshot.docs[0].id), resultData);
        } else {
          await addDoc(collection(db, 'results'), resultData);
        }
      }
      alert('تمام نتائج محفوظ کر لیے گئے ہیں');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'results');
    } finally {
      setSaving(false);
    }
  };

  const calculatePositions = (students: Student[]) => {
    const totals = students.map(s => {
      const res = classResults[s.id];
      const isHifz = selectedSection === Section.BANIN_HIFZ;
      let total = 0;
      if (isHifz) {
        const h = res?.hifzBreakdown || {};
        total = Number(h.q1 || 0) + Number(h.q2 || 0) + Number(h.q3 || 0) + Number(h.lahja || 0) + Number(h.safai || 0) + Number(h.adiya || 0);
      } else {
        const subjects = CLASS_DATA[selectedSection as Section]?.find(c => c.name === selectedClass)?.subjects || [];
        total = subjects.reduce((sum, sub) => sum + (Number(res?.subjects?.[sub]) || 0), 0);
      }
      return { id: s.id, total };
    }).sort((a, b) => b.total - a.total);

    const positions: Record<string, number> = {};
    let rank = 1;
    for (let i = 0; i < totals.length; i++) {
      if (i > 0 && totals[i].total < totals[i - 1].total) {
        rank = i + 1;
      }
      positions[totals[i].id] = rank;
    }
    return positions;
  };

  const [resultsList, setResultsList] = useState<any[]>([]);
  const [reportSection, setReportSection] = useState<Section | ''>('');
  const [reportClass, setReportClass] = useState('');

  const fetchResults = async () => {
    if (!reportSection || !reportClass) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'results'),
        where('class', '==', reportClass),
        where('examType', '==', examType)
      );
      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(doc => doc.data());
      
      const sq = query(
        collection(db, 'students'), 
        where('section', '==', reportSection),
        where('currentClass', '==', reportClass)
      );
      const sSnap = await getDocs(sq);
      const studentsMap: Record<string, any> = {};
      sSnap.forEach(d => studentsMap[d.id] = d.data());

      setResultsList(results.map(r => ({
        ...r,
        studentName: studentsMap[r.studentId]?.name || 'نامعلوم',
        fatherName: studentsMap[r.studentId]?.fatherName || '-'
      })).sort((a: any, b: any) => (b.totalMarks || 0) - (a.totalMarks || 0)));
    } catch (e: any) {
      console.error(e);
      if (e.code === 'unavailable') {
        alert('سرور سے رابطہ منقطع ہے۔ براہ کرم انٹرنیٹ چیک کریں۔');
      } else {
        handleFirestoreError(e, OperationType.LIST, 'results');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchRcStudents = async () => {
    if (!rcSection || !rcClass) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'students'),
        where('section', '==', rcSection),
        where('currentClass', '==', rcClass),
        where('status', '==', 'active')
      );
      const snapshot = await getDocs(q);
      const students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRcStudents(students);
      if (students.length === 0) alert('اس درجہ میں کوئی فعال طالب علم نہیں ملا');
    } catch (e: any) {
      console.error(e);
      if (e.code === 'unavailable') {
        alert('فائر اسٹور سرور تک رسائی میں ناکامی (نیٹ ورک کا مسئلہ)');
      } else {
        handleFirestoreError(e, OperationType.LIST, 'students');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchFullStudentResults = async (studentId: string) => {
    setLoading(true);
    try {
      const q = query(collection(db, 'results'), where('studentId', '==', studentId));
      const snapshot = await getDocs(q);
      const results: Record<string, any> = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        results[data.examType] = data;
      });
      return results;
    } catch (e: any) {
      console.error(e);
      if (e.code !== 'unavailable') {
        handleFirestoreError(e, OperationType.GET, 'student-results');
      }
      return {};
    } finally {
      setLoading(false);
    }
  };

  const downloadCollectiveExcel = () => {
    if (resultsList.length === 0) return;
    
    const isHifz = reportSection === Section.BANIN_HIFZ;
    const subjects = CLASS_DATA[reportSection as Section]?.find(c => c.name === reportClass)?.subjects || [];

    const data = resultsList.map((r, idx) => {
      const row: any = {
        'پوزیشن': idx + 1,
        'رجسٹریشن نمبر': r.regNo,
        'نام': r.studentName,
        'ولدیت': r.fatherName,
      };

      if (isHifz) {
        row['سوال 1'] = r.hifzBreakdown?.q1 || 0;
        row['سوال 2'] = r.hifzBreakdown?.q2 || 0;
        row['سوال 3'] = r.hifzBreakdown?.q3 || 0;
        row['لہجہ'] = r.hifzBreakdown?.lahja || 0;
        row['صفائی'] = r.hifzBreakdown?.safai || 0;
        row['ادعیہ'] = r.hifzBreakdown?.adiya || 0;
      } else {
        subjects.forEach(s => {
          row[s] = r.subjects?.[s] || 0;
        });
      }

      row['میزان'] = r.totalMarks;
      row['فیصد'] = r.percentage.toFixed(1) + '%';
      row['grade'] = r.grade;

      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Results");
    XLSX.writeFile(wb, `Collective_Result_${reportClass}_${examType}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const downloadCollectivePDF = async () => {
    if (!collectiveRef.current) return;
    setDownloadingPDF(true);
    try {
      await document.fonts.ready;
      const canvas = await html2canvas(collectiveRef.current, {
        scale: 4, // Higher scale for better resolution
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 0,
        onclone: (clonedDoc) => {
          sanitizeHtml2Canvas(clonedDoc);
        }
      });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const margin = 5;
      pdf.addImage(imgData, 'JPEG', margin, margin, pdfWidth - (margin * 2), pdfHeight - (margin * 2), undefined, 'FAST');
      pdf.save(`Collective_Result_${reportClass}_${examType}_${new Date().getTime()}.pdf`);
    } catch (e) {
      console.error(e);
      alert('پی ڈی ایف ڈاؤن لوڈ کرنے میں غلطی ہوئی۔');
    } finally {
      setDownloadingPDF(false);
    }
  };

  const downloadIndividualPDF = async () => {
    if (!individualRef.current) return;
    setDownloadingPDF(true);
    try {
      const canvas = await html2canvas(individualRef.current, {
        scale: 4, // Higher scale for better resolution
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 0,
        onclone: (clonedDoc) => {
          sanitizeHtml2Canvas(clonedDoc);
        }
      });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', [155, 215]); // 15.5cm x 21.5cm
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const margin = 5;
      pdf.addImage(imgData, 'JPEG', margin, margin, pdfWidth - (margin * 2), pdfHeight - (margin * 2), undefined, 'FAST');
      pdf.save(`Report_Card_${student?.name}_${examType}_${new Date().getTime()}.pdf`);
    } catch (e) {
      console.error(e);
      alert('پی ڈی ایف ڈاؤن لوڈ کرنے میں غلطی ہوئی۔');
    } finally {
      setDownloadingPDF(false);
    }
  };

  const downloadIndividualExcel = () => {
    if (!student) return;
    
    const data = Object.keys(studentAllResults).map(exam => {
      const res = studentAllResults[exam as ExamType];
      if (!res) return null;
      
      const row: any = {
        'امتحان': exam,
        'کل نمبر': res.totalMarks,
        'فیصد': res.percentage.toFixed(1) + '%',
        'گریڈ': res.grade
      };
      
      if (student.section === Section.BANIN_HIFZ) {
         if (res.hifzBreakdown) {
           Object.assign(row, res.hifzBreakdown);
         }
      } else {
         if (res.subjects) {
           Object.assign(row, res.subjects);
         }
      }
      return row;
    }).filter(Boolean);

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Student_Report");
    XLSX.writeFile(wb, `Report_Card_${student.name}.xlsx`);
  };

  const positionsMap = calculatePositions(classStudents);

  return (
    <div className="space-y-8 font-urdu">
      {connectionError && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-3 text-red-700">
          <Info className="w-5 h-5" />
          <p className="font-bold">ڈیٹا بیس سے رابطہ منقطع ہے۔ براہ کرم صفحہ ریفریش کریں یا انٹرنیٹ چیک کریں۔</p>
        </div>
      )}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">امتحانات اور نتائج</h1>
          <p className="text-gray-500 font-bold text-lg">طلباء کے تعلیمی ریکارڈ اور رزلٹ کارڈز کا انتظام</p>
        </div>
        <div className="flex bg-[#022c22] p-1.5 rounded-2xl border border-white/5 shadow-premium self-start">
          {[
            { id: 'class-entry', label: 'درجہ وار اندراج' },
            { id: 'report-card', label: 'انفرادی رزلٹ کارڈ' },
            { id: 'reports', label: 'اجتماعی رزلٹ شیٹ' }
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-8 py-3 rounded-xl font-bold text-base transition-all whitespace-nowrap", 
                activeTab === tab.id 
                  ? "bg-emerald-600 text-white shadow-lg scale-105" 
                  : "text-emerald-100/50 hover:text-white"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'class-entry' ? (
        <div className="space-y-8">
          {/* Selection Card */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-premium border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-8 items-end">
            <div className="space-y-3 text-right">
              <label className="text-sm font-black text-emerald-900 pr-2">سیکشن کا انتخاب</label>
              <select 
                value={selectedSection} 
                onChange={(e) => {
                  setSelectedSection(e.target.value as Section);
                  setSelectedClass('');
                  setClassStudents([]);
                }}
                className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-lg"
              >
                <option value="">انتخاب کریں</option>
                {Object.values(Section).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-3 text-right">
              <label className="text-sm font-black text-emerald-900 pr-2">درجہ کا انتخاب</label>
              <select 
                value={selectedClass} 
                onChange={(e) => setSelectedClass(e.target.value)}
                disabled={!selectedSection}
                className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-lg disabled:opacity-50"
              >
                <option value="">انتخاب کریں</option>
                {selectedSection && CLASS_DATA[selectedSection as Section].map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-3 text-right">
              <label className="text-sm font-black text-emerald-900 pr-2">امتحان منتخب کریں</label>
              <select 
                value={examType} 
                onChange={(e) => setExamType(e.target.value as ExamType)}
                className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-lg"
              >
                {Object.values(ExamType).map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <button
              onClick={fetchClassStudents}
              disabled={loading || !selectedClass}
              className="bg-emerald-600 h-[64px] rounded-2xl text-white font-black text-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-900/10 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-6 h-6" />}
              <span>شیٹ کھولیں</span>
            </button>
          </div>

          {classStudents.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden"
            >
              <div className="p-8 border-b bg-gray-50 flex justify-between items-center">
                <h3 className="text-xl font-bold flex items-center gap-3">
                  <GraduationCap className="w-6 h-6 text-emerald-600" />
                  نتائج اندراج شیٹ - {selectedClass} ({selectedSection})
                </h3>
                <button
                  onClick={saveClassResults}
                  disabled={saving}
                  className="bg-emerald-600 px-8 py-3 rounded-xl text-white font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-100"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  <span>تمام محفوظ کریں</span>
                </button>
              </div>

              <div className="overflow-x-auto p-1">
                <table className="w-full text-right border-collapse min-w-[1200px]">
                  <thead>
                    <tr className="bg-emerald-50 text-emerald-900">
                      <th className="p-4 border font-black w-40">رجسٹریشن نمبر</th>
                      <th className="p-4 border font-black w-40 text-right">طالب علم کا نام</th>
                      {selectedSection !== Section.BANIN_HIFZ && CLASS_DATA[selectedSection as Section]?.find(c => c.name === selectedClass)?.subjects.map(s => (
                        <th key={s} className="p-2 border font-black text-center text-xs">{s}</th>
                      ))}
                      {selectedSection === Section.BANIN_HIFZ && ['سوال 1', 'سوال 2', 'سوال 3', 'لہجہ', 'صفائی', 'ادعیہ'].map(s => (
                        <th key={s} className="p-4 border font-black text-center">{s}</th>
                      ))}
                      <th className="p-4 border font-black w-24 text-center">مجموعہ</th>
                      <th className="p-4 border font-black w-20 text-center">پوزیشن</th>
                      <th className="p-4 border font-black w-28 text-center">کیفیت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classStudents.map((s, sIndex) => {
                      const res = classResults[s.id] || { subjects: {}, hifzBreakdown: {} };
                      const subjects = CLASS_DATA[selectedSection as Section]?.find(c => c.name === selectedClass)?.subjects || [];
                      const isHifz = selectedSection === Section.BANIN_HIFZ;
                      
                      let total = 0;
                      if (isHifz) {
                        const h = res.hifzBreakdown || {};
                        total = Number(h.q1 || 0) + Number(h.q2 || 0) + Number(h.q3 || 0) + Number(h.lahja || 0) + Number(h.safai || 0) + Number(h.adiya || 0);
                      } else {
                        total = subjects.reduce((sum, sub) => sum + (Number(res.subjects?.[sub]) || 0), 0);
                      }

                      const maxTotal = isHifz ? 100 : subjects.length * 100;
                      const percentage = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
                      const grade = calculateGrade(percentage);

                      return (
                        <tr key={s.id} className="hover:bg-gray-50 border-b">
                          <td className="p-2 border font-mono text-center whitespace-nowrap">{s.regNo}</td>
                          <td className="p-4 border font-bold text-gray-800 text-right">{s.name}</td>
                          
                          {isHifz ? (
                            ['q1', 'q2', 'q3', 'lahja', 'safai', 'adiya'].map((k, kIndex) => (
                              <td key={k} className="p-2 border text-center">
                                <input 
                                  id={`cell-${sIndex}-${kIndex}`}
                                  type="number"
                                  value={res.hifzBreakdown?.[k] || ''}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    setClassResults(prev => ({
                                      ...prev,
                                      [s.id]: {
                                        ...prev[s.id],
                                        hifzBreakdown: { ...prev[s.id].hifzBreakdown, [k]: val }
                                      }
                                    }));
                                  }}
                                  onKeyDown={(e) => handleCellKeyDown(e, sIndex, kIndex, classStudents.length, 6)}
                                  className="w-14 text-center py-1 border rounded-md focus:ring-2 focus:ring-emerald-500 font-bold"
                                />
                              </td>
                            ))
                          ) : (
                            subjects.map((sub, subIndex) => (
                              <td key={sub} className="p-1 border text-center">
                                <input 
                                  id={`cell-${sIndex}-${subIndex}`}
                                  type="number"
                                  value={res.subjects?.[sub] || ''}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    setClassResults(prev => ({
                                      ...prev,
                                      [s.id]: {
                                        ...prev[s.id],
                                        subjects: { ...prev[s.id].subjects, [sub]: val }
                                      }
                                    }));
                                  }}
                                  onKeyDown={(e) => handleCellKeyDown(e, sIndex, subIndex, classStudents.length, subjects.length)}
                                  className="w-12 text-center py-1 border rounded-md focus:ring-2 focus:ring-emerald-500 font-bold text-sm"
                                />
                              </td>
                            ))
                          )}

                          <td className="p-4 border text-center font-black text-emerald-700">{total}</td>
                          <td className="p-4 border text-center font-bold">{positionsMap[s.id]}</td>
                          <td className="p-4 border text-center font-bold">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-xs",
                              grade === 'راسب' ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                            )}>
                              {grade}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </div>
      ) : activeTab === 'report-card' ? (
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div className="space-y-2 text-right">
              <label className="text-sm font-bold text-gray-700">سیکشن</label>
              <select 
                value={rcSection} 
                onChange={(e) => {
                  setRcSection(e.target.value as Section);
                  setRcClass('');
                  setRcStudents([]);
                  setStudent(null);
                }}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">انتخاب کریں</option>
                {Object.values(Section).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-2 text-right">
              <label className="text-sm font-bold text-gray-700">درجہ</label>
              <select 
                value={rcClass} 
                onChange={(e) => setRcClass(e.target.value)}
                disabled={!rcSection}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">انتخاب کریں</option>
                {rcSection && CLASS_DATA[rcSection as Section].map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <button
              onClick={fetchRcStudents}
              disabled={loading || !rcClass}
              className="bg-emerald-600 h-[52px] rounded-xl text-white font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 font-urdu"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              <span>تلاش کریں</span>
            </button>
          </div>

          {!student && rcStudents.length > 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden"
            >
              <div className="p-6 border-b bg-gray-50">
                <h3 className="font-bold">طلباء کی فہرست ({rcClass})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600">
                      <th className="p-4 border-b">رجسٹریشن نمبر</th>
                      <th className="p-4 border-b">نام</th>
                      <th className="p-4 border-b">ولدیت</th>
                      <th className="p-4 border-b text-center">ایکشن</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rcStudents.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50 border-b">
                        <td className="p-4 font-mono">{s.regNo}</td>
                        <td className="p-4 font-bold">{s.name}</td>
                        <td className="p-4">{s.fatherName}</td>
                        <td className="p-4 text-center">
                          <button
                            onClick={async () => {
                              setLoading(true);
                              setStudent(s as Student);
                              const fullResults = await fetchFullStudentResults(s.id);
                              setStudentAllResults(fullResults);
                              setLoading(false);
                            }}
                            className="bg-emerald-50 text-emerald-600 px-4 py-1 rounded-lg font-bold hover:bg-emerald-100"
                          >
                            رپورٹ کارڈ دیکھیں
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {student && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-8"
            >
              <div className="flex justify-between items-center bg-gray-50 p-6 rounded-2xl mb-8 no-print">
                <h3 className="text-xl font-bold">رپورٹ کارڈ منظر</h3>
                <div className="flex gap-4 flex-wrap">
                  <button
                    onClick={downloadIndividualExcel}
                    className="bg-emerald-50 text-emerald-700 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-100 transition-all font-urdu border border-emerald-100"
                  >
                    <FileSpreadsheet className="w-5 h-5" />
                    ایکسل ڈاؤن لوڈ
                  </button>
                  <button
                    onClick={downloadIndividualPDF}
                    disabled={downloadingPDF}
                    className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-red-700 shadow-lg shadow-red-100 disabled:opacity-50 font-urdu"
                  >
                    {downloadingPDF ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                    پی ڈی ایف
                  </button>
                  <button
                    onClick={() => setStudent(null)}
                    className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all font-urdu"
                  >
                    فہرست پر واپس جائیں
                  </button>
                </div>
              </div>

              {/* Report Card content wrapper for PDF generation */}
              <div 
                ref={individualRef} 
                className="bg-white mx-auto relative overflow-hidden flex flex-col px-8 py-4 border-2 border-emerald-900 font-urdu" 
                style={{ width: '15.5cm', height: '21.5cm' }}
                id="report-card-print"
              >
                {/* Watermark Logo */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.05] pointer-events-none">
                  <img src={logo} alt="Watermark" className="w-[80%] object-contain" />
                </div>

                {/* Header */}
                <div className="relative text-center mb-1 pt-1">
                  <div className="flex flex-col items-center gap-1">
                    <h1 className="text-3xl font-black text-emerald-950">جامعہ تعلیم القرآن ناگمان ضلع پشاور</h1>
                    <p className="text-xl font-bold font-nastaleeq text-black leading-tight">سالانہ تعلیمی رپورٹ</p>
                  </div>
                </div>

                {/* Student Info Grid */}
                <div className="relative grid grid-cols-2 gap-x-12 gap-y-2 mb-2">
                  <div className="flex gap-2 items-end">
                    <span className="text-emerald-900 whitespace-nowrap font-black text-base mb-1">طالب علم:</span>
                    <div className="flex-1 text-center font-nastaleeq border-b-2 border-emerald-900/30 pb-0.5">
                      <span className="font-black text-2xl text-gray-900 leading-none inline-block whitespace-nowrap">{student.name}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 items-end">
                    <span className="text-emerald-900 whitespace-nowrap font-black text-base mb-1">ولدیت:</span>
                    <div className="flex-1 text-center font-nastaleeq border-b-2 border-emerald-900/30 pb-0.5">
                      <span className="font-black text-2xl text-gray-900 leading-none inline-block whitespace-nowrap">{student.fatherName}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 items-end">
                    <span className="text-emerald-900 whitespace-nowrap font-black text-base mb-1">درجہ:</span>
                    <div className="flex-1 text-center font-nastaleeq border-b-2 border-emerald-900/30 pb-0.5">
                      <span className="font-black text-xl text-emerald-900 leading-none inline-block whitespace-nowrap">{student.currentClass} ({student.section})</span>
                    </div>
                  </div>
                  <div className="flex gap-2 items-end">
                    <span className="text-emerald-900 whitespace-nowrap font-black text-base font-mono mb-1">Roll No:</span>
                    <div className="flex-1 text-center border-b-2 border-emerald-900/30 pb-0.5">
                      <span className="font-mono font-black text-xl text-gray-900 leading-none inline-block whitespace-nowrap">{student.regNo}</span>
                    </div>
                  </div>
                </div>

                {/* Main Table */}
                <div className="relative flex-1">
                  <table className="w-full border-collapse border-2 border-emerald-900 text-center table-fixed">
                    <thead>
                      <tr className="bg-emerald-900 text-white h-12">
                        <th className="border border-white/10 font-black text-xl w-[35%] text-center align-top pt-2">مضامین</th>
                        <th className="border border-white/10 font-black text-base text-center align-top pt-3">سہ ماہی</th>
                        <th className="border border-white/10 font-black text-base text-center align-top pt-3">شش ماہی</th>
                        <th className="border border-white/10 font-black text-base text-center align-top pt-3">سالانہ</th>
                        <th className="border border-white/10 font-black text-xl text-center align-top pt-2">مجموعہ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {student.section !== Section.BANIN_HIFZ ? (
                        CLASS_DATA[student.section as Section]?.find(c => c.name === student.currentClass)?.subjects.map((sub, idx) => {
                          const q = studentAllResults[ExamType.QUARTERLY]?.subjects?.[sub] ?? '-';
                          const h = studentAllResults[ExamType.HALF_YEARLY]?.subjects?.[sub] ?? '-';
                          const a = studentAllResults[ExamType.ANNUAL]?.subjects?.[sub] ?? '-';
                          const total = (Number(q) || 0) + (Number(h) || 0) + (Number(a) || 0);
                          return (
                            <tr key={idx} className="h-11 hover:bg-emerald-50/10">
                              <td className="border border-emerald-900/20 font-bold text-emerald-950 text-center align-top pt-1 whitespace-nowrap text-lg">{sub}</td>
                              <td className="border border-emerald-900/20 text-gray-700 text-center font-bold align-top pt-2 text-base">{q}</td>
                              <td className="border border-emerald-900/20 text-gray-700 text-center font-bold align-top pt-2 text-base">{h}</td>
                              <td className="border border-emerald-900/20 text-gray-700 text-center font-bold align-top pt-2 text-base">{a}</td>
                              <td className="border border-emerald-900/20 font-black text-black text-xl text-center align-top pt-1">{total || '-'}</td>
                            </tr>
                          );
                        })
                      ) : (
                        ['سوال 1', 'سوال 2', 'سوال 3', 'لہجہ', 'صفائی', 'ادعیہ'].map((sub, idx) => {
                          const keys = ['q1', 'q2', 'q3', 'lahja', 'safai', 'adiya'];
                          const key = keys[idx];
                          const q = studentAllResults[ExamType.QUARTERLY]?.hifzBreakdown?.[key] ?? '-';
                          const h = studentAllResults[ExamType.HALF_YEARLY]?.hifzBreakdown?.[key] ?? '-';
                          const a = studentAllResults[ExamType.ANNUAL]?.hifzBreakdown?.[key] ?? '-';
                          const total = (Number(q) || 0) + (Number(h) || 0) + (Number(a) || 0);
                          return (
                            <tr key={idx} className="h-11 hover:bg-emerald-50/10">
                              <td className="border border-emerald-900/20 font-bold text-emerald-950 text-center align-top pt-1 whitespace-nowrap text-lg">{sub}</td>
                              <td className="border border-emerald-900/20 text-gray-700 text-center font-bold align-top pt-2 text-base">{q}</td>
                              <td className="border border-emerald-900/20 text-gray-700 text-center font-bold align-top pt-2 text-base">{h}</td>
                              <td className="border border-emerald-900/20 text-gray-700 text-center font-bold align-top pt-2 text-base">{a}</td>
                              <td className="border border-emerald-900/20 font-black text-black text-xl text-center align-top pt-1">{total || '-'}</td>
                            </tr>
                          );
                        })
                      )}
                      {/* Total Marks Row */}
                      <tr className="bg-emerald-50 text-emerald-950 h-14 border-t-2 border-emerald-900">
                        <td className="border border-emerald-900/20 font-black text-lg text-center align-top pt-2.5">کل حاصل کردہ نمبرات</td>
                        <td className="border border-emerald-900/20 font-black text-lg text-center align-top pt-2.5">{studentAllResults[ExamType.QUARTERLY]?.totalMarks || '0'}</td>
                        <td className="border border-emerald-900/20 font-black text-lg text-center align-top pt-2.5">{studentAllResults[ExamType.HALF_YEARLY]?.totalMarks || '0'}</td>
                        <td className="border border-emerald-900/20 font-black text-lg text-center align-top pt-2.5">{studentAllResults[ExamType.ANNUAL]?.totalMarks || '0'}</td>
                        <td className="border border-emerald-900/30 text-emerald-950 font-black text-2xl text-center align-top pt-1.5 italic bg-emerald-100/30">
                          {(Number(studentAllResults[ExamType.QUARTERLY]?.totalMarks) || 0) + 
                           (Number(studentAllResults[ExamType.HALF_YEARLY]?.totalMarks) || 0) + 
                           (Number(studentAllResults[ExamType.ANNUAL]?.totalMarks) || 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Summary Section */}
                <div className="relative mt-0 px-10">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="text-base font-black text-emerald-900">مجموعی فیصد:</span>
                      <span className="text-xl font-black text-emerald-950 italic">
                        {(((studentAllResults[ExamType.QUARTERLY]?.percentage || 0) + 
                          (studentAllResults[ExamType.HALF_YEARLY]?.percentage || 0) + 
                          (studentAllResults[ExamType.ANNUAL]?.percentage || 0)) / 3).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-base font-black text-emerald-900">مجموعی کیفیت:</span>
                      <span className="text-2xl font-black text-emerald-950 font-nastaleeq">
                        {calculateGrade((((studentAllResults[ExamType.QUARTERLY]?.percentage || 0) + 
                          (studentAllResults[ExamType.HALF_YEARLY]?.percentage || 0) + 
                          (studentAllResults[ExamType.ANNUAL]?.percentage || 0)) / 300) * 100)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Signatures */}
                <div className="relative mt-auto flex justify-between px-8 pt-4 pb-12">
                  <div className="flex items-end gap-2">
                    <p className="font-nastaleeq font-black text-emerald-900 text-2xl whitespace-nowrap">دستخط ناظم</p>
                    <div className="w-32 border-b-2 border-emerald-900/30 pb-0.5 mb-2"></div>
                  </div>
                  <div className="flex items-end gap-2">
                    <p className="font-nastaleeq font-black text-emerald-900 text-2xl whitespace-nowrap">دستخط مہتمم</p>
                    <div className="w-32 border-b-2 border-emerald-900/30 pb-0.5 mb-2"></div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div className="space-y-2 text-right">
              <label className="text-sm font-bold text-gray-700">سیکشن</label>
              <select 
                value={reportSection} 
                onChange={(e) => setReportSection(e.target.value as Section)}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">انتخاب کریں</option>
                {Object.values(Section).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-2 text-right">
              <label className="text-sm font-bold text-gray-700">درجہ</label>
              <select 
                value={reportClass} 
                onChange={(e) => setReportClass(e.target.value)}
                disabled={!reportSection}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">انتخاب کریں</option>
                {reportSection && CLASS_DATA[reportSection as Section].map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-2 text-right">
              <label className="text-sm font-bold text-gray-700">امتحان</label>
              <select 
                value={examType} 
                onChange={(e) => setExamType(e.target.value as ExamType)}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500"
              >
                {Object.values(ExamType).map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <button
              onClick={fetchResults}
              disabled={loading || !reportClass}
              className="bg-emerald-600 h-[52px] rounded-xl text-white font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 font-urdu"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              <span>تلاش کریں</span>
            </button>
          </div>

          {resultsList.length > 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden"
            >
              <div className="p-8 border-b bg-gray-50 flex justify-between items-center print:bg-white flex-wrap gap-4">
                <div className="flex-1 text-center min-w-[300px]">
                  <h2 className="text-2xl font-bold">نتیجہ {examType} جامعہ تعلیم القرآن پشاور</h2>
                  <p className="text-emerald-700 font-bold mt-1">(سیکشن {reportSection} درجہ {reportClass})</p>
                </div>
                <div className="flex gap-3 no-print">
                  <button
                    onClick={downloadCollectiveExcel}
                    className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl font-bold border border-emerald-100 hover:bg-emerald-100 transition-all"
                  >
                    <FileSpreadsheet className="w-5 h-5" />
                    ایکسل
                  </button>
                  <button
                    onClick={downloadCollectivePDF}
                    disabled={downloadingPDF}
                    className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-2 rounded-xl font-bold border border-red-100 hover:bg-red-100 transition-all font-urdu"
                  >
                    {downloadingPDF ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                    پی ڈی ایف
                  </button>
                </div>
              </div>
              
              <div ref={collectiveRef} className="bg-white pt-4 pb-12 px-10 relative overflow-hidden print-area border border-gray-100 shadow-sm mx-auto" style={{ minWidth: '297mm', minHeight: '210mm' }}>
                {/* Watermark Logo */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.05] pointer-events-none">
                  <img src={logo} alt="Watermark" className="w-[500px] h-[500px] object-contain" />
                </div>

                {/* Header Section */}
                <div className="relative mb-3 px-2">
                  <div className="flex justify-between items-end border-b-2 border-emerald-900 pb-2">
                    {/* Item 1: Exam Type */}
                    <div className="flex items-end gap-1.5 pb-0.5">
                      <span className="text-emerald-900 font-nastaleeq font-bold text-base leading-none">نتیجہ امتحان:</span>
                      <span className="font-nastaleeq font-black text-xl text-emerald-950 leading-none">
                        {examType === ExamType.QUARTERLY ? 'سہ ماہی' : examType === ExamType.HALF_YEARLY ? 'شش ماہی' : 'سالانہ'}
                      </span>
                    </div>

                    {/* Item 2: Printed Date */}
                    <div className="flex items-end gap-1 pb-0.5">
                      <span className="text-emerald-900 font-nastaleeq font-bold text-base leading-none">تاریخ طباعت:</span>
                      <span className="text-xs font-bold text-gray-700 font-mono leading-none relative -top-[3px]">{format(new Date(), 'dd/MM/yyyy')}</span>
                    </div>

                    {/* Item 3: School Name */}
                    <div className="pb-0.5">
                      <h1 className="text-2xl font-nastaleeq font-black text-emerald-955 leading-none">جامعہ تعلیم القرآن ناگمان ضلع پشاور</h1>
                    </div>

                    {/* Item 4: Section */}
                    <div className="flex items-end gap-1.5 pb-0.5">
                      <span className="text-emerald-900 font-nastaleeq font-bold text-base leading-none">سیکشن:</span>
                      <span className="font-nastaleeq font-black text-xl text-emerald-950 leading-none">{reportSection}</span>
                    </div>

                    {/* Item 5: Class */}
                    <div className="flex items-end gap-1.5 pb-0.5">
                      <span className="text-emerald-900 font-nastaleeq font-bold text-base leading-none">درجہ:</span>
                      <span className="font-nastaleeq font-black text-xl text-emerald-950 leading-none">{reportClass}</span>
                    </div>
                  </div>
                </div>

                <div className="relative overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs border-2 border-emerald-900">
                    <thead>
                      <tr className="bg-emerald-900 text-white font-nastaleeq">
                        <th className="border-r border-emerald-800 py-3 px-2 w-36 text-center font-black text-sm">رجسٹریشن نمبر</th>
                        <th className="border-r border-emerald-800 py-3 px-2 w-40 text-right font-black text-sm">نام طالب علم</th>
                        <th className="border-r border-emerald-800 py-3 px-2 w-44 font-black text-sm">ولدیت</th>
                        {reportSection !== Section.BANIN_HIFZ && CLASS_DATA[reportSection as Section]?.find(c => c.name === reportClass)?.subjects.map(s => (
                          <th key={s} className="border-r border-emerald-800 py-3 px-2 text-xs w-20 text-center font-black">{s}</th>
                        ))}
                        {reportSection === Section.BANIN_HIFZ && ['سوال 1', 'سوال 2', 'سوال 3', 'لہجہ', 'صفائی', 'ادعیہ'].map(s => (
                          <th key={s} className="border-r border-emerald-800 py-3 px-2 text-center font-black text-xs">{s}</th>
                        ))}
                        <th className="border-r border-emerald-800 py-3 px-2 w-20 text-center font-black text-sm">مجموعہ</th>
                        <th className="border-r border-emerald-800 py-3 px-2 w-16 text-center font-black text-sm">پوزیشن</th>
                        <th className="border py-3 px-2 w-24 text-center font-black text-sm">کیفیت</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultsList.map((res, i) => {
                        // Calculate position within the current report context
                        const reportTotals = resultsList.map(r => r.totalMarks).sort((a, b) => b - a);
                        let rank = 1;
                        for (let j = 0; j < reportTotals.length; j++) {
                          if (reportTotals[j] === res.totalMarks) {
                            rank = j + 1;
                            // Handle ties
                            while(j > 0 && reportTotals[j] === reportTotals[j-1]) {
                              rank--; j--;
                            }
                            break;
                          }
                        }

                        return (
                          <tr key={i} className="hover:bg-gray-50 border-b border-emerald-900/10">
                            <td className="border-r border-emerald-900/20 py-1.5 px-2 font-mono whitespace-nowrap text-center text-xs">{res.regNo}</td>
                            <td className="border-r border-emerald-900/20 py-1.5 px-2 font-nastaleeq font-black text-right text-base leading-tight">{res.studentName}</td>
                            <td className="border-r border-emerald-900/20 py-1.5 px-2 text-emerald-950 font-nastaleeq text-sm font-bold leading-tight">{res.fatherName}</td>
                            {reportSection !== Section.BANIN_HIFZ && CLASS_DATA[reportSection as Section]?.find(c => c.name === reportClass)?.subjects.map(s => (
                              <td key={s} className="border-r border-emerald-900/20 py-1.5 px-2 text-center font-black text-xs">{res.subjects?.[s] || '-'}</td>
                            ))}
                            {reportSection === Section.BANIN_HIFZ && (
                              <>
                                <td className="border-r border-emerald-900/20 py-1.5 px-2 text-center text-xs font-bold">{res.hifzBreakdown?.q1}</td>
                                <td className="border-r border-emerald-900/20 py-1.5 px-2 text-center text-xs font-bold">{res.hifzBreakdown?.q2}</td>
                                <td className="border-r border-emerald-900/20 py-1.5 px-2 text-center text-xs font-bold">{res.hifzBreakdown?.q3}</td>
                                <td className="border-r border-emerald-900/20 py-1.5 px-2 text-center text-xs font-bold">{res.hifzBreakdown?.lahja}</td>
                                <td className="border-r border-emerald-900/20 py-1.5 px-2 text-center text-xs font-bold">{res.hifzBreakdown?.safai}</td>
                                <td className="border-r border-emerald-900/20 py-1.5 px-2 text-center text-xs font-bold">{res.hifzBreakdown?.adiya}</td>
                              </>
                            )}
                            <td className="border-r border-emerald-900/20 py-1.5 px-2 text-center font-black text-emerald-800 bg-emerald-50/20 text-sm">{res.totalMarks}</td>
                            <td className="border-r border-emerald-900/20 py-1.5 px-2 text-center font-black text-sm">{rank}</td>
                            <td className="border py-1.5 px-2 text-center font-black text-xs font-nastaleeq leading-tight">
                              {res.grade}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer Signatures for Collective Sheet */}
                <div className="mt-16 flex justify-between px-16 relative pb-8">
                  <div className="flex items-end gap-2">
                    <p className="font-nastaleeq font-black text-2xl text-emerald-900 whitespace-nowrap">دستخط ناظم</p>
                    <div className="w-48 border-b-2 border-emerald-900/30 pb-0.5 mb-2"></div>
                  </div>
                  <div className="flex items-end gap-2">
                    <p className="font-nastaleeq font-black text-2xl text-emerald-900 whitespace-nowrap">دستخط مہتمم</p>
                    <div className="w-48 border-b-2 border-emerald-900/30 pb-0.5 mb-2"></div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
