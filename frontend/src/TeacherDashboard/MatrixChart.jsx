import React, { useState } from 'react';

export default function MatrixChart({ data }) {
    const [hovered, setHovered] = useState(null);

    // Filter out teachers with 0 rating/0 workload if desired, or keep them
    // Let's normalize data for the chart (0-100 scale)
    // Rating is 0-5. Workload might be 0-20.

    const width = 500;
    const height = 300;
    const padding = 40;

    const maxWorkload = Math.max(...data.map(d => d.workload), 10);
    const maxRating = 5;

    const xScale = (val) => padding + (val / maxWorkload) * (width - 2 * padding);
    const yScale = (val) => height - padding - (val / maxRating) * (height - 2 * padding);

    return (
        <div className="relative w-full h-[300px] bg-white rounded-xl overflow-hidden select-none">
            {/* Background Grid / Zones */}
            <div className="absolute inset-0 pointer-events-none">
                {/* Quadrant Backgrounds */}
                <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-green-50/50 rounded-bl-[100px] z-0 opacity-20"></div>
                <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-amber-50/50 rounded-tr-[100px] z-0 opacity-20"></div>
            </div>

            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full relative z-10">
                {/* Axes Lines */}
                <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e2e8f0" strokeWidth="2" />
                <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#e2e8f0" strokeWidth="2" />

                {/* Grid Lines (Horizontal) */}
                {[1, 2, 3, 4, 5].map(r => (
                    <line key={r} x1={padding} y1={yScale(r)} x2={width - padding} y2={yScale(r)} stroke="#f1f5f9" strokeDasharray="4" />
                ))}

                {/* Axis Labels */}
                <text x={width / 2} y={height - 10} textAnchor="middle" className="text-[10px] fill-slate-400 font-bold uppercase tracking-wider"></text>
                <text x={10} y={height / 2} textAnchor="middle" transform={`rotate(-90, 10, ${height / 2})`} className="text-[10px] fill-slate-400 font-bold uppercase tracking-wider">Performance Rating</text>

                {/* Bubbles */}
                {data.map((teacher, i) => {
                    const cx = xScale(teacher.workload);
                    const cy = yScale(teacher.rating);
                    // Bubble size based on Reach (min 5, max 20)
                    const r = 6 + Math.min((teacher.reach / 100) * 10, 15);

                    const isHovered = hovered === teacher.id;

                    return (
                        <g
                            key={teacher.id}
                            onMouseEnter={() => setHovered(teacher.id)}
                            onMouseLeave={() => setHovered(null)}
                            className="cursor-pointer transition-all duration-300"
                            style={{ opacity: hovered && !isHovered ? 0.3 : 1 }}
                        >
                            <circle
                                cx={cx}
                                cy={cy}
                                r={isHovered ? r + 4 : r}
                                fill={teacher.rating >= 4 ? "#22c55e" : teacher.rating >= 3 ? "#3b82f6" : "#f59e0b"}
                                fillOpacity="0.8"
                                stroke="white"
                                strokeWidth="2"
                                className="transition-all duration-300 ease-out"
                            />
                            {/* Initials if huge */}
                            {r > 12 && (
                                <text x={cx} y={cy} dy="0.3em" textAnchor="middle" fill="white" fontSize="8px" fontWeight="bold" pointerEvents="none">
                                    {teacher.name.substring(0, 2).toUpperCase()}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>

            {/* Tooltip Overlay */}
            {hovered && (() => {
                const t = data.find(d => d.id === hovered);
                if (!t) return null;
                // Calculate position percentage for absolute div
                // Simple positioning: Top-Left of the component?
                // Let's just use fixed center overlay or simple popover logic relative to data points requires calculating pixel position from percentages.
                // Easier: Absolute card at bottom right or following mouse (harder in React without refs).
                // Let's put a permanent "Info Card" in the top-right corner that updates on hover.
                return (
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur shadow-lg border border-slate-100 p-3 rounded-lg z-20 animate-fade-in-up w-48">
                        <p className="font-bold text-slate-800 text-sm">{t.name}</p>
                        <div className="h-px bg-slate-100 my-2"></div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-500">Rating</span>
                            <span className="font-bold text-green-600">{t.rating} ★</span>
                        </div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-500">Workload</span>
                            <span className="font-bold text-blue-600">{t.workload.toFixed(1)} Units</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Reach</span>
                            <span className="font-bold text-slate-700">{Math.round(t.reach)} Students</span>
                        </div>
                        {t.status === 'ON_LEAVE' && <span className="block mt-2 text-[10px] bg-red-100 text-red-600 px-2 py-1 rounded-full text-center font-bold">ON LEAVE</span>}
                    </div>
                );
            })()}

            {/* Labels for Quadrants (Subtle) */}
            <div className="absolute top-8 left-12 text-[10px] font-bold text-blue-900/40">Rising Stars</div>
            <div className="absolute top-8 right-8 text-[10px] font-bold text-green-900/40">Top Performers</div>
            <div className="absolute bottom-12 left-12 text-[10px] font-bold text-amber-900/40">Keep Watch</div>
            <div className="absolute bottom-12 right-12 text-[10px] font-bold text-slate-400">Workhorses</div>
        </div>
    );
}
