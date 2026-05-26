import React, { useState, useEffect } from "react";
import { Card, Badge, Input, Button, Modal } from "../components/ui/Shared";
import { Search, Edit, Trash2, MessageSquare, X, MoreHorizontal, CheckCircle, XCircle, Star } from "lucide-react";
import toast from "react-hot-toast";

export default function TeacherManagement({
    teachers,
    classes = [],
    teacherSearch,
    setTeacherSearch,
    handleStatusChange,
    handleInquiry,
    handleDeleteTeacher,
    handleApproveTeacher,
    handleRejectTeacher,
    setShowEditTeacher,
    showEditTeacher,
    handleUpdateTeacher,
    deleteConfirmation,
    setDeleteConfirmation,
    confirmDelete
}) {
    const [isClassTeacherChecked, setIsClassTeacherChecked] = useState(false);
    const [selectedClassId, setSelectedClassId] = useState("");
    const [teacherPage, setTeacherPage] = useState(1);
    const ROWS = 7;

    useEffect(() => {
        if (showEditTeacher) {
            setIsClassTeacherChecked(showEditTeacher.isClassTeacher || false);
            setSelectedClassId(showEditTeacher.headOfClassId || "");
        }
    }, [showEditTeacher]);

    const filteredTeachers = teachers.filter(t =>
        t.name?.toLowerCase().includes(teacherSearch.toLowerCase()) ||
        t.subjects?.some(s => s.toLowerCase().includes(teacherSearch.toLowerCase()))
    );
    const totalTeacherPages = Math.max(1, Math.ceil(filteredTeachers.length / ROWS));
    const safePage = Math.min(teacherPage, totalTeacherPages);
    const pagedTeachers = filteredTeachers.slice((safePage - 1) * ROWS, safePage * ROWS);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-sm font-medium text-slate-800 tracking-tight">Teacher Management</h1>
                    <span className="px-2 py-0.5 rounded-full bg-[#f5f2ed] text-slate-600 text-[10px] border border-slate-200">
                        {filteredTeachers.length} Total
                    </span>
                </div>
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                    <input
                        placeholder="Search name or subject..."
                        className="w-full pl-9 pr-4 h-9 text-xs font-medium bg-[#fcfaf7] border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-100 transition-all placeholder:text-slate-400"
                        value={teacherSearch}
                        onChange={(e) => setTeacherSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-[#fcfaf7] border border-slate-200/60 shadow-sm rounded-xl overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-[#f5f2ed]/50 border-b border-slate-100">
                        <tr>
                            <th className="px-6 py-3 text-slate-500 text-[10px] uppercase tracking-wider">Teacher</th>
                            <th className="px-6 py-3 text-slate-500 text-[10px] uppercase tracking-wider">Subjects</th>
                            <th className="px-6 py-3 text-slate-500 text-[10px] uppercase tracking-wider">Class</th>
                            <th className="px-6 py-3 text-slate-500 text-[10px] uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-slate-500 text-[10px] uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 bg-[#fcfaf7]">
                        {pagedTeachers.map((t) => (
                            <tr key={t.id} className="hover:bg-[#f5f2ed]/80 transition-colors group cursor-default">
                                <td className="px-6 py-3">
                                    <div className="flex items-center gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs text-slate-800 leading-none mb-1.5">{t.name || 'Unknown'}</p>
                                                {t.isClassTeacher && (
                                                    <Badge variant="emerald" className="text-[9px] py-0.5 px-2 bg-emerald-50 border border-emerald-100 text-emerald-700 mb-1.5 font-medium font-inter">
                                                        Class Head
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-slate-400 leading-none">{t.email || 'No Email'}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-3">
                                    <div className="flex flex-wrap gap-1">
                                        {t.subjects?.slice(0, 2).map(s => (
                                            <span key={s} className="px-2 py-0.5 rounded-[4px] bg-[#f5f2ed] border border-slate-100 text-[10px] text-slate-600">
                                                {s}
                                            </span>
                                        ))}
                                        {(t.subjects?.length > 2) && (
                                            <span className="px-1.5 py-0.5 rounded-[4px] bg-[#f5f2ed] border border-slate-100 text-[10px] text-slate-500">
                                                +{t.subjects.length - 2}
                                            </span>
                                        )}
                                        {(!t.subjects || t.subjects.length === 0) && <span className="text-[10px] text-slate-300 italic">None</span>}
                                    </div>
                                </td>
                                <td className="px-6 py-3">
                                    <div className="flex flex-col">
                                        <span className="text-xs text-slate-700">{t.classes?.join(", ") || t.className || '-'}</span>
                                        {t.headOfClass && (
                                            <span className="text-[9px] text-emerald-600 font-medium mt-1 uppercase tracking-tighter flex items-center gap-1 font-inter">
                                                <Star size={8} fill="currentColor" /> Head of {t.headOfClass}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-3">
                                    {t.status === 'PENDING' ? (
                                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100 text-[10px] font-medium font-inter">
                                            Pending Approval
                                        </span>
                                    ) : t.status === 'REJECTED' ? (
                                        <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100 text-[10px] font-medium font-inter">
                                            Rejected
                                        </span>
                                    ) : (
                                        <button
                                            onClick={() => handleStatusChange(t.id, t.status)}
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all font-inter ${t.status === 'ACTIVE'
                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100'
                                                : 'bg-[#f5f2ed] text-slate-600 border-slate-100 hover:bg-slate-200'
                                                }`}
                                        >
                                            {t.status === 'ACTIVE' ? 'Active' : 'On Leave'}
                                        </button>
                                    )}
                                </td>
                                <td className="px-6 py-3 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                        {t.status === 'PENDING' ? (
                                            <>
                                                <button
                                                    onClick={() => handleApproveTeacher(t.id)}
                                                    className="w-7 h-7 flex items-center justify-center rounded-md bg-emerald-50 text-emerald-600 hover:bg-green-950 hover:text-white transition-all border border-emerald-100"
                                                    title="Approve Teacher"
                                                >
                                                    <CheckCircle size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleRejectTeacher(t.id)}
                                                    className="w-7 h-7 flex items-center justify-center rounded-md bg-red-50 text-red-600 hover:bg-red-500 hover:text-white transition-all border border-red-100"
                                                    title="Reject Teacher"
                                                >
                                                    <XCircle size={14} />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => setShowEditTeacher(t)}
                                                    className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                                                    title="Edit"
                                                >
                                                    <Edit size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTeacher(t)}
                                                    className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredTeachers.length === 0 && (
                            <tr>
                                <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                                    <div className="flex flex-col items-center justify-center">
                                        <div className="w-12 h-12 bg-[#f5f2ed] rounded-full flex items-center justify-center mb-3">
                                            <Search className="w-5 h-5 opacity-40" />
                                        </div>
                                        <p className="text-xs font-medium">No teachers found</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {/* Pagination */}
            {filteredTeachers.length > ROWS && (
                <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-[#fcfaf7] rounded-b-xl">
                    <span className="text-[10px] text-slate-400">
                        Showing {(safePage - 1) * ROWS + 1}–{Math.min(safePage * ROWS, filteredTeachers.length)} of {filteredTeachers.length}
                    </span>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setTeacherPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all">← Prev</button>
                        {Array.from({ length: totalTeacherPages }, (_, i) => i + 1).map(p => (
                            <button key={p} onClick={() => setTeacherPage(p)}
                                className={`w-7 h-7 rounded-lg text-[10px] font-semibold transition-all ${safePage === p ? 'bg-green-950 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>{p}</button>
                        ))}
                        <button onClick={() => setTeacherPage(p => Math.min(totalTeacherPages, p + 1))} disabled={safePage === totalTeacherPages}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all">Next →</button>
                    </div>
                </div>
            )}

            {/* Edit Teacher Modal */}
            {showEditTeacher && (
                <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                    <Card key={showEditTeacher.id} className="w-full max-w-sm p-6 animate-fade-in-up border border-slate-200 shadow-xl overflow-visible">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-medium text-slate-800 font-inter">Edit Teacher</h3>
                            <button onClick={() => setShowEditTeacher(null)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleUpdateTeacher} className="space-y-4">
                             <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider font-inter">First Name</label>
                                    <input name="firstName" defaultValue={showEditTeacher.firstName} required className="w-full text-sm p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-200 outline-none font-inter" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider font-inter">Last Name</label>
                                    <input name="lastName" defaultValue={showEditTeacher.lastName} required className="w-full text-sm p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-200 outline-none font-inter" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider font-inter">Email</label>
                                <input name="email" type="email" defaultValue={showEditTeacher.email} required className="w-full text-sm p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-200 outline-none font-inter" />
                            </div>
                            
                            <div className="py-2 border-t border-slate-100 mt-2">
                                <div className="flex items-center gap-2 mb-3">
                                    <input
                                        type="checkbox"
                                        id="isClassTeacher"
                                        name="isClassTeacher"
                                        checked={isClassTeacherChecked}
                                        onChange={(e) => setIsClassTeacherChecked(e.target.checked)}
                                        className="w-3.5 h-3.5 text-emerald-700 rounded border-slate-300 focus:ring-emerald-700 font-inter"
                                    />
                                    <label htmlFor="isClassTeacher" className="text-xs font-medium text-slate-700 font-inter">
                                        Assign as Class Head
                                    </label>
                                </div>

                                {isClassTeacherChecked && (
                                    <div className="space-y-1 animate-in slide-in-from-top-1 duration-200">
                                        <label className="text-[10px] font-medium text-emerald-700 uppercase tracking-wider font-inter">Select Class to Manage</label>
                                        <select 
                                            name="classId" 
                                            value={selectedClassId}
                                            onChange={(e) => setSelectedClassId(e.target.value)}
                                            required={isClassTeacherChecked}
                                            className="w-full text-xs p-2.5 border-2 border-emerald-100 bg-emerald-50/30 rounded-lg focus:border-emerald-500 outline-none transition-all appearance-none cursor-pointer font-medium"
                                        >
                                            <option value="">-- Choose a class --</option>
                                            {classes.map(c => (
                                                <option key={c.id} value={c.id}>{c.name} {c.section}</option>
                                            ))}
                                        </select>
                                        <p className="text-[9px] text-slate-400 mt-1 italic leading-tight">
                                            Assigning this teacher will replace any existing head for the selected class.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="pt-3 flex gap-2">
                                <Button type="button" variant="ghost" onClick={() => setShowEditTeacher(null)} className="flex-1 text-xs">Cancel</Button>
                                <Button type="submit" className="flex-1 bg-[#052e16] hover:bg-[#042f24] text-white text-xs py-2 shadow-md">Save Changes</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
}
