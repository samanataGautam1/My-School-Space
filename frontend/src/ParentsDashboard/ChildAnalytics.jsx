import React, { useState } from 'react';
import { TrendingUp, Target, BarChart2, Info, FileText, Download, LineChart } from 'lucide-react';

export function PerformancePotentialPlot({ currentData }) {
    if (!currentData) return null;

    const perfVal = typeof currentData.performance === 'number' ? currentData.performance : (currentData.finalPerformance || 0);
    const potVal = typeof currentData.potential === 'number' ? currentData.potential : (currentData.finalY || 0);
    
    // Coordinate scaling to match TeacherDashboard precisely (Y: -100 to +100, X: -100 to +100)
    // and utilizing padding to prevent dot clipping
    const pad = 4;
    const range = 100 - pad * 2;
    const getPosX = (val) => pad + ((val + 100) / 200) * range;
    const getPosY = (val) => pad + ((val + 100) / 200) * range;
    const getPos = getPosX; // backward compat for X

    // Quadrant thresholds: split exactly at X=0, Y=0
    const quadrant = perfVal >= 0 && potVal >= 0 ? 'star' : perfVal < 0 && potVal >= 0 ? 'learner' : perfVal >= 0 && potVal < 0 ? 'coasting' : 'support';
    const quadrantInfo = {
        star: { label: 'Star Performer', color: 'text-emerald-700', bg: 'bg-emerald-50', desc: 'Your child is performing well and shows strong potential. Keep encouraging their efforts!' },
        learner: { label: 'Rising Star', color: 'text-blue-700', bg: 'bg-blue-50', desc: 'Your child has great potential but exam scores need improvement. Consider focused revision and practice.' },
        coasting: { label: 'Coasting', color: 'text-amber-700', bg: 'bg-amber-50', desc: 'Good exam results but potential indicators suggest more engagement needed. Encourage participation in class activities.' },
        support: { label: 'Needs Support', color: 'text-red-700', bg: 'bg-red-50', desc: 'Your child may need additional academic support. Consider speaking with their class teacher for guidance.' }
    }[quadrant];

    return (
        <div className="space-y-4">
            <div className="relative w-full bg-white rounded-xl border border-slate-200 shadow-sm" style={{ height: '420px' }}>
                {/* Y-axis label */}
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 -rotate-90 text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ transformOrigin: 'center center' }}>
                    Potential (-100 to +100)
                </div>

                {/* Plot inner (leave room for axis labels + dot overflow) */}
                <div className="absolute left-12 right-8 top-6 bottom-12 overflow-visible">
                    {/* ── Quadrant backgrounds (split at X=0, Y=0) ── */}
                    {(() => {
                        const qPad = 4, qRange = 100 - qPad * 2;
                        const xMid = `${qPad + (100 / 200) * qRange}%`;  // X=0
                        const yMid = `${100 - (qPad + (100 / 200) * qRange)}%`; // Y=0 from top
                        return (
                            <>
                                <div className="absolute bg-green-50/70 rounded-tr-lg" style={{ top: 0, bottom: yMid, left: xMid, right: 0 }} />
                                <div className="absolute bg-green-200/50 rounded-tl-lg" style={{ top: 0, bottom: yMid, left: 0, right: `calc(100% - ${xMid})` }} />
                                <div className="absolute bg-green-700/25 rounded-br-lg" style={{ top: yMid, bottom: 0, left: xMid, right: 0 }} />
                                <div className="absolute bg-green-900/25 rounded-bl-lg" style={{ top: yMid, bottom: 0, left: 0, right: `calc(100% - ${xMid})` }} />
                            </>
                        );
                    })()}

                    {/* ── Grid lines (padded to match dot positions) ── */}
                    {(() => {
                        const gPad = 4, gRange = 100 - gPad * 2;
                        const gx = (v) => gPad + ((v + 100) / 200) * gRange;
                        const gy = (v) => gPad + ((v + 100) / 200) * gRange;
                        return (
                            <>
                                {/* Vertical (X-axis): -100 to +100 */}
                                {[-100,-75,-50,-25,0,25,50,75,100].map(v => (
                                    <div key={`vg-${v}`} className="absolute top-0 bottom-0" style={{ left: `${gx(v)}%`, backgroundColor: v === 0 ? '#0f172a' : '#475569', width: v === 0 ? '1.5px' : '1px', opacity: v === 0 ? 1 : 0.4 }} />
                                ))}
                                {/* Horizontal (Y-axis): -100 to +100 at key values */}
                                {[-100,-75,-50,-25,0,25,50,75,100].map(v => (
                                    <div key={`hg-${v}`} className="absolute left-0 right-0" style={{ bottom: `${gy(v)}%`, backgroundColor: v === 0 ? '#0f172a' : '#475569', height: v === 0 ? '1.5px' : '1px', opacity: v === 0 ? 1 : 0.4 }} />
                                ))}
                            </>
                        );
                    })()}

                    {/* ── Quadrant corner labels ── */}
                    <div className="absolute top-1.5 right-1.5 text-[7px] font-semibold text-green-950 bg-green-50 border border-white px-1.5 py-0.5 rounded-full z-10">Star Performers</div>
                    <div className="absolute top-1.5 left-1.5 text-[7px] font-semibold text-green-950 bg-green-200 border border-white px-1.5 py-0.5 rounded-full z-10">Rising Stars</div>
                    <div className="absolute bottom-1.5 right-1.5 text-[7px] font-semibold text-white bg-green-500 border border-white px-1.5 py-0.5 rounded-full z-10">Coasting</div>
                    <div className="absolute bottom-1.5 left-1.5 text-[7px] font-semibold text-white bg-green-700 border border-white px-1.5 py-0.5 rounded-full z-10">Needs Support</div>

                    {/* ── Child student dot ── */}
                    {(() => {
                        const lx = getPosX(perfVal);
                        const ly = getPosY(potVal);
                        const dotColor = quadrant === 'star' ? 'bg-emerald-600 ring-emerald-200'
                            : quadrant === 'learner' ? 'bg-blue-600 ring-blue-200'
                            : quadrant === 'coasting' ? 'bg-amber-500 ring-amber-200'
                            : 'bg-rose-600 ring-rose-200';
                            
                        const initials = currentData.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

                        return (
                            <div
                                className={`absolute w-8 h-8 ${dotColor} rounded-full ring-2 ring-offset-1 border-2 border-white shadow-md cursor-pointer hover:scale-110 hover:z-50 transition-all duration-200 group/dot flex items-center justify-center -translate-x-1/2 translate-y-1/2 z-30`}
                                style={{ left: `${lx}%`, bottom: `${ly}%` }}
                            >
                                <span className="text-[9px] font-black text-white select-none pointer-events-none leading-none">{initials}</span>
                                
                                {/* Hover Pulse Effect */}
                                <div className="absolute inset-0 rounded-full animate-ping bg-white/20 -z-10 group-hover:bg-white/40" />

                                {/* Detailed dark popover tooltip */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 bg-slate-900 text-white text-[9px] rounded-xl opacity-0 group-hover/dot:opacity-100 transition-all duration-200 whitespace-nowrap z-[70] pointer-events-none shadow-2xl border border-white/10 min-w-[160px] overflow-hidden">
                                    <div className="px-3 py-2 border-b border-white/10 flex justify-between items-center gap-4">
                                        <span className="font-bold text-[10px]">{currentData.name}</span>
                                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${quadrant === 'star' ? 'bg-emerald-500/30 text-emerald-300' : quadrant === 'learner' ? 'bg-blue-500/30 text-blue-300' : quadrant === 'coasting' ? 'bg-amber-500/30 text-amber-300' : 'bg-rose-500/30 text-rose-300'}`}>
                                            {quadrantInfo.label}
                                        </span>
                                    </div>
                                    <div className="px-3 py-1.5 grid grid-cols-2 gap-2">
                                        <div>
                                            <div className="text-[7px] text-slate-400 uppercase tracking-wider">Performance</div>
                                            <div className={`text-[10px] font-black ${perfVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {perfVal >= 0 ? '+' : ''}{perfVal.toFixed(1)}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[7px] text-slate-400 uppercase tracking-wider">Potential</div>
                                            <div className="text-[10px] font-black text-indigo-400">
                                                {potVal >= 0 ? '+' : ''}{potVal.toFixed(1)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45 -mt-1 border-r border-b border-white/10" />
                                </div>
                            </div>
                        );
                    })()}

                    {/* ── X-axis ticks (padded) ── */}
                    {[-100,-75,-50,-25,0,25,50,75,100].map(v => {
                        const axPad = 4, axRange = 100 - axPad * 2;
                        return (
                            <span key={`xl-${v}`} className={`absolute -bottom-6 text-[8px] font-semibold ${v === 0 ? 'text-slate-600' : 'text-slate-400'}`} style={{ left: `${axPad + ((v+100)/200)*axRange}%`, transform: 'translateX(-50%)' }}>
                                {v > 0 ? `+${v}` : v}
                            </span>
                        );
                    })}

                    {/* ── Y-axis ticks (-100 to +100, padded) ── */}
                    {[-100,-75,-50,-25,0,25,50,75,100].map(v => {
                        const ayPad = 4, ayRange = 100 - ayPad * 2;
                        return (
                            <span key={`yl-${v}`} className={`absolute -left-10 text-[8px] font-semibold ${v === 0 ? 'text-slate-600' : 'text-slate-400'}`} style={{ bottom: `${ayPad + ((v+100)/200)*ayRange}%`, transform: 'translateY(50%)' }}>
                                {v > 0 ? `+${v}` : v}
                            </span>
                        );
                    })}
                </div>

                {/* X-axis title */}
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    ← Below avg · Performance (0 = neutral) · Above avg →
                </div>
            </div>

            {/* Parent-friendly Insight Card */}
            <div className={`${quadrantInfo.bg} rounded-xl p-4 border ${quadrant === 'star' ? 'border-emerald-200' : quadrant === 'learner' ? 'border-blue-200' : quadrant === 'coasting' ? 'border-amber-200' : 'border-red-200'}`}>
                <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg ${quadrant === 'star' ? 'bg-emerald-200' : quadrant === 'learner' ? 'bg-blue-200' : quadrant === 'coasting' ? 'bg-amber-200' : 'bg-red-200'} flex items-center justify-center shrink-0`}>
                        <span className="text-[10px] font-black">{quadrant === 'star' ? 'A+' : quadrant === 'learner' ? 'B+' : quadrant === 'coasting' ? 'B' : 'C'}</span>
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between">
                            <p className={`text-[12px] font-bold ${quadrantInfo.color}`}>{quadrantInfo.label}</p>
                            <div className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${currentData.status === 'PENDING_TEACHER_REVIEW' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {currentData.status === 'PENDING_TEACHER_REVIEW' ? 'Pending Finalization' : 'Finalized'}
                            </div>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{quadrantInfo.desc}</p>
                        <div className="flex gap-4 mt-2 text-[10px]">
                            <span className="text-slate-500">Performance: <strong className="text-slate-800">{perfVal >= 0 ? '+' : ''}{perfVal.toFixed(1)}</strong></span>
                            <span className="text-slate-500">Potential: <strong className="text-slate-800">{potVal >= 0 ? '+' : ''}{potVal.toFixed(1)}</strong></span>
                        </div>
                    </div>
                </div>
            </div>

            {/* What these scores mean */}
            <div className="grid grid-cols-2 gap-3 text-[10px]">
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <p className="font-bold text-slate-700 mb-1">Performance Score</p>
                    <p className="text-slate-500 leading-relaxed">Based on exam results (50%), assignment completion (30%), and attendance (20%). Range: -100 to +100. Positive = above class average.</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <p className="font-bold text-slate-700 mb-1">Potential Score</p>
                    <p className="text-slate-500 leading-relaxed">Based on effort & engagement (40%), curiosity in learning (40%), and learning speed (20%). Range: -100 to +100. Positive = above class average.</p>
                </div>
            </div>
        </div>
    );
}


export default function ChildAnalytics({ performanceData, hideHeader = false, mode = 'all' }) {
    const [selectedChild, setSelectedChild] = useState(performanceData[0]?.studentId || null);

    if (performanceData.length === 0) {
        return (
            <div className={`bg-white rounded-3xl p-16 text-center border border-dashed border-slate-200 ${hideHeader ? 'py-8' : ''}`}>
                <BarChart2 className="mx-auto h-16 w-16 text-slate-200 mb-6" />
                <p className="text-slate-400 font-bold tracking-tight">No analytics data available for this session.</p>
            </div>
        );
    }

    const currentData = performanceData.find(d => d.studentId === selectedChild) || performanceData[0];

    // Independent rendering modes
    if (mode === 'scatter') return <PerformancePotentialPlot currentData={currentData} />;

    return (
        <div className={`space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-700 ${hideHeader ? 'space-y-0' : ''}`}>
            {/* Header & Child Selector */}
            {!hideHeader && (
                <div className="flex flex-col md:flex-row justify-between items-center gap-2 bg-white/40 backdrop-blur-xl p-3 rounded-xl border border-white/40 shadow-lg shadow-slate-200/40">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Academic Insights</h2>
                        <p className="text-slate-500 text-[10px] font-medium max-w-sm">Precision analytics for student growth and potential mapping.</p>
                    </div>

                    {performanceData.length > 1 && (
                        <div className="flex gap-1.5 p-1 bg-slate-200/50 backdrop-blur-md rounded-xl border border-white/20">
                            {performanceData.map(child => (
                                <button
                                    key={child.studentId}
                                    onClick={() => setSelectedChild(child.studentId)}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${selectedChild === child.studentId
                                        ? 'bg-white text-indigo-600 shadow-sm scale-102'
                                        : 'text-slate-500 hover:text-indigo-400 hover:bg-white/20'
                                        }`}
                                >
                                    {child.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Main Content Area */}
            <div className="space-y-4">
                {/* Default 'all' mode layout charts */}
                {mode === 'all' && (
                    <div className="w-full">
                        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col relative group">
                            <PerformancePotentialPlot currentData={currentData} />
                        </div>
                    </div>
                )}

                {/* Selected Child Details - Hero Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-blue-700 rounded-2xl p-6 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden group col-span-1 md:col-span-3 hover:-translate-y-0.5 transition-all duration-500">
                        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-white/20 transition-colors duration-700"></div>

                        <div className="flex items-center gap-3 mb-6 relative z-10">
                            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-lg border border-white/20 shadow-lg">
                                <LineChart size={18} className="text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg tracking-tight leading-none mb-1">{currentData.name}</h3>
                                <p className="text-indigo-200 text-[10px] font-medium opacity-80 uppercase tracking-widest">Session Performance</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 relative z-10">
                            <div className="space-y-1">
                                <p className="text-indigo-100 text-[9px] font-black uppercase tracking-widest opacity-60">Aggregate Score</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-bold tracking-tighter drop-shadow-md">{currentData.isExamPublished ? currentData.performance?.overall : '0'}</span>
                                    <span className="text-indigo-200 font-bold text-lg">%</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-4 sm:pt-0 sm:border-l sm:border-white/10 sm:pl-6">
                                <div>
                                    <p className="text-indigo-100 text-[9px] font-black uppercase tracking-widest mb-1 opacity-60">Potential</p>
                                    <p className="text-xl font-bold tracking-tight">{typeof currentData.potential === 'number' ? currentData.potential : (currentData.potential?.total || currentData.finalY || 0)}%</p>
                                </div>
                                <div>
                                    <p className="text-indigo-100 text-[9px] font-black uppercase tracking-widest mb-1 opacity-60">Consistency</p>
                                    <p className="text-xl font-bold text-emerald-300 tracking-tight">PRIME</p>
                                </div>
                            </div>
                        </div>
                    </div>

        <div className="bg-white/70 backdrop-blur-xl p-5 rounded-2xl border border-white/80 shadow-xl shadow-slate-200/40 col-span-1 md:col-span-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            {[
                                { 
                                    label: 'Examination Marks', 
                                    value: currentData.exam?.value || 0, 
                                    display: currentData.exam?.display || "0 / 50",
                                    total: 50, 
                                    weight: '50 Pts Max',
                                    isLocked: !currentData.exam
                                },
                                { 
                                    label: 'Assignment Score', 
                                    value: currentData.assignment?.value || 0, 
                                    display: currentData.assignment?.display || "0 / 30",
                                    total: 30, 
                                    weight: '30 Pts Max',
                                    isLocked: !currentData.assignment
                                },
                                { 
                                    label: 'Attendance Bias', 
                                    value: currentData.attendance?.value || 0, 
                                    display: currentData.attendance?.display || "0 / 20",
                                    total: 20, 
                                    weight: '20 Pts Max',
                                    isLocked: !currentData.attendance
                                }
                            ].map((cat, i) => (
                                <div key={i} className={`bg-white p-3 rounded-xl border border-slate-100 relative overflow-hidden group/cat transition-all duration-300 hover:border-slate-300 ${cat.isLocked ? 'cursor-not-allowed opacity-80' : ''}`}>
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start mb-3">
                                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{cat.label}</h4>
                                        </div>
                                        <div className="flex items-baseline gap-1 mb-1.5">
                                            <span className="text-xl font-bold text-slate-900 tracking-tighter">{cat.value >= 0 ? '+' : ''}{cat.value}</span>
                                            <span className="text-slate-300 font-bold text-[10px]">({cat.display})</span>
                                        </div>
                                        <div className="h-1 w-full bg-slate-50 rounded-full overflow-hidden mb-2">
                                            <div
                                                className="h-full bg-green-900 transition-all duration-1000"
                                                style={{ width: `${Math.max(0, Math.min(100, ((cat.value + (cat.total/2)) / cat.total) * 100))}%` }}
                                            ></div>
                                        </div>
                                        <div className="text-[7px] font-black text-slate-400 uppercase tracking-widest">
                                            {cat.weight}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center shadow-md">
                            <div className="flex items-center gap-3">
                                <div>
                                    <h4 className="text-xs font-black text-white uppercase tracking-tight">Total Performance Score (X-Axis)</h4>
                                    <p className="text-[9px] text-white/50 font-medium uppercase tracking-widest">Combined deviation from 50% baseline</p>
                                </div>
                            </div>
                            <div className="text-2xl font-black text-white tracking-tighter flex items-baseline gap-0.5">
                                {currentData.finalPerformance >= 0 ? '+' : ''}{currentData.finalPerformance || '0'}<span className="text-xs opacity-40">Pts</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
