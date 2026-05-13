import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Section, Student } from '../types';
import { CLASS_DATA } from '../constants';
import { Search, Loader2, User, Printer, FileDown } from 'lucide-react';
import { cn } from '../lib/utils';
import logo from '../assets/logo.png';
import schoolName from '../assets/school_name.png';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, AlignmentType, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const NiqabIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Hijab/Outer Shape */}
    <path d="M12 3c-4.5 0-7 3.5-7 8.5 0 2 1 4.5 2.5 6.5C8.5 19.5 10 21 12 21s3.5-1.5 4.5-3c1.5-2 2.5-4.5 2.5-6.5C19 6.5 16.5 3 12 3z" fill="currentColor" fillOpacity="0.1" />
    {/* Eyes Opening Area */}
    <path d="M8.5 8.5h7a1 1 0 011 1v1a1 1 0 01-1 1h-7a1 1 0 01-1-1v-1a1 1 0 011-1z" fill="white" />
    {/* Eyes */}
    <circle cx="10.5" cy="10" r="0.5" fill="currentColor" />
    <circle cx="13.5" cy="10" r="0.5" fill="currentColor" />
    {/* Lower Body */}
    <path d="M5 21c0-2.5 2-4.5 4.5-4.5h5c2.5 0 4.5 2 4.5 4.5" />
  </svg>
);

