import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../authentication/AuthContext';
import api, { teacherService } from '../services/api';
import { ArrowLeft, LineChart, Printer, X, Calculator, Zap, TrendingUp, Target, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, ReferenceLine, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const CURIOSITY_QUESTIONS = [
    {
        id: 'q1',
        text: 'How often does the student ask questions?',
        options: [
            { label: 'Never', value: 0 },
            { label: 'Rarely', value: 1 },
            { label: 'Sometimes', value: 3 },
            { label: 'Frequently', value: 5 }
        ]
    },
    {
        id: 'q2',
        text: 'Type of questions asked:',
        options: [
            { label: 'None', value: 0 },
            { label: 'Basic', value: 1 },
            { label: 'Conceptual', value: 3 },
            { label: 'Deep "why/how"', value: 5 }
        ]
    },
    {
        id: 'q3',
        text: 'Participation in class:',
        options: [
            { label: 'Passive', value: 0 },
            { label: 'Limited', value: 1 },
            { label: 'Moderate', value: 3 },
            { label: 'Highly active', value: 5 }
        ]
    },
    {
        id: 'q4',
        text: 'Does the student attempt extra/optional assignments provided by the teacher?',
        options: [
            { label: 'Never attempts extras', value: 0 },
            { label: 'Rarely tries extras', value: 1 },
            { label: 'Sometimes does extras', value: 3 },
            { label: 'Always does extras', value: 5 }
        ]
    },
    {
        id: 'q5',
        text: 'Handling difficult problems:',
        options: [
            { label: 'Gives up', value: 0 },
            { label: 'Needs full help', value: 1 },
            { label: 'Tries with effort', value: 3 },
            { label: 'Persists independently', value: 5 }
        ]
    },
    {
        id: 'q6',
        text: 'Creativity & original thinking:',
        options: [
            { label: 'None', value: 0 },
            { label: 'Minimal', value: 1 },
            { label: 'Occasional sparks', value: 3 },
            { label: 'Consistently creative', value: 5 }
        ]
    }
];

const LEARNING_SPEED_QUESTIONS = [
    {
        id: 'q1',
        text: 'How quickly does the student understand video content?',
        options: [
            { label: 'Very slow', value: 0 },
            { label: 'Slow', value: 2 },
            { label: 'Moderate', value: 3 },
            { label: 'Fast', value: 5 }
        ]
    },
    {
        id: 'q2',
        text: 'How independently does the student solve questions?',
        options: [
            { label: 'Cannot solve', value: 0 },
            { label: 'Needs help', value: 2 },
            { label: 'Partial independence', value: 3 },
            { label: 'Fully independent', value: 5 }
        ]
    },
    {
        id: 'q3',
        text: 'How well does the student correct mistakes?',
        options: [
            { label: 'Repeats mistakes', value: 0 },
            { label: 'Slight improvement', value: 2 },
            { label: 'Learns gradually', value: 3 },
            { label: 'Quickly improves', value: 5 }
        ]
    }
];

const MetricCard = ({ title, deviation, weighted, weight, icon: Icon, explanation, showDevLabel = true, rawValue = null, breakdown = null }) => {
    const isPositive = deviation >= 0;
    return (
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between hover:border-slate-400 transition-all duration-300 shadow-sm h-full relative overflow-hidden">
            <div className="absolute top-0 right-0 w-10 h-10 opacity-[0.03] pointer-events-none transform translate-x-2 -translate-y-2">
                <Icon size={40} className="text-black" />
            </div>
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="text-[9px] font-medium text-slate-400 uppercase tracking-[0.2em]">{title}</h3>
                    <span className="text-[9px] font-medium text-slate-400 opacity-60">{weight}%</span>
                </div>
                <div className="flex items-baseline gap-1.5 mb-1">
                    <div className="text-xl font-medium text-slate-900 tracking-tighter">
                        {isPositive && showDevLabel ? '+' : ''}{deviation}
                        {showDevLabel ? (
                            <span className="text-[8px] ml-0.5 uppercase font-medium text-slate-400">Dev</span>
                        ) : (
                            <span className="text-[8px] ml-0.5 uppercase font-medium text-slate-400">Pts</span>
                        )}
                    </div>
                    {rawValue !== null && (
                        <div className="text-[10px] font-medium text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded ml-auto">
                            {rawValue}{typeof rawValue === 'number' && title === 'Assignment' ? '%' : ''}
                        </div>
                    )}
                </div>

                {breakdown && (
                    <div className="flex flex-col gap-1 mb-3 bg-slate-50/50 p-2 rounded-lg border border-slate-100/50">
                        {Object.entries(breakdown).map(([key, value]) => (
                            <div key={key} className="flex justify-between items-center text-[8px] font-medium uppercase tracking-tight">
                                <span className="text-slate-400">{key}</span>
                                <span className={value >= 0 ? "text-green-600" : "text-red-500"}>
                                    {value >= 0 ? '+' : ''}{value}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {!breakdown && (
                    <div className="flex items-center gap-2 mb-3">
                        <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-slate-900" style={{ width: `${Math.min(100, Math.abs(deviation))}%` }}></div>
                        </div>
                    </div>
                )}
                
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-[7.5px] text-slate-500 font-medium leading-relaxed uppercase tracking-wider">{explanation}</p>
                </div>
            </div>
        </div>
    );
};


export default function StudentAnalysisView({ studentId, onBack, isInline = false }) {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('performance');
    const [error, setError] = useState(null);

    const [isCuriosityModalOpen, setIsCuriosityModalOpen] = useState(false);
    const [curiosityAnswers, setCuriosityAnswers] = useState({});

    const [isLearningSpeedModalOpen, setIsLearningSpeedModalOpen] = useState(false);
    const [learningSpeedAnswers, setLearningSpeedAnswers] = useState({});

    const [potentialForm, setPotentialForm] = useState({
        effort: 50,
        curiosity: 50,
        learningSpeed: 50
    });
    const [savingPotential, setSavingPotential] = useState(false);
    const [teacherProfile, setTeacherProfile] = useState(null);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await teacherService.getTeacherProfile();
                if (res.ok) setTeacherProfile(res.data);
            } catch (e) {
                console.error("Failed to fetch teacher profile", e);
            }
        };
        fetchProfile();
    }, []);

    useEffect(() => {
        const fetchStudentData = async () => {
            if (!studentId) return;
            setLoading(true);
            setError(null);
            try {
                const response = await api.get(`/api/teacher/dashboard/student/${studentId}/performance`);
                if (response.data.ok) {
                    setStats(response.data.data);
                } else {
                    setError(response.data.error || "Failed to fetch data");
                }
            } catch (error) {
                setError(error.message || "Network error");
            } finally {
                setLoading(false);
            }
        };

        fetchStudentData();
    }, [studentId]);

    useEffect(() => {
        if (stats && stats.potentialBreakdown) {
            // curiosity in the form = MCQ score (0-10), NOT the total
            const mcqScore = stats.potentialBreakdown.curiosityMcq ?? 0;
            setPotentialForm({
                effort: stats.potentialBreakdown.effortTotal ?? stats.potentialBreakdown.effort ?? 0,
                curiosity: mcqScore,
                learningSpeed: stats.potentialBreakdown.learningSpeed ?? 0,
                curiosityData: stats.potentialBreakdown.curiosityData || null,
                learningSpeedData: stats.potentialBreakdown.learningSpeedData || null
            });
        } else if (stats) {
            setPotentialForm({ effort: 0, curiosity: 0, learningSpeed: 0, curiosityData: null, learningSpeedData: null });
        }
    }, [stats]);

    const handleOpenCuriosityModal = () => {
        if (potentialForm.curiosityData && potentialForm.curiosityData.answers) {
            setCuriosityAnswers(potentialForm.curiosityData.answers);
        } else {
            setCuriosityAnswers({});
        }
        setIsCuriosityModalOpen(true);
    };

    const handleOpenLearningSpeedModal = () => {
        if (potentialForm.learningSpeedData && potentialForm.learningSpeedData.answers) {
            setLearningSpeedAnswers(potentialForm.learningSpeedData.answers);
        } else {
            setLearningSpeedAnswers({});
        }
        setIsLearningSpeedModalOpen(true);
    };

    const handleCuriosityOptionSelect = (qId, value) => {
        setCuriosityAnswers(prev => ({ ...prev, [qId]: value }));
    };

    const handleLearningSpeedOptionSelect = (qId, value) => {
        setLearningSpeedAnswers(prev => ({ ...prev, [qId]: value }));
    };

    const calculateCuriosityScore = () => {
        let rawTotal = 0;
        Object.values(curiosityAnswers).forEach(val => {
            const v = parseInt(val);
            rawTotal += (v <= 1 ? -1 : v);
        });

        // Scale from raw (0-30 range) to MCQ score (0-10)
        const mcqScore = Math.max(0, Math.min(10, Math.round((Math.max(0, rawTotal) / 30) * 10)));

        setPotentialForm(prev => ({
            ...prev,
            curiosity: mcqScore,
            curiosityData: {
                answers: curiosityAnswers,
                total: rawTotal,
                mcqScore: mcqScore
            }
        }));
        setIsCuriosityModalOpen(false);
    };

    const calculateLearningSpeedScore = () => {
        const correct = stats?.videoStats?.correct || 0;
        const incorrect = stats?.videoStats?.incorrect || 0;
        const totalAttempts = correct + incorrect;
        const videoScore = totalAttempts > 0 ? (correct / totalAttempts) * 25 : 0;

        let teacherScore = 0;
        Object.values(learningSpeedAnswers).forEach(val => { teacherScore += parseInt(val) || 0; });

        const finalScore = videoScore + teacherScore;
        const percentage = Math.round((finalScore / 40) * 100);

        setPotentialForm(prev => ({
            ...prev,
            learningSpeed: percentage,
            learningSpeedData: {
                correct,
                incorrect,
                videoScore: Number(videoScore.toFixed(2)),
                answers: learningSpeedAnswers,
                teacherScore,
                finalScore: Number(finalScore.toFixed(2))
            }
        }));
        setIsLearningSpeedModalOpen(false);
    };



    const handlePotentialSubmit = async (e) => {
        e.preventDefault();
        setSavingPotential(true);
        try {
            const res = await teacherService.updateStudentPotential(studentId, potentialForm);
            if (res.ok) {
                const response = await api.get(`/api/teacher/dashboard/student/${studentId}/performance`);
                if (response.data.ok) setStats(response.data.data);
                toast.success("Potential metrics updated!");
            } else {
                toast.error(res.message || "Failed to update metrics");
            }
        } catch (err) {
            toast.error("Failed to update metrics");
        } finally {
            setSavingPotential(false);
        }
    };

    const renderPerformanceAnalysis = () => {
        if (error) return <div className="text-red-500 text-center p-10">Error: {error}</div>;
        if (!stats) return <div className="text-red-500 text-center p-10">No performance data available.</div>;

        const { exam, assignment, attendance, finalPerformance } = stats;

        // Data for the bar chart — positive = above 50% baseline, negative = below
        const chartData = [
            { name: 'Exam (50%)',       value: exam?.value ?? 0,       max: 50  },
            { name: 'Assignment (30%)', value: assignment?.value ?? 0,  max: 30  },
            { name: 'Attendance (20%)', value: attendance?.value ?? 0,  max: 20  },
        ];

        const CustomTooltip = ({ active, payload }) => {
            if (active && payload && payload.length) {
                const v = payload[0].value;
                return (
                    <div className="bg-slate-900 text-white text-[11px] px-3 py-2 rounded-lg shadow-xl">
                        <p className="font-semibold">{payload[0].payload.name}</p>
                        <p className={v >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {v >= 0 ? '+' : ''}{v} pts
                        </p>
                        <p className="text-slate-400 text-[10px]">Baseline: 0 (50% avg)</p>
                    </div>
                );
            }
            return null;
        };

        return (
            <div className="space-y-5">
                {/* Metric Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <MetricCard
                        title="Exam Marks"
                        deviation={exam?.value ?? 0}
                        weight={50}
                        icon={Calculator}
                        rawValue={exam?.display || '—'}
                        explanation="50% weight. Deviation = (exam% − 50) × 0.5. Above 50% → positive, below → negative. Max ±25 pts."
                    />
                    <MetricCard
                        title="Assignment"
                        deviation={assignment?.value ?? 0}
                        weight={30}
                        icon={Target}
                        rawValue={assignment?.display || '—'}
                        explanation="30% weight. Deviation = sum(each grade − 50) × 0.3. Each assignment graded vs 50% threshold."
                    />
                    <MetricCard
                        title="Attendance"
                        deviation={attendance?.value ?? 0}
                        weight={20}
                        icon={LineChart}
                        rawValue={attendance?.display || '—'}
                        explanation="20% weight. Score = ((present − absent) / total days) × 20. Max ±20 pts."
                    />
                </div>

                {/* Bar Chart — positive/negative visualisation */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Performance Breakdown</h4>
                        <span className="text-[9px] text-slate-400">Baseline = 0 (50% average)</span>
                    </div>
                    <ResponsiveContainer width="100%" height={140}>
                        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30, top: 4, bottom: 4 }}>
                            <XAxis
                                type="number"
                                domain={['auto', 'auto']}
                                tickCount={6}
                                tick={{ fontSize: 9, fill: '#94a3b8' }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                type="category"
                                dataKey="name"
                                tick={{ fontSize: 9, fill: '#64748b' }}
                                axisLine={false}
                                tickLine={false}
                                width={90}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
                            <ReferenceLine x={0} stroke="#cbd5e1" strokeWidth={1.5} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
                                {chartData.map((entry, i) => (
                                    <Cell key={i} fill={entry.value >= 0 ? '#059669' : '#e11d48'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                    <div className="flex gap-4 justify-center mt-1">
                        <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />Positive (above 50% avg)
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
                            <span className="w-2 h-2 rounded-full bg-rose-600 inline-block" />Negative (below 50% avg)
                        </div>
                    </div>
                </div>

                {/* Final Score */}
                <div className="p-4 rounded-xl border border-green-950 bg-green-950 flex justify-between items-center shadow-md">
                    <div>
                        <h3 className="text-xs font-medium text-white leading-none mb-1 uppercase tracking-tight">Final Performance Score</h3>
                        <p className="text-[9px] text-white/50 font-medium">
                            Exam + Assignment + Attendance deviations ({stats.activeSession?.session || '1st Session'})
                        </p>
                    </div>
                    <div className={`text-2xl font-medium tracking-tighter ${(finalPerformance ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {(finalPerformance ?? 0) >= 0 ? '+' : ''}{Math.round(finalPerformance ?? 0)}
                    </div>
                </div>
            </div>
        );
    };

    const renderPotentialAnalysis = () => {
        if (!stats) return null;
        const potentialBreakdown = stats.potentialBreakdown || { effort: 0, curiosity: 0, learningSpeed: 0 };
        const isTeacher = currentUser?.role?.toUpperCase() === 'TEACHER' || currentUser?.role?.toUpperCase() === 'ADMIN';
        const isSessionDone = stats?.activeSession?.isDone;
        const isClassHead = teacherProfile?.classHead?.id === stats?.student?.classId;
        // Allow editing even if session is 'done' based on user request to "not lock this"
        const canEdit = isTeacher && isClassHead;        // Use raw scores directly from backend
        const effortVal = stats.potential?.effort?.value || 0;
        const curiosityVal = stats.potential?.curiosity?.value || 0;
        const learningSpeedVal = stats.potential?.learningSpeed?.value || 0;
        const totalPotential = stats.potential?.total || 0;

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <MetricCard
                        title="Effort"
                        deviation={effortVal}
                        weighted={effortVal}
                        weight="40"
                        icon={Zap}
                        showDevLabel={false}
                        rawValue={stats.potential?.effort?.display || "0 / 40"}
                        breakdown={stats.potential?.effortBreakdown}
                        explanation="Assignment submission (20 pts): ((onTime − late − missed) / total) × 20. Timely materials (20 pts): ((onTimeWatched − lateWatched) / total) × 20."
                    />
                    <MetricCard
                        title="Curiosity"
                        deviation={curiosityVal}
                        weighted={curiosityVal}
                        weight="40"
                        icon={Target}
                        rawValue={stats.potential?.curiosity?.display || "0 / 40"}
                        showDevLabel={false}
                        explanation="Quiz questions solved (30 pts): ((solved − notSolved) / total) × 30. Teacher MCQ evaluation (10 pts): manual 0–10."
                    />
                    <MetricCard
                        title="Learning Speed"
                        deviation={learningSpeedVal}
                        weighted={learningSpeedVal}
                        weight="20"
                        icon={TrendingUp}
                        rawValue={stats.potential?.learningSpeed?.display || "0 / 20"}
                        showDevLabel={false}
                        explanation="Quiz accuracy: ((correct − incorrect − missed) / total questions) × 20. Max ±20 pts."
                    />
                </div>

                {/* Assignment effort breakdown — on-time / late / missed */}
                {stats.potentialBreakdown?.totalAssign > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                        <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">Assignment Submission Breakdown</h4>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="flex flex-col items-center gap-1.5 bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                                <CheckCircle size={16} className="text-emerald-600" />
                                <span className="text-xl font-semibold text-emerald-700">{stats.potentialBreakdown.onTime ?? 0}</span>
                                <span className="text-[9px] font-medium text-emerald-600 uppercase tracking-wide">On Time</span>
                            </div>
                            <div className="flex flex-col items-center gap-1.5 bg-amber-50 rounded-lg p-3 border border-amber-100">
                                <Clock size={16} className="text-amber-600" />
                                <span className="text-xl font-semibold text-amber-700">{stats.potentialBreakdown.late ?? 0}</span>
                                <span className="text-[9px] font-medium text-amber-600 uppercase tracking-wide">Late Submit</span>
                            </div>
                            <div className="flex flex-col items-center gap-1.5 bg-rose-50 rounded-lg p-3 border border-rose-100">
                                <AlertCircle size={16} className="text-rose-600" />
                                <span className="text-xl font-semibold text-rose-700">{stats.potentialBreakdown.missed ?? 0}</span>
                                <span className="text-[9px] font-medium text-rose-600 uppercase tracking-wide">Missed</span>
                            </div>
                        </div>
                        <p className="text-[9px] text-slate-400 mt-2 text-center">
                            Out of {stats.potentialBreakdown.totalAssign} assignment(s) &nbsp;|&nbsp; Score = ((onTime − late − missed) / total) × 20
                        </p>
                    </div>
                )}


                {/* Edit Section (Only for Class Head) */}
                {canEdit && (
                    <div className="bg-[#fcfaf7] p-4 rounded-xl border border-slate-200 mt-2">
                        <h4 className="text-[10px] font-medium text-indigo-500 uppercase tracking-widest mb-4">Manual Evaluation & Adjustments</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Curiosity Edit */}
                            <div className="bg-white p-3 rounded-lg border border-slate-100 flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-tighter">MCQ Score (0–10)</span>
                                    <span className="text-sm font-medium text-indigo-600">{potentialForm.curiosity} / 10</span>
                                </div>
                                <button 
                                    onClick={handleOpenCuriosityModal}
                                    className="w-full flex justify-between items-center px-3 py-2 border border-cyan-200 bg-cyan-50 rounded-lg hover:bg-cyan-100 transition-colors"
                                >
                                    <span className="text-xs font-semibold text-cyan-700">
                                        {potentialForm.curiosityData ? `Score: ${potentialForm.curiosityData.mcqScore ?? potentialForm.curiosity}/10` : "Run MCQ Evaluator"}
                                    </span>
                                    <Calculator size={14} className="text-cyan-600" />
                                </button>
                                <button
                                    onClick={handlePotentialSubmit}
                                    disabled={savingPotential}
                                    className="w-full bg-slate-900 text-white text-[10px] font-medium py-2 rounded-lg hover:bg-black transition-all uppercase tracking-widest"
                                >
                                    Save curiosity
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="p-4 rounded-xl border border-green-950 bg-green-950 flex justify-between items-center shadow-md">
                    <div>
                        <h3 className="text-xs font-medium text-white leading-none mb-1 uppercase tracking-tight">Final Potential (Y-Axis)</h3>
                        <p className="text-[9px] text-white/50 font-medium tracking-wide">Total Potential Score based on raw student engagement ({stats.activeSession?.session})</p>
                    </div>
                    <div className="text-2xl font-medium tracking-tighter text-white">
                        {stats.percentage.potentialAvg >= 0 ? '+' : ''}{Math.round(stats.percentage.potentialAvg || 0)}
                    </div>
                </div>

            </div>
        );
    };

    if (loading) return <div className="p-10 text-center text-slate-400">Loading analysis...</div>;

    return (
        <div className={`bg-[#fffdfa] rounded-2xl ${isInline ? '' : 'shadow-sm border border-slate-200'} p-5`}>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base font-medium text-slate-800 leading-none">Analysis</h1>
                            {stats?.activeSession && (
                                <div className="flex gap-2 items-center">
                                    <span className={`px-2 py-0.5 ${stats.activeSession.isDone ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700'} text-[11px] font-medium rounded-full uppercase`}>
                                        {stats.activeSession.session}
                                    </span>
                                </div>
                            )}
                        </div>
                        <p className="text-sm text-slate-500 mt-1">
                            For <span className="font-medium text-slate-700">{stats?.student.name}</span>
                        </p>
                    </div>
                </div>
                {!isInline && (
                    <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-[11px] font-medium">
                        <Printer size={12} /> Print
                    </button>
                )}
            </div>

            <div className="flex border-b border-slate-100 mb-6">
                <button
                    onClick={() => setActiveTab('performance')}
                    className={`pb-2.5 px-4 text-sm font-medium transition-all relative ${activeTab === 'performance' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400'}`}
                >
                    Performance
                </button>
                <button
                    onClick={() => setActiveTab('potential')}
                    className={`pb-2.5 px-4 text-sm font-medium transition-all relative ${activeTab === 'potential' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400'}`}
                >
                    Potential
                </button>
            </div>

            <div className="min-h-[200px]">
                {activeTab === 'performance' ? (
                    <>
                        {renderPerformanceAnalysis()}
                    </>
                ) : renderPotentialAnalysis()}
            </div>

            {isCuriosityModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
                            <div>
                                <h2 className="text-lg font-medium text-slate-800 flex items-center gap-2">
                                    <Calculator className="text-cyan-600" size={20} />
                                    Curiosity Evaluator
                                </h2>
                                <p className="text-[11px] text-slate-500 mt-0.5">Select the most accurate description for each trait.</p>
                            </div>
                            <button onClick={() => setIsCuriosityModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                            {CURIOSITY_QUESTIONS.map((q, idx) => (
                                <div key={q.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                    <h3 className="text-sm font-medium text-slate-800 mb-2 flex gap-2">
                                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center text-[10px] font-medium">{idx + 1}</span>
                                        {q.text}
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-7">
                                        {q.options.map(opt => (
                                            <label 
                                                key={opt.label} 
                                                className={`flex items-center gap-2 p-2 rounded-lg border-2 cursor-pointer transition-all ${curiosityAnswers[q.id] === opt.value ? 'border-cyan-500 bg-cyan-50' : 'border-slate-100 hover:border-slate-200'}`}
                                            >
                                                <input
                                                    type="radio"
                                                    name={q.id}
                                                    value={opt.value}
                                                    checked={curiosityAnswers[q.id] === opt.value}
                                                    onChange={() => handleCuriosityOptionSelect(q.id, opt.value)}
                                                    className="w-4 h-4 text-cyan-600 border-slate-300 focus:ring-cyan-500"
                                                />
                                                <div className="flex-1 flex justify-between items-center">
                                                    <span className={`text-[11px] font-medium ${curiosityAnswers[q.id] === opt.value ? 'text-cyan-900' : 'text-slate-700'}`}>{opt.label}</span>
                                                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${curiosityAnswers[q.id] === opt.value ? 'bg-cyan-200 text-cyan-800' : 'bg-slate-100 text-slate-500'}`}>
                                                        {opt.value <= 1 ? '-1' : opt.value} pt
                                                    </span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-4 border-t border-slate-200 bg-white flex justify-between items-center sticky bottom-0">
                            <div className="flex items-center gap-3">
                                <div className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Total Score</div>
                                <div className="text-2xl font-medium text-cyan-600 tracking-tighter">
                                    {Object.values(curiosityAnswers).reduce((acc, val) => {
                                        const v = parseInt(val);
                                        return acc + (v <= 1 ? -1 : v);
                                    }, 0)}<span className="text-lg text-slate-400 font-medium">/10</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setIsCuriosityModalOpen(false)} className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                                    Cancel
                                </button>
                                <button 
                                    onClick={calculateCuriosityScore}
                                    disabled={Object.keys(curiosityAnswers).length < 6}
                                    className="px-5 py-2 rounded-lg text-xs font-medium text-white bg-green-950 hover:bg-green-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-950/20"
                                >
                                    Save Evaluation
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {isLearningSpeedModalOpen && (() => {
                const correct = stats?.videoStats?.correct || 0;
                const incorrect = stats?.videoStats?.incorrect || 0;
                const totalAttempts = correct + incorrect;
                const videoScore = totalAttempts > 0 ? (correct / totalAttempts) * 25 : 0;
                const teacherScore = Object.values(learningSpeedAnswers).reduce((a, b) => a + (parseInt(b) || 0), 0);
                const combinedScore = videoScore + teacherScore;
                
                let classification = "Slow";
                let badgeColor = "bg-rose-100 text-rose-700";
                if (combinedScore >= 28) { classification = "Fast"; badgeColor = "bg-emerald-100 text-emerald-700"; }
                else if (combinedScore >= 14) { classification = "متوسط (Average)"; badgeColor = "bg-amber-100 text-amber-700"; }

                return (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
                            <div>
                                <h2 className="text-xl font-medium text-slate-800 flex items-center gap-2">
                                    <Calculator className="text-rose-600" size={24} />
                                    Learning Speed Evaluator
                                </h2>
                                <p className="text-sm text-slate-500 mt-1">Video System Score combined with Teacher Assessment.</p>
                            </div>
                            <button onClick={() => setIsLearningSpeedModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
                            <div className="bg-white p-5 rounded-xl border border-rose-100 shadow-sm">
                                <h3 className="font-medium text-slate-800 mb-2 flex items-center justify-between">
                                    <span>Section 1: Automatic Video Performance</span>
                                    <span className="text-rose-600 font-medium">{videoScore.toFixed(2)} / 25</span>
                                </h3>
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div className="bg-slate-50 p-3 rounded-lg flex justify-between items-center border border-slate-100">
                                        <span className="text-sm font-medium text-slate-600">Correct Answers</span>
                                        <span className="text-lg font-medium text-emerald-600">{correct}</span>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-lg flex justify-between items-center border border-slate-100">
                                        <span className="text-sm font-medium text-slate-600">Incorrect Answers</span>
                                        <span className="text-lg font-medium text-rose-600">{incorrect}</span>
                                    </div>
                                </div>
                            </div>

                            {LEARNING_SPEED_QUESTIONS.map((q, idx) => (
                                <div key={q.id} className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                                    <h3 className="font-medium text-slate-800 mb-3 flex gap-3">
                                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-sm font-medium">{idx + 1}</span>
                                        {q.text}
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-9">
                                        {q.options.map(opt => (
                                            <label 
                                                key={opt.label} 
                                                className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${learningSpeedAnswers[q.id] === opt.value ? 'border-rose-500 bg-rose-50' : 'border-slate-100 hover:border-slate-200'}`}
                                            >
                                                <input
                                                    type="radio"
                                                    name={q.id}
                                                    value={opt.value}
                                                    checked={learningSpeedAnswers[q.id] === opt.value}
                                                    onChange={() => handleLearningSpeedOptionSelect(q.id, opt.value)}
                                                    className="w-4 h-4 text-rose-600 border-slate-300 focus:ring-rose-500"
                                                />
                                                <div className="flex-1 flex justify-between items-center">
                                                    <span className={`text-sm font-medium ${learningSpeedAnswers[q.id] === opt.value ? 'text-rose-900' : 'text-slate-700'}`}>{opt.label}</span>
                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${learningSpeedAnswers[q.id] === opt.value ? 'bg-rose-200 text-rose-800' : 'bg-slate-100 text-slate-500'}`}>{opt.value} pt</span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-5 border-t border-slate-200 bg-white flex justify-between items-center sticky bottom-0">
                            <div className="flex flex-col gap-1">
                                <div className="text-xs font-medium text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    Final Score <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase ${badgeColor}`}>{classification}</span>
                                </div>
                                <div className="text-3xl font-medium text-rose-600 tracking-tighter">
                                    {combinedScore.toFixed(2)}<span className="text-lg text-slate-400 font-medium">/40</span>
                                </div>
                            </div>
                            <div className="flex gap-3 items-center">
                                <span className="text-xs font-medium text-slate-400 mr-2">Teacher: +{teacherScore}/15</span>
                                <button onClick={() => setIsLearningSpeedModalOpen(false)} className="px-5 py-2.5 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors">
                                    Cancel
                                </button>
                                <button 
                                    onClick={calculateLearningSpeedScore}
                                    disabled={Object.keys(learningSpeedAnswers).length < 3}
                                    className="px-6 py-2.5 rounded-xl font-medium text-white bg-green-950 hover:bg-green-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-950/20"
                                >
                                    Save Evaluation
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                );
            })()}
        </div>
    );
}
