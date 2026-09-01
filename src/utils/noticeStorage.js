// ─────────────────────────────────────────────────────────────
// noticeStorage.js — Centralized Notice Board Persistence & Live Sync Engine
// ─────────────────────────────────────────────────────────────

import { saveNoticesToFirestore, subscribeToNoticesFromFirestore } from '../firebase/firestoreSchema.js';

export const NOTICE_STORAGE_KEY = 'schoolAppNotices';
export const READ_NOTICES_KEY = 'schoolAppReadNotices';
export const NOTICE_EVENT_NAME = 'schoolNoticeUpdate';

const DEFAULT_NOTICES = [
  {
    id: 1,
    title: 'Summer Vacation Announcement',
    date: '10 Jun 2026',
    desc: 'Summer vacation starts from June 20th to July 5th. Classes resume on July 6th.',
    targetRoles: ['student', 'teacher', 'principal'],
    authorName: 'Principal Office',
    authorRole: 'Principal',
    authorUserId: 'principal@school.edu',
    authorAvatar: '',
    createdAt: Date.now() - 86400000 * 5,
  },
  {
    id: 2,
    title: 'Annual Sports Meet 2026',
    date: '15 Jun 2026',
    desc: 'Register by June 18th for various field and track events scheduled next week.',
    targetRoles: ['student', 'teacher'],
    authorName: 'School Administration',
    authorRole: 'Admin',
    authorUserId: 'admin@school.edu',
    authorAvatar: '',
    createdAt: Date.now() - 86400000 * 3,
  },
  {
    id: 3,
    title: 'Faculty & Administrative Briefing',
    date: '18 Jun 2026',
    desc: 'All teachers and administration staff must attend the quarterly strategy meeting in the main hall.',
    targetRoles: ['teacher', 'principal'],
    authorName: 'Class Teacher Lead',
    authorRole: 'Class Teacher',
    authorUserId: 'teacher@school.edu',
    authorAvatar: '',
    createdAt: Date.now() - 86400000,
  },
];

/**
 * Standardize target role normalization
 * Converts e.g. ['Students', 'Teacher'] -> ['student', 'teacher']
 */
export function normalizeRoles(roles) {
  if (!Array.isArray(roles) || roles.length === 0) {
    return ['student', 'teacher', 'principal'];
  }
  return roles.map(r => String(r).toLowerCase().replace(/s$/, ''));
}

/**
 * Filter notices accessible by a user role.
 * Admins can access all notices.
 */
export function canUserAccessNotice(notice, userRole) {
  if (!userRole || userRole === 'admin' || userRole === 'superAdmin') return true;
  const roleNorm = String(userRole).toLowerCase().replace(/s$/, '');
  const targets = normalizeRoles(notice?.targetRoles);
  if (roleNorm === 'classteacher' || roleNorm === 'teacher') {
    return targets.includes('teacher') || targets.includes('classteacher');
  }
  return targets.includes(roleNorm);
}

/**
 * Check whether a user or role has permission to create/publish notices.
 * Authorized roles: Admin, Principal, Class Teacher (teacher with accessMode === 'classTeacher').
 * Forbidden roles: Regular Teacher (readOnly), Students.
 */
export function canUserPostNotice(userOrRole, accessMode = '') {
  if (!userOrRole) return false;
  if (typeof userOrRole === 'string') {
    const r = userOrRole.toLowerCase().trim();
    if (r === 'admin' || r === 'principal' || r === 'classteacher') return true;
    if (r === 'teacher' && String(accessMode).toLowerCase() === 'classteacher') return true;
    return false;
  }
  if (userOrRole.isSuperAdmin || userOrRole.role === 'admin' || userOrRole.role === 'principal') return true;
  if (userOrRole.role === 'teacher' && userOrRole.accessMode === 'classTeacher') return true;
  if (userOrRole.accessMode === 'classTeacher') return true;
  return false;
}

/**
 * Load notices for a specific school
 */
export function getNotices(schoolId = 'SCHOLASTICBASE_DEFAULT') {
  if (typeof window === 'undefined') return DEFAULT_NOTICES;
  try {
    const globalRaw = window.localStorage.getItem(NOTICE_STORAGE_KEY);
    if (globalRaw !== null) {
      const parsedGlobal = JSON.parse(globalRaw);
      if (Array.isArray(parsedGlobal)) return parsedGlobal;
    }
    return DEFAULT_NOTICES;
  } catch (e) {
    console.error('Error loading notices:', e);
    return DEFAULT_NOTICES;
  }
}

/**
 * Save notices array and dispatch sync event + sync to Firestore
 */
export function saveNotices(notices, schoolId = 'SCHOLASTICBASE_DEFAULT') {
  if (typeof window === 'undefined') return;
  try {
    const dataStr = JSON.stringify(notices);
    window.localStorage.setItem(NOTICE_STORAGE_KEY, dataStr);
    window.dispatchEvent(new CustomEvent(NOTICE_EVENT_NAME, { detail: { notices, schoolId } }));
    // Real-time Firestore document push
    saveNoticesToFirestore(notices, schoolId).catch((err) => {
      console.warn('[Notice Realtime Sync note]:', err?.message || err);
    });
  } catch (e) {
    console.error('Error saving notices:', e);
  }
}

