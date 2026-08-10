import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSchoolProfile } from '../context/SchoolProfileContext.jsx';
import schoolSilhouette from '../school_silhouette.png';
import ExamResultView from './ExamResultView.jsx';
import ResultEntry from './ResultEntry.jsx';
import SchoolRoutineManager, { TeacherRoutineReadOnly } from './RoutineView.jsx';
import { getTeacherPanelData, saveTeacherPanelData, subscribeToTeacherPanelData, saveClassRecord, purgeResultsForStudents, saveStudentProfile } from '../firebase/firestoreSchema.js';
import { loadGroupSubjectsFromFirestore, saveGroupSubjectsToFirestore } from '../firebase/groupSubjects.js';
import { getBranchKeyByClass, extractClassNumber, getResolvedBranches, getActiveBranchKeys, filterClassesByBranch, SCHOOL_BRANCHES, sortClasses } from '../utils/schoolResolver.js';
import { useViewMode } from '../context/ViewModeContext.jsx';
import { notifySchoolDataChanged } from '../utils/schoolData.js';
import FeeManagementSystem from './FeeManagementSystem.jsx';
import { useAlert } from '../hooks/useAlert.js';
import NotificationBell from './NotificationBell.jsx';
import ScholasticBaseLogo from './ScholasticBaseLogo.jsx';
import SafeImage from './SafeImage.jsx';
import SectionErrorBoundary from './SectionErrorBoundary.jsx';
import { convertToWebP } from '../utils/imageOptimizer.js';
import AddNoticeModal from './AddNoticeModal.jsx';
import { getNotices, canUserAccessNotice, addNotice, deleteNotices as deleteNoticesStorage, subscribeToNoticeUpdates, normalizeRoles, canUserPostNotice } from '../utils/noticeStorage.js';

/* ──────────────────────────────────────────
   SVG Icon Components
   ────────────────────────────────────────── */
const HamburgerIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <line x1="3.5" y1="6" x2="20.5" y2="6" />
    <line x1="3.5" y1="12" x2="20.5" y2="12" />
    <line x1="3.5" y1="18" x2="20.5" y2="18" />
  </svg>
);

const BellIcon = () => (
  <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const ChevronRight = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const ChevronLeft = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const LogoutIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

/* Hero KPI Stat Icons */
const KPIClassIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);
const KPIStudentIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c3 3 9 3 12 0v-5" />
  </svg>
);
const KPITeacherIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const KPISchoolIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M3 21h18M3 7l9-4 9 4v14H3V7z" />
    <path d="M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4" />
  </svg>
);

