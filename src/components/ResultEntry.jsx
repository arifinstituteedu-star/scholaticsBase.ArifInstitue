import React, { useEffect, useMemo, useState, useRef } from 'react';
import { buildResultDocId, saveResultEntry, subscribeToExams } from '../firebase/firestoreSchema.js';
import { getDynamicGradeInfoWithComponents, resolveRuleTotals } from '../utils/bangladeshGrading.js';
import { getSchoolNameByClass, getBranchKeyByClass, SCHOOL_BRANCHES, filterClassesByBranch, sortClasses, getClassSortIndex, getActiveBranchKeys } from '../utils/schoolResolver.js';
import useTranslation from '../hooks/useTranslation.js';
import useConfirm from '../hooks/useConfirm.js';
import { useSchoolProfile } from '../context/SchoolProfileContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useViewMode } from '../context/ViewModeContext.jsx';
import { TableSkeleton } from './SkeletonLoader.jsx';

const BRANCH_ORDER = ['primary', 'secondary', 'college'];
const fallbackSubjects = ['Mathematics', 'Physics', 'English', 'Science', 'History', 'Geography', 'Computer Science'];

const getStoredExamSessions = (schoolId) => {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const key = schoolId ? `progga_exam_sessions_${schoolId}` : 'progga_exam_sessions';
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveStoredExamSessions = (sessions, schoolId) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const key = schoolId ? `progga_exam_sessions_${schoolId}` : 'progga_exam_sessions';
    const jsonStr = JSON.stringify(sessions);
    window.localStorage.setItem(key, jsonStr);
  } catch (err) {
    console.warn('Error writing exam sessions to localStorage:', err);
  }
};

