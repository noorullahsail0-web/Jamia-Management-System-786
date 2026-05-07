import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { Section, Student, ExamResult, ExamType } from '../types';
import { CLASS_DATA } from '../constants';
import { GraduationCap, Search, Save, FileText, ChevronRight, Loader2, Info } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Results() {
  const [activeTab, setActiveTab] = useState<'entry' | 'reports'>('entry');
  const [regNoSearch, setRegNoSearch] = useState('');
  const [student, setStudent] = useState<Student | null>(null);
  const [examType, setExamType] = useState<ExamType>(ExamType.QUARTERLY);
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [hifzMarks, setHifzMarks] = useState({
    q1: 0, q2: 0, q3: 0, lahja: 0, safai: 0, adiya: 0
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const searchStudent = async () => {
    if (!regNoSearch) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'students'), where('regNo', '==', regNoSearch));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setStudent({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Student);
        setMarks({}); // Reset
      } else {
        alert('طالب علم نہیں ملا');
        setStudent(null);
      }
    } catch (e) {
      console.error(e);
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

  const saveResult = async () => {
    if (!student) return;
    setSaving(true);
    try {
      const classData = CLASS_DATA[student.section].find(c => c.name === student.currentClass);
      const isHifz = student.section === Section.BANIN_HIFZ;
      
      let total = 0;
      if (isHifz) {
        total = Number(hifzMarks.q1) + Number(hifzMarks.q2) + Number(hifzMarks.q3) + Number(hifzMarks.lahja) + Number(hifzMarks.safai) + Number(hifzMarks.adiya);
      } else {
        total = (Object.values(marks) as number[]).reduce((a, b) => a + b, 0);
      }

      const maxTotal = isHifz ? 100 : (classData?.subjects.length || 0) * 100;
      const percentage = (total / maxTotal) * 100;
      const grade = calculateGrade(percentage);

      const resultData: Partial<ExamResult> = {
        studentId: student.id,
        regNo: student.regNo,
        examType,
        year: new Date().getFullYear().toString(),
        class: student.currentClass,
        subjects: marks,
        hifzBreakdown: isHifz ? hifzMarks : undefined,
        totalMarks: total,
        percentage,
        grade,
        updatedAt: new Date().toISOString()
      };

      // Check if already exists
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
      
      alert('نتیجہ محفوظ کر لیا گیا ہے');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'results');
    } finally {
      setSaving(false);
    }
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
      
      // Get student names for these results
      const studentIds = results.map(r => r.studentId);
      const studentsMap: Record<string, any> = {};
      
      if (studentIds.length > 0) {
        // Simple fetch for students in this class
        const sq = query(collection(db, 'students'), where('currentClass', '==', reportClass));
        const sSnap = await getDocs(sq);
        sSnap.forEach(d => studentsMap[d.id] = d.data());
      }

      setResultsList(results.map(r => ({
        ...r,
        studentName: studentsMap[r.studentId]?.name || 'N/A',
        fatherName: studentsMap[r.studentId]?.fatherName || 'N/A'
      })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">امتحانات اور نتائج</h1>
          <p className="text-gray-500">طلباء کے پرچوں کے نمبر درج کریں اور رزلٹ شیٹ تیار کریں</p>
        </div>
        <div className="flex bg-white p-1 rounded-xl border border-gray-100 shadow-sm self-start">
          <button 
            onClick={() => setActiveTab('entry')}
            className={cn("px-6 py-2 rounded-lg font-bold transition-all", activeTab === 'entry' ? "bg-emerald-600 text-white shadow-md" : "text-gray-500")}
          >
            نمبر درج کریں
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            className={cn("px-6 py-2 rounded-lg font-bold transition-all", activeTab === 'reports' ? "bg-emerald-600 text-white shadow-md" : "text-gray-500")}
          >
            رزلٹ شیٹس
          </button>
        </div>
      </div>

      {activeTab === 'entry' ? (
        // ... (Existing entry UI remains same)
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Search Card */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Search className="w-5 h-5 text-emerald-600" />
                طالب علم تلاش کریں
              </h3>
              <div className="relative">
                <input 
                  type="text" 
                  value={regNoSearch}
                  onChange={(e) => setRegNoSearch(e.target.value)}
                  placeholder="رجسٹریشن نمبر درج کریں..." 
                  className="w-full pr-4 pl-12 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 uppercase font-mono tracking-widest"
                  onKeyDown={(e) => e.key === 'Enter' && searchStudent()}
                />
                <button 
                  onClick={searchStudent}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-emerald-600 p-2 rounded-lg text-white hover:bg-emerald-700"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronRight className="w-5 h-5" />}
                </button>
              </div>

              {student && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-emerald-50 rounded-2xl space-y-3"
                >
                  <div className="flex justify-between border-b border-emerald-100 pb-2">
                    <span className="text-emerald-700 text-xs font-bold">نام:</span>
                    <span className="font-bold">{student.name}</span>
                  </div>
                  <div className="flex justify-between border-b border-emerald-100 pb-2">
                    <span className="text-emerald-700 text-xs font-bold">ولدیت:</span>
                    <span>{student.fatherName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-700 text-xs font-bold">درجہ:</span>
                    <span className="text-xs font-bold">{student.currentClass}</span>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Entry Form */}
          <div className="lg:col-span-2">
            {!student ? (
              <div className="bg-white p-20 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center text-gray-400 gap-4">
                <Info className="w-12 h-12" />
                <p className="font-bold italic">شروع کرنے کے لیے پہلے طالب علم تلاش کریں</p>
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <div className="p-8 border-b bg-gray-50/50">
                  <div className="flex items-center gap-4">
                    <GraduationCap className="w-8 h-8 text-emerald-600" />
                    <div>
                      <h3 className="text-xl font-bold">نتائج کا اندراج</h3>
                      <p className="text-sm text-gray-500">پرچوں کے حاصل کردہ نمبر درج کریں (کل نمبر: 100 فی پرچہ)</p>
                    </div>
                  </div>
                </div>

                <div className="p-8 space-y-8">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">امتحان کا انتخاب</label>
                    <div className="flex gap-4">
                      {Object.values(ExamType).map(type => (
                        <button
                          key={type}
                          onClick={() => setExamType(type)}
                          className={cn(
                            "flex-1 py-3 rounded-xl font-bold transition-all border-2",
                            examType === type ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-gray-100 text-gray-400 hover:border-emerald-200"
                          )}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    {student.section === Section.BANIN_HIFZ ? (
                      <>
                        {[
                          { key: 'q1', label: 'سوال نمبر 1 (20)' },
                          { key: 'q2', label: 'سوال نمبر 2 (20)' },
                          { key: 'q3', label: 'سوال نمبر 3 (20)' },
                          { key: 'lahja', label: 'لہجہ (10)' },
                          { key: 'safai', label: 'صفائی (10)' },
                          { key: 'adiya', label: 'ادعیہ (20)' }
                        ].map((q) => (
                          <div key={q.key} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
                            <label className="font-bold text-gray-600">{q.label}</label>
                            <input 
                              type="number" 
                              max={q.key.startsWith('q') || q.key === 'adiya' ? 20 : 10}
                              className="w-20 text-center py-2 border-none rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold text-lg"
                              value={hifzMarks[q.key as keyof typeof hifzMarks] || ''}
                              onChange={(e) => setHifzMarks(p => ({ ...p, [q.key]: parseInt(e.target.value) || 0 }))}
                            />
                          </div>
                        ))}
                      </>
                    ) : (
                      CLASS_DATA[student.section].find(c => c.name === student.currentClass)?.subjects.map((sub) => (
                        <div key={sub} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
                          <label className="font-bold text-gray-600 truncate mr-2">{sub}</label>
                          <input 
                            type="number" 
                            max="100"
                            className="w-20 text-center py-2 border-none rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold text-lg"
                            value={marks[sub] || ''}
                            onChange={(e) => setMarks(p => ({ ...p, [sub]: parseInt(e.target.value) || 0 }))}
                          />
                        </div>
                      ))
                    )}
                  </div>

                  <button
                    onClick={saveResult}
                    disabled={saving}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold py-5 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-emerald-100 border-none mt-8"
                  >
                    {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                    <span>نتیجہ محفوظ کریں</span>
                  </button>
                </div>
              </motion.div>
            )}
          </div>
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
              className="bg-emerald-600 h-[52px] rounded-xl text-white font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
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
              <div className="p-8 border-b bg-gray-50 text-center">
                <h2 className="text-2xl font-bold">نتیجہ {examType} جامعہ تعلیم القرآن پشاور</h2>
                <p className="text-emerald-700 font-bold mt-1">(سیکشن {reportSection} درجہ {reportClass})</p>
              </div>
              <div className="overflow-x-auto p-4">
                <table className="w-full text-right border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-3">رجسٹریشن نمبر</th>
                      <th className="border p-3">نام</th>
                      <th className="border p-3">ولدیت</th>
                      {reportSection !== Section.BANIN_HIFZ && CLASS_DATA[reportSection as Section]?.find(c => c.name === reportClass)?.subjects.map(s => (
                        <th key={s} className="border p-3 text-xs w-20">{s}</th>
                      ))}
                      {reportSection === Section.BANIN_HIFZ && ['Q1', 'Q2', 'Q3', 'Lh', 'Sf', 'Ad'].map(s => (
                        <th key={s} className="border p-3">{s}</th>
                      ))}
                      <th className="border p-3">مجموعہ</th>
                      <th className="border p-3">تقدیر</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultsList.map((res, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="border p-3 font-mono">{res.regNo}</td>
                        <td className="border p-3 font-bold">{res.studentName}</td>
                        <td className="border p-3">{res.fatherName}</td>
                        {reportSection !== Section.BANIN_HIFZ && CLASS_DATA[reportSection as Section]?.find(c => c.name === reportClass)?.subjects.map(s => (
                          <td key={s} className="border p-3 text-center">{res.subjects?.[s] || '-'}</td>
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
                        <td className="border p-3 text-center font-bold text-emerald-700">{res.totalMarks}</td>
                        <td className="border p-3 text-center font-bold">{res.grade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
