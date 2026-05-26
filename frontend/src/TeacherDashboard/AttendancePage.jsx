import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Mic, MicOff, Save, History, Volume2, Loader2, X, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../authentication/AuthContext';
import attendanceService from './attendanceService';
import teacherService from './teacherService';
import HistoryView from './AttendanceHistoryView';

const MAX_RETRIES = 2; // Reduced retries slightly but increased timing
const SILENCE_MS = 5000; // Increased to 5s to allow slower responses

export default function AttendancePage({ teacherProfile: propProfile, teachingOptions }) {
    const { classId: urlClassId } = useParams();
    const { currentUser } = useAuth();

    const [students, setStudents] = useState([]);
    const [attendance, setAttendance] = useState({});
    const [isListening, setIsListening] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [selectedClass, setSelectedClass] = useState(null);
    const [isHoliday, setIsHoliday] = useState(false);
    const [availableClasses, setAvailableClasses] = useState([]);

    /* ── refs ── */
    const recognitionRef = useRef(null);
    const synthRef = useRef(window.speechSynthesis);
    const isActiveRef = useRef(false);
    const isListeningRef = useRef(false);
    const currentIndexRef = useRef(-1);
    const studentsRef = useRef([]);
    const retryCountRef = useRef(0);
    const silenceTimerRef = useRef(null);
    const speakRef = useRef(null);

    /* ── sync state → refs ── */
    useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
    useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
    useEffect(() => { studentsRef.current = students; }, [students]);

    /* ── fetch class data ── */
    const fetchStudents = async (cid) => {
        if (!cid) return;
        console.log("AttendancePage: Fetching students for cid:", cid);
        setLoading(true);
        setError(null);
        try {
            const res = await attendanceService.getStudents(cid);
            console.log("AttendancePage: Fetch response:", res);
            if (res.ok) {
                const studentList = res.data || [];
                setStudents(studentList);

                const initAttendance = {};
                let hasHoliday = false;

                studentList.forEach(s => {
                    const todayRecord = s.attendance?.[0] || s.attendances?.[0];
                    initAttendance[s.id] = todayRecord ? todayRecord.status : null;
                    if (todayRecord?.status === 'H') hasHoliday = true;
                });

                setAttendance(initAttendance);
                setIsHoliday(hasHoliday);
            } else {
                setError(res.message || "Failed to fetch students");
            }
        } catch (err) {
            console.error("AttendancePage: Fetch error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            try {
                // Fetch all available classes for the teacher
                const classesRes = await attendanceService.getClasses();
                if (classesRes.ok && classesRes.data?.length > 0) {
                    const classes = classesRes.data;
                    setAvailableClasses(classes);

                    // Determine which class to select first
                    let initialClass = null;

                    if (urlClassId) {
                        initialClass = classes.find(c => c.id === parseInt(urlClassId));
                    }

                    if (!initialClass && propProfile?.classHead) {
                        initialClass = classes.find(c => c.id === propProfile.classHead.id);
                    }

                    if (!initialClass && teachingOptions?.classes?.length > 0) {
                        initialClass = classes.find(c => c.id === teachingOptions.classes[0].id);
                    }

                    // Default to first class if nothing else found
                    if (!initialClass) {
                        initialClass = classes[0];
                    }

                    if (initialClass) {
                        setSelectedClass(initialClass);
                        await fetchStudents(initialClass.id);
                    }
                } else {
                    setError(classesRes.message || "No classes found for your school.");
                }
            } catch (err) {
                console.error("AttendancePage: Load error:", err);
                setError("Failed to load attendance data.");
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
    }, [currentUser?.id, propProfile, teachingOptions]);

    useEffect(() => {
        if (selectedClass) {
            fetchStudents(selectedClass.id);
        }
    }, [selectedClass?.id]);

    const handleClassChange = (e) => {
        const classId = parseInt(e.target.value);
        const newClass = availableClasses.find(c => c.id === classId);
        if (newClass) {
            setSelectedClass(newClass);
            if (isListening) stopVoiceAttendance();
            setShowHistory(false);
        }
    };

    /* ── init SpeechRecognition once ── */
    useEffect(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) return;

        const recognition = new SR();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 3;
        recognition.continuous = false;

        /* doMark lives here so it always closes over the stable setters + refs */
        const doMark = (status) => {
            if (isHoliday) return; // Prevent marking during holiday

            const idx = currentIndexRef.current;
            const sts = studentsRef.current;
            const student = sts[idx];
            if (!student) return;

            setAttendance(prev => ({ ...prev, [student.id]: status }));
            toast.success(`Roll ${student.rollNo} — ${status === 'P' ? 'Present ✓' : status === 'A' ? 'Absent ✗' : 'Skipped ⏭'}`);

            const nextIndex = idx + 1;
            if (nextIndex >= sts.length) {
                setIsListening(false);
                isListeningRef.current = false;
                setCurrentIndex(-1);
                speakRef.current?.('Attendance complete.');
                toast.success('Attendance session complete!');
                return;
            }

            retryCountRef.current = 0;
            currentIndexRef.current = nextIndex;
            setCurrentIndex(nextIndex);

            setTimeout(() => {
                speakRef.current?.(`Roll ${sts[nextIndex].rollNo}?`);
                setTimeout(() => {
                    if (isListeningRef.current && !isActiveRef.current) {
                        try { recognition.start(); } catch (_) { }
                    }
                }, 800);
            }, 150);
        };

        const startSilenceTimer = () => {
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
                if (!isListeningRef.current) return;

                console.log('[Voice] Silence timeout reached');
                try {
                    recognition.stop(); // Use stop instead of abort for cleaner termination
                } catch (_) { }

                retryCountRef.current += 1;
                const idx = currentIndexRef.current;
                const sts = studentsRef.current;

                if (retryCountRef.current < MAX_RETRIES && idx >= 0 && sts[idx]) {
                    speakRef.current?.(`Roll ${sts[idx].rollNo}?`);
                    // Delay slightly longer before restart to allow browser to clear state
                    setTimeout(() => {
                        if (isListeningRef.current && !isActiveRef.current) {
                            try { recognition.start(); } catch (e) {
                                console.warn('[Voice] Failed to restart after silence:', e.message);
                            }
                        }
                    }, 1000);
                } else {
                    retryCountRef.current = 0;
                    toast(`Roll ${sts[idx]?.rollNo} — no response. Marked as Skipped.`, { icon: '⏭️' });
                    doMark('S');
                }
            }, SILENCE_MS);
        };

        recognition.onstart = () => {
            isActiveRef.current = true;
            startSilenceTimer();
        };

        recognition.onend = () => {
            isActiveRef.current = false;
            if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
        };

        const detectStatus = (transcript) => {
            if (!transcript) return null;

            // 1. Strip punctuation and normalize
            const cleanT = transcript.toLowerCase()
                .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
                .replace(/\s{2,}/g, " ")
                .trim();

            if (!cleanT) return null;

            // 2. Expanded keywords
            const presentKeywords = [
                'yes', 'yeah', 'ya', 'yup', 'yep', 'yas', 'yeh', 'yo', 'jazz', 'guess',
                'present', 'presen', 'prasent', 'prezent', 'resent', 'prazent',
                'prison', 'president', 'pleasant', 'prevent', 'preset', 'presence',
                'representative', 'presented', 'prazant', 'prezant',
                'here', 'hiye', 'her', 'okay', 'ok', 'p'
            ];
            const absentKeywords = [
                'no', 'nah', 'nai', 'na', 'nope',
                'absent', 'absen', 'absnt', 'absant', 'abzent', 'obsen', 'apsent', 'apsen', 'accent', 'abcent',
                'of scent', 'ab', 'send', 'sent',
                'nahi', 'a'
            ];
            const skipKeywords = ['skip', 'next', 'skp', 'nxt', 's'];

            // 3. Word-level matching (Safe)
            const words = cleanT.split(/\s+/);

            // Check if any word exactly matches a keyword
            if (presentKeywords.some(k => words.includes(k))) return 'P';
            if (absentKeywords.some(k => words.includes(k))) return 'A';
            if (skipKeywords.some(k => words.includes(k))) return 'S';

            // 4. Exact full string match
            if (presentKeywords.includes(cleanT)) return 'P';
            if (absentKeywords.includes(cleanT)) return 'A';
            if (skipKeywords.includes(cleanT)) return 'S';

            // 5. Broad substring matching (Riskier, but helps with accents)
            // Only for longer keywords to avoid "no" in "nothing"
            if (presentKeywords.some(k => k.length > 3 && cleanT.includes(k))) return 'P';
            if (absentKeywords.some(k => k.length > 3 && cleanT.includes(k))) return 'A';

            // Special cases for common "two-word" misinterpretations
            if (cleanT.includes('i am here') || cleanT.includes('i am present')) return 'P';
            if (cleanT.includes('not here') || cleanT.includes('is absent')) return 'A';

            return null;
        };

        recognition.onresult = (event) => {
            if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }

            // Check all alternatives
            let status = null;
            let heardText = "";

            for (let i = 0; i < event.results[0].length; i++) {
                const transcript = event.results[0][i].transcript;
                if (i === 0) heardText = transcript; // Keep top result as default

                status = detectStatus(transcript);
                if (status) {
                    heardText = transcript; // Prefer the one that matched
                    break;
                }
            }

            console.log('[Voice] heard:', JSON.stringify(heardText), '-> Status:', status);
            toast(`🎤 Heard: "${heardText}"`, { duration: 1500, style: { fontSize: '12px' } });
            retryCountRef.current = 0;

            if (status) {
                doMark(status);
            } else {
                const idx = currentIndexRef.current;
                const sts = studentsRef.current;
                if (idx >= 0 && sts[idx]) {
                    speakRef.current?.(`Roll ${sts[idx].rollNo}?`);
                    setTimeout(() => {
                        if (isListeningRef.current && !isActiveRef.current) {
                            try { recognition.start(); } catch (_) { }
                        }
                    }, 700);
                }
            }
        };

        recognition.onerror = (event) => {
            if (event.error === 'aborted') {
                console.log('[Voice] Recognition aborted (expected during transitions)');
                return;
            }
            if (event.error === 'no-speech') {
                console.log('[Voice] No speech detected');
                return; // startSilenceTimer handles the retry
            }

            console.error('[Voice] error:', event.error);
            isActiveRef.current = false;
            if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }

            if (event.error === 'not-allowed') {
                setIsListening(false);
                toast.error('Microphone access denied. Please enable it in browser settings.');
            } else if (event.error !== 'network') {
                setIsListening(false);
                toast.error('Voice error: ' + event.error);
            }
        };

        recognitionRef.current = recognition;
    }, [setAttendance, setCurrentIndex, setIsListening]);

    /* ── speak helper ── */
    const speak = (text) => {
        if (synthRef.current) {
            synthRef.current.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.2;
            synthRef.current.speak(utterance);
        }
    };
    speakRef.current = speak;

    /* ── voice control ── */
    const startVoiceAttendance = () => {
        if (!recognitionRef.current) {
            toast.error('Web Speech API is not supported in this browser.');
            return;
        }
        if (students.length === 0) return;

        retryCountRef.current = 0;
        currentIndexRef.current = 0;
        isListeningRef.current = true;
        setIsListening(true);
        setCurrentIndex(0);
        speak(`Starting attendance. Roll ${students[0].rollNo}?`);
        setTimeout(() => {
            if (!isActiveRef.current) {
                try { recognitionRef.current.start(); } catch (_) { }
            }
        }, 1200);
    };

    const stopVoiceAttendance = () => {
        isListeningRef.current = false;
        setIsListening(false);
        setCurrentIndex(-1);
        if (recognitionRef.current) try { recognitionRef.current.stop(); } catch (_) { }
        if (synthRef.current) synthRef.current.cancel();
    };

    /* ── manual & save ── */
    const handleManualChange = (studentId, status) => {
        setAttendance(prev => ({ ...prev, [studentId]: status }));
    };

    const handleSave = async () => {
        if (!selectedClass) return;
        setSaving(true);
        const data = {
            classId: selectedClass.id,
            date: new Date().toISOString().split('T')[0],
            attendanceData: students.map(s => ({
                studentId: s.id,
                status: isHoliday ? 'H' : (attendance[s.id] || 'A')
            }))
        };
        const result = await attendanceService.saveAttendance(data);
        if (result.ok) {
            toast.success('Attendance saved successfully!');
        } else {
            toast.error(result.message);
        }
        setSaving(false);
    };

    /* ── loading / error states ── */
    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-green-700" />
            </div>
        );
    }

    if (error) {
        const isTeacher = currentUser?.role?.toUpperCase() === 'TEACHER';
        return (
            <div className="p-8 text-center bg-white rounded-2xl shadow-sm border border-slate-100 my-10 max-w-lg mx-auto">
                <div className="mx-auto w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mb-4 border border-amber-100">
                    <AlertCircle className="h-7 w-7 text-amber-600" />
                </div>
                <h2 className="text-lg font-medium text-gray-900 mb-1">{isTeacher ? "No Classes Assigned" : "Access Denied"}</h2>
                <p className="text-gray-500 text-[13px] leading-relaxed">
                    {isTeacher 
                        ? "You are not currently assigned as a teacher for any classes. Please contact the administration to assign you to a class or subject."
                        : error
                    }
                </p>
            </div>
        );
    }

    /* ── stats helper ── */
    const total = students.length;
    const present = Object.values(attendance).filter(s => s === 'P').length;
    const absent = Object.values(attendance).filter(s => s === 'A').length;
    const skipped = Object.values(attendance).filter(s => s === 'S').length;
    const pending = total - present - absent - skipped;

    return (
        <div className="p-8 max-w-5xl mx-auto">

            {/* ── Page Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-medium text-gray-900">
                            Attendance — <span className="text-green-700">{selectedClass?.name} {selectedClass?.section}</span>
                        </h1>
                        {availableClasses.length > 1 && (
                            <select
                                value={selectedClass?.id || ''}
                                onChange={handleClassChange}
                                className="text-[12px] font-medium bg-white border border-gray-300 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-600 transition-all cursor-pointer"
                            >
                                {availableClasses
                                    .map(c => (
                                        <option key={c.id} value={c.id}>{c.name} {c.section}</option>
                                    ))}
                            </select>
                        )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                    {import.meta.env.DEV && (
                        <p className="text-[11px] text-gray-400">Debug: CID={selectedClass?.id} Count={students.length}</p>
                    )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {!isHoliday && (!isListening ? (
                        <button
                            onClick={startVoiceAttendance}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-950 hover:bg-green-900 text-white text-sm font-medium rounded-md transition-colors"
                        >
                            <Mic className="h-4 w-4" /> Start Voice
                        </button>
                    ) : (
                        <button
                            onClick={stopVoiceAttendance}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors"
                        >
                            <MicOff className="h-4 w-4" /> Stop Voice
                        </button>
                    ))}

                    <button
                        onClick={() => {
                            const newMode = !isHoliday;
                            setIsHoliday(newMode);
                            if (newMode) {
                                // If switching TO holiday, stop voice + mark all H
                                if (isListening) stopVoiceAttendance();
                                const h = {};
                                students.forEach(s => h[s.id] = 'H');
                                setAttendance(h);
                                toast('Marked as Holiday', { icon: '🏖️' });
                            } else {
                                // Switching AWAY from holiday
                                const init = {};
                                students.forEach(s => init[s.id] = null);
                                setAttendance(init);
                            }
                        }}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 border text-sm font-medium rounded-md transition-all
                            ${isHoliday ? 'bg-orange-100 border-orange-300 text-orange-700 font-medium' : 'border-gray-300 bg-white hover:bg-gray-50 text-gray-700'}`}
                    >
                        <X className={`h-4 w-4 ${isHoliday ? 'text-orange-600' : 'text-gray-400'}`} />
                        {isHoliday ? 'Holiday Mode' : 'Mark Holiday'}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || isListening}
                        className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save
                    </button>
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        disabled={isListening}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 border text-sm font-medium rounded-md transition-colors
                            ${showHistory ? 'bg-gray-100 border-gray-300 text-gray-800' : 'border-gray-300 bg-white hover:bg-gray-50 text-gray-700'}`}
                    >
                        <History className="h-4 w-4" /> History
                    </button>
                </div>
            </div>

            {showHistory ? (
                <HistoryView classId={selectedClass?.id} onBack={() => setShowHistory(false)} />
            ) : (
                <>
                    {/* ── Stats Strip ── */}
                    <div className="flex items-center gap-6 mb-5 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                        <span className="text-gray-500">Total <strong className="text-gray-900 ml-1 font-medium">{total}</strong></span>
                        {isHoliday ? (
                            <span className="text-orange-600 font-medium flex items-center gap-1.5">
                                <X className="h-4 w-4" /> SCHOOL HOLIDAY
                            </span>
                        ) : (
                            <>
                                <span className="text-green-700">Present <strong className="ml-1 font-medium">{present}</strong></span>
                                <span className="text-red-600">Absent <strong className="ml-1 font-medium">{absent}</strong></span>
                                {skipped > 0 && <span className="text-orange-500">Skipped <strong className="ml-1">{skipped}</strong></span>}
                                {pending > 0 && <span className="text-gray-400">Pending <strong className="ml-1">{pending}</strong></span>}
                            </>
                        )}
                    </div>

                    {/* ── Voice Banner ── */}
                    {isListening && (
                        <div className="flex items-center gap-3 mb-5 px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
                            <Volume2 className="h-4 w-4 text-green-700 flex-shrink-0" />
                            <p className="text-sm text-green-800">
                                Listening for <strong className="font-medium">Roll {students[currentIndex]?.rollNo} — {students[currentIndex]?.user?.firstName} {students[currentIndex]?.user?.lastName}</strong>
                            </p>
                            <span className="ml-auto text-[11px] text-green-600 hidden sm:block whitespace-nowrap">
                                Say "Yes / Present" or "No / Absent"
                            </span>
                        </div>
                    )}

                    {/* ── Table ── */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide w-20">Roll</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide">Name</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide w-44">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {students.map((student, index) => {
                                    const status = attendance[student.id];
                                    const isActive = currentIndex === index && isListening;
                                    return (
                                        <tr key={student.id} className={isActive ? 'bg-green-50' : 'hover:bg-gray-50'}>
                                            <td className="px-4 py-3 text-gray-700 font-medium">{student.rollNo}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[11px] font-medium text-gray-600 flex-shrink-0">
                                                        {(student.user?.firstName || '?')[0]}{(student.user?.lastName || '?')[0]}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900">{student.user?.firstName || 'Unknown'} {student.user?.lastName || ''}</p>
                                                        {isActive && <p className="text-[11px] text-green-600 font-medium">Listening…</p>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {isHoliday ? (
                                                    <span className="text-orange-600 font-medium text-[11px] uppercase tracking-widest px-3 py-1 bg-orange-50 rounded-full border border-orange-100">Holiday</span>
                                                ) : (
                                                    <div className="flex items-center gap-1 justify-end">
                                                        {['P', 'A', 'S'].map(st => (
                                                            <button
                                                                key={st}
                                                                onClick={() => handleManualChange(student.id, st)}
                                                                className={`w-8 h-8 rounded-md text-[10px] font-medium transition-all
                                                                    ${status === st
                                                                        ? (st === 'P' ? 'bg-green-950 text-white shadow-md'
                                                                            : st === 'A' ? 'bg-red-600 text-white shadow-md'
                                                                                : 'bg-orange-500 text-white shadow-md')
                                                                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                                            >
                                                                {st}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            {total > 0 && (
                                <tfoot>
                                    <tr className="border-t border-gray-200 bg-gray-50">
                                        <td colSpan={3} className="px-4 py-3">
                                            <div className="flex items-center gap-5 text-[13px] flex-wrap">
                                                <span className="text-gray-500">Total: <strong className="text-gray-800 font-medium">{total}</strong></span>
                                                <span className="text-green-700">Present: <strong className="font-medium">{present}</strong></span>
                                                <span className="text-red-600">Absent: <strong className="font-medium">{absent}</strong></span>
                                                {skipped > 0 && <span className="text-orange-500">Skipped: <strong className="font-medium">{skipped}</strong></span>}
                                                {pending > 0 && <span className="text-gray-400">Pending: <strong className="font-medium">{pending}</strong></span>}
                                            </div>
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>

                        {students.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <Mic className="h-8 w-8 text-gray-300 mb-3" />
                                <p className="text-gray-500 text-[13px]">No students found in your class.</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