/**
 * Add a new notice
 */
export function addNotice(newNoticeData, schoolId = 'SCHOLASTICBASE_DEFAULT') {
  const currentNotices = getNotices(schoolId);
  const noticeToAdd = {
    id: Date.now(),
    title: String(newNoticeData.title || '').trim(),
    desc: String(newNoticeData.desc || '').trim(),
    date: newNoticeData.date || new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
    targetRoles: normalizeRoles(newNoticeData.targetRoles),
    authorName: String(newNoticeData.authorName || newNoticeData.author || 'School Administration').trim(),
    authorRole: String(newNoticeData.authorRole || 'Admin').trim(),
    authorUserId: String(newNoticeData.authorUserId || newNoticeData.userId || '').trim(),
    authorAvatar: newNoticeData.authorAvatar || '',
    fileName: newNoticeData.fileName || '',
    fileData: newNoticeData.fileData || '',
    createdAt: Date.now(),
  };

  const updatedNotices = [noticeToAdd, ...currentNotices];
  saveNotices(updatedNotices, schoolId);
  return noticeToAdd;
}

/**
 * Delete notice by ID(s)
 */
export function deleteNotices(idsToDelete, schoolId = 'SCHOLASTICBASE_DEFAULT') {
  const idSet = new Set(Array.isArray(idsToDelete) ? idsToDelete : [idsToDelete]);
  const currentNotices = getNotices(schoolId);
  const updatedNotices = currentNotices.filter(n => !idSet.has(n.id));
  saveNotices(updatedNotices, schoolId);
  return updatedNotices;
}

/**
 * Subscribe to notice updates across components, tabs, and Firestore live snapshots
 */
export function subscribeToNoticeUpdates(callback, schoolId = 'SCHOLASTICBASE_DEFAULT') {
  if (typeof window === 'undefined') return () => {};

  // 1. Same-tab and cross-tab local updates
  const handleCustomEvent = (event) => {
    if (!event.detail || !event.detail.schoolId || event.detail.schoolId === schoolId || schoolId === 'SCHOLASTICBASE_DEFAULT' || schoolId === 'PROGGA_DEFAULT') {
      callback(getNotices(schoolId));
    }
  };

  const handleStorageEvent = (event) => {
    if (event.key === NOTICE_STORAGE_KEY || (event.key && event.key.startsWith(NOTICE_STORAGE_KEY))) {
      callback(getNotices(schoolId));
    }
  };

  window.addEventListener(NOTICE_EVENT_NAME, handleCustomEvent);
  window.addEventListener('storage', handleStorageEvent);

  // 2. Real-time Firestore onSnapshot listener for live multi-device sync & data validation
  let unsubFirestore = () => {};
  try {
    unsubFirestore = subscribeToNoticesFromFirestore((remoteNotices) => {
      if (Array.isArray(remoteNotices)) {
        const dataStr = JSON.stringify(remoteNotices);
        window.localStorage.setItem(NOTICE_STORAGE_KEY, dataStr);
        callback(remoteNotices);
      }
    }, schoolId);
  } catch (e) {
    console.warn('[Notice onSnapshot init warning]:', e);
  }

  return () => {
    window.removeEventListener(NOTICE_EVENT_NAME, handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
    if (typeof unsubFirestore === 'function') {
      unsubFirestore();
    }
  };
}

/**
 * Read Notices tracking for Notification Bell badge
 */
export function getReadNoticeIds(userId = 'guest') {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(`${READ_NOTICES_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function markNoticeAsRead(noticeId, userId = 'guest') {
  if (typeof window === 'undefined') return;
  try {
    const currentRead = getReadNoticeIds(userId);
    if (!currentRead.includes(noticeId)) {
      const updated = [...currentRead, noticeId];
      window.localStorage.setItem(`${READ_NOTICES_KEY}_${userId}`, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent(NOTICE_EVENT_NAME, { detail: { type: 'readUpdate' } }));
    }
  } catch (e) {
    console.error('Error marking notice as read:', e);
  }
}

export function markAllNoticesAsRead(noticeIds, userId = 'guest') {
  if (typeof window === 'undefined') return;
  try {
    const currentRead = new Set(getReadNoticeIds(userId));
    noticeIds.forEach(id => currentRead.add(id));
    window.localStorage.setItem(`${READ_NOTICES_KEY}_${userId}`, JSON.stringify(Array.from(currentRead)));
    window.dispatchEvent(new CustomEvent(NOTICE_EVENT_NAME, { detail: { type: 'readUpdate' } }));
  } catch (e) {
    console.error('Error marking all notices as read:', e);
  }
}
