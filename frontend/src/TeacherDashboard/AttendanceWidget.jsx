import React, { useState, useEffect } from 'react';
import { Card, Badge } from './Shared';
import { Users, TrendingUp, Calendar, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function AttendanceWidget() {
    const [activeView, setActiveView] = useState('students'); // 'students' | 'teachers'
    const [animate, setAnimate] = useState(false);

    useEffect(() => {
        setAnimate(true);
    }, []);

    // Mock Data
    const data = {
        students: {
            present: 1140,
            absent: 60,
            total: 1200,
            rate: 95,
            weekly: [92, 94, 91, 95, 96, 92, 95]
        },
        teachers: {
            present: 48,
            absent: 2,
            total: 50,
            rate: 96,
            weekly: [98, 96, 100, 96, 94, 98, 96]
        }
    };

    const currentData = data[activeView];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'];

    return (
        <div className="h-full flex flex-col gap-6">
            {/* Header / Tabs */}
            <div className="flex justify-between items-center">
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveView('students')}
                        className={`text-xs font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${activeView === 'students' ? 'bg-white text-green-950 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Users size={14} /> Students
                    </button>
                    <button
                        onClick={() => setActiveView('teachers')}
                        className={`text-xs font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${activeView === 'teachers' ? 'bg-white text-green-950 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <CheckCircle size={14} /> Teachers
                    </button>
                </div>
                <div className="text-xs font-bold text-slate-400 flex items-center gap-1">
                    <Calendar size={14} /> {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left: Today's Status (Circular Chart) */}
                <div className="bg-slate-900 rounded-3xl p-6 text-white relative overflow-hidden flex flex-col items-center justify-center">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-green-500 blur-[80px] opacity-20 rounded-full"></div>

                    <div className="relative w-40 h-40">
                        {/* SVG Ring Chart */}
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-800" />
                            <circle
                                cx="80" cy="80" r="70"
                                stroke="currentColor"
                                strokeWidth="12"
                                fill="transparent"
                                strokeDasharray={440}
                                strokeDashoffset={animate ? 440 - (440 * currentData.rate) / 100 : 440}
                                className={`text-green-500 transition-all duration-1000 ease-out`}
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-4xl font-black">{currentData.rate}%</span>
                            <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full mt-1 font-bold text-slate-300">PRESENT</span>
                        </div>
                    </div>

                    <div className="mt-6 w-full grid grid-cols-2 gap-4 text-center">
                        <div>
                            <p className="text-2xl font-bold text-white transition-all duration-500">{currentData.present}</p>
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Checked In</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-red-400 transition-all duration-500">{currentData.absent}</p>
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Absent</p>
                        </div>
                    </div>
                </div>

                {/* Right: Weekly Trends (Bar Chart) */}
                <div className="md:col-span-2 bg-white border border-slate-100 rounded-3xl p-6 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <TrendingUp size={18} className="text-slate-400" /> 7-Day Trend
                        </h3>
                        <Badge color="green">Healthy</Badge>
                    </div>

                    <div className="flex-1 flex items-end justify-between gap-2 md:gap-4 px-2">
                        {currentData.weekly.map((value, idx) => (
                            <div key={idx} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                                <div className="text-[10px] font-bold text-slate-800 opacity-0 group-hover:opacity-100 transition-opacity mb-1 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {value}%
                                </div>
                                <div className="w-full bg-slate-100 rounded-t-xl relative overflow-hidden h-40">
                                    <div
                                        className={`absolute bottom-0 w-full rounded-t-xl transition-all duration-1000 ease-out ${idx === 6 ? 'bg-gradient-to-t from-green-600 to-green-400' :
                                                value < 93 ? 'bg-amber-300' : 'bg-slate-300 group-hover:bg-slate-400'
                                            }`}
                                        style={{ height: animate ? `${value}%` : '0%' }}
                                    ></div>
                                </div>
                                <span className={`text-[10px] font-bold uppercase ${idx === 6 ? 'text-green-700' : 'text-slate-400'}`}>
                                    {days[idx]}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 flex gap-6 text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div> High Attendance ({'>'}95%)
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-300"></div> Average ({'<'}93%)
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
