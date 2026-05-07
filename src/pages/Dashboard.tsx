import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Users, GraduationCap, ClipboardCheck, BookOpen } from 'lucide-react';
import { Section } from '../types';

export default function Dashboard() {
  const [stats, setStats] = useState({
    total: 0,
    banin: 0,
    banat: 0,
    hifz: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      const q = query(collection(db, 'students'), where('status', '==', 'active'));
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(d => d.data());
      
      setStats({
        total: docs.length,
        banin: docs.filter(d => d.section === Section.BANIN_DARS_NIYAMI).length,
        banat: docs.filter(d => d.section === Section.BANAT_DARS_NIYAMI).length,
        hifz: docs.filter(d => d.section === Section.BANIN_HIFZ).length
      });
    };
    fetchStats();
  }, []);

  const cards = [
    { label: 'کل طلباء', value: stats.total, icon: Users, color: 'bg-blue-500' },
    { label: 'بنین درس نظامی', value: stats.banin, icon: BookOpen, color: 'bg-emerald-500' },
    { label: 'بنات درس نظامی', value: stats.banat, icon: GraduationCap, color: 'bg-purple-500' },
    { label: 'بنین درجہ حفظ', value: stats.hifz, icon: ClipboardCheck, color: 'bg-orange-500' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">خوش آمدید، نوراللہ صاحب!</h1>
        <p className="text-gray-500">جامعہ تعلیم القرآن کے نظم و ضبط کا تازہ ترین جائزہ۔</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className={`${card.color} p-4 rounded-xl text-white`}>
              <card.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{card.label}</p>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-xl font-bold mb-6">حالیہ داخلے</h3>
          <p className="text-gray-400 text-center py-10 italic">کوئی حالیہ ریکارڈ موجود نہیں</p>
        </div>
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-xl font-bold mb-6">امتحانی کارکردگی</h3>
          <p className="text-gray-400 text-center py-10 italic">امتحانات کے نتائج یہاں ظاہر ہوں گے</p>
        </div>
      </div>
    </div>
  );
}
