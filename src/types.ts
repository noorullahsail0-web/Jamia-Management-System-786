export enum Section {
  BANAT_DARS_NIYAMI = 'بنات درس نظامی',
  BANIN_DARS_NIYAMI = 'بنین درس نظامی',
  BANIN_HIFZ = 'بنین درجہ حفظ'
}

export enum ExamType {
  QUARTERLY = 'امتحان سہ ماہی',
  HALF_YEARLY = 'امتحان شش ماہی',
  ANNUAL = 'امتحان سالانہ'
}

export interface Student {
  id: string;
  regNo: string;
  name: string;
  fatherName: string;
  dob: string;
  cnic: string;
  section: Section;
  currentClass: string;
  isResident: boolean;
  phone: string;
  admissionDate: string;
  address: string;
  photoUrl?: string;
  status: 'active' | 'left' | 'graduated';
  createdAt: string;
}

export interface AttendanceRecord {
  id?: string;
  studentId: string;
  date: string;
  status: 'present' | 'absent' | 'leave';
  section: Section;
  class: string;
}

export interface ExamResult {
  id?: string;
  studentId: string;
  regNo: string;
  examType: ExamType;
  year: string;
  class: string;
  subjects: Record<string, number>;
  hifzBreakdown?: {
    q1: number;
    q2: number;
    q3: number;
    lahja: number;
    safai: number;
    adiya: number;
  };
  totalMarks: number;
  percentage: number;
  grade: string;
  updatedAt: string;
}
