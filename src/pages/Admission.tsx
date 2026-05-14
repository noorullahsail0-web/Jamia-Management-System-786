import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { db, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, getDocs, query, where, orderBy, limit, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Section, Student } from '../types';
import { CLASS_DATA, SECTION_PREFIXES } from '../constants';
import { Plus, Search, FileText, UserPlus, Camera, Loader2, X, Save, Trash2, AlertCircle } from 'lucide-react';
import { cn, compressImage } from '../lib/utils';

export default function Admission() {
  const [students, setStudents] = useState<Student[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingInfo, setUploadingInfo] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [processing, setProcessing] = useState(false);
  
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm();
  
  const selectedSection = watch('section') as Section;
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'students'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      
      // Sort in-memory: newest first
      data.sort((a, b) => {
        const dateA = a.createdAt || '';
        const dateB = b.createdAt || '';
        return dateB.localeCompare(dateA);
      });
      
      setStudents(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const generateRegNo = async (section: Section, classCode: string) => {
    const prefix = SECTION_PREFIXES[section];
    const year = currentYear.toString();
    
    // Find last student in this section and class to get serial
    const q = query(
      collection(db, 'students'),
      where('section', '==', section),
      where('currentClass', '==', watch('currentClass')),
      orderBy('regNo', 'desc'),
      limit(1)
    );
    const snapshot = await getDocs(q);
    let nextSerial = 1;
    
    if (!snapshot.empty) {
      const lastReg = snapshot.docs[0].data().regNo;
      const parts = lastReg.split(/[- ]/);
      const lastSerial = parseInt(parts[parts.length - 1]);
      if (!isNaN(lastSerial)) nextSerial = lastSerial + 1;
    }

    const classCodeStr = classCode.toString().padStart(2, '0');
    const serialStr = nextSerial.toString().padStart(2, '0');
    
    return `${prefix}${year}-${classCodeStr}-${serialStr}`;
  };

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      let photoUrl = photoPreview || '';
      if (selectedPhoto) {
        setUploadingInfo('تصویر تیار ہو رہی ہے...');
        photoUrl = await compressImage(selectedPhoto);
      }

      if (editingStudent) {
        setUploadingInfo('ڈیٹا اپڈیٹ ہو رہا ہے...');
        await updateDoc(doc(db, 'students', editingStudent.id), {
          ...data,
          photoUrl,
          isResident: data.isResident === 'true',
          updatedAt: new Date().toISOString()
        });
        alert('طالب علم کا ریکارڈ اپڈیٹ کر دیا گیا۔');
      } else {
        const classObj = CLASS_DATA[selectedSection].find(c => c.name === data.currentClass);
        const regNo = await generateRegNo(data.section as Section, classObj?.code || '00');
        
        setUploadingInfo('ڈیٹا محفوظ ہو رہا ہے...');
        await addDoc(collection(db, 'students'), {
          ...data,
          regNo,
          photoUrl,
          isResident: data.isResident === 'true',
          status: 'active',
          createdAt: new Date().toISOString()
        });
        alert('نیا طالب علم کامیابی سے شامل کر لیا گیا۔');
      }

      setShowForm(false);
      setEditingStudent(null);
      reset();
      setSelectedPhoto(null);
      setPhotoPreview(null);
      fetchStudents();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'students');
    } finally {
      setLoading(false);
      setUploadingInfo(null);
    }
  };

  const startEdit = (student: Student) => {
    setEditingStudent(student);
    setShowForm(true);
    // Set form values
    reset({
      name: student.name,
      fatherName: student.fatherName,
      dob: student.dob,
      cnic: student.cnic,
      section: student.section,
      currentClass: student.currentClass,
      isResident: student.isResident.toString(),
      address: student.address,
      phone: student.phone,
      admissionDate: student.admissionDate || student.createdAt?.split('T')[0]
    });
    setPhotoPreview(student.photoUrl || null);
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
      setDeletingStudent(null);
      fetchStudents();
    } catch (error) {
      console.error(error);
      alert('ریکارڈ ڈیلیٹ کرنے میں غلطی ہوئی۔');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">داخلہ فارم / طلباء کی فہرست</h1>
          <p className="text-gray-500">نئے طلباء کا اندراج کریں اور موجودہ ریکارڈ دیکھیں</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl transition-all shadow-md"
        >
          <UserPlus className="w-5 h-5" />
          <span>نیا طالب علم شامل کریں</span>
        </button>
      </div>

      {/* Student List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="رجسٹریشن نمبر یا نام سے تلاش کریں..." 
              className="w-full pr-10 pl-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm">
                <th className="px-6 py-4 font-bold">رجسٹریشن نمبر</th>
                <th className="px-6 py-4 font-bold">نام</th>
                <th className="px-6 py-4 font-bold">ولدیت</th>
                <th className="px-6 py-4 font-bold">درجہ</th>
                <th className="px-6 py-4 font-bold">فون نمبر</th>
                <th className="px-6 py-4 font-bold">کیفیت</th>
                <th className="px-6 py-4 font-bold">ایکشن</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-400 italic">کوئی ریکارڈ موجود نہیں</td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-emerald-700 font-semibold">{student.regNo}</td>
                    <td className="px-6 py-4 font-bold">{student.name}</td>
                    <td className="px-6 py-4">{student.fatherName}</td>
                    <td className="px-6 py-4">
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs px-3">
                        {student.currentClass}
                      </span>
                    </td>
                    <td className="px-6 py-4">{student.phone}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                        student.status === 'active' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      )}>
                        {student.status === 'active' ? 'موجود' : 'خارج'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => startEdit(student)}
                          className="text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg font-bold transition-all border border-emerald-100"
                        >
                          ایڈٹ کریں
                        </button>
                        <button 
                          onClick={() => setDeletingStudent(student)}
                          className="text-red-400 hover:text-red-600 transition-colors p-2 hover:bg-red-50 rounded-lg"
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

      {/* Admission Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl relative my-8"
          >
            <div className="p-8 border-b flex items-center justify-between sticky top-0 bg-white rounded-t-3xl z-10 font-urdu">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{editingStudent ? 'ایڈٹ طالب علم' : 'داخلہ فارم'}</h3>
                <p className="text-gray-500 text-sm">طالب علم کی معلومات درج یا اپڈیٹ کریں۔</p>
              </div>
              <button 
                onClick={() => { setShowForm(false); setEditingStudent(null); reset(); setSelectedPhoto(null); setPhotoPreview(null); }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-8 overflow-y-auto max-h-[70vh] font-urdu">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {/* Photo Upload - Only for Boys, Girls get a symbolic icon */}
                {selectedSection !== Section.BANAT_DARS_NIYAMI ? (
                  <div className="md:col-span-2 flex justify-center mb-6">
                    <div className="relative group">
                      <div className={cn(
                        "w-32 h-40 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center bg-gray-50 overflow-hidden relative transition-all",
                        photoPreview ? "border-emerald-500" : "border-gray-300 hover:border-emerald-400"
                      )}>
                        {photoPreview ? (
                          <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <>
                            <Camera className="w-8 h-8 text-gray-400 mb-2" />
                            <span className="text-xs text-gray-500 text-center px-4">طالب علم کی تصویر</span>
                          </>
                        )}
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={onPhotoChange}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </div>
                      {photoPreview && (
                        <button 
                          type="button"
                          onClick={() => { setPhotoPreview(null); setSelectedPhoto(null); }}
                          className="absolute -top-2 -left-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="md:col-span-2 flex flex-col items-center justify-center p-6 bg-emerald-50 rounded-2xl border border-emerald-100 mb-6">
                    <div className="w-24 h-32 bg-white rounded-xl border border-emerald-200 flex items-center justify-center mb-4 shadow-sm">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-16 h-16 text-emerald-900/30">
                        <path d="M12 3c-4.5 0-7 3.5-7 8.5 0 2 1 4.5 2.5 6.5C8.5 19.5 10 21 12 21s3.5-1.5 4.5-3c1.5-2 2.5-4.5 2.5-6.5C19 6.5 16.5 3 12 3z" fill="currentColor" fillOpacity="0.1" />
                        <path d="M8.5 8.5h7a1 1 0 011 1v1a1 1 0 01-1 1h-7a1 1 0 01-1-1v-1a1 1 0 011-1z" fill="white" />
                        <circle cx="10.5" cy="10" r="0.5" fill="currentColor" />
                        <circle cx="13.5" cy="10" r="0.5" fill="currentColor" />
                        <path d="M5 21c0-2.5 2-4.5 4.5-4.5h5c2.5 0 4.5 2 4.5 4.5" />
                      </svg>
                    </div>
                    <p className="text-emerald-900 font-bold">بنات کے آئی ڈی کارڈ کے لیے یہ نمونہ استعمال ہوگا</p>
                    <p className="text-emerald-600 text-sm mt-1">لڑکیوں کی تصویر لینے کی ضرورت نہیں ہے</p>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-right font-medium text-gray-700">طالب علم کا نام</label>
                  <input {...register('name', { required: true })} className="w-full px-4 py-3 bg-[#e8eaf6]/50 border-none rounded-lg focus:ring-2 focus:ring-emerald-500 text-lg text-right" placeholder="مثلاً احمد علی" />
                </div>

                <div className="space-y-2">
                  <label className="block text-right font-medium text-gray-700">والد کا نام</label>
                  <input {...register('fatherName', { required: true })} className="w-full px-4 py-3 bg-[#e8eaf6]/50 border-none rounded-lg focus:ring-2 focus:ring-emerald-500 text-lg text-right" placeholder="مثلاً احمد خان" />
                </div>

                <div className="space-y-2">
                  <label className="block text-right font-medium text-gray-700">تاریخ پیدائش</label>
                  <input {...register('dob', { required: true })} type="date" className="w-full px-4 py-3 bg-[#e8eaf6]/50 border-none rounded-lg focus:ring-2 focus:ring-emerald-500 text-lg text-right" />
                </div>

                <div className="space-y-2">
                  <label className="block text-right font-medium text-gray-700">شناختی کارڈ / فارم ب نمبر</label>
                  <input 
                    {...register('cnic')} 
                    onChange={(e) => {
                      let val = e.target.value.replace(/[^0-9]/g, '');
                      if (val.length > 13) val = val.substring(0, 13);
                      
                      let formatted = val;
                      if (val.length > 5 && val.length <= 12) {
                        formatted = val.slice(0, 5) + '-' + val.slice(5);
                      } else if (val.length > 12) {
                        formatted = val.slice(0, 5) + '-' + val.slice(5, 12) + '-' + val.slice(12);
                      }
                      
                      setValue('cnic', formatted);
                    }}
                    className="w-full px-4 py-3 bg-[#e8eaf6]/50 border-none rounded-lg focus:ring-2 focus:ring-emerald-500 text-lg text-right font-mono" 
                    placeholder="XXXXX-XXXXXXX-X" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-right font-medium text-gray-700">شعبہ</label>
                  <select {...register('section', { required: true })} disabled={!!editingStudent} className="w-full px-4 py-3 bg-[#e8eaf6]/50 border-none rounded-lg focus:ring-2 focus:ring-emerald-500 text-lg text-right disabled:opacity-50">
                    <option value="">شعبہ منتخب کریں</option>
                    {Object.values(Section).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-right font-medium text-gray-700">کلاس</label>
                  <select {...register('currentClass', { required: true })} disabled={!!editingStudent} className="w-full px-4 py-3 bg-[#e8eaf6]/50 border-none rounded-lg focus:ring-2 focus:ring-emerald-500 text-lg text-right disabled:opacity-50">
                    <option value="">کلاس منتخب کریں</option>
                    {selectedSection && CLASS_DATA[selectedSection as Section].map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>

                <div className="md:col-span-2 space-y-3">
                  <label className="block text-right font-medium text-gray-700">رہائشی حیثیت</label>
                  <div className="flex items-center gap-8 justify-end">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <span className="text-lg">غیر مقیم</span>
                      <input 
                        type="radio" 
                        value="false" 
                        {...register('isResident', { required: true })}
                        className="w-5 h-5 text-emerald-600 focus:ring-emerald-500"
                        defaultChecked
                      />
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <span className="text-lg">مقیم</span>
                      <input 
                        type="radio" 
                        value="true" 
                        {...register('isResident', { required: true })}
                        className="w-5 h-5 text-emerald-600 focus:ring-emerald-500"
                      />
                    </label>
                  </div>
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="block text-right font-medium text-gray-700">مستقل پتہ</label>
                  <textarea {...register('address', { required: true })} className="w-full px-4 py-3 bg-[#e8eaf6]/50 border-none rounded-lg focus:ring-2 focus:ring-emerald-500 text-lg text-right" rows={2} placeholder="گلی، محلہ، شہر"></textarea>
                </div>

                <div className="space-y-2">
                  <label className="block text-right font-medium text-gray-700">سرپرست کا فون نمبر</label>
                  <input {...register('phone', { required: true })} className="w-full px-4 py-3 bg-[#e8eaf6]/50 border-none rounded-lg focus:ring-2 focus:ring-emerald-500 text-lg text-right" placeholder="03XXXXXXXXX" />
                </div>

                <div className="space-y-2">
                  <label className="block text-right font-medium text-gray-700">تاریخ داخلہ</label>
                  <input {...register('admissionDate', { required: true })} type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-3 bg-[#e8eaf6]/50 border-none rounded-lg focus:ring-2 focus:ring-emerald-500 text-lg text-right" />
                </div>
              </div>

              <div className="mt-10 flex justify-start">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#1a237e] hover:bg-[#0d47a1] disabled:bg-gray-400 text-white font-bold py-3 px-10 rounded-lg flex items-center justify-center gap-3 transition-all shadow-lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>{uploadingInfo || 'محفوظ ہو رہا ہے...'}</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-6 h-6" />
                      <span>طالب علم محفوظ کریں</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Permanent Delete Modal */}
      {deletingStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 font-urdu"
            dir="rtl"
          >
            <div className="bg-red-700 text-white p-6 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Trash2 className="w-6 h-6" />
                <h2 className="text-xl font-bold">مکمل ریکارڈ ڈیلیٹ کریں</h2>
              </div>
              <button onClick={() => setDeletingStudent(null)} className="hover:bg-white/10 p-2 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center border-4 border-red-100">
                  <AlertCircle className="w-10 h-10 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">کیا آپ واقعی مکمل ریکارڈ ڈیلیٹ کرنا چاہتے ہیں؟</h3>
                  <p className="text-gray-500 mt-2 text-sm">
                    آپ طالب علم <span className="font-bold text-red-600">"{deletingStudent.name}"</span> کا داخلہ، حاضری اور نتائج سب کچھ ڈیلیٹ کر رہے ہیں۔ یہ عمل واپس نہیں ہو سکتا۔
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handlePermanentDelete}
                  disabled={processing}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-red-200 flex items-center justify-center gap-2"
                >
                  {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'جی ہاں، مکمل ریکارڈ حذف کریں'}
                </button>
                <button
                  onClick={() => setDeletingStudent(null)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-all"
                >
                  منسوخ کریں
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
