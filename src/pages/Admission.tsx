import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { db, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Section, Student } from '../types';
import { CLASS_DATA, SECTION_PREFIXES } from '../constants';
import { Plus, Search, FileText, UserPlus, Camera, Loader2, X } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Admission() {
  const [students, setStudents] = useState<Student[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingInfo, setUploadingInfo] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm();
  
  const selectedSection = watch('section') as Section;
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const q = query(collection(db, 'students'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    } catch (e) {
      console.error(e);
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

    const serialStr = nextSerial.toString().padStart(2, '0');
    
    if (section === Section.BANIN_DARS_NIYAMI) {
      return `${prefix}${year}-${classCode}-${serialStr}`;
    } else if (section === Section.BANIN_HIFZ) {
      return `${prefix}${year}-${classCode}-${serialStr}`;
    } else {
      // BN: No dashes mentioned in description for serial, but maybe year/class? 
      // User said: BN + 2026 + ClassCode + Serial (1,2,3... no padding?)
      // We'll use 0-padding for consistency unless user objects.
      return `${prefix}${year}${classCode}${nextSerial}`; 
    }
  };

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      const classObj = CLASS_DATA[selectedSection].find(c => c.name === data.currentClass);
      const regNo = await generateRegNo(data.section as Section, classObj?.code || '00');
      
      let photoUrl = '';
      if (selectedPhoto) {
        setUploadingInfo('تصویر اپلوڈ ہو رہی ہے...');
        const storageRef = ref(storage, `students/${regNo}_${Date.now()}`);
        await uploadBytes(storageRef, selectedPhoto);
        photoUrl = await getDownloadURL(storageRef);
      }

      setUploadingInfo('ڈیٹا محفوظ ہو رہا ہے...');
      await addDoc(collection(db, 'students'), {
        ...data,
        regNo,
        photoUrl,
        isResident: data.isResident === 'true',
        status: 'active',
        createdAt: new Date().toISOString()
      });

      setShowForm(false);
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
                <th className="px-6 py-4 font-bold">ایکشن</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-400 italic">کوئی ریکارڈ موجود نہیں</td>
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
                      <button className="text-gray-400 hover:text-emerald-600 font-medium">تفصیلات</button>
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
            <div className="p-8 border-b flex items-center justify-between sticky top-0 bg-white rounded-t-3xl z-10">
              <div className="flex items-center gap-3 text-emerald-600">
                <UserPlus className="w-6 h-6" />
                <h3 className="text-2xl font-bold">نیا داخلہ فارم</h3>
              </div>
              <button 
                onClick={() => setShowForm(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-8 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Photo Upload - Only for Boys as per request */}
                {selectedSection !== Section.BANAT_DARS_NIYAMI && (
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
                )}

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">طالب علم کا نام</label>
                  <input {...register('name', { required: true })} className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 text-lg" placeholder="محمد احمد" />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">ولدیت</label>
                  <input {...register('fatherName', { required: true })} className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 text-lg" placeholder="عبداللہ" />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">تاریخ پیدائش</label>
                  <input {...register('dob', { required: true })} type="date" className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 text-lg" />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">شناختی کارڈ / فارم ب نمبر</label>
                  <input {...register('cnic')} className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 text-lg" placeholder="17301-0000000-1" />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">سیکشن</label>
                  <select {...register('section', { required: true })} className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 text-lg">
                    <option value="">سیکشن منتخب کریں</option>
                    {Object.values(Section).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">درجہ / کلاس</label>
                  <select {...register('currentClass', { required: true })} className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 text-lg" disabled={!selectedSection}>
                    <option value="">درجہ منتخب کریں</option>
                    {selectedSection && CLASS_DATA[selectedSection].map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">مقیم / غیر مقیم</label>
                  <select {...register('isResident', { required: true })} className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 text-lg">
                    <option value="false">غیر مقیم (ڈے اسکالر)</option>
                    <option value="true">مقیم (ہاسٹل)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">فون نمبر (والد)</label>
                  <input {...register('phone', { required: true })} className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 text-lg" placeholder="0300-0000000" />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">داخلہ کی تاریخ</label>
                  <input {...register('admissionDate', { required: true })} type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 text-lg" />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-bold text-gray-700">مستقل پتہ</label>
                  <textarea {...register('address', { required: true })} className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 text-lg" rows={3} placeholder="گاؤں چرہ پل، محلہ توحید آباد، پشاور"></textarea>
                </div>
              </div>

              <div className="mt-10 flex gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold py-4 px-8 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-emerald-100"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>{uploadingInfo || 'محفوظ ہو رہا ہے...'}</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-6 h-6" />
                      <span>داخلہ مکمل کریں</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-8 py-4 border-2 border-gray-100 font-bold rounded-2xl text-gray-500 hover:bg-gray-50 transition-all font-urdu"
                >
                  منسوخ کریں
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
