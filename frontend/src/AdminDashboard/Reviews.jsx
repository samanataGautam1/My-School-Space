import React, { useState, useEffect } from "react";
import { Card, Badge, Input, Button } from "../components/ui/Shared";
import { Filter, Star, X, BarChart2 } from "lucide-react";
import toast from "react-hot-toast";
import { dashboardService } from "../services/api";

export default function Reviews() {
    const [loading, setLoading] = useState(false);

    // Performance Directory State
    const [ratings, setRatings] = useState([]);
    const [ratingFilterSession, setRatingFilterSession] = useState(() => {
        const stored = localStorage.getItem("adminRatingSessionFilter");
        return (stored && stored !== "ALL") ? stored : "1st Session";
    });
    const [ratingFilterYear, setRatingFilterYear] = useState(() => {
        return localStorage.getItem("adminRatingYearFilter") || new Date().getFullYear().toString();
    });
    const [ratingFilterClass, setRatingFilterClass] = useState("ALL");

    // Modal State
    const [selectedTeacherForRating, setSelectedTeacherForRating] = useState(null);
    const [ratingFilterSubject, setRatingFilterSubject] = useState("ALL");
    const [classes, setClasses] = useState([]);
    const [ratingsPage, setRatingsPage] = useState(1);
    const [modalRatingsPage, setModalRatingsPage] = useState(1);
    const ROWS = 7;

    useEffect(() => {
        fetchClasses();
    }, []);

    useEffect(() => {
        localStorage.setItem("adminRatingSessionFilter", ratingFilterSession);
        localStorage.setItem("adminRatingYearFilter", ratingFilterYear);
    }, [ratingFilterSession, ratingFilterYear]);

    useEffect(() => {
        // Capture the current session explicitly inside the effect to avoid stale closures
        const currentSession = ratingFilterSession;
        const currentYear = ratingFilterYear;
        setLoading(true);
        dashboardService.getTeacherRatings(null, null, currentSession, currentYear)
            .then(res => {
                if (res && res.ok) setRatings(res.data);
            })
            .catch(e => {
                console.error(e);
                toast.error("Failed to fetch performance data");
            })
            .finally(() => setLoading(false));
    }, [ratingFilterSession, ratingFilterYear]);

    const fetchClasses = async () => {
        try {
            const res = await dashboardService.getClasses();
            if (res.ok) setClasses(res.data);
        } catch (e) {
            console.error("Failed to fetch classes", e);
        }
    };

    // Helper for smart class matching (e.g., "Class 10" matches "Class 10A" but "Class 1" doesn't match "Class 10")
    const isClassMatch = (subjectClass, filterClass) => {
        if (filterClass === "ALL") return true;
        if (subjectClass === filterClass) return true;
        if (subjectClass.startsWith(filterClass)) {
            const nextChar = subjectClass.charAt(filterClass.length);
            // If next char is NOT a number (e.g. 'A', ' ', '-'), it's a section/variant -> Match
            // If next char IS a number (e.g. '0' in '10'), it's a different number -> No Match
            return isNaN(parseInt(nextChar));
        }
        return false;
    };

    // Filter ratings based on class selection
    const filteredRatings = ratings
        .filter(t =>
            ratingFilterClass === "ALL" || (t.teachingSubjects || []).some(s => isClassMatch(s.className, ratingFilterClass))
        )
        .map(t => {
            if (ratingFilterClass === "ALL") return t;
            return {
                ...t,
                teachingSubjects: (t.teachingSubjects || []).filter(s => isClassMatch(s.className, ratingFilterClass))
            };
        });

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-base font-medium text-slate-800 tracking-tight">Performance Directory</h1>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">
                        Monitoring: <span className="text-emerald-600 font-medium">{ratingFilterSession}</span>
                    </p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <select
                        className="h-9 px-3 rounded-lg border-none bg-green-950 text-white text-xs font-bold outline-none focus:ring-0 transition-all cursor-pointer shadow-sm"
                        value={ratingFilterSession}
                        onChange={(e) => setRatingFilterSession(e.target.value)}
                    >
                        <option value="1st Session" className="bg-white text-slate-800">1st Session</option>
                        <option value="2nd Session" className="bg-white text-slate-800">2nd Session</option>
                        <option value="3rd Session" className="bg-white text-slate-800">3rd Session</option>
                    </select>
                    <select
                        className="h-9 px-3 rounded-lg border-none bg-green-950 text-white text-xs font-bold outline-none focus:ring-0 transition-all cursor-pointer shadow-sm"
                        value={ratingFilterYear}
                        onChange={(e) => setRatingFilterYear(e.target.value)}
                    >
                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                            <option key={year} value={year.toString()} className="bg-white text-slate-800">{year}</option>
                        ))}
                    </select>
                    <select
                        className="h-9 px-3 rounded-lg border-none bg-green-950 text-white text-xs font-bold outline-none focus:ring-0 transition-all cursor-pointer shadow-sm"
                        value={ratingFilterClass}
                        onChange={(e) => setRatingFilterClass(e.target.value)}
                    >
                        <option value="ALL" className="bg-white text-slate-800">All Classes</option>
                        {classes.map(c => <option key={c.id} value={c.name} className="bg-white text-slate-800">{c.name}</option>)}
                    </select>
                </div>
            </div>

            <div className="bg-[#fcfaf7] border border-slate-200/60 shadow-sm rounded-xl overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-[#f5f2ed]/50 border-b border-slate-100">
                        <tr>
                            <th className="px-6 py-3 text-slate-500 text-[10px] uppercase tracking-wider">Teacher</th>
                            <th className="px-6 py-3 text-slate-500 text-[10px] uppercase tracking-wider">Subjects</th>
                            <th className="px-6 py-3 text-slate-500 text-[10px] uppercase tracking-wider">Performance</th>
                            <th className="px-6 py-3 text-slate-500 text-[10px] uppercase tracking-wider text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 bg-[#fcfaf7]">
                        {(() => {
                            const totalPages = Math.max(1, Math.ceil(filteredRatings.length / ROWS));
                            const sp = Math.min(ratingsPage, totalPages);
                            const paged = filteredRatings.slice((sp - 1) * ROWS, sp * ROWS);
                            return paged.map((teacher) => {
                                return (
                                    <tr key={teacher.id} className="hover:bg-[#f5f2ed]/80 transition-colors group cursor-default">
                                        <td className="px-6 py-3">
                                            <div className="flex items-center gap-3">
                                                <div>
                                                    <p className="text-xs text-slate-800 leading-none mb-1.5">{teacher.name}</p>
                                                    <p className="text-[10px] text-slate-400 leading-none">{teacher.stats.totalReviews} Reviews</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="flex flex-wrap gap-1">
                                                {(teacher.teachingSubjects || []).slice(0, 2).map((s, i) => (
                                                    <span key={i} className="px-2 py-0.5 rounded-[4px] bg-[#f5f2ed] border border-slate-100 text-[10px] font-semibold text-slate-600">
                                                        {s.subjectName} {s.className}
                                                    </span>
                                                ))}
                                                {(teacher.teachingSubjects || []).length > 2 && (
                                                    <span className="px-1.5 py-0.5 rounded-[4px] bg-[#f5f2ed] border border-slate-100 text-[9px] font-bold text-slate-400">
                                                        +{(teacher.teachingSubjects || []).length - 2}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-100">
                                                    <Star size={10} className="fill-amber-500 text-amber-500" />
                                                    <span className="font-bold text-[10px] text-amber-700">{teacher.stats.avgRating}</span>
                                                </div>
                                                <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${parseFloat(teacher.stats.avgRating) >= 4 ? 'bg-emerald-500' : parseFloat(teacher.stats.avgRating) >= 2.5 ? 'bg-amber-400' : 'bg-rose-400'}`}
                                                        style={{ width: `${(parseFloat(teacher.stats.avgRating) / 5) * 100}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <button
                                                onClick={() => {
                                                    setSelectedTeacherForRating(teacher);
                                                    setRatingFilterSubject("ALL");
                                                }}
                                                className="px-3 py-1 rounded-md bg-green-950 text-white text-[10px] font-bold shadow-sm hover:bg-green-900 hover:shadow-md transform hover:-translate-y-0.5 transition-all"
                                            >
                                                View Details
                                            </button>
                                        </td>
                                    </tr>
                                );
                            });
                        })()}
                        {(!loading && filteredRatings.length === 0) && (
                            <tr>
                                <td colSpan="4" className="px-6 py-12 text-center text-slate-400">
                                    <div className="flex flex-col items-center justify-center">
                                        <div className="w-12 h-12 bg-[#f5f2ed] rounded-full flex items-center justify-center mb-3">
                                            <BarChart2 className="w-5 h-5 opacity-40" />
                                        </div>
                                        <p className="text-xs font-medium">No performance data available</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                        {loading && (
                            <tr>
                                <td colSpan="4" className="px-6 py-12 text-center text-slate-400 text-xs animate-pulse">
                                    Loading performance data...
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {/* Pagination */}
            {filteredRatings.length > ROWS && (() => {
                const totalPages = Math.max(1, Math.ceil(filteredRatings.length / ROWS));
                const sp = Math.min(ratingsPage, totalPages);
                return (
                    <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-[#fcfaf7] rounded-b-xl">
                        <span className="text-[10px] text-slate-400">Showing {(sp - 1) * ROWS + 1}–{Math.min(sp * ROWS, filteredRatings.length)} of {filteredRatings.length}</span>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setRatingsPage(p => Math.max(1, p - 1))} disabled={sp === 1}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all">← Prev</button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                <button key={p} onClick={() => setRatingsPage(p)}
                                    className={`w-7 h-7 rounded-lg text-[10px] font-semibold transition-all ${sp === p ? 'bg-green-950 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>{p}</button>
                            ))}
                            <button onClick={() => setRatingsPage(p => Math.min(totalPages, p + 1))} disabled={sp === totalPages}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all">Next →</button>
                        </div>
                    </div>
                );
            })()}

            {/* Teacher Rating Details Modal - Updated Style */}
            {selectedTeacherForRating && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300">
                    <div className="bg-[#fcfaf7] w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-scale-in">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-100 flex justify-between items-start bg-[#fcfaf7]">
                            <div className="flex items-center gap-4">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800 tracking-tight">{selectedTeacherForRating.name}</h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="flex items-center gap-0.5 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-100">
                                            {[1, 2, 3, 4, 5].map(star => (
                                                <Star key={star} size={10} className={star <= parseFloat(selectedTeacherForRating.stats.avgRating) ? "fill-amber-400 text-amber-400" : "text-slate-200 fill-slate-200"} />
                                            ))}
                                            <span className="ml-1 text-[10px] font-bold text-amber-700">
                                                {selectedTeacherForRating.stats.avgRating}
                                            </span>
                                        </div>
                                        <span className="text-xs font-medium text-slate-400">
                                            {selectedTeacherForRating.stats.totalReviews} Reviews
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setSelectedTeacherForRating(null)} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                                <X size={16} />
                            </button>
                        </div>

                        {/* Filter Bar */}
                        <div className="px-4 py-2 border-b border-slate-100 flex overflow-x-auto gap-2 scrollbar-hide bg-slate-50/50">
                            <button
                                onClick={() => setRatingFilterSubject("ALL")}
                                className={`px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all border shadow-sm ${ratingFilterSubject === "ALL"
                                    ? "bg-green-950 text-white border-green-950"
                                    : "bg-[#fcfaf7] text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-[#fcfaf7]"}`}
                            >
                                All Subjects
                            </button>
                            {(selectedTeacherForRating.teachingSubjects || []).map((subj, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setRatingFilterSubject(`${subj.subjectId}-${subj.classId}`)}
                                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all border shadow-sm ${ratingFilterSubject === `${subj.subjectId}-${subj.classId}`
                                        ? "bg-green-950 text-white border-green-950"
                                        : "bg-[#fcfaf7] text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-[#fcfaf7]"
                                        }`}
                                >
                                    {subj.subjectName} ({subj.className})
                                </button>
                            ))}
                        </div>

                        {/* Reviews List Table */}
                        <div className="flex-1 overflow-y-auto bg-[#f5f2ed]">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-[#fcfaf7] border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-5 py-3 text-slate-500 text-[10px] uppercase tracking-wider whitespace-nowrap w-24">Date</th>
                                        <th className="px-5 py-3 text-slate-500 text-[10px] uppercase tracking-wider whitespace-nowrap w-32">Student</th>
                                        <th className="px-5 py-3 text-slate-500 text-[10px] uppercase tracking-wider w-24">Rating</th>
                                        <th className="px-5 py-3 text-slate-500 text-[10px] uppercase tracking-wider">Feedback</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-[#fcfaf7]">
                                    {(() => {
                                        const modalFiltered = (selectedTeacherForRating.ratings || [])
                                            .filter(r => ratingFilterSubject === "ALL" || `${r.subjectId}-${r.classId}` === ratingFilterSubject);
                                        const totalPages = Math.max(1, Math.ceil(modalFiltered.length / ROWS));
                                        const sp = Math.min(modalRatingsPage, totalPages);
                                        const paged = modalFiltered.slice((sp - 1) * ROWS, sp * ROWS);
                                        return paged.map((r, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-5 py-3 whitespace-nowrap align-top">
                                                    <span className="text-[10px] text-slate-500 font-bold font-mono bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-md">
                                                        {new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 align-top">
                                                    <div>
                                                        <p className="font-bold text-[11px] text-slate-700">{r.studentName}</p>
                                                        <div className="mt-0.5 flex items-center gap-1">
                                                            <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1 py-0.5 rounded">{r.subjectName}</span>
                                                            <span className="text-[9px] font-bold text-slate-400">•</span>
                                                            <span className="text-[9px] font-bold text-green-700 bg-green-50 px-1 py-0.5 rounded">{r.className}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3 align-top">
                                                    <div className="flex text-amber-400 gap-0.5">
                                                        {[1, 2, 3, 4, 5].map(star => (
                                                            <Star key={star} size={10} className={star <= r.score ? "fill-amber-400" : "text-slate-100 fill-slate-100"} />
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3 align-top">
                                                    {r.review ? (
                                                        <p className="text-[11px] text-slate-600 leading-relaxed max-w-md">{r.review}</p>
                                                    ) : (
                                                        <span className="text-[11px] text-slate-300 italic">No written feedback provided</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ));
                                    })()}
                                </tbody>
                            </table>
                            {/* Modal Pagination */}
                            {(() => {
                                const modalFiltered = (selectedTeacherForRating.ratings || [])
                                    .filter(r => ratingFilterSubject === "ALL" || `${r.subjectId}-${r.classId}` === ratingFilterSubject);
                                const totalPages = Math.max(1, Math.ceil(modalFiltered.length / ROWS));
                                const sp = Math.min(modalRatingsPage, totalPages);
                                if (modalFiltered.length <= ROWS) return null;
                                return (
                                    <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-[#fcfaf7]">
                                        <span className="text-[10px] text-slate-400">Showing {(sp - 1) * ROWS + 1}–{Math.min(sp * ROWS, modalFiltered.length)} of {modalFiltered.length}</span>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => setModalRatingsPage(p => Math.max(1, p - 1))} disabled={sp === 1}
                                                className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all">← Prev</button>
                                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                                <button key={p} onClick={() => setModalRatingsPage(p)}
                                                    className={`w-7 h-7 rounded-lg text-[10px] font-semibold transition-all ${sp === p ? 'bg-green-950 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>{p}</button>
                                            ))}
                                            <button onClick={() => setModalRatingsPage(p => Math.min(totalPages, p + 1))} disabled={sp === totalPages}
                                                className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all">Next →</button>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
