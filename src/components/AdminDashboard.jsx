import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useRealtimeSyncContext } from '../context/RealtimeSyncContext.jsx';
import { useSchoolProfile } from '../context/SchoolProfileContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { SCHOOL_BRANCHES, getBranchKeyByClass, filterClassesByBranch, extractClassNumber, getResolvedBranches, getActiveBranchKeys, sortClasses } from '../utils/schoolResolver.js';
import { subscribeToTeacherPanelData, saveTeacherPanelData, saveClassRecord, purgeResultsForStudents, getUserAccountFresh, saveSchoolProfile as saveSchoolProfileDoc } from '../firebase/firestoreSchema.js';
import { readStorage, writeStorage, deleteStudentGlobally, deleteTeacherGlobally } from '../utils/schoolData.js';
import useConfirm from '../hooks/useConfirm.js';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import PrintContainer from './PrintContainer.jsx';
import FeeManagementSystem from './FeeManagementSystem.jsx';
import AddNoticeModal from './AddNoticeModal.jsx';
import NotificationBell from './NotificationBell.jsx';
import ScholasticBaseLogo from './ScholasticBaseLogo.jsx';
import SafeImage from './SafeImage.jsx';
import { getNotices, addNotice, deleteNotices as deleteNoticesStorage, subscribeToNoticeUpdates, normalizeRoles } from '../utils/noticeStorage.js';
import { convertToWebP } from '../utils/imageOptimizer.js';
import SectionErrorBoundary from './SectionErrorBoundary.jsx';
import { BaseSkeleton, CardSkeleton, TableSkeleton } from './SkeletonLoader.jsx';

/* ──────────────────────────────────────────
   SVG Icons
   ────────────────────────────────────────── */
const HamburgerIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <line x1="3.5" y1="6" x2="20.5" y2="6" />
    <line x1="3.5" y1="12" x2="20.5" y2="12" />
    <line x1="3.5" y1="18" x2="20.5" y2="18" />
  </svg>
);

const HomeIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const KeyIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

const TeacherIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const StudentIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

const ExamIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <rect x="5" y="2" width="14" height="20" rx="2" />
    <line x1="9" y1="7" x2="15" y2="7" /><line x1="9" y1="11" x2="15" y2="11" />
  </svg>
);

const NoticeIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M22 2 11 13" /><path d="M22 2 15 22 11 13 2 9l20-7z" />
  </svg>
);

const FeeIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <rect x="1" y="4" width="22" height="16" rx="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

const ProfileIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const LogoutIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const ChevronLeft = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRight = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

/* ──────────────────────────────────────────
   Initial/Demo Data
   ────────────────────────────────────────── */
const initialTeachers = [];

const initialClasses = [
  { label: 'Nursery', ordinal: 'Nursery', classNum: 0 },
  ...['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'].map(
    (ordinal, index) => ({ label: `Class ${ordinal}`, ordinal, classNum: index + 1 })
  ),
].map(({ label, ordinal, classNum }) => ({
  className: label,
  classNum,
  students: [],
}));

// Branch display order
const BRANCH_ORDER = ['primary', 'secondary', 'college'];

const initialExams = [
  { subject: 'Mathematics', date: '2026-07-15', grade: 'Class Ten', time: '09:00 AM' },
  { subject: 'Physics', date: '2026-07-17', grade: 'Class Ten', time: '10:00 AM' },
  { subject: 'Chemistry', date: '2026-07-19', grade: 'Class Ten', time: '09:30 AM' },
  { subject: 'English', date: '2026-07-21', grade: 'Class Ten', time: '11:00 AM' },
];

const initialNotices = [
  { id: 1, title: 'Summer Vacation Announcement', date: '10 Jun 2026', desc: 'Summer vacation starts from June 20th to July 5th. Classes resume on July 6th.' },
  { id: 2, title: 'Annual Sports Meet 2026', date: '15 Jun 2026', desc: 'Register by June 18th for various field and track events scheduled next week.' }
];

const initialFees = [
  { id: 1, name: 'Term 1 Tuition Fee', status: 'Pending', amount: '$1,200.00' },
  { id: 2, name: 'Library Membership', status: 'Paid', amount: '$90.00' },
  { id: 3, name: 'Laboratory Fee', status: 'Paid', amount: '$150.00' }
];

const CLASS_COLORS = [
  '#4a90e2', '#38b26e', '#8b5cf6', '#f97316', '#0ea5a4',
  '#e11d48', '#d97706', '#0284c7', '#7c3aed', '#059669',
];

const ORDINALS = ['Nursery', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
const STUDENT_PROFILES_KEY = 'schoolAppStudentProfiles';

/* ──────────────────────────────────────────
   Modals
   ────────────────────────────────────────── */

/* Add Teacher Modal */
function AddTeacherModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ name: '', subject: '', email: '', phone: '' });
  const [profilePicPreview, setProfilePicPreview] = useState(null);

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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.subject.trim()) return;
    onAdd({ ...form, profilePic: profilePicPreview });
  };

  return (
    <div className="tp-modal-overlay" onClick={onClose}>
      <div className="tp-modal" onClick={e => e.stopPropagation()}>
        <div className="tp-modal-header" style={{ borderBottomColor: '#38b26e' }}>
          <h3 className="tp-modal-title">➕ Add New Teacher</h3>
          <button className="tp-modal-close" onClick={onClose}>✕</button>
        </div>
        <form className="tp-modal-body" onSubmit={handleSubmit}>
          <div className="tp-pic-upload-area">
            <label htmlFor="adm-teacher-pic" className="tp-pic-label">
              {profilePicPreview ? (
                <img src={profilePicPreview} alt="Preview" className="tp-pic-preview" />
              ) : (
                <div className="tp-pic-placeholder" style={{ borderColor: '#38b26e' }}>
                  <span className="tp-pic-icon">📷</span>
                  <p className="tp-pic-text">Upload Photo</p>
                </div>
              )}
            </label>
            <input id="adm-teacher-pic" type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
          </div>
          <div className="tp-form-grid">
            <div className="tp-form-group tp-form-full">
              <label className="tp-form-label">Full Name *</label>
              <input className="tp-form-input" type="text" placeholder="e.g. Dr. Susan Miller" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="tp-form-group">
              <label className="tp-form-label">Subject *</label>
              <input className="tp-form-input" type="text" placeholder="e.g. Biology" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} required />
            </div>
            <div className="tp-form-group">
              <label className="tp-form-label">Email *</label>
              <input className="tp-form-input" type="email" placeholder="e.g. s.miller@school.edu" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="tp-form-group tp-form-full">
              <label className="tp-form-label">Phone Number *</label>
              <input className="tp-form-input" type="text" placeholder="e.g. +1 (555) 019-3344" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
            </div>
          </div>
          <div className="tp-modal-footer">
            <button type="button" className="tp-modal-cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="tp-modal-submit-btn" style={{ background: '#38b26e' }}>Add Teacher</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* Add Student Modal */
function AddStudentModal({ onClose, onAdd, classNum }) {
  const [form, setForm] = useState({ name: '', age: '', birthday: '', fatherName: '', motherName: '', admissionDate: new Date().toISOString().split('T')[0] });
  const [profilePicPreview, setProfilePicPreview] = useState(null);

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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.age) return;
    onAdd({
      ...form,
      profilePic: profilePicPreview,
      id: `STU-${Date.now().toString().slice(-6)}`,
    });
  };

  return (
    <div className="tp-modal-overlay" onClick={onClose}>
      <div className="tp-modal" onClick={e => e.stopPropagation()}>
        <div className="tp-modal-header" style={{ borderBottomColor: '#2563eb' }}>
          <h3 className="tp-modal-title">➕ Add Student to Class {ORDINALS[classNum - 1]}</h3>
          <button className="tp-modal-close" onClick={onClose}>✕</button>
        </div>
        <form className="tp-modal-body" onSubmit={handleSubmit}>
          <div className="tp-pic-upload-area">
            <label htmlFor="adm-student-pic" className="tp-pic-label">
              {profilePicPreview ? (
                <img src={profilePicPreview} alt="Preview" className="tp-pic-preview" />
              ) : (
                <div className="tp-pic-placeholder" style={{ borderColor: '#2563eb' }}>
                  <span className="tp-pic-icon">📷</span>
                  <p className="tp-pic-text">Upload Photo</p>
                </div>
              )}
            </label>
            <input id="adm-student-pic" type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
          </div>
          <div className="tp-form-grid">
            <div className="tp-form-group tp-form-full">
              <label className="tp-form-label">Full Name *</label>
              <input className="tp-form-input" type="text" placeholder="e.g. John Doe" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="tp-form-group">
              <label className="tp-form-label">Age *</label>
              <input className="tp-form-input" type="number" placeholder="e.g. 14" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} required />
            </div>
            <div className="tp-form-group">
              <label className="tp-form-label">Date of Birth *</label>
              <input className="tp-form-input" type="date" value={form.birthday} onChange={e => setForm({ ...form, birthday: e.target.value })} required />
            </div>
            <div className="tp-form-group">
              <label className="tp-form-label">Admission Date *</label>
              <input className="tp-form-input" type="date" value={form.admissionDate} onChange={e => setForm({ ...form, admissionDate: e.target.value })} required />
            </div>
            <div className="tp-form-group">
              <label className="tp-form-label">Father's Name *</label>
              <input className="tp-form-input" type="text" placeholder="Father's full name" value={form.fatherName} onChange={e => setForm({ ...form, fatherName: e.target.value })} required />
            </div>
            <div className="tp-form-group">
              <label className="tp-form-label">Mother's Name *</label>
              <input className="tp-form-input" type="text" placeholder="Mother's full name" value={form.motherName} onChange={e => setForm({ ...form, motherName: e.target.value })} required />
            </div>
          </div>
          <div className="tp-modal-footer">
            <button type="button" className="tp-modal-cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="tp-modal-submit-btn" style={{ background: '#2563eb' }}>Add Student</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* Edit Student Modal */
function EditStudentModal({ student, classColor, onClose, onSave }) {
  const [form, setForm] = useState({
    name: student.name || '',
    roll: student.roll || '',
    age: student.age || '',
    birthday: student.birthday || '',
    fatherName: student.fatherName || '',
    motherName: student.motherName || '',
    phone: student.phone || '',
    address: student.address || '',
  });
  const [profilePicPreview, setProfilePicPreview] = useState(student.profilePic || null);

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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave({
      ...student,
      ...form,
      name: form.name.trim(),
      roll: form.roll.trim(),
      age: form.age,
      profilePic: profilePicPreview,
    });
  };

  return (
    <div className="tp-modal-overlay" onClick={onClose}>
      <div className="tp-modal admin-edit-student-modal" onClick={e => e.stopPropagation()}>
        <div className="tp-modal-header" style={{ borderBottomColor: classColor }}>
          <h3 className="tp-modal-title">✏️ Edit Student Profile</h3>
          <button className="tp-modal-close" onClick={onClose}>✕</button>
        </div>
        <form className="tp-modal-body" onSubmit={handleSubmit}>
          <div className="tp-pic-upload-area">
            <label htmlFor="adm-edit-student-pic" className="tp-pic-label">
              {profilePicPreview ? (
                <img src={profilePicPreview} alt="Student preview" className="tp-pic-preview" />
              ) : (
                <div className="tp-pic-placeholder" style={{ borderColor: classColor }}>
                  <span className="tp-pic-icon">📷</span>
                  <p className="tp-pic-text">Upload Photo</p>
                </div>
              )}
            </label>
            <input id="adm-edit-student-pic" type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
          </div>
          <div className="tp-form-grid">
            <div className="tp-form-group tp-form-full">
              <label className="tp-form-label">Full Name *</label>
              <input className="tp-form-input" type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="tp-form-group">
              <label className="tp-form-label">Roll Number</label>
              <input className="tp-form-input" type="text" value={form.roll} onChange={e => setForm({ ...form, roll: e.target.value })} />
            </div>
            <div className="tp-form-group">
              <label className="tp-form-label">Age</label>
              <input className="tp-form-input" type="number" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} />
            </div>
            <div className="tp-form-group">
              <label className="tp-form-label">Date of Birth</label>
              <input className="tp-form-input" type="date" value={form.birthday} onChange={e => setForm({ ...form, birthday: e.target.value })} />
            </div>
            <div className="tp-form-group">
              <label className="tp-form-label">Phone</label>
              <input className="tp-form-input" type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="tp-form-group">
              <label className="tp-form-label">Father's Name</label>
              <input className="tp-form-input" type="text" value={form.fatherName} onChange={e => setForm({ ...form, fatherName: e.target.value })} />
            </div>
            <div className="tp-form-group">
              <label className="tp-form-label">Mother's Name</label>
              <input className="tp-form-input" type="text" value={form.motherName} onChange={e => setForm({ ...form, motherName: e.target.value })} />
            </div>
            <div className="tp-form-group tp-form-full">
              <label className="tp-form-label">Address</label>
              <textarea className="tp-form-input" rows="3" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} style={{ fontFamily: 'inherit', resize: 'vertical' }} />
            </div>
          </div>
          <div className="tp-modal-footer">
            <button type="button" className="tp-modal-cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="tp-modal-submit-btn" style={{ background: classColor }}>Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* Add Exam Modal */
function AddExamModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ subject: '', date: '', grade: 'Class One', time: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.date) return;
    onAdd(form);
  };

  return (
    <div className="tp-modal-overlay" onClick={onClose}>
      <div className="tp-modal" onClick={e => e.stopPropagation()}>
        <div className="tp-modal-header" style={{ borderBottomColor: '#8b5cf6' }}>
          <h3 className="tp-modal-title">➕ Schedule New Exam</h3>
          <button className="tp-modal-close" onClick={onClose}>✕</button>
        </div>
        <form className="tp-modal-body" onSubmit={handleSubmit}>
          <div className="tp-form-grid">
            <div className="tp-form-group tp-form-full">
              <label className="tp-form-label">Subject *</label>
              <input className="tp-form-input" type="text" placeholder="e.g. Mathematics" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} required />
            </div>
            <div className="tp-form-group">
              <label className="tp-form-label">Date *</label>
              <input className="tp-form-input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div className="tp-form-group">
              <label className="tp-form-label">Time *</label>
              <input className="tp-form-input" type="text" placeholder="e.g. 10:00 AM" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} required />
            </div>
            <div className="tp-form-group tp-form-full">
              <label className="tp-form-label">Target Class</label>
              <select className="tp-form-input" value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })}>
                {ORDINALS.map(ord => (
                  <option key={ord} value={`Class ${ord}`}>Class {ord}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="tp-modal-footer">
            <button type="button" className="tp-modal-cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="tp-modal-submit-btn" style={{ background: '#8b5cf6' }}>Schedule Exam</button>
          </div>
        </form>
      </div>
    </div>
  );
}



/* ──────────────────────────────────────────
   Main Component
   ────────────────────────────────────────── */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { user, signOut, createUser, deleteUser } = useAuth();
  const viewerUid = String(user?.userId || '').trim().toLowerCase();
  const isViewerSuperAdmin = !!(user?.isSuperAdmin || viewerUid === '@@siam##' || String(user?.role || '').toLowerCase() === 'superadmin');
  const { liveUsersVersion } = useRealtimeSyncContext();
  const { schoolProfile: rawSchoolProfile, setSchoolProfile, resetSchoolProfile } = useSchoolProfile();
  const { lang, setLanguage, t } = useLanguage();
  const schoolProfile = rawSchoolProfile || { schoolName: 'ScholasticBase', logo: '', adminEmail: 'admin@scholasticbase.edu' };
  const [activeTab, setActiveTab] = useState('overview'); // overview, accounts, teachers, students, exams, notices, fees, profile
  const [menuOpen, setMenuOpen] = useState(false);

  // User Accounts forms
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

    // 1. Check local memory & localStorage instantly
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

    // 2. Debounced async lookup in Firestore
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

  const activeSchoolId = schoolProfile?.schoolId || schoolProfile?.schoolCode || schoolProfile?.eiinNumber || 'PROGGA_DEFAULT';
  const [teachers, setTeachers] = useState(initialTeachers);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [classes, setClasses] = useState(initialClasses);
  const [exams, setExams] = useState(initialExams);
  const [notices, setNotices] = useState(() => getNotices(activeSchoolId));
  const [fees, setFees] = useState(initialFees);
  const [highlightedNoticeId, setHighlightedNoticeId] = useState(null);

  useEffect(() => {
    setNotices(getNotices(activeSchoolId));
    const unsub = subscribeToNoticeUpdates((updatedNotices) => {
      setNotices(updatedNotices);
    }, activeSchoolId);
    return () => unsub();
  }, [activeSchoolId]);
  const [profileForm, setProfileForm] = useState(schoolProfile);
  const [profileStatus, setProfileStatus] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [submittingProfile, setSubmittingProfile] = useState(false);
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassBranch, setNewClassBranch] = useState('primary');
  const [submittingClass, setSubmittingClass] = useState(false);
  const [addClassError, setAddClassError] = useState('');

  // Inline Branch Renaming state
  const [openBranchMenuKey, setOpenBranchMenuKey] = useState(null);
  const [editingBranchKey, setEditingBranchKey] = useState(null);
  const [tempBranchName, setTempBranchName] = useState('');
  const [savingBranch, setSavingBranch] = useState(false);

  const resolvedBranches = useMemo(() => getResolvedBranches(schoolProfile), [schoolProfile]);
  const activeBranchKeys = useMemo(() => getActiveBranchKeys(schoolProfile), [schoolProfile]);

  const filteredTeachers = useMemo(() => {
    if (!teacherSearch.trim()) return teachers || [];
    const q = teacherSearch.toLowerCase().trim();
    return (teachers || []).filter(t =>
      (t?.name || '').toLowerCase().includes(q) ||
      (t?.subject || '').toLowerCase().includes(q) ||
      (t?.email || '').toLowerCase().includes(q) ||
      (t?.phone || '').includes(q)
    );
  }, [teachers, teacherSearch]);

  const handleToggleBranchActive = (branchKey, isChecked) => {
    const currentActive = profileForm.activeBranches || { primary: true, secondary: true, college: true };
    if (!isChecked) {
      const activeCount = Object.keys(currentActive).filter(k => k !== branchKey ? currentActive[k] : false).length;
      if (activeCount === 0) {
        alert('At least one branch must remain active for your institution.');
        return;
      }
    }
    setProfileForm(prev => ({
      ...prev,
      activeBranches: {
        ...(prev.activeBranches || { primary: true, secondary: true, college: true }),
        [branchKey]: isChecked
      }
    }));
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openBranchMenuKey && !e.target.closest('.tp-branch-menu-container')) {
        setOpenBranchMenuKey(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openBranchMenuKey]);

  const handleSaveBranchName = async (branchKey, newName) => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    setSavingBranch(true);
    try {
      const currentBranchNames = schoolProfile?.branchNames || {
        primary: 'Primary School',
        secondary: 'High School',
        college: 'College',
      };

      const updatedBranchNames = {
        ...currentBranchNames,
        [branchKey]: trimmed,
      };

      setSchoolProfile({
        branchNames: updatedBranchNames,
      });

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('schoolBranchNames', JSON.stringify(updatedBranchNames));
        const profileRaw = window.localStorage.getItem('schoolAppProfile');
        let profile = profileRaw ? JSON.parse(profileRaw) : {};
        profile.branchNames = updatedBranchNames;
        window.localStorage.setItem('schoolAppProfile', JSON.stringify(profile));
        window.dispatchEvent(new CustomEvent('schoolDataUpdate'));
      }

      setEditingBranchKey(null);
      setOpenBranchMenuKey(null);
    } catch (err) {
      console.error('Error saving branch name:', err);
    } finally {
      setSavingBranch(false);
    }
  };


  useEffect(() => {
    if (schoolProfile) {
      setProfileForm(prev => ({
        ...prev,
        ...schoolProfile,
        schoolName: schoolProfile.schoolName || window.localStorage.getItem('schoolName') || 'ScholasticBase',
        eiinNumber: schoolProfile.eiinNumber || window.localStorage.getItem('schoolEiinNumber') || '',
        location: schoolProfile.location || window.localStorage.getItem('schoolLocation') || '',
        branchNames: {
          primary: schoolProfile.branchNames?.primary || 'Primary School',
          secondary: schoolProfile.branchNames?.secondary || 'High School',
          college: schoolProfile.branchNames?.college || 'College',
        },
        activeBranches: {
          primary: schoolProfile.activeBranches?.primary !== false,
          secondary: schoolProfile.activeBranches?.secondary !== false,
          college: schoolProfile.activeBranches?.college !== false,
        },
      }));
    }
  }, [schoolProfile]);

  const isRemoteUpdate = useRef(false);
  const [hasLoadedRemote, setHasLoadedRemote] = useState(false);

  useEffect(() => {
    let active = true;
    setHasLoadedRemote(false);

    // Initial cache read for active school
    const cachedTeachers = readStorage('teacherPanelTeachers', null, activeSchoolId);
    const cachedClasses = readStorage('teacherPanelClasses', null, activeSchoolId);
    if (cachedTeachers) setTeachers(cachedTeachers);
    if (cachedClasses) setClasses(cachedClasses);

    const unsubscribe = subscribeToTeacherPanelData((docSnap) => {
      if (!active) return;
      if (docSnap && docSnap.exists()) {
        const remoteData = docSnap.data();
        isRemoteUpdate.current = true;
        if (Array.isArray(remoteData.classes)) {
          setClasses(remoteData.classes);
          writeStorage('teacherPanelClasses', remoteData.classes, activeSchoolId);
        }
        if (Array.isArray(remoteData.teachers)) {
          setTeachers(remoteData.teachers);
          writeStorage('teacherPanelTeachers', remoteData.teachers, activeSchoolId);
        }
      }
      setHasLoadedRemote(true);
    }, (err) => {
      console.warn('AdminDashboard could not sync teacher/class data from Firestore:', err);
      try {
        const storedTeachers = readStorage('teacherPanelTeachers', null, activeSchoolId);
        const storedClasses = readStorage('teacherPanelClasses', null, activeSchoolId);
        if (storedTeachers) setTeachers(storedTeachers);
        if (storedClasses) setClasses(storedClasses);
      } catch { }
      setHasLoadedRemote(true);
    }, activeSchoolId);

    return () => {
      active = false;
      unsubscribe();
    };
  }, [activeSchoolId]);

  useEffect(() => {
    if (!hasLoadedRemote) return;
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }
    saveTeacherPanelData({ classes, teachers }, activeSchoolId).catch(err => {
      console.warn('Could not auto-save Admin classes/teachers to Firestore:', err);
    });
    writeStorage('teacherPanelClasses', classes, activeSchoolId);
    writeStorage('teacherPanelTeachers', teachers, activeSchoolId);
  }, [classes, teachers, hasLoadedRemote, activeSchoolId]);

  // Profile lookup options
  const safeTeachers = Array.isArray(teachers) ? teachers : [];
  const safeClasses = Array.isArray(classes) ? classes : [];

  const teacherProfiles = Array.from(
    safeTeachers.reduce((map, teacher, idx) => {
      if (!teacher) return map;

      const isObj = typeof teacher === 'object' && teacher !== null;
      const rawName = isObj ? (teacher?.name ?? '') : String(teacher || '');
      const rawEmail = isObj ? (teacher?.email ?? '') : '';

      const safeName = String(rawName || '').trim();
      const safeEmail = String(rawEmail || '').trim();

      const nameLower = String(safeName || '').toLowerCase();
      const emailLower = String(safeEmail || '').toLowerCase();
      const normalizedKey = `${nameLower}|${emailLower}`;

      if (map.has(normalizedKey)) return map;

      const nameSlug = safeName
        ? String(safeName).replace(/\s+/g, '_').toLowerCase()
        : `teacher_${idx + 1}`;
      const fallbackUserId = `${nameSlug}-${idx}`;

      const displayName = safeName || `Teacher ${idx + 1}`;
      const displayLabel = safeEmail ? `${displayName} (${safeEmail})` : displayName;

      const profileKey = `${safeEmail || safeName || `teacher-${idx}`}-${idx}`;

      map.set(normalizedKey, {
        key: String(profileKey || `teacher-key-${idx}`),
        name: String(displayName || 'Teacher'),
        label: String(displayLabel || 'Teacher'),
        userId: String(safeEmail || fallbackUserId || `teacher_${idx}`),
        role: 'teacher',
      });
      return map;
    }, new Map()).values()
  );

  const studentProfiles = safeClasses.flatMap((cls, classIdx) => {
    if (!cls) return [];
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
      const rawName = isObj ? (s?.name ?? '') : String(s || '');
      const rawId = isObj ? (s?.id ?? s?.roll ?? '') : '';

      const safeStudentName = String(rawName || '').trim() || `Student ${studentIdx + 1}`;
      const safeStudentId = String(rawId || '').trim();

      const nameSlug = String(safeStudentName || '').replace(/\s+/g, '_').toLowerCase();
      const studentUserId = safeStudentId || nameSlug || `student_${studentIdx + 1}`;

      const profileKey = `${safeStudentId || safeStudentName || 'stu'}-${className}-${studentIdx}`;

      return {
        key: String(profileKey),
        name: String(safeStudentName),
        label: `${safeStudentName} — ${className}`,
        userId: String(studentUserId),
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
        role: profile.role,
        name: profile.name || (profile.label ? String(profile.label).split(' — ')[0] : ''),
        userId: profile.userId || '',
      }));
    } else {
      setAccountForm((prev) => ({ ...prev, name: '', userId: '' }));
    }
  };

  // Modals
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddExam, setShowAddExam] = useState(false);
  const [showAddNotice, setShowAddNotice] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);

  // Branch & drilldown navigation
  const [selectedBranchKey, setSelectedBranchKey] = useState(null);
  const [selectedClassIdx, setSelectedClassIdx] = useState(null);

  // Delete Selection
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Load created user accounts on render or tab change
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

  // ── Reactive account list ────────────────────────────────────────────
  // Triggered by: initial mount, school change, and liveUsersVersion change.
  // liveUsersVersion is incremented by RealtimeSyncContext's Firestore
  // users-collection onSnapshot every time any user doc is created/updated.
  // This makes the accounts list instantly reactive across all admin devices.
  useEffect(() => {
    loadAccounts();
  }, [activeSchoolId, liveUsersVersion]);

  // Also react to same-tab merges dispatched by mergeUsersIntoLocalStorage
  // (the Firestore push on the current device fires a custom DOM event).
  useEffect(() => {
    const handleUsersUpdate = () => loadAccounts();
    window.addEventListener('schoolUsersUpdate', handleUsersUpdate);
    return () => window.removeEventListener('schoolUsersUpdate', handleUsersUpdate);
  }, []);

  useEffect(() => {
    try {
      const studentProfilesCache = (Array.isArray(classes) ? classes : []).reduce((acc, cls) => {
        if (!cls) return acc;
        (Array.isArray(cls.students) ? cls.students : []).forEach((student) => {
          if (student && (student.id || student.name)) {
            acc[student.id || student.name] = { ...student, className: cls.className, classNum: cls.classNum, schoolId: activeSchoolId };
          }
        });
        return acc;
      }, {});
      writeStorage(STUDENT_PROFILES_KEY, studentProfilesCache, activeSchoolId);
    } catch {
      // ignore local profile cache errors
    }
  }, [classes, activeSchoolId]);

  useEffect(() => {
    setProfileForm(schoolProfile);
  }, [schoolProfile]);

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    setMenuOpen(false);
    setDeleteMode(false);
    setSelectedIds(new Set());
    setSelectedClassIdx(null);
    setSelectedBranchKey(null);
    if (tab === 'accounts') {
      loadAccounts();
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
    if (accountForm.role === 'admin' && !user?.isSuperAdmin) {
      setAccountError('Only Super Admin can create System Admin accounts.');
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
        // backward-compat: keep first assigned class in old field
        classTeacherClassIdx: accountForm.classTeacherClassIdxList[0] ?? '',
        classTeacherClassName: assignedClassNames[0] || '',
        allowUpdate: false,
      });
      setAccountStatus(`Successfully created ${accountForm.role === 'class_teacher' ? 'Class Teacher' : accountForm.role} account "${accountForm.userId}".`);
      setAccountForm({ userId: '', name: '', password: '', role: 'student', classTeacherKey: '', classTeacherClassIdxList: [] });
      loadAccounts();
    } catch (err) {
      setAccountError(err.message || 'Error creating user.');
    }
  };

  const handleAddClassSubmit = async () => {
    const name = newClassName.trim();
    if (!name) return;
    if (classes.some(c => String(c?.className || '').toLowerCase() === name.toLowerCase())) {
      setAddClassError(`Class "${name}" already exists.`);
      return;
    }

    setSubmittingClass(true);
    setAddClassError('');

    try {
      // Prioritize explicitly selected branch or active view branch over generic fallback detection
      const targetBranch = newClassBranch || selectedBranchKey || getBranchKeyByClass(name) || 'primary';

      let baseIdx = 1;
      if (targetBranch === 'secondary') {
        baseIdx = 6;
      } else if (targetBranch === 'college') {
        baseIdx = 11;
      }

      const branchClasses = filterClassesByBranch(classes, targetBranch);
      const detectedNum = extractClassNumber(name);
      let classNum = detectedNum;
      if (classNum === null) {
        if (branchClasses.length > 0) {
          const highestNum = branchClasses.reduce((max, c) => Math.max(max, c.classNum || 0), 0);
          classNum = highestNum + 1;
        } else {
          classNum = baseIdx;
        }
      }

      const newClass = {
        className: name,
        classNum,
        branchKey: targetBranch,
        branchId: targetBranch,
        sectionId: targetBranch,
        schoolId: schoolProfile?.schoolId || activeSchoolId || 'PROGGA_DEFAULT',
        groups: targetBranch === 'college' ? ['Science', 'Commerce', 'Arts'] : ['Section A', 'Section B'],
        students: [],
        groupTeachers: {},
        groupHeadTeachers: {},
        groupSubjects: {},
        routines: {},
      };

      const nextClasses = sortClasses([...classes, newClass]);
      setClasses(nextClasses);
      writeStorage('teacherPanelClasses', nextClasses, activeSchoolId);

      await saveTeacherPanelData({ classes: nextClasses, teachers }, activeSchoolId);
      await saveClassRecord(newClass, activeSchoolId);

      setNewClassName('');
      setShowAddClassModal(false);
    } catch (err) {
      console.error('Could not sync class to Firestore:', err);
      setAddClassError(err.message || 'Failed to save class to database.');
    } finally {
      setSubmittingClass(false);
    }
  };

  const handleDeleteClassClick = async (globalIdx, className) => {
    const ok = await confirm({
      title: 'Delete Class Confirmation',
      message: `Are you sure you want to delete "${className}"? All students, groups, routines, and subjects will be permanently lost.`,
      confirmText: 'OK, Delete',
      cancelText: 'Cancel'
    });
    if (!ok) return;

    const targetClass = classes[globalIdx];
    const deletedStudents = (targetClass?.students || []).map((s) => ({ ...s, class: targetClass?.className || className }));

    const nextClasses = classes.filter((_, idx) => idx !== globalIdx);
    setClasses(nextClasses);
    writeStorage('teacherPanelClasses', nextClasses, activeSchoolId);

    if (deletedStudents.length > 0) {
      purgeResultsForStudents(deletedStudents, activeSchoolId).catch(() => { });
    }

    try {
      await saveTeacherPanelData({ classes: nextClasses, teachers }, activeSchoolId);
    } catch (err) {
      console.error('Could not delete class from Firestore:', err);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleUpdateStudent = (updatedStudent) => {
    if (selectedClassIdx === null) return;
    setClasses(prev => prev.map((cls, idx) => {
      if (idx !== selectedClassIdx) return cls;
      return {
        ...cls,
        students: cls.students.map(student => student.id === updatedStudent.id ? updatedStudent : student),
      };
    }));
    setEditingStudent(null);
  };

  const executeDelete = async () => {
    if (activeTab === 'teachers') {
      const nextTeachers = teachers.filter(t => !selectedIds.has(t.email));
      setTeachers(nextTeachers);
      deleteTeacherGlobally(Array.from(selectedIds), activeSchoolId);
      writeStorage('teacherPanelTeachers', nextTeachers, activeSchoolId);
      try {
        await saveTeacherPanelData({ classes, teachers: nextTeachers }, activeSchoolId);
      } catch (err) {
        console.warn('Could not sync deleted teachers to Firestore:', err);
      }
    } else if (activeTab === 'students' && selectedClassIdx !== null) {
      const targetClass = classes[selectedClassIdx];
      const deletedStudents = (targetClass?.students || [])
        .filter((s) => selectedIds.has(s.id))
        .map((s) => ({ ...s, class: targetClass?.className || '' }));

      const nextClasses = classes.map((cls, idx) => {
        if (idx !== selectedClassIdx) return cls;
        return { ...cls, students: cls.students.filter(s => !selectedIds.has(s.id)) };
      });

      setClasses(nextClasses);
      deleteStudentGlobally(Array.from(selectedIds), activeSchoolId);
      writeStorage('teacherPanelClasses', nextClasses, activeSchoolId);

      if (deletedStudents.length > 0) {
        purgeResultsForStudents(deletedStudents, activeSchoolId).catch(() => { });
      }

      try {
        await saveTeacherPanelData({ classes: nextClasses, teachers }, activeSchoolId);
      } catch (err) {
        console.warn('Could not sync deleted students to Firestore:', err);
      }
    } else if (activeTab === 'exams') {
      setExams(prev => prev.filter(e => !selectedIds.has(`${e.subject}-${e.grade}`)));
    } else if (activeTab === 'notices') {
      deleteNoticesStorage(Array.from(selectedIds), activeSchoolId);
    } else if (activeTab === 'fees') {
      const nextFees = fees.filter(f => !selectedIds.has(f.id));
      setFees(nextFees);
      writeStorage('schoolAppFees', nextFees, activeSchoolId);
    } else if (activeTab === 'accounts') {
      const isViewerSuperAdmin = !!(user?.isSuperAdmin || String(user?.userId || '').trim().toLowerCase() === '@@siam##' || String(user?.role || '').toLowerCase() === 'superadmin');
      const idsToDelete = Array.from(selectedIds).filter(id => {
        const trimmed = String(id).trim().toLowerCase();
        if (trimmed === '@@siam##') return false;
        if (user?.userId && String(user.userId).trim().toLowerCase() === trimmed) return false;
        const acc = registeredAccounts[id];
        if (acc && acc.isSuperAdmin) return false;
        if (!isViewerSuperAdmin) {
          const role = String(acc?.role || '').toLowerCase();
          if (role === 'admin') return false;
        }
        return true;
      });
      if (idsToDelete.length === 0) {
        setAccountStatus(isViewerSuperAdmin ? 'Super Admin and active session accounts cannot be deleted.' : 'Admin accounts cannot be deleted by non-Super Admin.');
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
    }
    setSelectedIds(new Set());
    setDeleteMode(false);
  };

  const handleToggleFee = (id) => {
    setFees(prev => prev.map(f => {
      if (f.id !== id) return f;
      return { ...f, status: f.status === 'Paid' ? 'Pending' : 'Paid' };
    }));
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    try {
      const optimized = await convertToWebP(file, { maxWidth: 500, maxHeight: 500, quality: 0.85 });
      setProfileForm(prev => ({ ...prev, logo: optimized.dataUrl }));
      setProfileStatus('Logo optimized to WebP format. Save changes to publish.');
    } catch (err) {
      const objectUrl = URL.createObjectURL(file);
      setProfileForm(prev => ({ ...prev, logo: objectUrl }));
      setProfileStatus('Logo selected. Save changes to publish it.');
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (submittingProfile) return;
    setSubmittingProfile(true);
    setProfileStatus('Saving profile configurations...');
    try {
      let logoUrl = profileForm.logo;
      if (logoFile) {
        setProfileStatus('Converting logo to WebP format...');
        try {
          const optimized = await convertToWebP(logoFile, { maxWidth: 500, maxHeight: 500, quality: 0.85 });
          logoUrl = optimized.dataUrl;
        } catch (err) {
          logoUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => resolve(ev.target.result);
            reader.onerror = () => resolve(profileForm.logo);
            reader.readAsDataURL(logoFile);
          });
        }
        setProfileForm(prev => ({ ...prev, logo: logoUrl }));
      }

      const updatedSchoolName = profileForm.schoolName.trim() || schoolProfile?.schoolName || window.localStorage.getItem('schoolName') || 'ScholasticBase';
      const updatedEiinNumber = (profileForm.eiinNumber || '').trim();
      const updatedLocation = (profileForm.location || '').trim();
      const branchNames = {
        primary: (profileForm.branchNames?.primary || 'Primary School').trim(),
        secondary: (profileForm.branchNames?.secondary || 'High School').trim(),
        college: (profileForm.branchNames?.college || 'College').trim(),
      };
      const activeBranches = {
        primary: profileForm.activeBranches?.primary !== false,
        secondary: profileForm.activeBranches?.secondary !== false,
        college: profileForm.activeBranches?.college !== false,
      };

      const nextProfile = {
        ...profileForm,
        logo: logoUrl,
        language: profileForm.language || 'bn',
        schoolName: updatedSchoolName,
        eiinNumber: updatedEiinNumber,
        location: updatedLocation,
        adminName: profileForm.adminName.trim() || user?.name || 'System Admin',
        adminTitle: profileForm.adminTitle.trim() || 'Administrator',
        adminEmail: profileForm.adminEmail.trim(),
        adminPhone: profileForm.adminPhone.trim(),
        branchNames,
        activeBranches,
      };

      setSchoolProfile(nextProfile);
      await saveSchoolProfileDoc(nextProfile, activeSchoolId);
      try {
        window.localStorage.setItem('schoolName', updatedSchoolName);
        window.localStorage.setItem('schoolEiinNumber', updatedEiinNumber);
        window.localStorage.setItem('schoolLocation', updatedLocation);
        window.localStorage.setItem('schoolBranchNames', JSON.stringify(branchNames));
        window.localStorage.setItem('schoolActiveBranches', JSON.stringify(activeBranches));
      } catch { }

      setLogoFile(null);
      setProfileStatus('Profile & branding updated successfully across all devices.');
    } catch (err) {
      console.error('Error updating profile:', err);
      setProfileStatus(`Failed to update profile: ${err.message || 'Unknown error'}`);
    } finally {
      setSubmittingProfile(false);
    }
  };

  const handleProfileReset = () => {
    resetSchoolProfile();
    try {
      window.localStorage.removeItem('schoolBranchNames');
      window.localStorage.removeItem('schoolActiveBranches');
    } catch { }
    setLogoFile(null);
    setProfileForm({
      ...schoolProfile,
      branchNames: {
        primary: 'Primary School',
        secondary: 'High School',
        college: 'College',
      },
      activeBranches: {
        primary: true,
        secondary: true,
        college: true,
      },
    });
    setProfileStatus('Profile reset to default school branding and branch titles.');
  };

  // Stats Counters
  const safeExams = Array.isArray(exams) ? exams : [];
  const totalTeachers = safeTeachers.length;
  const totalStudents = safeClasses.reduce((acc, c) => acc + (Array.isArray(c?.students) ? c.students.length : 0), 0);
  const totalExams = safeExams.length;

  return (
    <div className="tp-shell">
      {/* ════════════════════════════════
          MOBILE DRAWER OVERLAY
          ════════════════════════════════ */}
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
            <button className={`tp-sidebar-nav-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => { handleTabClick('overview'); setMenuOpen(false); }}>
              <HomeIcon /> Overview
            </button>
            <button className={`tp-sidebar-nav-item ${activeTab === 'accounts' ? 'active' : ''}`} onClick={() => { handleTabClick('accounts'); setMenuOpen(false); }}>
              <KeyIcon /> User Logins
            </button>
            <button className={`tp-sidebar-nav-item ${activeTab === 'teachers' ? 'active' : ''}`} onClick={() => { handleTabClick('teachers'); setMenuOpen(false); }}>
              <TeacherIcon /> Teachers
            </button>
            <button className={`tp-sidebar-nav-item ${activeTab === 'students' ? 'active' : ''}`} onClick={() => { handleTabClick('students'); setMenuOpen(false); }}>
              <StudentIcon /> Students
            </button>
            <button className={`tp-sidebar-nav-item ${activeTab === 'exams' ? 'active' : ''}`} onClick={() => { handleTabClick('exams'); setMenuOpen(false); }}>
              <ExamIcon /> Exams
            </button>
            <button className={`tp-sidebar-nav-item ${activeTab === 'notices' ? 'active' : ''}`} onClick={() => { handleTabClick('notices'); setMenuOpen(false); }}>
              <NoticeIcon /> Notices
            </button>
            <button className={`tp-sidebar-nav-item ${activeTab === 'fees' ? 'active' : ''}`} onClick={() => { handleTabClick('fees'); setMenuOpen(false); }}>
              <FeeIcon /> Fees Control
            </button>
            <button className={`tp-sidebar-nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => { handleTabClick('profile'); setMenuOpen(false); }}>
              <ProfileIcon /> Profile Settings
            </button>
          </div>
          <div className="tp-drawer-bottom" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p className="tp-drawer-label" style={{ margin: 0 }}>Signed in as</p>
            <p className="tp-drawer-name" style={{ margin: 0 }}>{user?.name || 'Administrator'}</p>
            <p className="tp-drawer-role" style={{ margin: 0 }}>Role: System Admin</p>
            <button className="tp-drawer-signout" onClick={signOut} style={{ margin: '8px 0 0' }}>Sign Out</button>
            <div className="tp-sidebar-footer" style={{ fontSize: 10.5, color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: 10, lineHeight: 1.4, textAlign: 'left' }}>
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
        <nav className="tp-sidebar-nav">
          <button title="Overview" className={`tp-sidebar-nav-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => handleTabClick('overview')}>
            <HomeIcon /> <span className="tp-sidebar-label">{lang === 'bn' ? 'সারসংক্ষেপ' : 'Overview'}</span>
          </button>
          <button title="User Logins" className={`tp-sidebar-nav-item ${activeTab === 'accounts' ? 'active' : ''}`} onClick={() => handleTabClick('accounts')}>
            <KeyIcon /> <span className="tp-sidebar-label">{lang === 'bn' ? 'ব্যবহারকারী অ্যাকাউন্টস' : 'User Logins'}</span>
          </button>
          <button title="Teachers" className={`tp-sidebar-nav-item ${activeTab === 'teachers' ? 'active' : ''}`} onClick={() => handleTabClick('teachers')}>
            <TeacherIcon /> <span className="tp-sidebar-label">{lang === 'bn' ? 'শিক্ষক মণ্ডলী' : 'Teachers'}</span>
          </button>
          <button title="Students" className={`tp-sidebar-nav-item ${activeTab === 'students' ? 'active' : ''}`} onClick={() => handleTabClick('students')}>
            <StudentIcon /> <span className="tp-sidebar-label">{lang === 'bn' ? 'শিক্ষার্থী তালিকা' : 'Students'}</span>
          </button>
          <button title="Exams" className={`tp-sidebar-nav-item ${activeTab === 'exams' ? 'active' : ''}`} onClick={() => handleTabClick('exams')}>
            <ExamIcon /> <span className="tp-sidebar-label">{lang === 'bn' ? 'পরীক্ষাসমূহ' : 'Exams'}</span>
          </button>
          <button title="Notices" className={`tp-sidebar-nav-item ${activeTab === 'notices' ? 'active' : ''}`} onClick={() => handleTabClick('notices')}>
            <NoticeIcon /> <span className="tp-sidebar-label">{lang === 'bn' ? 'নোটিশ বোর্ড' : 'Notices'}</span>
          </button>
          <button title="Fees Control" className={`tp-sidebar-nav-item ${activeTab === 'fees' ? 'active' : ''}`} onClick={() => handleTabClick('fees')}>
            <FeeIcon /> <span className="tp-sidebar-label">{lang === 'bn' ? 'ফি ব্যবস্থাপনা' : 'Fees Control'}</span>
          </button>
          <button title="Profile Settings" className={`tp-sidebar-nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => handleTabClick('profile')}>
            <ProfileIcon /> <span className="tp-sidebar-label">{lang === 'bn' ? 'পদ্ধতি সেটিংস' : 'Profile Settings'}</span>
          </button>
          <button title="Principal Panel" className="tp-sidebar-nav-item" onClick={() => navigate('/principal')}>
            <span style={{ fontSize: 18 }}>🏛️</span> <span className="tp-sidebar-label">{lang === 'bn' ? 'প্রিন্সিপাল পোর্টাল' : 'Principal Panel'}</span>
          </button>
        </nav>
        <div className="tp-sidebar-bottom" style={{ marginTop: 'auto' }}>
          <div className="tp-sidebar-divider" />
          <div className="tp-sidebar-user-info" style={{ padding: '0 4px', marginBottom: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1a2e4a', margin: '0 0 2px' }}>{user?.name || 'System Admin'}</p>
            <p style={{ fontSize: 11.5, color: '#94a3b8', margin: 0, textTransform: 'capitalize' }}>{lang === 'bn' ? 'এডমিনিস্ট্রেটর' : 'Administrator'}</p>
          </div>
          <button className="tp-sidebar-signout" onClick={signOut}>
            <LogoutIcon /> <span className="tp-sidebar-label">{lang === 'bn' ? 'সাইন আউট' : 'Sign Out'}</span>
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
        {/* Topbar */}
        <div className="tp-topbar">
          <button className="tp-icon-btn tp-hamburger" onClick={() => setMenuOpen(true)} aria-label="Menu">
            <HamburgerIcon />
          </button>
          <div className="tp-topbar-greeting">
            <div className="tp-topbar-title-row">
              <span className="tp-greeting-badge">🛡️</span>
              <h2>{schoolProfile.schoolName || 'Institution'} <span className="tp-user-name">Admin</span></h2>
            </div>
            <p className="tp-topbar-subtitle">
              <span>{schoolProfile?.location || window.localStorage.getItem('schoolLocation') || 'Administrator Hub'}</span>
              <span className="tp-sub-dot">•</span>
              <span>Full Control</span>
            </p>
          </div>
          <div className="tp-topbar-right">
            <NotificationBell
              userRole="admin"
              userId={user?.userId || 'admin'}
              activeSchoolId={activeSchoolId}
              onSelectNotice={(noticeId) => {
                handleTabClick('notices');
                setHighlightedNoticeId(noticeId);
                setTimeout(() => {
                  const el = document.getElementById(`notice-${noticeId}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
              }}
            />
            <button className="tp-logout-btn" onClick={signOut} aria-label="Logout">
              <LogoutIcon /> <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="ov-container">
            {/* 60-30-10 Hero Banner */}
            <div className="ov-hero-card">
              <div className="ov-hero-top">
                <div className="ov-hero-badge">
                  <span>⚡</span>
                  <span>{lang === 'bn' ? 'এডমিন কন্ট্রোল প্যানেল' : 'ADMINISTRATOR CONTROL PANEL'}</span>
                </div>
                <div className="ov-hero-badge" style={{ background: 'rgba(34, 197, 94, 0.18)', color: '#86efac', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                  <span>●</span>
                  <span>{lang === 'bn' ? 'সিস্টেম অনলাইন' : 'SYSTEM ONLINE'}</span>
                </div>
              </div>

              <h1 className="ov-hero-title">
                {schoolProfile.schoolName || 'Institution'} {lang === 'bn' ? 'ড্যাশবোর্ড' : 'Dashboard'}
              </h1>
              <p className="ov-hero-subtitle">
                {lang === 'bn' ? 'রিয়েল-টাইম নির্দেশিকা মনিটরিং, শিক্ষার্থী তালিকা, পরীক্ষার সময়সূচী এবং ব্যবহারকারীর তথ্য নিয়ন্ত্রণ।' : 'Real-time directory monitoring, student rosters, exam schedules, and user credential controls.'}
              </p>

              <div className="ov-hero-chips">
                <div className="ov-chip">
                  <span>📍</span>
                  <span>{schoolProfile?.location || (lang === 'bn' ? 'প্রধান ক্যাম্পাস' : 'Main Campus')}</span>
                </div>
                <div className="ov-chip">
                  <span>🏫</span>
                  <span>{hasLoadedRemote ? `${classes.length} ${lang === 'bn' ? 'মোট শ্রেণী' : 'Total Classes'}` : <BaseSkeleton width="75px" height="14px" style={{ display: 'inline-block' }} />}</span>
                </div>
                <div className="ov-chip">
                  <span>🔑</span>
                  <span>{hasLoadedRemote ? `${Object.keys(registeredAccounts).length} ${lang === 'bn' ? 'সক্রিয় ব্যবহারকারী' : 'Active Credentials'}` : <BaseSkeleton width="85px" height="14px" style={{ display: 'inline-block' }} />}</span>
                </div>
              </div>
            </div>

            {/* 60-30-10 Metrics Grid */}
            <div className="ov-stats-grid">
              <div
                className="ov-stat-card ov-stat-teachers"
                onClick={() => handleTabClick('teachers')}
                role="button"
                tabIndex={0}
              >
                <div className="ov-stat-top">
                  <div className="ov-stat-icon">👨‍🏫</div>
                  <span className="ov-stat-arrow">→</span>
                </div>
                <div>
                  <div className="ov-stat-value">
                    {hasLoadedRemote ? totalTeachers : <BaseSkeleton width="36px" height="28px" borderRadius="6px" />}
                  </div>
                  <div className="ov-stat-label">{lang === 'bn' ? 'মোট শিক্ষক' : 'Total Teachers'}</div>
                  <div className="ov-stat-tag">✓ {lang === 'bn' ? 'শিক্ষক তালিকা' : 'Faculty Roster'}</div>
                </div>
              </div>

              <div
                className="ov-stat-card ov-stat-students"
                onClick={() => handleTabClick('students')}
                role="button"
                tabIndex={0}
              >
                <div className="ov-stat-top">
                  <div className="ov-stat-icon">🎓</div>
                  <span className="ov-stat-arrow">→</span>
                </div>
                <div>
                  <div className="ov-stat-value">
                    {hasLoadedRemote ? totalStudents : <BaseSkeleton width="48px" height="28px" borderRadius="6px" />}
                  </div>
                  <div className="ov-stat-label">{lang === 'bn' ? 'মোট শিক্ষার্থী' : 'Total Students'}</div>
                  <div className="ov-stat-tag">● {lang === 'bn' ? 'সক্রিয় ডিরেক্টরি' : 'Active Directory'}</div>
                </div>
              </div>

              <div
                className="ov-stat-card ov-stat-exams"
                onClick={() => handleTabClick('exams')}
                role="button"
                tabIndex={0}
              >
                <div className="ov-stat-top">
                  <div className="ov-stat-icon">📅</div>
                  <span className="ov-stat-arrow">→</span>
                </div>
                <div>
                  <div className="ov-stat-value">
                    {hasLoadedRemote ? totalExams : <BaseSkeleton width="36px" height="28px" borderRadius="6px" />}
                  </div>
                  <div className="ov-stat-label">{lang === 'bn' ? 'নির্ধারিত পরীক্ষা' : 'Exams Scheduled'}</div>
                  <div className="ov-stat-tag">📝 {lang === 'bn' ? 'পরীক্ষার সময়সূচী' : 'Test Schedules'}</div>
                </div>
              </div>

              <div
                className="ov-stat-card ov-stat-logins"
                onClick={() => handleTabClick('accounts')}
                role="button"
                tabIndex={0}
              >
                <div className="ov-stat-top">
                  <div className="ov-stat-icon">🔑</div>
                  <span className="ov-stat-arrow">→</span>
                </div>
                <div>
                  <div className="ov-stat-value">
                    {hasLoadedRemote ? Object.keys(registeredAccounts).length : <BaseSkeleton width="36px" height="28px" borderRadius="6px" />}
                  </div>
                  <div className="ov-stat-label">{lang === 'bn' ? 'নিবন্ধিত অ্যাকাউন্ট' : 'Registered Logins'}</div>
                  <div className="ov-stat-tag">⚡ {lang === 'bn' ? 'ব্যবহারকারী তথ্য' : 'Provision Credentials'}</div>
                </div>
              </div>
            </div>

            {/* Quick Command Center */}
            <div className="ov-section-card">
              <div className="ov-section-header">
                <h3 className="ov-section-title">
                  <span>⚡</span>
                  <span>Quick Command Hub</span>
                </h3>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Instant Admin Actions</span>
              </div>

              <div className="ov-actions-grid">
                <button type="button" className="ov-action-btn" onClick={() => handleTabClick('accounts')}>
                  <span className="ov-action-icon">🔑</span>
                  <span>User Login Credentials</span>
                </button>
                <button type="button" className="ov-action-btn" onClick={() => handleTabClick('teachers')}>
                  <span className="ov-action-icon">👨‍🏫</span>
                  <span>Manage Teachers Roster</span>
                </button>
                <button type="button" className="ov-action-btn" onClick={() => handleTabClick('students')}>
                  <span className="ov-action-icon">🎓</span>
                  <span>Student Directory</span>
                </button>
                <button type="button" className="ov-action-btn" onClick={() => handleTabClick('exams')}>
                  <span className="ov-action-icon">📅</span>
                  <span>Exam Schedules</span>
                </button>
                <button type="button" className="ov-action-btn" onClick={() => handleTabClick('fees')}>
                  <span className="ov-action-icon">💳</span>
                  <span>Fee Management</span>
                </button>
                <button type="button" className="ov-action-btn" onClick={() => handleTabClick('notices')}>
                  <span className="ov-action-icon">📢</span>
                  <span>School Bulletins</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: User Logins (Accounts Creation) */}
        {activeTab === 'accounts' && (
          <div className="uc-section-container" style={{ padding: '24px 20px' }}>
            {/* Create Account Form Card */}
            <div className="uc-card">
              <div className="uc-card-header">
                <div className="uc-card-icon">⚡</div>
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
                        placeholder={
                          (accountForm.role === 'teacher' || accountForm.role === 'class_teacher')
                            ? 'Use teacher ID or email'
                            : accountForm.role === 'principal'
                              ? 'Use principal username or email'
                              : 'Use student ID or alias'
                        }
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
                  <button className="uc-submit-btn" type="submit">
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
                  const isViewerSuperAdmin = !!(user?.isSuperAdmin || viewerUid === '@@siam##' || String(user?.role || '').toLowerCase() === 'superadmin');

                  return Object.values(registeredAccounts)
                    .filter(acc => {
                      if (!acc || !acc.userId) return false;
                      const uLower = String(acc.userId || '').trim().toLowerCase();
                      const isTargetSuperAdmin = !!(acc.isSuperAdmin || uLower === '@@siam##');
                      if (isTargetSuperAdmin && !isViewerSuperAdmin) {
                        return false; // Hide Super Admin accounts completely from normal admin
                      }
                      return true;
                    })
                    .map(acc => {
                      const uLower = String(acc.userId || '').trim().toLowerCase();
                      const isTargetSuperAdmin = !!(acc.isSuperAdmin || uLower === '@@siam##');
                      const isSelf = !!(user?.userId && String(user.userId).trim().toLowerCase() === uLower);
                      const isTargetAdmin = acc.role === 'admin' || isTargetSuperAdmin;
                      const isProtectedAcc = isTargetSuperAdmin || isSelf || (!isViewerSuperAdmin && acc.role === 'admin');
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
                              : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';

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
                    if (!isViewerSuperAdmin && acc.role === 'admin') return false;
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

        {/* Tab 3: Teachers */}
        {activeTab === 'teachers' && (
          <div className="tp-teachers-tab-container">
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
              <div className="tp-teachers-header-actions">
                <button
                  className="tp-teachers-add-btn"
                  onClick={() => setShowAddTeacher(true)}
                >
                  <span className="tp-add-icon">➕</span>
                  <span>Add Teacher</span>
                </button>
              </div>
            </div>

            {/* Quick Search Bar */}
            {teachers.length > 0 && (
              <div className="tp-teachers-search-wrapper">
                <span className="tp-teachers-search-icon">🔍</span>
                <input
                  type="text"
                  className="tp-teachers-search-input"
                  placeholder="Search by name, subject, or email..."
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                />
                {teacherSearch && (
                  <button className="tp-teachers-search-clear" onClick={() => setTeacherSearch('')}>✕</button>
                )}
              </div>
            )}

            {/* Teacher Cards Grid */}
            {!hasLoadedRemote ? (
              <CardSkeleton count={4} height={140} />
            ) : filteredTeachers.length === 0 ? (
              <div className="tp-teachers-empty-state">
                <div className="tp-empty-icon">👨‍🏫</div>
                <h3>{teacherSearch ? 'No matching teachers found' : 'No teachers added yet'}</h3>
                <p>{teacherSearch ? 'Try searching with a different keyword or name.' : 'Add your first faculty member to manage their profile and contact details.'}</p>
                {!teacherSearch && (
                  <button className="tp-teachers-add-btn" onClick={() => setShowAddTeacher(true)}>
                    + Add First Teacher
                  </button>
                )}
              </div>
            ) : (
              <div className="tp-teacher-card-grid">
                {filteredTeachers.map((t, idx) => {
                  const teacherEmail = t?.email || `teacher-${idx}`;
                  const isSelected = deleteMode && selectedIds.has(teacherEmail);
                  return (
                    <div
                      key={teacherEmail}
                      className={`tp-teacher-card ${isSelected ? 'tp-card-selected' : ''}`}
                      onClick={deleteMode && t?.email ? () => toggleSelect(t.email) : undefined}
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
                            {t?.profilePic ? (
                              <img src={t.profilePic} alt={t?.name || 'Teacher'} className="tp-teacher-avatar-img" />
                            ) : (
                              <div className="tp-teacher-avatar-circle">
                                {String(t?.name || 'T').replace(/^(Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.)\s+/i, '').charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>

                          <div className="tp-teacher-identity">
                            <h3 className="tp-teacher-name">{t?.name || 'Unnamed Teacher'}</h3>
                            {t?.subject && (
                              <span className="tp-teacher-subject-badge">{t.subject}</span>
                            )}
                          </div>

                          {!deleteMode && (t?.phone || t?.email) && (
                            <div className="tp-teacher-quick-actions" onClick={(e) => e.stopPropagation()}>
                              {t?.phone && (
                                <a href={`tel:${t.phone}`} className="tp-quick-btn tp-quick-call" title="Call Teacher">
                                  📞
                                </a>
                              )}
                              {t?.email && (
                                <a href={`mailto:${t.email}`} className="tp-quick-btn tp-quick-mail" title="Send Email">
                                  ✉️
                                </a>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Contact Details List */}
                        <div className="tp-teacher-contact-list">
                          {t?.email && (
                            <a
                              href={`mailto:${t.email}`}
                              className="tp-contact-chip"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="tp-contact-icon">✉️</span>
                              <span className="tp-contact-text">{t.email}</span>
                            </a>
                          )}
                          {t?.phone && (
                            <a
                              href={`tel:${t.phone}`}
                              className="tp-contact-chip"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="tp-contact-icon">📞</span>
                              <span className="tp-contact-text">{t.phone}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Remove / Delete Selection Bar */}
            <div className="tp-delete-section">
              {!deleteMode ? (
                <button
                  className="tp-delete-toggle-btn"
                  onClick={() => setDeleteMode(true)}
                  disabled={teachers.length === 0}
                >
                  <span>🗑️</span>
                  <span>Select to Remove</span>
                </button>
              ) : (
                <div className="tp-delete-bar">
                  <span className="tp-delete-count">{selectedIds.size} selected</span>
                  <div className="tp-delete-bar-right">
                    <button
                      className="tp-delete-cancel-btn"
                      onClick={() => { setDeleteMode(false); setSelectedIds(new Set()); }}
                    >
                      Cancel
                    </button>
                    <button
                      className="tp-delete-exec-btn"
                      disabled={selectedIds.size === 0}
                      onClick={executeDelete}
                    >
                      Delete Selected
                    </button>
                  </div>
                </div>
              )}
            </div>

            {showAddTeacher && (
              <AddTeacherModal
                onClose={() => setShowAddTeacher(false)}
                onAdd={(newT) => {
                  setTeachers([...teachers, newT]);
                  setShowAddTeacher(false);
                }}
              />
            )}
          </div>
        )}

        {/* Tab 4: Students */}
        {activeTab === 'students' && (
          <div style={{ padding: '24px 20px' }}>

            {/* ── Level 1: Branch Directory ── */}
            {selectedClassIdx === null && selectedBranchKey === null && (
              <>
                <div style={{ marginBottom: 20 }}>
                  <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: '#1a2e4a' }}>Student Directory</h2>
                  <p style={{ margin: 0, fontSize: 13, color: '#64748b', fontWeight: 500 }}>Select an institution branch to manage its student roster.</p>
                </div>
                <div className="tp-class-grid" style={{ padding: 0 }}>
                  {activeBranchKeys.map((branchKey) => {
                    const branch = resolvedBranches[branchKey] || SCHOOL_BRANCHES[branchKey];
                    const branchClasses = filterClassesByBranch(classes, branchKey);
                    const totalStudents = branchClasses.reduce((acc, c) => acc + (c.students?.length || 0), 0);
                    const isEditing = editingBranchKey === branchKey;
                    const isMenuOpen = openBranchMenuKey === branchKey;

                    return (
                      <div
                        key={branchKey}
                        className="tp-class-card tp-branch-menu-container"
                        onClick={() => {
                          if (!isEditing) {
                            setSelectedBranchKey(branchKey);
                          }
                        }}
                        style={{
                          '--cls-color': branch.color,
                          background: '#fff',
                          border: `2px solid ${branch.color}22`,
                          transition: 'box-shadow 0.2s, transform 0.15s',
                          position: 'relative',
                          cursor: isEditing ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '16px 20px',
                          borderRadius: '12px'
                        }}
                      >
                        {/* 3-Dot Options Button */}
                        <button
                          type="button"
                          className="tp-branch-dots-btn"
                          title="Branch Options"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenBranchMenuKey(isMenuOpen ? null : branchKey);
                          }}
                          style={{
                            position: 'absolute',
                            top: 10,
                            right: 10,
                            background: isMenuOpen ? '#e2e8f0' : 'transparent',
                            border: 'none',
                            borderRadius: '6px',
                            width: 32,
                            height: 32,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#475569',
                            fontSize: 20,
                            fontWeight: 'bold',
                            lineHeight: 1,
                            zIndex: 5,
                            transition: 'background 0.2s, color 0.2s',
                          }}
                        >
                          ⋮
                        </button>

                        {/* Dropdown Menu */}
                        {isMenuOpen && (
                          <div
                            className="tp-branch-menu-dropdown"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              position: 'absolute',
                              top: 44,
                              right: 10,
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '8px',
                              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12), 0 8px 10px -6px rgba(0,0,0,0.08)',
                              zIndex: 20,
                              minWidth: 170,
                              padding: '4px 0',
                              overflow: 'hidden'
                            }}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenBranchMenuKey(null);
                                setEditingBranchKey(branchKey);
                                setTempBranchName(branch.name);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                width: '100%',
                                padding: '9px 14px',
                                background: 'none',
                                border: 'none',
                                textAlign: 'left',
                                fontSize: 13,
                                fontWeight: 600,
                                color: '#1e293b',
                                cursor: 'pointer',
                                transition: 'background 0.15s',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                            >
                              <span style={{ fontSize: 14 }}>✏️</span> Edit Branch Name
                            </button>
                          </div>
                        )}

                        <div className="tp-class-card-num" style={{ background: `linear-gradient(135deg, ${branch.gradientFrom}, ${branch.gradientTo})`, fontSize: 22 }}>
                          {branch.emoji}
                        </div>
                        <div className="tp-class-card-body" style={{ flex: 1, paddingRight: isEditing ? 0 : 20 }}>
                          {isEditing ? (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', marginTop: 2 }}
                            >
                              <input
                                type="text"
                                value={tempBranchName}
                                onChange={(e) => setTempBranchName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveBranchName(branchKey, tempBranchName);
                                  }
                                  if (e.key === 'Escape') {
                                    setEditingBranchKey(null);
                                  }
                                }}
                                autoFocus
                                placeholder="Branch Name..."
                                style={{
                                  padding: '6px 10px',
                                  fontSize: 13.5,
                                  fontWeight: 700,
                                  border: `2px solid ${branch.color}`,
                                  borderRadius: 6,
                                  outline: 'none',
                                  width: '100%',
                                  color: '#1e293b',
                                  boxShadow: '0 0 0 3px ' + branch.color + '22'
                                }}
                              />
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSaveBranchName(branchKey, tempBranchName);
                                  }}
                                  disabled={savingBranch}
                                  style={{
                                    padding: '4px 12px',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    background: branch.color,
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    opacity: savingBranch ? 0.7 : 1
                                  }}
                                >
                                  {savingBranch ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingBranchKey(null);
                                  }}
                                  disabled={savingBranch}
                                  style={{
                                    padding: '4px 12px',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    background: '#f1f5f9',
                                    color: '#475569',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="tp-class-card-title" style={{ fontSize: 13.5, lineHeight: 1.35, margin: 0, fontWeight: 700, color: '#1a2e4a' }}>{branch.name}</p>
                              <p className="tp-class-card-count" style={{ color: branch.color, margin: '2px 0 0', fontSize: 12 }}>
                                {hasLoadedRemote ? `${branchClasses.length} Classes · ${totalStudents} Students` : <BaseSkeleton width="120px" height="13px" style={{ display: 'inline-block' }} />}
                              </p>
                            </>
                          )}
                        </div>
                        {!isEditing && (
                          <div className="tp-class-card-arrow" style={{ marginLeft: 'auto' }}><ChevronRight /></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── Level 2: Classes within Branch ── */}
            {selectedBranchKey !== null && selectedClassIdx === null && (() => {
              const branch = resolvedBranches[selectedBranchKey] || SCHOOL_BRANCHES[selectedBranchKey];
              const branchClasses = filterClassesByBranch(classes, selectedBranchKey);
              return (
                <>
                  <div className="tp-section-header" style={{ marginBottom: 16 }}>
                    <button
                      className="tp-back-btn"
                      onClick={() => { setSelectedBranchKey(null); setDeleteMode(false); setSelectedIds(new Set()); }}
                      title="Back to Branches"
                      aria-label="Back to Branches"
                    >
                      <ChevronLeft />
                    </button>
                    <div className="tp-section-header-info">
                      <div className="tp-breadcrumbs" aria-label="Breadcrumb">
                        <button type="button" className="tp-crumb-link" onClick={() => { setSelectedBranchKey(null); setDeleteMode(false); setSelectedIds(new Set()); }}>Branches</button>
                        <span className="tp-crumb-separator">/</span>
                        <span className="tp-crumb-current">{branch.name}</span>
                      </div>
                      <h2 className="tp-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{branch.emoji}</span> {branch.name}
                      </h2>
                    </div>
                  </div>
                  <div className="tp-class-grid" style={{ padding: 0 }}>
                    {branchClasses.map((cls) => {
                      const globalIdx = classes.findIndex(c => c.className === cls.className);
                      const color = CLASS_COLORS[globalIdx % CLASS_COLORS.length];
                      return (
                        <div key={cls.className} style={{ position: 'relative' }}>
                          <button
                            className="tp-class-card"
                            onClick={() => setSelectedClassIdx(globalIdx)}
                            style={{ '--cls-color': color, width: '100%', border: 'none' }}
                          >
                            <div className="tp-class-card-num" style={{ background: color, fontSize: 13, fontWeight: 800 }}>
                              {String(cls?.className || '').replace('Class ', '') || cls?.className || ''}
                            </div>
                            <div className="tp-class-card-body">
                              <p className="tp-class-card-title">{cls.className}</p>
                              <p className="tp-class-card-count">{cls.students?.length || 0} Students</p>
                            </div>
                            <div className="tp-class-card-arrow"><ChevronRight /></div>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClassClick(globalIdx, cls.className);
                            }}
                            title="Delete Class"
                            style={{
                              position: 'absolute',
                              top: -8,
                              right: -8,
                              width: 26,
                              height: 26,
                              borderRadius: '50%',
                              border: '1px solid #fecaca',
                              background: '#fef2f2',
                              color: '#ef4444',
                              fontSize: 12,
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                              zIndex: 10,
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                    <button
                      onClick={() => {
                        setNewClassBranch(selectedBranchKey || 'primary');
                        setShowAddClassModal(true);
                      }}
                      style={{
                        border: '2px dashed #cbd5e1',
                        borderRadius: 14,
                        padding: '20px 18px',
                        background: '#f8fafc',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#64748b',
                        fontWeight: 700,
                        fontSize: 14,
                        minHeight: 88,
                        gap: 8,
                        transition: 'all 0.2s',
                        width: '100%',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = branch.color; e.currentTarget.style.color = branch.color; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#64748b'; }}
                    >
                      <span style={{ fontSize: 20 }}>➕</span>
                      <span>Add Custom Class</span>
                    </button>
                  </div>
                  {showAddClassModal && (
                    <div className="tp-modal-overlay" onClick={submittingClass ? undefined : () => { setShowAddClassModal(false); setAddClassError(''); }}>
                      <div className="tp-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                        <div className="tp-modal-header" style={{ borderBottomColor: SCHOOL_BRANCHES[newClassBranch]?.color || '#2563eb' }}>
                          <h3 className="tp-modal-title">➕ Add Custom Class</h3>
                          <button className="tp-modal-close" onClick={() => { setShowAddClassModal(false); setAddClassError(''); }} disabled={submittingClass}>✕</button>
                        </div>
                        <form
                          className="tp-modal-body"
                          style={{ padding: 20 }}
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleAddClassSubmit();
                          }}
                        >
                          <div className="tp-form-group" style={{ marginBottom: 16 }}>
                            <label className="tp-form-label">Target School Track / Branch</label>
                            <select
                              className="tp-form-input"
                              value={newClassBranch}
                              onChange={(e) => setNewClassBranch(e.target.value)}
                              disabled={submittingClass}
                            >
                              {activeBranchKeys.includes('primary') && <option value="primary">{resolvedBranches.primary?.name || 'Primary School'}</option>}
                              {activeBranchKeys.includes('secondary') && <option value="secondary">{resolvedBranches.secondary?.name || 'High School'}</option>}
                              {activeBranchKeys.includes('college') && <option value="college">{resolvedBranches.college?.name || 'College'}</option>}
                            </select>
                          </div>
                          <div className="tp-form-group" style={{ marginBottom: 16 }}>
                            <label className="tp-form-label">Class Nomenclature Name</label>
                            <input
                              className="tp-form-input"
                              type="text"
                              placeholder={newClassBranch === 'college' ? 'e.g. Inter First Year' : 'e.g. Little Nursery'}
                              value={newClassName}
                              onChange={(e) => {
                                setNewClassName(e.target.value);
                                if (addClassError) setAddClassError('');
                              }}
                              disabled={submittingClass}
                              autoFocus
                              required
                            />
                            {addClassError && (
                              <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4, fontWeight: 600 }}>{addClassError}</p>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                            <button
                              type="button"
                              className="tp-modal-cancel-btn"
                              style={{ flex: 1, padding: '10px 0' }}
                              onClick={() => { setShowAddClassModal(false); setNewClassName(''); setAddClassError(''); }}
                              disabled={submittingClass}
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="tp-add-student-btn"
                              style={{ flex: 1, padding: '10px 0', background: SCHOOL_BRANCHES[newClassBranch]?.color || '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: submittingClass ? 0.75 : 1 }}
                              disabled={submittingClass}
                            >
                              {submittingClass ? (
                                <>
                                  <span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
                                  <span>Saving...</span>
                                </>
                              ) : (
                                'Add Class'
                              )}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            {/* ── Level 3: Student Roster within Class ── */}
            {selectedClassIdx !== null && classes?.[selectedClassIdx] && (() => {
              const targetClass = classes[selectedClassIdx];
              const targetStudents = Array.isArray(targetClass?.students) ? targetClass.students : [];

              return (
                <div>
                  <div className="tp-section-header" style={{ marginBottom: 16 }}>
                    <button
                      className="tp-back-btn"
                      onClick={() => { setSelectedClassIdx(null); setDeleteMode(false); setSelectedIds(new Set()); }}
                      title="Back to Classes"
                      aria-label="Back to Classes"
                    >
                      <ChevronLeft />
                    </button>
                    <div className="tp-section-header-info">
                      <div className="tp-breadcrumbs" aria-label="Breadcrumb">
                        <button type="button" className="tp-crumb-link" onClick={() => { setSelectedClassIdx(null); setDeleteMode(false); setSelectedIds(new Set()); }}>{selectedBranchKey ? SCHOOL_BRANCHES[selectedBranchKey]?.shortName : 'Classes'}</button>
                        <span className="tp-crumb-separator">/</span>
                        <span className="tp-crumb-current">{targetClass.className}</span>
                      </div>
                      <h2 className="tp-section-title">{targetClass.className}</h2>
                    </div>
                  </div>
                  <div className="tp-roster-toolbar" style={{ padding: '0 0 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="tp-roster-badge">🎓 {targetStudents.length} Enrolled</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
                      <button
                        className="tp-add-student-btn"
                        style={{ background: '#0284c7' }}
                        onClick={() => window.print()}
                        disabled={targetStudents.length === 0}
                      >
                        🖨️ Print Class ID & Passwords
                      </button>
                      <button className="tp-add-student-btn" style={{ background: '#2563eb' }} onClick={() => setShowAddStudent(true)}>
                        + Add Student
                      </button>
                    </div>
                  </div>

                  {targetStudents.length === 0 ? (
                    <div className="tp-roster-empty">
                      <span>👥</span>
                      <p>No students in this class yet.</p>
                    </div>
                  ) : (
                    <div className="tp-student-roster-grid" style={{ padding: 0 }}>
                      {targetStudents.map((s, idx) => (
                        <div key={s?.id || idx} className={`tp-student-roster-card ${deleteMode && selectedIds.has(s?.id) ? 'tp-card-selected' : ''}`} onClick={deleteMode ? () => toggleSelect(s?.id) : undefined} style={{ cursor: deleteMode ? 'pointer' : 'default' }}>
                          {deleteMode && (
                            <div className={`tp-roster-checkbox ${selectedIds.has(s?.id) ? 'tp-cb-checked' : ''}`}>
                              {selectedIds.has(s?.id) ? '✓' : ''}
                            </div>
                          )}
                          {s?.profilePic ? (
                            <img src={s.profilePic} alt={s.name} className="tp-roster-avatar-img" />
                          ) : (
                            <div className="tp-roster-avatar" style={{ background: CLASS_COLORS[selectedClassIdx % CLASS_COLORS.length] }}>{String(s?.name || 'S').charAt(0)}</div>
                          )}
                          <div className="tp-roster-info">
                            <p className="tp-roster-name">{s?.name || 'Unnamed Student'}</p>
                            <p className="tp-roster-id">ID: {s?.id || 'N/A'}</p>
                            <p className="tp-roster-roll">Roll No: {s?.roll || 'N/A'}</p>
                            <p className="tp-roster-meta">Age: {s?.age || 'N/A'} · DOB: {s?.birthday || 'N/A'}</p>
                            {(s?.phone || s?.address) && <p className="tp-roster-meta">{s.phone ? `Phone: ${s.phone}` : ''}{s.phone && s.address ? ' · ' : ''}{s.address || ''}</p>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
                            <button
                              type="button"
                              className="tp-add-student-btn"
                              style={{ background: '#0ea5e9', boxShadow: 'none', fontSize: 12, padding: '7px 13px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingStudent(s);
                              }}
                              disabled={deleteMode}
                            >
                              Edit
                            </button>
                            <span className="tp-roster-num">#{String(idx + 1).padStart(2, '0')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Printable Credentials Roster wrapped in PrintContainer */}
                  <div className="printable-credentials-area printable-area" style={{ marginTop: 0 }}>
                    <PrintContainer
                      title="Student Credentials Roster"
                      subtitle={`Class: ${targetClass.className}`}
                      schoolName={schoolProfile?.schoolName}
                      showTriggerButton={false}
                      signatures={['Prepared By', 'Class Teacher', 'Headmaster']}
                    >
                      <div className="printable-credentials-grid print-grid-2col">
                        {targetStudents.map((student, idx) => (
                          <div key={student?.id || idx} className="printable-card print-card-box">
                            <div className="printable-card-header">
                              <span className="printable-card-school school-mini-name">{schoolProfile?.schoolName || window.localStorage.getItem('schoolName') || 'ScholasticBase'}</span>
                              <span className="printable-card-class">{targetClass.className}</span>
                            </div>
                            <h4 className="printable-card-name">👤 {student?.name || 'Student'}</h4>
                            <div className="printable-card-field">
                              <span className="printable-card-label">Username (Student ID):</span>
                              <span className="printable-card-value">{student?.id || 'N/A'}</span>
                            </div>
                            <div className="printable-card-field">
                              <span className="printable-card-label">Password (Roll No):</span>
                              <span className="printable-card-value">{student?.roll || 'N/A'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </PrintContainer>
                  </div>

                  <div className="tp-delete-section">
                    {!deleteMode ? (
                      <button className="tp-delete-toggle-btn" onClick={() => setDeleteMode(true)} disabled={targetStudents.length === 0}>🗑️ Select to Remove</button>
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

                  {editingStudent && (
                    <EditStudentModal
                      student={editingStudent}
                      classColor={CLASS_COLORS[selectedClassIdx % CLASS_COLORS.length]}
                      onClose={() => setEditingStudent(null)}
                      onSave={handleUpdateStudent}
                    />
                  )}

                  {showAddStudent && (
                    <AddStudentModal classNum={targetClass.classNum} onClose={() => setShowAddStudent(false)} onAdd={(newS) => {
                      setClasses(prev => (Array.isArray(prev) ? prev : []).map((cls, idx) => {
                        if (idx !== selectedClassIdx) return cls;
                        const existingStudents = Array.isArray(cls.students) ? cls.students : [];
                        const nextRoll = String(existingStudents.length + 1).padStart(2, '0');
                        return { ...cls, students: [...existingStudents, { ...newS, roll: nextRoll }] };
                      }));
                      setShowAddStudent(false);
                    }} />
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Tab 5: Exams */}
        {activeTab === 'exams' && (
          <div style={{ padding: '24px 20px' }}>
            <div className="tp-roster-toolbar" style={{ padding: '0 0 16px' }}>
              <span className="tp-roster-badge" style={{ background: '#f3e8ff', color: '#6b21a8', borderColor: '#d8b4fe' }}>
                📅 {exams.length} Schedules
              </span>
              <button className="tp-add-student-btn" style={{ background: '#8b5cf6' }} onClick={() => setShowAddExam(true)}>
                + Schedule Exam
              </button>
            </div>

            <div className="tp-student-roster-grid" style={{ padding: 0 }}>
              {exams.map(e => {
                const uniqueKey = `${e.subject}-${e.grade}`;
                return (
                  <div key={uniqueKey} className={`tp-student-roster-card ${deleteMode && selectedIds.has(uniqueKey) ? 'tp-card-selected' : ''}`} onClick={deleteMode ? () => toggleSelect(uniqueKey) : undefined} style={{ cursor: deleteMode ? 'pointer' : 'default' }}>
                    {deleteMode && (
                      <div className={`tp-roster-checkbox ${selectedIds.has(uniqueKey) ? 'tp-cb-checked' : ''}`}>
                        {selectedIds.has(uniqueKey) ? '✓' : ''}
                      </div>
                    )}
                    <div className="tp-roster-info">
                      <p className="tp-roster-name">{e.subject}</p>
                      <p className="tp-roster-id">Target: {e.grade}</p>
                      <p className="tp-roster-roll">Time: {e.time}</p>
                      <p className="tp-roster-meta">Date: {e.date}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="tp-delete-section">
              {!deleteMode ? (
                <button className="tp-delete-toggle-btn" onClick={() => setDeleteMode(true)} disabled={exams.length === 0}>🗑️ Select to Remove</button>
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

            {showAddExam && <AddExamModal onClose={() => setShowAddExam(false)} onAdd={(newEx) => { setExams([...exams, newEx]); setShowAddExam(false); }} />}
          </div>
        )}

        {/* Tab 6: Notices */}
        {activeTab === 'notices' && (
          <div style={{ padding: '24px clamp(16px, 3vw, 32px)' }}>
            <div className="tp-notice-toolbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h2 className="tp-section-title" style={{ margin: 0, fontSize: 22 }}>📢 Notice Board</h2>
                <span className="tp-roster-badge" style={{ background: '#ffedd5', color: '#c2410c', borderColor: '#fed7aa', fontSize: 13, padding: '4px 12px', borderRadius: 20, fontWeight: 700 }}>
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
                    <button className="tp-add-student-btn" style={{ background: '#f97316', margin: 0 }} onClick={() => setShowAddNotice(true)}>
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
                        <a href={n.fileData} download={n.fileName || `notice-${n.id}`} style={{ color: '#f97316', fontWeight: 700, fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
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
                  name: profileForm?.adminName?.trim() || schoolProfile?.adminName || user?.name || 'Administrator',
                  role: 'admin',
                  userId: user?.userId || 'admin',
                  profilePic: schoolProfile?.logo || user?.profilePic || '',
                }}
                onAdd={(newN) => {
                  addNotice(newN, activeSchoolId);
                  setShowAddNotice(false);
                }}
              />
            )}
          </div>
        )}

        {/* Tab 7: Fees Control */}
        {activeTab === 'fees' && (
          <SectionErrorBoundary sectionName="Fee Management System">
            <FeeManagementSystem userRole="admin" />
          </SectionErrorBoundary>
        )}

        {/* Tab 8: Profile Settings */}
        {activeTab === 'profile' && (
          <div className="adm-profile-container" style={{ padding: '20px 16px', maxWidth: 1100, margin: '0 auto' }}>

            {/* ── HERO BANNER ── */}
            <div className="tp-hero" style={{ marginBottom: 20, alignItems: 'center', borderRadius: 16 }}>
              <div className="tp-greeting">
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', width: 'fit-content', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    ⚙️ {lang === 'bn' ? 'প্রতিষ্ঠানের সেটিংস ও ব্রান্ডিং' : 'Institution Branding & Settings'}
                  </span>
                </div>
                <h1 style={{ fontSize: 'clamp(18px, 3.5vw, 26px)', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                  {lang === 'bn' ? 'এডমিন প্রোফাইল ও স্কুল সেটিংস' : 'Admin Profile & School Branding'}
                </h1>
                <p style={{ fontSize: 'clamp(12px, 2vw, 13.5px)', margin: '4px 0 0', opacity: 0.9, color: '#e2e8f0' }}>
                  {lang === 'bn' ? 'আপনার প্রতিষ্ঠানের নাম, যোগাযোগের বিবরণী, ভাষা এবং বিভিন্ন শাখার পরিচালনা করুন।' : 'Manage your institutional crest, contact info, language, and active branch structures.'}
                </p>
              </div>

              {/* Live Preview Card */}
              <div className="tp-school-brand" style={{ background: '#ffffff', borderRadius: 14, padding: '10px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                <SafeImage
                  src={profileForm.logo}
                  alt={`${profileForm.schoolName} crest`}
                  className="tp-crest"
                  style={{ width: 52, height: 52, borderRadius: 10, flexShrink: 0, objectFit: 'contain' }}
                  fallbackVariant="school"
                  fallbackText={profileForm.schoolName || 'School'}
                />
                <div style={{ flex: '1 1 0%', minWidth: 0 }}>
                  <span className="tp-school-name" style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {profileForm.schoolName || 'School Name'}
                  </span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
                    {profileForm.eiinNumber && (
                      <span className="adm-eiin-badge" style={{ fontSize: 11, background: '#eff6ff', color: '#1d4ed8', padding: '2px 7px', borderRadius: 6, fontWeight: 800, border: '1px solid #bfdbfe', display: 'inline-block' }}>
                        EIIN: {profileForm.eiinNumber}
                      </span>
                    )}
                    {(profileForm.location || window.localStorage.getItem('schoolLocation')) && (
                      <span className="adm-location-text" style={{ fontSize: 12, color: '#334155', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        📍 {profileForm.location || window.localStorage.getItem('schoolLocation')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── FORM SECTIONS ── */}
            <form onSubmit={handleProfileSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* CARD 1: School Identity & Logo Branding */}
                <div className="adm-profile-card" style={{ background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '20px 22px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                  <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>
                      🏫
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                        {lang === 'bn' ? 'প্রতিষ্ঠানের পরিচয় ও লোগো' : 'School Identity & Crest'}
                      </h3>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                        {lang === 'bn' ? 'প্রতিষ্ঠানের নাম, ঠিকানা, ইআইআইএন নম্বর এবং অফিসিয়াল লোগো।' : 'Public institution name, address, EIIN number, and official crest logo.'}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 14 }}>
                    <div className="tp-form-group">
                      <label className="tp-form-label" style={{ fontWeight: 700, fontSize: 13, color: '#334155' }}>
                        {lang === 'bn' ? 'প্রতিষ্ঠানের নাম' : 'School Name'} <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <input
                        className="tp-form-input"
                        type="text"
                        value={profileForm.schoolName}
                        onChange={e => setProfileForm({ ...profileForm, schoolName: e.target.value })}
                        placeholder={lang === 'bn' ? 'প্রতিষ্ঠানের পুরো নাম লিখুন' : 'Enter full school name'}
                        required
                        style={{ borderRadius: 8, padding: '9px 12px', fontSize: 13.5 }}
                      />
                    </div>

                    <div className="tp-form-group">
                      <label className="tp-form-label" style={{ fontWeight: 700, fontSize: 13, color: '#334155' }}>
                        {lang === 'bn' ? 'ইআইআইএন নম্বর' : 'EIIN Number'}
                      </label>
                      <input
                        className="tp-form-input"
                        type="text"
                        value={profileForm.eiinNumber || ''}
                        onChange={e => setProfileForm({ ...profileForm, eiinNumber: e.target.value })}
                        placeholder="e.g. 130743"
                        style={{ borderRadius: 8, padding: '9px 12px', fontSize: 13.5 }}
                      />
                    </div>
                  </div>

                  <div className="tp-form-group" style={{ marginTop: 12 }}>
                    <label className="tp-form-label" style={{ fontWeight: 700, fontSize: 13, color: '#334155' }}>
                      {lang === 'bn' ? 'প্রতিষ্ঠানের ঠিকানা / অবস্থান' : 'School Location / Address'}
                    </label>
                    <input
                      className="tp-form-input"
                      type="text"
                      value={profileForm.location || ''}
                      onChange={e => setProfileForm({ ...profileForm, location: e.target.value })}
                      placeholder={lang === 'bn' ? 'যেমন: বেলাব, নরসিংদী, ঢাকা, বাংলাদেশ' : 'e.g. Belabo, Narsingdi, Dhaka, Bangladesh'}
                      style={{ borderRadius: 8, padding: '9px 12px', fontSize: 13.5 }}
                    />
                  </div>

                  {/* Logo Upload Box */}
                  <div style={{ marginTop: 16, padding: '14px 16px', background: '#f8fafc', borderRadius: 12, border: '1.5px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 58, height: 58, borderRadius: 12, overflow: 'hidden', border: '2px solid #ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', background: '#ffffff', flexShrink: 0 }}>
                        <img src={profileForm.logo} alt="School crest" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>{lang === 'bn' ? 'প্রাতিষ্ঠানিক লোগো' : 'Institutional Crest / Logo'}</div>
                        <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>{lang === 'bn' ? 'ব্র্যান্ডিংয়ের জন্য উচ্চমানের লোগো (PNG / JPG) আপলোড করুন।' : 'Upload high quality PNG or JPG image for app branding.'}</div>
                      </div>
                    </div>

                    <label style={{ background: '#2563eb', color: '#ffffff', padding: '8px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 6px rgba(37,99,235,0.25)', transition: 'all 0.2s ease' }}>
                      {lang === 'bn' ? '📷 লোগো আপলোড' : '📷 Upload Crest'}
                      <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
                    </label>
                  </div>
                </div>

                {/* CARD 2: Administrator Contact Information */}
                <div className="adm-profile-card" style={{ background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '20px 22px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                  <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>
                      👤
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                        {lang === 'bn' ? 'প্রশাসকের যোগাযোগের বিবরণী' : 'Administrator Contact Info'}
                      </h3>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                        {lang === 'bn' ? 'সিস্টেম পরিচিতি ও যোগাযোগের জন্য প্রধান প্রশাসকের বিবরণী।' : 'Primary admin profile details used for system communications and credentials.'}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 14 }}>
                    <div className="tp-form-group">
                      <label className="tp-form-label" style={{ fontWeight: 700, fontSize: 13, color: '#334155' }}>{lang === 'bn' ? 'এডমিনের পুরো নাম' : 'Admin Full Name'}</label>
                      <input className="tp-form-input" type="text" value={profileForm.adminName} onChange={e => setProfileForm({ ...profileForm, adminName: e.target.value })} placeholder="e.g. Principal Nazmul Alam" style={{ borderRadius: 8, padding: '9px 12px', fontSize: 13.5 }} />
                    </div>

                    <div className="tp-form-group">
                      <label className="tp-form-label" style={{ fontWeight: 700, fontSize: 13, color: '#334155' }}>{lang === 'bn' ? 'এডমিনের পদবী / পদ' : 'Admin Role / Title'}</label>
                      <input className="tp-form-input" type="text" value={profileForm.adminTitle} onChange={e => setProfileForm({ ...profileForm, adminTitle: e.target.value })} placeholder="e.g. Principal / Administrator" style={{ borderRadius: 8, padding: '9px 12px', fontSize: 13.5 }} />
                    </div>

                    <div className="tp-form-group">
                      <label className="tp-form-label" style={{ fontWeight: 700, fontSize: 13, color: '#334155' }}>{lang === 'bn' ? 'এডমিন ইমেইল' : 'Admin Email'}</label>
                      <input className="tp-form-input" type="email" value={profileForm.adminEmail} onChange={e => setProfileForm({ ...profileForm, adminEmail: e.target.value })} placeholder="admin@school.edu" style={{ borderRadius: 8, padding: '9px 12px', fontSize: 13.5 }} />
                    </div>

                    <div className="tp-form-group">
                      <label className="tp-form-label" style={{ fontWeight: 700, fontSize: 13, color: '#334155' }}>{lang === 'bn' ? 'এডমিন ফোন নম্বর' : 'Admin Phone'}</label>
                      <input className="tp-form-input" type="text" value={profileForm.adminPhone} onChange={e => setProfileForm({ ...profileForm, adminPhone: e.target.value })} placeholder="01700000000" style={{ borderRadius: 8, padding: '9px 12px', fontSize: 13.5 }} />
                    </div>
                  </div>
                </div>

                {/* CARD 3: System Display Language */}
                <div className="adm-profile-card" style={{ background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '20px 22px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                  <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>
                      🌐
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                        {lang === 'bn' ? 'সিস্টেম অ্যাপ্লিকেশন ভাষা' : 'System Language Preference'}
                      </h3>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                        {lang === 'bn' ? 'স্টুডেন্ট পোর্টাল, রুটিন এবং রিপোর্ট কার্ডে প্রদর্শিত প্রাতিষ্ঠানিক ভাষা।' : 'Default display language for student panels, routine views, and report cards.'}
                      </p>
                    </div>
                  </div>

                  <div className="adm-lang-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                    {/* English Option */}
                    <div
                      onClick={() => {
                        setLanguage('en');
                        setProfileForm(prev => ({ ...prev, language: 'en' }));
                        setSchoolProfile({ language: 'en' });
                      }}
                      style={{
                        padding: '14px 16px',
                        borderRadius: 12,
                        border: (lang === 'en' || profileForm.language === 'en') ? '2px solid #2563eb' : '1px solid #cbd5e1',
                        background: (lang === 'en' || profileForm.language === 'en') ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 24 }}>🇬🇧</span>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>English</div>
                          <div style={{ fontSize: 11.5, color: '#64748b' }}>{lang === 'bn' ? 'আন্তর্জাতিক ভাষা' : 'Default International'}</div>
                        </div>
                      </div>
                      {(lang === 'en' || profileForm.language === 'en') && (
                        <span style={{ background: '#2563eb', color: '#ffffff', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>✓</span>
                      )}
                    </div>

                    {/* Bengali Option */}
                    <div
                      onClick={() => {
                        setLanguage('bn');
                        setProfileForm(prev => ({ ...prev, language: 'bn' }));
                        setSchoolProfile({ language: 'bn' });
                      }}
                      style={{
                        padding: '14px 16px',
                        borderRadius: 12,
                        border: (lang === 'bn' || profileForm.language === 'bn') ? '2px solid #16a34a' : '1px solid #cbd5e1',
                        background: (lang === 'bn' || profileForm.language === 'bn') ? '#f0fdf4' : '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 24 }}>🇧🇩</span>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>বাংলা (Bengali)</div>
                          <div style={{ fontSize: 11.5, color: '#64748b' }}>{lang === 'bn' ? 'জাতীয় ভাষা ইন্টারফেস (সক্রিয়)' : 'জাতীয় ভাষা ইন্টারফেস'}</div>
                        </div>
                      </div>
                      {(lang === 'bn' || profileForm.language === 'bn') && (
                        <span style={{ background: '#16a34a', color: '#ffffff', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>✓</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* CARD 4: Institutional Branch Titles & Activation */}
                <div className="adm-profile-card" style={{ background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '20px 22px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                  <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f3e8ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>
                      🏛️
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                        {lang === 'bn' ? 'প্রতিষ্ঠানের শাখা ও নাম নির্ধারণ' : 'Institutional Branches & Active Selection'}
                      </h3>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                        {lang === 'bn' ? 'প্রতিষ্ঠানের বিভিন্ন শাখা সক্রিয় করুন এবং শিক্ষার্থীদের বিলিং পোর্টালে প্রদর্শিত নাম পরিবর্তন করুন।' : 'Activate branches and customize display names shown across student rosters & billing portals.'}
                      </p>
                    </div>
                  </div>

                  <div className="adm-branch-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 14 }}>
                    {/* Primary Branch */}
                    {(() => {
                      const isPrimaryActive = profileForm.activeBranches?.primary !== false;
                      return (
                        <div style={{ background: isPrimaryActive ? '#f0fdf4' : '#f8fafc', padding: 14, borderRadius: 12, border: `1.5px solid ${isPrimaryActive ? '#bbf7d0' : '#e2e8f0'}`, transition: 'all 0.2s' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <label style={{ color: isPrimaryActive ? '#166534' : '#64748b', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 13, margin: 0 }}>
                              🏫 {lang === 'bn' ? 'প্রাথমিক শাখা' : 'Primary Branch'}
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: isPrimaryActive ? '#166534' : '#64748b' }}>
                              <input
                                type="checkbox"
                                checked={isPrimaryActive}
                                onChange={(e) => handleToggleBranchActive('primary', e.target.checked)}
                                style={{ accentColor: '#16a34a', width: 17, height: 17, cursor: 'pointer' }}
                              />
                              {isPrimaryActive ? (lang === 'bn' ? 'সক্রিয়' : 'Active') : (lang === 'bn' ? 'নিষ্ক্রিয়' : 'Disabled')}
                            </label>
                          </div>
                          <input
                            className="tp-form-input"
                            type="text"
                            disabled={!isPrimaryActive}
                            value={profileForm.branchNames?.primary ?? (lang === 'bn' ? 'প্রাথমিক বিদ্যালয়' : 'Primary School')}
                            onChange={e => setProfileForm({
                              ...profileForm,
                              branchNames: { ...(profileForm.branchNames || {}), primary: e.target.value }
                            })}
                            placeholder="e.g. Primary School"
                            style={{ background: isPrimaryActive ? '#ffffff' : '#f1f5f9', borderRadius: 8, fontSize: 13 }}
                          />
                          <span style={{ fontSize: 11, color: '#64748b', marginTop: 6, display: 'block', fontWeight: 500 }}>
                            {lang === 'bn' ? 'প্লে/নার্সারী – ৫ম শ্রেণী' : 'Classes Nursery – Class 5'}
                          </span>
                        </div>
                      );
                    })()}

                    {/* High School Branch */}
                    {(() => {
                      const isSecondaryActive = profileForm.activeBranches?.secondary !== false;
                      return (
                        <div style={{ background: isSecondaryActive ? '#eff6ff' : '#f8fafc', padding: 14, borderRadius: 12, border: `1.5px solid ${isSecondaryActive ? '#bfdbfe' : '#e2e8f0'}`, transition: 'all 0.2s' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <label style={{ color: isSecondaryActive ? '#1e40af' : '#64748b', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 13, margin: 0 }}>
                              🎓 {lang === 'bn' ? 'উচ্চ বিদ্যালয় শাখা' : 'High School Branch'}
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: isSecondaryActive ? '#1e40af' : '#64748b' }}>
                              <input
                                type="checkbox"
                                checked={isSecondaryActive}
                                onChange={(e) => handleToggleBranchActive('secondary', e.target.checked)}
                                style={{ accentColor: '#2563eb', width: 17, height: 17, cursor: 'pointer' }}
                              />
                              {isSecondaryActive ? (lang === 'bn' ? 'সক্রিয়' : 'Active') : (lang === 'bn' ? 'নিষ্ক্রিয়' : 'Disabled')}
                            </label>
                          </div>
                          <input
                            className="tp-form-input"
                            type="text"
                            disabled={!isSecondaryActive}
                            value={profileForm.branchNames?.secondary ?? (lang === 'bn' ? 'উচ্চ বিদ্যালয়' : 'High School')}
                            onChange={e => setProfileForm({
                              ...profileForm,
                              branchNames: { ...(profileForm.branchNames || {}), secondary: e.target.value }
                            })}
                            placeholder="e.g. High School"
                            style={{ background: isSecondaryActive ? '#ffffff' : '#f1f5f9', borderRadius: 8, fontSize: 13 }}
                          />
                          <span style={{ fontSize: 11, color: '#64748b', marginTop: 6, display: 'block', fontWeight: 500 }}>
                            {lang === 'bn' ? '৬ষ্ঠ – ১০ম শ্রেণী' : 'Classes Class 6 – Class 10'}
                          </span>
                        </div>
                      );
                    })()}

                    {/* College Branch */}
                    {(() => {
                      const isCollegeActive = profileForm.activeBranches?.college !== false;
                      return (
                        <div style={{ background: isCollegeActive ? '#f3e8ff' : '#f8fafc', padding: 14, borderRadius: 12, border: `1.5px solid ${isCollegeActive ? '#ddd6fe' : '#e2e8f0'}`, transition: 'all 0.2s' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <label style={{ color: isCollegeActive ? '#6b21a8' : '#64748b', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 13, margin: 0 }}>
                              🏛️ {lang === 'bn' ? 'কলেজ শাখা' : 'College Branch'}
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: isCollegeActive ? '#6b21a8' : '#64748b' }}>
                              <input
                                type="checkbox"
                                checked={isCollegeActive}
                                onChange={(e) => handleToggleBranchActive('college', e.target.checked)}
                                style={{ accentColor: '#7c3aed', width: 17, height: 17, cursor: 'pointer' }}
                              />
                              {isCollegeActive ? (lang === 'bn' ? 'সক্রিয়' : 'Active') : (lang === 'bn' ? 'নিষ্ক্রিয়' : 'Disabled')}
                            </label>
                          </div>
                          <input
                            className="tp-form-input"
                            type="text"
                            disabled={!isCollegeActive}
                            value={profileForm.branchNames?.college ?? (lang === 'bn' ? 'মহাবিদ্যালয়' : 'College')}
                            onChange={e => setProfileForm({
                              ...profileForm,
                              branchNames: { ...(profileForm.branchNames || {}), college: e.target.value }
                            })}
                            placeholder="e.g. College"
                            style={{ background: isCollegeActive ? '#ffffff' : '#f1f5f9', borderRadius: 8, fontSize: 13 }}
                          />
                          <span style={{ fontSize: 11, color: '#64748b', marginTop: 6, display: 'block', fontWeight: 500 }}>
                            {lang === 'bn' ? 'একাদশ – দ্বাদশ শ্রেণী' : 'Classes Class 11 – Class 12'}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* ── ACTION BAR ── */}
                <div style={{ background: '#ffffff', borderRadius: 14, padding: '14px 20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      className="tp-add-student-btn"
                      type="submit"
                      style={{ background: '#16a34a', padding: '10px 24px', borderRadius: 8, fontSize: 13.5, fontWeight: 800, opacity: submittingProfile ? 0.7 : 1, boxShadow: '0 2px 8px rgba(22,163,74,0.25)' }}
                      disabled={submittingProfile}
                    >
                      {submittingProfile ? (lang === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving Changes...') : (lang === 'bn' ? '💾 তথ্য সংরক্ষণ করুন' : '💾 Save Profile & Branding')}
                    </button>

                    <button
                      className="tp-delete-toggle-btn"
                      type="button"
                      onClick={handleProfileReset}
                      style={{ marginTop: 0, padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}
                      disabled={submittingProfile}
                    >
                      {lang === 'bn' ? 'ডিফল্ট রিসেট করুন' : 'Reset Defaults'}
                    </button>
                  </div>

                  {profileStatus && (
                    <span style={{ color: '#0284c7', fontSize: 13, fontWeight: 800, background: '#f0f9ff', border: '1px solid #bae6fd', padding: '5px 12px', borderRadius: 20 }}>
                      ✓ {profileStatus}
                    </span>
                  )}
                </div>

              </div>
            </form>
          </div>
        )}
      </main>

    </div>
  );
}
