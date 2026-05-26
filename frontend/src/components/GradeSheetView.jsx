import React from 'react';
import { CheckCircle, XCircle, Clock, Award, GraduationCap } from 'lucide-react';

/* Nepal NEB Grade Scale */
const NEPAL_GRADES = [
    { grade: 'A+', gpa: 4.0, min: 90, max: 100, description: 'Outstanding' },
    { grade: 'A',  gpa: 3.6, min: 80, max: 89,  description: 'Excellent' },
    { grade: 'B+', gpa: 3.2, min: 70, max: 79,  description: 'Very Good' },
    { grade: 'B',  gpa: 2.8, min: 60, max: 69,  description: 'Good' },
    { grade: 'C+', gpa: 2.4, min: 50, max: 59,  description: 'Satisfactory' },
    { grade: 'C',  gpa: 2.0, min: 40, max: 49,  description: 'Acceptable' },
    { grade: 'D+', gpa: 1.6, min: 30, max: 39,  description: 'Partially Acceptable' },
    { grade: 'D',  gpa: 1.2, min: 20, max: 29,  description: 'Insufficient' },
    { grade: 'E',  gpa: 0.8, min: 1,  max: 19,  description: 'Very Insufficient' },
    { grade: 'N',  gpa: 0.0, min: 0,  max: 0,   description: 'Not Graded' },
];

function getNepalGrade(percentage) {
    if (!percentage || percentage <= 0) return { grade: 'N', gpa: 0.0, description: 'Not Graded' };
    for (const g of NEPAL_GRADES) {
        if (percentage >= g.min && percentage <= g.max) return g;
    }
    return { grade: 'N', gpa: 0.0, description: 'Not Graded' };
}

function gradeColor(grade) {
    switch (grade) {
        case 'A+': case 'A': return 'text-emerald-600';
        case 'B+': case 'B': return 'text-blue-600';
        case 'C+': case 'C': return 'text-amber-600';
        case 'D+': case 'D': return 'text-orange-500';
        case 'E': return 'text-red-500';
        default: return 'text-slate-400';
    }
}

/**
 * Shared grade-sheet display used in both Parent and Student dashboards.
 * Props:
 *   data  — grade sheet object from API (student, school, terminal, marks, totalObtained, totalFull, percentage, overallStatus)
 */