const ResultEntry = ({ classes = [], currentTeacherProfile = null, currentTeacherAssignments = [], readOnly = false }) => {
  const safeClasses = Array.isArray(classes) ? classes : [];
  const classOptions = useMemo(() => sortClasses(safeClasses.filter((cls) => cls?.className)), [safeClasses]);
  const confirm = useConfirm();
  const { t } = useTranslation();

  const schoolProfileCtx = useSchoolProfile() || {};
  const schoolProfile = schoolProfileCtx.schoolProfile || schoolProfileCtx.defaultSchoolProfile || {};
  const authCtx = useAuth() || {};
  const user = authCtx.user || null;
  const viewModeCtx = useViewMode() || {};
  const effectiveUser = viewModeCtx.effectiveUser || user;

  const activeSchoolId = schoolProfile?.schoolId
    || schoolProfile?.schoolCode
    || schoolProfile?.eiinNumber
    || effectiveUser?.schoolId
    || effectiveUser?.schoolCode
    || effectiveUser?.eiinNumber
    || user?.schoolId
    || user?.schoolCode
    || user?.eiinNumber
    || (Array.isArray(classes) && classes.find((c) => c?.schoolId)?.schoolId)
    || (typeof window !== 'undefined' && window.localStorage
        ? (window.localStorage.getItem('schoolId') || window.localStorage.getItem('schoolCode') || window.localStorage.getItem('schoolEiinNumber'))
        : '')
    || '';

  // Determine initial branch
  const defaultBranch = useMemo(() => {
    for (const key of BRANCH_ORDER) {
      if (filterClassesByBranch(classOptions, key).length > 0) return key;
    }
    return BRANCH_ORDER[0];
  }, [classOptions]);

  const [selectedBranch, setSelectedBranch] = useState(defaultBranch);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedSubject, setSelectedSubject] = useState(fallbackSubjects[0]);
  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('info'); // 'info' | 'success' | 'error'
  const [isSaving, setIsSaving] = useState(false);
  const [examSessions, setExamSessions] = useState(() => getStoredExamSessions(activeSchoolId));
  const [selectedExamId, setSelectedExamId] = useState('');
  const [viewLayout, setViewLayout] = useState('auto'); // 'auto' | 'cards' | 'table'

  // Subscribe to Exam Sessions
  useEffect(() => {
    const unsubscribe = subscribeToExams(
      (snapshot) => {
        if (!snapshot || !snapshot.docs) return;
        const firestoreDocs = snapshot.docs.map((item) => ({ key: item.id, examId: item.data().examId || item.id, ...item.data() }));
        const localDocs = getStoredExamSessions(activeSchoolId);
        const map = new Map();
        [...localDocs, ...firestoreDocs].forEach((item) => {
          const id = item?.examId || item?.id || item?.key;
          if (id) map.set(id, { ...map.get(id), ...item });
        });
        const merged = Array.from(map.values());
        setExamSessions(merged);
        saveStoredExamSessions(merged, activeSchoolId);
      },
      (err) => {
        console.warn('Could not subscribe to exam sessions in ResultEntry:', err);
      },
      activeSchoolId
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [activeSchoolId]);

  const filteredExamSessions = useMemo(() => {
    if (!selectedClass) return examSessions;
    const targetNorm = String(selectedClass || '').trim().toLowerCase();
    const targetSortIdx = getClassSortIndex(selectedClass);
    return examSessions.filter((exam) => {
      if (!exam.targetClass) return true;
      const examNorm = String(exam.targetClass || '').trim().toLowerCase();
      if (examNorm === targetNorm) return true;
      const examSortIdx = getClassSortIndex(exam.targetClass);
      if (examSortIdx !== 99999 && targetSortIdx !== 99999 && examSortIdx === targetSortIdx) return true;
      return false;
    });
  }, [examSessions, selectedClass]);

  useEffect(() => {
    if (filteredExamSessions.length > 0) {
      if (!filteredExamSessions.some((exam) => (exam.examId || exam.key || exam.id) === selectedExamId)) {
        setSelectedExamId(filteredExamSessions[0].examId || filteredExamSessions[0].key || filteredExamSessions[0].id);
      }
    } else {
      setSelectedExamId('');
    }
  }, [filteredExamSessions, selectedExamId]);

  const selectedExam = useMemo(() => {
    return filteredExamSessions.find((exam) => (exam.examId || exam.key || exam.id) === selectedExamId) || null;
  }, [filteredExamSessions, selectedExamId]);

  const currentSubjectRule = useMemo(() => {
    if (!selectedExam || !selectedExam.subjectRules) return { totalMarks: 100, passMarks: 33 };
    return selectedExam.subjectRules[selectedSubject] || { totalMarks: 100, passMarks: 33 };
  }, [selectedExam, selectedSubject]);

  const resolvedRule = useMemo(() => resolveRuleTotals(currentSubjectRule), [currentSubjectRule]);
  const hasCqMcqRule = resolvedRule.hasCqMcq;
  const hasMcqComponent = resolvedRule.hasMcq;

  const normalizeValue = (value) => String(value || '').trim();
  const normalizeKey = (value) => normalizeValue(value).toLowerCase();

  const getGradeForTable = (cqMarks, mcqMarks) => {
    const cqVal = String(cqMarks ?? '');
    const mcqVal = String(mcqMarks ?? '');
    if (cqVal === '' && mcqVal === '') return '-';
    if (!hasCqMcqRule) {
      const total = (cqVal !== '' ? Number(cqVal) : 0) + (mcqVal !== '' ? Number(mcqVal) : 0);
      return getDynamicGradeInfoWithComponents(total, 0, { totalMarks: resolvedRule.totalMarks, passMarks: resolvedRule.passMarks }).grade;
    }
    if (cqVal === '') return '-';
    return getDynamicGradeInfoWithComponents(cqVal, mcqVal, currentSubjectRule).grade;
  };

  const teacherAccess = useMemo(() => {
    const normalized = Array.isArray(currentTeacherAssignments) ? currentTeacherAssignments : [];
    const classNames = new Set();
    const groupMap = {};
    const subjectMap = {};
    let hasClassTeacherScope = false;

    normalized.forEach((assignment) => {
      if (!assignment) return;
      const scope = normalizeValue(assignment.scope);
      let className = normalizeValue(assignment.className);
      const classIdx = Number.isFinite(Number(assignment.classIdx)) ? Number(assignment.classIdx) : null;
      const groupName = normalizeValue(assignment.groupName);
      const subject = normalizeValue(assignment.subject);

      if (!className && classIdx !== null && classes[classIdx]) {
        className = normalizeValue(classes[classIdx].className);
      }

      if (!className) return;
      const classKey = normalizeKey(className);
      const groupKey = normalizeKey(groupName);
      const subjectKey = normalizeKey(subject);

      if (scope === 'classTeacher') {
        hasClassTeacherScope = true;
        classNames.add(classKey);
        return;
      }

      classNames.add(classKey);

      if (groupKey) {
        groupMap[classKey] = groupMap[classKey] || new Set();
        groupMap[classKey].add(groupName);
      }
      if (subjectKey) {
        subjectMap[classKey] = subjectMap[classKey] || new Set();
        subjectMap[classKey].add(subject);
      }
      if (groupKey && subjectKey) {
        const groupSubjectKey = `${classKey}||${groupKey}`;
        subjectMap[groupSubjectKey] = subjectMap[groupSubjectKey] || new Set();
        subjectMap[groupSubjectKey].add(subject);
      }
    });

    return {
      classNames,
      groupMap,
      subjectMap,
      hasClassTeacherScope,
    };
  }, [classes, currentTeacherAssignments]);

  const hasTeacherRestrictions = useMemo(() => {
    return Array.isArray(currentTeacherAssignments) && currentTeacherAssignments.length > 0;
  }, [currentTeacherAssignments]);

  const allowedClassOptions = useMemo(() => {
    if (!hasTeacherRestrictions || teacherAccess.classNames.size === 0) {
      return classOptions;
    }
    const allowed = classOptions.filter((cls) => teacherAccess.classNames.has(normalizeKey(cls.className)));
    return allowed.length > 0 ? allowed : classOptions;
  }, [classOptions, hasTeacherRestrictions, teacherAccess.classNames]);

  const branchFilteredClassOptions = useMemo(() => {
    const branchClasses = filterClassesByBranch(allowedClassOptions, selectedBranch);
    return branchClasses.length > 0 ? branchClasses : allowedClassOptions;
  }, [allowedClassOptions, selectedBranch]);

  const selectedClassData = useMemo(
    () => branchFilteredClassOptions.find((cls) => cls.className === selectedClass) || branchFilteredClassOptions[0] || null,
    [branchFilteredClassOptions, selectedClass]
  );

  const isPrimaryBranch = selectedBranch === 'primary' || getBranchKeyByClass(selectedClass) === 'primary';

  const effectiveReadOnly = useMemo(() => {
    if (!readOnly) return false;
    const assignments = Array.isArray(currentTeacherAssignments) ? currentTeacherAssignments : [];
    if (assignments.length === 0) return true;

    const hasMatchingAssignment = assignments.some((assignment) => {
      if (!assignment) return false;
      if (normalizeValue(assignment.scope) === 'classTeacher') {
        let assignedClassName = normalizeValue(assignment.className);
        const classIdx = Number.isFinite(Number(assignment.classIdx)) ? Number(assignment.classIdx) : null;
        if (!assignedClassName && classIdx !== null && classes[classIdx]) {
          assignedClassName = normalizeValue(classes[classIdx].className);
        }
        return normalizeKey(assignedClassName) === normalizeKey(selectedClassData?.className);
      }

      const assignedGroupName = normalizeValue(assignment.groupName);
      const assignedSubject = normalizeValue(assignment.subject);
      if (!assignedGroupName || !assignedSubject) return false;

      let assignedClassName = normalizeValue(assignment.className);
      const classIdx = Number.isFinite(Number(assignment.classIdx)) ? Number(assignment.classIdx) : null;
      if (!assignedClassName && classIdx !== null && classes[classIdx]) {
        assignedClassName = normalizeValue(classes[classIdx].className);
      }
      if (!assignedClassName) return false;

      const classMatch = normalizeKey(assignedClassName) === normalizeKey(selectedClassData?.className);
      const groupMatch = normalizeKey(assignedGroupName) === normalizeKey(selectedSection);
      const subjectMatch = normalizeKey(assignedSubject) === normalizeKey(selectedSubject);

      return classMatch && groupMatch && subjectMatch;
    });

    return !hasMatchingAssignment;
  }, [readOnly, currentTeacherAssignments, classes, selectedClassData, selectedSection, selectedSubject]);

  const rawGroupOptions = selectedClassData?.groups || [];
  const groupOptions = useMemo(() => {
    return (Array.isArray(rawGroupOptions) ? rawGroupOptions : [])
      .map((g) => (typeof g === 'object' && g !== null ? g.name || g.id || '' : String(g || '')))
      .filter(Boolean);
  }, [rawGroupOptions]);

  const configuredSubjects = selectedClassData?.groupSubjects?.[selectedSection] || [];
  const subjectOptions = configuredSubjects.length > 0 ? configuredSubjects : fallbackSubjects;

  const isClassAllowed = useMemo(() => {
    if (!hasTeacherRestrictions || teacherAccess.classNames.size === 0) return true;
    return teacherAccess.classNames.has(normalizeKey(selectedClassData?.className));
  }, [hasTeacherRestrictions, teacherAccess.classNames, selectedClassData]);

  const allowedGroupOptions = useMemo(() => {
    const selectedClassKey = normalizeKey(selectedClassData?.className);
    if (!hasTeacherRestrictions || teacherAccess.groupMap[selectedClassKey]?.size === 0) {
      return groupOptions;
    }
    const allowed = groupOptions.filter((groupName) => {
      const allowedGroups = Array.from(teacherAccess.groupMap[selectedClassKey] || new Set());
      return allowedGroups.some((assignedGroup) => normalizeKey(assignedGroup) === normalizeKey(groupName));
    });
    return allowed.length > 0 ? allowed : groupOptions;
  }, [hasTeacherRestrictions, groupOptions, selectedClassData, teacherAccess.groupMap]);

  const allowedSubjectOptions = useMemo(() => {
    const selectedClassKey = normalizeKey(selectedClassData?.className);
    if (!hasTeacherRestrictions || teacherAccess.subjectMap[selectedClassKey]?.size === 0) {
      return subjectOptions;
    }
    const values = Array.from(teacherAccess.subjectMap[selectedClassKey] || new Set());
    if (allowedGroupOptions.length > 0 && selectedSection) {
      const groupKey = `${selectedClassKey}||${normalizeKey(selectedSection)}`;
      const groupSubjects = Array.from(teacherAccess.subjectMap[groupKey] || new Set());
      if (groupSubjects.length > 0) return groupSubjects;
      if (values.length > 0) return values;
      return subjectOptions;
    }
    return values.length > 0 ? values : subjectOptions;
  }, [allowedGroupOptions, hasTeacherRestrictions, selectedClassData, selectedSection, subjectOptions, teacherAccess.subjectMap]);

  useEffect(() => {
    const firstInBranch = branchFilteredClassOptions[0];
    if (firstInBranch && selectedClass !== firstInBranch.className) {
      setSelectedClass(firstInBranch.className);
    }
  }, [selectedBranch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!branchFilteredClassOptions.length) {
      setSelectedClass('');
      return;
    }
    if (!selectedClass || !branchFilteredClassOptions.some((cls) => cls.className === selectedClass)) {
      setSelectedClass(branchFilteredClassOptions[0].className);
    }
  }, [branchFilteredClassOptions, selectedClass]);

  useEffect(() => {
    if (!allowedSubjectOptions.length) {
      setSelectedSubject(fallbackSubjects[0]);
      return;
    }
    if (!selectedSubject || !allowedSubjectOptions.includes(selectedSubject)) {
      setSelectedSubject(allowedSubjectOptions[0]);
    }
  }, [allowedSubjectOptions, selectedSubject]);

  useEffect(() => {
    if (selectedExam?.targetGroup && selectedExam.targetGroup !== 'All' && selectedExam.targetGroup !== 'General') {
      const match = allowedGroupOptions.find(g => normalizeKey(g) === normalizeKey(selectedExam.targetGroup));
      if (match) {
        setSelectedSection(match);
        return;
      }
    }
    const firstGroup = allowedGroupOptions[0] || '';
    if (!selectedSection || !allowedGroupOptions.includes(selectedSection)) {
      setSelectedSection(firstGroup);
    }
  }, [allowedGroupOptions, selectedSection, selectedExam]);

  useEffect(() => {
    const rosterForSelection = (selectedClassData?.students || [])
      .filter((student) => {
        if (!selectedSection) return true;
        const stGroup = typeof student?.group === 'object' && student.group !== null
          ? student.group.name || student.group.id || ''
          : String(student?.group || '');
        return normalizeKey(stGroup) === normalizeKey(selectedSection);
      })
      .map((student) => ({ ...student, marks: '', cqMarks: '', mcqMarks: '' }));
    setStudents(rosterForSelection);
    setFeedback('');
  }, [selectedClassData, selectedSection]);

  useEffect(() => {
    if (!allowedSubjectOptions.includes(selectedSubject)) {
      setSelectedSubject(allowedSubjectOptions[0] || fallbackSubjects[0]);
    }
  }, [selectedSubject, allowedSubjectOptions]);

  // Handlers for individual scores
  const handleCqChange = (roll, value) => {
    const maxCq = hasCqMcqRule ? Number(currentSubjectRule.cqTotal) : resolvedRule.totalMarks;
    if (value !== '' && (Number(value) < 0 || Number(value) > maxCq)) return;
    setStudents((prev) =>
      prev.map((s) => s.roll === roll ? { ...s, cqMarks: value, marks: '' } : s)
    );
    setFeedback('');
  };

  const handleMcqChange = (roll, value) => {
    const maxMcq = hasCqMcqRule && hasMcqComponent ? Number(currentSubjectRule.mcqTotal) : 0;
    if (value !== '' && (Number(value) < 0 || Number(value) > maxMcq)) return;
    setStudents((prev) =>
      prev.map((s) => s.roll === roll ? { ...s, mcqMarks: value, marks: '' } : s)
    );
    setFeedback('');
  };

  const handleMarksChange = (roll, value) => {
    if (value !== '' && (Number(value) < 0 || Number(value) > resolvedRule.totalMarks)) return;
    setStudents((prev) =>
      prev.map((s) => s.roll === roll ? { ...s, cqMarks: value, mcqMarks: '', marks: value } : s)
    );
    setFeedback('');
  };

  // Batch Quick Actions
  const handleQuickFillMaxCQ = () => {
    const maxCq = hasCqMcqRule ? String(currentSubjectRule.cqTotal) : String(resolvedRule.totalMarks);
    setStudents((prev) =>
      prev.map((s) => (s.cqMarks === '' ? { ...s, cqMarks: maxCq } : s))
    );
    setFeedback(`Filled empty CQ marks with maximum score (${maxCq}).`);
    setFeedbackType('info');
  };

  const handleQuickFillMaxMCQ = () => {
    if (!hasCqMcqRule || !hasMcqComponent) return;
    const maxMcq = String(currentSubjectRule.mcqTotal);
    setStudents((prev) =>
      prev.map((s) => (s.mcqMarks === '' ? { ...s, mcqMarks: maxMcq } : s))
    );
    setFeedback(`Filled empty MCQ marks with maximum score (${maxMcq}).`);
    setFeedbackType('info');
  };

  const handleSetStudentAbsent = (roll) => {
    setStudents((prev) =>
      prev.map((s) => (s.roll === roll ? { ...s, cqMarks: '0', mcqMarks: hasMcqComponent ? '0' : '' } : s))
    );
  };

  const handleSetStudentMax = (roll) => {
    const maxCq = hasCqMcqRule ? String(currentSubjectRule.cqTotal) : String(resolvedRule.totalMarks);
    const maxMcq = hasCqMcqRule && hasMcqComponent ? String(currentSubjectRule.mcqTotal) : '';
    setStudents((prev) =>
      prev.map((s) => (s.roll === roll ? { ...s, cqMarks: maxCq, mcqMarks: maxMcq } : s))
    );
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (effectiveReadOnly) {
      setFeedback('Read-only teacher login cannot save result changes.');
      setFeedbackType('error');
      return;
    }
    if (!selectedExamId) {
      setFeedback('Error: Please select a configured Exam Session first.');
      setFeedbackType('error');
      return;
    }
    if (!isClassAllowed) {
      setFeedback('You are not assigned to this class. Please choose your assigned class.');
      setFeedbackType('error');
      return;
    }
    if (!allowedGroupOptions.includes(selectedSection)) {
      setFeedback('You are not assigned to this group. Please choose your assigned group.');
      setFeedbackType('error');
      return;
    }
    if (!allowedSubjectOptions.includes(selectedSubject)) {
      setFeedback('You are not assigned to this subject. Please choose your assigned subject.');
      setFeedbackType('error');
      return;
    }

    const filledStudents = students.filter((student) => {
      if (hasCqMcqRule) return String(student.cqMarks ?? '') !== '';
      return String(student.cqMarks ?? student.marks ?? '') !== '';
    });

    if (filledStudents.length === 0) {
      setFeedback('Please enter at least one mark before submitting.');
      setFeedbackType('error');
      return;
    }

    const count = filledStudents.length;
    const shouldSave = await confirm({
      title: 'Save Results Confirmation',
      message: `Are you sure you want to save marks for ${count} student${count > 1 ? 's' : ''} in ${selectedClass} (${selectedSubject})?`,
      confirmText: '✓ Yes, Save Marks',
      cancelText: 'Cancel'
    });
    if (!shouldSave) {
      setFeedback('Save cancelled.');
      setFeedbackType('info');
      return;
    }

    setIsSaving(true);
    setFeedback('Saving and verifying results in database...');
    setFeedbackType('info');

    try {
      await Promise.all(filledStudents.map((student) => {
        let cqMarks, mcqMarks, marks;
        if (hasCqMcqRule) {
          cqMarks  = String(student.cqMarks ?? '') !== '' ? Number(student.cqMarks) : 0;
          mcqMarks = hasMcqComponent ? (String(student.mcqMarks ?? '') !== '' ? Number(student.mcqMarks) : 0) : 0;
          marks    = cqMarks + mcqMarks;
        } else {
          marks    = Number(student.cqMarks ?? student.marks ?? 0);
          cqMarks  = marks;
          mcqMarks = 0;
        }

        const gradeInfo = getDynamicGradeInfoWithComponents(cqMarks, mcqMarks, currentSubjectRule);
        const studentId = student.id || `${selectedClass}-${selectedSection}-${student.roll}`.replace(/\s+/g, '-');
        const resultId  = buildResultDocId({ studentId, subject: selectedSubject, examId: selectedExamId });

        return saveResultEntry({
          studentId,
          studentName: student.name,
          name: student.name,
          fatherName: student.fatherName || 'N/A',
          motherName: student.motherName || 'N/A',
          profilePic: student.profilePic || '',
          roll: student.roll,
          class: selectedClass,
          section: selectedSection,
          group: selectedSection,
          subject: selectedSubject,
          marks,
          cqMarks,
          mcqMarks,
          grade: gradeInfo.grade,
          gradePoint: gradeInfo.gradePoint,
          status: gradeInfo.status,
          remarks: gradeInfo.remarks,
          examId: selectedExamId,
          schoolId: activeSchoolId,
          key: resultId,
        }, activeSchoolId);
      }));

      setFeedback(`✅ Successfully saved and published marks for ${filledStudents.length} student${filledStudents.length > 1 ? 's' : ''}!`);
      setFeedbackType('success');
    } catch (err) {
      console.warn('Could not save results to Firestore:', err);
      setFeedback('❌ Could not verify database save. Please check your network and permissions.');
      setFeedbackType('error');
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard navigation
  const handleMarksKeyDown = (event, index, field) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();

    if (hasCqMcqRule && hasMcqComponent && field === 'cq') {
      const mcqInput = document.querySelector(`[data-mcq-input="${index}"]`);
      if (mcqInput) { mcqInput.focus(); mcqInput.select?.(); return; }
    }

    const nextCq = document.querySelector(`[data-cq-input="${index + 1}"]`);
    if (nextCq) {
      nextCq.focus();
      nextCq.select?.();
      nextCq.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    handleSubmit();
  };

  const handleReset = () => {
    const rosterForSelection = (selectedClassData?.students || [])
      .filter((student) => {
        if (!selectedSection) return true;
        const stGroup = typeof student?.group === 'object' && student.group !== null
          ? student.group.name || student.group.id || ''
          : String(student?.group || '');
        return normalizeKey(stGroup) === normalizeKey(selectedSection);
      })
      .map((student) => ({ ...student, marks: '', cqMarks: '', mcqMarks: '' }));
    setStudents(rosterForSelection);
    setFeedback('Marks cleared.');
    setFeedbackType('info');
  };

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase().trim();
    return students.filter(
      (s) =>
        String(s.roll || '').includes(q) ||
        String(s.name || '').toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  const enteredCount = students.filter((s) =>
    hasCqMcqRule ? String(s.cqMarks ?? '') !== '' : String(s.cqMarks ?? s.marks ?? '') !== ''
  ).length;

  const totalStudentsCount = students.length;
  const progressPercent = totalStudentsCount > 0 ? Math.round((enteredCount / totalStudentsCount) * 100) : 0;

  const averageMarks = students
    .filter((s) => hasCqMcqRule ? String(s.cqMarks ?? '') !== '' : String(s.cqMarks ?? s.marks ?? '') !== '')
    .reduce((sum, s) => {
      const cq  = Number(s.cqMarks  ?? 0);
      const mcq = Number(s.mcqMarks ?? 0);
      return sum + cq + (hasMcqComponent ? mcq : 0);
    }, 0);

  if (classOptions.length === 0) {
    return (
      <div className="re-page-container">
        <div className="re-card">
          <div className="re-header">
            <div>
              <p className="re-meta">Result Entry</p>
              <h2 className="re-title">No Class Data Available</h2>
            </div>
          </div>
          <p className="re-feedback re-feedback-info">Please add class data first or refresh the page.</p>
        </div>
      </div>
    );
  }

  if (!selectedClassData) {
    return (
      <div className="re-page-container">
        <div className="re-card">
          <div className="re-header">
            <div>
              <p className="re-meta">Result Entry</p>
              <h2 className="re-title">No Class Selected</h2>
            </div>
          </div>
          <p className="re-feedback re-feedback-info">The selected class is not available for result entry.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="re-page-container">
      {/* ── Modern App Bar & Header ── */}
      <div className="re-card">
        <div className="re-header">
          <div className="re-header-info">
            <div className="re-badge-row">
              <span className={`re-status-badge ${effectiveReadOnly ? 're-badge-readonly' : 're-badge-live'}`}>
                {effectiveReadOnly ? `🔒 ${t('common.readOnly')}` : `🟢 ${t('common.live')}`}
              </span>
              {selectedClassData && getSchoolNameByClass(selectedClassData.className) && (
                <span className="re-institution-chip">
                  <span>{SCHOOL_BRANCHES[getBranchKeyByClass(selectedClassData.className)]?.emoji || '🏛️'}</span>
                  <span>{getSchoolNameByClass(selectedClassData.className)}</span>
                </span>
              )}
            </div>
            <h1 className="re-title">
              {effectiveReadOnly ? t('results.resultView') : t('results.resultEntry')}
            </h1>
            <p className="re-subtitle">
              {t('results.teacherResultEntry')} • Fast touch-friendly student score grading
            </p>
          </div>
        </div>

        {/* ── Branch Pills Selection ── */}
        <div className="re-branch-pills-row">
          {getActiveBranchKeys(schoolProfile).map((branchKey) => {
            const branch = SCHOOL_BRANCHES[branchKey];
            const hasClasses = filterClassesByBranch(allowedClassOptions, branchKey).length > 0;
            if (!hasClasses) return null;
            const isActive = selectedBranch === branchKey;
            return (
              <button
                key={branchKey}
                type="button"
                onClick={() => setSelectedBranch(branchKey)}
                className={`re-branch-pill-btn ${isActive ? 'active' : ''}`}
                style={{
                  '--branch-color': branch.color,
                  '--branch-grad': branch.gradientTo || branch.color,
                }}
              >
                <span className="re-branch-emoji">{branch.emoji}</span>
                <span>{branch.shortName}</span>
              </button>
            );
          })}
        </div>

        {/* ── Filter Controls Grid ── */}
        <div className="re-controls-grid">
          <div className="re-form-group">
            <label className="re-label">
              <span>🏫 {t('results.class')}</span>
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="re-select"
            >
              {branchFilteredClassOptions.map((cls) => (
                <option key={cls.className} value={cls.className}>{cls.className}</option>
              ))}
            </select>
          </div>

          <div className="re-form-group">
            <label className="re-label">
              <span>📝 {t('results.examSession')} *</span>
            </label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className={`re-select ${!selectedExamId ? 're-select-warning' : ''}`}
              required
            >
              {filteredExamSessions.length === 0 ? (
                <option value="">{t('results.noExamConfigured')}</option>
              ) : (
                filteredExamSessions.map((exam) => {
                  const idVal = exam.examId || exam.key || exam.id;
                  return (
                    <option key={idVal} value={idVal}>
                      {exam.name}{exam.targetGroup && exam.targetGroup !== 'All' ? ` (${exam.targetGroup})` : ''}
                    </option>
                  );
                })
              )}
            </select>
          </div>

          <div className="re-form-group">
            <label className="re-label">
              <span>👥 {t('results.group')}</span>
            </label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="re-select"
            >
              {allowedGroupOptions.map((group) => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
          </div>

          <div className="re-form-group">
            <label className="re-label">
              <span>📚 {t('results.subject')}</span>
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="re-select"
            >
              {allowedSubjectOptions.map((subject) => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Missing Exam Session Alert ── */}
        {filteredExamSessions.length === 0 && (
          <div className="re-warning-banner">
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <div>
              <strong>No Exam Session configured for {selectedClass}.</strong>
              <div>Please configure an exam session with rules in the "Results" tab to grade student marks.</div>
            </div>
          </div>
        )}

        {/* ── Progress & Rules Dashboard Card ── */}
        <div className="re-dashboard-strip">
          <div className="re-kpi-item">
            <span className="re-kpi-label">Progress</span>
            <div className="re-kpi-val-row">
              <span className="re-kpi-val">{enteredCount} / {totalStudentsCount}</span>
              <span className="re-kpi-badge">{progressPercent}%</span>
            </div>
            <div className="re-progress-bar-bg">
              <div className="re-progress-bar-fill" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          <div className="re-kpi-item">
            <span className="re-kpi-label">Subject Rules</span>
            <span className="re-kpi-val-rule">
              {hasCqMcqRule ? (
                <>CQ: <strong>{currentSubjectRule.cqTotal}</strong> (Pass: {currentSubjectRule.cqPass}) {hasMcqComponent && <>• {isPrimaryBranch ? 'Tut' : 'MCQ'}: <strong>{currentSubjectRule.mcqTotal}</strong> (Pass: {currentSubjectRule.mcqPass})</>}</>
              ) : (
                <>Total: <strong>{resolvedRule.totalMarks}</strong> (Pass: {resolvedRule.passMarks})</>
              )}
            </span>
          </div>

          <div className="re-kpi-item">
            <span className="re-kpi-label">Class Average</span>
            <span className="re-kpi-val">
              {enteredCount ? (averageMarks / enteredCount).toFixed(1) : '0.0'} <span style={{ fontSize: '12px', color: '#64748b' }}>pts</span>
            </span>
          </div>
        </div>

        {/* ── Search & Quick Fill Action Bar ── */}
        <div className="re-toolbar-row">
          <div className="re-search-box">
            <span className="re-search-icon">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student by name or roll..."
              className="re-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="re-search-clear"
              >
                ✕
              </button>
            )}
          </div>

          <div className="re-quick-actions">
            {!effectiveReadOnly && (
              <>
                <button
                  type="button"
                  onClick={handleQuickFillMaxCQ}
                  className="re-btn-quick"
                  title="Fill all empty students with full CQ marks"
                >
                  ⚡ Max CQ
                </button>
                {hasCqMcqRule && hasMcqComponent && (
                  <button
                    type="button"
                    onClick={handleQuickFillMaxMCQ}
                    className="re-btn-quick"
                    title="Fill all empty students with full MCQ/Tutorial marks"
                  >
                    ⚡ Max {isPrimaryBranch ? 'Tut' : 'MCQ'}
                  </button>
                )}
              </>
            )}
            <div className="re-layout-toggle">
              <button
                type="button"
                onClick={() => setViewLayout(viewLayout === 'cards' ? 'table' : 'cards')}
                className="re-btn-toggle"
                title="Toggle Card / Table View"
              >
                {viewLayout === 'cards' ? '📊 Table View' : '📱 Card View'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Feedback Notification ── */}
        {feedback && (
          <div className={`re-feedback re-feedback-${feedbackType}`}>
            {feedback}
          </div>
        )}

        {/* ── Main Student Grading Form ── */}
        {classOptions.length === 0 ? (
          <TableSkeleton rows={6} columns={6} />
        ) : (
          <form onSubmit={handleSubmit} className="re-form">
            {/* Mobile Card Layout (Visible on mobile or when card layout toggled) */}
            <div className={`re-cards-container ${viewLayout === 'table' ? 're-hide-cards' : ''}`}>
              {filteredStudents.length === 0 ? (
                <div className="re-empty-state">
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
                  <div style={{ fontWeight: 700, color: '#1e293b' }}>No students found</div>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>Try adjusting your search query or group filter.</div>
                </div>
              ) : (
                filteredStudents.map((student, index) => {
                  const cqVal = student.cqMarks ?? '';
                  const mcqVal = student.mcqMarks ?? '';
                  const totalDisplay = hasCqMcqRule
                    ? (cqVal !== '' || mcqVal !== '' ? (Number(cqVal || 0) + Number(mcqVal || 0)) : '')
                    : (student.marks ?? '');
                  const gradeDisplay = getGradeForTable(cqVal, mcqVal);
                  const cqFail = hasCqMcqRule && cqVal !== '' && Number(cqVal) < Number(currentSubjectRule.cqPass);
                  const mcqFail = hasCqMcqRule && hasMcqComponent && mcqVal !== '' && Number(mcqVal) < Number(currentSubjectRule.mcqPass);
                  const isPassed = gradeDisplay !== '-' && gradeDisplay !== 'F';
                  const isComplete = hasCqMcqRule ? (hasMcqComponent ? cqVal !== '' && mcqVal !== '' : cqVal !== '') : cqVal !== '';

                  return (
                    <div
                      key={student.id || student.roll}
                      className={`re-student-card ${isComplete ? (isPassed ? 're-card-passed' : 're-card-failed') : ''}`}
                    >
                      <div className="re-card-header">
                        <div className="re-student-meta">
                          <div className="re-student-roll">#{String(student.roll).padStart(2, '0')}</div>
                          <div className="re-student-name-box">
                            <span className="re-student-name">{student.name}</span>
                            <span className="re-student-sub">{selectedClass} {selectedSection ? `• ${selectedSection}` : ''}</span>
                          </div>
                        </div>
                        <div className="re-card-grade-badge">
                          {gradeDisplay !== '-' ? (
                            <span className={`re-grade-pill ${gradeDisplay === 'F' ? 'fail' : 'pass'}`}>
                              {gradeDisplay}
                            </span>
                          ) : (
                            <span className="re-grade-pill pending">Pending</span>
                          )}
                        </div>
                      </div>

                      <div className="re-card-inputs-row">
                        {/* CQ Input */}
                        <div className="re-card-input-field">
                          <div className="re-input-header">
                            <span>CQ Marks</span>
                            <span className="re-input-max">Max: {hasCqMcqRule ? currentSubjectRule.cqTotal : resolvedRule.totalMarks}</span>
                          </div>
                          <div className="re-touch-input-wrapper">
                            <input
                              type="number"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={cqVal}
                              onChange={(e) => hasCqMcqRule ? handleCqChange(student.roll, e.target.value) : handleMarksChange(student.roll, e.target.value)}
                              onKeyDown={(e) => handleMarksKeyDown(e, index, 'cq')}
                              disabled={effectiveReadOnly || !selectedExamId}
                              data-cq-input={index}
                              placeholder="0"
                              className={`re-touch-input ${cqFail ? 're-input-fail' : ''}`}
                              min="0"
                              max={hasCqMcqRule ? currentSubjectRule.cqTotal : resolvedRule.totalMarks}
                            />
                            {!effectiveReadOnly && selectedExamId && (
                              <button
                                type="button"
                                onClick={() => hasCqMcqRule ? handleCqChange(student.roll, String(currentSubjectRule.cqTotal)) : handleMarksChange(student.roll, String(resolvedRule.totalMarks))}
                                className="re-input-btn-quick"
                                title="Full Marks"
                              >
                                Max
                              </button>
                            )}
                          </div>
                          {cqFail && <span className="re-fail-hint">Below pass mark ({currentSubjectRule.cqPass})</span>}
                        </div>

                        {/* MCQ / Tutorial Input */}
                        {hasCqMcqRule && hasMcqComponent && (
                          <div className="re-card-input-field">
                            <div className="re-input-header">
                              <span>{isPrimaryBranch ? 'Tutorial' : 'MCQ'}</span>
                              <span className="re-input-max">Max: {currentSubjectRule.mcqTotal}</span>
                            </div>
                            <div className="re-touch-input-wrapper">
                              <input
                                type="number"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={mcqVal}
                                onChange={(e) => handleMcqChange(student.roll, e.target.value)}
                                onKeyDown={(e) => handleMarksKeyDown(e, index, 'mcq')}
                                disabled={effectiveReadOnly || !selectedExamId}
                                data-mcq-input={index}
                                placeholder="0"
                                className={`re-touch-input ${mcqFail ? 're-input-fail' : ''}`}
                                min="0"
                                max={currentSubjectRule.mcqTotal}
                              />
                              {!effectiveReadOnly && selectedExamId && (
                                <button
                                  type="button"
                                  onClick={() => handleMcqChange(student.roll, String(currentSubjectRule.mcqTotal))}
                                  className="re-input-btn-quick"
                                  title="Full Marks"
                                >
                                  Max
                                </button>
                              )}
                            </div>
                            {mcqFail && <span className="re-fail-hint">Below pass mark ({currentSubjectRule.mcqPass})</span>}
                          </div>
                        )}
                      </div>

                      <div className="re-card-footer">
                        <div className="re-total-preview">
                          <span className="re-total-label">Total Score:</span>
                          <strong className="re-total-val" style={{ color: (cqFail || mcqFail) ? '#b91c1c' : '#1e3a8a' }}>
                            {totalDisplay !== '' ? `${totalDisplay} / ${resolvedRule.totalMarks}` : '—'}
                          </strong>
                        </div>
                        {!effectiveReadOnly && selectedExamId && (
                          <div className="re-card-shortcuts">
                            <button
                              type="button"
                              onClick={() => handleSetStudentAbsent(student.roll)}
                              className="re-card-shortcut-btn"
                            >
                              Mark Absent (0)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetStudentMax(student.roll)}
                              className="re-card-shortcut-btn highlight"
                            >
                              Full Marks
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Spreadsheet Table View (Visible on desktop or when table layout toggled) */}
            <div className={`re-table-wrapper ${viewLayout === 'cards' ? 're-hide-table' : ''}`}>
              <table className="re-table">
                <thead>
                  <tr>
                    <th style={{ width: '60px', textAlign: 'center' }}>SL / Roll</th>
                    <th>{t('results.studentName')}</th>
                    {hasCqMcqRule ? (
                      <>
                        <th style={{ textAlign: 'center', width: '130px' }}>
                          CQ Marks
                          <span className="re-th-sub">(Max: {currentSubjectRule.cqTotal})</span>
                        </th>
                        {hasMcqComponent && (
                          <th style={{ textAlign: 'center', width: '130px' }}>
                            {isPrimaryBranch ? 'Tutorial' : 'MCQ'}
                            <span className="re-th-sub">(Max: {currentSubjectRule.mcqTotal})</span>
                          </th>
                        )}
                        <th style={{ textAlign: 'center', width: '110px' }}>
                          Total
                          <span className="re-th-sub">(Max: {resolvedRule.totalMarks})</span>
                        </th>
                      </>
                    ) : (
                      <th style={{ textAlign: 'center', width: '140px' }}>
                        {t('results.marks')}
                        <span className="re-th-sub">(Max: {resolvedRule.totalMarks})</span>
                      </th>
                    )}
                    <th style={{ textAlign: 'center', width: '90px' }}>{t('results.grade')}</th>
                    {!effectiveReadOnly && <th style={{ textAlign: 'center', width: '120px' }}>Quick Fill</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={hasCqMcqRule ? (hasMcqComponent ? 6 : 5) : 5} className="re-empty-td">
                        {t('results.noStudentsFound')}
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student, index) => {
                      const cqVal = student.cqMarks ?? '';
                      const mcqVal = student.mcqMarks ?? '';
                      const totalDisplay = hasCqMcqRule
                        ? (cqVal !== '' || mcqVal !== '' ? (Number(cqVal || 0) + Number(mcqVal || 0)) : '')
                        : '';
                      const gradeDisplay = getGradeForTable(cqVal, mcqVal);
                      const cqFail = hasCqMcqRule && cqVal !== '' && Number(cqVal) < Number(currentSubjectRule.cqPass);
                      const mcqFail = hasCqMcqRule && hasMcqComponent && mcqVal !== '' && Number(mcqVal) < Number(currentSubjectRule.mcqPass);

                      return (
                        <tr key={student.id || student.roll} className={index % 2 === 0 ? 're-tr-even' : 're-tr-odd'}>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: '#64748b' }}>
                            #{String(student.roll).padStart(2, '0')}
                          </td>
                          <td style={{ fontWeight: 700, color: '#1e293b' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                              <span className="re-avatar-circle">{student.name.charAt(0)}</span>
                              {student.name}
                            </span>
                          </td>
                          {hasCqMcqRule ? (
                            <>
                              <td style={{ textAlign: 'center' }}>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={cqVal}
                                  onChange={(e) => handleCqChange(student.roll, e.target.value)}
                                  onKeyDown={(e) => handleMarksKeyDown(e, index, 'cq')}
                                  disabled={effectiveReadOnly || !selectedExamId}
                                  data-cq-input={index}
                                  placeholder={String(currentSubjectRule.cqTotal)}
                                  className={`re-table-input ${cqFail ? 're-input-fail' : ''}`}
                                  min="0"
                                  max={currentSubjectRule.cqTotal}
                                />
                              </td>
                              {hasMcqComponent && (
                                <td style={{ textAlign: 'center' }}>
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={mcqVal}
                                    onChange={(e) => handleMcqChange(student.roll, e.target.value)}
                                    onKeyDown={(e) => handleMarksKeyDown(e, index, 'mcq')}
                                    disabled={effectiveReadOnly || !selectedExamId}
                                    data-mcq-input={index}
                                    placeholder={String(currentSubjectRule.mcqTotal)}
                                    className={`re-table-input ${mcqFail ? 're-input-fail' : ''}`}
                                    min="0"
                                    max={currentSubjectRule.mcqTotal}
                                  />
                                </td>
                              )}
                              <td style={{ textAlign: 'center' }}>
                                <span style={{
                                  fontWeight: 800,
                                  fontSize: '15px',
                                  color: (cqFail || mcqFail) ? '#b91c1c' : totalDisplay !== '' ? '#1e3a8a' : '#94a3b8',
                                }}>
                                  {totalDisplay !== '' ? totalDisplay : '—'}
                                </span>
                                {(cqFail || mcqFail) && (
                                  <div style={{ fontSize: '10px', color: '#b91c1c', fontWeight: 700, marginTop: '2px' }}>
                                    {cqFail && mcqFail ? 'CQ+MCQ Fail' : cqFail ? 'CQ Fail' : 'MCQ Fail'}
                                  </div>
                                )}
                              </td>
                            </>
                          ) : (
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="number"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={cqVal}
                                onChange={(e) => handleMarksChange(student.roll, e.target.value)}
                                onKeyDown={(e) => handleMarksKeyDown(e, index, 'cq')}
                                disabled={effectiveReadOnly || !selectedExamId}
                                data-cq-input={index}
                                placeholder={`Max: ${resolvedRule.totalMarks}`}
                                className="re-table-input"
                                min="0"
                                max={resolvedRule.totalMarks}
                              />
                            </td>
                          )}
                          <td style={{ textAlign: 'center' }}>
                            <span className={`re-grade-pill ${gradeDisplay === 'F' ? 'fail' : gradeDisplay === '-' ? 'pending' : 'pass'}`}>
                              {gradeDisplay}
                            </span>
                          </td>
                          {!effectiveReadOnly && (
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleSetStudentMax(student.roll)}
                                className="re-table-quick-btn"
                                title="Set Max Marks"
                              >
                                Max
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetStudentAbsent(student.roll)}
                                className="re-table-quick-btn absent"
                                title="Set Absent (0)"
                              >
                                Abs
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Sticky Bottom Floating Action Bar ── */}
            {!effectiveReadOnly && (
              <div className="re-sticky-action-bar">
                <div className="re-sticky-info">
                  <div className="re-sticky-count-row">
                    <span className="re-sticky-badge">
                      📝 {enteredCount} / {totalStudentsCount}
                    </span>
                    <span className="re-sticky-progress-text">
                      {progressPercent}% Done
                    </span>
                  </div>
                  <span className="re-sticky-sub">
                    {selectedClass} • {selectedSubject}
                  </span>
                </div>
                <div className="re-sticky-buttons">
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={isSaving}
                    className="re-btn-secondary"
                    title="Clear all entered marks"
                  >
                    {t('common.reset')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || enteredCount === 0 || !selectedExamId}
                    className="re-btn-primary"
                  >
                    {isSaving ? '⏳ Saving...' : `✓ Save (${enteredCount})`}
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

export default ResultEntry;