import React from 'react';

/**
 * SessionBanner — Displays active session status across all dashboards.
 *
 * Props:
 *   activeSession: { session, year, terminal, isActive }
 *   role: 'teacher' | 'student' | 'parent' | 'admin'
 *   childName?: string (parent only)
 *   hasResults?: boolean (student + parent)
 *   onResultsClick?: () => void (student + parent)
 *   isLoading?: boolean
 */
export default function SessionBanner({ activeSession, role = 'teacher', childName, hasResults, onResultsClick, isLoading }) {
    if (isLoading) {
        return (
            <div className="w-full h-10 bg-slate-100 rounded-lg animate-pulse mb-3" />
        );
    }

    if (!activeSession) return null;

    const { session, year, terminal, isActive } = activeSession;

    if (isActive) {
        return (
            <div className="w-full bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 flex items-center justify-between mb-3 font-inter">
                <div className="flex items-center gap-3">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-900">
                        {session} — {year}
                    </span>
                    {terminal && (
                        <>
                            <span className="text-emerald-300">|</span>
                            <span className="text-[10px] font-medium text-emerald-700">{terminal}</span>
                        </>
                    )}
                    <span className="text-emerald-300">|</span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[8px] font-bold uppercase tracking-widest rounded-full border border-emerald-200">Active</span>
                </div>

                <div className="flex items-center gap-2">
                    {hasResults && onResultsClick && (
                        <button
                            onClick={onResultsClick}
                            className="text-[9px] font-medium text-emerald-700 hover:text-emerald-900 underline underline-offset-2 transition-colors"
                        >
                            {role === 'parent' && childName
                                ? `Results available for ${childName}`
                                : `Results published for ${terminal}`}
                            {' '}→
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // No active session
    const inactiveMessage = role === 'teacher'
        ? 'Contact admin to start a new session'
        : 'School is on a break';

    return (
        <div className="w-full bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 flex items-center justify-between mb-3 font-inter">
            <div className="flex items-center gap-3">
                <span className="relative flex h-2.5 w-2.5">
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
                </span>
                <span className="text-[11px] font-semibold text-amber-900">No Active Session</span>
                <span className="text-amber-300">|</span>
                <span className="text-[10px] font-medium text-amber-600">{inactiveMessage}</span>
            </div>
        </div>
    );
}
