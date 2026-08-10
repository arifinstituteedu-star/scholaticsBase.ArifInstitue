import React, { useState } from 'react';

export default function AddNoticeModal({
  onClose,
  onAdd,
  defaultRoles = ['student', 'teacher', 'principal'],
  currentUser = null,
}) {
  const resolvedRole = currentUser?.role === 'principal'
    ? 'Principal'
    : (currentUser?.accessMode === 'classTeacher' || currentUser?.role === 'classTeacher')
      ? (currentUser?.classTeacherClassName ? `Class Teacher (${currentUser.classTeacherClassName})` : 'Class Teacher')
      : (currentUser?.role === 'admin' ? 'Admin' : 'Faculty');

  const resolvedName = currentUser?.name
    || (currentUser?.role === 'principal' ? 'Principal Office' : currentUser?.role === 'admin' ? 'School Administration' : 'Class Teacher');

  const resolvedUserId = currentUser?.userId || currentUser?.email || '';
  const resolvedAvatar = currentUser?.profilePic || currentUser?.photo || currentUser?.photoURL || '';

  const defaultInitialName = currentUser?.name
    || (currentUser?.role === 'principal' ? 'Principal Dr. Rahman' : currentUser?.role === 'admin' ? 'Engr. Mohammad Siam (Admin)' : 'Class Teacher');

  const [authorName, setAuthorName] = useState(defaultInitialName);

  const [form, setForm] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    desc: '',
  });

  const [targets, setTargets] = useState({
    student: defaultRoles.includes('student'),
    teacher: defaultRoles.includes('teacher'),
    principal: defaultRoles.includes('principal'),
  });

  const [fileName, setFileName] = useState('');
  const [fileData, setFileData] = useState(null);
  const [error, setError] = useState('');

  const toggleTarget = (roleKey) => {
    setTargets(prev => ({ ...prev, [roleKey]: !prev[roleKey] }));
    if (error) setError('');
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.type !== 'application/pdf') {
      setError('Only PDF document files are allowed as attachments.');
      setFileName('');
      setFileData(null);
      return;
    }
    setFileName(f.name);
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => setFileData(ev.target.result);
    reader.readAsDataURL(f);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Notice title is required.');
      return;
    }
    if (!form.desc.trim()) {
      setError('Notice description content is required.');
      return;
    }

    const selectedRoles = Object.keys(targets).filter(k => targets[k]);
    if (selectedRoles.length === 0) {
      setError('Please select at least one target audience role.');
      return;
    }

    const formattedDate = form.date
      ? new Date(form.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
      : new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

    onAdd({
      title: form.title.trim(),
      desc: form.desc.trim(),
      date: formattedDate,
      targetRoles: selectedRoles,
      authorName: authorName.trim() || resolvedName,
      authorRole: resolvedRole,
      authorUserId: resolvedUserId,
      authorAvatar: resolvedAvatar,
      fileName,
      fileData,
    });
  };

  return (
    <div className="tp-modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="tp-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, width: '92%' }}>
        <div className="tp-modal-header" style={{ borderBottomColor: '#2563eb' }}>
          <h3 className="tp-modal-title">📢 Create & Publish Notice</h3>
          <button className="tp-modal-close" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        <form className="tp-modal-body" onSubmit={handleSubmit}>
          {/* Author Profile Banner Preview */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 14px',
            background: '#f8fafc',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            marginBottom: 14,
          }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: resolvedRole === 'Principal'
                ? 'linear-gradient(135deg, #7c3aed, #4c1d95)'
                : resolvedRole.includes('Class Teacher')
                  ? 'linear-gradient(135deg, #059669, #047857)'
                  : 'linear-gradient(135deg, #2563eb, #1e40af)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 14,
              boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
              flexShrink: 0,
            }}>
              {resolvedAvatar ? (
                <img src={resolvedAvatar} alt={authorName || resolvedName} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                (authorName || resolvedName).charAt(0).toUpperCase()
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Publishing Notice As
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{authorName || resolvedName}</span>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 12,
                  background: resolvedRole === 'Principal' ? '#f5f3ff' : resolvedRole.includes('Class Teacher') ? '#ecfdf5' : '#eff6ff',
                  color: resolvedRole === 'Principal' ? '#6d28d9' : resolvedRole.includes('Class Teacher') ? '#047857' : '#1d4ed8',
                  border: `1px solid ${resolvedRole === 'Principal' ? '#ddd6fe' : resolvedRole.includes('Class Teacher') ? '#a7f3d0' : '#bfdbfe'}`
                }}>
                  {resolvedRole === 'Principal' ? '🏛️ Principal' : resolvedRole.includes('Class Teacher') ? `👨‍🏫 ${resolvedRole}` : '🛡️ Administrator'}
                </span>
              </div>
            </div>
          </div>

          <div className="tp-form-grid">
            <div className="tp-form-group tp-form-full">
              <label className="tp-form-label">Published By / Author Name *</label>
              <input
                className="tp-form-input"
                type="text"
                placeholder="e.g. Engr. Mohammad Siam (Admin), Principal Dr. Rahman"
                value={authorName}
                onChange={e => setAuthorName(e.target.value)}
                required
              />
            </div>

            <div className="tp-form-group tp-form-full">
              <label className="tp-form-label">Notice Title *</label>
              <input
                className={`tp-form-input ${error && !form.title.trim() ? 'tp-input-error' : ''}`}
                type="text"
                placeholder="e.g. Mid-Term Examination Schedule"
                value={form.title}
                onChange={e => { setForm({ ...form, title: e.target.value }); if (error) setError(''); }}
                required
              />
            </div>

            <div className="tp-form-group">
              <label className="tp-form-label">Publication Date</label>
              <input
                className="tp-form-input"
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
              />
            </div>

            <div className="tp-form-group tp-form-full">
              <label className="tp-form-label" style={{ marginBottom: 6, fontWeight: 700, color: '#1a2e4a' }}>
                Target Audiences (Who can read this notice?) *
              </label>
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 12, padding: '12px 14px',
                background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0'
              }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: '#334155' }}>
                  <input
                    type="checkbox"
                    checked={targets.student}
                    onChange={() => toggleTarget('student')}
                    style={{ width: 16, height: 16, accentColor: '#2563eb', cursor: 'pointer' }}
                  />
                  <span>🎓 Students</span>
                </label>

                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: '#334155' }}>
                  <input
                    type="checkbox"
                    checked={targets.teacher}
                    onChange={() => toggleTarget('teacher')}
                    style={{ width: 16, height: 16, accentColor: '#2563eb', cursor: 'pointer' }}
                  />
                  <span>👨‍🏫 Teachers</span>
                </label>

                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: '#334155' }}>
                  <input
                    type="checkbox"
                    checked={targets.principal}
                    onChange={() => toggleTarget('principal')}
                    style={{ width: 16, height: 16, accentColor: '#2563eb', cursor: 'pointer' }}
                  />
                  <span>🏛️ Principal</span>
                </label>
              </div>
            </div>

            <div className="tp-form-group tp-form-full">
              <label className="tp-form-label">Detailed Content *</label>
              <textarea
                className="tp-form-input"
                rows="4"
                placeholder="Enter detailed notice content..."
                value={form.desc}
                onChange={e => { setForm({ ...form, desc: e.target.value }); if (error) setError(''); }}
                required
                style={{ fontFamily: 'inherit', resize: 'vertical' }}
              ></textarea>
            </div>

            <div className="tp-form-group tp-form-full">
              <label className="tp-form-label">Attach PDF Document (Optional)</label>
              <input type="file" accept="application/pdf" onChange={handleFileChange} style={{ fontSize: 13 }} />
              {fileName && (
                <div style={{ marginTop: 6, fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
                  📎 Attached: {fileName}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13, fontWeight: 600 }}>
              ⚠️ {error}
            </div>
          )}

          <div className="tp-modal-footer" style={{ marginTop: 16 }}>
            <button type="button" className="tp-modal-cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="tp-modal-submit-btn" style={{ background: '#2563eb' }}>
              Publish Notice 📢
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
