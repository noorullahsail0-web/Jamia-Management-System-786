import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Users, GraduationCap, ClipboardCheck, BookOpen, Star, Sparkles, BookOpenCheck, ArrowUpRight, TrendingUp } from 'lucide-react';
import { Section } from '../types';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

const QURAN_VERSES = [
  {
    arabic: "« يَرْفَعِ اللّٰهُ الَّذِیْنَ اٰمَنُوْا مِنْكُمْ ۙ وَالَّذِیْنَ اُوْتُوا الْعِلْمَ دَرَجٰتٍ »",
    translation: "اللہ تم میں سے ایمان والوں کے اور ان کے جنہیں علم دیا گیا ہے درجات بلند فرمائے گا۔",
    reference: "سورہ المجادلہ: 11"
  },
  {
    arabic: "« وَقُلْ رَّبِّ زِدْنِیْ عِلْمًا »",
    translation: "اور کہو: اے میرے رب! میرے علم میں اضافہ فرما۔",
    reference: "سورہ طہ: 114"
  },
  {
    arabic: "« هَلْ يَسْتَوِی الَّذِیْنَ يَعْلَمُوْنَ وَالَّذِیْنَ لَا يَعْلَمُوْنَ »",
    translation: "کہہ دیجئے: کیا برابر ہو سکتے ہیں وہ لوگ جو جانتے ہیں اور وہ جو نہیں جانتے؟",
    reference: "سورہ الزمر: 9"
  },
  {
    arabic: "« إِنَّمَا يَخْشَى اللَّهَ مِنْ عِبَادِهِ الْعُلَمَاءُ »",
    translation: "اللہ کے بندوں میں سے اس سے صرف وہی ڈرتے ہیں جو علم والے ہیں۔",
    reference: "سورہ فاطر: 28"
  },
  {
    arabic: "« اِقْرَاْ بِاسْمِ رَبِّكَ الَّذِیْ خَلَقَ »",
    translation: "پڑھیے اپنے رب کے نام کے ساتھ جس نے سب کچھ پیدا کیا۔",
    reference: "سورہ العلق: 1"
  },
  {
    arabic: "« الرَّحْمَٰنُ ۙ عَلَّمَ الْقُرْآنَ ۙ خَلَقَ الْإِنسَانَ ۙ عَلَّمَهُ الْبَيَانَ »",
    translation: "رحمٰن نے قرآن سکھایا، انسان کو پیدا کیا، اسے بولنا سکھایا۔",
    reference: "سورہ الرحمن: 1-4"
  },
  {
    arabic: "« كِتَابٌ أَنزَلْنَاهُ إِلَيْكَ مُبَارَكٌ لِّيَدَّبَّرُوا آيَاتِهِ وَلِيَتَذَكَّرَ أُولُو الْأَلْبَابِ »",
    translation: "یہ ایک بابرکت کتاب ہے جو ہم نے آپ کی طرف نازل کی ہے تاکہ وہ اس کی آیتوں میں غور و فکر کریں اور عقل والے نصیحت حاصل کریں۔",
    reference: "سورہ ص: 29"
  },
  {
    arabic: "« ذَٰلِكَ الْكِتَابُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى لِّلْمُتَّقِينَ »",
    translation: "یہ وہ کتاب ہے جس میں کوئی شک نہیں، پرہیزگاروں کے لیے سراسر رہنمائی ہے۔",
    reference: "سورہ البقرہ: 2"
  },
  {
    arabic: "« وَمَن يُؤْتَ الْحِكْمَةَ فَقَدْ أُوتِيَ خَيْرًا كَثِيرًا »",
    translation: "اور جسے حکمت عطا کی گئی، اسے حقیقت میں بڑی خیر و برکت مل گئی۔",
    reference: "سورہ البقرہ: 269"
  },
  {
    arabic: "« إِنَّ هَٰذَا الْقُرْآنَ يَهْدِي لِلَّتِي هِيَ أَقْوَمُ »",
    translation: "بے شک یہ قرآن اس راستے کی رہنمائی کرتا ہے جو سب سے زیادہ سیدھا ہے۔",
    reference: "سورہ الاسراء: 9"
  },
  {
    arabic: "« وَنُنَزِّلُ مِنَ الْقُرْآنِ مَا هُوَ شِفَاءٌ وَرَحْمَةٌ لِّلْمُؤْمِنِينَ »",
    translation: "اور ہم قرآن میں سے وہ چیز نازل کرتے ہیں جو ایمان والوں کے لیے شفا اور رحمت ہے۔",
    reference: "سورہ الاسراء: 82"
  },
  {
    arabic: "« رَبَّنَا تَقَبَّلْ مِنَّا ۖ إِنَّكَ أَنتَ السَّمِيعُ الْعَلِيمُ »",
    translation: "اے ہمارے رب! ہم سے قبول فرما، بے شک تو ہی سب کچھ سننے والا، سب کچھ جاننے والا ہے۔",
    reference: "سورہ البقرہ: 127"
  },
  {
    arabic: "« وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّتَقْوَىٰ ۖ وَلَا تَعَاوَنُوا عَلَى الْإِثْمِ وَالْعُدْوَانِ »",
    translation: "اور نیکی اور پرہیزگاری میں ایک دوسرے کی مدد کرو اور گناہ اور زیادتی میں ایک دوسرے کا ساتھ نہ دو۔",
    reference: "سورہ المائدہ: 2"
  },
  {
    arabic: "« إِنَّ اللَّهَ يَأْمُرُ بِالْعَدْلِ وَالْإِحْسَانِ »",
    translation: "بے شک اللہ عدل اور تمام اچھے کاموں (احسان) کا حکم دیتا ہے۔",
    reference: "سورہ النحل: 90"
  },
  {
    arabic: "« وَأَن لَّيْسَ لِلْإِنسَانِ إِلَّا مَا سَعَىٰ »",
    translation: "اور یہ کہ انسان کو وہی کچھ ملتا ہے جس کے لیے وہ کوشش کرتا ہے۔",
    reference: "سورہ النجم: 39"
  },
  {
    arabic: "« فَإِذَا عَزَمْتَ فَتَوَكَّلْ عَلَى اللَّهِ ۚ إِنَّ اللَّهِ يُحِبُّ الْمُتَوَكِّلِينَ »",
    translation: "پھر جب آپ پختہ ارادہ کر لیں تو اللہ پر بھروسہ رکھیں، یقیناً اللہ بھروسہ رکھنے والوں سے محبت کرتا ہے۔",
    reference: "سورہ آل عمران: 159"
  },
  {
    arabic: "« ادْعُ إِلَىٰ سَبِيلِ رَبِّكَ بِالْحِكْمَةِ وَالْمَوْعِظَةِ الْحَسَنَةِ »",
    translation: "اپنے رب کے راستے کی طرف متانت، حکمت اور بہترین نصیحت کے ساتھ دعوت دیجئے۔",
    reference: "سورہ النحل: 125"
  },
  {
    arabic: "« فَإِنَّ مَعَ الْعُسْرِ يُسْرًا ۙ إِنَّ مَعَ الْعُسْرِ يُسْرًا »",
    translation: "پس یقیناً تنگی کے ساتھ آسانی بھی ہے، بے شک تنگی کے ساتھ آسانی ہے۔",
    reference: "سورہ الشرح: 5-6"
  },
  {
    arabic: "« قُلْ هَلْ نُنَبِّئُكُم بِالْأَخْسَرِينَ أَعْمَالًا الَّذِينَ ضَلَّ سَعْيُهُمْ فِي الْحَيَاةِ الدُّنْيَا وَهُمْ يَحْسَبُونَ أَنَّهُمْ يُحْسِنُونَ صُنْعًا »",
    translation: "آپ کہیے: کیا ہم تمہیں بتائیں کہ اعمال کے اعتبار سے سب سے زیادہ خسارے میں کون لوگ ہیں؟ وہ جن کی کوششیں دنیاوی زندگی میں گم ہو گئیں اور وہ یہ گمان کرتے رہے کہ وہ اچھے کام کر رہے ہیں۔",
    reference: "سورہ الکہف: 103-104"
  },
  {
    arabic: "« وَأَقِيمُوا الصَّلَاةَ وَآتُوا الزَّكَاةَ ۚ وَمَا تُقَدِّمُوا لِأَنفُسِكُم مِّنْ خَيْرٍ تَجِدُوهُ عِندَ اللَّهِ »",
    translation: "اور نماز قائم کرو اور زکوٰۃ ادا کرو، اور جو نیکی بھی تم اپنے لیے آگے بھیجو گے، اسے اللہ کے پاس پا لو گے۔",
    reference: "سورہ البقرہ: 110"
  }
];

