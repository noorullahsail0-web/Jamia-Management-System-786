import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { Section, Student, AttendanceRecord } from '../types';
import { CLASS_DATA } from '../constants';
import { ClipboardCheck, UserCheck, UserX, UserMinus, Send, Loader2, Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

export default function Attendance() {
  const [section, setSection] = useState<Section | ''>('');
  const [currentClass, setCurrentClass] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, 'present' | 'absent' | 'leave'>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (section && currentClass) {
      fetchStudents();
    } else {
      setStudents([]);
    }
  }, [section, currentClass]);

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
          <h1 className="text-2xl font-bold text-gray-900">روزانہ حاضری سسٹم</h1>
          <p className="text-gray-500">طلباء کی حاضری لگائیں اور والدین کو اطلاع بھیجیں</p>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
          <CalendarIcon className="w-5 h-5 text-emerald-600" />
          <input 
            type="date" 
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border-none focus:ring-0 font-bold bg-transparent"
          />
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2 text-right">
          <label className="text-sm font-bold text-gray-700">سیکشن منتخب کریں</label>
          <select 
            value={section} 
            onChange={(e) => { setSection(e.target.value as Section); setCurrentClass(''); }}
            className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">سیکشن</option>
            {Object.values(Section).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-2 text-right">
          <label className="text-sm font-bold text-gray-700">درجہ منتخب کریں</label>
          <select 
            value={currentClass} 
            onChange={(e) => setCurrentClass(e.target.value)}
            disabled={!section}
            className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          >
            <option value="">درجہ</option>
            {section && CLASS_DATA[section as Section].map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
        </div>
      ) : students.length > 0 ? (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-sm">
                  <th className="px-6 py-4 font-bold">طالب علم</th>
                  <th className="px-6 py-4 font-bold text-center">حاضری کی صورتحال</th>
                  <th className="px-6 py-4 font-bold">اطلاع (WhatsApp)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold">{student.name}</p>
                      <p className="text-xs text-gray-500">{student.fatherName} ({student.regNo})</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center items-center gap-2">
                        {[
                          { val: 'present', label: 'حاضر', icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                          { val: 'absent', label: 'غیر حاضر', icon: UserX, color: 'text-red-600', bg: 'bg-red-50' },
                          { val: 'leave', label: 'چھٹی', icon: UserMinus, color: 'text-blue-600', bg: 'bg-blue-50' }
                        ].map((btn) => (
                          <button
                            key={btn.val}
                            onClick={() => handleStatusChange(student.id, btn.val as any)}
                            className={cn(
                              "flex flex-col items-center gap-1 p-3 rounded-xl transition-all w-24",
                              attendanceMap[student.id] === btn.val 
                                ? `${btn.bg} ${btn.color} ring-1 ring-inset ring-${btn.val === 'present' ? 'emerald' : btn.val === 'absent' ? 'red' : 'blue'}-600/20` 
                                : "text-gray-400 hover:bg-gray-100"
                            )}
                          >
                            <btn.icon className="w-5 h-5" />
                            <span className="text-[10px] font-bold uppercase">{btn.label}</span>
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {attendanceMap[student.id] !== 'present' && (
                        <a 
                          href={getWhatsAppLink(student, attendanceMap[student.id] as 'absent' | 'leave')}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 text-emerald-600 hover:bg-emerald-50 px-3 py-2 rounded-lg transition-colors font-bold text-sm"
                        >
                          <Send className="w-4 h-4" />
                          <span>اطلاع بھیجیں</span>
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-gray-500 font-bold">
              کل طلباء: {students.length} | 
              حاضر: {Object.values(attendanceMap).filter(v => v === 'present').length} | 
              غیر حاضر: {Object.values(attendanceMap).filter(v => v === 'absent').length}
            </p>
            <button
              onClick={saveAttendance}
              disabled={saving}
              className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold py-4 px-10 rounded-2xl shadow-xl shadow-emerald-100 border-none transition-all active:scale-95"
            >
              {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <ClipboardCheck className="w-6 h-6" />}
              <span>{savedSuccess ? 'محفوظ ہوگئی!' : 'حاضری محفوظ کریں'}</span>
              {savedSuccess && <CheckCircle2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
      ) : (
        section && currentClass && (
          <div className="bg-white p-20 rounded-2xl border-2 border-dashed text-center text-gray-400 italic">
            اس درجہ میں کوئی طالب علم نہیں ہے
          </div>
        )
      )}
    </div>
  );
}
