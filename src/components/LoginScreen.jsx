import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import useFormFields from '../hooks/useFormFields.js';
import schoolHallway from '../school_hallway.png';
import defaultLogo from '../greenfield_logo.png';
import { useSchoolProfile } from '../context/SchoolProfileContext.jsx';
import { MotivationalQuote } from './MotivationalQuote.jsx';
import SafeImage from './SafeImage.jsx';
import ScholasticBaseLogo from './ScholasticBaseLogo.jsx';
import StudentBagAnimation from './StudentBagAnimation.jsx';
import { getUserAccount, getUserAccountFresh } from '../firebase/firestoreSchema.js';
import { getAllStudents, getAllTeachers, readStorage, LOCAL_STORAGE_KEYS } from '../utils/schoolData.js';

// Helper to map account role info to login screen mode ('student' | 'teacher' | 'classTeacher' | 'admin' | 'principal')
export const detectRoleForAccount = (accountData) => {
  if (!accountData) return null;
  const role = String(accountData.role || '').toLowerCase().trim();
  const accessMode = String(accountData.accessMode || '').toLowerCase().trim();
  const hasClassTeacherKey = Boolean(accountData.classTeacherKey);
  const hasAssignedClassList = Array.isArray(accountData.classTeacherClassIdxList) && accountData.classTeacherClassIdxList.length > 0;
  const hasSingleClassIdx = accountData.classTeacherClassIdx !== undefined && accountData.classTeacherClassIdx !== null && String(accountData.classTeacherClassIdx).trim() !== '';
  const hasClassNames = Boolean(accountData.classTeacherClassName || (Array.isArray(accountData.classTeacherClassNames) && accountData.classTeacherClassNames.length > 0));

  // 1. Super Admin & Admin
  if (
    accountData.isSuperAdmin ||
    role === 'admin' ||
    role === 'superadmin' ||
    role === 'super_admin' ||
    role === 'super-admin'
  ) {
    return 'admin';
  }

  // 2. Principal / Headmaster
  if (
    role === 'principal' ||
    role === 'headmaster' ||
    role === 'head_teacher' ||
    role === 'head teacher'
  ) {
    return 'principal';
  }

  // 3. Class Teacher
  if (
    role === 'class_teacher' ||
    role === 'class-teacher' ||
    role === 'classteacher' ||
    role === 'class teacher' ||
    (
      (role === 'teacher' || role === 'faculty' || role === 'instructor' || !role) &&
      (hasClassTeacherKey || accessMode === 'classteacher' || accessMode === 'classTeacher' || hasAssignedClassList || hasSingleClassIdx || hasClassNames)
    )
  ) {
    return 'classTeacher';
  }

  // 4. Teacher (Read Only)
  if (role === 'teacher' || role === 'faculty' || role === 'instructor') {
    return 'teacher';
  }

  // 5. Student
  if (
    role === 'student' ||
    role === 'learner' ||
    role === 'pupil' ||
    accountData.classNum !== undefined ||
    accountData.roll !== undefined
  ) {
    return 'student';
  }

  return null;
};

