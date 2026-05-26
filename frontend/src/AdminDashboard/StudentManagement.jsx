import React from "react";
import { Card, Badge, Input, Button } from "../components/ui/Shared";
import { Search, Edit, Trash2, X, MoreHorizontal, GraduationCap } from "lucide-react";
import toast from "react-hot-toast";

export default function StudentManagement({
    students,
    classes = [],
    studentSearch,
    setStudentSearch,
    studentClassFilter,
    setStudentClassFilter,
    handleDeleteStudent,
    setShowEditStudent,
    showEditStudent,
    handleUpdateStudent
}) {
    const [deleteConfirm, setDeleteConfirm] = React.useState(null);
    const [studentPage, setStudentPage] = React.useState(1);
    const ROWS = 7;
    const filteredStudents = students.filter(s => {
        const matchesSearch = s.name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
            s.studentCode?.toLowerCase().includes(studentSearch.toLowerCase());
        const matchesClass = !studentClassFilter || s.className === studentClassFilter;
        return matchesSearch && matchesClass;
    });
    const totalStudentPages = Math.max(1, Math.ceil(filteredStudents.length / ROWS));
    const safePage = Math.min(studentPage, totalStudentPages);
    const pagedStudents = filteredStudents.slice((safePage - 1) * ROWS, safePage * ROWS);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-sm font-medium text-slate-800 tracking-tight">Student Directory</h1>
                    <span className="px-2 py-0.5 rounded-full bg-[#f5f2ed] text-slate-600 text-[10px] border border-slate-200">
                        {filteredStudents.length} Students
                    </span>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                        <input
                            placeholder="Search code or name..."
                            className="w-full pl-9 pr-4 h-9 text-xs font-medium bg-[#fcfaf7] border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-100 transition-all placeholder:text-slate-400"
                            value={studentSearch}
                            onChange={(e) => setStudentSearch(e.target.value)}
                        />
                    </div>
                    <select
                        className="h-9 px-3 rounded-lg border border-slate-200 bg-[#fcfaf7] text-xs font-medium outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-100 transition-all text-slate-600 cursor-pointer"
                        value={studentClassFilter}
                        onChange={(e) => setStudentClassFilter(e.target.value)}
                    >
                        <option value="">All Classes</option>
                        {classes.map(cls => (
                            <option key={cls.id} value={`${cls.name}${cls.section || ''}`}>
                                Class {cls.name}{cls.section || ''}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="bg-[#fcfaf7] border border-slate-200/60 shadow-sm rounded-xl overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-[#f5f2ed]/50 border-b border-slate-100">
                        <tr>
                            <th className="px-6 py-3 text-slate-500 text-[10px] uppercase tracking-wider">Student</th>
                            <th className="px-6 py-3 text-slate-500 text-[10px] uppercase tracking-wider">Roll No</th>
                            <th className="px-6 py-3 text-slate-500 text-[10px] uppercase tracking-wider">Class</th>
                            <th className="px-6 py-3 text-slate-500 text-[10px] uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-slate-500 text-[10px] uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 bg-[#fcfaf7]">
                        {pagedStudents.map(s => (
                            <tr key={s.id} className="hover:bg-[#f5f2ed]/80 transition-colors group cursor-default">
                                <td className="px-6 py-3">
                                    <div className="flex items-center gap-3">
                                        <div>
                                            <p className="text-xs text-slate-800 leading-none mb-1.5">{s.name}</p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-slate-400 leading-none">Code:</span>
                                                <span className="text-[10px] text-slate-600 bg-[#f5f2ed] px-1.5 py-0.5 rounded leading-none border border-slate-200">{s.studentCode}</span>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-3">
                                    <span className="text-xs font-medium text-slate-700 font-inter">#{s.rollNo}</span>
                                </td>
                                <td className="px-6 py-3">
                                    <span className="px-2 py-0.5 rounded-[4px] bg-[#f5f2ed] border border-slate-100 text-[10px] text-slate-700 uppercase">
                                        Class {s.className}
                                    </span>
                                </td>
                                <td className="px-6 py-3">
                                    <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium font-inter ${
                                        (s.status || 'ACTIVE') === 'ACTIVE'
                                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                            : 'bg-amber-50 text-amber-600 border border-amber-100'
                                    }`}>
                                        {s.status || 'Active'}
                                    </div>
                                </td>
                                <td className="px-6 py-3 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <button
                                            onClick={() => setShowEditStudent(s)}
                                            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                                            title="Edit Student"
                                        >
                                            <Edit size={14} />
                                        </button>
                                        <button
                                            onClick={() => setDeleteConfirm(s)}
                                            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                                            title="Delete Student"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredStudents.length === 0 && (
                            <tr>
                                <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                                    <div className="flex flex-col items-center justify-center">
                                        <div className="w-12 h-12 bg-[#f5f2ed] rounded-full flex items-center justify-center mb-3">
                                            <Search className="w-5 h-5 opacity-40" />
                                        </div>
                                        <p className="text-xs font-medium">No students found</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {/* Pagination */}
            {filteredStudents.length > ROWS && (
                <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-[#fcfaf7] rounded-b-xl">
                    <span className="text-[10px] text-slate-400">
                        Showing {(safePage - 1) * ROWS + 1}–{Math.min(safePage * ROWS, filteredStudents.length)} of {filteredStudents.length}
                    </span>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setStudentPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all">← Prev</button>
                        {Array.from({ length: totalStudentPages }, (_, i) => i + 1).map(p => (
                            <button key={p} onClick={() => setStudentPage(p)}
                                className={`w-7 h-7 rounded-lg text-[10px] font-semibold transition-all ${safePage === p ? 'bg-green-950 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>{p}</button>
                        ))}
                        <button onClick={() => setStudentPage(p => Math.min(totalStudentPages, p + 1))} disabled={safePage === totalStudentPages}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all">Next →</button>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                    <Card className="w-full max-w-sm p-6 animate-fade-in-up border border-slate-200 shadow-xl">
                        <h3 className="text-lg font-medium text-slate-800 mb-2">Delete Student</h3>
                        <p className="text-sm text-slate-500 mb-4">
                            Are you sure you want to delete <span className="font-bold text-slate-700">{deleteConfirm.name}</span>? This action cannot be undone.
                        </p>
                        <div className="flex gap-2">
                            <Button type="button" variant="ghost" onClick={() => setDeleteConfirm(null)} className="flex-1 text-xs">Cancel</Button>
                            <Button
                                type="button"
                                onClick={() => { handleDeleteStudent(deleteConfirm.id); setDeleteConfirm(null); }}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs py-2"
                            >
                                Delete
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Edit Student Modal */}
            {showEditStudent && (
                <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                    <Card key={showEditStudent.id} className="w-full max-w-sm p-6 animate-fade-in-up border border-slate-200 shadow-xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-medium text-slate-800 font-inter">Edit Student</h3>
                            <button onClick={() => setShowEditStudent(null)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleUpdateStudent} className="space-y-4">
                             <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider font-inter">First Name</label>
                                    <input name="firstName" defaultValue={showEditStudent.firstName} required className="w-full text-sm p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-200 outline-none font-inter" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider font-inter">Last Name</label>
                                    <input name="lastName" defaultValue={showEditStudent.lastName} required className="w-full text-sm p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-200 outline-none font-inter" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider font-inter">Roll Number</label>
                                <input name="rollNo" type="number" defaultValue={showEditStudent.rollNo} required className="w-full text-sm p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-200 outline-none font-inter" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider font-inter">Email (Optional)</label>
                                <input name="email" type="email" defaultValue={showEditStudent.email} className="w-full text-sm p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-200 outline-none font-inter" />
                            </div>

                            <div className="pt-3 flex gap-2">
                                <Button type="button" variant="ghost" onClick={() => setShowEditStudent(null)} className="flex-1 text-xs">Cancel</Button>
                                <Button type="submit" className="flex-1 bg-green-950 hover:bg-green-900 text-xs py-2">Save Changes</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
}