export default function GradeSheetView({ data }) {
    if (!data) return null;
    const { student, school, terminal, marks, totalObtained, totalFull, percentage, overallStatus } = data;
    const pass = overallStatus === 'PASS';
    const pct = parseFloat(percentage);

    const overall = getNepalGrade(pct);
    const grade = overall.grade;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden font-inter shadow-sm">

            {/* School Header */}
            <div className="bg-[#052e16] px-6 py-5 text-white">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div>
                            <h2 className="text-[15px] font-bold tracking-tight leading-tight">{school?.name || 'School Space'}</h2>
                            {school?.address && <p className="text-[10px] text-white/60 mt-0.5">{school.address}</p>}
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-[9px] text-white/50 uppercase tracking-widest block">Terminal</span>
                        <span className="text-[13px] font-bold text-white">{terminal}</span>
                    </div>
                </div>
            </div>

            {/* Student Info Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-100">
                {[
                    { label: 'Student Name', value: student?.name },
                    { label: 'Class', value: student?.className && student?.section ? `${student.className} — ${student.section}` : '—' },
                    { label: 'Roll No.', value: student?.rollNo || '—' },
                    { label: 'Student Code', value: student?.studentCode || '—' },
                ].map(item => (
                    <div key={item.label} className="bg-white px-4 py-3">
                        <p className="text-[9px] text-slate-400 uppercase tracking-widest font-medium">{item.label}</p>
                        <p className="text-[13px] font-semibold text-slate-800 mt-0.5 truncate">{item.value}</p>
                    </div>
                ))}
            </div>

            {/* Marks Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px] border-collapse">
                    <thead>
                        <tr className="bg-white border-b border-slate-200">
                            <th className="px-5 py-3 text-[9px] font-medium text-slate-400 uppercase tracking-widest">Subject</th>
                            <th className="px-3 py-3 text-[9px] font-medium text-slate-400 uppercase tracking-widest text-center">Theory</th>
                            <th className="px-3 py-3 text-[9px] font-medium text-slate-400 uppercase tracking-widest text-center">Practical</th>
                            <th className="px-3 py-3 text-[9px] font-medium text-slate-400 uppercase tracking-widest text-center">Total</th>
                            <th className="px-3 py-3 text-[9px] font-medium text-slate-400 uppercase tracking-widest text-center">Full Marks</th>
                            <th className="px-3 py-3 text-[9px] font-medium text-slate-400 uppercase tracking-widest text-center">Pass Marks</th>
                            <th className="px-3 py-3 text-[9px] font-medium text-slate-400 uppercase tracking-widest text-center">%</th>
                            <th className="px-3 py-3 text-[9px] font-medium text-slate-400 uppercase tracking-widest text-center">Grade</th>
                            <th className="px-3 py-3 text-[9px] font-medium text-slate-400 uppercase tracking-widest text-center">GPA</th>
                            <th className="px-3 py-3 text-[9px] font-medium text-slate-400 uppercase tracking-widest text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {marks && marks.length > 0 ? marks.map((m, i) => {
                            const subPct = m.full > 0 ? Math.round((m.total / m.full) * 100) : 0;
                            return (
                                <tr key={i} className="transition-colors bg-white hover:bg-slate-50/40">
                                    <td className="px-5 py-3 font-medium text-slate-800">{m.subject}</td>
                                    <td className="px-3 py-3 text-center text-slate-600">
                                        {m.theory != null ? <><span className="font-medium">{m.theory}</span><span className="text-slate-300">/{m.theoryfull || '—'}</span></> : '—'}
                                    </td>
                                    <td className="px-3 py-3 text-center text-slate-600">
                                        {m.practical != null ? <><span className="font-medium">{m.practical}</span><span className="text-slate-300">/{m.practicalfull || '—'}</span></> : '—'}
                                    </td>
                                    <td className="px-3 py-3 text-center font-bold text-slate-800">{m.total}</td>
                                    <td className="px-3 py-3 text-center text-slate-500">{m.full}</td>
                                    <td className="px-3 py-3 text-center text-slate-400">{m.pass}</td>
                                    <td className="px-3 py-3 text-center">
                                        <span className={`text-[11px] font-semibold ${subPct >= 60 ? 'text-emerald-600' : subPct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{subPct}%</span>
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                        <span className={`text-[11px] font-bold ${gradeColor(getNepalGrade(subPct).grade)}`}>{getNepalGrade(subPct).grade}</span>
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                        <span className="text-[11px] font-medium text-slate-600">{getNepalGrade(subPct).gpa.toFixed(1)}</span>
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-normal uppercase tracking-wider text-white ${m.status === 'PASSED' ? 'bg-green-950' : 'bg-red-900'}`}>
                                            {m.status === 'PASSED' ? 'Pass' : 'Fail'}
                                        </span>
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan={10} className="px-5 py-10 text-center text-slate-400 italic text-[12px]">No marks available for this terminal.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Summary Footer */}
            <div className="border-t border-slate-100 px-5 py-4 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                        <div>
                            <p className="text-[9px] text-slate-400 uppercase tracking-widest font-medium">Total Obtained</p>
                            <p className="text-[18px] font-bold text-slate-900 leading-tight">{totalObtained} <span className="text-[12px] font-normal text-slate-400">/ {totalFull}</span></p>
                        </div>
                        <div>
                            <p className="text-[9px] text-slate-400 uppercase tracking-widest font-medium">Percentage</p>
                            <p className={`text-[18px] font-bold leading-tight ${gradeColor(grade)}`}>{percentage}%</p>
                        </div>
                        <div>
                            <p className="text-[9px] text-slate-400 uppercase tracking-widest font-medium">Grade</p>
                            <p className={`text-[18px] font-bold leading-tight ${gradeColor(grade)}`}>{grade}</p>
                        </div>
                        <div>
                            <p className="text-[9px] text-slate-400 uppercase tracking-widest font-medium">GPA</p>
                            <p className={`text-[18px] font-bold leading-tight ${gradeColor(grade)}`}>{overall.gpa.toFixed(1)}</p>
                        </div>
                    </div>
                    <div className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl border ${
                        overallStatus === 'PASS'
                            ? 'bg-emerald-50 border-emerald-200'
                            : overallStatus === 'PENDING'
                                ? 'bg-amber-50 border-amber-200'
                                : 'bg-red-50 border-red-200'
                    }`}>
                        {overallStatus === 'PASS' ? (
                            <CheckCircle size={20} className="text-emerald-600" />
                        ) : overallStatus === 'PENDING' ? (
                            <Clock size={20} className="text-amber-500" />
                        ) : (
                            <XCircle size={20} className="text-red-500" />
                        )}
                        <div>
                            <p className={`text-[9px] uppercase tracking-widest font-medium ${
                                overallStatus === 'PASS'
                                    ? 'text-emerald-500'
                                    : overallStatus === 'PENDING'
                                        ? 'text-amber-500'
                                        : 'text-red-400'
                            }`}>Overall Result</p>
                            <p className={`text-[16px] font-black leading-tight ${
                                overallStatus === 'PASS'
                                    ? 'text-emerald-700'
                                    : overallStatus === 'PENDING'
                                        ? 'text-amber-700'
                                        : 'text-red-600'
                            }`}>{overallStatus}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Nepal NEB Grade Legend */}
            <div className="border-t border-slate-100 px-5 py-3 bg-white">
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-medium mb-2">Nepal NEB Grade Scale</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {NEPAL_GRADES.filter(g => g.grade !== 'N').map(g => (
                        <span key={g.grade} className="text-[10px] text-slate-500">
                            <span className={`font-bold ${gradeColor(g.grade)}`}>{g.grade}</span>
                            <span className="text-slate-300 mx-0.5">·</span>
                            {g.min}–{g.max}%
                            <span className="text-slate-300 mx-0.5">·</span>
                            GPA {g.gpa.toFixed(1)}
                        </span>
                    ))}
                </div>
            </div>

        </div>
    );
}
