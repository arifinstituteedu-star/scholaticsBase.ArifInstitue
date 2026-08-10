import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSchoolProfile } from '../context/SchoolProfileContext.jsx';
import { useRealtimeSyncContext } from '../context/RealtimeSyncContext.jsx';
import { SCHOOL_BRANCHES, filterClassesByBranch, sortClasses, getActiveBranchKeys } from '../utils/schoolResolver.js';
import ResultEntry from './ResultEntry.jsx';
import ExamResultView from './ExamResultView.jsx';
import PrincipalFeeApprovals from './PrincipalFeeApprovals.jsx';
import { getPendingTransactions, subscribeToFeeUpdates as subscribeToFeeUpdatesUtils } from '../utils/feeResolver.js';
import { subscribeToTeacherPanelData, getUserAccountFresh } from '../firebase/firestoreSchema.js';
import { getNotices, addNotice, deleteNotices as deleteNoticesStorage, subscribeToNoticeUpdates, normalizeRoles } from '../utils/noticeStorage.js';
import { readStorage, writeStorage } from '../utils/schoolData.js';
import SectionErrorBoundary from './SectionErrorBoundary.jsx';
import NotificationBell from './NotificationBell.jsx';
import SafeImage from './SafeImage.jsx';
import AddNoticeModal from './AddNoticeModal.jsx';

/* ─────────────────────────────────────────────────────────────
   Branch display order
   ───────────────────────────────────────────────────────────── */
const BRANCH_ORDER = ['primary', 'secondary', 'college'];

const CLASS_COLORS = [
  '#4a90e2', '#38b26e', '#8b5cf6', '#f97316', '#0ea5a4',
  '#e11d48', '#d97706', '#0284c7', '#7c3aed', '#059669',
  '#2563eb', '#16a34a', '#dc2626',
];

/* ─────────────────────────────────────────────────────────────
   SVG Icons
   ───────────────────────────────────────────────────────────── */
const HamburgerIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <line x1="3.5" y1="6" x2="20.5" y2="6" />
    <line x1="3.5" y1="12" x2="20.5" y2="12" />
    <line x1="3.5" y1="18" x2="20.5" y2="18" />
  </svg>
);
const LogoutIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
const ChevronRight = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const ChevronLeft = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const DirectoryIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const ResultEntryIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <rect x="5" y="2" width="14" height="20" rx="2" /><line x1="9" y1="7" x2="15" y2="7" /><line x1="9" y1="11" x2="15" y2="11" /><line x1="9" y1="15" x2="13" y2="15" />
  </svg>
);
const TranscriptIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="15" y2="17" />
  </svg>
);
const KeyIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);
const FeeIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
  </svg>
);
const NoticeIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

/* ─────────────────────────────────────────────────────────────
   BranchCard — Level 1 overview card for a branch
   ───────────────────────────────────────────────────────────── */
function BranchCard({ branch, classCount, studentCount, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: 'none',
        borderRadius: 16,
        padding: '28px 24px',
        background: hovered
          ? `linear-gradient(135deg, ${branch.gradientFrom} 0%, ${branch.gradientTo} 100%)`
          : '#fff',
        boxShadow: hovered
          ? `0 8px 32px ${branch.color}40`
          : '0 2px 12px rgba(0,0,0,0.07)',
        cursor: 'pointer',
        transition: 'all 0.22s cubic-bezier(.4,0,.2,1)',
        transform: hovered ? 'translateY(-4px) scale(1.02)' : 'none',
        textAlign: 'left',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        outline: `2px solid ${hovered ? branch.color : 'transparent'}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: hovered ? 'rgba(255,255,255,0.18)' : `${branch.color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, flexShrink: 0,
        }}>
          {branch.emoji}
        </div>
        <div style={{
          background: hovered ? 'rgba(255,255,255,0.22)' : `${branch.color}12`,
          borderRadius: 8, padding: '4px 10px', fontSize: 12,
          fontWeight: 700, color: hovered ? '#fff' : branch.color, alignSelf: 'flex-start',
        }}>
          {classCount} Classes
        </div>
      </div>

      <div>
        <p style={{
          margin: '0 0 4px', fontSize: 13, fontWeight: 800, letterSpacing: '.04em',
          textTransform: 'uppercase', color: hovered ? 'rgba(255,255,255,0.7)' : '#94a3b8',
        }}>{branch.shortName}</p>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, lineHeight: 1.3, color: hovered ? '#fff' : '#1a2e4a' }}>
          {branch.name}
        </h3>
      </div>

      <div style={{ display: 'flex', gap: 20, borderTop: `1px solid ${hovered ? 'rgba(255,255,255,0.2)' : '#f1f5f9'}`, paddingTop: 14 }}>
        <div>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: hovered ? '#fff' : branch.color }}>{studentCount}</p>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: hovered ? 'rgba(255,255,255,0.65)' : '#94a3b8' }}>STUDENTS</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: hovered ? '#fff' : branch.color }}>{classCount}</p>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: hovered ? 'rgba(255,255,255,0.65)' : '#94a3b8' }}>CLASSES</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: hovered ? '#fff' : branch.color, marginTop: -4 }}>
        View Classes <ChevronRight />
      </div>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   ClassCard — Level 2 card for a single class within a branch
   ───────────────────────────────────────────────────────────── */
function ClassCard({ cls, color, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: 'none', borderRadius: 14, padding: '20px 18px',
        background: hovered ? color : '#fff',
        boxShadow: hovered ? `0 6px 24px ${color}40` : '0 2px 10px rgba(0,0,0,0.06)',
        cursor: 'pointer', transition: 'all 0.2s cubic-bezier(.4,0,.2,1)',
        transform: hovered ? 'translateY(-3px)' : 'none',
        textAlign: 'left', width: '100%',
        outline: `2px solid ${hovered ? color : 'transparent'}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: hovered ? 'rgba(255,255,255,0.22)' : `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>
          🏫
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: hovered ? 'rgba(255,255,255,0.7)' : '#94a3b8',
          background: hovered ? 'rgba(255,255,255,0.15)' : '#f1f5f9',
          padding: '3px 8px', borderRadius: 6,
        }}>
          {cls.students?.length || 0} students
        </span>
      </div>
      <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: hovered ? '#fff' : '#1a2e4a' }}>{cls.className}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: hovered ? 'rgba(255,255,255,0.8)' : color, marginTop: 10 }}>
        View Roster <ChevronRight />
      </div>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   StudentRosterTable — Level 3 full roster
   ───────────────────────────────────────────────────────────── */
