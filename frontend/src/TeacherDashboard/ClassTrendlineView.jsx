import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, LineChart } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../authentication/AuthContext';
import toast from 'react-hot-toast';

export default function ClassTrendlineView({ onBack, isInline = false, initialViewMode = 'performance' }) {
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [teachingOptions, setTeachingOptions] = useState(null);
    const [selectedClass, setSelectedClass] = useState(null);
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [trendData, setTrendData] = useState([]);
    const [teacherProfile, setTeacherProfile] = useState(null);
    const [viewMode, setViewMode] = useState(initialViewMode); // performance, potential

    const fetchTeacherProfile = useCallback(async () => {
        try {
            const res = await api.get('/api/teacher/dashboard/profile');
            if (res.data?.ok) {
                setTeacherProfile(res.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch teacher profile", error);
        }
    }, []);

    const fetchTeachingOptions = useCallback(async () => {
        try {
            const res = await api.get('/api/assignments/teacher-options', { params: { userId: currentUser.id } });
            if (res.data.ok) {
                setTeachingOptions(res.data.data);
                
                // Filter classes if teacher is a class head
                const filteredClasses = res.data.data.classes.filter(cls => 
                    !teacherProfile?.classHead || cls.id === teacherProfile.classHead.id
                );

                // Auto-select first if available
                if (filteredClasses.length > 0) {
                    setSelectedClass(filteredClasses[0]);
                }
                if (res.data.data.subjects.length > 0) {
                    setSelectedSubject(res.data.data.subjects[0]);
                }
            }
        } catch (error) {
            console.error("Failed to fetch options", error);
            toast.error("Failed to load teaching options");
        } finally {
            setLoading(false);
        }
    }, [currentUser, teacherProfile]);

    useEffect(() => {
        fetchTeacherProfile();
    }, [fetchTeacherProfile]);

    useEffect(() => {
        if (teacherProfile || !loading) { // Wait for profile or handle if it fails
             fetchTeachingOptions();
        }
    }, [fetchTeachingOptions, teacherProfile]);

    // Fetch real trend data from backend
    useEffect(() => {
        const fetchTrendData = async () => {
            if (!selectedClass) return;
            
            try {
                const res = await api.get('/api/teacher/dashboard/analytics/trendline', {
                    params: {
                        classId: selectedClass.id,
                        subjectId: selectedSubject?.id || null
                    }
                });
                
                if (res.data?.ok) {
                    const data = res.data.data;
                    // Map backend sessions to the 4-term array
                    const newTrendData = [null, null, null, null];
                    data.forEach(item => {
                        const sessionName = item.session.toLowerCase();
                        if (sessionName.includes('1st')) newTrendData[0] = item[viewMode];
                        else if (sessionName.includes('2nd')) newTrendData[1] = item[viewMode];
                        else if (sessionName.includes('3rd')) newTrendData[2] = item[viewMode];
                        else if (sessionName.includes('4th')) newTrendData[3] = item[viewMode];
                    });
                    setTrendData(newTrendData);
                }
            } catch (error) {
                console.error("Failed to fetch trend data", error);
                // Don't show toast for every change to avoid spam, but maybe show once
            }
        };

        fetchTrendData();
    }, [selectedClass, selectedSubject, viewMode]);

    // Helper for Bezier Curves
    const getPath = (points) => {
        return points.reduce((acc, point, i, a) => {
            if (i === 0) return `M ${point[0]},${point[1]}`;
            const [cpsX, cpsY] = getControlPoint(a[i - 1], a[i - 2], point);
            const [cpeX, cpeY] = getControlPoint(point, a[i - 1], a[i + 1], true);
            return `${acc} C ${cpsX},${cpsY} ${cpeX},${cpeY} ${point[0]},${point[1]}`;
        }, '');
    };

    const getControlPoint = (current, previous, next, reverse) => {
        const p = previous || current;
        const n = next || current;
        const smoothing = 0.2;
        const o = line(p, n);
        const angle = o.angle + (reverse ? Math.PI : 0);
        const length = o.length * smoothing;
        const x = current[0] + Math.cos(angle) * length;
        const y = current[1] + Math.sin(angle) * length;
        return [x, y];
    };

    const line = (pointA, pointB) => {
        const lengthX = pointB[0] - pointA[0];
        const lengthY = pointB[1] - pointA[1];
        return {
            length: Math.sqrt(Math.pow(lengthX, 2) + Math.pow(lengthY, 2)),
            angle: Math.atan2(lengthY, lengthX)
        };
    };

    if (!loading && (!teachingOptions?.classes || teachingOptions.classes.length === 0)) {
        return (
            <div className={`p-10 text-center max-w-2xl mx-auto rounded-2xl bg-[#fffdfa] border border-slate-200 mt-10`}>
                <div className="bg-[#fcfaf7] p-6 rounded-xl border border-dashed border-slate-300">
                    <LineChart className="mx-auto text-slate-300 mb-4" size={48} />
                    <h3 className="text-base font-medium text-slate-800 mb-2">No Classes Found</h3>
                    <p className="text-[10px] text-slate-500 mb-6">You need to be assigned to at least one class to view trendlines.</p>
                    <button onClick={onBack} className="px-6 py-2 bg-green-950 text-white rounded-lg text-[10px] font-medium shadow-sm hover:bg-green-900 transition-colors">
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    const labels = ['1st Term', '2nd Term', '3rd Term', '4th Term'];

    const points = trendData.map((val, i) => {
        if (val === null || val === undefined) return null;
        const x = (i / (labels.length - 1)) * 100;
        
        let y;
        if (viewMode === 'potential') {
            // Map -100 to 100 -> 100 to 0 (SVG y is inverted)
            y = 100 - (val + 100) / 2;
        } else {
            // Map 0 to 100 -> 100 to 0
            y = 100 - val;
        }
        return [x, y];
    }).filter(Boolean);

    const pathD = points.length > 1 ? getPath(points) : '';
    const fillD = points.length > 1 ? `${pathD} L ${points[points.length - 1][0]},100 L 0,100 Z` : '';

    const strokeColor = viewMode === 'performance' ? '#10b981' : '#6366f1';

    return (
        <div className={`bg-[#fffdfa] rounded-2xl ${isInline ? '' : 'shadow-sm border border-slate-200'} p-6 max-w-2xl mx-auto`}>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h2 className="text-base font-medium text-slate-800 leading-none">
                            {viewMode === 'performance' ? 'Performance Trend' : 'Potential Trend'}
                        </h2>
                        <p className="text-[9px] text-slate-500 mt-1 uppercase tracking-widest font-medium">Average Class Metrics</p>
                    </div>
                </div>
                <div className="flex gap-1 bg-[#fcfaf7] p-1 rounded-lg border border-slate-100">
                     <button 
                        onClick={() => setViewMode('performance')}
                        className={`px-3 py-1 text-[9px] font-medium uppercase tracking-widest rounded-md transition-all ${viewMode === 'performance' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        PERF
                    </button>
                    <button 
                        onClick={() => setViewMode('potential')}
                        className={`px-3 py-1 text-[9px] font-medium uppercase tracking-widest rounded-md transition-all ${viewMode === 'potential' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        POTL
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
                <div>
                    <label className="text-[8.5px] font-medium text-slate-500 uppercase mb-1 block">Class</label>
                    <select 
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-[#fcfaf7] text-[11px] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-[#052e16]/20"
                        value={selectedClass?.id || ''}
                        onChange={(e) => setSelectedClass(teachingOptions.classes.find(c => String(c.id) === e.target.value))}
                    >
                        {teachingOptions?.classes
                            .filter(cls => !teacherProfile?.classHead || cls.id === teacherProfile.classHead.id)
                            .map(cls => (
                                <option key={cls.id} value={cls.id}>{cls.name}{cls.section}</option>
                            ))}
                    </select>
                </div>
                <div>
                    <label className="text-[8.5px] font-medium text-slate-500 uppercase mb-1 block">Subject</label>
                    <select 
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-[#fcfaf7] text-[11px] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-[#052e16]/20"
                        value={selectedSubject?.id || ''}
                        onChange={(e) => setSelectedSubject(teachingOptions.subjects.find(s => String(s.id) === e.target.value))}
                    >
                        {teachingOptions?.subjects.length > 0 ? (
                            teachingOptions.subjects.map(sub => (
                                <option key={sub.id} value={sub.id}>{sub.name}</option>
                            ))
                        ) : (
                            <option disabled value="">No Subjects</option>
                        )}
                    </select>
                </div>
            </div>

            <div className="relative h-80 w-full pt-4 pb-10 px-4 border border-slate-100 rounded-xl bg-[#fcfaf7]/30">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {/* Grid lines */}
                    {[0, 25, 50, 75, 100].map(y => {
                        let label;
                        if (viewMode === 'potential') {
                            // y=0 is 100, y=50 is 0, y=100 is -100
                            label = 100 - (y * 2);
                        } else {
                            label = 100 - y;
                        }
                        return (
                            <g key={y}>
                                <line x1="0" y1={y} x2="100" y2={y} stroke="#f1f5f9" strokeWidth="0.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
                                <text x="1" y={y - 1} fill="#94a3b8" fontSize="2" textAnchor="start" className="font-medium">{label}{viewMode === 'performance' ? '%' : ' Pts'}</text>
                            </g>
                        );
                    })}

                    <defs>
                        <linearGradient id="trendGradient" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.15" />
                            <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    <path d={fillD} fill="url(#trendGradient)" vectorEffect="non-scaling-stroke" />
                    <path
                        d={pathD}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                    />

                    {labels.map((label, i) => {
                        const val = trendData[i];
                        const x = (i / (labels.length - 1)) * 100;

                        return (
                            <g key={i} className="group cursor-pointer">
                                {val !== null && val !== undefined ? (
                                     <>
                                        <circle cx={x} cy={100 - (val / 100) * 100} r="0.8" fill="white" stroke={strokeColor} strokeWidth="1.2" vectorEffect="non-scaling-stroke" className="group-hover:r-[1.2] transition-all" />
                                        <foreignObject x={x - 8} y={100 - (val / 100) * 100 - 10} width="16" height="8" className="overflow-visible pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="bg-slate-800 text-white text-[7px] font-medium px-1.5 py-0.5 rounded shadow-lg text-center">{val}%</div>
                                        </foreignObject>
                                    </>
                                ) : (
                                    <>
                                        <circle cx={x} cy="100" r="1.5" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                                        <foreignObject x={x - 25} y={80} width="50" height="20" className="overflow-visible pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="bg-slate-800 text-white text-[9px] font-medium px-2 py-1 rounded shadow-lg text-center whitespace-nowrap">Not Calculated</div>
                                        </foreignObject>
                                    </>
                                )}
                            </g>
                        );
                    })}
                </svg>

                <div className="absolute -bottom-2 left-0 right-0 flex justify-between text-[10px] text-slate-500 font-medium px-4">
                    {labels.map((label, i) => (
                        <div key={i} className="text-center" style={{ width: `${100 / labels.length}%` }}>{label}</div>
                    ))}
                </div>
            </div>
        </div>
    );
}
