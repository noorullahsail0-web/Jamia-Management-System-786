import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { Section, Student, ExamResult, ExamType } from '../types';
import { CLASS_DATA } from '../constants';
import { GraduationCap, Search, Save, FileText, ChevronRight, Loader2, Info, FileSpreadsheet, Download, Copy, Image } from 'lucide-react';
import { cn, sanitizeHtml2Canvas } from '../lib/utils';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import logo from '../assets/logo.png';

export default function Results() {
  const currentYear = new Date().getFullYear();
  const academicYears = Array.from({ length: 2126 - 1995 + 1 }, (_, i) => {
    const y = 1995 + i;
    return y.toString();
  });
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
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
  const [copyingImage, setCopyingImage] = useState(false);
  const [downloadingImage, setDownloadingImage] = useState(false);
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
          const fullResults = await fetchFullStudentResults(studentData.id, selectedYear);
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
      students.sort((a, b) => (a.regNo || '').localeCompare(b.regNo || '', undefined, { numeric: true }));
      setClassStudents(students);

      // Fetch existing results for this class and exam type
      const rq = query(
        collection(db, 'results'),
        where('class', '==', selectedClass),
        where('examType', '==', examType),
        where('year', '==', selectedYear)
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

  // نتائج سسٹم کے انفرادی رزلٹ کارڈ و اجتماعی رزلٹ شیٹ کے لیے گریڈ (کیفیت) کا حساب
  const calculateGrade = (total: number, maxTotal: number = 100) => {
    if (maxTotal === 0) return 'راسب';
    
    // اگر کل نمبر 600 ہیں (جیسا کہ بنین اور بنات درس نظامی کے اکثر درجات میں 6 مضامین ہوتے ہیں):
    if (maxTotal === 600) {
      if (total >= 478 && total <= 600) return 'ممتاز';
      if (total >= 357 && total <= 477) return 'جید جدا';
      if (total >= 297 && total <= 356) return 'جید';
      if (total >= 240 && total <= 296) return 'مقبول';
      return 'راسب'; // 1 سے 239 تک 'راسب'
    }

    // اگر کل نمبر 100 ہیں (جیسے واؤچر/فیصد کے لیے):
    if (maxTotal === 100) {
      if (total >= 79.66) return 'ممتاز';
      if (total >= 59.5) return 'جید جدا';
      if (total >= 49.5) return 'جید';
      if (total >= 40.0) return 'مقبول';
      return 'راسب';
    }

    // اگر کل نمبر مختلف ہوں (مثلاً 700):
    // تو ان حدوں کو متناسب (Proportionally) فیصد کے حساب سے لاگو کیا جائے گا:
    // ممتاز: 79.67% (478/600)
    // جید جدا: 59.5% (357/600)
    // جید: 49.5% (297/600)
    // مقبول: 40% (240/600)
    const ratio = total / maxTotal;
    if (ratio >= 478 / 600 - 0.0001) return 'ممتاز';
    if (ratio >= 357 / 600 - 0.0001) return 'جید جدا';
    if (ratio >= 297 / 600 - 0.0001) return 'جید';
    if (ratio >= 240 / 600 - 0.0001) return 'مقبول';
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
        const grade = calculateGrade(total, maxTotal);

        const resultData: any = {
          studentId: student.id,
          regNo: student.regNo,
          examType,
          year: selectedYear,
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
          where('examType', '==', examType),
          where('year', '==', selectedYear)
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
        where('examType', '==', examType),
        where('year', '==', selectedYear)
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
      })).sort((a: any, b: any) => (a.regNo || '').localeCompare(b.regNo || '', undefined, { numeric: true })));
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
      students.sort((a: any, b: any) => (a.regNo || '').localeCompare(b.regNo || '', undefined, { numeric: true }));
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

  const fetchFullStudentResults = async (studentId: string, yearStr: string) => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'results'),
        where('studentId', '==', studentId),
        where('year', '==', yearStr)
      );
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

    const headers = [
      'رجسٹریشن نمبر',
      'نام طالب علم',
      'ولدیت'
    ];
    if (isHifz) {
      headers.push('سوال 1', 'سوال 2', 'سوال 3', 'لہجہ', 'صفائی', 'ادعیہ');
    } else {
      headers.push(...subjects);
    }
    headers.push('مجموعہ', 'پوزیشن', 'کیفیت');

    const aoa: any[][] = [];
    
    // Row 1: School Title
    const titleRow = new Array(headers.length).fill("");
    titleRow[0] = "جامعہ تعلیم القرآن ناگمان ضلع پشاور";
    aoa.push(titleRow);

    // Row 2: Subtitle/Meta 1
    const examUrdu = examType === ExamType.QUARTERLY ? 'سہ ماہی' : examType === ExamType.HALF_YEARLY ? 'شش ماہی' : 'سالانہ';
    const dateStr = format(new Date(), 'dd/MM/yyyy');
    const metaRow1 = new Array(headers.length).fill("");
    metaRow1[0] = `نتیجہ امتحان: ${examUrdu} (${selectedYear}ء)`;
    metaRow1[Math.floor(headers.length / 2)] = `تاریخ طباعت: ${dateStr}`;
    aoa.push(metaRow1);

    // Row 3: Subtitle/Meta 2
    const metaRow2 = new Array(headers.length).fill("");
    metaRow2[0] = `سیکشن: ${reportSection}`;
    metaRow2[Math.floor(headers.length / 2)] = `درجہ: ${reportClass}`;
    aoa.push(metaRow2);

    // Row 4: Empty space
    aoa.push([]);

    // Row 5: Table Header
    aoa.push(headers);

    // Row 6+: Table Data Rows
    resultsList.forEach((res) => {
      const reportTotals = resultsList.map(r => r.totalMarks).sort((a, b) => b - a);
      let rank = 1;
      for (let j = 0; j < reportTotals.length; j++) {
        if (reportTotals[j] === res.totalMarks) {
          rank = j + 1;
          while(j > 0 && reportTotals[j] === reportTotals[j-1]) {
            rank--; j--;
          }
          break;
        }
      }

      const maxTotal = isHifz ? 100 : subjects.length * 100;
      const grade = calculateGrade(res.totalMarks, maxTotal);

      const row: any[] = [
        res.regNo,
        res.studentName,
        res.fatherName
      ];

      if (isHifz) {
        row.push(
          res.hifzBreakdown?.q1 ?? 0,
          res.hifzBreakdown?.q2 ?? 0,
          res.hifzBreakdown?.q3 ?? 0,
          res.hifzBreakdown?.lahja ?? 0,
          res.hifzBreakdown?.safai ?? 0,
          res.hifzBreakdown?.adiya ?? 0
        );
      } else {
        subjects.forEach(s => {
          row.push(res.subjects?.[s] ?? 0);
        });
      }

      row.push(res.totalMarks, rank, grade);
      aoa.push(row);
    });

    // Empty space before signatures
    aoa.push([]);
    aoa.push([]);

    // Signatures Row
    const sigRow = new Array(headers.length).fill("");
    sigRow[1] = "دستخط ناظم: _______________________";
    sigRow[headers.length - 2] = "دستخط مہتمم: _______________________";
    aoa.push(sigRow);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    
    // Add merge metadata to the worksheet
    ws['!merges'] = [
      // Merge Title row (Row 0, columns 0 to headers.length-1)
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }
    ];

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
        scale: 2, // Standard robust scale for clean crisp results without memory limits
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
        scale: 2, // Standard robust scale for clean crisp results without memory limits
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

  const copyIndividualAsImage = async () => {
    if (!individualRef.current) return;
    setCopyingImage(true);
    try {
      await document.fonts.ready;
      const canvas = await html2canvas(individualRef.current, {
        scale: 2.5, // Crisp resolution for copy
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 0,
        onclone: (clonedDoc) => {
          sanitizeHtml2Canvas(clonedDoc);
        }
      });
      
      canvas.toBlob(async (blob) => {
        if (!blob) {
          alert('تصویر بنانے میں غلطی ہوئی۔');
          return;
        }
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              'image/png': blob
            })
          ]);
          alert('رپورٹ کارڈ کی تصویر کامیابی سے کاپی ہو گئی ہے! اب نیچے سبز بٹن "واٹس ایپ اطلاع" پر کلک کریں اور وہاں چیٹ میں جا کر تصویر پیسٹ (Ctrl+V یا Paste) کر کے بھیج دیں۔');
        } catch (err) {
          console.error('Clipboard copy failed:', err);
          // Fallback to auto download
          const link = document.createElement('a');
          link.download = `Report_Card_${student?.name || 'student'}_${examType}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
          alert('سیکیورٹی وجوہات کی بناء پر آپ کا براؤزر خودکار کاپی کی اجازت نہیں دے رہا۔ تصویر ڈاؤن لوڈ کر دی گئی ہے، اب آپ اسے واٹس ایپ پر اٹیچ کر سکتے ہیں!');
        }
      }, 'image/png');
    } catch (e) {
      console.error(e);
      alert('رپورٹ کارڈ کی تصویر بنانے میں غلطی ہوئی۔');
    } finally {
      setCopyingImage(false);
    }
  };

  const downloadIndividualAsImage = async () => {
    if (!individualRef.current) return;
    setDownloadingImage(true);
    try {
      await document.fonts.ready;
      const canvas = await html2canvas(individualRef.current, {
        scale: 2.5, // Crisp resolution for download
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 0,
        onclone: (clonedDoc) => {
          sanitizeHtml2Canvas(clonedDoc);
        }
      });
      
      const link = document.createElement('a');
      link.download = `Report_Card_${student?.name || 'student'}_${examType}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      alert('رپورٹ کارڈ کی تصویر کامیابی سے ڈاؤن لوڈ ہو گئی ہے!');
    } catch (e) {
      console.error(e);
      alert('تصویر ڈاؤن لوڈ کرنے میں غلطی ہوئی۔');
    } finally {
      setDownloadingImage(false);
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

  const getIndividualWhatsAppLink = (student: Student) => {
    const examTermUrdu = 
      examType === ExamType.QUARTERLY ? 'پہلے سہ ماہی امتحان' :
      examType === ExamType.HALF_YEARLY ? 'شش ماہی امتحان' :
      'سالانہ امتحان';

    const message = `محترم ${student.fatherName} صاحب آپ کے زیر سرپرست ${student.name} بن ${student.fatherName} کے ${examTermUrdu} کا رپورٹ کارڈ جامعہ تعلیم القرآن ناگمان کے دفتر تعلیمات کی طرف سے بھیجا جارہا ہے۔

برائے مہربانی طالب علم کا تعلیمی رپورٹ کارڈ کو دیکھیں۔اور تعلیمی صلاحیت کومزید بہتر کروانے کے لئے تکرار اور مطالعہ پر مزید محنت کروائیں۔

شکریہ
از طرف انتظامیہ جامعہ تعلیم القرآن ناگمان ضلع پشاور`;

    return `https://wa.me/${student.phone?.replace(/[^0-9]/g, '') || ''}?text=${encodeURIComponent(message)}`;
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
          <div className="bg-white p-8 rounded-[2.5rem] shadow-premium border border-gray-100 grid grid-cols-1 lg:grid-cols-5 gap-6 items-end">
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
              <label className="text-sm font-black text-emerald-900 pr-2">تعلیمی سال</label>
              <select 
                value={selectedYear} 
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setClassStudents([]);
                }}
                className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-lg"
              >
                {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
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
                      const grade = calculateGrade(total, maxTotal);

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
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
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
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold"
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
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold"
              >
                <option value="">انتخاب کریں</option>
                {rcSection && CLASS_DATA[rcSection as Section].map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-2 text-right">
              <label className="text-sm font-bold text-gray-700">تعلیمی سال</label>
              <select 
                value={selectedYear} 
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setStudent(null);
                  setRcStudents([]);
                }}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold"
              >
                {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
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
                              const fullResults = await fetchFullStudentResults(s.id, selectedYear);
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
                    onClick={copyIndividualAsImage}
                    disabled={copyingImage}
                    className="bg-sky-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-sky-700 shadow-lg shadow-sky-100 disabled:opacity-50 font-urdu"
                  >
                    {copyingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Copy className="w-5 h-5" />}
                    رپورٹ کارڈ تصویر کاپی کریں
                  </button>
                  <button
                    onClick={downloadIndividualAsImage}
                    disabled={downloadingImage}
                    className="bg-indigo-50 text-indigo-700 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-100 transition-all font-urdu border border-indigo-100 disabled:opacity-50"
                  >
                    {downloadingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Image className="w-5 h-5" />}
                    تصویر ڈاؤن لوڈ کریں
                  </button>
                  <a
                    href={getIndividualWhatsAppLink(student)}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-[#25D366] hover:bg-[#20ba5a] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-[#25D366]/10 transition-all font-urdu"
                  >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.705 1.459h.006c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    <span>واٹس ایپ اطلاع</span>
                  </a>
                  <button
                    onClick={() => setStudent(null)}
                    className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all font-urdu"
                  >
                    فہرست پر واپس جائیں
                  </button>
                </div>
              </div>

              {/* WhatsApp instruction notification block */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-900 text-sm font-urdu leading-relaxed max-w-4xl mx-auto mb-6 no-print">
                <div className="flex gap-3 items-start">
                  <span className="text-2xl mt-1">💡</span>
                  <div className="space-y-4 w-full">
                    <div>
                      <p className="font-bold text-lg text-amber-950 mb-1">واٹس ایپ پر رپورٹ کارڈ بھیجنے کے آسان طریقے:</p>
                      <p className="text-sm text-amber-900">
                        واٹس ایپ کی سیکیورٹی پالیسی کی وجہ سے ہم براہِ راست براؤزر سے اٹیچمنٹ واٹس ایپ پر نہیں بھیج سکتے، لیکن اب آپ کے پاس رپورٹ کارڈ کو واٹس ایپ پر شیئر کرنے کے دو بہترین اور آسان طریقے ہیں:
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <div className="bg-sky-50 border border-sky-100 p-4 rounded-xl space-y-2">
                        <p className="font-bold text-sky-950 text-base flex items-center gap-1">
                          <span className="text-lg">⭐</span>
                          <span>طریقہ نمبر 1: سکرین شاٹ/تصویر کاپی کرنا (آسان اور تیز ترین)</span>
                        </p>
                        <p className="text-xs text-sky-900 leading-normal">
                          فائل ڈاؤن لوڈ کرنے اور گیلری یا موبائل کے فولڈرز میں ڈھونڈنے کی کوئی ضرورت نہیں!
                        </p>
                        <ol className="list-decimal list-inside text-xs text-sky-900 space-y-1">
                          <li>نیلے بٹن <strong>"رپورٹ کارڈ تصویر کاپی کریں"</strong> پر کلک کریں۔ تصویر خودکار کاپی ہو جائے گی۔</li>
                          <li>سبز بٹن <strong>"واٹس ایپ اطلاع"</strong> پر کلک کریں۔ چیٹ کھل جائے گی۔</li>
                          <li>چیٹ میں جا کر صرف <strong>پیسٹ (Paste / Ctrl+V)</strong> کریں اور بھیج دیں!</li>
                        </ol>
                      </div>

                      <div className="bg-amber-100/50 border border-amber-200 p-4 rounded-xl space-y-2">
                        <p className="font-bold text-amber-950 text-base flex items-center gap-1">
                          <span>📄</span>
                          <span>طریقہ نمبر 2: پی ڈی ایف فائل اٹیچ کرنا</span>
                        </p>
                        <p className="text-xs text-amber-900 leading-normal">
                          اگر آپ اصل پی ڈی ایف دستاویز اٹیچ کر کے بھیجنا چاہتے ہیں:
                        </p>
                        <ol className="list-decimal list-inside text-xs text-amber-900 space-y-1">
                          <li>سرخ بٹن <strong>"پی ڈی ایف"</strong> پر کلک کر کے فائل ڈاؤن لوڈ کر لیں۔</li>
                          <li>سبز بٹن <strong>"واٹس ایپ اطلاع"</strong> پر کلک کریں۔ چیٹ کھل جائے گی۔</li>
                          <li>چیٹ میں اٹیچمنٹ والے آئیکن (📎) پر کلک کر کے ڈاؤن لوڈز سے پی ڈی ایف فائل بھیج دیں۔</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Scroll notice for mobile screen */}
              <div className="w-full no-print px-4 py-2 flex flex-col items-center justify-center lg:hidden bg-emerald-50/50 border-y border-gray-100 mb-4 rounded-xl">
                <p className="text-xs font-bold text-emerald-800 flex items-center gap-1 font-urdu">
                  <span>← رزلٹ کارڈ مکمل دیکھنے کے لیے دائیں بائیں اسکرول کریں →</span>
                </p>
              </div>

              {/* Report Card content wrapper for PDF generation */}
              <div className="overflow-x-auto w-full py-4 scroller-style">
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
                    <h1 className="text-3xl font-black text-emerald-955">جامعہ تعلیم القرآن ناگمان ضلع پشاور</h1>
                    <p className="text-xl font-bold font-nastaleeq text-black leading-tight">سالانہ تعلیمی رپورٹ - {selectedYear}ء</p>
                  </div>
                </div>

                {/* Student Info Grid */}
                <div className="relative grid grid-cols-2 gap-x-6 gap-y-2 mb-2">
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
                      <span className="font-black text-lg text-emerald-900 leading-none inline-block whitespace-nowrap">
                        {studentAllResults[ExamType.ANNUAL]?.class || studentAllResults[ExamType.HALF_YEARLY]?.class || studentAllResults[ExamType.QUARTERLY]?.class || student.currentClass} ({student.section})
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 items-end">
                    <span className="text-emerald-900 whitespace-nowrap font-black text-base font-mono mb-1">Reg No:</span>
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
                <div className="relative mt-2 px-6">
                  {/* Grid for individual exams */}
                  <div className="grid grid-cols-3 gap-2 border-b border-emerald-900/10 pb-2 mb-2 text-center text-sm">
                    {/* Quarterly */}
                    <div className="flex flex-col items-center bg-emerald-50/40 py-1 px-2 rounded-lg border border-emerald-900/5">
                      <span className="font-bold text-emerald-800 text-xs">سہ ماہی رزلٹ</span>
                      {studentAllResults[ExamType.QUARTERLY] && Number(studentAllResults[ExamType.QUARTERLY].totalMarks) > 0 ? (
                        <span className="font-black text-emerald-950 mt-0.5 text-xs">
                          {studentAllResults[ExamType.QUARTERLY].percentage.toFixed(1)}% ({calculateGrade(studentAllResults[ExamType.QUARTERLY].percentage, 100)})
                        </span>
                      ) : (
                        <span className="text-gray-400 mt-0.5 text-xs">-</span>
                      )}
                    </div>

                    {/* Half Yearly */}
                    <div className="flex flex-col items-center bg-emerald-50/40 py-1 px-2 rounded-lg border border-emerald-900/5">
                      <span className="font-bold text-emerald-800 text-xs">شش ماہی رزلٹ</span>
                      {studentAllResults[ExamType.HALF_YEARLY] && Number(studentAllResults[ExamType.HALF_YEARLY].totalMarks) > 0 ? (
                        <span className="font-black text-emerald-950 mt-0.5 text-xs">
                          {studentAllResults[ExamType.HALF_YEARLY].percentage.toFixed(1)}% ({calculateGrade(studentAllResults[ExamType.HALF_YEARLY].percentage, 100)})
                        </span>
                      ) : (
                        <span className="text-gray-400 mt-0.5 text-xs">-</span>
                      )}
                    </div>

                    {/* Annual */}
                    <div className="flex flex-col items-center bg-emerald-50/40 py-1 px-2 rounded-lg border border-emerald-900/5">
                      <span className="font-bold text-emerald-800 text-xs">سالانہ رزلٹ</span>
                      {studentAllResults[ExamType.ANNUAL] && Number(studentAllResults[ExamType.ANNUAL].totalMarks) > 0 ? (
                        <span className="font-black text-emerald-950 mt-0.5 text-xs">
                          {studentAllResults[ExamType.ANNUAL].percentage.toFixed(1)}% ({calculateGrade(studentAllResults[ExamType.ANNUAL].percentage, 100)})
                        </span>
                      ) : (
                        <span className="text-gray-400 mt-0.5 text-xs">-</span>
                      )}
                    </div>
                  </div>

                  {/* Corrected Overall Row */}
                  {(() => {
                    const enteredExams = [ExamType.QUARTERLY, ExamType.HALF_YEARLY, ExamType.ANNUAL].filter(
                      type => studentAllResults[type] && Number(studentAllResults[type].totalMarks) > 0
                    );
                    
                    let overallPercentage = 0;
                    if (enteredExams.length > 0) {
                      const totalPercentSum = enteredExams.reduce((sum, type) => sum + (studentAllResults[type].percentage || 0), 0);
                      overallPercentage = totalPercentSum / enteredExams.length;
                    }
                    
                    const overallGrade = enteredExams.length > 0 ? calculateGrade(overallPercentage, 100) : 'راسب';
                    
                    return (
                      <div className="flex justify-between items-center px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-emerald-900">مجموعی فیصد:</span>
                          <span className="text-base font-black text-emerald-950 italic">
                            {enteredExams.length > 0 ? `${overallPercentage.toFixed(1)}%` : '-'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-emerald-900">مجموعی کیفیت:</span>
                          <span className="text-lg font-black text-emerald-950">
                            {enteredExams.length > 0 ? overallGrade : '-'}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
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
              </div>
            </motion.div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-5 gap-6 items-end">
            <div className="space-y-2 text-right">
              <label className="text-sm font-bold text-gray-700">سیکشن</label>
              <select 
                value={reportSection} 
                onChange={(e) => setReportSection(e.target.value as Section)}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold"
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
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold"
              >
                <option value="">انتخاب کریں</option>
                {reportSection && CLASS_DATA[reportSection as Section].map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-2 text-right">
              <label className="text-sm font-bold text-gray-700">تعلیمی سال</label>
              <select 
                value={selectedYear} 
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setResultsList([]);
                }}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold"
              >
                {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="space-y-2 text-right">
              <label className="text-sm font-bold text-gray-700">امتحان</label>
              <select 
                value={examType} 
                onChange={(e) => setExamType(e.target.value as ExamType)}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold"
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
                  <h2 className="text-2xl font-bold">نتیجہ {examType} ({selectedYear}ء) جامعہ تعلیم القرآن پشاور</h2>
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
              
              {/* Scroll notice for mobile screen */}
              <div className="w-full no-print px-4 py-2 flex flex-col items-center justify-center lg:hidden bg-emerald-50/50 border-y border-gray-100 mb-4 rounded-xl">
                <p className="text-xs font-bold text-emerald-800 flex items-center gap-1 font-urdu">
                  <span>← رزلٹ شیٹ مکمل دیکھنے کے لیے دائیں بائیں اسکرول کریں →</span>
                </p>
              </div>

              <div className="overflow-x-auto w-full py-4 scroller-style">
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
                        {examType === ExamType.QUARTERLY ? 'سہ ماہی' : examType === ExamType.HALF_YEARLY ? 'شش ماہی' : 'سالانہ'} ({selectedYear}ء)
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
                        <th className="border border-emerald-800 py-3 px-2 w-36 text-center font-black text-sm">رجسٹریشن نمبر</th>
                        <th className="border border-emerald-800 py-3 px-2 w-40 text-right font-black text-sm">نام طالب علم</th>
                        <th className="border border-emerald-800 py-3 px-2 w-44 font-black text-sm">ولدیت</th>
                        {reportSection !== Section.BANIN_HIFZ && CLASS_DATA[reportSection as Section]?.find(c => c.name === reportClass)?.subjects.map(s => (
                          <th key={s} className="border border-emerald-800 py-3 px-2 text-xs w-20 text-center font-black">{s}</th>
                        ))}
                        {reportSection === Section.BANIN_HIFZ && ['سوال 1', 'سوال 2', 'سوال 3', 'لہجہ', 'صفائی', 'ادعیہ'].map(s => (
                          <th key={s} className="border border-emerald-800 py-3 px-2 text-center font-black text-xs">{s}</th>
                        ))}
                        <th className="border border-emerald-800 py-3 px-2 w-20 text-center font-black text-sm">مجموعہ</th>
                        <th className="border border-emerald-800 py-3 px-2 w-16 text-center font-black text-sm">پوزیشن</th>
                        <th className="border border-emerald-800 py-3 px-2 w-24 text-center font-black text-sm">کیفیت</th>
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
                            <td className="border border-emerald-900/40 py-1.5 px-2 font-mono whitespace-nowrap text-center text-xs">{res.regNo}</td>
                            <td className="border border-emerald-900/40 py-1.5 px-2 font-nastaleeq font-black text-right text-base leading-tight">{res.studentName}</td>
                            <td className="border border-emerald-900/40 py-1.5 px-2 text-emerald-950 font-nastaleeq text-sm font-bold leading-tight">{res.fatherName}</td>
                            {reportSection !== Section.BANIN_HIFZ && CLASS_DATA[reportSection as Section]?.find(c => c.name === reportClass)?.subjects.map(s => (
                              <td key={s} className="border border-emerald-900/40 py-1.5 px-2 text-center font-black text-xs">{res.subjects?.[s] || '-'}</td>
                            ))}
                            {reportSection === Section.BANIN_HIFZ && (
                              <>
                                <td className="border border-emerald-900/40 py-1.5 px-2 text-center text-xs font-bold">{res.hifzBreakdown?.q1}</td>
                                <td className="border border-emerald-900/40 py-1.5 px-2 text-center text-xs font-bold">{res.hifzBreakdown?.q2}</td>
                                <td className="border border-emerald-900/40 py-1.5 px-2 text-center text-xs font-bold">{res.hifzBreakdown?.q3}</td>
                                <td className="border border-emerald-900/40 py-1.5 px-2 text-center text-xs font-bold">{res.hifzBreakdown?.lahja}</td>
                                <td className="border border-emerald-900/40 py-1.5 px-2 text-center text-xs font-bold">{res.hifzBreakdown?.safai}</td>
                                <td className="border border-emerald-900/40 py-1.5 px-2 text-center text-xs font-bold">{res.hifzBreakdown?.adiya}</td>
                              </>
                            )}
                            <td className="border border-emerald-900/40 py-1.5 px-2 text-center font-black text-emerald-800 bg-emerald-50/20 text-sm">{res.totalMarks}</td>
                            <td className="border border-emerald-900/40 py-1.5 px-2 text-center font-black text-sm">{rank}</td>
                            <td className="border border-emerald-900/40 py-1.5 px-2 text-center font-black text-xs font-nastaleeq leading-tight">
                              {calculateGrade(res.totalMarks, reportSection === Section.BANIN_HIFZ ? 100 : (CLASS_DATA[reportSection as Section]?.find(c => c.name === reportClass)?.subjects.length || 0) * 100)}
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
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