/* Nav Icons */
const HomeIcon = ({ active }) => (
  <svg width="22" height="22" fill={active ? '#2563eb' : 'none'} stroke={active ? '#2563eb' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
const NoticeIcon = ({ active }) => (
  <svg width="22" height="22" fill="none" stroke={active ? '#2563eb' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M22 2 11 13" /><path d="M22 2 15 22 11 13 2 9l20-7z" />
  </svg>
);
const CalendarIcon = ({ active }) => (
  <svg width="22" height="22" fill="none" stroke={active ? '#2563eb' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const MessageIcon = ({ active }) => (
  <svg width="22" height="22" fill="none" stroke={active ? '#2563eb' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const ProfileIcon = ({ active }) => (
  <svg width="22" height="22" fill="none" stroke={active ? '#2563eb' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

/* Mobile nav icons for menu items */
const StudentNavIcon = ({ active }) => (
  <svg width="22" height="22" fill={active ? '#2563eb' : 'none'} stroke={active ? '#2563eb' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const TeacherNavIcon = ({ active }) => (
  <svg width="22" height="22" fill={active ? '#2563eb' : 'none'} stroke={active ? '#2563eb' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
  </svg>
);
const ExamNavIcon = ({ active }) => (
  <svg width="22" height="22" fill={active ? '#2563eb' : 'none'} stroke={active ? '#2563eb' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <rect x="5" y="2" width="14" height="20" rx="2" />
    <line x1="9" y1="7" x2="15" y2="7" />
    <line x1="9" y1="11" x2="15" y2="11" />
  </svg>
);

/* Menu card icons (white) */
const StudentInfoIcon = () => (
  <svg width="26" height="26" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const TeacherDirIcon = () => (
  <svg width="26" height="26" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const ExamIcon = () => (
  <svg width="26" height="26" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <rect x="5" y="2" width="14" height="20" rx="2" />
    <line x1="9" y1="7" x2="15" y2="7" /><line x1="9" y1="11" x2="15" y2="11" /><line x1="9" y1="15" x2="13" y2="15" />
  </svg>
);
const RoutineIcon = () => (
  <svg width="26" height="26" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    <circle cx="8" cy="15" r="1" fill="#fff" /><circle cx="12" cy="15" r="1" fill="#fff" /><circle cx="16" cy="15" r="1" fill="#fff" />
  </svg>
);
const FeeIcon = () => (
  <svg width="26" height="26" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <rect x="1" y="4" width="22" height="16" rx="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

/* Sidebar-only icons (colored) */
const SBStudentIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const SBTeacherIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const SBExamIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <rect x="5" y="2" width="14" height="20" rx="2" />
    <line x1="9" y1="7" x2="15" y2="7" /><line x1="9" y1="11" x2="15" y2="11" />
  </svg>
);
const SBRoutineIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const SBFeeIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);
const SBHomeIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
const SBNoticeIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M22 2 11 13" /><path d="M22 2 15 22 11 13 2 9l20-7z" />
  </svg>
);
const SBProfileIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

/* ──────────────────────────────────────────
   Static data
   ────────────────────────────────────────── */
const menuItems = [
  { id: 'students', title: 'Student Info', subtitle: 'Profiles, classes & student roster', badge: 'Directory', color: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', shadowColor: 'rgba(37, 99, 235, 0.25)', Icon: StudentInfoIcon, SBIcon: SBStudentIcon },
  { id: 'teachers', title: 'Teachers Directory', subtitle: 'Faculty members & contact list', badge: 'Faculty', color: 'linear-gradient(135deg, #10b981 0%, #047857 100%)', shadowColor: 'rgba(16, 185, 129, 0.25)', Icon: TeacherDirIcon, SBIcon: SBTeacherIcon },
  { id: 'exam', title: 'Results', subtitle: 'View published exam marksheets', badge: 'Reports', color: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', shadowColor: 'rgba(139, 92, 246, 0.25)', Icon: ExamIcon, SBIcon: SBExamIcon },
  { id: 'result-entry', title: 'Result Entry', subtitle: 'Input and publish student marks', badge: 'Marks Entry', color: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)', shadowColor: 'rgba(99, 102, 241, 0.25)', Icon: ExamIcon, SBIcon: SBExamIcon },
  { id: 'routine', title: 'Class & Routine', subtitle: 'Class routines & daily schedules', badge: 'Timetables', color: 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)', shadowColor: 'rgba(249, 115, 22, 0.25)', Icon: RoutineIcon, SBIcon: SBRoutineIcon },
  { id: 'fees', title: 'Fee Management', subtitle: 'Student fees & collection portal', badge: 'Finance', color: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)', shadowColor: 'rgba(14, 165, 233, 0.25)', Icon: FeeIcon, SBIcon: SBFeeIcon },
  { id: 'notice', title: 'Notice Board', subtitle: 'Official notices & announcements', badge: 'Bulletins', color: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', shadowColor: 'rgba(245, 158, 11, 0.25)', Icon: NoticeIcon, SBIcon: SBNoticeIcon },
];

const navItems = [
  { id: 'home', label: 'Home', Icon: HomeIcon },
  { id: 'students', label: 'Students', Icon: StudentNavIcon },
  { id: 'teachers', label: 'Teachers', Icon: TeacherNavIcon },
  { id: 'result-entry', label: 'Results', Icon: ExamNavIcon },
  { id: 'notice', label: 'Notices', Icon: NoticeIcon },
  { id: 'profile', label: 'Profile', Icon: ProfileIcon },
];

const CLASSES_STORAGE_KEY = 'teacherPanelClasses';
const TEACHERS_STORAGE_KEY = 'teacherPanelTeachers';
const GROUP_SUBJECTS_STORAGE_KEY = 'teacherPanelGroupSubjects';
const TEACHER_ROUTINES_STORAGE_KEY = 'teacherPanelTeacherRoutines';
const ROUTINE_TIME_SLOTS_STORAGE_KEY = 'teacherPanelRoutineTimeSlots';
const getActiveSchoolId = () => {
  if (typeof window === 'undefined') return '';
  try {
    const raw = window.localStorage.getItem('schoolAppProfile');
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.schoolId || parsed?.schoolCode || parsed?.eiinNumber || window.localStorage.getItem('schoolId') || window.localStorage.getItem('schoolCode') || window.localStorage.getItem('schoolEiinNumber') || '';
  } catch {
    return window.localStorage.getItem('schoolId') || window.localStorage.getItem('schoolCode') || window.localStorage.getItem('schoolEiinNumber') || '';
  }
};

const getScopedKey = (key) => {
  return key;
};

const readStoredData = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeStoredData = (key, value) => {
  if (typeof window === 'undefined') return;
  try {
    const jsonVal = JSON.stringify(value);
    window.localStorage.setItem(key, jsonVal);
    notifySchoolDataChanged();
  } catch {
    // ignore storage write errors
  }
};

const loadTeacherPanelDataFromFirestore = (explicitSchoolId) => getTeacherPanelData(explicitSchoolId || getActiveSchoolId());
const saveTeacherPanelDataToFirestore = ({ classes, teachers, teacherRoutines, timeSlots }, explicitSchoolId) => saveTeacherPanelData({ classes, teachers, teacherRoutines, timeSlots }, explicitSchoolId || getActiveSchoolId());

/**
 * Filter classes to strictly match current active school profile (EIIN / School ID)
 * and ensure school context binding on all class objects.
 */
const filterAndBindClasses = (rawClasses, schoolProfile, explicitSchoolId) => {
  if (!Array.isArray(rawClasses)) return [];
  const targetSchoolId = schoolProfile?.schoolId || schoolProfile?.schoolCode || explicitSchoolId || getActiveSchoolId();
  const targetEiin = schoolProfile?.eiinNumber || '';
  const targetSchoolCode = schoolProfile?.schoolCode || '';

  return sortClasses(
    rawClasses
      .filter((cls) => {
        if (!cls || typeof cls !== 'object') return false;
        const clsSchoolId = cls.schoolId ? String(cls.schoolId).trim() : '';
        const clsEiin = cls.eiinNumber ? String(cls.eiinNumber).trim() : '';
        const clsCode = cls.schoolCode ? String(cls.schoolCode).trim() : '';

        // If class has explicit school metadata, it MUST match current school profile context
        if (clsSchoolId || clsEiin || clsCode) {
          const matchesId = targetSchoolId && clsSchoolId && (clsSchoolId === String(targetSchoolId).trim() || clsSchoolId === String(targetSchoolCode).trim());
          const matchesEiin = targetEiin && clsEiin && clsEiin === String(targetEiin).trim();
          const matchesCode = targetSchoolCode && clsCode && clsCode.toUpperCase() === String(targetSchoolCode).trim().toUpperCase();

          if (!matchesId && !matchesEiin && !matchesCode) {
            return false; // Belongs to a different school
          }
        }
        return true;
      })
      .map((cls) => {
        const resolvedBranch = cls.branchKey || cls.branchId || cls.branch || getBranchKeyByClass(cls.className);
        return {
          ...cls,
          branchKey: resolvedBranch,
          branchId: resolvedBranch,
          sectionId: cls.sectionId || resolvedBranch,
          schoolId: cls.schoolId || targetSchoolId || 'PROGGA_DEFAULT',
          eiinNumber: cls.eiinNumber || targetEiin || '',
          schoolCode: cls.schoolCode || targetSchoolCode || '',
        };
      })
  );
};

const teacherProfiles = [];
const classSections = [
  'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
].map((ordinal, index) => ({
  className: `Class ${ordinal}`,
  classNum: index + 1,
  students: [],
}));
const examData = [
  { subject: 'Mathematics', date: '15 Jul 2026', grade: 'Grade 10', time: '9:00 AM' },
  { subject: 'Physics', date: '17 Jul 2026', grade: 'Grade 11', time: '10:00 AM' },
  { subject: 'Chemistry', date: '19 Jul 2026', grade: 'Grade 11', time: '9:30 AM' },
  { subject: 'English', date: '21 Jul 2026', grade: 'Grade 10', time: '11:00 AM' },
];
const routineData = [
  { day: 'Monday', subject: 'Mathematics', time: '8:00 – 9:30 AM', room: 'Room 101' },
  { day: 'Tuesday', subject: 'Physics', time: '9:30 – 11:00 AM', room: 'Lab 2' },
  { day: 'Wednesday', subject: 'Chemistry', time: '8:00 – 9:30 AM', room: 'Lab 1' },
  { day: 'Thursday', subject: 'English', time: '10:00 – 11:30 AM', room: 'Room 203' },
  { day: 'Friday', subject: 'Mathematics', time: '8:00 – 9:30 AM', room: 'Room 101' },
];
const feeData = [
  { name: 'Tuition Fee', status: 'Pending', amount: '$1,200.00' },
  { name: 'Library Fee', status: 'Paid', amount: '$90.00' },
  { name: 'Laboratory Fee', status: 'Paid', amount: '$150.00' },
  { name: 'Activity Fee', status: 'Pending', amount: '$75.00' },
];

/* ──────────────────────────────────────────
   Helpers
   ────────────────────────────────────────── */
const getGreeting = () => {
  const bdHour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    hour: 'numeric',
    hour12: false,
  }).format(new Date()));

  if (bdHour < 5) return 'Good Night';
  if (bdHour < 12) return 'Good Morning';
  if (bdHour < 17) return 'Good Afternoon';
  if (bdHour < 20) return 'Good Evening';
  return 'Good Night';
};

const Badge = ({ color, label }) => (
  <span className="tp-badge" style={{ background: color }}>{label}</span>
);

/* ──────────────────────────────────────────
   Class colour palette (cycles through 10 classes)
   ────────────────────────────────────────── */
const CLASS_COLORS = [
  '#4a90e2', '#38b26e', '#8b5cf6', '#f97316', '#0ea5a4',
  '#e11d48', '#d97706', '#0284c7', '#7c3aed', '#059669',
];

/* ──────────────────────────────────────────
   Ordinal helper
   ────────────────────────────────────────── */
const ORDINALS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

const getClassAbbrev = (cls, idx) => {
  if (idx < 10) return ORDINALS[idx];
  const name = cls.className;
  const match = name.match(/^(?:Class|Grade)\s+(.+)$/i);
  const coreName = match ? match[1] : name;
  if (coreName.length <= 4) return coreName;
  if (!isNaN(coreName)) return coreName;
  return coreName.slice(0, 3).toUpperCase();
};

/* ──────────────────────────────────────────
   AddClassModal
   ────────────────────────────────────────── */
function AddClassModal({ onClose, onAdd, initialBranchKey = 'primary' }) {
  const [className, setClassName] = useState('');
  const [targetBranchKey, setTargetBranchKey] = useState(initialBranchKey || 'primary');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = className.trim();
    if (!trimmed) {
      setError('Class name is required');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      await onAdd(trimmed, targetBranchKey);
    } catch (err) {
      console.error('AddClassModal submission error:', err);
      setError(err.message || 'Failed to save class to database. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="tp-modal-overlay" onClick={isSubmitting ? undefined : onClose}>
      <div className="tp-modal" onClick={e => e.stopPropagation()}>
        <div className="tp-modal-header" style={{ borderBottomColor: '#2563eb' }}>
          <h3 className="tp-modal-title">🏫 Add Custom Class</h3>
          <button className="tp-modal-close" onClick={onClose} disabled={isSubmitting} aria-label="Close">✕</button>
        </div>

        <form className="tp-modal-body" onSubmit={handleSubmit}>
          <div className="tp-form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="tp-form-group tp-form-full">
              <label className="tp-form-label">Target Branch / Department *</label>
              <select
                className="tp-form-input"
                value={targetBranchKey}
                onChange={e => setTargetBranchKey(e.target.value)}
                disabled={isSubmitting}
                style={{ marginBottom: '12px' }}
              >
                {getActiveBranchKeys().includes('primary') && <option value="primary">🏫 {getResolvedBranches().primary?.name || 'Primary School'}</option>}
                {getActiveBranchKeys().includes('secondary') && <option value="secondary">🎓 {getResolvedBranches().secondary?.name || 'High School'}</option>}
                {getActiveBranchKeys().includes('college') && <option value="college">🏛️ {getResolvedBranches().college?.name || 'College'}</option>}
              </select>
            </div>
            <div className="tp-form-group tp-form-full">
              <label className="tp-form-label">Class Name *</label>
              <input
                className={`tp-form-input${error ? ' tp-input-error' : ''}`}
                type="text"
                placeholder={targetBranchKey === 'college' ? 'e.g. INTER 1ST YEAR, Class Eleven' : 'e.g. Class One, Little Nursery'}
                value={className}
                onChange={e => {
                  setClassName(e.target.value);
                  if (error) setError('');
                }}
                disabled={isSubmitting}
                autoFocus
              />
              {error && <span className="tp-form-error" style={{ color: '#ef4444', fontSize: '12.5px', marginTop: '4px', display: 'block', fontWeight: 600 }}>{error}</span>}
            </div>
          </div>

          <div className="tp-modal-footer">
            <button type="button" className="tp-modal-cancel-btn" onClick={onClose} disabled={isSubmitting}>Cancel</button>
            <button
              type="submit"
              className="tp-modal-submit-btn"
              style={{ background: '#2563eb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: isSubmitting ? 0.75 : 1 }}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span style={{ display: 'inline-block', width: '13px', height: '13px', border: '2px solid #ffffff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
                  <span>Saving...</span>
                </>
              ) : 'Add Class'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


/* ──────────────────────────────────────────
   AddStudentModal
   ────────────────────────────────────────── */
function AddStudentModal({ onClose, onAdd, classColor, existingRolls = [], groupName = '' }) {
  const [form, setForm] = useState({
    name: '',
    roll: '',
    phone: '',
    fatherName: '',
    motherName: '',
    dob: '',
    profilePic: ''
  });
  const [error, setError] = useState('');
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingPhoto(true);
    try {
      const optimized = await convertToWebP(file, { maxWidth: 300, maxHeight: 300, quality: 0.85 });
      setForm(prev => ({ ...prev, profilePic: optimized.dataUrl }));
    } catch (err) {
      console.error('Photo optimization failed, falling back:', err);
      const reader = new FileReader();
      reader.onload = (ev) => setForm(prev => ({ ...prev, profilePic: ev.target.result }));
      reader.readAsDataURL(file);
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const name = form.name.trim();
    const roll = form.roll.trim();

    if (!name || !roll) {
      setError('Student name and roll number are required.');
      return;
    }

    const normalizedRoll = roll.toUpperCase();
    const duplicateRoll = (existingRolls || []).some((existing) => String(existing || '').trim().toUpperCase() === normalizedRoll);
    if (duplicateRoll) {
      setError('This roll number already exists in this group.');
      return;
    }

    onAdd({
      id: `std-${Date.now()}`,
      name,
      roll: normalizedRoll,
      phone: form.phone.trim(),
      fatherName: form.fatherName.trim(),
      motherName: form.motherName.trim(),
      dob: form.dob,
      profilePic: form.profilePic,
      group: groupName,
    });
  };

  return (
    <div className="tp-modal-overlay" onClick={onClose}>
      <div className="tp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tp-modal-header" style={{ borderBottomColor: classColor }}>
          <h3 className="tp-modal-title">➕ Add New Student</h3>
          <button className="tp-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="tp-modal-body" onSubmit={handleSubmit}>
          {/* Photo Upload Section (300x300px) */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <label htmlFor="tp-student-add-photo" style={{ cursor: 'pointer', display: 'inline-block' }}>
              {form.profilePic ? (
                <div style={{ position: 'relative', width: 100, height: 100, borderRadius: 16, overflow: 'hidden', margin: '0 auto', border: `2px solid ${classColor}`, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  <img src={form.profilePic} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', bottom: 0, inset: 'auto 0 0 0', background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 10, fontWeight: 700, textAlign: 'center', padding: '3px 0' }}>
                    300 × 300 px
                  </div>
                </div>
              ) : (
                <div style={{
                  width: 100,
                  height: 100,
                  borderRadius: 16,
                  border: `2px dashed ${classColor}`,
                  background: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto',
                  transition: 'all 0.2s'
                }}>
                  <span style={{ fontSize: 26, marginBottom: 2 }}>📸</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>Upload Photo</span>
                  <span style={{ fontSize: 9, color: '#64748b', fontWeight: 600 }}>300 × 300 px</span>
                </div>
              )}
            </label>
            <input
              id="tp-student-add-photo"
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              style={{ display: 'none' }}
            />
            {form.profilePic && (
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, profilePic: '' }))}
                style={{ display: 'block', margin: '6px auto 0', background: 'none', border: 'none', color: '#ef4444', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
              >
                Remove Photo
              </button>
            )}
          </div>

          <div className="tp-form-grid">
            <div className="tp-form-group tp-form-full">
              <label className="tp-form-label">Student Name *</label>
              <input
                className={`tp-form-input${error ? ' tp-input-error' : ''}`}
                type="text"
                placeholder="e.g. Ayesha Rahman"
                value={form.name}
                onChange={(e) => { setForm(prev => ({ ...prev, name: e.target.value })); if (error) setError(''); }}
                autoFocus
              />
            </div>

            <div className="tp-form-group">
              <label className="tp-form-label">Roll Number *</label>
              <input
                className={`tp-form-input${error ? ' tp-input-error' : ''}`}
                type="text"
                placeholder="e.g. 01"
                value={form.roll}
                onChange={(e) => { setForm(prev => ({ ...prev, roll: e.target.value })); if (error) setError(''); }}
              />
            </div>

            <div className="tp-form-group">
              <label className="tp-form-label">Phone</label>
              <input
                className="tp-form-input"
                type="text"
                placeholder="e.g. +88017..."
                value={form.phone}
                onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>

            <div className="tp-form-group">
              <label className="tp-form-label">Father's Name</label>
              <input
                className="tp-form-input"
                type="text"
                placeholder="e.g. Md. Rahman"
                value={form.fatherName}
                onChange={(e) => setForm(prev => ({ ...prev, fatherName: e.target.value }))}
              />
            </div>

            <div className="tp-form-group">
              <label className="tp-form-label">Mother's Name</label>
              <input
                className="tp-form-input"
                type="text"
                placeholder="e.g. Salma Begum"
                value={form.motherName}
                onChange={(e) => setForm(prev => ({ ...prev, motherName: e.target.value }))}
              />
            </div>

            <div className="tp-form-group tp-form-full">
              <label className="tp-form-label">Date of Birth (Birthday)</label>
              <input
                className="tp-form-input"
                type="date"
                value={form.dob}
                onChange={(e) => setForm(prev => ({ ...prev, dob: e.target.value }))}
              />
            </div>
          </div>

          {error && <div className="tp-form-error" style={{ marginTop: 8 }}>{error}</div>}

          <div className="tp-modal-footer">
            <button type="button" className="tp-modal-cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="tp-modal-submit-btn" style={{ background: classColor }} disabled={isProcessingPhoto}>
              {isProcessingPhoto ? 'Processing Photo...' : 'Add Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────
   AddGroupModal
   ────────────────────────────────────────── */
function AddGroupModal({ onClose, onAdd, classColor }) {
  const [groupName, setGroupName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setError('Group name is required');
      return;
    }
    onAdd(groupName.trim());
  };

  return (
    <div className="tp-modal-overlay" onClick={onClose}>
      <div className="tp-modal" onClick={e => e.stopPropagation()}>
        <div className="tp-modal-header" style={{ borderBottomColor: classColor }}>
          <h3 className="tp-modal-title">👥 Add Custom Group</h3>
          <button className="tp-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="tp-modal-body" onSubmit={handleSubmit}>
          <div className="tp-form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="tp-form-group tp-form-full">
              <label className="tp-form-label">Group Name *</label>
              <input
                className={`tp-form-input${error ? ' tp-input-error' : ''}`}
                type="text"
                placeholder="e.g. Group D, Biology Team"
                value={groupName}
                onChange={e => {
                  setGroupName(e.target.value);
                  if (error) setError('');
                }}
                autoFocus
              />
              {error && <span className="tp-form-error">{error}</span>}
            </div>
          </div>

          <div className="tp-modal-footer">
            <button type="button" className="tp-modal-cancel-btn" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="tp-modal-submit-btn"
              style={{ background: classColor }}
            >
              Add Group
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────
   GroupRoster – shows groups of one class
   ────────────────────────────────────────── */
function GroupRoster({ classData, classIdx, onBack, onSelectGroup, onAddGroup, onDeleteGroups, visibleGroups = null, isReadOnly = false, canModifyClass = true }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState(new Set());
  const [showConfirm, setShowConfirm] = useState(false);

  const classColor = CLASS_COLORS[(classData.classNum - 1) % CLASS_COLORS.length];
  const canManage = Boolean(canModifyClass);
  const groupsForView = (Array.isArray(visibleGroups) && visibleGroups.length > 0
    ? visibleGroups
    : Array.isArray(classData.groups)
      ? classData.groups
      : []);

  const toggleSelect = (groupName) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      next.has(groupName) ? next.delete(groupName) : next.add(groupName);
      return next;
    });
  };

  const selectAll = () => setSelectedGroups(new Set(groupsForView));
  const clearAll = () => setSelectedGroups(new Set());

  const handleDeleteConfirm = () => {
    onDeleteGroups?.(classIdx, [...selectedGroups]);
    setSelectedGroups(new Set());
    setDeleteMode(false);
    setShowConfirm(false);
  };

  const handleAddGroup = (groupName) => {
    onAddGroup?.(classIdx, groupName);
    setShowAddModal(false);
  };

  return (
    <>
      {!isReadOnly && showAddModal && (
        <AddGroupModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddGroup}
          classColor={classColor}
        />
      )}

      {!isReadOnly && showConfirm && (
        <div className="tp-modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="tp-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="tp-confirm-icon">⚠️</div>
            <h3 className="tp-confirm-title">
              Delete {selectedGroups.size} Group{selectedGroups.size !== 1 ? 's' : ''}?
            </h3>
            <p className="tp-confirm-sub">
              This action cannot be undone. Selected groups and their students will be removed.
            </p>
            <div className="tp-confirm-actions">
              <button className="tp-modal-cancel-btn" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="tp-delete-exec-btn" onClick={handleDeleteConfirm}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="tp-section-header">
        <button className="tp-back-btn" onClick={onBack} title="Back to Classes" aria-label="Back to Classes">
          <ChevronLeft />
        </button>
        <div className="tp-section-header-info">
          <div className="tp-breadcrumbs" aria-label="Breadcrumb">
            <button type="button" className="tp-crumb-link" onClick={onBack}>Classes</button>
            <span className="tp-crumb-separator">/</span>
            <span className="tp-crumb-current">{classData?.className}</span>
          </div>
          <h2 className="tp-section-title">{classData?.className} — Groups</h2>
        </div>
      </div>

      <div className="tp-detail-card" style={{ margin: '0 20px 16px', padding: '16px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1f2937' }}>🧑‍🏫 Manage groups</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569', lineHeight: 1.4 }}>Select a group to view its students and manage details.</p>
          </div>
          {!isReadOnly && canManage && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
              <button className="tp-add-student-btn" style={{ background: classColor, whiteSpace: 'nowrap' }} onClick={() => setShowAddModal(true)}>
                + Add Group
              </button>
              <button className="tp-add-student-btn" style={{ background: '#64748b', whiteSpace: 'nowrap' }} onClick={() => setDeleteMode(v => !v)}>
                {deleteMode ? 'Cancel' : 'Delete Groups'}
              </button>
            </div>
          )}
        </div>

        {groupsForView.length === 0 ? (
          <div className="tp-roster-empty">
            <span>🗂️</span>
            <p>No groups are available for this class yet.</p>
          </div>
        ) : (
          <div className="tp-student-roster-grid">
            {groupsForView.map((groupName, index) => {
              const selected = selectedGroups.has(groupName);
              return (
                <button
                  key={`${groupName}-${index}`}
                  type="button"
                  className={`tp-student-roster-card${deleteMode && selected ? ' tp-card-selected' : ''}`}
                  onClick={() => {
                    if (deleteMode) {
                      toggleSelect(groupName);
                      return;
                    }
                    onSelectGroup?.(index);
                  }}
                  style={{ textAlign: 'left', padding: 16, cursor: 'pointer' }}
                >
                  {deleteMode && (
                    <div className={`tp-roster-checkbox${selected ? ' tp-cb-checked' : ''}`}>
                      {selected ? '✓' : ''}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1f2937' }}>{groupName}</p>
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                        {(classData.students || []).filter((student) => student.group === groupName).length} student{(classData.students || []).filter((student) => student.group === groupName).length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <span className="tp-badge" style={{ background: '#dbeafe', color: '#1d4ed8', flexShrink: 0 }}>Open</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!isReadOnly && canManage && deleteMode && (
        <div className="tp-delete-section">
          <div className="tp-delete-bar">
            <div className="tp-delete-bar-left">
              <span className="tp-delete-count">{selectedGroups.size} of {groupsForView.length} selected</span>
              <button className="tp-select-all-btn" onClick={selectedGroups.size === groupsForView.length ? clearAll : selectAll}>
                {selectedGroups.size === groupsForView.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="tp-delete-bar-right">
              <button className="tp-delete-cancel-btn" onClick={() => { setDeleteMode(false); setSelectedGroups(new Set()); }}>
                Cancel
              </button>
              <button className="tp-delete-exec-btn" disabled={selectedGroups.size === 0} onClick={() => setShowConfirm(true)}>
                🗑️ Delete ({selectedGroups.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ──────────────────────────────────────────
   StudentRoster – shows students of one group
   ────────────────────────────────────────── */
function StudentRoster({
  classData,
  classIdx,
  groupName,
  onBack,
  onAddStudent,
  onDeleteStudents,
  onUpdateStudent,
  teachers = [],
  timeSlots,         // <-- এই লাইনটি যোগ করুন
  onSaveTimeSlots,   // <-- এই লাইনটি যোগ করুন
  onAssignTeacher,
  onUpdateGroupSubjects,
  groupSubjects = [],
  onViewStudentProfile,
  isReadOnly = false,
  canModifyClass = true,
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignTeacherModal, setShowAssignTeacherModal] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [subjectDraft, setSubjectDraft] = useState('');
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: '', roll: '' });

  const classColor = CLASS_COLORS[(classData.classNum - 1) % CLASS_COLORS.length];
  const canManage = Boolean(canModifyClass);
  const students = Array.isArray(classData.students) ? classData.students : [];
  const savedSubjects = Array.isArray(groupSubjects) ? groupSubjects : [];
  const assignedTeachers = Array.isArray(classData.groupTeachers?.[groupName]) ? classData.groupTeachers[groupName] : [];
  const commonSubjects = ['Bangla', 'English', 'Math', 'Science', 'Social Science', 'Religion', 'ICT'];

  const toggleSelect = (studentId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(studentId) ? next.delete(studentId) : next.add(studentId);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(students.map((s) => s.id)));
  const clearAll = () => setSelectedIds(new Set());

  const handleDeleteConfirm = () => {
    onDeleteStudents?.(classIdx, [...selectedIds]);
    setSelectedIds(new Set());
    setDeleteMode(false);
    setShowConfirm(false);
  };

  const handleAddSubject = (subjectValue) => {
    const nextValue = String(subjectValue ?? subjectDraft ?? '').trim();
    if (!nextValue) return;
    const nextSubjects = Array.from(new Set([...savedSubjects, nextValue]));
    onUpdateGroupSubjects?.(classIdx, groupName, nextSubjects);
    setSubjectDraft('');
  };

  const handleRemoveSubject = (subject) => {
    const nextSubjects = savedSubjects.filter((item) => item !== subject);
    onUpdateGroupSubjects?.(classIdx, groupName, nextSubjects);
  };

  const openEditStudent = (student) => {
    setEditingStudent(student);
    setEditDraft({
      name: student?.name || '',
      roll: student?.roll || '',
      phone: student?.phone || '',
      fatherName: student?.fatherName || '',
      motherName: student?.motherName || '',
      dob: student?.dob || '',
      profilePic: student?.profilePic || '',
    });
  };

  const handleEditPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const optimized = await convertToWebP(file, { maxWidth: 300, maxHeight: 300, quality: 0.85 });
      setEditDraft(prev => ({ ...prev, profilePic: optimized.dataUrl }));
    } catch (err) {
      console.error('Photo optimization failed:', err);
      const reader = new FileReader();
      reader.onload = (ev) => setEditDraft(prev => ({ ...prev, profilePic: ev.target.result }));
      reader.readAsDataURL(file);
    }
  };

  const saveEditedStudent = (e) => {
    e.preventDefault();
    if (!editingStudent) return;
    onUpdateStudent?.(classIdx, {
      ...editingStudent,
      name: editDraft.name.trim(),
      roll: editDraft.roll.trim(),
      phone: editDraft.phone?.trim() || '',
      fatherName: editDraft.fatherName?.trim() || '',
      motherName: editDraft.motherName?.trim() || '',
      dob: editDraft.dob || '',
      profilePic: editDraft.profilePic || '',
    });
    setEditingStudent(null);
  };

  return (
    <>
      {!isReadOnly && canManage && showAddModal && (
        <AddStudentModal
          onClose={() => setShowAddModal(false)}
          onAdd={(student) => {
            onAddStudent?.(classIdx, student, groupName);
            setShowAddModal(false);
          }}
          existingRolls={students.map((s) => String(s.roll || '').trim())}
          classColor={classColor}
          groupName={groupName}
        />
      )}

      {!isReadOnly && canManage && showAssignTeacherModal && (
        <AssignTeacherModal
          onClose={() => setShowAssignTeacherModal(false)}
          teachers={teachers}
          assignedTeacherEmails={classData.groupTeachers?.[groupName] || []}
          groupSubjects={savedSubjects}
          onAssign={(teacherEmails) => {
            onAssignTeacher?.(classIdx, groupName, teacherEmails);
            setShowAssignTeacherModal(false);
          }}
          themeColor={classColor}
        />
      )}

      {!isReadOnly && editingStudent && (
        <div className="tp-modal-overlay" onClick={() => setEditingStudent(null)}>
          <div className="tp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tp-modal-header" style={{ borderBottomColor: classColor }}>
              <h3 className="tp-modal-title">✏️ Edit Student Details</h3>
              <button className="tp-modal-close" onClick={() => setEditingStudent(null)} aria-label="Close">✕</button>
            </div>
            <form className="tp-modal-body" onSubmit={saveEditedStudent}>
              {/* Photo Upload Section */}
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <label htmlFor="tp-student-edit-photo" style={{ cursor: 'pointer', display: 'inline-block' }}>
                  {editDraft.profilePic ? (
                    <div style={{ position: 'relative', width: 90, height: 90, borderRadius: 14, overflow: 'hidden', margin: '0 auto', border: `2px solid ${classColor}` }}>
                      <img src={editDraft.profilePic} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', bottom: 0, inset: 'auto 0 0 0', background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 9, fontWeight: 700, textAlign: 'center', padding: '2px 0' }}>
                        Change 300×300
                      </div>
                    </div>
                  ) : (
                    <div style={{ width: 90, height: 90, borderRadius: 14, border: `2px dashed ${classColor}`, background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                      <span style={{ fontSize: 22 }}>📸</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#334155' }}>Upload Photo</span>
                      <span style={{ fontSize: 8, color: '#64748b' }}>300 × 300 px</span>
                    </div>
                  )}
                </label>
                <input
                  id="tp-student-edit-photo"
                  type="file"
                  accept="image/*"
                  onChange={handleEditPhotoUpload}
                  style={{ display: 'none' }}
                />
              </div>

              <div className="tp-form-grid">
                <div className="tp-form-group tp-form-full">
                  <label className="tp-form-label">Student Name *</label>
                  <input className="tp-form-input" value={editDraft.name} onChange={(e) => setEditDraft(prev => ({ ...prev, name: e.target.value }))} required />
                </div>
                <div className="tp-form-group">
                  <label className="tp-form-label">Roll Number *</label>
                  <input className="tp-form-input" value={editDraft.roll} onChange={(e) => setEditDraft(prev => ({ ...prev, roll: e.target.value }))} required />
                </div>
                <div className="tp-form-group">
                  <label className="tp-form-label">Phone</label>
                  <input className="tp-form-input" value={editDraft.phone} onChange={(e) => setEditDraft(prev => ({ ...prev, phone: e.target.value }))} />
                </div>
                <div className="tp-form-group">
                  <label className="tp-form-label">Father's Name</label>
                  <input className="tp-form-input" value={editDraft.fatherName} onChange={(e) => setEditDraft(prev => ({ ...prev, fatherName: e.target.value }))} />
                </div>
                <div className="tp-form-group">
                  <label className="tp-form-label">Mother's Name</label>
                  <input className="tp-form-input" value={editDraft.motherName} onChange={(e) => setEditDraft(prev => ({ ...prev, motherName: e.target.value }))} />
                </div>
                <div className="tp-form-group tp-form-full">
                  <label className="tp-form-label">Date of Birth (Birthday)</label>
                  <input className="tp-form-input" type="date" value={editDraft.dob} onChange={(e) => setEditDraft(prev => ({ ...prev, dob: e.target.value }))} />
                </div>
              </div>
              <div className="tp-modal-footer">
                <button type="button" className="tp-modal-cancel-btn" onClick={() => setEditingStudent(null)}>Cancel</button>
                <button type="submit" className="tp-modal-submit-btn" style={{ background: classColor }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!isReadOnly && showConfirm && (
        <div className="tp-modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="tp-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="tp-confirm-icon">⚠️</div>
            <h3 className="tp-confirm-title">
              Delete {selectedIds.size} Student{selectedIds.size !== 1 ? 's' : ''}?
            </h3>
            <p className="tp-confirm-sub">
              This action cannot be undone. The selected student profile{selectedIds.size !== 1 ? 's' : ''} will be permanently removed.
            </p>
            <div className="tp-confirm-actions">
              <button className="tp-modal-cancel-btn" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="tp-delete-exec-btn" onClick={handleDeleteConfirm}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="tp-section-header">
        <button className="tp-back-btn" onClick={onBack} title="Back to Groups" aria-label="Back to Groups">
          <ChevronLeft />
        </button>
        <div className="tp-section-header-info">
          <div className="tp-breadcrumbs" aria-label="Breadcrumb">
            <button type="button" className="tp-crumb-link" onClick={onBack}>Groups</button>
            <span className="tp-crumb-separator">/</span>
            <span className="tp-crumb-current">{groupName}</span>
          </div>
          <h2 className="tp-section-title">{classData.className} — {groupName}</h2>
        </div>
      </div>

      <div className="tp-roster-toolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
        <span className="tp-roster-badge" style={{ flexShrink: 0 }}>🎓 {students.length} Students in {groupName}</span>
        {!isReadOnly && canManage && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="tp-add-student-btn" style={{ background: classColor, whiteSpace: 'nowrap' }} onClick={() => setShowAddModal(true)}>
              + Add Student
            </button>
            <button className="tp-add-student-btn" style={{ background: '#38b26e', whiteSpace: 'nowrap' }} onClick={() => setShowAssignTeacherModal(true)}>
              Assign Teacher
            </button>
          </div>
        )}
      </div>

      <div className="tp-detail-card" style={{ margin: '0 20px 16px', padding: '16px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1f2937' }}>📚 Group Subjects</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569', lineHeight: 1.4 }}>{isReadOnly ? `Subjects taught in ${groupName}.` : `Add subjects for ${groupName} and assign teachers by subject.`}</p>
          </div>
          <span className="tp-badge" style={{ background: '#dbeafe', color: '#1d4ed8', flexShrink: 0 }}>{savedSubjects.length} Subject{savedSubjects.length !== 1 ? 's' : ''}</span>
        </div>

        {!isReadOnly && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <input
              className="tp-form-input"
              value={subjectDraft}
              onChange={(e) => setSubjectDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSubject();
                }
              }}
              placeholder="Type subject name"
              style={{ flex: 1, minWidth: 220 }}
            />
            <button type="button" className="tp-add-student-btn" style={{ background: classColor, padding: '8px 12px' }} onClick={() => handleAddSubject()}>
              + Add Subject
            </button>
          </div>
        )}

        {!isReadOnly && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: savedSubjects.length > 0 ? 12 : 0 }}>
            {commonSubjects.filter((subject) => !savedSubjects.includes(subject)).map((subject) => (
              <button key={subject} type="button" className="tp-small-btn" style={{ borderColor: '#cbd5e1', color: '#334155', background: '#f8fafc' }} onClick={() => handleAddSubject(subject)}>
                + {subject}
              </button>
            ))}
          </div>
        )}

        {savedSubjects.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {savedSubjects.map((subject) => (
              <span key={subject} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: '#dcfce7', color: '#166534', fontSize: 12, fontWeight: 700 }}>
                {subject}
                {!isReadOnly && (
                  <button type="button" aria-label={`Remove ${subject}`} onClick={() => handleRemoveSubject(subject)} style={{ border: 0, background: 'transparent', color: '#166534', cursor: 'pointer', padding: 0, fontWeight: 900 }}>
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>No subjects added yet.</p>
        )}

        <div style={{ marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1f2937' }}>👩‍🏫 Assigned Teachers</p>
          {assignedTeachers.length > 0 ? (
            <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
              {assignedTeachers.map((teacher) => (
                <div key={`${teacher.email}-${teacher.subject}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{teachers.find((t) => t.email === teacher.email)?.name || teacher.email}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569' }}>{teacher.subject || 'Unassigned'}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#94a3b8' }}>No teachers assigned to this group yet.</p>
          )}
        </div>
      </div>

      {students.length === 0 ? (
        <div className="tp-roster-empty">
          <span>👥</span>
          <p>No students in {groupName} yet. Add the first student.</p>
        </div>
      ) : (
        <div className="tp-student-roster-grid">
          {students.map((student, index) => {
            const isMenuOpen = activeMenuId === String(student.id);
            return (
              <div key={student.id} className={`tp-student-roster-card${deleteMode && selectedIds.has(student.id) ? ' tp-card-selected' : ''}${deleteMode ? ' tp-card-selectable' : ''}`} onClick={deleteMode ? () => toggleSelect(student.id) : undefined} style={{ paddingRight: deleteMode ? 16 : 44, zIndex: isMenuOpen ? 300 : 'auto' }}>
                {deleteMode && (
                  <div className={`tp-roster-checkbox${selectedIds.has(student.id) ? ' tp-cb-checked' : ''}`}>
                    {selectedIds.has(student.id) ? '✓' : ''}
                  </div>
                )}

                {student.profilePic ? <img src={student.profilePic} alt={student.name} className="tp-roster-avatar-img" /> : <div className="tp-roster-avatar" style={{ background: classColor }}>{(student.name || 'S').charAt(0)}</div>}

                <div className="tp-roster-info">
                  <button type="button" className="tp-roster-name" onClick={(e) => { e.stopPropagation(); onViewStudentProfile?.(student); }} style={{ background: 'transparent', border: 'none', padding: 0, margin: 0, textAlign: 'left', cursor: 'pointer' }}>
                    {student.name}
                  </button>
                  <p className="tp-roster-id">ID: {student.id}</p>
                  <p className="tp-roster-roll">Roll No: {student.roll}</p>
                </div>

                {!isReadOnly && canManage && !deleteMode && (
                  <>
                    <button className="tp-roster-options-btn" type="button" onClick={(e) => { e.stopPropagation(); setActiveMenuId(isMenuOpen ? null : String(student.id)); }} aria-label="Options" style={{ zIndex: 210 }}>
                      ⋮
                    </button>
                    {isMenuOpen && (
                      <div className="tp-dropdown-menu" style={{ zIndex: 220 }} onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="tp-dropdown-item" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditStudent(student); setActiveMenuId(null); }}>
                          ✏️ Edit Details
                        </button>
                      </div>
                    )}
                  </>
                )}

                <span className="tp-roster-num">#{String(index + 1).padStart(2, '0')}</span>
              </div>
            );
          })}
        </div>
      )}

      {!isReadOnly && canManage && (
        <div className="tp-delete-section">
          {!deleteMode ? (
            <button className="tp-delete-toggle-btn" onClick={() => setDeleteMode(true)} disabled={students.length === 0}>
              🗑️ Select Students to Delete
            </button>
          ) : (
            <div className="tp-delete-bar">
              <div className="tp-delete-bar-left">
                <span className="tp-delete-count">{selectedIds.size} of {students.length} selected</span>
                <button className="tp-select-all-btn" onClick={selectedIds.size === students.length ? clearAll : selectAll}>
                  {selectedIds.size === students.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="tp-delete-bar-right">
                <button className="tp-delete-cancel-btn" onClick={() => { setDeleteMode(false); setSelectedIds(new Set()); }}>
                  Cancel
                </button>
                <button className="tp-delete-exec-btn" disabled={selectedIds.size === 0} onClick={() => setShowConfirm(true)}>
                  🗑️ Delete ({selectedIds.size})
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ──────────────────────────────────────────
   AddTeacherModal
   ────────────────────────────────────────── */
function AddTeacherModal({ onClose, onAdd, themeColor }) {
  const [form, setForm] = useState({ name: '', subject: '', qualification: '', specializedComment: '', email: '', phone: '' });
  const [profilePicPreview, setProfilePicPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const optimized = await convertToWebP(file, { maxWidth: 600, maxHeight: 600, quality: 0.8 });
      setProfilePicPreview(optimized.dataUrl);
    } catch (err) {
      console.error('WebP conversion failed, falling back:', err);
      const reader = new FileReader();
      reader.onload = (ev) => setProfilePicPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Full name is required';
    if (!form.subject.trim()) errs.subject = 'Subject is required';
    if (!form.email.trim()) {
      errs.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      errs.email = 'Valid email is required';
    }
    if (!form.phone.trim()) errs.phone = 'Phone number is required';
    return errs;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    onAdd({
      name: form.name.trim(),
      subject: form.subject.trim(),
      qualification: form.qualification.trim(),
      specializedComment: form.specializedComment.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      profilePic: profilePicPreview,
    });
  };

  return (
    <div className="tp-modal-overlay" onClick={onClose}>
      <div className="tp-modal" onClick={e => e.stopPropagation()}>
        <div className="tp-modal-header" style={{ borderBottomColor: themeColor }}>
          <h3 className="tp-modal-title">➕ Add New Teacher</h3>
          <button className="tp-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="tp-modal-body" onSubmit={handleSubmit}>
          {/* Profile Picture */}
          <div className="tp-pic-upload-area">
            <label htmlFor="tp-teacher-pic" className="tp-pic-label">
              {profilePicPreview
                ? <img src={profilePicPreview} alt="Preview" className="tp-pic-preview" />
                : <div className="tp-pic-placeholder" style={{ borderColor: themeColor }}>
                  <span className="tp-pic-icon">📷</span>
                  <p className="tp-pic-text">Upload Photo</p>
                  <p className="tp-pic-hint">Click to browse</p>
                </div>
              }
            </label>
            <input
              id="tp-teacher-pic"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>

          {/* Form fields */}
          <div className="tp-form-grid">
            <div className="tp-form-group tp-form-full">
              <label className="tp-form-label">Full Name *</label>
              <input
                className={`tp-form-input${errors.name ? ' tp-input-error' : ''}`}
                type="text" placeholder="e.g. Mrs. Sarah Jenkins"
                value={form.name} onChange={e => handleChange('name', e.target.value)}
              />
              {errors.name && <span className="tp-form-error">{errors.name}</span>}
            </div>

            <div className="tp-form-group">
              <label className="tp-form-label">Subject *</label>
              <input
                className={`tp-form-input${errors.subject ? ' tp-input-error' : ''}`}
                type="text" placeholder="e.g. Mathematics"
                value={form.subject} onChange={e => handleChange('subject', e.target.value)}
              />
              {errors.subject && <span className="tp-form-error">{errors.subject}</span>}
            </div>

            <div className="tp-form-group">
              <label className="tp-form-label">Last Educational Qualification <span style={{ fontWeight: 400, color: '#64748b', fontSize: 11.5 }}>(Optional)</span></label>
              <input
                className="tp-form-input"
                type="text" placeholder="e.g. B.Sc in Math, B.Ed / M.A in English"
                value={form.qualification} onChange={e => handleChange('qualification', e.target.value)}
              />
            </div>

            <div className="tp-form-group tp-form-full">
              <label className="tp-form-label">Specialized Comment <span style={{ fontWeight: 400, color: '#64748b', fontSize: 11.5 }}>(Optional)</span></label>
              <input
                className="tp-form-input"
                type="text" placeholder="e.g. Senior Class Co-ordinator, Olympiad Trainer, IT Specialist"
                value={form.specializedComment} onChange={e => handleChange('specializedComment', e.target.value)}
              />
            </div>

            <div className="tp-form-group">
              <label className="tp-form-label">Email Address *</label>
              <input
                className={`tp-form-input${errors.email ? ' tp-input-error' : ''}`}
                type="email" placeholder="e.g. s.jenkins@school.edu"
                value={form.email} onChange={e => handleChange('email', e.target.value)}
              />
              {errors.email && <span className="tp-form-error">{errors.email}</span>}
            </div>

            <div className="tp-form-group">
              <label className="tp-form-label">Phone Number *</label>
              <input
                className={`tp-form-input${errors.phone ? ' tp-input-error' : ''}`}
                type="text" placeholder="e.g. +1 (555) 019-2834"
                value={form.phone} onChange={e => handleChange('phone', e.target.value)}
              />
              {errors.phone && <span className="tp-form-error">{errors.phone}</span>}
            </div>
          </div>

          <div className="tp-modal-footer">
            <button type="button" className="tp-modal-cancel-btn" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="tp-modal-submit-btn"
              style={{ background: themeColor }}
              disabled={submitting}
            >
              {submitting ? 'Adding…' : 'Add Teacher'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AssignTeacherModal({ onClose, teachers, assignedTeacherEmails, groupSubjects = [], onAssign, themeColor }) {
  const groupSubjectOptions = Array.from(new Set((groupSubjects || []).filter(Boolean)));
  const teacherRows = (teachers || []).map((teacher, index) => ({
    ...teacher,
    rowId: `${teacher.email || teacher.name || 'teacher'}-${index}`,
  }));

  const [selectedTeachersById, setSelectedTeachersById] = useState(() => {
    const currentlyAssigned = Array.isArray(assignedTeacherEmails) ? assignedTeacherEmails : [];
    return currentlyAssigned
      .reduce((acc, item) => {
        let rowId;
        let email;
        let subject;

        if (typeof item === 'string') {
          rowId = item;
          email = item;
          const teacher = teacherRows.find((t) => t.email === item);
          subject = groupSubjectOptions[0] || teacher?.subject || '';
        } else {
          email = item?.email || '';
          if (!email) return acc;
          const teacher = teacherRows.find((t) => t.email === email);
          rowId = teacher?.rowId || `${item?.email || item?.name || 'teacher'}-assigned`;
          subject = item?.subject || groupSubjectOptions[0] || teacher?.subject || '';
        }

        if (rowId && email) {
          acc[rowId] = { rowId, email, subject };
        }
        return acc;
      }, {});
  });

  const toggleTeacher = (rowId, checked) => {
    setSelectedTeachersById((prev) => {
      if (checked) {
        const teacher = teacherRows.find((t) => t.rowId === rowId);
        if (!teacher?.email) return prev;
        return {
          ...prev,
          [rowId]: { rowId, email: teacher.email, subject: groupSubjectOptions[0] || teacher.subject || '' },
        };
      }
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  };

  const updateTeacherSubject = (rowId, subject) => {
    setSelectedTeachersById((prev) => {
      if (!prev[rowId]) return prev;
      return {
        ...prev,
        [rowId]: { ...prev[rowId], subject },
      };
    });
  };

  const getSelectedTeacher = (rowId) => selectedTeachersById[rowId];

  const handleSubmit = (e) => {
    e.preventDefault();
    onAssign(Object.values(selectedTeachersById).filter((item) => item.email));
  };

  return (
    <div className="tp-modal-overlay" onClick={onClose}>
      <div className="tp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tp-modal-header" style={{ borderBottomColor: themeColor }}>
          <h3 className="tp-modal-title">👩‍🏫 Assign Teachers by Subject</h3>
          <button className="tp-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="tp-modal-body" onSubmit={handleSubmit}>
          <div className="tp-form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="tp-form-group tp-form-full">
              <label className="tp-form-label">Select teachers one by one</label>
              <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
                {teacherRows.map((t) => {
                  const selectedTeacher = getSelectedTeacher(t.rowId);
                  const selected = Boolean(selectedTeacher);
                  const selectedValue = selectedTeacher?.subject || groupSubjectOptions[0] || '';

                  return (
                    <div
                      key={t.rowId}
                      style={{
                        display: 'grid',
                        gap: 8,
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: '1px solid #e2e8f0',
                        background: selected ? '#eff6ff' : '#fff',
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e) => toggleTeacher(t.rowId, e.target.checked)}
                          style={{ width: 16, height: 16, margin: 0 }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{t.name}</p>
                          <p style={{ margin: '3px 0 0', fontSize: 13, color: '#475569' }}>{t.subject}</p>
                        </div>
                      </label>

                      {selected && (
                        <div>
                          <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Subject for this teacher</label>
                          <select
                            value={selectedValue}
                            onChange={(e) => updateTeacherSubject(t.rowId, e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff' }}
                            disabled={groupSubjectOptions.length === 0}
                          >
                            {groupSubjectOptions.length > 0 ? (
                              groupSubjectOptions.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))
                            ) : (
                              <option value="">No subjects saved for this group</option>
                            )}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12, color: '#64748b', fontSize: 13 }}>
            Choose each teacher separately and assign a subject for this group.
          </div>

          <div className="tp-modal-footer">
            <button type="button" className="tp-modal-cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="tp-modal-submit-btn" style={{ background: themeColor }}>
              Save Assignment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────
   AddRoutineModal
   ────────────────────────────────────────── */
function AddRoutineModal({ onClose, onAdd, classColor, subjects = [], teacherOptions = [] }) {
  const subjectOptions = Array.from(new Set((subjects || []).filter(Boolean)));
  const [subject, setSubject] = useState(subjectOptions[0] || '');
  const [teacherName, setTeacherName] = useState(teacherOptions[0]?.name || '');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [error, setError] = useState('');

  const formatTime = (value) => {
    if (!value) return '';
    const [hourValue, minute] = value.split(':');
    const hour = Number(hourValue);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute} ${suffix}`;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!subject.trim()) { setError('Subject is required'); return; }
    if (!startTime || !endTime) { setError('Start and end time are required'); return; }
    onAdd({
      subject: subject.trim(),
      teacherName: teacherName.trim(),
      time: `${formatTime(startTime)} - ${formatTime(endTime)}`,
      startTime,
      endTime,
      startTimeLabel: formatTime(startTime),
      endTimeLabel: formatTime(endTime),
    });
  };

  return (
    <div className="tp-modal-overlay" onClick={onClose}>
      <div className="tp-modal" onClick={e => e.stopPropagation()}>
        <div className="tp-modal-header" style={{ borderBottomColor: classColor }}>
          <h3 className="tp-modal-title">➕ Add Subject Routine</h3>
          <button className="tp-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form className="tp-modal-body" onSubmit={handleSubmit}>
          <div className="tp-form-grid">
            <div className="tp-form-group">
              <label className="tp-form-label">Subject</label>
              <select
                className={`tp-form-input${error && !subject ? ' tp-input-error' : ''}`}
                value={subject}
                onChange={e => { setSubject(e.target.value); if (error) setError(''); }}
                disabled={subjectOptions.length === 0}
              >
                {subjectOptions.length > 0 ? (
                  subjectOptions.map((option) => <option key={option} value={option}>{option}</option>)
                ) : (
                  <option value="">No subjects added for this group</option>
                )}
              </select>
            </div>
            <div className="tp-form-group">
              <label className="tp-form-label">Teacher Name</label>
              <select className="tp-form-input" value={teacherName} onChange={e => setTeacherName(e.target.value)}>
                {teacherOptions.length > 0 ? (
                  teacherOptions.map((teacher) => <option key={teacher.email || teacher.name} value={teacher.name}>{teacher.name}</option>)
                ) : (
                  <option value="">No teacher assigned</option>
                )}
              </select>
            </div>
            <div className="tp-form-group">
              <label className="tp-form-label">Starting Time</label>
              <input className="tp-form-input" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div className="tp-form-group">
              <label className="tp-form-label">Ending Time</label>
              <input className="tp-form-input" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>
          {error && <div className="tp-form-error" style={{ marginTop: 8 }}>{error}</div>}
          <div className="tp-modal-footer">
            <button type="button" className="tp-modal-cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="tp-modal-submit-btn" style={{ background: classColor }} disabled={subjectOptions.length === 0}>Add Routine</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────
   RoutineGroupView
   ────────────────────────────────────────── */
const formatRoutineTime = (value) => {
  if (!value || !String(value).includes(':')) return '';
  const [hourValue, minute] = String(value).split(':');
  const hour = Number(hourValue);
  if (Number.isNaN(hour)) return '';
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
};

function RoutineGroupView({ classData, classIdx, groupName, onBack, onAddRoutine, onUpdateRoutine, onDeleteRoutine, currentTeacherEmail, teachers = [], isReadOnly = false }) {
  const classColor = CLASS_COLORS[(classData.classNum - 1) % CLASS_COLORS.length];
  const routines = classData.routines?.[groupName] || [];
  const storedSubjectMap = readStoredData(GROUP_SUBJECTS_STORAGE_KEY, {});
  const storedSubjects = storedSubjectMap?.[String(classData.classNum)]?.[groupName]
    || storedSubjectMap?.[String(classIdx)]?.[groupName]
    || [];
  const groupSubjects = Array.from(new Set([
    ...((classData.groupSubjects?.[groupName] || []).filter(Boolean)),
    ...((Array.isArray(storedSubjects) ? storedSubjects : []).filter(Boolean)),
  ]));
  const groupTeacherAssignments = classData.groupTeachers?.[groupName] || [];
  const teacherOptions = (teachers || []).map((t) => {
    return { email: t.email, name: t.name || t.email || 'Teacher', subject: t.subject || '' };
  }).filter((teacher) => teacher.name);
  const getAssignedTeacherName = (subject) => {
    const assignment = groupTeacherAssignments.find((item) => String(item?.subject || '').toLowerCase() === String(subject || '').toLowerCase());
    const email = typeof assignment === 'string' ? assignment : assignment?.email;
    const teacher = teachers.find((t) => t.email === email);
    return teacher?.name || email || '';
  };
  const subjectRoutineRows = groupSubjects.map((subject) => {
    const routineIndex = routines.findIndex((item) => String(item?.subject || '').toLowerCase() === String(subject).toLowerCase());
    const routine = routineIndex >= 0 ? routines[routineIndex] : {};
    return {
      ...routine,
      subject,
      teacherName: routine.teacherName || getAssignedTeacherName(subject),
      routineIndex,
    };
  });
  const extraRoutineRows = routines
    .map((routine, routineIndex) => ({ ...routine, routineIndex }))
    .filter((routine) => !groupSubjects.some((subject) => String(subject).toLowerCase() === String(routine?.subject || '').toLowerCase()));
  const routineRows = [...subjectRoutineRows, ...extraRoutineRows];
  const isHead = classData.groupHeadTeachers?.[groupName] === currentTeacherEmail;
  const canManageRoutine = !isReadOnly && (!currentTeacherEmail || isHead);
  const [showAdd, setShowAdd] = useState(false);
  const buildRoutineTimePatch = (routine, field, value) => {
    const nextStartTime = field === 'startTime' ? value : routine.startTime;
    const nextEndTime = field === 'endTime' ? value : routine.endTime;
    const nextStartLabel = formatRoutineTime(nextStartTime);
    const nextEndLabel = formatRoutineTime(nextEndTime);

    return {
      ...routine,
      [field]: value,
      startTime: nextStartTime,
      endTime: nextEndTime,
      startTimeLabel: nextStartLabel,
      endTimeLabel: nextEndLabel,
      time: nextStartLabel && nextEndLabel ? `${nextStartLabel} - ${nextEndLabel}` : routine.time,
    };
  };
  const saveRoutineTime = (routine, field, value) => {
    const { routineIndex, ...routineData } = buildRoutineTimePatch(routine, field, value);
    if (routineIndex >= 0) {
      onUpdateRoutine?.(classIdx, groupName, routineIndex, routineData);
      return;
    }
    onAddRoutine?.(classIdx, groupName, routineData);
  };
  const handlePrintRoutine = () => {
    window.print();
  };

  return (
    <div className="printable-area">
      {!isReadOnly && showAdd && (
        <AddRoutineModal
          onClose={() => setShowAdd(false)}
          onAdd={(item) => { onAddRoutine(classIdx, groupName, item); setShowAdd(false); }}
          classColor={classColor}
          subjects={groupSubjects}
          teacherOptions={teacherOptions}
        />
      )}

      {/* Printable Header (Visible during print) */}
      <div className="print-header" style={{ marginBottom: 14, borderBottom: '2px solid #000', paddingBottom: 8 }}>
        <div>
          <h1 className="print-institution-name" style={{ margin: 0, fontSize: '18pt', fontWeight: 900, color: '#000' }}>{activeSchoolName}</h1>
          {(schoolProfile?.location || window.localStorage.getItem('schoolLocation')) && (
            <p className="print-school-location" style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
              📍 {schoolProfile?.location || window.localStorage.getItem('schoolLocation')}
            </p>
          )}
          <h2 className="print-title" style={{ margin: '4px 0 0', fontSize: '14pt', fontWeight: 800, color: '#000' }}>{classData.className} — {groupName} Class Routine</h2>
        </div>
      </div>

      <div className="tp-section-header tp-print-hide">
        <button className="tp-back-btn" onClick={onBack} title="Back to Groups" aria-label="Back to Groups">
          <ChevronLeft />
        </button>
        <div className="tp-section-header-info">
          <div className="tp-breadcrumbs" aria-label="Breadcrumb">
            <button type="button" className="tp-crumb-link" onClick={onBack}>Routine</button>
            <span className="tp-crumb-separator">/</span>
            <span className="tp-crumb-current">{groupName}</span>
          </div>
          <h2 className="tp-section-title">{classData.className} — {groupName} Routine</h2>
        </div>
      </div>

      <div className="tp-print-hide" style={{ margin: '12px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ color: '#6b7280' }}>
          {routines.length} slot{routines.length !== 1 ? 's' : ''} · {groupSubjects.length} subject{groupSubjects.length !== 1 ? 's' : ''}
        </div>
        <button className="tp-add-student-btn tp-print-hide" style={{ background: classColor }} onClick={handlePrintRoutine}>Print / Save PDF</button>
      </div>

      <div className="tp-detail-card tp-print-hide" style={{ margin: '12px 20px 0', padding: '14px 16px' }}>
        <p style={{ margin: '0 0 8px', fontWeight: 700, color: '#1f2937' }}>Subjects from Student Info</p>
        {groupSubjects.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {groupSubjects.map((subject) => (
              <span key={subject} style={{ padding: '6px 10px', borderRadius: 999, background: '#dbeafe', color: '#1d4ed8', fontSize: 12, fontWeight: 700 }}>{subject}</span>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 13 }}>No subjects added yet. Add subjects in Student Info first.</p>
        )}
      </div>

      <div style={{ padding: '16px 20px' }}>
        {routineRows.length === 0 ? (
          <div className="tp-roster-empty"><span>📭</span><p>No routine subjects yet. Add subjects in Student Info first.</p></div>
        ) : (
          <div className="tp-table-container tp-detail-card tp-routine-print-area" style={{ overflowX: 'auto', padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '12px 14px', fontSize: 12, textTransform: 'uppercase' }}>Subject</th>
                  <th style={{ padding: '12px 14px', fontSize: 12, textTransform: 'uppercase' }}>Teacher Name</th>
                  <th style={{ padding: '12px 14px', fontSize: 12, textTransform: 'uppercase' }}>Starting Time</th>
                  <th style={{ padding: '12px 14px', fontSize: 12, textTransform: 'uppercase' }}>Ending Time</th>
                  <th className="tp-print-hide" style={{ padding: '12px 14px', fontSize: 12, textTransform: 'uppercase' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {routineRows.map((r, idx) => (
                  <tr key={`${r.subject}-${idx}`} style={{ borderTop: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#1f2937' }}>{r.subject}</td>
                    <td style={{ padding: '12px 14px', color: '#475569' }}>{r.teacherName || 'Unassigned'}</td>
                    <td style={{ padding: '12px 14px', color: '#475569' }}>
                      {canManageRoutine ? (
                        <input
                          type="time"
                          value={r.startTime || ''}
                          onChange={(e) => saveRoutineTime(r, 'startTime', e.target.value)}
                          style={{ width: '100%', minWidth: 120, padding: '8px 10px', borderRadius: 10, border: '1px solid #cbd5e1', color: '#334155' }}
                        />
                      ) : (
                        r.startTimeLabel || formatRoutineTime(r.startTime) || '-'
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#475569' }}>
                      {canManageRoutine ? (
                        <input
                          type="time"
                          value={r.endTime || ''}
                          onChange={(e) => saveRoutineTime(r, 'endTime', e.target.value)}
                          style={{ width: '100%', minWidth: 120, padding: '8px 10px', borderRadius: 10, border: '1px solid #cbd5e1', color: '#334155' }}
                        />
                      ) : (
                        r.endTimeLabel || formatRoutineTime(r.endTime) || '-'
                      )}
                    </td>
                    <td className="tp-print-hide" style={{ padding: '12px 14px' }}>
                      <button className="tp-add-student-btn" style={{ background: classColor, padding: '8px 12px', fontSize: 12 }} onClick={handlePrintRoutine}>Print / Save PDF</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


/* ──────────────────────────────────────────
   TeacherRoster – shows list of teachers + add + delete selection
   ────────────────────────────────────────── */
function TeacherRoster({ teachers, onAddTeacher, onDeleteTeachers, isReadOnly = false, teacherRoutines = {} }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [expandedRoutines, setExpandedRoutines] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTeachers = useMemo(() => {
    const list = Array.isArray(teachers) ? teachers : [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(t =>
      (t?.name || '').toLowerCase().includes(q) ||
      (t?.subject || '').toLowerCase().includes(q) ||
      (t?.email || '').toLowerCase().includes(q) ||
      (t?.phone || '').includes(q)
    );
  }, [teachers, searchQuery]);

  const toggleRoutine = (email) => {
    setExpandedRoutines(prev => ({ ...prev, [email]: !prev[email] }));
  };

  const themeColor = '#38b26e'; // Teacher section green

  const toggleSelect = (email) => {
    setSelectedEmails(prev => {
      const next = new Set(prev);
      next.has(email) ? next.delete(email) : next.add(email);
      return next;
    });
  };

  const selectAll = () => setSelectedEmails(new Set(teachers.map(t => t.email)));
  const clearAll = () => setSelectedEmails(new Set());

  const handleDeleteConfirm = () => {
    onDeleteTeachers([...selectedEmails]);
    setSelectedEmails(new Set());
    setDeleteMode(false);
    setShowConfirm(false);
  };

  const handleAddTeacher = (teacher) => {
    onAddTeacher(teacher);
    setShowAddModal(false);
  };

  return (
    <>
      {/* Add Modal */}
      {!isReadOnly && showAddModal && (
        <AddTeacherModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddTeacher}
          themeColor={themeColor}
        />
      )}

      {/* Delete Confirm Modal */}
      {!isReadOnly && showConfirm && (
        <div className="tp-modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="tp-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="tp-confirm-icon">⚠️</div>
            <h3 className="tp-confirm-title">
              Delete {selectedEmails.size} Teacher{selectedEmails.size !== 1 ? 's' : ''}?
            </h3>
            <p className="tp-confirm-sub">
              This action cannot be undone. The selected teacher profile{selectedEmails.size !== 1 ? 's' : ''} will be permanently removed.
            </p>
            <div className="tp-confirm-actions">
              <button className="tp-modal-cancel-btn" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="tp-delete-exec-btn" onClick={handleDeleteConfirm}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Header & Actions Toolbar */}
      <div className="tp-teachers-header-bar">
        <div className="tp-teachers-header-info">
          <h2 className="tp-teachers-title">
            <span>👨‍🏫</span>
            <span>Teachers Directory</span>
          </h2>
          <span className="tp-teachers-count-pill">
            {teachers.length} {teachers.length === 1 ? 'Teacher' : 'Teachers'}
          </span>
        </div>
        {!isReadOnly && (
          <div className="tp-teachers-header-actions">
            <button
              className="tp-teachers-add-btn"
              style={{ background: themeColor }}
              onClick={() => setShowAddModal(true)}
            >
              <span className="tp-add-icon">➕</span>
              <span>Add Teacher</span>
            </button>
          </div>
        )}
      </div>

      {/* Quick Search Bar */}
      {teachers.length > 0 && (
        <div className="tp-teachers-search-wrapper">
          <span className="tp-teachers-search-icon">🔍</span>
          <input
            type="text"
            className="tp-teachers-search-input"
            placeholder="Search by name, subject, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="tp-teachers-search-clear" onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>
      )}

      {/* Teacher Cards Grid */}
      {filteredTeachers.length === 0 ? (
        <div className="tp-teachers-empty-state">
          <div className="tp-empty-icon">👨‍🏫</div>
          <h3>{searchQuery ? 'No matching teachers found' : 'No teachers added yet'}</h3>
          <p>{searchQuery ? 'Try searching with a different keyword or name.' : 'Add the first faculty member to get started.'}</p>
          {!searchQuery && !isReadOnly && (
            <button className="tp-teachers-add-btn" onClick={() => setShowAddModal(true)}>
              + Add First Teacher
            </button>
          )}
        </div>
      ) : (
        <div className="tp-teacher-card-grid">
          {filteredTeachers.map((t) => {
            const isSelected = deleteMode && selectedEmails.has(t.email);
            return (
              <div
                key={t.email}
                className={`tp-teacher-card ${isSelected ? 'tp-card-selected' : ''}`}
                onClick={deleteMode ? () => toggleSelect(t.email) : undefined}
                style={{ cursor: deleteMode ? 'pointer' : 'default' }}
              >
                {deleteMode && (
                  <div className={`tp-teacher-checkbox ${isSelected ? 'tp-cb-checked' : ''}`}>
                    {isSelected ? '✓' : ''}
                  </div>
                )}

                <div className="tp-teacher-card-content">
                  {/* Header Row: Avatar, Identity & Quick Action Buttons */}
                  <div className="tp-teacher-card-header">
                    <div className="tp-teacher-avatar-wrap">
                      {t.profilePic ? (
                        <img src={t.profilePic} alt={t.name} className="tp-teacher-avatar-img" />
                      ) : (
                        <div className="tp-teacher-avatar-circle" style={{ background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)' }}>
                          {String(t?.name || 'T').replace(/^(Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.)\s+/i, '').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="tp-teacher-identity">
                      <h3 className="tp-teacher-name">{t.name}</h3>
                      {t.subject && (
                        <span className="tp-teacher-subject-badge">{t.subject}</span>
                      )}
                      {t.qualification && (
                        <span style={{ fontSize: 11, color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          🎓 {t.qualification}
                        </span>
                      )}
                    </div>

                    {!deleteMode && (t.phone || t.email) && (
                      <div className="tp-teacher-quick-actions" onClick={(e) => e.stopPropagation()}>
                        {t.phone && (
                          <a href={`tel:${t.phone}`} className="tp-quick-btn tp-quick-call" title="Call Teacher">
                            📞
                          </a>
                        )}
                        {t.email && (
                          <a href={`mailto:${t.email}`} className="tp-quick-btn tp-quick-mail" title="Send Email">
                            ✉️
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Contact Details & Assignments List */}
                  <div className="tp-teacher-contact-list">
                    {t.email && (
                      <a href={`mailto:${t.email}`} className="tp-contact-chip" onClick={(e) => e.stopPropagation()}>
                        <span className="tp-contact-icon">✉️</span>
                        <span className="tp-contact-text">{t.email}</span>
                      </a>
                    )}
                    {t.phone && (
                      <a href={`tel:${t.phone}`} className="tp-contact-chip" onClick={(e) => e.stopPropagation()}>
                        <span className="tp-contact-icon">📞</span>
                        <span className="tp-contact-text">{t.phone}</span>
                      </a>
                    )}

                    {/* Assignments */}
                    {Array.isArray(t.assignments) && t.assignments.length > 0 && (
                      <div style={{ marginTop: 6, borderTop: '1px solid #e2e8f0', paddingTop: 6 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', margin: '0 0 4px' }}>Assignments</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {t.assignments.slice(0, 3).map((assignment, idx) => (
                            <span key={`${assignment.className}-${assignment.groupName}-${idx}`} style={{ fontSize: 10.5, padding: '2px 6px', borderRadius: 6, background: '#eff6ff', color: '#1d4ed8', fontWeight: 600 }}>
                              {assignment.className} • {assignment.groupName}
                            </span>
                          ))}
                          {t.assignments.length > 3 && (
                            <span style={{ fontSize: 10.5, padding: '2px 6px', borderRadius: 6, background: '#f1f5f9', color: '#64748b' }}>
                              +{t.assignments.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Weekly Routine Accordion Button */}
                  <div style={{ marginTop: 4 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleRoutine(t.email); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: expandedRoutines[t.email] ? '#ecfdf5' : '#ffffff',
                        border: '1px solid ' + (expandedRoutines[t.email] ? '#a7f3d0' : '#e2e8f0'),
                        borderRadius: 10, padding: '6px 12px', cursor: 'pointer',
                        fontSize: 12, fontWeight: 700,
                        color: expandedRoutines[t.email] ? '#047857' : '#475569',
                        width: '100%', justifyContent: 'space-between',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>📅 Weekly Routine</span>
                      <span style={{ fontSize: 10 }}>{expandedRoutines[t.email] ? '▲ Hide' : '▼ Show'}</span>
                    </button>

                    {expandedRoutines[t.email] && (
                      <div style={{ marginTop: 8 }}>
                        <TeacherRoutineReadOnly
                          teacherName={t.name}
                          routine={teacherRoutines[t.name] || {}}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete bar */}
      {!isReadOnly && <div className="tp-delete-section">
        {!deleteMode ? (
          <button
            className="tp-delete-toggle-btn"
            onClick={() => setDeleteMode(true)}
            disabled={teachers.length === 0}
          >
            🗑️ Select Teachers to Delete
          </button>
        ) : (
          <div className="tp-delete-bar">
            <div className="tp-delete-bar-left">
              <span className="tp-delete-count">
                {selectedEmails.size} of {teachers.length} selected
              </span>
              <button className="tp-select-all-btn" onClick={selectedEmails.size === teachers.length ? clearAll : selectAll}>
                {selectedEmails.size === teachers.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="tp-delete-bar-right">
              <button
                className="tp-delete-cancel-btn"
                onClick={() => { setDeleteMode(false); setSelectedEmails(new Set()); }}
              >
                Cancel
              </button>
              <button
                className="tp-delete-exec-btn"
                disabled={selectedEmails.size === 0}
                onClick={() => setShowConfirm(true)}
              >
                🗑️ Delete ({selectedEmails.size})
              </button>
            </div>
          </div>
        )}
      </div>}
    </>
  );
}

/* ──────────────────────────────────────────
   Detail Content
   ────────────────────────────────────────── */
function DetailContent({
  section,
  selectedClass,
  onSelectClass,
  onBackFromClass,
  selectedBranchKey = null,
  onSelectBranchKey,
  classes,
  onAddStudent,
  onDeleteStudents,
  teachers,
  onAddTeacher,
  onDeleteTeachers,
  onAddClass,
  onDeleteClasses,
  selectedGroup,
  onSelectGroup,
  onBackFromGroup,
  onAddGroup,
  onDeleteGroups,
  onUpdateStudent,
  onAssignTeacher,
  onAssignGroupHeadTeacher,
  onUpdateGroupSubjects,
  selectedRoutineClass,
  onSelectRoutineClass,
  onBackFromRoutineClass,
  selectedRoutineGroup,
  onSelectRoutineGroup,
  onBackFromRoutineGroup,
  onAddRoutine,
  onUpdateRoutine,
  onDeleteRoutine,
  currentTeacherEmail,
  currentTeacherProfile = null,
  teacherAssignments = [],
  isTeacherRole = false,
  isReadOnly = false,
  onViewStudentProfile,
  teacherRoutines = {},
  onSaveTeacherRoutine,
  onSaveClassRoutine,
  timeSlots = [],
  onSaveTimeSlots,
}) {
  const { user } = useAuth();
  const { schoolProfile } = useSchoolProfile();
  const activeSchoolId = schoolProfile?.schoolId || schoolProfile?.schoolCode || schoolProfile?.eiinNumber || getActiveSchoolId();
  const teacherBranch = currentTeacherProfile?.branch || user?.branch || null;

  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [classDeleteMode, setClassDeleteMode] = useState(false);
  const [selectedClassIndices, setSelectedClassIndices] = useState(new Set());
  const [showClassDeleteConfirm, setShowClassDeleteConfirm] = useState(false);
  const isClassTeacherAccess = !isReadOnly && isTeacherRole && teacherAssignments.some((assignment) => assignment?.scope === 'classTeacher');
  const shouldRestrictToAssignedClasses = isTeacherRole && teacherAssignments.length > 0;
  // Build a set of all class indices the class teacher can modify
  const classTeacherAllowedIdxSet = new Set(
    teacherAssignments
      .filter((a) => a?.scope === 'classTeacher')
      .map((a) => Number(a?.classIdx))
      .filter((n) => !Number.isNaN(n))
  );
  const canModifyClass = (classIdx) => !isReadOnly && (!isClassTeacherAccess || classTeacherAllowedIdxSet.has(Number(classIdx)));

  // Filter classes strictly school-wise and by teacher branch
  const schoolFilteredClasses = filterAndBindClasses(classes, schoolProfile, activeSchoolId);

  const visibleClassEntries = schoolFilteredClasses.filter((cls, idx) => {
    if (teacherBranch && teacherBranch !== 'all') {
      const clsBranch = cls.branch || getBranchKeyByClass(cls.className);
      if (clsBranch && clsBranch !== teacherBranch) return false;
    }
    if (shouldRestrictToAssignedClasses) {
      const assignedToThisClass = teacherAssignments.some((assignment) => {
        const assignedClassIdx = Number(assignment?.classIdx);
        return (!Number.isNaN(assignedClassIdx) && assignedClassIdx === idx) || assignment?.className === cls.className;
      });
      if (!assignedToThisClass) return false;
    }
    return true;
  });

  const visibleClassIndices = schoolFilteredClasses.reduce((acc, cls, idx) => {
    if (teacherBranch && teacherBranch !== 'all') {
      const clsBranch = cls.branch || getBranchKeyByClass(cls.className);
      if (clsBranch && clsBranch !== teacherBranch) return acc;
    }
    if (shouldRestrictToAssignedClasses) {
      const assignedToThisClass = teacherAssignments.some((assignment) => {
        const assignedClassIdx = Number(assignment?.classIdx);
        return (!Number.isNaN(assignedClassIdx) && assignedClassIdx === idx) || assignment?.className === cls.className;
      });
      if (!assignedToThisClass) return acc;
    }
    acc.push(idx);
    return acc;
  }, []);

  const toggleClassSelect = (classIdx) => {
    setSelectedClassIndices(prev => {
      const next = new Set(prev);
      next.has(classIdx) ? next.delete(classIdx) : next.add(classIdx);
      return next;
    });
  };

  const selectAllClasses = () => setSelectedClassIndices(new Set(visibleClassIndices));
  const clearSelectedClasses = () => setSelectedClassIndices(new Set());

  const cancelClassDelete = () => {
    setClassDeleteMode(false);
    clearSelectedClasses();
  };

  const confirmClassDelete = () => {
    onDeleteClasses?.([...selectedClassIndices]);
    setShowClassDeleteConfirm(false);
    cancelClassDelete();
  };

  /* ── STUDENTS: multi-level navigation (school branch → class list → group → roster) ── */
  if (section === 'students') {
    if (selectedClass !== null) {
      if (selectedGroup !== null) {
        const currentClass = classes[selectedClass];
        const visibleGroups = shouldRestrictToAssignedClasses && !isClassTeacherAccess
          ? (currentClass?.groups || []).filter((group) => teacherAssignments.some((assignment) => assignment?.className === currentClass?.className && assignment?.groupName === group))
          : (currentClass?.groups || []);
        const currentGroup = visibleGroups?.[selectedGroup] || currentClass?.groups?.[0] || null;

        if (!currentGroup) {
          return (
            <div className="tp-roster-empty" style={{ margin: 20 }}>
              <span>🗂️</span>
              <p>No accessible group is available for this class right now.</p>
            </div>
          );
        }

        const filteredClassData = {
          ...currentClass,
          students: (currentClass?.students || []).filter(s => s.group === currentGroup)
        };
        return (
          <StudentRoster
            classData={filteredClassData}
            classIdx={selectedClass}
            groupName={currentGroup}
            onBack={onBackFromGroup}
            onAddStudent={(classIdx, student) => onAddStudent(classIdx, student, currentGroup)}
            onDeleteStudents={onDeleteStudents}
            onUpdateStudent={onUpdateStudent}
            teachers={teachers}
            onAssignTeacher={onAssignTeacher}
            onUpdateGroupSubjects={onUpdateGroupSubjects}
            groupSubjects={classes[selectedClass].groupSubjects?.[currentGroup] || []}
            onViewStudentProfile={onViewStudentProfile}
            isReadOnly={isReadOnly}
            canModifyClass={canModifyClass(selectedClass)}
          />
        );
      }
      return (
        <GroupRoster
          classData={classes[selectedClass]}
          classIdx={selectedClass}
          onBack={onBackFromClass}
          onSelectGroup={onSelectGroup}
          onAddGroup={onAddGroup}
          onDeleteGroups={onDeleteGroups}
          visibleGroups={shouldRestrictToAssignedClasses && !isClassTeacherAccess
            ? (classes[selectedClass]?.groups || []).filter((group) => teacherAssignments.some((assignment) => assignment?.className === classes[selectedClass]?.className && assignment?.groupName === group))
            : (classes[selectedClass]?.groups || [])}
          isReadOnly={isReadOnly}
          canModifyClass={canModifyClass(selectedClass)}
        />
      );
    }

    const BRANCH_ORDER = getActiveBranchKeys(schoolProfile);
    const resolvedBranches = getResolvedBranches(schoolProfile);

    /* ── Level 1: Institutional School Branch Directory ── */
    if (selectedBranchKey === null) {
      return (
        <div className="tp-student-info-shell">
          <div className="tp-branch-dir-header">
            <div className="tp-branch-dir-info">
              <span className="tp-dir-badge">
                <span className="tp-badge-dot" />
                STUDENT DIRECTORY
              </span>
              <h2 className="tp-dir-title">Institutional School Branches</h2>
              <p className="tp-dir-subtitle">Select a school branch to view and manage its class roster & student records.</p>
            </div>
            <div className="tp-dir-total-pill">
              {BRANCH_ORDER.length} Branches Active
            </div>
          </div>

          <div className="tp-branch-grid">
            {BRANCH_ORDER.map((branchKey) => {
              const branch = resolvedBranches[branchKey] || SCHOOL_BRANCHES[branchKey];
              const branchClasses = filterClassesByBranch(visibleClassEntries, branchKey);
              const totalStudents = branchClasses.reduce((acc, c) => acc + (c.students?.length || 0), 0);

              return (
                <button
                  type="button"
                  key={branchKey}
                  className="tp-branch-card"
                  onClick={() => onSelectBranchKey?.(branchKey)}
                >
                  <div
                    className="tp-branch-icon-box"
                    style={{
                      background: `linear-gradient(135deg, ${branch.gradientFrom || '#3b82f6'}, ${branch.gradientTo || '#1d4ed8'})`,
                      boxShadow: `0 8px 18px ${branch.color || 'rgba(37, 99, 235, 0.3)'}`
                    }}
                  >
                    <span>{branch.emoji || '🏫'}</span>
                  </div>
                  <div className="tp-branch-content">
                    <h3 className="tp-branch-name">
                      {branch.name}
                    </h3>
                    <div className="tp-branch-meta-row">
                      <span className="tp-branch-badge-pill pill-blue">
                        📚 {branchClasses.length} Class{branchClasses.length !== 1 ? 'es' : ''}
                      </span>
                      <span className="tp-branch-badge-pill pill-emerald">
                        👨‍🎓 {totalStudents} Student{totalStudents !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="tp-branch-chevron">
                    <ChevronRight />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    /* ── Level 2: Classes within Selected Branch ── */
    const branch = resolvedBranches[selectedBranchKey] || SCHOOL_BRANCHES[selectedBranchKey];
    const branchClasses = filterClassesByBranch(visibleClassEntries, selectedBranchKey);
    const totalBranchStudents = branchClasses.reduce((acc, c) => acc + (c.students?.length || 0), 0);

    return (
      <>
        <div className="tp-section-header" style={{ marginBottom: 20, padding: 0 }}>
          <button
            className="tp-back-btn"
            onClick={() => { onSelectBranchKey?.(null); setClassDeleteMode(false); setSelectedClassIndices(new Set()); }}
            title="Back to School Branches"
            aria-label="Back to School Branches"
          >
            <ChevronLeft />
          </button>
          <div className="tp-section-header-info">
            <div className="tp-breadcrumbs" aria-label="Breadcrumb">
              <button type="button" className="tp-crumb-link" onClick={() => { onSelectBranchKey?.(null); setClassDeleteMode(false); setSelectedClassIndices(new Set()); }}>Student Info</button>
              <span className="tp-crumb-separator">/</span>
              <span className="tp-crumb-current">{branch.name}</span>
            </div>
            <h3 className="tp-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{branch.emoji}</span> {branch.name} Classes
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b', fontWeight: 500 }}>
              {branchClasses.length} Class{branchClasses.length !== 1 ? 'es' : ''} · {totalBranchStudents} Enrolled Student{totalBranchStudents !== 1 ? 's' : ''}
            </p>
          </div>

          {user?.role === 'admin' && !isReadOnly && !classDeleteMode && !shouldRestrictToAssignedClasses && (
            <button
              className="tp-modal-submit-btn"
              onClick={() => setShowAddClassModal(true)}
              style={{ marginLeft: 'auto', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, border: 'none', color: '#fff', cursor: 'pointer' }}
            >
              + Add Class to {branch.shortName}
            </button>
          )}
        </div>

        {showClassDeleteConfirm && (
          <div className="tp-modal-overlay" onClick={() => setShowClassDeleteConfirm(false)}>
            <div className="tp-confirm-modal" onClick={e => e.stopPropagation()}>
              <div className="tp-confirm-icon">⚠️</div>
              <h3 className="tp-confirm-title">
                Delete {selectedClassIndices.size} Class{selectedClassIndices.size !== 1 ? 'es' : ''}?
              </h3>
              <p className="tp-confirm-sub">
                This action cannot be undone. All groups, students, subjects, and routines in the selected class{selectedClassIndices.size !== 1 ? 'es' : ''} will be permanently removed.
              </p>
              <div className="tp-confirm-actions">
                <button className="tp-modal-cancel-btn" onClick={() => setShowClassDeleteConfirm(false)}>Cancel</button>
                <button className="tp-delete-exec-btn" onClick={confirmClassDelete}>Yes, Delete</button>
              </div>
            </div>
          </div>
        )}

        {showAddClassModal && (
          <AddClassModal
            initialBranchKey={selectedBranchKey || 'primary'}
            onClose={() => setShowAddClassModal(false)}
            onAdd={async (className, explicitBranch) => {
              await onAddClass(className, explicitBranch);
              setShowAddClassModal(false);
            }}
          />
        )}

        {branchClasses.length === 0 ? (
          <div style={{ background: '#f8fafc', padding: '36px', borderRadius: 14, border: '1.5px dashed #cbd5e1', textAlign: 'center' }}>
            <span style={{ fontSize: 40, display: 'block', marginBottom: 8 }}>🏫</span>
            <h4 style={{ margin: '0 0 4px', fontSize: 16, color: '#475569', fontWeight: 700 }}>No Classes Registered in {branch.name}</h4>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Click "+ Add Class to {branch.shortName}" above to create a class in this branch.</p>
          </div>
        ) : (
          <div className="tp-class-grid">
            {branchClasses.map((cls) => {
              const actualIdx = classes.findIndex((c) => c.className === cls.className);
              const colorIdx = actualIdx >= 0 ? actualIdx : 0;
              return (
                <button
                  key={cls.className}
                  className={`tp-class-card${classDeleteMode && selectedClassIndices.has(actualIdx) ? ' tp-card-selected' : ''}${classDeleteMode ? ' tp-card-selectable' : ''}`}
                  onClick={classDeleteMode ? () => toggleClassSelect(actualIdx) : () => onSelectClass(actualIdx)}
                  style={{ '--cls-color': CLASS_COLORS[colorIdx % CLASS_COLORS.length], position: 'relative' }}
                >
                  {classDeleteMode && (
                    <div className={`tp-roster-checkbox${selectedClassIndices.has(actualIdx) ? ' tp-cb-checked' : ''}`} style={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}>
                      {selectedClassIndices.has(actualIdx) ? '✓' : ''}
                    </div>
                  )}
                  <div className="tp-class-card-num" style={{ background: CLASS_COLORS[colorIdx % CLASS_COLORS.length] }}>
                    {getClassAbbrev(cls, colorIdx)}
                  </div>
                  <div className="tp-class-card-body">
                    <p className="tp-class-card-title">{cls.className}</p>
                    <p className="tp-class-card-count">{(cls.students || []).length} Students</p>
                  </div>
                  {!classDeleteMode && <div className="tp-class-card-arrow"><ChevronRight /></div>}
                </button>
              );
            })}
          </div>
        )}

        {user?.role === 'admin' && !isReadOnly && !shouldRestrictToAssignedClasses && branchClasses.length > 0 && (
          <div className="tp-delete-section" style={{ marginTop: 24 }}>
            {!classDeleteMode ? (
              <button
                className="tp-delete-toggle-btn"
                onClick={() => setClassDeleteMode(true)}
                disabled={branchClasses.length === 0}
              >
                🗑️ Select Classes to Delete
              </button>
            ) : (
              <div className="tp-delete-bar">
                <div className="tp-delete-bar-left">
                  <span className="tp-delete-count">
                    {selectedClassIndices.size} of {branchClasses.length} selected
                  </span>
                  <button className="tp-select-all-btn" onClick={selectedClassIndices.size === branchClasses.length ? clearSelectedClasses : selectAllClasses}>
                    {selectedClassIndices.size === branchClasses.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="tp-delete-bar-right">
                  <button className="tp-delete-cancel-btn" onClick={cancelClassDelete}>
                    Cancel
                  </button>
                  <button
                    className="tp-delete-exec-btn"
                    disabled={selectedClassIndices.size === 0}
                    onClick={() => setShowClassDeleteConfirm(true)}
                  >
                    🗑️ Delete ({selectedClassIndices.size})
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  if (section === 'teachers') return (
    <TeacherRoster
      teachers={teachers}
      onAddTeacher={onAddTeacher}
      onDeleteTeachers={onDeleteTeachers}
      isReadOnly={isReadOnly}
      teacherRoutines={teacherRoutines}
    />
  );

  if (section === 'exam') return (
    <SectionErrorBoundary sectionName="Exam Results">
      <ExamResultView classes={visibleClassEntries} readOnly={isReadOnly} />
    </SectionErrorBoundary>
  );

  if (section === 'result-entry') return (
    <SectionErrorBoundary sectionName="Result Entry">
      <ResultEntry classes={visibleClassEntries} currentTeacherProfile={currentTeacherProfile} currentTeacherAssignments={teacherAssignments} readOnly={isReadOnly} />
    </SectionErrorBoundary>
  );

  if (section === 'routine') {
    // ✅ Ensure timeSlots is always an array
    const safeTimeSlots = Array.isArray(timeSlots) && timeSlots.length > 0
      ? timeSlots
      : ["৯:০০-९:५०", "९:५०-१०:३५", "१०:३५-११:२०", "११:२०-१२:०५", "१२:०५-१२:५०", "१:३०-২:১০", "২:১০-২:৫০"];

    return (
      <SectionErrorBoundary sectionName="School Routine">
        <SchoolRoutineManager
          classes={classes}
          teachers={teachers}
          teacherRoutines={teacherRoutines}
          onSaveTeacherRoutine={onSaveTeacherRoutine}
          onSaveClassRoutine={onSaveClassRoutine}
          readOnly={isReadOnly}
          timeSlots={safeTimeSlots}
          onSaveTimeSlots={onSaveTimeSlots}
        />
      </SectionErrorBoundary>
    );
  }

  if (section === 'fees') return (
    <SectionErrorBoundary sectionName="Fee Management">
      <FeeManagementSystem userRole={isReadOnly ? 'guest' : isTeacherRole ? 'teacher' : 'admin'} />
    </SectionErrorBoundary>
  );

  return null;
}

/* ══════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════ */
export default function TeacherPanel() {
  const { user, signOut } = useAuth();
  const { showAlert } = useAlert();
  const { effectiveUser } = useViewMode();
  const activeUser = effectiveUser || user;
  const { schoolProfile } = useSchoolProfile();
  const activeSchoolId = schoolProfile?.schoolId || schoolProfile?.schoolCode || schoolProfile?.eiinNumber || getActiveSchoolId();
  const [activeNav, setActiveNav] = useState('home');
  const [activeSection, setActiveSection] = useState(null);
  const [selectedProfileView, setSelectedProfileView] = useState(null);
  const [selectedBranchKey, setSelectedBranchKey] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedRoutineClass, setSelectedRoutineClass] = useState(null);
  const [selectedRoutineGroup, setSelectedRoutineGroup] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hasLoadedRemoteData, setHasLoadedRemoteData] = useState(false);

  /* Stateful class roster — loaded from localStorage or Firestore.
   * DO NOT fall back to classSections default data here — that placeholder data
   * would overwrite real school classes in Firestore during the loading window. */
  const [classes, setClasses] = useState(() => {
    const storedClasses = readStoredData(CLASSES_STORAGE_KEY, null, activeSchoolId);
    if (Array.isArray(storedClasses) && storedClasses.length > 0) {
      return filterAndBindClasses(storedClasses, schoolProfile, activeSchoolId);
    }
    return [];
  });

  /* Stateful teacher roster — supports add & delete */
  const [teachers, setTeachers] = useState(() => {
    const storedTeachers = readStoredData(TEACHERS_STORAGE_KEY, null, activeSchoolId);
    if (Array.isArray(storedTeachers)) return storedTeachers;
    return teacherProfiles.map(t => ({ ...t }));
  });

  /* Stateful teacher routines — keyed by teacher name */
  const [teacherRoutines, setTeacherRoutines] = useState(() =>
    readStoredData(TEACHER_ROUTINES_STORAGE_KEY, {}, activeSchoolId)
  );

  const [timeSlots, setTimeSlots] = useState(() =>
    readStoredData(ROUTINE_TIME_SLOTS_STORAGE_KEY, [
      "৯:০০-৯:৫০", "৯:৫০-১০:৩৫", "১০:৩৫-১১:২০",
      "১১:২০-১২:০৫", "১২:০৫-১২:৫০", "১:৩০-২:১০", "২:১০-২:৫০"
    ])
  );

  const isRemoteUpdate = useRef(false);
  const skipSyncRef = useRef(false);

  useEffect(() => {
    let active = true;
    setHasLoadedRemoteData(false);

    const cachedClasses = readStoredData(CLASSES_STORAGE_KEY, null, activeSchoolId);
    const cachedTeachers = readStoredData(TEACHERS_STORAGE_KEY, null, activeSchoolId);
    if (cachedClasses) setClasses(filterAndBindClasses(cachedClasses, schoolProfile, activeSchoolId));
    if (cachedTeachers) setTeachers(cachedTeachers);

    const unsubscribe = subscribeToTeacherPanelData((docSnap) => {
      if (!active) return;
      if (docSnap && docSnap.exists()) {
        const remoteData = docSnap.data();
        isRemoteUpdate.current = true;

        if (Array.isArray(remoteData?.classes)) {
          const filteredClasses = filterAndBindClasses(remoteData.classes, schoolProfile, activeSchoolId);
          setClasses(filteredClasses);
          writeStoredData(CLASSES_STORAGE_KEY, filteredClasses, activeSchoolId);
        }

        if (Array.isArray(remoteData?.teachers)) {
          setTeachers(remoteData.teachers);
          writeStoredData(TEACHERS_STORAGE_KEY, remoteData.teachers, activeSchoolId);
        }

        if (remoteData?.teacherRoutines && typeof remoteData.teacherRoutines === 'object') {
          setTeacherRoutines(remoteData.teacherRoutines);
          writeStoredData(TEACHER_ROUTINES_STORAGE_KEY, remoteData.teacherRoutines, activeSchoolId);
        }

        if (Array.isArray(remoteData?.timeSlots)) {
          setTimeSlots(remoteData.timeSlots);
          writeStoredData(ROUTINE_TIME_SLOTS_STORAGE_KEY, remoteData.timeSlots, activeSchoolId);
        }
      }
      setHasLoadedRemoteData(true);
    }, (err) => {
      console.warn('Could not load teacher panel data from Firestore. Using local cache.', err);
      setHasLoadedRemoteData(true);
    }, activeSchoolId);

    return () => {
      active = false;
      unsubscribe();
    };
  }, [activeSchoolId]);

  useEffect(() => {
    writeStoredData(CLASSES_STORAGE_KEY, classes, activeSchoolId);
    // also persist groupSubjects separately for quick recovery
    try {
      const groupSubjectsMap = classes.reduce((acc, cls) => {
        const idx = cls.classNum || classes.indexOf(cls);
        if (cls.groupSubjects && Object.keys(cls.groupSubjects).length > 0) {
          acc[String(idx)] = cls.groupSubjects;
        }
        return acc;
      }, {});
      writeStoredData(GROUP_SUBJECTS_STORAGE_KEY, groupSubjectsMap, activeSchoolId);
    } catch (e) {
      // ignore
    }
  }, [classes, activeSchoolId]);

  useEffect(() => {
    writeStoredData(TEACHERS_STORAGE_KEY, teachers, activeSchoolId);
  }, [teachers, activeSchoolId]);

  useEffect(() => {
    writeStoredData(TEACHER_ROUTINES_STORAGE_KEY, teacherRoutines, activeSchoolId);
  }, [teacherRoutines, activeSchoolId]);

  useEffect(() => {
    writeStoredData(ROUTINE_TIME_SLOTS_STORAGE_KEY, timeSlots, activeSchoolId);
  }, [timeSlots, activeSchoolId]);

  useEffect(() => {
    if (!hasLoadedRemoteData) return;
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }
    // Guard: never auto-save an empty state to Firestore — it would wipe real data.
    if (classes.length === 0 && teachers.length === 0) return;

    saveTeacherPanelDataToFirestore({ classes, teachers, teacherRoutines, timeSlots }, activeSchoolId).catch((err) => {
      console.warn('Could not save teacher panel data to Firestore. Local cache was updated.', err);
    });
  }, [classes, teachers, teacherRoutines, timeSlots, hasLoadedRemoteData, activeSchoolId]);

  useEffect(() => {
    let active = true;

    const syncGroupSubjects = async () => {
      const remoteSubjects = await loadGroupSubjectsFromFirestore();
      if (!active || !remoteSubjects || Object.keys(remoteSubjects).length === 0) return;

      skipSyncRef.current = true;
      setClasses(prev => prev.map((cls, idx) => {
        const mergedGroupSubjects = { ...(cls.groupSubjects || {}) };
        Object.values(remoteSubjects).forEach((entry) => {
          if (Number(entry?.classIdx) !== idx) return;
          if (!entry?.groupName) return;
          mergedGroupSubjects[entry.groupName] = Array.isArray(entry.subjects) ? entry.subjects : [];
        });
        return { ...cls, groupSubjects: mergedGroupSubjects };
      }));
    };
    // First, merge any locally stored group subjects (from previous session)
    try {
      const localMap = readStoredData(GROUP_SUBJECTS_STORAGE_KEY, null);
      if (localMap && typeof localMap === 'object') {
        skipSyncRef.current = true;
        setClasses(prev => prev.map((cls, idx) => {
          const localEntry = localMap[String(cls.classNum)] || localMap[String(idx)];
          if (!localEntry) return cls;
          return { ...cls, groupSubjects: { ...(cls.groupSubjects || {}), ...localEntry } };
        }));
      }
    } catch (e) {
      // ignore
    }

    syncGroupSubjects();
    return () => { active = false; };
  }, []);

  const handleAddTeacher = (newTeacher) => {
    if (isReadOnly) return;
    setTeachers(prev => [...prev, { ...newTeacher, assignments: Array.isArray(newTeacher?.assignments) ? newTeacher.assignments : [] }]);
  };

  const handleSaveTeacherRoutine = (teacherName, routine) => {
    setTeacherRoutines(prev => ({ ...prev, [teacherName]: routine }));
  };

  const handleSaveClassRoutine = (classId, groupId, updatedRoutine) => {
    let finalGroupId = groupId;
    let finalRoutine = updatedRoutine;
    if (updatedRoutine === undefined && typeof groupId === 'object') {
      finalRoutine = groupId;
      finalGroupId = null;
    }

    setClasses(prev => (prev || []).map((cls) => {
      const currentId = String(cls.id || cls.classId || cls.className || cls.name);
      if (currentId === String(classId)) {
        if (!finalGroupId) {
          return { ...cls, gridRoutine: finalRoutine };
        }
        const rawGroups = Array.isArray(cls.groups) ? cls.groups : [];
        let matched = false;
        const updatedGroups = rawGroups.map((g) => {
          const gId = String(g.id || g.name);
          if (gId === String(finalGroupId) || String(g.name) === String(finalGroupId)) {
            matched = true;
            return { ...g, gridRoutine: finalRoutine };
          }
          return g;
        });
        if (!matched && rawGroups.length > 0) {
          updatedGroups[0] = { ...updatedGroups[0], gridRoutine: finalRoutine };
        }
        return {
          ...cls,
          gridRoutine: finalRoutine,
          groups: updatedGroups.length > 0 ? updatedGroups : [{ id: String(finalGroupId), name: 'গ্রুপ ১', gridRoutine: finalRoutine }],
        };
      }
      return cls;
    }));
  };

  const handleDeleteTeachers = (emails) => {
    if (isReadOnly) return;
    const emailSet = new Set(emails);
    setTeachers(prev => prev.filter(t => !emailSet.has(t.email)));
  };

  const handleAddStudent = async (classIdx, student, groupName) => {
    if (!canModifyClass(classIdx)) return;

    let addedStudentObj = null;
    const nextClasses = classes.map((cls, i) => {
      if (i !== classIdx) return cls;
      const provided = String(student?.roll || '').trim();
      const finalRoll = provided ? provided : String((cls.students || []).length + 1).padStart(2, '0');
      addedStudentObj = {
        ...student,
        roll: finalRoll,
        group: groupName,
        class: cls.className,
        className: cls.className,
        classId: cls.classId || cls.className,
      };
      return { ...cls, students: [...(cls.students || []), addedStudentObj] };
    });

    setClasses(nextClasses);
    writeStoredData(CLASSES_STORAGE_KEY, nextClasses, activeSchoolId);
    notifySchoolDataChanged();

    // Persist to Firestore immediately so refreshing (F5) never loses the new student
    try {
      await saveTeacherPanelDataToFirestore({
        classes: nextClasses,
        teachers,
        teacherRoutines,
        timeSlots,
      }, activeSchoolId);

      if (addedStudentObj) {
        await saveStudentProfile(addedStudentObj, activeSchoolId);
      }
    } catch (err) {
      console.error('Failed to save added student to Firestore:', err);
    }
  };

  const handleAddRoutine = (classIdx, groupName, routineItem) => {
    if (!canModifyClass(classIdx)) return;
    setClasses(prev => prev.map((cls, i) => {
      if (i !== classIdx) return cls;
      const existing = cls.routines || {};
      const groupRoutines = existing[groupName] || [];
      return {
        ...cls,
        routines: {
          ...existing,
          [groupName]: [...groupRoutines, routineItem],
        },
      };
    }));
  };

  const handleUpdateRoutine = (classIdx, groupName, itemIndex, routineItem) => {
    if (!canModifyClass(classIdx)) return;
    setClasses(prev => prev.map((cls, i) => {
      if (i !== classIdx) return cls;
      const existing = cls.routines || {};
      const groupRoutines = existing[groupName] || [];
      return {
        ...cls,
        routines: {
          ...existing,
          [groupName]: groupRoutines.map((item, idx) => (idx === itemIndex ? routineItem : item)),
        },
      };
    }));
  };

  const handleDeleteRoutine = (classIdx, groupName, itemIndex) => {
    if (!canModifyClass(classIdx)) return;
    setClasses(prev => prev.map((cls, i) => {
      if (i !== classIdx) return cls;
      const existing = cls.routines || {};
      const groupRoutines = existing[groupName] || [];
      return {
        ...cls,
        routines: {
          ...existing,
          [groupName]: groupRoutines.filter((_, idx) => idx !== itemIndex),
        },
      };
    }));
  };

  const handleAssignTeacher = (classIdx, groupName, teacherAssignments) => {
    if (!canModifyClass(classIdx)) return;
    const classMeta = classes[classIdx];
    const className = classMeta?.className || `Class ${classIdx + 1}`;

    setClasses(prev => prev.map((cls, i) => {
      if (i !== classIdx) return cls;
      const normalizedTeachers = (Array.isArray(teacherAssignments) ? teacherAssignments : [])
        .map((item) => {
          if (typeof item === 'string') {
            const teacher = teachers.find((t) => t.email === item);
            return { email: item, subject: teacher?.subject || '' };
          }
          return {
            email: item?.email || '',
            subject: item?.subject || '',
          };
        })
        .filter((item) => item.email);
      return {
        ...cls,
        groupTeachers: {
          ...cls.groupTeachers,
          [groupName]: normalizedTeachers,
        },
      };
    }));

    setTeachers(prev => prev.map((teacher) => {
      const teacherEmail = teacher?.email;
      const matchingAssignment = (Array.isArray(teacherAssignments) ? teacherAssignments : []).find((item) => {
        const email = typeof item === 'string' ? item : item?.email;
        return email === teacherEmail;
      });

      if (!matchingAssignment) return teacher;

      const subject = typeof matchingAssignment === 'string'
        ? teacher?.subject || ''
        : matchingAssignment?.subject || teacher?.subject || '';

      const nextAssignment = {
        email: teacherEmail,
        subject,
        className,
        classIdx,
        groupName,
      };

      const existingAssignments = Array.isArray(teacher?.assignments) ? teacher.assignments : [];
      const filteredAssignments = existingAssignments.filter((assignment) => !(
        assignment?.classIdx === classIdx && assignment?.groupName === groupName && assignment?.email === teacherEmail
      ));

      return {
        ...teacher,
        assignments: [...filteredAssignments, nextAssignment],
      };
    }));
  };

  const handleAssignGroupHeadTeacher = (classIdx, groupName, teacherEmail) => {
    if (!canModifyClass(classIdx)) return;
    setClasses(prev => prev.map((cls, i) => {
      if (i !== classIdx) return cls;
      return {
        ...cls,
        groupHeadTeachers: {
          ...cls.groupHeadTeachers,
          [groupName]: teacherEmail || '',
        },
      };
    }));
  };

  const handleUpdateGroupSubjects = async (classIdx, groupName, subjects) => {
    if (!canModifyClass(classIdx)) return;
    const normalizedSubjects = Array.isArray(subjects) ? [...new Set(subjects.filter(Boolean))] : [];

    setClasses(prev => prev.map((cls, i) => {
      if (i !== classIdx) return cls;
      return {
        ...cls,
        groupSubjects: {
          ...cls.groupSubjects,
          [groupName]: normalizedSubjects,
        },
      };
    }));

    try {
      const existing = readStoredData(GROUP_SUBJECTS_STORAGE_KEY, {}, activeSchoolId);
      const next = { ...(existing || {}) };
      const classNumKey = String(classes[classIdx]?.classNum ?? classIdx);
      const classIdxKey = String(classIdx);
      next[classNumKey] = { ...(next[classNumKey] || {}), [groupName]: normalizedSubjects };
      next[classIdxKey] = { ...(next[classIdxKey] || {}), [groupName]: normalizedSubjects };
      writeStoredData(GROUP_SUBJECTS_STORAGE_KEY, next, activeSchoolId);
    } catch (e) {
      // ignore local write errors
    }

    try {
      await saveGroupSubjectsToFirestore({ classIdx, groupName, subjects: normalizedSubjects }, activeSchoolId);
    } catch (e) {
      // Local storage already keeps subjects available after refresh.
    }
  };

  const handleDeleteStudents = (classIdx, ids) => {
    if (!canModifyClass(classIdx)) return;
    const idSet = new Set(ids);
    const targetClass = classes[classIdx];
    const deletedStudentObjects = (targetClass?.students || [])
      .filter((s) => idSet.has(s.id))
      .map((s) => ({ ...s, class: targetClass?.className || s.class }));

    setClasses(prev => prev.map((cls, i) => {
      if (i !== classIdx) return cls;
      const remaining = (cls.students || [])
        .filter(s => !idSet.has(s.id))
        .map((s, j) => ({ ...s, roll: String(j + 1).padStart(2, '0') }));
      return { ...cls, students: remaining };
    }));

    if (deletedStudentObjects.length > 0) {
      purgeResultsForStudents(deletedStudentObjects, activeSchoolId).catch((err) => {
        console.warn('Could not purge student results from Firestore:', err);
      });
    }
  };

  const handleUpdateStudent = (classIdx, updatedStudent) => {
    if (!canModifyClass(classIdx)) return;
    setClasses(prev => prev.map((cls, i) => {
      if (i !== classIdx) return cls;
      const updatedStudents = (cls.students || []).map(s =>
        s.id === updatedStudent.id ? updatedStudent : s
      );
      return { ...cls, students: updatedStudents };
    }));
  };

  const handleAddClass = async (className, explicitBranchKey = null) => {
    if (user?.role !== 'admin') {
      showAlert('Only administrators can add new classes.', 'Access Denied', 'warning');
      return;
    }
    if (isReadOnly || isClassTeacherAccess) {
      showAlert('Access restricted: cannot add class in read-only mode.', 'Access Restricted', 'warning');
      return;
    }

    const trimmedName = String(className || '').trim();
    if (!trimmedName) return;

    const currentClasses = classes || [];
    if (currentClasses.some(c => c.className?.toLowerCase() === trimmedName.toLowerCase())) {
      throw new Error(`Class "${trimmedName}" already exists.`);
    }

    const targetBranch = explicitBranchKey || selectedBranchKey || getBranchKeyByClass(trimmedName) || 'primary';
    const detectedNum = extractClassNumber(trimmedName);
    const maxNum = currentClasses.reduce((max, c) => Math.max(max, c.classNum || 0), 0);
    const baseIdx = targetBranch === 'college' ? 11 : targetBranch === 'secondary' ? 6 : 1;
    const classNum = detectedNum !== null ? detectedNum : (maxNum + 1 || baseIdx);

    const newClass = {
      className: trimmedName,
      classNum,
      branchKey: targetBranch,
      branchId: targetBranch,
      sectionId: targetBranch,
      schoolId: schoolProfile?.schoolId || activeSchoolId || 'PROGGA_DEFAULT',
      eiinNumber: schoolProfile?.eiinNumber || '',
      schoolCode: schoolProfile?.schoolCode || '',
      groups: targetBranch === 'college' ? ['Science', 'Commerce', 'Arts'] : ['Group A', 'Group B', 'Group C'],
      students: [],
      groupTeachers: {},
      groupHeadTeachers: {},
      groupSubjects: {},
      routines: {},
    };

    const nextClasses = sortClasses([...currentClasses, newClass]);

    // Synchronously update local state and localStorage for instant UI response
    setClasses(nextClasses);
    writeStoredData(CLASSES_STORAGE_KEY, nextClasses, activeSchoolId);

    // Flag remote update so auto-sync useEffect does not duplicate calls
    isRemoteUpdate.current = true;

    try {
      // Save full teacherPanel document to Firestore immediately
      await saveTeacherPanelDataToFirestore({
        classes: nextClasses,
        teachers,
        teacherRoutines,
        timeSlots
      }, activeSchoolId);

      // Save individual class record to 'classes' collection in Firestore
      await saveClassRecord(newClass, activeSchoolId);
    } catch (err) {
      console.error('Failed to save added class to Firestore:', err);
      throw err;
    }
  };

  const handleDeleteClasses = async (classIndices) => {
    if (user?.role !== 'admin') return;
    if (isReadOnly || isClassTeacherAccess) return;

    const classIndexSet = new Set(classIndices);
    const currentClasses = classes || [];
    const currentTeachers = teachers || [];

    const deletedClassesList = currentClasses.filter((_, idx) => classIndexSet.has(idx));
    const deletedStudentObjects = deletedClassesList.flatMap((cls) => (cls.students || []).map((s) => ({ ...s, class: cls.className })));

    const nextClasses = currentClasses.filter((_, idx) => !classIndexSet.has(idx));
    const nextTeachers = currentTeachers.map((teacher) => ({
      ...teacher,
      assignments: (Array.isArray(teacher.assignments) ? teacher.assignments : [])
        .filter((assignment) => !classIndexSet.has(Number(assignment?.classIdx))),
    }));

    setClasses(nextClasses);
    setTeachers(nextTeachers);
    writeStoredData(CLASSES_STORAGE_KEY, nextClasses, activeSchoolId);
    writeStoredData(TEACHERS_STORAGE_KEY, nextTeachers, activeSchoolId);

    if (deletedStudentObjects.length > 0) {
      purgeResultsForStudents(deletedStudentObjects, activeSchoolId).catch(() => { });
    }

    isRemoteUpdate.current = true;

    setSelectedBranchKey(null);
    setSelectedClass(null);
    setSelectedGroup(null);
    setSelectedRoutineClass(null);
    setSelectedRoutineGroup(null);

    try {
      await saveTeacherPanelDataToFirestore({
        classes: nextClasses,
        teachers: nextTeachers,
        teacherRoutines,
        timeSlots
      });
    } catch (err) {
      console.error('Failed to save deleted classes to Firestore:', err);
    }
  };

  const handleAddGroup = (classIdx, groupName) => {
    if (!canModifyClass(classIdx)) return;
    setClasses(prev => prev.map((cls, i) => {
      if (i !== classIdx) return cls;
      const groups = cls.groups || [];
      if (groups.includes(groupName)) return cls;
      return {
        ...cls,
        groups: [...groups, groupName],
        groupSubjects: {
          ...cls.groupSubjects,
          [groupName]: [],
        },
        routines: {
          ...cls.routines,
          [groupName]: [],
        },
      };
    }));
  };

  const handleDeleteGroups = (classIdx, groupNames) => {
    if (!canModifyClass(classIdx)) return;
    const groupSet = new Set(groupNames);
    setClasses(prev => prev.map((cls, i) => {
      if (i !== classIdx) return cls;
      const remainingGroups = (cls.groups || []).filter(g => !groupSet.has(g));
      const remainingStudents = (cls.students || []).filter(s => !groupSet.has(s.group));
      const remainingGroupHeadTeachers = { ...cls.groupHeadTeachers };
      const remainingRoutines = { ...cls.routines };
      const remainingGroupTeachers = { ...cls.groupTeachers };
      const remainingGroupSubjects = { ...cls.groupSubjects };
      groupNames.forEach((name) => {
        delete remainingGroupHeadTeachers[name];
        delete remainingRoutines[name];
        delete remainingGroupTeachers[name];
        delete remainingGroupSubjects[name];
      });
      return { ...cls, groups: remainingGroups, students: remainingStudents, groupHeadTeachers: remainingGroupHeadTeachers, groupTeachers: remainingGroupTeachers, groupSubjects: remainingGroupSubjects, routines: remainingRoutines };
    }));
  };

  const isHome = activeNav === 'home';
  const inSection = isHome && activeSection !== null;
  const sectionMeta = menuItems.find((m) => m.id === activeSection);

  const handleCardClick = (id) => { setActiveSection(id); setSelectedBranchKey(null); setSelectedClass(null); setSelectedGroup(null); };
  const handleBack = () => { setActiveSection(null); setSelectedBranchKey(null); setSelectedClass(null); setSelectedGroup(null); };
  const handleNavClick = (id) => {
    if (menuItems.some((m) => m.id === id)) {
      handleSidebarNav(id);
      return;
    }
    setActiveNav(id);
    setActiveSection(null);
    setSelectedBranchKey(null);
    setSelectedClass(null);
    setSelectedGroup(null);
  };

  const handleSidebarNav = (id) => {
    setSelectedBranchKey(null);
    if (id === 'home') { setActiveSection(null); setActiveNav('home'); setSelectedClass(null); setSelectedGroup(null); setSelectedRoutineClass(null); setSelectedRoutineGroup(null); }
    else { setActiveSection(id); setActiveNav('home'); setSelectedClass(null); setSelectedGroup(null); setSelectedRoutineClass(null); setSelectedRoutineGroup(null); }
  };

  const selectedProfile = selectedProfileView || {
    userId: activeUser?.userId || user?.userId,
    name: activeUser?.name || user?.name,
    role: activeUser?.role || user?.role,
  };

  const studentRecords = (Array.isArray(classes) ? classes : []).flatMap((cls) => (cls?.students || []).map((s) => ({
    ...s,
    role: 'student',
    className: cls.className,
    classNum: cls.classNum,
  })));

  const selectedProfileDetails = selectedProfile.role === 'teacher'
    ? teachers.find((t) => {
      const idMatch = String(t.email || t.userId || '').toLowerCase() === String(selectedProfile.userId || '').toLowerCase();
      const nameMatch = String(t.name || '').toLowerCase() === String(selectedProfile.name || '').toLowerCase();
      return idMatch || nameMatch;
    }) || null
    : studentRecords.find((s) => {
      const idMatch = String(s.id || s.userId || '').toLowerCase() === String(selectedProfile.userId || '').toLowerCase();
      const nameMatch = String(s.name || '').toLowerCase() === String(selectedProfile.name || '').toLowerCase();
      return idMatch || nameMatch;
    }) || null;

  const resolvedAdminDetails = (selectedProfile.role === 'admin' || selectedProfile.role === 'principal') ? {
    name: selectedProfile.name || schoolProfile?.adminName || activeUser?.name || user?.name || 'Administrator',
    email: user?.email || activeUser?.email || schoolProfile?.adminEmail || '',
    phone: user?.phone || user?.phoneNumber || user?.adminPhone || activeUser?.phone || schoolProfile?.adminPhone || '',
    title: schoolProfile?.adminTitle || (selectedProfile.role === 'principal' ? 'Principal' : 'School Administrator'),
    schoolName: schoolProfile?.schoolName || 'PROGGA School',
  } : null;

  const profileName = selectedProfile?.name || resolvedAdminDetails?.name || activeUser?.name || user?.name || 'User';
  const profileUserId = selectedProfile?.userId || activeUser?.userId || user?.userId || 'N/A';
  const profileRoleRaw = selectedProfile?.role || activeUser?.role || user?.role || 'admin';
  const profileRoleDisplay = profileRoleRaw === 'teacher'
    ? (selectedProfileDetails?.subject ? `${selectedProfileDetails.subject} Teacher` : 'Teacher')
    : profileRoleRaw === 'student'
      ? (selectedProfileDetails?.className ? `Class ${selectedProfileDetails.className} Student` : 'Student')
      : profileRoleRaw === 'principal'
        ? (resolvedAdminDetails?.title || 'Principal')
        : profileRoleRaw === 'admin'
          ? (resolvedAdminDetails?.title || 'School Administrator')
          : (profileRoleRaw.charAt(0).toUpperCase() + String(profileRoleRaw).slice(1));

  // Conditional clean email display - hide completely if missing or fake
  const rawEmailCandidate = selectedProfileDetails?.email || user?.email || activeUser?.email || resolvedAdminDetails?.email || '';
  const isRealEmail = typeof rawEmailCandidate === 'string' &&
    rawEmailCandidate.trim() !== '' &&
    rawEmailCandidate.includes('@') &&
    !rawEmailCandidate.toLowerCase().includes('@greenfield.edu') &&
    !rawEmailCandidate.toLowerCase().includes('@progga.edu') &&
    !rawEmailCandidate.toLowerCase().includes('@scholasticbase.edu') &&
    rawEmailCandidate.toLowerCase() !== 'admin@school.edu';
  const displayEmail = isRealEmail ? rawEmailCandidate.trim() : null;

  // Real-time phone display
  const rawPhoneCandidate = selectedProfileDetails?.phone || user?.phone || user?.phoneNumber || user?.adminPhone || activeUser?.phone || resolvedAdminDetails?.phone || '';
  const displayPhone = (typeof rawPhoneCandidate === 'string' && rawPhoneCandidate.trim()) ? rawPhoneCandidate.trim() : (profileRoleRaw === 'teacher' ? 'Not provided' : null);

  // Subject / Class / Organization display
  const assignedSubjectOrClass = profileRoleRaw === 'teacher'
    ? (selectedProfileDetails?.subject || 'General')
    : profileRoleRaw === 'student'
      ? (selectedProfileDetails?.className ? `Class ${selectedProfileDetails.className}` : 'Not assigned')
      : (schoolProfile?.schoolName || 'PROGGA School');

  const avatarPic = selectedProfileDetails?.profilePic || user?.profilePic || user?.photo || user?.photoURL || (profileRoleRaw === 'admin' ? schoolProfile?.logo : null);

  const currentTeacherProfile = selectedProfile.role === 'teacher'
    ? teachers.find((t) => {
      const normalizedUserId = String(selectedProfile.userId || '').toLowerCase();
      return String(t.email || '').toLowerCase() === normalizedUserId
        || String(t.name || '').toLowerCase() === String(selectedProfile.name || '').toLowerCase();
    }) || null
    : null;

  const currentTeacherEmail = currentTeacherProfile?.email || '';
  const isTeacherRole = selectedProfile.role === 'teacher';
  const isSuperAdmin = !!user?.isSuperAdmin;
  const isClassTeacherAccess = !isSuperAdmin && isTeacherRole && activeUser?.accessMode === 'classTeacher';
  const isReadOnly = !isSuperAdmin && isTeacherRole && activeUser?.accessMode === 'readOnly';

  // Support multi-class: prefer new array field, fall back to legacy single-value
  const classTeacherClassIdxList = isClassTeacherAccess
    ? (Array.isArray(user?.classTeacherClassIdxList) && user.classTeacherClassIdxList.length > 0
      ? user.classTeacherClassIdxList.map(Number)
      : user?.classTeacherClassIdx !== null && user?.classTeacherClassIdx !== undefined && user?.classTeacherClassIdx !== ''
        ? [Number(user.classTeacherClassIdx)]
        : [])
    : [];

  // Build one assignment entry per assigned class
  const classTeacherAssignment = isClassTeacherAccess && classTeacherClassIdxList.length > 0
    ? classTeacherClassIdxList.map(idx => ({
      scope: 'classTeacher',
      classIdx: idx,
      className: classes[idx]?.className || user?.classTeacherClassNames?.[classTeacherClassIdxList.indexOf(idx)] || '',
    }))
    : [];

  // Set of allowed class indices for quick lookup
  const allowedClassIdxSet = new Set(classTeacherClassIdxList);

  const currentTeacherAssignments = isClassTeacherAccess
    ? classTeacherAssignment
    : Array.isArray(currentTeacherProfile?.assignments)
      ? currentTeacherProfile.assignments.filter((assignment) => assignment?.className || assignment?.groupName || assignment?.subject)
      : [];
  const canModifyClass = (classIdx) => isSuperAdmin || (!isReadOnly && (!isClassTeacherAccess || allowedClassIdxSet.has(Number(classIdx))));
  const activeSidebarId = activeSection ?? (activeNav !== 'home' ? activeNav : 'home');

  const selectedRoutineClassData = selectedRoutineClass !== null ? classes[selectedRoutineClass] : null;

  /* ── Notice Board state for Teachers / Class Teachers ── */
  const [notices, setNotices] = useState(() => {
    const userRoleParam = isClassTeacherAccess ? 'classTeacher' : 'teacher';
    return getNotices(schoolProfile?.schoolId || activeSchoolId || 'PROGGA_DEFAULT').filter(n => canUserAccessNotice(n, userRoleParam));
  });
  const [showAddNotice, setShowAddNotice] = useState(false);
  const [highlightedNoticeId, setHighlightedNoticeId] = useState(null);
  const [noticeDeleteMode, setNoticeDeleteMode] = useState(false);
  const [selectedNoticeIds, setSelectedNoticeIds] = useState(new Set());

  useEffect(() => {
    const targetSid = schoolProfile?.schoolId || activeSchoolId || 'PROGGA_DEFAULT';
    const syncNotices = () => {
      const userRoleParam = isClassTeacherAccess ? 'classTeacher' : 'teacher';
      const all = getNotices(targetSid);
      setNotices(all.filter(n => canUserAccessNotice(n, userRoleParam)));
    };
    syncNotices();
    const unsub = subscribeToNoticeUpdates(syncNotices, targetSid);
    return () => unsub();
  }, [schoolProfile?.schoolId, activeSchoolId, isClassTeacherAccess]);

  const toggleSelectNotice = (id) => {
    setSelectedNoticeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const executeDeleteNotices = () => {
    if (selectedNoticeIds.size === 0) return;
    const targetSid = schoolProfile?.schoolId || activeSchoolId || 'PROGGA_DEFAULT';
    const remaining = deleteNoticesStorage(Array.from(selectedNoticeIds), targetSid);
    const userRoleParam = isClassTeacherAccess ? 'classTeacher' : 'teacher';
    setNotices(remaining.filter(n => canUserAccessNotice(n, userRoleParam)));
    setSelectedNoticeIds(new Set());
    setNoticeDeleteMode(false);
  };

  return (
    <div className="tp-shell">

      {/* ════════════════════════════════
          MOBILE DRAWER OVERLAY
          ════════════════════════════════ */}
      <div className={`tp-drawer-overlay ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)}>
        <div className="tp-drawer" onClick={(e) => e.stopPropagation()}>
          <div className="tp-drawer-brand">
            <SafeImage
              src={schoolProfile.logo}
              alt={`${schoolProfile.schoolName} logo`}
              className="tp-drawer-logo"
              style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0 }}
              fallbackVariant="school"
              fallbackText={schoolProfile.schoolName || 'ScholasticBase'}
            />
            <div style={{ flex: '1 1 0%', minWidth: 0 }}>
              <p className="tp-drawer-title">Menu</p>
              <p className="tp-drawer-school">{schoolProfile.schoolName || 'ScholasticBase'}</p>
              {(schoolProfile?.location || window.localStorage.getItem('schoolLocation')) && (
                <p className="tp-drawer-location" style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                  📍 {schoolProfile?.location || window.localStorage.getItem('schoolLocation')}
                </p>
              )}
            </div>
          </div>
          <div className="tp-drawer-nav">
            <button
              className={`tp-sidebar-nav-item${activeSidebarId === 'home' ? ' active' : ''}`}
              onClick={() => {
                handleSidebarNav('home');
                setMenuOpen(false);
              }}
            >
              <SBHomeIcon /> Home
            </button>
            {menuItems.map((item) => (
              <button
                key={item.id}
                className={`tp-sidebar-nav-item${activeSidebarId === item.id ? ' active' : ''}`}
                onClick={() => {
                  handleSidebarNav(item.id);
                  setMenuOpen(false);
                }}
              >
                <item.SBIcon /> {item.title}
              </button>
            ))}
            <button
              className={`tp-sidebar-nav-item${activeNav === 'profile' ? ' active' : ''}`}
              onClick={() => {
                handleNavClick('profile');
                setMenuOpen(false);
              }}
            >
              <SBProfileIcon /> Profile
            </button>
          </div>
          <div className="tp-drawer-bottom" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p className="tp-drawer-label" style={{ margin: 0 }}>Signed in as</p>
            <p className="tp-drawer-name" style={{ margin: 0 }}>{user?.name || user?.userId}</p>
            <p className="tp-drawer-role" style={{ margin: 0 }}>Role: {user?.role}</p>
            <button className="tp-drawer-signout" onClick={signOut} style={{ margin: '8px 0 0' }}>Sign Out</button>
            <div className="tp-sidebar-footer" style={{ fontSize: 10.5, color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: 10, lineHeight: 1.4 }}>
              <div style={{ fontWeight: 600 }}>© 2026 {schoolProfile.schoolName || 'Progga'}</div>
              <div>
                Admin: <a href={`mailto:${schoolProfile.adminEmail}`} style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>{schoolProfile.adminEmail}</a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════
          DESKTOP SIDEBAR
          ════════════════════════════════ */}
      <aside className="tp-sidebar">
        {/* Brand */}
        <div className="tp-sidebar-brand">
          <SafeImage
            src={schoolProfile.logo}
            alt={`${schoolProfile.schoolName} logo`}
            className="tp-sidebar-crest"
            style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }}
            fallbackVariant="school"
            fallbackText={schoolProfile.schoolName || 'ScholasticBase'}
          />
          <div style={{ flex: '1 1 0%', minWidth: 0 }}>
            <span className="tp-sidebar-school">{schoolProfile.schoolName || 'ScholasticBase'}</span>
            {(schoolProfile?.location || window.localStorage.getItem('schoolLocation')) && (
              <span className="tp-sidebar-location" style={{ display: 'block', fontSize: 12, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
                📍 {schoolProfile?.location || window.localStorage.getItem('schoolLocation')}
              </span>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="tp-sidebar-nav">
          <button
            className={`tp-sidebar-nav-item${activeSidebarId === 'home' ? ' active' : ''}`}
            onClick={() => handleSidebarNav('home')}
          >
            <SBHomeIcon /> <span className="tp-sidebar-label">Home</span>
          </button>

          {menuItems.map((item) => (
            <button
              key={item.id}
              className={`tp-sidebar-nav-item${activeSidebarId === item.id ? ' active' : ''}`}
              onClick={() => handleSidebarNav(item.id)}
            >
              <item.SBIcon /> <span className="tp-sidebar-label">{item.title}</span>
            </button>
          ))}
          <button
            className={`tp-sidebar-nav-item${activeNav === 'profile' ? ' active' : ''}`}
            onClick={() => handleNavClick('profile')}
          >
            <SBProfileIcon /> <span className="tp-sidebar-label">Profile</span>
          </button>
        </nav>

        <div className="tp-sidebar-bottom" style={{ marginTop: 'auto' }}>
          <div className="tp-sidebar-divider" />

          {/* User info + sign-out */}
          <div className="tp-sidebar-user-info" style={{ padding: '0 4px', marginBottom: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1a2e4a', margin: '0 0 2px' }}>
              {user?.name || user?.userId}
            </p>
            <p style={{ fontSize: 11.5, color: '#94a3b8', margin: 0, textTransform: 'capitalize' }}>
              {user?.role}
            </p>
          </div>

          <button className="tp-sidebar-signout" onClick={signOut}>
            <LogoutIcon /> <span className="tp-sidebar-label">Sign Out</span>
          </button>

          <div className="tp-sidebar-footer" style={{ padding: '12px 4px 0', fontSize: 10.5, color: '#94a3b8', borderTop: '1px solid #e2e8f0', marginTop: 12, lineHeight: 1.5 }}>
            <div style={{ fontWeight: 600 }}>© 2026 {schoolProfile.schoolName || 'Progga'}</div>
            <div>
              Admin: <a href={`mailto:${schoolProfile.adminEmail}`} style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>{schoolProfile.adminEmail}</a>
            </div>
          </div>
        </div>
      </aside>

      {/* ════════════════════════════════
          MAIN CONTENT
          ════════════════════════════════ */}
      <main className="tp-main">

        {/* ── Top bar ── */}
        {activeNav !== 'profile' && (
          <div className="tp-topbar">
            {/* Mobile: hamburger */}
            <button className="tp-icon-btn tp-hamburger" onClick={() => setMenuOpen(true)} aria-label="Menu">
              <HamburgerIcon />
            </button>

            {/* Desktop: greeting in topbar */}
            <div className="tp-topbar-greeting">
              <div className="tp-topbar-title-row">
                <span className="tp-greeting-badge">
                  {getGreeting() === 'Good Morning' ? '☀️' : getGreeting() === 'Good Afternoon' ? '🌤️' : '🌙'}
                </span>
                <h2>{getGreeting()}{profileName ? `, ` : ''}{profileName && <span className="tp-user-name">{profileName}</span>}!</h2>
              </div>
              <p className="tp-topbar-subtitle">
                <span>{schoolProfile?.schoolName || 'Progga'}</span>
                <span className="tp-sub-dot">•</span>
                <span>Faculty Portal</span>
              </p>
            </div>

            <div className="tp-topbar-right">
              <NotificationBell
                userRole={isClassTeacherAccess ? 'classTeacher' : isReadOnly ? 'teacher' : (user?.role || 'teacher')}
                userId={user?.userId || profileName || 'teacher'}
                activeSchoolId={schoolProfile?.schoolId || activeSchoolId || 'PROGGA_DEFAULT'}
                onSelectNotice={(noticeId) => {
                  setActiveNav('notice');
                  setActiveSection(null);
                  setHighlightedNoticeId(noticeId);
                  setTimeout(() => {
                    const el = document.getElementById(`notice-${noticeId}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 100);
                }}
              />
            </div>
          </div>
        )}

        {/* ── HOME: section detail view ── */}
        {inSection && (
          <>
            {/* Only show the outer section header when NOT in teachers section or drilling into students branch */}
            {!(activeSection === 'teachers' || (activeSection === 'students' && (selectedClass !== null || selectedBranchKey !== null))) && (
              <div className="tp-section-header">
                <button
                  className="tp-back-btn"
                  onClick={handleBack}
                  title="Go back"
                  aria-label="Go back to Home"
                >
                  <ChevronLeft />
                </button>
                <div className="tp-section-header-info">
                  <div className="tp-breadcrumbs" aria-label="Breadcrumb">
                    <button type="button" className="tp-crumb-link" onClick={handleBack}>Home</button>
                    <span className="tp-crumb-separator">/</span>
                    <span className="tp-crumb-current">{sectionMeta?.title || 'Student Info'}</span>
                  </div>
                  <h2 className="tp-section-title">{sectionMeta?.title}</h2>
                </div>
              </div>
            )}
            <DetailContent
              section={activeSection}
              selectedBranchKey={selectedBranchKey}
              onSelectBranchKey={(key) => setSelectedBranchKey(key)}
              selectedClass={selectedClass}
              onSelectClass={(idx) => setSelectedClass(idx)}
              onBackFromClass={() => { setSelectedClass(null); setSelectedGroup(null); }}
              classes={classes}
              onAddStudent={handleAddStudent}
              onDeleteStudents={handleDeleteStudents}
              teachers={teachers}
              onAddTeacher={handleAddTeacher}
              onDeleteTeachers={handleDeleteTeachers}
              onAddClass={handleAddClass}
              onDeleteClasses={handleDeleteClasses}
              selectedGroup={selectedGroup}
              onSelectGroup={(idx) => setSelectedGroup(idx)}
              onBackFromGroup={() => setSelectedGroup(null)}
              onAssignTeacher={handleAssignTeacher}
              onAssignGroupHeadTeacher={handleAssignGroupHeadTeacher}
              onUpdateGroupSubjects={handleUpdateGroupSubjects}
              onAddGroup={handleAddGroup}
              onDeleteGroups={handleDeleteGroups}
              onUpdateStudent={handleUpdateStudent}
              onViewStudentProfile={(student) => {
                setSelectedProfileView({ userId: student.id, name: student.name, role: 'student' });
                setActiveNav('profile');
              }}
              selectedRoutineClass={selectedRoutineClass}
              onSelectRoutineClass={(idx) => setSelectedRoutineClass(idx)}
              onBackFromRoutineClass={() => { setSelectedRoutineClass(null); setSelectedRoutineGroup(null); }}
              selectedRoutineGroup={selectedRoutineGroup}
              onSelectRoutineGroup={(idx) => setSelectedRoutineGroup(idx)}
              onBackFromRoutineGroup={() => setSelectedRoutineGroup(null)}
              onAddRoutine={handleAddRoutine}
              onUpdateRoutine={handleUpdateRoutine}
              onDeleteRoutine={handleDeleteRoutine}
              currentTeacherEmail={currentTeacherEmail}
              currentTeacherProfile={currentTeacherProfile}
              teacherAssignments={currentTeacherAssignments}
              isTeacherRole={isTeacherRole}
              isReadOnly={isReadOnly}
              teacherRoutines={teacherRoutines}
              onSaveTeacherRoutine={handleSaveTeacherRoutine}
              onSaveClassRoutine={handleSaveClassRoutine}
              timeSlots={timeSlots}
              onSaveTimeSlots={setTimeSlots}
            />
          </>
        )}

        {/* ── HOME: menu overview ── */}
        {isHome && !inSection && (
          <>
            {/* Hero Banner */}
            <div className="tp-hero tp-hero-pro">
              <div className="tp-hero-header">
                <div className="tp-hero-badge-wrap">
                  <span className="tp-hero-badge">
                    <span className="tp-badge-dot" />
                    {isReadOnly ? 'READ-ONLY ACCESS' : 'TEACHER DASHBOARD'}
                  </span>
                  {schoolProfile?.schoolName && (
                    <span className="tp-hero-school-pill">
                      🏫 {schoolProfile.schoolName}
                    </span>
                  )}
                </div>
                <h1 className="tp-hero-title">
                  {getGreeting()}, <span className="tp-hero-name">{profileName}</span> 👋
                </h1>
              </div>

              {/* Translucent Bengali Quote Container */}
              <div className="tp-hero-quote-box">
                <p className="tp-quote-text">
                  <span className="tp-quote-mark tp-quote-open">“</span>
                  অগাধ ধন-সম্পদের চেয়ে একজন সুশিক্ষিত সন্তানের মূল্য অনেক বেশি
                  <span className="tp-quote-mark tp-quote-close">”</span>
                </p>
              </div>

              {/* Interactive KPI Metrics Grid */}
              <div className="tp-hero-kpi-grid" aria-label="Dashboard overview metrics">
                <button
                  type="button"
                  className="tp-kpi-card"
                  onClick={() => handleCardClick('students')}
                  title="View Classes & Students"
                >
                  <div className="tp-kpi-icon-box kpi-blue">
                    <KPIClassIcon />
                  </div>
                  <div className="tp-kpi-content">
                    <span className="tp-kpi-num">{classes.length}</span>
                    <span className="tp-kpi-label">Active Classes</span>
                  </div>
                </button>

                <button
                  type="button"
                  className="tp-kpi-card"
                  onClick={() => handleCardClick('students')}
                  title="View Student Roster"
                >
                  <div className="tp-kpi-icon-box kpi-emerald">
                    <KPIStudentIcon />
                  </div>
                  <div className="tp-kpi-content">
                    <span className="tp-kpi-num">{studentRecords.length}</span>
                    <span className="tp-kpi-label">Total Students</span>
                  </div>
                </button>

                <button
                  type="button"
                  className="tp-kpi-card"
                  onClick={() => handleCardClick('teachers')}
                  title="View Faculty Directory"
                >
                  <div className="tp-kpi-icon-box kpi-purple">
                    <KPITeacherIcon />
                  </div>
                  <div className="tp-kpi-content">
                    <span className="tp-kpi-num">{teachers.length}</span>
                    <span className="tp-kpi-label">Faculty Members</span>
                  </div>
                </button>

                <button
                  type="button"
                  className="tp-kpi-card"
                  onClick={() => handleNavClick('profile')}
                  title="View Assigned Profile"
                >
                  <div className="tp-kpi-icon-box kpi-amber">
                    <KPISchoolIcon />
                  </div>
                  <div className="tp-kpi-content">
                    <span className="tp-kpi-role">{assignedSubjectOrClass || 'Teacher'}</span>
                    <span className="tp-kpi-label">My Role / Scope</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Quick Access Modules Section Header */}
            <div className="tp-modules-section-header">
              <div className="tp-modules-header-info">
                <h2 className="tp-modules-title">Quick Access Modules</h2>
                <p className="tp-modules-subtitle">Direct access to student info, results entry, class routines & fee portal</p>
              </div>
              <span className="tp-modules-count-tag">{menuItems.length} Modules</span>
            </div>

            {/* Menu cards */}
            <div className="tp-cards-grid">
              {menuItems.map((item) => {
                return (
                  <button
                    key={item.id}
                    className="tp-menu-card"
                    onClick={() => handleCardClick(item.id)}
                  >
                    <div
                      className="tp-card-icon"
                      style={{
                        background: item.color,
                        boxShadow: `0 8px 18px ${item.shadowColor || 'rgba(37, 99, 235, 0.25)'}`
                      }}
                    >
                      <item.Icon />
                    </div>
                    <div className="tp-card-text">
                      <div className="tp-card-head-row">
                        <p className="tp-card-title">{item.title}</p>
                        {item.badge && <span className="tp-card-badge-pill">{item.badge}</span>}
                      </div>
                      <p className="tp-card-subtitle">{item.subtitle}</p>
                    </div>
                    <div className="tp-card-chevron">
                      <ChevronRight />
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* ── User profile page ── */}
        {!isHome && activeNav === 'profile' && (
          <div className="tp-profile-page">
            <div className="tp-profile-wrapper">
              <div className="tp-profile-card">
                <div className="tp-profile-header">
                  <div className="tp-profile-avatar">
                    {avatarPic ? (
                      <img src={avatarPic} alt={profileName} className="tp-profile-avatar-img" />
                    ) : (
                      <span>{(profileName || 'U').charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <h2 className="tp-profile-name">{profileName}</h2>
                    <p className="tp-profile-role">{profileRoleDisplay}</p>
                    {displayEmail && (
                      <p className="tp-profile-email">📧 {displayEmail}</p>
                    )}
                  </div>
                </div>

                <div className="tp-profile-details-grid">
                  <div className="tp-profile-detail-row">
                    <span className="tp-profile-detail-label">Full Name</span>
                    <span className="tp-profile-detail-value">{profileName}</span>
                  </div>
                  <div className="tp-profile-detail-row">
                    <span className="tp-profile-detail-label">Account ID</span>
                    <span className="tp-profile-detail-value">{profileUserId}</span>
                  </div>
                  <div className="tp-profile-detail-row">
                    <span className="tp-profile-detail-label">Role</span>
                    <span className="tp-profile-detail-value">{profileRoleDisplay}</span>
                  </div>
                  {displayEmail && (
                    <div className="tp-profile-detail-row">
                      <span className="tp-profile-detail-label">Email Address</span>
                      <span className="tp-profile-detail-value">{displayEmail}</span>
                    </div>
                  )}
                  {displayPhone && (
                    <div className="tp-profile-detail-row">
                      <span className="tp-profile-detail-label">Phone Number</span>
                      <span className="tp-profile-detail-value">{displayPhone}</span>
                    </div>
                  )}
                  <div className="tp-profile-detail-row">
                    <span className="tp-profile-detail-label">
                      {profileRoleRaw === 'teacher' ? 'Subject' : profileRoleRaw === 'student' ? 'Class / Grade' : 'School Organization'}
                    </span>
                    <span className="tp-profile-detail-value">{assignedSubjectOrClass}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Teacher Routine in Profile ── */}
            {selectedProfile.role === 'teacher' && (
              <div style={{ marginTop: 24, background: '#fff', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e40af' }}>📅 Weekly Routine</h3>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                      {`${selectedProfile?.name || user?.name}'s class schedule`}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedProfileView(null);
                      setActiveNav('home');
                      setActiveSection('routine');
                    }}
                    style={{
                      background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe',
                      padding: '7px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    ✏️ Edit Routine
                  </button>
                </div>
                <TeacherRoutineReadOnly
                  teacherName={selectedProfile?.name || user?.name}
                  routine={teacherRoutines[selectedProfile?.name || user?.name] || {}}
                  timeSlots={timeSlots}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Notice Board Tab / View ── */}
        {activeNav === 'notice' && (
          <div style={{ padding: '24px clamp(16px, 3vw, 32px)' }}>
            <div className="tp-notice-toolbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h2 className="tp-section-title" style={{ margin: 0, fontSize: 22 }}>📢 Notice Board</h2>
                <span className="tp-roster-badge" style={{ background: '#ffedd5', color: '#c2410c', borderColor: '#fed7aa', fontSize: 13, padding: '4px 12px', borderRadius: 20, fontWeight: 700 }}>
                  {notices.length} Notice{notices.length !== 1 ? 's' : ''}
                </span>
                {isClassTeacherAccess || isSuperAdmin ? (
                  <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 12, background: '#f0fdf4', color: '#166534', fontWeight: 600, border: '1px solid #bbf7d0' }}>
                    ✍️ Class Teacher Publishing Access
                  </span>
                ) : (
                  <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 12, background: '#f8fafc', color: '#64748b', fontWeight: 600, border: '1px solid #e2e8f0' }}>
                    🔒 Faculty Notice Board (Read-Only)
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {(isClassTeacherAccess || isSuperAdmin) ? (
                  noticeDeleteMode ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>{selectedNoticeIds.size} selected</span>
                      <button className="tp-delete-cancel-btn" onClick={() => { setNoticeDeleteMode(false); setSelectedNoticeIds(new Set()); }}>Cancel</button>
                      <button className="tp-delete-exec-btn" disabled={selectedNoticeIds.size === 0} onClick={executeDeleteNotices}>Delete Selected</button>
                    </div>
                  ) : (
                    <>
                      <button className="tp-delete-toggle-btn" onClick={() => setNoticeDeleteMode(true)} disabled={notices.length === 0} style={{ margin: 0 }}>
                        🗑️ Select to Remove
                      </button>
                      <button className="tp-add-student-btn" style={{ background: '#f97316', margin: 0 }} onClick={() => setShowAddNotice(true)}>
                        + Create Notice 📢
                      </button>
                    </>
                  )
                ) : null}
              </div>
            </div>

            {notices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', background: '#f8fafc', borderRadius: '12px', color: '#94a3b8', border: '1px dashed #cbd5e1', marginTop: 16 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#475569' }}>No notices published yet</p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
                  {isClassTeacherAccess ? 'Click "+ Create Notice" above to publish a notice for students or faculty.' : 'Check back later for school updates.'}
                </p>
              </div>
            ) : (
              <div className="tp-notice-grid">
                {notices.map(n => {
                  const targets = normalizeRoles(n.targetRoles);
                  const isHighlighted = highlightedNoticeId === n.id;

                  return (
                    <div
                      key={n.id}
                      id={`notice-${n.id}`}
                      className={`tp-notice-card ${noticeDeleteMode && selectedNoticeIds.has(n.id) ? 'tp-card-selected' : ''} ${isHighlighted ? 'highlight' : ''}`}
                      onClick={noticeDeleteMode ? () => toggleSelectNotice(n.id) : undefined}
                      style={{ cursor: noticeDeleteMode ? 'pointer' : 'default', position: 'relative' }}
                    >
                      {noticeDeleteMode && (
                        <div className={`tp-roster-checkbox ${selectedNoticeIds.has(n.id) ? 'tp-cb-checked' : ''}`} style={{ position: 'absolute', top: 14, right: 14, zIndex: 2 }}>
                          {selectedNoticeIds.has(n.id) ? '✓' : ''}
                        </div>
                      )}
                      {/* Notice Author Profile Header */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        marginBottom: '12px',
                        paddingBottom: '10px',
                        borderBottom: '1px solid #f1f5f9',
                        flexWrap: 'wrap'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: n.authorRole === 'Principal'
                              ? 'linear-gradient(135deg, #7c3aed, #4c1d95)'
                              : n.authorRole === 'Class Teacher' || n.authorRole?.toLowerCase().includes('class teacher')
                                ? 'linear-gradient(135deg, #059669, #047857)'
                                : 'linear-gradient(135deg, #2563eb, #1e40af)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '800',
                            fontSize: '14px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                            flexShrink: 0
                          }}>
                            {n.authorAvatar ? (
                              <img src={n.authorAvatar} alt={n.authorName || 'Author'} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                              <span>{(n.authorName || (n.authorRole === 'Principal' ? 'P' : n.authorRole === 'Class Teacher' ? 'T' : 'A')).charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div>
                            <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a', lineHeight: 1.2 }}>
                              {n.authorName || (n.authorRole === 'Principal' ? 'Principal Office' : n.authorRole === 'Class Teacher' ? 'Class Teacher' : 'School Administration')}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                              <span style={{
                                fontSize: '11px',
                                fontWeight: '700',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                background: n.authorRole === 'Principal'
                                  ? '#f5f3ff'
                                  : n.authorRole === 'Class Teacher' || n.authorRole?.toLowerCase().includes('class teacher')
                                    ? '#ecfdf5'
                                    : '#eff6ff',
                                color: n.authorRole === 'Principal'
                                  ? '#6d28d9'
                                  : n.authorRole === 'Class Teacher' || n.authorRole?.toLowerCase().includes('class teacher')
                                    ? '#047857'
                                    : '#1d4ed8',
                                border: `1px solid ${n.authorRole === 'Principal' ? '#ddd6fe' : n.authorRole === 'Class Teacher' || n.authorRole?.toLowerCase().includes('class teacher') ? '#a7f3d0' : '#bfdbfe'}`
                              }}>
                                {n.authorRole === 'Principal' ? '🏛️ Principal' : n.authorRole === 'Class Teacher' || n.authorRole?.toLowerCase().includes('class teacher') ? `👨‍🏫 ${n.authorRole || 'Class Teacher'}` : '🛡️ Administrator'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <span className="tp-notice-date" style={{ margin: 0 }}>
                          🗓️ {n.date}
                        </span>
                      </div>

                      <div className="tp-notice-header" style={{ marginBottom: 8 }}>
                        <h3 className="tp-notice-title">{n.title}</h3>
                      </div>

                      <p className="tp-notice-desc">{n.desc}</p>

                      <div className="tp-target-tag-list" style={{ marginTop: 'auto', paddingTop: 8 }}>
                        {targets.map(role => (
                          <span key={role} className={`tp-target-tag ${role}`}>
                            {role === 'student' ? '🎓 Students' : role === 'teacher' ? '👨‍🏫 Teachers' : '🏛️ Principal'}
                          </span>
                        ))}
                      </div>

                      {n.fileData && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #e2e8f0' }}>
                          <a href={n.fileData} download={n.fileName || `notice-${n.id}`} style={{ color: '#f97316', fontWeight: 700, fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            📎 Download Attachment
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {showAddNotice && (isClassTeacherAccess || isSuperAdmin) && (
              <AddNoticeModal
                onClose={() => setShowAddNotice(false)}
                currentUser={{
                  name: profileName || user?.name || 'Class Teacher',
                  role: isSuperAdmin ? 'admin' : 'teacher',
                  accessMode: 'classTeacher',
                  classTeacherClassName: user?.classTeacherClassName || (classes[classTeacherClassIdxList[0]]?.className) || '',
                  userId: user?.userId || '',
                }}
                onAdd={(newN) => {
                  addNotice(newN, schoolProfile?.schoolId || activeSchoolId || 'PROGGA_DEFAULT');
                  setShowAddNotice(false);
                }}
                defaultRoles={['student', 'teacher', 'principal']}
              />
            )}
          </div>
        )}

        {/* ── Non-home placeholder pages (excluding notice and profile) ── */}
        {!isHome && activeNav !== 'profile' && activeNav !== 'notice' && (
          <div className="tp-placeholder">
            <div className="tp-placeholder-emoji">
              {activeNav === 'calendar' ? '📅' : activeNav === 'messages' ? '💬' : '👤'}
            </div>
            <p className="tp-placeholder-title">
              {navItems.find((n) => n.id === activeNav)?.label}
            </p>
            <p className="tp-placeholder-sub">Coming soon</p>
          </div>
        )}

      </main>

    </div>
  );
}
