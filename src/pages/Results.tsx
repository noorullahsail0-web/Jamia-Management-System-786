import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { Section, Student, ExamResult, ExamType } from '../types';
import { CLASS_DATA } from '../constants';
import { GraduationCap, Search, Save, FileText, ChevronRight, Loader2, Info } from 'lucide-react';
import { cn } from '../lib/utils';

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

  const [printingCollective, setPrintingCollective] = useState(false);
  const [printingIndividual, setPrintingIndividual] = useState<any>(null);

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

  const printCollective = () => {
    window.print();
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

  const printIndividual = async (res: any) => {
    const fullResults = await fetchFullStudentResults(res.studentId);
    setPrintingIndividual({ ...res, allExams: fullResults });
    setTimeout(() => {
      window.print();
      setPrintingIndividual(null);
    }, 500);
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
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">امتحانات اور نتائج</h1>
          <p className="text-gray-500">طلباء کے پرچوں کے نمبر درج کریں اور رزلٹ شیٹ تیار کریں</p>
        </div>
        <div className="flex bg-white p-1 rounded-xl border border-gray-100 shadow-sm self-start">
          <button 
            onClick={() => setActiveTab('class-entry')}
            className={cn("px-6 py-2 rounded-lg font-bold transition-all", activeTab === 'class-entry' ? "bg-emerald-600 text-white shadow-md" : "text-gray-500")}
          >
            درجہ وار اندراج
          </button>
          <button 
            onClick={() => setActiveTab('report-card')}
            className={cn("px-6 py-2 rounded-lg font-bold transition-all", activeTab === 'report-card' ? "bg-emerald-600 text-white shadow-md" : "text-gray-500")}
          >
            رپورٹ کارڈ
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            className={cn("px-6 py-2 rounded-lg font-bold transition-all", activeTab === 'reports' ? "bg-emerald-600 text-white shadow-md" : "text-gray-500")}
          >
            اجتماعی رزلٹ شیٹ
          </button>
        </div>
      </div>

      {activeTab === 'class-entry' ? (
        <div className="space-y-8">
          {/* Selection Card */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div className="space-y-2 text-right">
              <label className="text-sm font-bold text-gray-700">سیکشن کا انتخاب</label>
              <select 
                value={selectedSection} 
                onChange={(e) => {
                  setSelectedSection(e.target.value as Section);
                  setSelectedClass('');
                  setClassStudents([]);
                }}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">انتخاب کریں</option>
                {Object.values(Section).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-2 text-right">
              <label className="text-sm font-bold text-gray-700">درجہ کا انتخاب</label>
              <select 
                value={selectedClass} 
                onChange={(e) => setSelectedClass(e.target.value)}
                disabled={!selectedSection}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">انتخاب کریں</option>
                {selectedSection && CLASS_DATA[selectedSection as Section].map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
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
              onClick={fetchClassStudents}
              disabled={loading || !selectedClass}
              className="bg-emerald-600 h-[52px] rounded-xl text-white font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
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
                    {classStudents.map((s) => {
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
                            ['q1', 'q2', 'q3', 'lahja', 'safai', 'adiya'].map(k => (
                              <td key={k} className="p-2 border text-center">
                                <input 
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
                                  className="w-14 text-center py-1 border rounded-md focus:ring-2 focus:ring-emerald-500 font-bold"
                                />
                              </td>
                            ))
                          ) : (
                            subjects.map(sub => (
                              <td key={sub} className="p-1 border text-center">
                                <input 
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
                                  className="w-12 text-center py-1 border rounded-md focus:ring-2 focus:ring-emerald-500 font-bold text-sm"
                                />
                              </td>
                            ))
                          )}

                          <td className="p-4 border text-center font-black text-emerald-700 bg-emerald-50/30">{total}</td>
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
              <div className="flex justify-between items-center bg-gray-50 p-6 rounded-2xl">
                <div>
                  <h3 className="text-xl font-bold">تعلیمی سالانہ رپورٹ کارڈ</h3>
                  <p className="text-gray-500 text-sm">جامعہ تعلیم القرآن ناگمان ضلع پشاور</p>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => setStudent(null)}
                    className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all"
                  >
                    فہرست پر واپس جائیں
                  </button>
                  <button
                    onClick={() => {
                    setPrintingIndividual({ 
                      studentName: student.name,
                      fatherName: student.fatherName,
                      regNo: student.regNo,
                      class: student.currentClass,
                      year: new Date().getFullYear().toString(),
                      allExams: studentAllResults,
                      grade: calculateGrade((((studentAllResults[ExamType.QUARTERLY]?.percentage || 0) + (studentAllResults[ExamType.HALF_YEARLY]?.percentage || 0) + (studentAllResults[ExamType.ANNUAL]?.percentage || 0)) / 300) * 100),
                      percentage: ((studentAllResults[ExamType.QUARTERLY]?.percentage || 0) + (studentAllResults[ExamType.HALF_YEARLY]?.percentage || 0) + (studentAllResults[ExamType.ANNUAL]?.percentage || 0)) / 3
                    });
                    setTimeout(() => {
                      window.print();
                      setPrintingIndividual(null);
                    }, 500);
                  }}
                  className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 shadow-lg shadow-emerald-100"
                >
                  <FileText className="w-5 h-5" />
                  رپورٹ کارڈ پرنٹ کریں
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-right border-b border-gray-100 pb-8">
                <div className="space-y-1">
                  <span className="text-gray-500 text-sm font-bold">طالب علم کا نام</span>
                  <p className="font-bold text-lg text-emerald-900">{student.name}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-gray-500 text-sm font-bold">ولدیت</span>
                  <p className="font-bold text-lg text-emerald-900">{student.fatherName}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-gray-500 text-sm font-bold">رجسٹریشن نمبر</span>
                  <p className="font-bold text-lg font-mono text-emerald-900">{student.regNo}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-gray-500 text-sm font-bold">سیکشن</span>
                  <p className="font-bold text-lg text-emerald-900">{student.section}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-gray-500 text-sm font-bold">درجہ</span>
                  <p className="font-bold text-lg text-emerald-900">{student.currentClass}</p>
                </div>
              </div>

              {/* On-Screen Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-2 border-gray-100 rounded-2xl overflow-hidden text-center">
                  <thead>
                    <tr className="bg-emerald-600 text-white">
                      <th className="p-4 border-r border-emerald-500 font-bold w-48">مضامین</th>
                      <th className="p-4 border-r border-emerald-500 font-bold">سہ ماہی</th>
                      <th className="p-4 border-r border-emerald-500 font-bold">شش ماہی</th>
                      <th className="p-4 border-r border-emerald-500 font-bold">سالانہ</th>
                      <th className="p-4 font-bold">مجموعہ</th>
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
                          <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                            <td className="p-4 font-bold border-r border-gray-100 bg-gray-50/30">{sub}</td>
                            <td className="p-4 border-r border-gray-100">{q}</td>
                            <td className="p-4 border-r border-gray-100">{h}</td>
                            <td className="p-4 border-r border-gray-100">{a}</td>
                            <td className="p-4 font-black text-emerald-700">{total || '-'}</td>
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
                          <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                            <td className="p-4 font-bold border-r border-gray-100 bg-gray-50/30">{sub}</td>
                            <td className="p-4 border-r border-gray-100">{q}</td>
                            <td className="p-4 border-r border-gray-100">{h}</td>
                            <td className="p-4 border-r border-gray-100">{a}</td>
                            <td className="p-4 font-black text-emerald-700">{total || '-'}</td>
                          </tr>
                        );
                      })
                    )}
                    <tr className="bg-emerald-50/50 font-black text-lg border-t-2 border-emerald-200">
                      <td className="p-6 border-r border-emerald-100">کل حاصل کردہ</td>
                      <td className="p-6 border-r border-emerald-100">{studentAllResults[ExamType.QUARTERLY]?.totalMarks || '0'}</td>
                      <td className="p-6 border-r border-emerald-100">{studentAllResults[ExamType.HALF_YEARLY]?.totalMarks || '0'}</td>
                      <td className="p-6 border-r border-emerald-100">{studentAllResults[ExamType.ANNUAL]?.totalMarks || '0'}</td>
                      <td className="p-6 text-emerald-800">
                        {(Number(studentAllResults[ExamType.QUARTERLY]?.totalMarks) || 0) + 
                         (Number(studentAllResults[ExamType.HALF_YEARLY]?.totalMarks) || 0) + 
                         (Number(studentAllResults[ExamType.ANNUAL]?.totalMarks) || 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center bg-gray-50 p-6 rounded-2xl">
                 <div className="flex gap-12">
                   <div className="flex flex-col">
                     <span className="text-gray-500 text-sm">مجموعی فیصد</span>
                     <span className="text-2xl font-black text-emerald-900">
                       {(((studentAllResults[ExamType.QUARTERLY]?.percentage || 0) + 
                         (studentAllResults[ExamType.HALF_YEARLY]?.percentage || 0) + 
                         (studentAllResults[ExamType.ANNUAL]?.percentage || 0)) / 3).toFixed(1)}%
                     </span>
                   </div>
                   <div className="flex flex-col">
                     <span className="text-gray-500 text-sm">مجموعی کیفیت</span>
                     <span className="text-2xl font-black text-emerald-900">
                       {calculateGrade((((studentAllResults[ExamType.QUARTERLY]?.percentage || 0) + 
                         (studentAllResults[ExamType.HALF_YEARLY]?.percentage || 0) + 
                         (studentAllResults[ExamType.ANNUAL]?.percentage || 0)) / 300) * 100)}
                     </span>
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
              <div className="p-8 border-b bg-gray-50 flex justify-between items-center print:bg-white">
                <div className="flex-1 text-center">
                  <h2 className="text-2xl font-bold">نتیجہ {examType} جامعہ تعلیم القرآن پشاور</h2>
                  <p className="text-emerald-700 font-bold mt-1">(سیکشن {reportSection} درجہ {reportClass})</p>
                </div>
                <button 
                  onClick={printCollective}
                  className="bg-gray-800 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-900 transition-all print:hidden"
                >
                  <FileText className="w-5 h-5" />
                  اجتماعی پرنٹ
                </button>
              </div>
              <div className="overflow-x-auto p-4">
                <table className="w-full text-right border-collapse text-sm min-w-[1000px]">
                  <thead>
                    <tr className="bg-gray-100 text-gray-800">
                      <th className="border p-3 w-40 text-center">رجسٹریشن نمبر</th>
                      <th className="border p-3 w-40 text-right">طالب علم کا نام</th>
                      <th className="border p-3 w-48">ولدیت</th>
                      {reportSection !== Section.BANIN_HIFZ && CLASS_DATA[reportSection as Section]?.find(c => c.name === reportClass)?.subjects.map(s => (
                        <th key={s} className="border p-3 text-xs w-20 text-center">{s}</th>
                      ))}
                      {reportSection === Section.BANIN_HIFZ && ['Q1', 'Q2', 'Q3', 'Lh', 'Sf', 'Ad'].map(s => (
                        <th key={s} className="border p-3 text-center">{s}</th>
                      ))}
                      <th className="border p-3 w-20 text-center">مجموعہ</th>
                      <th className="border p-3 w-20 text-center">پوزیشن</th>
                      <th className="border p-3 w-24 text-center">کیفیت</th>
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
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="border p-3 font-mono whitespace-nowrap text-center">{res.regNo}</td>
                          <td className="border p-3 font-bold text-right">{res.studentName}</td>
                          <td className="border p-3 text-gray-600">{res.fatherName}</td>
                          {reportSection !== Section.BANIN_HIFZ && CLASS_DATA[reportSection as Section]?.find(c => c.name === reportClass)?.subjects.map(s => (
                            <td key={s} className="border p-3 text-center font-bold">{res.subjects?.[s] || '-'}</td>
                          ))}
                          {reportSection === Section.BANIN_HIFZ && (
                            <>
                              <td className="border p-3 text-center">{res.hifzBreakdown?.q1}</td>
                              <td className="border p-3 text-center">{res.hifzBreakdown?.q2}</td>
                              <td className="border p-3 text-center">{res.hifzBreakdown?.q3}</td>
                              <td className="border p-3 text-center">{res.hifzBreakdown?.lahja}</td>
                              <td className="border p-3 text-center">{res.hifzBreakdown?.safai}</td>
                              <td className="border p-3 text-center">{res.hifzBreakdown?.adiya}</td>
                            </>
                          )}
                          <td className="border p-3 text-center font-black text-emerald-700 bg-emerald-50/20">{res.totalMarks}</td>
                          <td className="border p-3 text-center font-bold">{rank}</td>
                          <td className="border p-3 text-center font-bold">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[10px]",
                              res.grade === 'راسب' ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                            )}>
                              {res.grade}
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
      )}

      {/* Printing Overlays */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; height: auto; }
          @page { size: A4 landscape; margin: 1cm; }
          .individual-page-mode { size: A4 portrait; }
        }
      `}</style>
      
      {/* Individual Print View */}
      {printingIndividual && (
        <div className="print-area font-urdu text-right individual-page-mode" dir="rtl">
          <div className="p-10 border-8 border-double border-emerald-900 rounded-[3rem] m-6 bg-white min-h-[1050px] relative">
            <div className="text-center mb-12 flex flex-col items-center">
              <div className="text-emerald-900 mb-2">
                <GraduationCap className="w-16 h-16" />
              </div>
              <h1 className="text-5xl font-black text-emerald-900 mb-2">جامعہ تعلیم القرآن ناگمان ضلع پشاور</h1>
              <div className="h-1 w-64 bg-emerald-900 mb-4 mx-auto"></div>
              <p className="text-2xl font-bold tracking-widest bg-emerald-900 text-white px-8 py-2 rounded-full">تعلیمی سالانہ رپورٹ کارڈ</p>
            </div>

            <div className="grid grid-cols-2 gap-x-12 gap-y-8 mb-12 text-2xl font-bold px-8">
              <div className="flex gap-4 items-end">
                <span className="text-emerald-900 font-black whitespace-nowrap">سیکشن:</span>
                <span className="border-b-2 border-emerald-200 flex-1 text-center pb-1">{student?.section || '-'}</span>
              </div>
              <div className="flex gap-4 items-end">
                <span className="text-emerald-900 font-black whitespace-nowrap">درجہ:</span>
                <span className="border-b-2 border-emerald-200 flex-1 text-center pb-1">{printingIndividual.class}</span>
              </div>
              <div className="flex gap-4 items-end">
                <span className="text-emerald-900 font-black whitespace-nowrap">طالب علم:</span>
                <span className="border-b-2 border-emerald-200 flex-1 text-center pb-1">{printingIndividual.studentName}</span>
              </div>
              <div className="flex gap-4 items-end">
                <span className="text-emerald-900 font-black whitespace-nowrap">ولدیت:</span>
                <span className="border-b-2 border-emerald-200 flex-1 text-center pb-1">{printingIndividual.fatherName}</span>
              </div>
              <div className="flex gap-4 items-end">
                <span className="text-emerald-900 font-black whitespace-nowrap">رجسٹریشن نمبر:</span>
                <span className="border-b-2 border-emerald-200 flex-1 text-center pb-1 font-mono">{printingIndividual.regNo}</span>
              </div>
              <div className="flex gap-4 items-end">
                <span className="text-emerald-900 font-black whitespace-nowrap">تعلیمی سال:</span>
                <span className="border-b-2 border-emerald-200 flex-1 text-center pb-1">{printingIndividual.year}</span>
              </div>
            </div>

            <table className="w-full border-[3px] border-emerald-900 text-center mb-12 text-xl overflow-hidden rounded-t-2xl">
              <thead>
                <tr className="bg-emerald-900 text-white">
                  <th className="border-r-2 border-emerald-800 p-5 font-black w-56">مضامین</th>
                  <th className="border-r-2 border-emerald-800 p-5 font-black">سہ ماہی</th>
                  <th className="border-r-2 border-emerald-800 p-5 font-black">شش ماہی</th>
                  <th className="border-r-2 border-emerald-800 p-5 font-black">سالانہ</th>
                  <th className="p-5 font-black">مجموعہ نمبرات</th>
                </tr>
              </thead>
              <tbody>
                {student?.section !== Section.BANIN_HIFZ ? (
                  CLASS_DATA[student?.section as Section]?.find(c => c.name === printingIndividual.class)?.subjects.map((sub, idx) => {
                    const qResult = printingIndividual.allExams?.[ExamType.QUARTERLY];
                    const hResult = printingIndividual.allExams?.[ExamType.HALF_YEARLY];
                    const aResult = printingIndividual.allExams?.[ExamType.ANNUAL];
                    
                    const q = Number(qResult?.subjects?.[sub] || 0);
                    const h = Number(hResult?.subjects?.[sub] || 0);
                    const a = Number(aResult?.subjects?.[sub] || 0);
                    const total = q + h + a;
                    return (
                      <tr key={idx} className="border-b-2 border-emerald-100 hover:bg-emerald-50/30 transition-colors">
                        <td className="border-r-2 border-emerald-100 p-5 font-black bg-emerald-50/50 text-right pr-6">{sub}</td>
                        <td className="border-r-2 border-emerald-100 p-5 font-bold">{qResult ? q : '-'}</td>
                        <td className="border-r-2 border-emerald-100 p-5 font-bold">{hResult ? h : '-'}</td>
                        <td className="border-r-2 border-emerald-100 p-5 font-bold">{aResult ? a : '-'}</td>
                        <td className="p-5 font-black text-emerald-900">{total || '-'}</td>
                      </tr>
                    );
                  })
                ) : (
                  ['سوال 1', 'سوال 2', 'سوال 3', 'لہجہ', 'صفائی', 'ادعیہ'].map((sub, idx) => {
                    const keys = ['q1', 'q2', 'q3', 'lahja', 'safai', 'adiya'];
                    const key = keys[idx];
                    const qResult = printingIndividual.allExams?.[ExamType.QUARTERLY];
                    const hResult = printingIndividual.allExams?.[ExamType.HALF_YEARLY];
                    const aResult = printingIndividual.allExams?.[ExamType.ANNUAL];

                    const q = Number(qResult?.hifzBreakdown?.[key] || 0);
                    const h = Number(hResult?.hifzBreakdown?.[key] || 0);
                    const a = Number(aResult?.hifzBreakdown?.[key] || 0);
                    const total = q + h + a;
                    return (
                      <tr key={idx} className="border-b-2 border-emerald-100 hover:bg-emerald-50/30">
                        <td className="border-r-2 border-emerald-100 p-5 font-black bg-emerald-50/50 text-right pr-6">{sub}</td>
                        <td className="border-r-2 border-emerald-100 p-5 font-bold">{qResult ? q : '-'}</td>
                        <td className="border-r-2 border-emerald-100 p-5 font-bold">{hResult ? h : '-'}</td>
                        <td className="border-r-2 border-emerald-100 p-5 font-bold">{aResult ? a : '-'}</td>
                        <td className="p-5 font-black text-emerald-900">{total || '-'}</td>
                      </tr>
                    );
                  })
                )}
                {/* Fixed Rows for Totals */}
                <tr className="bg-emerald-50 font-black text-2xl border-t-4 border-emerald-900">
                  <td className="border-r-2 border-emerald-900 p-8 text-right pr-6">کل حاصل کردہ نمبرات</td>
                  <td className="border-r-2 border-emerald-900 p-8">{printingIndividual.allExams?.[ExamType.QUARTERLY]?.totalMarks || '0'}</td>
                  <td className="border-r-2 border-emerald-900 p-8">{printingIndividual.allExams?.[ExamType.HALF_YEARLY]?.totalMarks || '0'}</td>
                  <td className="border-r-2 border-emerald-900 p-8">{printingIndividual.allExams?.[ExamType.ANNUAL]?.totalMarks || '0'}</td>
                  <td className="p-8 text-emerald-900">
                    {(Number(printingIndividual.allExams?.[ExamType.QUARTERLY]?.totalMarks) || 0) + 
                     (Number(printingIndividual.allExams?.[ExamType.HALF_YEARLY]?.totalMarks) || 0) + 
                     (Number(printingIndividual.allExams?.[ExamType.ANNUAL]?.totalMarks) || 0)}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="grid grid-cols-2 gap-12 mt-16 px-12">
              <div className="space-y-4">
                <div className="p-6 border-4 border-emerald-100 rounded-3xl bg-emerald-50/30">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xl font-bold text-gray-600">کل فیصد:</span>
                    <span className="text-4xl font-black text-emerald-900">{printingIndividual.percentage.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-bold text-gray-600">کیفیت:</span>
                    <span className="text-3xl font-black text-emerald-900">{printingIndividual.grade}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-end gap-12">
                <div className="flex justify-between items-center w-full">
                  <div className="text-center">
                    <div className="w-56 border-b-4 border-emerald-900 mb-3 mx-auto"></div>
                    <p className="text-xl font-black text-emerald-900">دستخط نگران درجہ</p>
                  </div>
                  <div className="text-center">
                    <div className="w-56 border-b-4 border-emerald-900 mb-3 mx-auto"></div>
                    <p className="text-xl font-black text-emerald-900">مہر و دستخط مہتمم</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative border elements */}
            <div className="absolute top-8 left-8 w-16 h-16 border-t-8 border-l-8 border-emerald-900 rounded-tl-2xl"></div>
            <div className="absolute top-8 right-8 w-16 h-16 border-t-8 border-r-8 border-emerald-900 rounded-tr-2xl"></div>
            <div className="absolute bottom-8 left-8 w-16 h-16 border-b-8 border-l-8 border-emerald-900 rounded-bl-2xl"></div>
            <div className="absolute bottom-8 right-8 w-16 h-16 border-b-8 border-r-8 border-emerald-900 rounded-br-2xl"></div>
          </div>
        </div>
      )}
    </div>
  );
}