// Comprehensive local account finder searching all local storage sources, teachers, and students
export const findAccountInLocalSources = (userId) => {
  const cleanId = String(userId || '').trim();
  if (!cleanId) return null;
  const lowerId = cleanId.toLowerCase();

  // 1. Built-in system usernames
  if (lowerId === '@@siam##') {
    return { userId: '@@Siam##', name: 'Super Admin', role: 'admin', isSuperAdmin: true };
  }
  if (lowerId === 'admin') {
    return { userId: 'admin', name: 'System Admin', role: 'admin' };
  }
  if (lowerId === 'principal' || lowerId.startsWith('prn-')) {
    return { userId: cleanId, name: 'Principal / Headmaster', role: 'principal' };
  }

  // 2. Search schoolAppLocalUsers in localStorage (both raw and school-scoped)
  try {
    const rawUsers = readStorage(LOCAL_STORAGE_KEYS.USERS, {}) || {};
    const rawLocal = window.localStorage.getItem(LOCAL_STORAGE_KEYS.USERS);
    const parsedLocal = rawLocal ? JSON.parse(rawLocal) : {};
    const combinedUsers = { ...parsedLocal, ...rawUsers };

    const matchedKey = Object.keys(combinedUsers).find((k) => k.toLowerCase() === lowerId);
    if (matchedKey && combinedUsers[matchedKey]) return combinedUsers[matchedKey];

    const userList = Array.isArray(combinedUsers) ? combinedUsers : Object.values(combinedUsers);
    const matched = userList.find((u) => {
      if (!u || typeof u !== 'object') return false;
      return (
        String(u.userId || '').trim().toLowerCase() === lowerId ||
        String(u.id || '').trim().toLowerCase() === lowerId ||
        String(u.name || '').trim().toLowerCase() === lowerId ||
        String(u.email || '').trim().toLowerCase() === lowerId ||
        String(u.roll || '').trim().toLowerCase() === lowerId ||
        String(u.phone || '').trim().toLowerCase() === lowerId
      );
    });
    if (matched) return matched;
  } catch { }

  // 3. Search getAllTeachers() / teacherPanelTeachers / schoolAppTeachers
  try {
    const teachers = getAllTeachers() || [];
    const matchedTeacher = teachers.find((t) => {
      if (!t || typeof t !== 'object') return false;
      return (
        String(t.userId || '').trim().toLowerCase() === lowerId ||
        String(t.id || '').trim().toLowerCase() === lowerId ||
        String(t.email || '').trim().toLowerCase() === lowerId ||
        String(t.name || '').trim().toLowerCase() === lowerId ||
        String(t.phone || '').trim().toLowerCase() === lowerId
      );
    });
    if (matchedTeacher) return { ...matchedTeacher, role: matchedTeacher.role || 'teacher' };
  } catch { }

  // 4. Search getAllStudents() / schoolAppStudentProfiles / teacherPanelClasses
  try {
    const students = getAllStudents() || [];
    const matchedStudent = students.find((s) => {
      if (!s || typeof s !== 'object') return false;
      return (
        String(s.userId || '').trim().toLowerCase() === lowerId ||
        String(s.id || '').trim().toLowerCase() === lowerId ||
        String(s.roll || '').trim().toLowerCase() === lowerId ||
        String(s.name || '').trim().toLowerCase() === lowerId ||
        String(s.email || '').trim().toLowerCase() === lowerId ||
        String(s.phone || '').trim().toLowerCase() === lowerId
      );
    });
    if (matchedStudent) return { ...matchedStudent, role: 'student' };
  } catch { }

  return null;
};

