import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Users, GraduationCap, ClipboardCheck, BookOpen } from 'lucide-react';
import { Section } from '../types';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export default function Dashboard({ setActiveTab }: { setActiveTab: (tab: any) => void }) {
  const [stats, setStats] = useState({
    total: 0,
    banin: 0,
    banat: 0,
    hifz: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const q = query(collection(db, 'students'), where('status', '==', 'active'));
        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map(d => d.data());
        
        setStats({
          total: docs.length,
          banin: docs.filter(d => d.section === Section.BANIN_DARS_NIYAMI).length,
          banat: docs.filter(d => d.section === Section.BANAT_DARS_NIYAMI).length,
          hifz: docs.filter(d => d.section === Section.BANIN_HIFZ).length
        });
      } catch (error) {
        console.error("Dashboard Stats Fetch Error:", error);
      }
    };
    fetchStats();
  }, []);

  const cards = [
    { label: 'کل طلباء', value: stats.total, icon: Users, color: 'from-emerald-500 to-emerald-700', bg: 'bg-emerald-50' },
    { label: 'بنین درس نظامی', value: stats.banin, icon: BookOpen, color: 'from-blue-500 to-blue-700', bg: 'bg-blue-50' },
    { label: 'بنات درس نظامی', value: stats.banat, icon: GraduationCap, color: 'from-purple-500 to-purple-700', bg: 'bg-purple-50' },
    { label: 'بنین درجہ حفظ', value: stats.hifz, icon: ClipboardCheck, color: 'from-orange-500 to-orange-700', bg: 'bg-orange-50' },
  ];

  return (
    <div className="space-y-10 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">خوش آمدید، نوراللہ صاحب!</h1>
          <p className="text-gray-500 font-bold text-lg">جامعہ تعلیم القرآن کے تعلیمی امور کا جائزہ</p>
        </div>
        <div className="bg-white px-6 py-3 rounded-2xl shadow-premium border border-gray-100 flex items-center gap-3">
          <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
          <span className="font-bold text-emerald-900">{new Date().toLocaleDateString('ur-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="group bg-white p-6 rounded-[2rem] shadow-premium border border-gray-100 flex flex-col justify-between gap-6 hover:border-emerald-200 transition-all cursor-default"
          >
            <div className="flex justify-between items-start">
              <div className={cn("p-4 rounded-2xl text-white shadow-lg bg-gradient-to-br transition-transform group-hover:scale-110 duration-300", card.color)}>
                <card.icon className="w-7 h-7" />
              </div>
              <span className="text-gray-300 group-hover:text-emerald-500 transition-colors font-black text-2xl opacity-20">0{i+1}</span>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-black mb-1">{card.label}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-black text-gray-900 leading-none">{card.value}</p>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">طلباء</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-premium border border-gray-100">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-2xl font-black text-gray-900">تعلیمی گراف</h3>
            <div className="flex gap-2">
               <span className="px-4 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-100">سالانہ 2024</span>
            </div>
          </div>
          <div className="h-64 flex items-end justify-between gap-4 px-4 overflow-hidden">
             {[45, 60, 35, 80, 55, 90, 70].map((h, i) => (
               <motion.div 
                 key={i}
                 initial={{ height: 0 }}
                 animate={{ height: `${h}%` }}
                 transition={{ delay: 0.5 + (i * 0.1), duration: 1 }}
                 className="flex-1 bg-emerald-500/10 rounded-t-2xl relative group"
               >
                 <div className="absolute inset-x-0 bottom-0 bg-emerald-500 rounded-t-2xl transition-all h-1/2 group-hover:h-full opacity-60" />
               </motion.div>
             ))}
          </div>
          <div className="mt-10 flex justify-between items-center text-center">
            <div>
              <p className="text-xs text-gray-400 font-bold mb-1 uppercase">مجموعی حاضری</p>
              <p className="text-2xl font-black text-emerald-700">92%</p>
            </div>
            <div className="w-px h-8 bg-gray-100" />
            <div>
              <p className="text-xs text-gray-400 font-bold mb-1 uppercase">کامیابی تناسب</p>
              <p className="text-2xl font-black text-blue-700">85%</p>
            </div>
            <div className="w-px h-8 bg-gray-100" />
            <div>
              <p className="text-xs text-gray-400 font-bold mb-1 uppercase">نئی درخواستیں</p>
              <p className="text-2xl font-black text-purple-700">12</p>
            </div>
          </div>
        </div>

        <div className="bg-[#022c22] p-8 rounded-[2.5rem] shadow-premium text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/20 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
          <h3 className="text-2xl font-black mb-8 relative z-10 font-urdu">فوری لنکس</h3>
          <div className="space-y-4 relative z-10">
            {[
              { label: 'نیا داخلہ کریں', desc: 'طلباء کے ریکارڈ کا اندراج', icon: Users, tab: 'admission' },
              { label: 'حاضری رجسٹر', desc: 'روزانہ کی رپورٹ دیکھیں', icon: ClipboardCheck, tab: 'attendance' },
              { label: 'نتائج تیار کریں', desc: 'امتحانی نمبر درج کریں', icon: GraduationCap, tab: 'results' },
            ].map((link, i) => (
              <button 
                key={i}
                onClick={() => setActiveTab(link.tab)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-emerald-600 transition-all group text-right"
              >
                <div className="p-3 bg-white/10 rounded-xl group-hover:bg-white text-emerald-400 group-hover:text-emerald-600 transition-colors">
                  <link.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-base leading-none mb-1">{link.label}</p>
                  <p className="text-[10px] text-emerald-400/60 font-medium group-hover:text-white/60">{link.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-12 p-6 bg-emerald-900/50 rounded-[2rem] border border-white/5 relative z-10">
            <p className="text-sm font-bold text-emerald-200 mb-2">مدد کی ضرورت ہے؟</p>
            <p className="text-xs text-emerald-100/60 leading-relaxed mb-4">سسٹم کے بارے میں کسی بھی مسئلے کی صورت میں ایڈمن سے رابطہ کریں۔</p>
            <button className="text-xs font-black bg-emerald-500 text-white px-6 py-2.5 rounded-xl hover:bg-emerald-400 transition-all">ایڈمن سپورٹ</button>
          </div>
        </div>
      </div>
    </div>
  );
}