export default function IDGenerator() {
  const [section, setSection] = useState<Section | ''>('');
  const [currentClass, setCurrentClass] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const cardsRef = React.useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const downloadPDF = async () => {
    if (!cardsRef.current || students.length === 0) return;
    setDownloadingPDF(true);
    try {
      const canvas = await html2canvas(cardsRef.current, {
        scale: 4,
        useCORS: true,
        backgroundColor: '#ffffff',
          onclone: (clonedDoc) => {
            const elements = clonedDoc.getElementsByTagName('*');
            for (let i = 0; i < elements.length; i++) {
              const el = elements[i] as HTMLElement;
              
              // Strip problematic Tailwind 4 variables and styles that html2canvas cannot parse
              el.style.color = '#000000';
              el.style.backgroundColor = 'transparent';
              el.style.borderColor = '#000000';
              el.style.boxShadow = 'none';
              el.style.textShadow = 'none';
              el.style.backgroundImage = 'none';
              
              // Re-apply specific colors using hex
              if (el.tagName === 'TH' || el.classList.contains('text-white')) {
                el.style.color = '#ffffff';
              } else if (el.classList.contains('text-emerald-700')) {
                el.style.color = '#047857';
              }
              
              if (el.tagName === 'TH' || el.classList.contains('bg-emerald-900')) {
                el.style.backgroundColor = '#104d38';
              } else if (el.classList.contains('bg-white')) {
                el.style.backgroundColor = '#ffffff';
              }
            }
          }
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`ID_Cards_${currentClass}.pdf`);
    } catch (e) {
      console.error(e);
      alert('پی ڈی ایف ڈاؤن لوڈ کرنے میں غلطی ہوئی۔');
    } finally {
      setDownloadingPDF(false);
    }
  };

  const downloadWord = async () => {
    if (students.length === 0) return;

    const rows = [];
    // Create card-like rows for Word
    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      rows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: student.regNo, bold: true, color: "104d38" })],
                  alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                  children: [new TextRun({ text: `Name: ${student.name}`, bold: true })],
                }),
                new Paragraph({
                  children: [new TextRun({ text: `Father: ${student.fatherName}` })],
                }),
                new Paragraph({
                  children: [new TextRun({ text: `Class: ${student.currentClass}`, bold: true })],
                }),
                new Paragraph({
                  children: [new TextRun({ text: `Address: ${student.address}`, size: 16 })],
                }),
              ],
              width: { size: 50, type: WidthType.PERCENTAGE },
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
            }),
          ],
        })
      );
    }

    const table = new Table({
      rows: rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    });

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({
            children: [new TextRun({ text: "ID Cards Recod", bold: true, size: 32 })],
            alignment: AlignmentType.CENTER,
          }),
          table
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `ID_Cards_${currentClass}.docx`);
  };

  const fetchStudents = async () => {
    if (!section || !currentClass) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'students'),
        where('section', '==', section),
        where('currentClass', '==', currentClass),
        where('status', '==', 'active')
      );
      const snapshot = await getDocs(q);
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
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
          <h1 className="text-2xl font-bold text-gray-900">آئی ڈی کارڈ جنریٹر</h1>
          <p className="text-gray-500">طلباء کے شناختی کارڈز تیار کریں اور پرنٹ کریں</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => downloadPDF()}
            disabled={students.length === 0 || downloadingPDF}
            className="flex items-center gap-2 bg-white border border-red-200 text-red-700 px-6 py-3 rounded-xl transition-all shadow-sm font-bold hover:bg-red-50"
          >
            {downloadingPDF ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
            <span>پی ڈی ایف ڈاؤن لوڈ</span>
          </button>
          <button
            onClick={() => downloadWord()}
            disabled={students.length === 0}
            className="flex items-center gap-2 bg-white border border-emerald-200 text-emerald-700 px-6 py-3 rounded-xl transition-all shadow-sm font-bold hover:bg-emerald-50"
          >
            <FileDown className="w-5 h-5" />
            <span>Word فائل ڈاؤن لوڈ</span>
          </button>
          <button
            onClick={() => handlePrint()}
            disabled={students.length === 0}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white px-6 py-3 rounded-xl transition-all shadow-md font-bold"
          >
            <Printer className="w-5 h-5" />
            <span>تمام کارڈز پرنٹ کریں</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-end gap-6">
        <div className="flex-1 space-y-2 text-right">
          <label className="text-sm font-bold text-gray-700">سیکشن</label>
          <select 
            value={section} 
            onChange={(e) => setSection(e.target.value as Section)}
            className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">منتخب کریں</option>
            {Object.values(Section).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex-1 space-y-2 text-right">
          <label className="text-sm font-bold text-gray-700">درجہ</label>
          <select 
            value={currentClass} 
            onChange={(e) => setCurrentClass(e.target.value)}
            disabled={!section}
            className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          >
            <option value="">منتخب کریں</option>
            {section && CLASS_DATA[section as Section].map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <button
          onClick={fetchStudents}
          className="bg-emerald-600 p-4 rounded-xl text-white hover:bg-emerald-700 transition-all shadow-lg"
        >
          <Search className="w-6 h-6" />
        </button>
      </div>

      <div className="p-4 overflow-x-auto min-h-[400px]">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
          </div>
        ) : (
          <div 
            ref={cardsRef}
            className="grid grid-cols-1 md:grid-cols-2 gap-8 justify-items-center bg-white p-8 rounded-3xl min-w-[350px] print-only-cards"
          >
            {students.length === 0 ? (
              <p className="text-gray-400 italic">کوئی ریکارڈ منتخب نہیں کیا گیا</p>
            ) : (
              students.map((student) => (
                <div 
                  key={student.id} 
                  className="w-[3.375in] h-[2.125in] border-2 border-emerald-900 rounded-xl overflow-hidden relative bg-white shadow-lg flex flex-col font-urdu text-[10px]"
                  style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
                >
                  {/* Card Header with Reg No, School Name and Logo */}
                  <div className="bg-emerald-900 text-white flex items-center justify-between px-2 py-1 font-mono tracking-widest text-[10px] font-bold">
                    <span>{student.regNo}</span>
                    <img 
                      src={schoolName} 
                      alt="جامعہ تعلیم القرآن" 
                      className="h-5 object-contain px-2 brightness-0 invert" 
                    />
                    <img src={logo} alt="Logo" className="w-5 h-5 object-contain bg-white rounded-full p-0.5" />
                  </div>

                  <div className="flex flex-1 p-2 gap-2 overflow-hidden">
                    {/* Details Side */}
                    <div className="flex-1 flex flex-col justify-between py-1 pr-1">
                      <div className="grid grid-cols-[3.5rem_auto] gap-y-1 items-center">
                        <span className="font-bold text-emerald-900">نام:</span>
                        <span className="font-bold border-b border-gray-200 truncate">{student.name}</span>
                        
                        <span className="font-bold text-emerald-900">ولدیت:</span>
                        <span className="border-b border-gray-200 truncate">{student.fatherName}</span>
                        
                        <span className="font-bold text-emerald-900">تاریخ پیدائش:</span>
                        <span className="border-b border-gray-200">{student.dob.split('-').reverse().join('-')}</span>
                        
                        <span className="font-bold text-emerald-900">شناختی کارڈ:</span>
                        <span className="border-b border-gray-200">{student.cnic}</span>
                        
                        <span className="font-bold text-emerald-900">سیکشن:</span>
                        <span className="border-b border-gray-200">{student.section}</span>
                      </div>
                    </div>

                    {/* Image Placeholder & Class */}
                    <div className="flex flex-col items-center gap-1 shrink-0 mt-1">
                      <div className="w-20 h-24 border border-emerald-900 rounded bg-gray-50 flex items-center justify-center overflow-hidden">
                        {student.section === Section.BANAT_DARS_NIYAMI ? (
                          <NiqabIcon className="w-16 h-16 text-emerald-900/40" />
                        ) : student.photoUrl ? (
                          <img src={student.photoUrl} alt="Student" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <User className="w-8 h-8 text-gray-300" />
                        )}
                      </div>
                      {/* Highlights Class/Darja under photo */}
                      <div className="w-20 bg-emerald-900 text-white text-[9px] py-0.5 rounded text-center font-bold">
                        {student.currentClass}
                      </div>
                    </div>
                  </div>

                  {/* Address Section */}
                  <div className={cn(
                    "px-4 py-1 text-[8px] mt-auto font-bold",
                    student.isResident 
                      ? "border-t-2 border-emerald-900 bg-emerald-50/50" 
                      : "border-t border-dashed border-emerald-300"
                   )}>
                    <span className="text-emerald-900 ml-1">پتہ:</span>
                    {student.address}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { 
            size: A4 portrait; 
            margin: 1cm;
          }
          body * { visibility: hidden; }
          .print-only-cards, .print-only-cards * { visibility: visible; }
          .print-only-cards { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%;
            display: grid !important;
            grid-template-cols: 1fr 1fr !important;
            gap: 20px !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          button, select, label { display: none !important; }
        }
      ` }} />
    </div>
  );
}