interface DashboardProps {
  setActiveTab: (tab: any) => void;
  isReadOnly?: boolean;
  userRole?: 'admin' | 'viewer' | null;
}

export default function Dashboard({ setActiveTab, isReadOnly = false, userRole = 'viewer' }: DashboardProps) {
  const [stats, setStats] = useState({
    total: 0,
    banin: 0,
    banat: 0,
    hifz: 0
  });
  const [loading, setLoading] = useState(true);

  // States for Authorized User Management (only used if admin)
  const [authorizedEmails, setAuthorizedEmails] = useState<any[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [isAddingEmail, setIsAddingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

  const getDailyVerse = () => {
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const diffInMs = today.getTime() - startOfYear.getTime();
    const dayOfYear = Math.floor(diffInMs / (1000 * 60 * 60 * 24)) + 1;
    
    const index = (dayOfYear + today.getFullYear()) % QURAN_VERSES.length;
    return QURAN_VERSES[index];
  };

  const dailyVerse = getDailyVerse();

  // Fetch authorized emails for administrative panel
  useEffect(() => {
    if (userRole === 'admin') {
      const fetchAuthorizedEmails = async () => {
        try {
          const querySnapshot = await getDocs(collection(db, 'authorized_emails'));
          const emailsList = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setAuthorizedEmails(emailsList);
        } catch (error) {
          console.error("Error fetching authorized emails:", error);
        }
      };
      fetchAuthorizedEmails();
    }
  }, [userRole]);

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    
    const emailClean = newEmail.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailClean)) {
      setEmailError('براہِ کرم ایک درست ای میل ایڈریس درج کریں۔');
      return;
    }
    
    if (emailClean === 'noorullahsail0@gmail.com') {
      setEmailError('یہ ایڈمنسٹریٹر کا اپنا ای میل پتا ہے۔ اسے شامل کرنے کی ضرورت نہیں ہے۔');
      return;
    }
    
    setIsAddingEmail(true);
    setEmailError(null);
    setEmailSuccess(null);
    
    try {
      const { doc: fireDoc, setDoc } = await import('firebase/firestore');
      await setDoc(fireDoc(db, 'authorized_emails', emailClean), {
        email: emailClean,
        role: 'viewer',
        addedAt: new Date().toISOString(),
      });
      
      setAuthorizedEmails(prev => [
        ...prev.filter(item => item.id !== emailClean),
        { id: emailClean, email: emailClean, role: 'viewer', addedAt: new Date().toISOString() }
      ]);
      setNewEmail('');
      setEmailSuccess('ای میل ایڈریس کامیابی کے ساتھ مجاز فہرست میں شامل کر دیا گیا ہے۔');
    } catch (error: any) {
      console.error("Error adding email:", error);
      setEmailError('ڈیٹا بیس میں ای میل شامل کرنے میں ناکامی ہوئی۔');
    } finally {
      setIsAddingEmail(false);
    }
  };

  const handleRemoveEmail = async (emailId: string) => {
    if (!window.confirm(`کیا آپ واقعی ${emailId} کو مجاز فہرست سے ہٹانا چاہتے ہیں؟`)) return;
    
    try {
      const { doc: fireDoc, deleteDoc } = await import('firebase/firestore');
      await deleteDoc(fireDoc(db, 'authorized_emails', emailId));
      setAuthorizedEmails(prev => prev.filter(item => item.id !== emailId));
    } catch (error) {
      console.error("Error removing email:", error);
      alert('ای میل ہٹانے میں مسئلہ پیش آیا۔');
    }
  };

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
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const totalCalculated = stats.total || 1; 
  const baninPercent = Math.round((stats.banin / totalCalculated) * 100);
  const banatPercent = Math.round((stats.banat / totalCalculated) * 100);
  const hifzPercent = Math.round((stats.hifz / totalCalculated) * 100);

  const cards = [
    { 
      label: 'کل زیر تعلیم طلباء', 
      value: stats.total, 
      desc: 'جامعہ میں زیر تعلیم کل فعال طلباء',
      percent: 100,
      icon: Users, 
      color: 'from-teal-600 to-emerald-700 hover:shadow-teal-100', 
      bg: 'bg-gradient-to-br from-emerald-500/10 to-teal-500/5', 
      border: 'border-emerald-500/20',
      text: 'text-emerald-700',
      iconBg: 'bg-emerald-600'
    },
    { 
      label: 'بنین دَرَسِ نظامی', 
      value: stats.banin, 
      desc: `${baninPercent}% تعلیمی شراکت`,
      percent: baninPercent,
      icon: BookOpen, 
      color: 'from-blue-600 to-indigo-700 hover:shadow-blue-100', 
      bg: 'bg-gradient-to-br from-blue-500/10 to-indigo-500/5', 
      border: 'border-blue-500/20',
      text: 'text-blue-700',
      iconBg: 'bg-blue-600'
    },
    { 
      label: 'بَنات دَرَسِ نظامی', 
      value: stats.banat, 
      desc: `${banatPercent}% تعلیمی شراکت`,
      percent: banatPercent,
      icon: GraduationCap, 
      color: 'from-fuchsia-600 to-purple-700 hover:shadow-fuchsia-100', 
      bg: 'bg-gradient-to-br from-fuchsia-500/10 to-purple-500/5', 
      border: 'border-fuchsia-500/20',
      text: 'text-fuchsia-700',
      iconBg: 'bg-fuchsia-600'
    },
    { 
      label: 'درجہ حفظ (بنین)', 
      value: stats.hifz, 
      desc: `${hifzPercent}% تعلیمی شراکت`,
      percent: hifzPercent,
      icon: ClipboardCheck, 
      color: 'from-amber-500 to-orange-600 hover:shadow-amber-100', 
      bg: 'bg-gradient-to-br from-amber-500/10 to-orange-500/5', 
      border: 'border-amber-500/20',
      text: 'text-amber-700',
      iconBg: 'bg-amber-500'
    },
  ];

  return (
    <div className="space-y-8 pb-10" dir="rtl">
      {/* Dynamic Header Block with Floating Lights */}
      <div className="relative overflow-hidden bg-gradient-to-l from-emerald-950 via-teal-900 to-cyan-950 p-8 md:p-12 rounded-[2.5rem] shadow-2xl border border-white/10 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.15),transparent_45%)]" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-3 text-right">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-emerald-300 text-xs font-bold font-sans">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
              <span>جامعہ ڈیجیٹل ڈیش بورڈ</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black font-nastaleeq tracking-normal leading-[1.3] text-transparent bg-clip-text bg-gradient-to-r from-emerald-100 via-white to-teal-50">
              {userRole === 'admin' ? 'خوش آمدید، نوراللہ صاحب!' : 'خوش آمدید، معزز مہمانِ علمی!'}
            </h1>
            <p className="text-emerald-200/80 font-bold text-base md:text-lg">جامعہ تعلیم القرآن ناگمان ضلع پشاور کے انتظام و تعلیمی ارتقاء کا خوبصورت سفر</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-3xl border border-white/15 flex items-center gap-4 shadow-lg">
            <div className="w-3.5 h-3.5 bg-emerald-400 rounded-full animate-ping" />
            <div className="text-right">
              <p className="text-[10px] text-emerald-200/60 font-medium">آج کی تاریخ</p>
              <span className="font-extrabold text-base text-white font-sans">{new Date().toLocaleDateString('ur-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Inspirational Quranic citation box */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-amber-500/5 via-yellow-500/5 to-amber-600/5 border border-amber-500/10 p-6 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6"
      >
        <div className="flex items-center gap-4 text-amber-800 w-full">
          <div className="p-3 bg-amber-500/10 rounded-2xl flex items-center justify-center shrink-0">
            <BookOpenCheck className="w-6 h-6" />
          </div>
          <div className="text-right space-y-1">
            <span className="inline-block px-2.5 py-0.5 bg-amber-500/15 text-amber-800 rounded-md text-[10px] font-black tracking-wider uppercase mb-1">آج کی قرآنی آیت</span>
            <p className="font-medium text-xl md:text-2xl text-amber-950 leading-relaxed font-arabic block" dir="rtl">
              {dailyVerse.arabic}
            </p>
            <p className="font-bold text-sm md:text-base text-amber-900 leading-relaxed font-urdu">
              {dailyVerse.translation} <span className="text-xs text-amber-700 font-bold font-sans mr-2">({dailyVerse.reference})</span>
            </p>
          </div>
        </div>
        <div className="flex gap-1 text-amber-500 shrink-0">
          {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
        </div>
      </motion.div>

      {/* Modern Colorful Interactive Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, type: "spring", stiffness: 100 }}
            className={cn(
              "group p-6 rounded-[2.5rem] border transition-all cursor-default shadow-sm hover:shadow-xl hover:-translate-y-1 relative overflow-hidden",
              card.bg,
              card.border
            )}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/40 rounded-full translate-x-12 -translate-y-12 blur-2xl pointer-events-none opacity-40 transition-transform group-hover:scale-125" />
            
            <div className="flex justify-between items-start mb-6">
              <div className={cn("p-4 rounded-2xl text-white shadow-md transition-transform group-hover:scale-110 duration-300 bg-gradient-to-br", card.color)}>
                <card.icon className="w-6 h-6" />
              </div>
              <span className="text-gray-400/20 group-hover:text-emerald-500/10 transition-colors font-black text-4xl font-sans">0{i+1}</span>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 font-extrabold mb-1">{card.label}</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl font-black text-gray-900 font-sans tracking-tight">{card.value}</p>
                  <span className="text-xs font-bold text-gray-400">طلباء</span>
                </div>
              </div>

              {/* Colorful Custom Progress Bar */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-[10px] font-bold text-gray-400">
                  <span>شراکت کی سطح</span>
                  <span className={card.text}>{card.percent}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100/80 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${card.percent}%` }}
                    transition={{ delay: 0.5 + (i * 0.1), duration: 0.8 }}
                    className={cn("h-full rounded-full bg-gradient-to-r", card.color)}
                  />
                </div>
              </div>
              <p className="text-[10px] text-gray-400 font-bold">{card.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Modern Analytical Dashboard Panel & Quick Actions Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Colorful Educational Graph Custom Component */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-premium border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-8">
              <div className="space-y-1 text-right">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <h3 className="text-2xl font-black text-gray-900 font-urdu leading-none">تعلیمی ارتقاء و حاضری گراف</h3>
                </div>
                <p className="text-xs text-gray-400 font-bold">مجموعی طلباء حاضری اور کارکردگی کا موازنہ</p>
              </div>
              <span className="px-4 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-extrabold border border-emerald-100 font-sans">
                تعلیمی سال {new Date().getFullYear()}
              </span>
            </div>

            {/* Premium Animated Chart with Color Gradient Pillars */}
            <div className="h-64 flex items-end justify-between gap-4 px-4 overflow-hidden relative border-b border-gray-100 pt-6">
              {[
                { h: 75, month: 'شعبہ بنین', color: 'from-blue-400 to-indigo-600', val: `${stats.banin} طلباء` },
                { h: 48, month: 'شعبہ بنات', color: 'from-purple-400 to-fuchsia-600', val: `${stats.banat} طلباء` },
                { h: 88, month: 'شعبہ حفظ', color: 'from-amber-400 to-orange-500', val: `${stats.hifz} طلباء` },
                { h: 92, month: 'مجموعی حاضری', color: 'from-teal-400 to-emerald-600', val: '92%' },
                { h: 81, month: 'کامیابی تناسب', color: 'from-cyan-400 to-sky-600', val: '81%' },
                { h: 63, month: 'ہاسٹل رہائشی', color: 'from-rose-400 to-pink-500', val: '63%' },
                { h: 30, month: 'غیر مقیم', color: 'from-slate-400 to-slate-600', val: '30%' }
              ].map((item, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group cursor-pointer">
                  {/* Tooltip */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-2 bg-gray-900 text-white text-[10px] px-3 py-1.5 rounded-lg shadow-xl font-bold font-sans pointer-events-none z-10 flex flex-col items-center">
                    <span>{item.val}</span>
                    <div className="w-1.5 h-1.5 bg-gray-900 rotate-45 -mb-1 mt-1" />
                  </div>

                  <div className="w-full relative h-full flex flex-col justify-end">
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${item.h}%` }}
                      transition={{ delay: 0.3 + (i * 0.1), duration: 1.2, ease: "easeOut" }}
                      className={cn("w-full bg-gradient-to-t rounded-t-xl transition-all shadow-md group-hover:brightness-105", item.color)}
                    >
                      <div className="w-full h-full bg-[linear-gradient(rgba(255,255,255,0.15)_1px,transparent_1px)] bg-[size:100%_8px] rounded-t-xl opacity-20" />
                    </motion.div>
                  </div>
                  <span className="text-[10px] text-gray-400 group-hover:text-gray-900 transition-colors font-extrabold whitespace-nowrap mt-1">{item.month}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex justify-between items-center text-center bg-gray-50/50 p-5 rounded-3xl border border-gray-100">
            <div>
              <p className="text-[10px] text-gray-400 font-extrabold mb-1 uppercase">مجموعی حاضری</p>
              <div className="flex items-center gap-1 justify-center text-emerald-700">
                <TrendingUp className="w-4 h-4" />
                <p className="text-2xl font-black font-sans leading-none">92%</p>
              </div>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div>
              <p className="text-[10px] text-gray-400 font-extrabold mb-1 uppercase">کامیابی کا تناسب</p>
              <p className="text-2xl font-black text-blue-700 font-sans leading-none">85%</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div>
              <p className="text-[10px] text-gray-400 font-extrabold mb-1 uppercase">نئے اساتذہ / عملہ</p>
              <p className="text-2xl font-black text-purple-700 font-sans leading-none">16</p>
            </div>
          </div>
        </div>

        {/* Premium Gold Accent Dark Control Center (Quick Actions) */}
        <div className="bg-gradient-to-br from-[#0c241c] via-[#051d16] to-[#041110] p-8 rounded-[2.5rem] shadow-premium text-white relative overflow-hidden flex flex-col justify-between border border-emerald-950">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full translate-x-1/3 -translate-y-1/3 blur-[80px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-500/5 rounded-full -translate-x-1/3 translate-y-1/3 blur-[80px] pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <h3 className="text-2xl font-black font-nastaleeq text-transparent bg-clip-text bg-gradient-to-r from-amber-100 to-amber-300">انتظامی کنٹرول</h3>
            </div>
            
            <div className="space-y-4">
              {[
                { label: 'نیا طالب علم داخل کریں', desc: 'کوائف، تصاویر اور رجسٹریشن', icon: Users, tab: 'admission', color: 'group-hover:text-amber-400' },
                { label: 'روزانہ و ماہانہ حاضری', desc: 'طلباء حاضری کی تفصیلات', icon: ClipboardCheck, tab: 'attendance', color: 'group-hover:text-emerald-400' },
                { label: 'امتحانی نتائج اینٹری', desc: 'نمبر درج کریں اور پوزیشنز بنائیں', icon: GraduationCap, tab: 'results', color: 'group-hover:text-cyan-400' },
              ].map((link, i) => (
                <button 
                  key={i}
                  onClick={() => setActiveTab(link.tab)}
                  className="w-full flex items-center justify-between p-4 rounded-3xl bg-white/5 border border-white/[0.04] hover:bg-white/10 hover:border-white/10 transition-all group text-right shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn("p-3 bg-white/5 rounded-2xl group-hover:bg-amber-500/10 text-emerald-400 transition-colors duration-300")}>
                      <link.icon className="w-5 h-5 group-hover:text-amber-400 transition-colors" />
                    </div>
                    <div>
                      <p className="font-extrabold text-base leading-tight mb-1">{link.label}</p>
                      <p className="text-[10px] text-emerald-400/40 group-hover:text-white/50">{link.desc}</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-gray-500 group-hover:text-amber-400 transition-colors" />
                </button>
              ))}
            </div>
          </div>

          <div className="relative z-10 mt-8 p-6 bg-gradient-to-l from-emerald-950/60 to-teal-950/60 rounded-[2rem] border border-emerald-900/40">
            <p className="text-sm font-black text-amber-300 mb-2 font-urdu">معاون گائیڈ لائن</p>
            <p className="text-xs text-emerald-200/60 leading-relaxed mb-4">
              نتائج اینٹری پیج پر اب آپ کمپیوٹر کی تیروں والی چابیاں (Arrow Keys) اور Enter بٹن کے ذریعے آسانی سے تیزی کے ساتھ اگلی لائنوں پر جا سکتے ہیں۔
            </p>
            <div className="flex gap-2">
              <span className="text-[9px] bg-emerald-900/80 px-2 py-0.5 rounded text-emerald-300">Arrow Up ↑</span>
              <span className="text-[9px] bg-emerald-900/80 px-2 py-0.5 rounded text-emerald-300">Arrow Down ↓</span>
              <span className="text-[9px] bg-emerald-900/80 px-2 py-0.5 rounded text-emerald-300">Enter ↵</span>
            </div>
          </div>
        </div>
      </div>

      {/* Users & Permissions Panel (Only visible to admin) */}
      {userRole === 'admin' && (
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-[2.5rem] shadow-premium border border-gray-100 mt-8"
        >
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6 pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-2xl font-black text-gray-900 font-nastaleeq">صارفین کے اجازت نامے (یوزرز اور پرمیشنز)</h3>
              <p className="text-xs text-gray-500 font-bold mt-1">اپنے اساتذہ یا دوستوں کے ای میلز شامل کریں تاکہ وہ موبائل پر صرف دیکھنے (Read-Only) کی حد تک سسٹم کھول سکیں</p>
            </div>
            
            <form onSubmit={handleAddEmail} className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto shrink-0">
              <div className="relative flex-1 sm:w-80">
                <input 
                  type="email" 
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="نیا ای میل ایڈریس درج کریں (مثلاً friend@gmail.com)..."
                  className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-2xl px-4 py-3 text-sm text-right font-sans outline-none transition-all"
                  dir="ltr"
                />
              </div>
              <button 
                type="submit"
                disabled={isAddingEmail}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-6 py-3 rounded-2xl text-xs transition-all shadow-md shrink-0 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isAddingEmail ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span>➕</span>
                )}
                <span>مجاز ای میل شامل کریں</span>
              </button>
            </form>
          </div>

          {emailError && (
            <div className="bg-red-50 border border-red-200 text-red-900 text-xs px-4 py-2.5 rounded-xl mb-4 font-bold flex items-center gap-1.5">
              <span>⚠️</span>
              <span>{emailError}</span>
            </div>
          )}

          {emailSuccess && (
            <div className="bg-emerald-50 border border-emerald-150 text-emerald-900 text-xs px-4 py-2.5 rounded-xl mb-4 font-bold flex items-center gap-1.5">
              <span>✔️</span>
              <span>{emailSuccess}</span>
            </div>
          )}

          {/* List of Authorized Viewers */}
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-gray-150 text-xs font-black text-gray-400">
                  <th className="py-3 px-4 font-extrabold text-right">صارف ای میل</th>
                  <th className="py-3 px-4 font-extrabold text-right">اجازت نامہ (رول)</th>
                  <th className="py-3 px-4 font-extrabold text-right">شامل کرنے کی تاریخ</th>
                  <th className="py-3 px-4 font-extrabold text-center">ایکشن</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {/* Always show Administrator in the list */}
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-3.5 px-4 font-sans text-sm font-bold text-gray-900">noorullahsail0@gmail.com</td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-100 rounded-full text-amber-800 text-[10px] font-black">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      سستم مینیجر / ایڈمنسٹریٹر
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-gray-400 font-sans font-medium">—</td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="text-[10px] text-gray-400 font-bold">بنیادی اکاؤنٹ (تبدیل نہیں ہوسکتا)</span>
                  </td>
                </tr>

                {authorizedEmails.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-xs text-gray-400 font-bold">
                      کوئی اضافی مجاز صارف شامل نہیں ہے۔ آپ اوپر والے فارم کے ذریعے اپنے اساتذہ یا ساتھیوں کی ای میلز شامل کر سکتے ہیں۔
                    </td>
                  </tr>
                ) : (
                  authorizedEmails.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3.5 px-4 font-sans text-sm font-medium text-gray-800">{item.email}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-100 rounded-full text-emerald-800 text-[10px] font-black">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          صرف دیکھنے کی اجازت (Viewer / Read-only)
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-500 font-sans font-medium">
                        {item.addedAt ? new Date(item.addedAt).toLocaleDateString('ur-PK') : 'نامعلوم'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleRemoveEmail(item.id)}
                          className="bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border border-red-100"
                        >
                          اجازت منسوخ کریں 🗑️
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