export default function LoginScreen() {
  const navigate = useNavigate();
  const { role: routeRole } = useParams();
  const { user, signIn } = useAuth();
  const { schoolProfile } = useSchoolProfile();

  useEffect(() => {
    if (user) {
      const validRoles = ['admin', 'teacher', 'student', 'principal'];
      const userRole = String(user?.role || '').toLowerCase();
      if (user.isSuperAdmin || validRoles.includes(userRole)) {
        navigate(user.isSuperAdmin ? '/admin' : `/${userRole}`, { replace: true });
      }
    }
  }, [user, navigate]);

  const { fields, handleChange } = useFormFields({
    userId: '',
    password: '',
    eiinNumber: schoolProfile?.eiinNumber || '',
    loginKey: ''
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const normalizeLoginMode = (role) => (role === 'class-teacher' ? 'classTeacher' : role || 'student');
  const [mode, setMode] = useState(normalizeLoginMode(routeRole));
  const [detectedAccount, setDetectedAccount] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (routeRole) setMode(normalizeLoginMode(routeRole));
  }, [routeRole]);

  // Auto-detect and select role option instantly based on typed username/ID
  useEffect(() => {
    const sanitizedUserId = (fields.userId || '').trim();
    if (!sanitizedUserId) {
      if (routeRole) {
        setMode(normalizeLoginMode(routeRole));
      } else {
        setMode('student');
      }
      setDetectedAccount(null);
      return;
    }

    let isMounted = true;

    // 1. Instant Synchronous Search across all local databases (LocalUsers, Teachers, Students)
    const localAccount = findAccountInLocalSources(sanitizedUserId);
    if (localAccount) {
      const detectedMode = detectRoleForAccount(localAccount);
      if (detectedMode && isMounted) {
        setMode(detectedMode);
        setDetectedAccount(localAccount);
        return;
      }
    }

    // 2. Debounced async lookup in Firestore (for accounts created on other devices/cloud)
    const timer = setTimeout(async () => {
      try {
        const remoteUser = (await getUserAccountFresh(sanitizedUserId)) || (await getUserAccount(sanitizedUserId));
        if (remoteUser && isMounted) {
          const detectedMode = detectRoleForAccount(remoteUser);
          if (detectedMode) {
            setMode(detectedMode);
            setDetectedAccount(remoteUser);
          }
        }
      } catch {
        // Ignore remote lookup error
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [fields.userId, routeRole]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      let signInRole, accessMode;
      const sanitizedUserId = (fields.userId || '').trim();

      // Role-detection pre-read: check all local sources first for instant lookup,
      // and if missing (e.g. on a new device), check Firestore to determine correct role.
      let matchedUser = findAccountInLocalSources(sanitizedUserId);
      if (!matchedUser && sanitizedUserId) {
        try {
          matchedUser = (await getUserAccountFresh(sanitizedUserId)) || (await getUserAccount(sanitizedUserId));
        } catch {
          // Gracefully ignore remote lookup error
        }
      }

      const extractedRole = matchedUser ? String(matchedUser.role || '').trim().toLowerCase() : '';
      const isSuperAdminAccount = !!(matchedUser && matchedUser.isSuperAdmin);

      // Intelligent Routing & Radio Override
      // Super Admin accounts always get admin role + full access, regardless of radio button
      if (isSuperAdminAccount || extractedRole === 'admin' || sanitizedUserId === 'admin' || sanitizedUserId.toLowerCase() === '@@siam##') {
        signInRole = 'admin';
        accessMode = 'full';
      } else if (extractedRole === 'principal' || extractedRole === 'headmaster' || sanitizedUserId === 'principal' || sanitizedUserId.startsWith('prn-')) {
        signInRole = 'principal';
        accessMode = 'full';
      } else {
        if (mode === 'classTeacher') {
          signInRole = 'teacher';
          accessMode = 'classTeacher';
        } else if (mode === 'teacher') {
          signInRole = 'teacher';
          accessMode = 'readOnly';
        } else if (mode === 'principal') {
          signInRole = 'principal';
          accessMode = 'full';
        } else if (mode === 'admin') {
          signInRole = 'admin';
          accessMode = 'full';
        } else {
          signInRole = mode;
          accessMode = 'full';
        }
      }

      const user = await signIn({
        userId: fields.userId,
        password: fields.password,
        eiinNumber: fields.eiinNumber,
        role: signInRole,
        accessMode,
        loginKey: fields.loginKey
      });
      // Super admins always navigate to /admin as their home base
      navigate(user.isSuperAdmin ? '/admin' : `/${user.role}`, { replace: true });
    } catch (err) {
      setError(err.message || 'Incorrect username or password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page-container" style={{ backgroundImage: `url(${schoolHallway})` }}>
      {/* Interactive Student Bag Animation wrapping the Header and Login Card */}
      <StudentBagAnimation>
        {/* School Name & Logo Header positioned directly above Login Card */}
        <header className="login-header">
          <div className="login-brand-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%' }}>
            {schoolProfile?.logo ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <SafeImage
                  src={schoolProfile.logo}
                  alt={`${schoolProfile.schoolName || 'School'} logo`}
                  className="login-logo"
                  style={{ width: 38, height: 38, borderRadius: 8, flexShrink: 0 }}
                  fallbackVariant="school"
                  fallbackText={schoolProfile.schoolName || 'ScholasticBase'}
                />
                <span className="login-school-name" style={{ overflowWrap: 'break-word', wordBreak: 'normal', textAlign: 'center', fontWeight: 700, fontSize: 17, color: '#123e72' }}>
                  {schoolProfile.schoolName || 'ScholasticBase'}
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                <ScholasticBaseLogo variant="horizontal" size={36} showTagline={true} />
              </div>
            )}
          </div>
        </header>

        {/* Main Login Card */}
        <div className="login-card">
        <MotivationalQuote />
        <h1 className="login-card-title">LOGIN TO YOUR PORTAL</h1>

        <form onSubmit={handleSubmit}>

          {/* Username / ID */}
          <div className="login-field-group">
            <label className="login-label" htmlFor="userId">USERNAME / ID</label>
            <div className="login-input-wrapper">
              <svg className="login-input-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <input
                id="userId"
                name="userId"
                value={fields.userId}
                onChange={handleChange}
                placeholder="Enter your assigned ID..."
                required
                className="login-input"
              />
            </div>
          </div>

          {/* Password */}
          <div className="login-field-group">
            <label className="login-label" htmlFor="password">PASSWORD</label>
            <div className="login-input-wrapper">
              <svg className="login-input-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={fields.password}
                onChange={handleChange}
                placeholder="Enter your password..."
                required
                className="login-input"
              />
              <button
                type="button"
                className="login-input-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {mode === 'classTeacher' && (
            <div className="login-field-group">
              <label className="login-label" htmlFor="loginKey">CLASS TEACHER LOGIN KEY</label>
              <div className="login-input-wrapper">
                <svg className="login-input-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                </svg>
                <input
                  id="loginKey"
                  name="loginKey"
                  value={fields.loginKey}
                  onChange={handleChange}
                  placeholder="Enter class teacher key..."
                  required
                  className="login-input"
                />
              </div>
            </div>
          )}

          {/* Options: Remember Me & Forgot Password */}
          <div className="login-options-row">
            <label className="login-remember-me">
              <input type="checkbox" className="login-checkbox" />
              REMEMBER ME
            </label>
            <a href="#forgot" className="login-forgot-link">Forgot Password?</a>
          </div>

          {/* Role selector (Radio Buttons) */}
          <div className="login-role-row">
            <label className={`login-role-option ${mode === 'student' ? 'is-active' : ''}`}>
              <input
                type="radio"
                name="role"
                value="student"
                checked={mode === 'student'}
                onChange={() => setMode('student')}
                className="login-hidden-radio"
              />
              <span className="login-radio-circle">
                <span className="login-radio-inner"></span>
              </span>
              <span className="login-role-text">Login as Student</span>
            </label>

            <label className={`login-role-option ${mode === 'teacher' ? 'is-active' : ''}`}>
              <input
                type="radio"
                name="role"
                value="teacher"
                checked={mode === 'teacher'}
                onChange={() => setMode('teacher')}
                className="login-hidden-radio"
              />
              <span className="login-radio-circle">
                <span className="login-radio-inner"></span>
              </span>
              <span className="login-role-text">Login as Teacher (Read Only)</span>
            </label>

            <label className={`login-role-option ${mode === 'classTeacher' ? 'is-active' : ''}`}>
              <input
                type="radio"
                name="role"
                value="classTeacher"
                checked={mode === 'classTeacher'}
                onChange={() => setMode('classTeacher')}
                className="login-hidden-radio"
              />
              <span className="login-radio-circle">
                <span className="login-radio-inner"></span>
              </span>
              <span className="login-role-text">Login as Class Teacher</span>
            </label>
          </div>

          {mode === 'admin' && (
            <div className="login-class-teacher-section" style={{ background: '#f0fdf4', borderColor: '#86efac' }}>
              <div className="login-class-teacher-icon" style={{ background: '#16a34a', color: '#fff' }}>ADM</div>
              <div>
                <h3 style={{ color: '#166534' }}>System Admin Account Detected</h3>
                <p style={{ color: '#15803d' }}>Full system administration, account management, and institutional controls enabled.</p>
              </div>
            </div>
          )}

          {mode === 'principal' && (
            <div className="login-class-teacher-section" style={{ background: '#f0fdfa', borderColor: '#99f6e4' }}>
              <div className="login-class-teacher-icon" style={{ background: '#0d9488', color: '#fff' }}>PRN</div>
              <div>
                <h3 style={{ color: '#115e59' }}>Principal / Headmaster Portal</h3>
                <p style={{ color: '#0f766e' }}>Institutional oversight, teacher evaluations, and academic records access enabled.</p>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button className="login-submit-btn" type="submit" disabled={submitting}>
            {submitting ? 'SIGNING IN...' : 'SIGN IN'}
            <span className="login-submit-arrow">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </span>
          </button>

          {error && (
            <div style={{ marginTop: 14 }}>
              <div style={{ color: '#ef4444', textAlign: 'center', fontWeight: 600, fontSize: 13, lineHeight: 1.4 }}>
                {error}
              </div>
            </div>
          )}
        </form>

        {/* Footer info */}
        <div className="login-card-footer">
          <div className="login-footer-help" style={{ color: '#64748b', marginBottom: 8, fontSize: 13 }}>
            Need help? <a href={`mailto:${schoolProfile?.adminEmail || 'sceamhasan8@gmail.com'}`} className="login-footer-link">{schoolProfile?.adminName || 'Contact Admin'}</a>
          </div>
          <div style={{ fontSize: 11.5, color: '#94a3b8', margin: '6px 0 2px', fontWeight: 500 }}>
            © 2026 {schoolProfile?.schoolName || 'Progga School'}. All rights reserved.
          </div>
          <div className="login-version" style={{ fontSize: 10.5, color: '#cbd5e1', opacity: 0.8 }}>Version 1.2</div>
        </div>
      </div>
      </StudentBagAnimation>
    </div>
  );
}