function StudentRosterTable({ cls, color }) {
  if (!cls.students || cls.students.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px', color: '#94a3b8' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
        <p style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>No students enrolled</p>
        <p style={{ fontSize: 13, marginTop: 6 }}>Add students via the Admin panel.</p>
      </div>
    );
  }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <span style={{
          background: `${color}15`, color, borderRadius: 8, padding: '5px 14px',
          fontSize: 13, fontWeight: 700, border: `1px solid ${color}30`,
        }}>
          🎓 {(cls.students || []).length} Student{(cls.students || []).length !== 1 ? 's' : ''} Enrolled
        </span>
      </div>
      <div className="tp-table-container" style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #e2e8f0' }}>
        <table style={{ width: '100%', minWidth: 540, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: `${color}12` }}>
              {['Roll', 'Student Name', 'ID', 'Age', 'Guardian', 'Status'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: h === 'Status' ? 'center' : 'left', fontWeight: 700, color, borderBottom: `2px solid ${color}30`, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(cls.students || []).map((student, idx) => (
              <tr key={student.id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafbfc' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: '#64748b', fontSize: 13 }}>
                  #{String(student.roll || (idx + 1)).padStart(2, '0')}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {student.profilePic ? (
                      <img src={student.profilePic} alt={student.name} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                        {(student.name || 'S').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span style={{ fontWeight: 700, color: '#1a2e4a', fontSize: 14 }}>{student.name}</span>
                  </div>
                </td>
                <td style={{ padding: '12px 16px', color: '#64748b', fontFamily: 'monospace', fontSize: 12 }}>{student.id || '—'}</td>
                <td style={{ padding: '12px 16px', color: '#475569', fontWeight: 600 }}>{student.age || '—'}</td>
                <td style={{ padding: '12px 16px', color: '#475569' }}>{student.fatherName || student.motherName || '—'}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <span style={{ background: '#d1fae5', color: '#065f46', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>Active ✓</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Breadcrumb
   ───────────────────────────────────────────────────────────── */
function Breadcrumb({ items }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
      marginBottom: 20, padding: '10px 16px', background: '#f8fafc',
      borderRadius: 10, border: '1px solid #e2e8f0',
    }}>
      {items.map((item, idx) => (
        <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {idx > 0 && <ChevronRight />}
          {item.onClick ? (
            <button onClick={item.onClick} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#2563eb', fontWeight: 700, fontSize: 13, padding: 0, textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
              {item.label}
            </button>
          ) : (
            <span style={{ fontWeight: 700, color: '#1a2e4a', fontSize: 13 }}>{item.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   Main PrincipalDashboard Component
   ═════════════════════════════════════════════════════════════ */
export default function PrincipalDashboard() {
  const { user, signOut, createUser, deleteUser } = useAuth();
  const viewerUid = String(user?.userId || '').trim().toLowerCase();
  const isViewerSuperAdmin = !!(user?.isSuperAdmin || viewerUid === '@@siam##' || String(user?.role || '').toLowerCase() === 'superadmin');
  const { liveUsersVersion } = useRealtimeSyncContext();
  const { schoolProfile: rawSchoolProfile } = useSchoolProfile();
  const schoolProfile = rawSchoolProfile || { schoolName: 'ScholasticBase', logo: '', adminEmail: 'admin@scholasticbase.edu' };

  const [activeSection, setActiveSection] = useState('directories');
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedBranchKey, setSelectedBranchKey] = useState(null);
  const [selectedClassIdx, setSelectedClassIdx] = useState(null);

  // Real-time observers
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);

  // User Management
  const [accountForm, setAccountForm] = useState({ userId: '', name: '', password: '', role: 'student', classTeacherKey: '', classTeacherClassIdxList: [] });
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [accountStatus, setAccountStatus] = useState('');
  const [accountError, setAccountError] = useState('');
  const [registeredAccounts, setRegisteredAccounts] = useState({});
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [showAllPasswords, setShowAllPasswords] = useState(false);
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [usernameAvailability, setUsernameAvailability] = useState({ checking: false, available: null, message: '' });

  // Real-time username availability checker effect
  useEffect(() => {
    const rawInput = String(accountForm.userId || '').trim();
    if (!rawInput) {
      setUsernameAvailability({ checking: false, available: null, message: '' });
      return;
    }

    const lowerInput = rawInput.toLowerCase();

    let isTakenLocally = false;
    let localRole = '';

    const localMatch = Object.values(registeredAccounts).find(
      acc => String(acc?.userId || '').trim().toLowerCase() === lowerInput
    );
    if (localMatch) {
      isTakenLocally = true;
      localRole = localMatch.role || 'user';
    }

    if (!isTakenLocally) {
      try {
        const rawUsers = window.localStorage.getItem('schoolAppLocalUsers');
        if (rawUsers) {
          const parsed = JSON.parse(rawUsers);
          const foundKey = Object.keys(parsed).find(k => k.toLowerCase() === lowerInput);
          if (foundKey && parsed[foundKey]) {
            isTakenLocally = true;
            localRole = parsed[foundKey].role || 'user';
          }
        }
      } catch {
        // ignore
      }
    }

    if (isTakenLocally) {
      setUsernameAvailability({
        checking: false,
        available: false,
        message: `❌ Username "${rawInput}" is not available (${localRole.toUpperCase()} account exists)`,
      });
      return;
    }

    setUsernameAvailability({ checking: true, available: null, message: 'Checking username availability...' });

    let isMounted = true;
    const timer = setTimeout(async () => {
      try {
        const remoteUser = await getUserAccountFresh(rawInput);
        if (!isMounted) return;
        if (remoteUser) {
          const remoteRole = String(remoteUser.role || 'user').toUpperCase();
          setUsernameAvailability({
            checking: false,
            available: false,
            message: `❌ Username "${rawInput}" is not available (${remoteRole} account exists)`,
          });
        } else {
          setUsernameAvailability({
            checking: false,
            available: true,
            message: `✓ Username "${rawInput}" is available!`,
          });
        }
      } catch {
        if (!isMounted) return;
        setUsernameAvailability({
          checking: false,
          available: true,
          message: `✓ Username "${rawInput}" is available`,
        });
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [accountForm.userId, registeredAccounts]);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const activeSchoolId = schoolProfile?.schoolId || schoolProfile?.schoolCode || schoolProfile?.eiinNumber || 'PROGGA_DEFAULT';
  const [notices, setNotices] = useState(() => getNotices(activeSchoolId));
  const [highlightedNoticeId, setHighlightedNoticeId] = useState(null);
  const [showAddNotice, setShowAddNotice] = useState(false);

  useEffect(() => {
    setNotices(getNotices(activeSchoolId));
    const unsub = subscribeToNoticeUpdates((updatedNotices) => {
      setNotices(updatedNotices);
    }, activeSchoolId);
    return () => unsub();
  }, [activeSchoolId]);

  // Dynamic Class Synchronization
  useEffect(() => {
    let active = true;

    const cachedClasses = readStorage('teacherPanelClasses', null, activeSchoolId);
    const cachedTeachers = readStorage('teacherPanelTeachers', null, activeSchoolId);
    if (cachedClasses) setClasses(cachedClasses);
    if (cachedTeachers) setTeachers(cachedTeachers);

    const unsubscribe = subscribeToTeacherPanelData((docSnap) => {
      if (!active) return;
      if (docSnap && docSnap.exists()) {
        const remoteData = docSnap.data();
        if (Array.isArray(remoteData.classes)) {
          setClasses(remoteData.classes);
          writeStorage('teacherPanelClasses', remoteData.classes, activeSchoolId);
        }
        if (Array.isArray(remoteData.teachers)) {
          setTeachers(remoteData.teachers);
          writeStorage('teacherPanelTeachers', remoteData.teachers, activeSchoolId);
        }
      }
    }, (err) => {
      console.warn('PrincipalDashboard Firestore listener failed:', err);
      try {
        const raw = readStorage('teacherPanelClasses', null, activeSchoolId);
        const rawTeachers = readStorage('teacherPanelTeachers', null, activeSchoolId);
        if (raw) setClasses(raw);
        if (rawTeachers) setTeachers(rawTeachers);
      } catch { }
    }, activeSchoolId);

    return () => {
      active = false;
      unsubscribe();
    };
  }, [activeSchoolId]);

  const loadAccounts = () => {
    try {
      const superAdminSeed = {
        '@@Siam##': { userId: '@@Siam##', name: 'Super Admin', password: '@SupaX', role: 'admin', isSuperAdmin: true },
        // NOTE: No default 'admin' account — passwords are set exclusively by SuperAdmin.
      };
      const raw = readStorage('schoolAppLocalUsers', null);
      if (!raw) {
        setRegisteredAccounts(superAdminSeed);
        return;
      }
      delete raw['super'];
      delete raw['siam'];
      const result = { ...raw };
      result['@@Siam##'] = superAdminSeed['@@Siam##'];
      // Ensure no regular user holds the superAdmin flag
      Object.keys(result).forEach((k) => {
        if (k !== '@@Siam##' && result[k]?.isSuperAdmin) {
          result[k] = { ...result[k], isSuperAdmin: false };
        }
      });
      setRegisteredAccounts(result);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [liveUsersVersion]);

  useEffect(() => {
    const handleUsersUpdate = () => loadAccounts();
    window.addEventListener('schoolUsersUpdate', handleUsersUpdate);
    return () => window.removeEventListener('schoolUsersUpdate', handleUsersUpdate);
  }, []);

  // Profile lookup options
  const safeTeachers = Array.isArray(teachers) ? teachers : [];
  const safeClasses = Array.isArray(classes) ? classes : [];

  const teacherProfiles = Array.from(
    safeTeachers.reduce((map, teacher, idx) => {
      if (!teacher) return map;

      const isObj = typeof teacher === 'object' && teacher !== null;
      const rawName = isObj ? (teacher.name ?? '') : String(teacher);
      const safeName = String(rawName || '').trim();
      const safeEmail = isObj ? String(teacher.email || '').trim() : '';

      const normalizedKey = `${safeName.toLowerCase()}|${safeEmail.toLowerCase()}`;
      if (map.has(normalizedKey)) return map;

      const nameSlug = safeName
        ? safeName.replace(/\s+/g, '_').toLowerCase()
        : `teacher_${idx + 1}`;
      const fallbackUserId = `${nameSlug}-${idx}`;

      const displayName = safeName || `Teacher ${idx + 1}`;
      const displayLabel = safeEmail ? `${displayName} (${safeEmail})` : displayName;

      map.set(normalizedKey, {
        key: `${safeEmail || safeName || `teacher-${idx}`}-${idx}`,
        name: displayName,
        label: displayLabel,
        userId: safeEmail || fallbackUserId,
        role: 'teacher',
      });
      return map;
    }, new Map()).values()
  );

  const studentProfiles = safeClasses.flatMap((cls, classIdx) => {
    const safeStudents = Array.isArray(cls?.students) ? cls.students : [];
    const className = String(cls?.className || `Class ${classIdx + 1}`).trim();

    return safeStudents.map((s, studentIdx) => {
      if (!s) {
        return {
          key: `stu-${className}-${studentIdx}`,
          name: `Student ${studentIdx + 1}`,
          label: `Student ${studentIdx + 1} — ${className}`,
          userId: `student_${studentIdx + 1}`,
          role: 'student',
        };
      }

      const isObj = typeof s === 'object' && s !== null;
      const rawName = isObj ? (s.name ?? '') : String(s);
      const safeStudentName = String(rawName || '').trim() || `Student ${studentIdx + 1}`;
      const safeStudentId = isObj ? String(s.id || s.roll || '').trim() : '';

      const nameSlug = safeStudentName.replace(/\s+/g, '_').toLowerCase();
      const studentUserId = safeStudentId || nameSlug;

      return {
        key: `${safeStudentId || safeStudentName || 'stu'}-${className}-${studentIdx}`,
        name: safeStudentName,
        label: `${safeStudentName} — ${className}`,
        userId: studentUserId,
        role: 'student',
      };
    });
  });

  const profileOptions = (accountForm.role === 'teacher' || accountForm.role === 'class_teacher')
    ? teacherProfiles
    : accountForm.role === 'student'
      ? studentProfiles
      : [];

  const handleProfileSelect = (profileId) => {
    setSelectedProfileId(profileId);
    const profile = profileOptions.find((p) => p.key === profileId);
    if (profile) {
      setAccountForm((prev) => ({
        ...prev,
        name: profile.name,
        userId: profile.userId,
      }));
    }
  };

  const handleCreateAccountSubmit = async (e) => {
    e.preventDefault();
    setAccountStatus('');
    setAccountError('');
    if (!accountForm.userId.trim() || !accountForm.name.trim() || !accountForm.password.trim()) {
      setAccountError('Please fill in all fields.');
      return;
    }
    if (usernameAvailability.available === false) {
      setAccountError('Username is already taken. Please choose a different Username / User ID.');
      return;
    }
    if ((accountForm.role === 'admin' || accountForm.role === 'principal') && !user?.isSuperAdmin) {
      setAccountError('Only Super Admin can create Admin or Principal accounts.');
      return;
    }
    if (accountForm.role === 'class_teacher') {
      if (!accountForm.classTeacherKey.trim()) {
        setAccountError('Please enter a Class Teacher Login Key for Class Teacher account.');
        return;
      }
      if (accountForm.classTeacherClassIdxList.length === 0) {
        setAccountError('Please select at least one assigned class for this Class Teacher.');
        return;
      }
    } else if (accountForm.role === 'teacher' && accountForm.classTeacherKey.trim() && accountForm.classTeacherClassIdxList.length === 0) {
      setAccountError('Please select at least one assigned class for this class teacher key.');
      return;
    }
    try {
      const assignedClassNames = accountForm.classTeacherClassIdxList.map(idx => classes[Number(idx)]?.className || '').filter(Boolean);
      const targetRole = accountForm.role === 'class_teacher' ? 'teacher' : accountForm.role;
      await createUser({
        userId: accountForm.userId.trim(),
        name: accountForm.name.trim(),
        password: accountForm.password.trim(),
        role: targetRole,
        classTeacherKey: accountForm.classTeacherKey,
        classTeacherClassIdxList: accountForm.classTeacherClassIdxList,
        classTeacherClassNames: assignedClassNames,
        classTeacherClassIdx: accountForm.classTeacherClassIdxList[0] ?? '',
        classTeacherClassName: assignedClassNames[0] || '',
        allowUpdate: false,
      });
      setAccountStatus(`Successfully created ${accountForm.role === 'class_teacher' ? 'Class Teacher' : accountForm.role} account "${accountForm.userId}".`);
      setAccountForm({ userId: '', name: '', password: '', role: 'student', classTeacherKey: '', classTeacherClassIdxList: [] });
      setSelectedProfileId('');
      loadAccounts();
    } catch (err) {
      setAccountError(err.message || 'Error creating user.');
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const executeDelete = async () => {
    if (activeSection === 'notices') {
      deleteNoticesStorage(Array.from(selectedIds), activeSchoolId);
      setSelectedIds(new Set());
      setDeleteMode(false);
      return;
    }
    const isViewerSuperAdmin = !!(user?.isSuperAdmin || String(user?.userId || '').trim().toLowerCase() === '@@siam##' || String(user?.role || '').toLowerCase() === 'superadmin');
    const idsToDelete = Array.from(selectedIds).filter(id => {
      const trimmed = String(id).trim().toLowerCase();
      if (trimmed === '@@siam##') return false;
      if (user?.userId && String(user.userId).trim().toLowerCase() === trimmed) return false;
      const acc = registeredAccounts[id];
      if (acc && acc.isSuperAdmin) return false;
      if (!isViewerSuperAdmin) {
        const role = String(acc?.role || '').toLowerCase();
        if (role === 'admin' || role === 'principal') return false;
      }
      return true;
    });
    if (idsToDelete.length === 0) {
      setAccountStatus(isViewerSuperAdmin ? 'Super Admin and active session accounts cannot be deleted.' : 'Admin and Principal accounts cannot be deleted by non-Super Admin.');
      setAccountError('');
      setSelectedIds(new Set());
      setDeleteMode(false);
      return;
    }

    for (const id of idsToDelete) {
      try {
        await deleteUser(id);
      } catch (err) {
        console.warn('Unable to remove login account', err);
      }
    }
    loadAccounts();
    setAccountStatus(`Removed ${idsToDelete.length} login account${idsToDelete.length > 1 ? 's' : ''}.`);
    setAccountError('');
    setSelectedIds(new Set());
    setDeleteMode(false);
  };

  const branchMetrics = BRANCH_ORDER.reduce((acc, key) => {
    const branchClasses = filterClassesByBranch(classes, key);
    const studentCount = branchClasses.reduce((sum, cls) => sum + (cls.students?.length || 0), 0);
    acc[key] = { classCount: branchClasses.length, studentCount, classes: branchClasses };
    return acc;
  }, {});

  const handleSectionChange = (section) => {
    setActiveSection(section);
    setSelectedBranchKey(null);
    setSelectedClassIdx(null);
    setMenuOpen(false);
    setDeleteMode(false);
    setSelectedIds(new Set());
    setShowAddNotice(false);
  };

  const branchClasses = selectedBranchKey ? branchMetrics[selectedBranchKey]?.classes || [] : [];
  const selectedClass = selectedClassIdx !== null ? branchClasses[selectedClassIdx] : null;
  const totalStudents = classes.reduce((sum, cls) => sum + (cls.students?.length || 0), 0);

  const breadcrumbItems = (() => {
    const items = [{ label: 'All Branches', onClick: () => { setSelectedBranchKey(null); setSelectedClassIdx(null); } }];
    if (selectedBranchKey) {
      const branch = SCHOOL_BRANCHES[selectedBranchKey];
      items.push({ label: branch.shortName, onClick: selectedClassIdx !== null ? () => setSelectedClassIdx(null) : null });
    }
    if (selectedClass) items.push({ label: selectedClass.className, onClick: null });
    return items;
  })();

  const [pendingTxCount, setPendingTxCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      setPendingTxCount(getPendingTransactions().length);
    };
    updateCount();
    const unsub = subscribeToFeeUpdatesUtils(updateCount);
    return () => unsub();
  }, []);

  const navItems = [
    { id: 'directories', label: 'Student Directories', Icon: DirectoryIcon },
    { id: 'result_entry', label: 'Branch Result Entry', Icon: ResultEntryIcon },
    { id: 'transcripts', label: 'View Branch Transcripts', Icon: TranscriptIcon },
    { id: 'notices', label: `Notice Board (${notices.length})`, Icon: NoticeIcon },
    { id: 'fee_approvals', label: `Transaction ID Approvals ${pendingTxCount > 0 ? `(${pendingTxCount})` : ''}`, Icon: FeeIcon },
    { id: 'user_management', label: 'User Account Management', Icon: KeyIcon },
  ];

  return (
    <div className="tp-shell">
      {/* Mobile drawer overlay */}
      <div className={`tp-drawer-overlay ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)}>
        <div className="tp-drawer" onClick={e => e.stopPropagation()}>
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
            {navItems.map(item => (
              <button key={item.id} className={`tp-sidebar-nav-item${activeSection === item.id ? ' active' : ''}`} onClick={() => handleSectionChange(item.id)}>
                <item.Icon /> {item.label}
              </button>
            ))}
          </div>
          <div className="tp-drawer-bottom" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p className="tp-drawer-label" style={{ margin: 0 }}>Signed in as</p>
            <p className="tp-drawer-name" style={{ margin: 0 }}>{user?.name || 'Principal'}</p>
            <p className="tp-drawer-role" style={{ margin: 0 }}>Role: Principal (HOI)</p>
            <button className="tp-drawer-signout" onClick={signOut} style={{ margin: '8px 0 0' }}>Sign Out</button>
            <div className="tp-sidebar-footer" style={{ fontSize: 10.5, color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: 10, lineHeight: 1.4 }}>
              <div style={{ fontWeight: 600 }}>© 2026 {schoolProfile.schoolName || 'Progga'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className="tp-sidebar">
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

        {/* Principal badge */}
        <div style={{
          margin: '4px 4px 12px', padding: '8px 12px',
          background: 'linear-gradient(135deg, #4c1d95 0%, #6d28d9 100%)',
          borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 18 }}>🏛️</span>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Principal</p>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#fff' }}>Full Access</p>
          </div>
        </div>

        <nav className="tp-sidebar-nav">
          {navItems.map(item => (
            <button key={item.id} className={`tp-sidebar-nav-item${activeSection === item.id ? ' active' : ''}`} onClick={() => handleSectionChange(item.id)} title={item.label}>
              <item.Icon /> <span className="tp-sidebar-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="tp-sidebar-bottom" style={{ marginTop: 'auto' }}>
          <div className="tp-sidebar-divider" />

          <div className="tp-sidebar-user-info" style={{ padding: '0 4px', marginBottom: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1a2e4a', margin: '0 0 2px' }}>{user?.name || 'Principal'}</p>
            <p style={{ fontSize: 11.5, color: '#7c3aed', margin: 0, fontWeight: 700 }}>Principal (HOI)</p>
          </div>
          <button className="tp-sidebar-signout" onClick={signOut}>
            <LogoutIcon /> <span className="tp-sidebar-label">Sign Out</span>
          </button>

          <div className="tp-sidebar-footer" style={{ padding: '12px 4px 0', fontSize: 10.5, color: '#94a3b8', borderTop: '1px solid #e2e8f0', marginTop: 12, lineHeight: 1.5 }}>
            <div style={{ fontWeight: 600 }}>© 2026 {schoolProfile.schoolName || 'Progga'}</div>
            <div>Admin: <a href={`mailto:${schoolProfile.adminEmail}`} style={{ color: '#7c3aed', fontWeight: 600, textDecoration: 'none' }}>{schoolProfile.adminEmail}</a></div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="tp-main">
        {/* Topbar */}
        <div className="tp-topbar">
          <button className="tp-icon-btn tp-hamburger" onClick={() => setMenuOpen(true)} aria-label="Menu"><HamburgerIcon /></button>
          <div className="tp-topbar-greeting">
            <div className="tp-topbar-title-row">
              <span className="tp-greeting-badge">🏛️</span>
              <h2>Principal <span className="tp-user-name">Control Panel</span></h2>
            </div>
            <p className="tp-topbar-subtitle">
              <span>{schoolProfile?.schoolName || 'Institution'}</span>
              <span className="tp-sub-dot">•</span>
              <span>Head of Institution</span>
            </p>
          </div>
          <div className="tp-topbar-right">
            <NotificationBell
              userRole="principal"
              userId={user?.userId || 'principal'}
              activeSchoolId={activeSchoolId}
            />
            <button
              className="tp-logout-btn"
              onClick={signOut}
              aria-label="Logout"
            >
              <LogoutIcon /> <span>Logout</span>
            </button>
          </div>
        </div>

        {/* ══ Student Directories ══ */}
        {activeSection === 'directories' && (
          <div style={{ padding: '24px 20px' }}>

            {/* Level 1: Branch overview cards */}
            {!selectedBranchKey && (
              <>
                <div className="tp-hero" style={{ marginBottom: 24 }}>
                  <div className="tp-greeting">
                    <h1>Student Directories</h1>
                    <p>Browse all students across the three institutional branches.</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    <p style={{ fontSize: 28, fontWeight: 800, color: '#7c3aed', margin: 0 }}>{totalStudents}</p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: 0, textTransform: 'uppercase', letterSpacing: '.05em' }}>Total Students</p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 20 }}>
                  {getActiveBranchKeys(schoolProfile).map(key => {
                    const branch = SCHOOL_BRANCHES[key];
                    const metrics = branchMetrics[key];
                    return (
                      <BranchCard
                        key={key}
                        branch={branch}
                        classCount={metrics.classCount}
                        studentCount={metrics.studentCount}
                        onClick={() => { setSelectedBranchKey(key); setSelectedClassIdx(null); }}
                      />
                    );
                  })}
                </div>
              </>
            )}

            {/* Level 2: Classes within a branch */}
            {selectedBranchKey && selectedClassIdx === null && (
              <>
                <Breadcrumb items={breadcrumbItems} />
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22,
                  padding: '18px 20px', borderRadius: 14,
                  background: `linear-gradient(135deg, ${SCHOOL_BRANCHES[selectedBranchKey].gradientFrom} 0%, ${SCHOOL_BRANCHES[selectedBranchKey].gradientTo} 100%)`,
                  boxShadow: `0 4px 20px ${SCHOOL_BRANCHES[selectedBranchKey].color}40`,
                }}>
                  <span style={{ fontSize: 32 }}>{SCHOOL_BRANCHES[selectedBranchKey].emoji}</span>
                  <div>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      {SCHOOL_BRANCHES[selectedBranchKey].shortName}
                    </p>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff' }}>{SCHOOL_BRANCHES[selectedBranchKey].name}</h2>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                      {branchMetrics[selectedBranchKey].classCount} Classes · {branchMetrics[selectedBranchKey].studentCount} Students
                    </p>
                  </div>
                </div>

                {branchClasses.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 24px', color: '#94a3b8' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🏫</div>
                    <p style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>No classes in this branch yet</p>
                    <p style={{ fontSize: 13, marginTop: 6 }}>Classes are managed in the Admin panel.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: 16 }}>
                    {branchClasses.map((cls, idx) => (
                      <ClassCard
                        key={cls.className}
                        cls={cls}
                        color={CLASS_COLORS[idx % CLASS_COLORS.length]}
                        onClick={() => setSelectedClassIdx(idx)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Level 3: Student roster */}
            {selectedBranchKey && selectedClassIdx !== null && selectedClass && (
              <>
                <Breadcrumb items={breadcrumbItems} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 50, height: 50, borderRadius: 14, background: SCHOOL_BRANCHES[selectedBranchKey].color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🏫</div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1a2e4a' }}>{selectedClass.className}</h2>
                      <p style={{ margin: 0, fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                        {SCHOOL_BRANCHES[selectedBranchKey].shortName} · {selectedClass.students?.length || 0} Students Enrolled
                      </p>
                    </div>
                  </div>
                  <button
                    className="tp-back-btn"
                    onClick={() => setSelectedClassIdx(null)}
                    title="Back to Classes"
                    aria-label="Back to Classes"
                  >
                    <ChevronLeft />
                  </button>
                </div>
                <StudentRosterTable cls={selectedClass} color={SCHOOL_BRANCHES[selectedBranchKey].color} />
              </>
            )}
          </div>
        )}

        {/* ══ Branch Result Entry ══ */}
        {activeSection === 'result_entry' && (
          <div style={{ padding: 'clamp(12px, 3vw, 24px) clamp(10px, 3vw, 20px)' }}>
            <div className="tp-hero" style={{ marginBottom: 24 }}>
              <div className="tp-greeting">
                <h1>Branch Result Entry</h1>
                <p>Enter and manage academic results across all branches. Full read/write access enabled.</p>
              </div>
            </div>
            <ResultEntry
              classes={classes}
              currentTeacherProfile={null}
              currentTeacherAssignments={[]}
              readOnly={false}
            />
          </div>
        )}

        {/* ══ View Branch Transcripts ══ */}
        {activeSection === 'transcripts' && (
          <div style={{ padding: 'clamp(12px, 3vw, 24px) clamp(10px, 3vw, 20px)' }}>
            <div className="tp-hero" style={{ marginBottom: 24 }}>
              <div className="tp-greeting">
                <h1>View Branch Transcripts</h1>
                <p>Browse and manage exam result archives across all three institutional branches.</p>
              </div>
            </div>
            <ExamResultView
              classes={classes}
              defaultToEntry={false}
              readOnly={false}
            />
          </div>
        )}

        {/* ══ Notice Board ══ */}
        {activeSection === 'notices' && (
          <div style={{ padding: '24px clamp(16px, 3vw, 32px)' }}>
            <div className="tp-notice-toolbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h2 className="tp-section-title" style={{ margin: 0, fontSize: 22 }}>📢 Notice Board</h2>
                <span className="tp-roster-badge" style={{ background: '#ede9fe', color: '#6d28d9', borderColor: '#ddd6fe', fontSize: 13, padding: '4px 12px', borderRadius: 20, fontWeight: 700 }}>
                  {notices.length} Public Notice{notices.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {deleteMode ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>{selectedIds.size} selected</span>
                    <button className="tp-delete-cancel-btn" onClick={() => { setDeleteMode(false); setSelectedIds(new Set()); }}>Cancel</button>
                    <button className="tp-delete-exec-btn" disabled={selectedIds.size === 0} onClick={executeDelete}>Delete Selected</button>
                  </div>
                ) : (
                  <>
                    <button className="tp-delete-toggle-btn" onClick={() => setDeleteMode(true)} disabled={notices.length === 0} style={{ margin: 0 }}>🗑️ Select to Remove</button>
                    <button className="tp-add-student-btn" style={{ background: '#7c3aed', margin: 0 }} onClick={() => setShowAddNotice(true)}>
                      + Create Notice
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="tp-notice-grid">
              {notices.map(n => {
                const targets = normalizeRoles(n.targetRoles);
                const isHighlighted = highlightedNoticeId === n.id;

                return (
                  <div
                    key={n.id}
                    id={`notice-${n.id}`}
                    className={`tp-notice-card ${deleteMode && selectedIds.has(n.id) ? 'tp-card-selected' : ''} ${isHighlighted ? 'highlight' : ''}`}
                    onClick={deleteMode ? () => toggleSelect(n.id) : undefined}
                    style={{ cursor: deleteMode ? 'pointer' : 'default', position: 'relative' }}
                  >
                    {deleteMode && (
                      <div className={`tp-roster-checkbox ${selectedIds.has(n.id) ? 'tp-cb-checked' : ''}`} style={{ position: 'absolute', top: 14, right: 14, zIndex: 2 }}>
                        {selectedIds.has(n.id) ? '✓' : ''}
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
                        <a href={n.fileData} download={n.fileName || `notice-${n.id}`} style={{ color: '#7c3aed', fontWeight: 700, fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          📎 Download Attachment
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {showAddNotice && (
              <AddNoticeModal
                onClose={() => setShowAddNotice(false)}
                currentUser={{
                  name: user?.name || schoolProfile?.principalName || 'Principal Dr. Rahman',
                  role: 'principal',
                  userId: user?.userId || 'principal',
                  profilePic: user?.profilePic || schoolProfile?.logo || '',
                }}
                onAdd={(newN) => {
                  addNotice(newN, activeSchoolId);
                  setShowAddNotice(false);
                }}
                defaultRoles={['student', 'teacher', 'principal']}
              />
            )}
          </div>
        )}

        {/* ══ Transaction ID Approvals ══ */}
        {activeSection === 'fee_approvals' && (
          <div style={{ padding: '24px 20px' }}>
            <SectionErrorBoundary sectionName="Principal Fee Approvals">
              <PrincipalFeeApprovals currentUser={user} />
            </SectionErrorBoundary>
          </div>
        )}

        {/* ══ User Account Management ══ */}
        {activeSection === 'user_management' && (
          <div style={{ padding: '24px 20px' }}>
            <div className="tp-hero" style={{ marginBottom: 24 }}>
              <div className="tp-greeting">
                <h1>User Account Management</h1>
                <p>Manage and provision credentials for Students, Teachers, and staff accounts. Provisioned logins sync to Firestore.</p>
              </div>
            </div>

            {/* Create Account Form Card */}
            <div className="uc-card">
              <div className="uc-card-header">
                <div className="uc-card-icon" style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)' }}>⚡</div>
                <div className="uc-card-title-group">
                  <h3>Create User Account</h3>
                  <p>Provision login credentials for Students, Teachers, Admins, & Staff</p>
                </div>
              </div>

              <form onSubmit={handleCreateAccountSubmit}>
                {/* Role Selector Grid */}
                <div className="uc-form-group uc-form-full" style={{ marginBottom: 16 }}>
                  <label className="uc-role-selector-label">Select Account Role</label>
                  <div className="uc-role-grid">
                    <button
                      type="button"
                      className={`uc-role-btn ${accountForm.role === 'student' ? 'active-student' : ''}`}
                      onClick={() => {
                        setAccountForm((prev) => ({ ...prev, role: 'student', userId: '', name: '', classTeacherKey: '', classTeacherClassIdxList: [] }));
                        setSelectedProfileId('');
                      }}
                    >
                      <span>🎓 Student</span>
                    </button>
                    <button
                      type="button"
                      className={`uc-role-btn ${accountForm.role === 'teacher' ? 'active-teacher' : ''}`}
                      onClick={() => {
                        setAccountForm((prev) => ({ ...prev, role: 'teacher', userId: '', name: '', classTeacherKey: '', classTeacherClassIdxList: [] }));
                        setSelectedProfileId('');
                      }}
                    >
                      <span>👨‍🏫 Teacher</span>
                    </button>
                    <button
                      type="button"
                      className={`uc-role-btn ${accountForm.role === 'class_teacher' ? 'active-class_teacher' : ''}`}
                      onClick={() => {
                        setAccountForm((prev) => ({ ...prev, role: 'class_teacher', userId: '', name: '', classTeacherKey: '', classTeacherClassIdxList: [] }));
                        setSelectedProfileId('');
                      }}
                    >
                      <span>🏫 Class Teacher</span>
                    </button>
                    {user?.isSuperAdmin && (
                      <button
                        type="button"
                        className={`uc-role-btn ${accountForm.role === 'admin' ? 'active-admin' : ''}`}
                        onClick={() => {
                          setAccountForm((prev) => ({ ...prev, role: 'admin', userId: '', name: '', classTeacherKey: '', classTeacherClassIdxList: [] }));
                          setSelectedProfileId('');
                        }}
                      >
                        <span>⚡ System Admin</span>
                      </button>
                    )}
                    {user?.isSuperAdmin && (
                      <button
                        type="button"
                        className={`uc-role-btn ${accountForm.role === 'principal' ? 'active-principal' : ''}`}
                        onClick={() => {
                          setAccountForm((prev) => ({ ...prev, role: 'principal', userId: '', name: '', classTeacherKey: '', classTeacherClassIdxList: [] }));
                          setSelectedProfileId('');
                        }}
                      >
                        <span>👑 Principal</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="uc-form-grid">
                  {(accountForm.role === 'teacher' || accountForm.role === 'class_teacher' || accountForm.role === 'student') && (
                    <div className="uc-form-group uc-form-full">
                      <label className="uc-label">
                        <span>Pick Directory Profile</span>
                        <span style={{ fontSize: 11, fontWeight: 500, color: '#64748b' }}>Auto-fills name & ID</span>
                      </label>
                      <div className="uc-input-wrapper">
                        <span className="uc-input-icon">🔍</span>
                        <select
                          className="uc-input uc-select"
                          value={selectedProfileId}
                          onChange={e => handleProfileSelect(e.target.value)}
                        >
                          <option value="">Select existing profile to auto-fill...</option>
                          {profileOptions.map((profile) => (
                            <option key={profile.key} value={profile.key}>
                              {profile.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="uc-form-group">
                    <label className="uc-label">Full Name</label>
                    <div className="uc-input-wrapper">
                      <span className="uc-input-icon">👤</span>
                      <input
                        className="uc-input"
                        type="text"
                        placeholder="e.g. Samuel Green"
                        value={accountForm.name}
                        onChange={e => setAccountForm({ ...accountForm, name: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="uc-form-group">
                    <label className="uc-label">
                      <span>Username / User ID</span>
                      {usernameAvailability.available === true && (
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          ✓ Available
                        </span>
                      )}
                      {usernameAvailability.available === false && (
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          ❌ Taken
                        </span>
                      )}
                    </label>
                    <div className="uc-input-wrapper">
                      <span className="uc-input-icon">🆔</span>
                      <input
                        className={`uc-input ${usernameAvailability.available === true
                            ? 'uc-input-valid'
                            : usernameAvailability.available === false
                              ? 'uc-input-invalid'
                              : ''
                          }`}
                        type="text"
                        placeholder={(accountForm.role === 'teacher' || accountForm.role === 'class_teacher') ? 'Use teacher ID or email' : 'Use student ID or alias'}
                        value={accountForm.userId}
                        onChange={e => setAccountForm({ ...accountForm, userId: e.target.value })}
                        required
                      />
                      {usernameAvailability.checking && (
                        <span style={{ position: 'absolute', right: 14, fontSize: 13, color: '#2563eb' }}>
                          ⏳
                        </span>
                      )}
                    </div>

                    {/* Real-Time Availability Signal Badge */}
                    {usernameAvailability.message && (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 12,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 12px',
                          borderRadius: 8,
                          animation: 'ucSlideDown 0.2s ease-out',
                          background:
                            usernameAvailability.available === true
                              ? '#f0fdf4'
                              : usernameAvailability.available === false
                                ? '#fef2f2'
                                : '#eff6ff',
                          color:
                            usernameAvailability.available === true
                              ? '#15803d'
                              : usernameAvailability.available === false
                                ? '#b91c1c'
                                : '#1d4ed8',
                          border: `1px solid ${usernameAvailability.available === true
                              ? '#bbf7d0'
                              : usernameAvailability.available === false
                                ? '#fecaca'
                                : '#bfdbfe'
                            }`,
                        }}
                      >
                        <span>{usernameAvailability.message}</span>
                      </div>
                    )}

                    {selectedProfileId && !usernameAvailability.message && (
                      <p style={{ margin: '4px 0 0', fontSize: 11.5, color: '#64748b' }}>
                        Auto-filled from directory. You can edit this username.
                      </p>
                    )}
                  </div>

                  <div className="uc-form-group">
                    <label className="uc-label">Password</label>
                    <div className="uc-input-wrapper">
                      <span className="uc-input-icon">🔒</span>
                      <input
                        className="uc-input"
                        type={showAccountPassword ? "text" : "password"}
                        placeholder="Enter secure password"
                        value={accountForm.password}
                        onChange={e => setAccountForm({ ...accountForm, password: e.target.value })}
                        required
                      />
                      <button
                        type="button"
                        className="uc-password-toggle"
                        onClick={() => setShowAccountPassword(prev => !prev)}
                        title={showAccountPassword ? "Hide password" : "Show password"}
                      >
                        {showAccountPassword ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>

                  {(accountForm.role === 'teacher' || accountForm.role === 'class_teacher') && (
                    <>
                      <div className="uc-form-group">
                        <label className="uc-label">
                          <span>Class Teacher Login Key</span>
                          {accountForm.role === 'class_teacher' ? <span style={{ color: '#e11d48', fontSize: 11 }}>Required</span> : <span style={{ color: '#64748b', fontSize: 11 }}>Optional</span>}
                        </label>
                        <div className="uc-input-wrapper">
                          <span className="uc-input-icon">🗝️</span>
                          <input
                            className="uc-input"
                            type="text"
                            placeholder={accountForm.role === 'class_teacher' ? 'Required key for class teacher login' : 'Optional login key'}
                            value={accountForm.classTeacherKey}
                            onChange={e => setAccountForm({ ...accountForm, classTeacherKey: e.target.value })}
                            required={accountForm.role === 'class_teacher'}
                          />
                        </div>
                      </div>

                      <div className="uc-form-group uc-form-full">
                        <label className="uc-label">Assigned Class(es)</label>
                        <p style={{ margin: '0 0 10px', fontSize: 12, color: '#64748b' }}>Tap classes to assign to this class teacher account.</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {sortClasses(classes).map((cls, idx) => {
                            const isSelected = accountForm.classTeacherClassIdxList.includes(idx);
                            const classColor = CLASS_COLORS[idx % CLASS_COLORS.length] || '#2563eb';
                            return (
                              <button
                                key={cls.className}
                                type="button"
                                onClick={() => {
                                  setAccountForm(prev => {
                                    const list = prev.classTeacherClassIdxList;
                                    const next = isSelected
                                      ? list.filter(i => i !== idx)
                                      : [...list, idx];
                                    return { ...prev, classTeacherClassIdxList: next };
                                  });
                                }}
                                style={{
                                  padding: '8px 16px',
                                  borderRadius: 999,
                                  border: `2px solid ${isSelected ? classColor : '#e2e8f0'}`,
                                  background: isSelected ? classColor : '#f8fafc',
                                  color: isSelected ? '#fff' : '#475569',
                                  fontWeight: 700,
                                  fontSize: 13,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                }}
                              >
                                {isSelected && <span style={{ fontSize: 11 }}>✓</span>}
                                {cls.className}
                              </button>
                            );
                          })}
                        </div>
                        {accountForm.classTeacherClassIdxList.length > 0 && (
                          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>
                              ✓ {accountForm.classTeacherClassIdxList.length} class{accountForm.classTeacherClassIdxList.length > 1 ? 'es' : ''} selected:
                            </span>
                            <span style={{ fontSize: 12, color: '#475569' }}>
                              {accountForm.classTeacherClassIdxList.map(i => classes[i]?.className).filter(Boolean).join(', ')}
                            </span>
                            <button
                              type="button"
                              onClick={() => setAccountForm(prev => ({ ...prev, classTeacherClassIdxList: [] }))}
                              style={{ border: 0, background: 'transparent', color: '#ef4444', fontWeight: 700, fontSize: 12, cursor: 'pointer', padding: 0 }}
                            >
                              Clear All
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div style={{ marginTop: 22 }}>
                  <button className="uc-submit-btn" type="submit" style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', boxShadow: '0 6px 20px rgba(124, 58, 237, 0.28)' }}>
                    <span>✨ Create Account Credentials</span>
                  </button>
                </div>

                {accountStatus && (
                  <div className="uc-alert uc-alert-success">
                    <span>✓</span>
                    <span>{accountStatus}</span>
                  </div>
                )}
                {accountError && (
                  <div className="uc-alert uc-alert-error">
                    <span>⚠️</span>
                    <span>{accountError}</span>
                  </div>
                )}
              </form>
            </div>

            {/* Registered Accounts Section */}
            <div className="uc-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a' }}>Registered Logins</h3>
                  <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#64748b' }}>Active user credentials synced across all devices</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAllPasswords(prev => !prev);
                    setVisiblePasswords({});
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 700,
                    border: '1.5px solid #cbd5e1',
                    background: showAllPasswords ? '#f1f5f9' : '#ffffff',
                    color: showAllPasswords ? '#0f172a' : '#475569',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
                  }}
                >
                  <span>{showAllPasswords ? '🙈 Hide All Passwords' : '👁️ Show All Passwords'}</span>
                </button>
              </div>

              <div className="uc-accounts-grid">
                {(() => {
                  const viewerUid = String(user?.userId || '').trim().toLowerCase();
                  const isViewerSuperAdmin = !!(user?.isViewerSuperAdmin || user?.isSuperAdmin || viewerUid === '@@siam##' || String(user?.role || '').toLowerCase() === 'superadmin');

                  return Object.values(registeredAccounts)
                    .filter(acc => {
                      if (!acc || !acc.userId) return false;
                      const uLower = String(acc.userId || '').trim().toLowerCase();
                      const isTargetSuperAdmin = !!(acc.isSuperAdmin || uLower === '@@siam##');
                      if (isTargetSuperAdmin && !isViewerSuperAdmin) {
                        return false;
                      }
                      return true;
                    })
                    .map(acc => {
                      const uLower = String(acc.userId || '').trim().toLowerCase();
                      const isTargetSuperAdmin = !!(acc.isSuperAdmin || uLower === '@@siam##');
                      const isSelf = !!(user?.userId && String(user.userId).trim().toLowerCase() === uLower);
                      const isTargetAdmin = acc.role === 'admin' || acc.role === 'principal' || isTargetSuperAdmin;
                      const isProtectedAcc = isTargetSuperAdmin || isSelf || (!isViewerSuperAdmin && isTargetAdmin);
                      const isOtherAdmin = isTargetAdmin && !isSelf && !isViewerSuperAdmin;
                      const isPasswordVisible = !isOtherAdmin && (showAllPasswords ? visiblePasswords[acc.userId] !== false : !!visiblePasswords[acc.userId]);

                      const roleClass = isTargetSuperAdmin
                        ? 'uc-badge-superadmin'
                        : acc.role === 'admin'
                          ? 'uc-badge-admin'
                          : acc.role === 'principal'
                            ? 'uc-badge-principal'
                            : acc.role === 'teacher'
                              ? 'uc-badge-teacher'
                              : 'uc-badge-student';

                      const avatarGradient = isTargetSuperAdmin
                        ? 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)'
                        : acc.role === 'admin'
                          ? 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)'
                          : acc.role === 'principal'
                            ? 'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)'
                            : acc.role === 'teacher'
                              ? 'linear-gradient(135deg, #10b981 0%, #047857 100%)'
                              : 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)';

                      const initialChar = String(acc.name || acc.userId || '?').trim().charAt(0).toUpperCase();

                      return (
                        <div
                          key={acc.userId}
                          className={`uc-account-card ${deleteMode && selectedIds.has(acc.userId) ? 'tp-card-selected' : ''}`}
                          onClick={deleteMode && !isProtectedAcc ? () => toggleSelect(acc.userId) : undefined}
                          style={{
                            cursor: deleteMode && !isProtectedAcc ? 'pointer' : 'default',
                            opacity: deleteMode && isProtectedAcc ? 0.6 : 1,
                          }}
                        >
                          {deleteMode && !isProtectedAcc && (
                            <div className={`tp-roster-checkbox ${selectedIds.has(acc.userId) ? 'tp-cb-checked' : ''}`} style={{ flexShrink: 0 }}>
                              {selectedIds.has(acc.userId) ? '✓' : ''}
                            </div>
                          )}
                          <div className="uc-account-avatar" style={{ background: avatarGradient }}>
                            {initialChar}
                          </div>
                          <div className="uc-account-details">
                            <h4 className="uc-account-name">{acc.name}</h4>
                            <div className="uc-account-meta">
                              <span style={{ fontWeight: 600, color: '#334155' }}>ID: {acc.userId}</span>
                              <span className={`uc-account-badge ${roleClass}`}>
                                {isTargetSuperAdmin ? 'SUPERADMIN' : acc.role || 'USER'}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: '#047857', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <span style={{ color: '#64748b', fontWeight: 500 }}>Pass:</span>
                              {isOtherAdmin ? (
                                <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>•••••••• (Protected)</span>
                              ) : (
                                <>
                                  <span style={{ letterSpacing: isPasswordVisible ? 'normal' : '2px', fontFamily: 'Courier New, monospace', fontWeight: 700 }}>
                                    {isPasswordVisible ? (acc.password || 'admin') : '••••••••'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setVisiblePasswords(prev => ({ ...prev, [acc.userId]: !isPasswordVisible }));
                                    }}
                                    title={isPasswordVisible ? "Hide password" : "Show password"}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      padding: '0 2px',
                                      fontSize: '13px',
                                      color: '#64748b'
                                    }}
                                  >
                                    {isPasswordVisible ? '🙈' : '👁️'}
                                  </button>
                                </>
                              )}
                            </div>
                            {acc.classTeacherKey && (
                              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                                Class Key: <span style={{ fontWeight: 700, color: '#d97706' }}>{acc.classTeacherKey}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    });
                })()}
              </div>

              <div className="tp-delete-section" style={{ marginTop: 20 }}>
                {!deleteMode ? (
                  <button className="tp-delete-toggle-btn" onClick={() => setDeleteMode(true)} disabled={Object.values(registeredAccounts).filter(acc => {
                    if (!acc || !acc.userId) return false;
                    const uLower = String(acc.userId).trim().toLowerCase();
                    if (acc.isSuperAdmin || uLower === '@@siam##') return false;
                    if (user?.userId && String(user.userId).trim().toLowerCase() === uLower) return false;
                    if (!isViewerSuperAdmin && (acc.role === 'admin' || acc.role === 'principal')) return false;
                    return true;
                  }).length === 0}>🗑️ Select to Remove Login</button>
                ) : (
                  <div className="tp-delete-bar">
                    <span className="tp-delete-count">{selectedIds.size} selected</span>
                    <div className="tp-delete-bar-right">
                      <button className="tp-delete-cancel-btn" onClick={() => { setDeleteMode(false); setSelectedIds(new Set()); }}>Cancel</button>
                      <button className="tp-delete-exec-btn" disabled={selectedIds.size === 0} onClick={executeDelete}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
