import React, { useState, useEffect, useRef } from 'react';
import {
  getNotices,
  canUserAccessNotice,
  subscribeToNoticeUpdates,
  getReadNoticeIds,
  markNoticeAsRead,
  markAllNoticesAsRead,
  normalizeRoles,
} from '../utils/noticeStorage.js';

export default function NotificationBell({ userRole = 'student', userId = 'guest', activeSchoolId = 'PROGGA_DEFAULT', onSelectNotice }) {
  const [open, setOpen] = useState(false);
  const [notices, setNotices] = useState([]);
  const [readIds, setReadIds] = useState([]);
  const popoverRef = useRef(null);

  const loadData = () => {
    const all = getNotices(activeSchoolId);
    const safeAll = Array.isArray(all) ? all : [];
    const accessible = safeAll.filter(n => canUserAccessNotice(n, userRole));
    setNotices(accessible);
    const safeReadIds = getReadNoticeIds(userId);
    setReadIds(Array.isArray(safeReadIds) ? safeReadIds : []);
  };

  useEffect(() => {
    loadData();
    const unsub = subscribeToNoticeUpdates(loadData, activeSchoolId);
    return () => unsub();
  }, [userRole, userId, activeSchoolId]);

  // Handle outside click to close dropdown popover
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside, { passive: true });
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [open]);

  const safeNotices = Array.isArray(notices) ? notices : [];
  const safeReadIds = Array.isArray(readIds) ? readIds : [];
  const unreadNotices = safeNotices.filter(n => !safeReadIds.includes(n?.id));
  const unreadCount = unreadNotices.length;

  const handleMarkAllRead = () => {
    const ids = safeNotices.map(n => n.id);
    markAllNoticesAsRead(ids, userId);
    setReadIds(getReadNoticeIds(userId));
  };

  const handleNoticeClick = (noticeId) => {
    markNoticeAsRead(noticeId, userId);
    setReadIds(getReadNoticeIds(userId));
    setOpen(false);
    if (onSelectNotice) {
      onSelectNotice(noticeId);
    }
  };

  const formatTargetLabel = (roleStr) => {
    switch (roleStr) {
      case 'student': return 'Students';
      case 'teacher': return 'Teachers';
      case 'principal': return 'Principal';
      default: return roleStr;
    }
  };

  return (
    <div className="tp-bell-wrap" ref={popoverRef}>
      <button
        className="tp-icon-btn"
        aria-label="Notifications"
        title="View Notifications"
        onClick={() => setOpen(!open)}
        style={{ position: 'relative', cursor: 'pointer' }}
      >
        <svg width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="tp-bell-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Drawer Popover */}
      {open && (
        <>
          <div
            className="tp-notif-backdrop"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="tp-notif-popover">
            <div className="tp-notif-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 16 }}>🔔</span>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1a2e4a', whiteSpace: 'nowrap' }}>Notifications</h4>
                {unreadCount > 0 && (
                  <span className="tp-notif-count-pill">{unreadCount} new</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {unreadCount > 0 && (
                  <button className="tp-notif-mark-btn" onClick={handleMarkAllRead}>
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  className="tp-notif-close-btn"
                  onClick={() => setOpen(false)}
                  aria-label="Close notifications"
                  title="Close"
                >
                  ✕
                </button>
              </div>
            </div>

          <div className="tp-notif-list">
            {notices.length === 0 ? (
              <div className="tp-notif-empty">
                <div style={{ fontSize: 32, marginBottom: 6 }}>📭</div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: '#64748b' }}>No notifications found</p>
                <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#94a3b8' }}>Check back later for school updates.</p>
              </div>
            ) : (
              notices.map(n => {
                const isUnread = !readIds.includes(n.id);
                const targets = normalizeRoles(n.targetRoles);
                return (
                  <div
                    key={n.id}
                    className={`tp-notif-item ${isUnread ? 'unread' : ''}`}
                    onClick={() => handleNoticeClick(n.id)}
                  >
                    <div className="tp-notif-item-top">
                      <h5 className="tp-notif-item-title">{n.title}</h5>
                      <span className="tp-notif-item-date">{n.date}</span>
                    </div>

                    <p className="tp-notif-item-snippet">{n.desc}</p>

                    {/* Notification Author Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '4px 0 6px', fontSize: 11.5, color: '#64748b' }}>
                      <span style={{ fontWeight: 700, color: '#334155' }}>
                        👤 {n.authorName || (n.authorRole === 'Principal' ? 'Principal Office' : n.authorRole === 'Class Teacher' ? 'Class Teacher' : 'School Administration')}
                      </span>
                      <span style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 10,
                        background: n.authorRole === 'Principal' ? '#f5f3ff' : n.authorRole === 'Class Teacher' || n.authorRole?.toLowerCase().includes('class teacher') ? '#ecfdf5' : '#eff6ff',
                        color: n.authorRole === 'Principal' ? '#6d28d9' : n.authorRole === 'Class Teacher' || n.authorRole?.toLowerCase().includes('class teacher') ? '#047857' : '#1d4ed8',
                      }}>
                        {n.authorRole === 'Principal' ? '🏛️ Principal' : n.authorRole === 'Class Teacher' || n.authorRole?.toLowerCase().includes('class teacher') ? `👨‍🏫 ${n.authorRole || 'Class Teacher'}` : '🛡️ Admin'}
                      </span>
                    </div>

                    <div className="tp-notif-item-bottom">
                      <div className="tp-target-tag-list">
                        {targets.map(role => (
                          <span key={role} className={`tp-target-tag ${role}`}>
                            {formatTargetLabel(role)}
                          </span>
                        ))}
                      </div>
                      {isUnread && <span className="tp-unread-dot" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </>
    )}
  </div>
  );
}
