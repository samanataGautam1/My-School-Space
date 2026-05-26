import React, { useState, useEffect } from "react";
import { Card, Button, Badge, Modal } from "../components/ui/Shared";
import { ChevronDown } from "lucide-react";
import { HugeiconsIcon } from '@hugeicons/react';
import {
    ArrowLeft02Icon, StudentsIcon, UserMultiple02Icon, TeacherIcon,
    CrownIcon, Delete02Icon, UserSwitchIcon, UserRemoveIcon,
    Mail01Icon, PlusSignIcon
} from '@hugeicons/core-free-icons';
import toast from "react-hot-toast";
import { dashboardService } from "../services/api";

export default function ClassroomEngineDetail({ initialClassId, onBack, classes }) {
    const [selectedTab, setSelectedTab] = useState("students");
    const [selectedClassId, setSelectedClassId] = useState(initialClassId);
    const [data, setData] = useState({ students: [], parents: [], teachers: [] });
    const [loading, setLoading] = useState(true);

    const [allTeachers, setAllTeachers] = useState([]);
    const [allSubjects, setAllSubjects] = useState([]);
    const [showMoveTeacherModal, setShowMoveTeacherModal] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null); // { teacherId, name, type: 'delete'|'remove' }
    const [moveTeacherForm, setMoveTeacherForm] = useState({
        teacherId: "",
        classId: "",
        subjectName: ""
    });

    useEffect(() => {
        if (selectedClassId) fetchClassDetails();
    }, [selectedClassId]);

    useEffect(() => { fetchSupportData(); }, []);

    const fetchClassDetails = async () => {
        setLoading(true);
        try {
            const res = await dashboardService.getClassDetails(selectedClassId);
            if (res.ok) setData(res.data);
            else toast.error(res.message || "Failed to fetch class details");
        } catch (error) {
            toast.error("An error occurred while fetching details");
        } finally {
            setLoading(false);
        }
    };

    const fetchSupportData = async () => {
        try {
            const [tRes, sRes] = await Promise.all([
                dashboardService.getTeachers(),
                dashboardService.getSubjects()
            ]);
            if (tRes.ok) setAllTeachers(tRes.data);
            if (sRes.ok) setAllSubjects(sRes.data);
        } catch (error) {
            console.error("Support data fetch error:", error);
        }
    };

    const handleAssignClassTeacher = async (teacherId) => {
        const loadingToast = toast.loading("Updating class head...");
        try {
            const res = await dashboardService.assignClassTeacher(selectedClassId, teacherId);
            if (res.ok) {
                toast.success(teacherId ? "Class head updated" : "Class head removed");
                fetchClassDetails();
            } else {
                toast.error(res.message);
            }
        } catch (error) {
            toast.error("Failed to update class head");
        } finally {
            toast.dismiss(loadingToast);
        }
    };

    const handleRemoveTeacher = async (teacherId) => {
        const loadingToast = toast.loading("Removing teacher...");
        try {
            const res = await dashboardService.removeTeacherFromClass(selectedClassId, teacherId);
            if (res.ok) {
                toast.success("Teacher removed from class");
                fetchClassDetails();
            } else {
                toast.error(res.message);
            }
        } catch (error) {
            toast.error("Failed to remove teacher");
        } finally {
            toast.dismiss(loadingToast);
        }
    };

    const handleDeleteTeacher = async (teacherId) => {
        const loadingToast = toast.loading("Deleting teacher...");
        try {
            const res = await dashboardService.deleteTeacher(teacherId);
            if (res.ok) {
                toast.success("Teacher permanently deleted");
                fetchClassDetails();
            } else {
                toast.error(res.message);
            }
        } catch (error) {
            toast.error("Failed to delete teacher");
        } finally {
            toast.dismiss(loadingToast);
        }
    };

    const confirmAction = () => {
        if (!deleteConfirm) return;
        if (deleteConfirm.type === 'delete') {
            handleDeleteTeacher(deleteConfirm.teacherId);
        } else if (deleteConfirm.type === 'remove') {
            handleRemoveTeacher(deleteConfirm.teacherId);
        }
        setDeleteConfirm(null);
    };

    const handleMoveTeacher = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!moveTeacherForm.teacherId || !moveTeacherForm.classId || !moveTeacherForm.subjectName) {
            toast.error("Please select both a new class and a subject");
            return;
        }

        const loadingToast = toast.loading("Moving teacher...");
        try {
            const removeRes = await dashboardService.removeTeacherFromClass(selectedClassId, moveTeacherForm.teacherId);
            if (!removeRes.ok) {
                toast.error(removeRes.message || "Failed to remove teacher from current class");
                toast.dismiss(loadingToast);
                return;
            }

            const assignRes = await dashboardService.assignTeacher({
                classId: parseInt(moveTeacherForm.classId),
                teacherId: parseInt(moveTeacherForm.teacherId),
                subjectName: moveTeacherForm.subjectName
            });
            if (assignRes.ok) {
                toast.success("Teacher moved successfully");
                setShowMoveTeacherModal(false);
                setMoveTeacherForm({ teacherId: "", classId: "", subjectName: "" });
                fetchClassDetails();
            } else {
                toast.error(assignRes.message || "Failed to assign teacher to new class");
            }
        } catch (error) {
            toast.error("Failed to move teacher");
        } finally {
            toast.dismiss(loadingToast);
        }
    };

    const currentClass = classes.find(c => c.id === parseInt(selectedClassId));

    return (
        <div className="space-y-4 animate-fade-in pb-8 font-inter">
            {/* Header & Class Switcher */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <HugeiconsIcon icon={ArrowLeft02Icon} size={16} className="text-slate-600" />
                    </button>
                    <div>
                        <h2 className="text-sm font-semibold text-slate-900">Class Detail</h2>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                            Managing <span className="text-[#052e16] font-semibold">Class {currentClass?.name}{currentClass?.section}</span>
                        </p>
                    </div>
                </div>

                <div className="relative group">
                    <select
                        value={selectedClassId}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                        className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 font-medium text-[10px] uppercase tracking-widest py-2 pl-4 pr-10 rounded-lg outline-none focus:border-[#052e16] transition-all cursor-pointer w-full md:w-48"
                    >
                        {classes.map(c => (
                            <option key={c.id} value={c.id}>Class {c.name} {c.section}</option>
                        ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
                <TabButton active={selectedTab === "students"} onClick={() => setSelectedTab("students")} icon={<HugeiconsIcon icon={StudentsIcon} size={13} />} label="Students" />
                <TabButton active={selectedTab === "parents"} onClick={() => setSelectedTab("parents")} icon={<HugeiconsIcon icon={UserMultiple02Icon} size={13} />} label="Parents" />
                <TabButton active={selectedTab === "teachers"} onClick={() => setSelectedTab("teachers")} icon={<HugeiconsIcon icon={TeacherIcon} size={13} />} label="Teachers" />
            </div>

            {/* Content */}
            <div className="min-h-[400px]">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="w-6 h-6 border-2 border-[#052e16] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <div className="animate-in fade-in duration-200">
                        {/* Students Tab */}
                        {selectedTab === "students" && (
                            <Card className="overflow-hidden border-slate-200 shadow-sm rounded-xl">
                                <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                    <h3 className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">Student Records</h3>
                                    <span className="text-[9px] font-bold text-slate-400">{data.students.length} Enrolled</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-white border-b border-slate-100">
                                                <th className="p-3 text-[9px] font-semibold uppercase tracking-widest text-slate-400">Student</th>
                                                <th className="p-3 text-[9px] font-semibold uppercase tracking-widest text-slate-400">Code</th>
                                                <th className="p-3 text-[9px] font-semibold uppercase tracking-widest text-slate-400 text-right">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 bg-white">
                                            {data.students.length > 0 ? data.students.map(student => (
                                                 <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-semibold text-[10px]">
                                                                {student.name[0]}
                                                            </div>
                                                            <span className="text-[11px] font-medium text-slate-800">{student.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3">
                                                        <code className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-medium">{student.studentCode}</code>
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[8px] font-bold uppercase tracking-wider rounded border border-emerald-200">Active</span>
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr><td colSpan="3" className="p-12 text-center text-slate-400 text-[11px]">No students in this class.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        )}

                        {/* Parents Tab */}
                        {selectedTab === "parents" && (
                            <Card className="overflow-hidden border-slate-200 shadow-sm rounded-xl">
                                <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                    <h3 className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">Parent Directory</h3>
                                    <span className="text-[9px] font-bold text-slate-400">{data.parents.length} Registered</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-white border-b border-slate-100">
                                                <th className="p-3 text-[9px] font-semibold uppercase tracking-widest text-slate-400">Parent</th>
                                                <th className="p-3 text-[9px] font-semibold uppercase tracking-widest text-slate-400">Child</th>
                                                <th className="p-3 text-[9px] font-semibold uppercase tracking-widest text-slate-400">Email</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 bg-white">
                                            {data.parents.length > 0 ? data.parents.map(parent => (
                                                <tr key={parent.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="p-3 text-[11px] font-medium text-slate-800">{parent.parentName}</td>
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-1.5 text-slate-600">
                                                            <HugeiconsIcon icon={StudentsIcon} size={10} className="text-blue-400" />
                                                            <span className="text-[10px] font-medium">{parent.studentName}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-1.5 text-slate-500">
                                                            <HugeiconsIcon icon={Mail01Icon} size={10} className="text-slate-400" />
                                                            <span className="text-[10px]">{parent.email}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr><td colSpan="3" className="p-12 text-center text-slate-400 text-[11px]">No parents found for this class.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        )}

                        {/* Teachers Tab */}
                        {selectedTab === "teachers" && (
                            <div className="space-y-3">
                                <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest px-1">Faculty — {data.teachers.length} assigned</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {data.teachers.length > 0 ? data.teachers.map(teacher => (
                                        <Card key={teacher.id} className="p-4 border-slate-200 bg-white hover:shadow-md transition-all group relative overflow-hidden rounded-xl">
                                            {/* Class Head Badge */}
                                            {teacher.isClassTeacher && (
                                                <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[7px] font-bold uppercase tracking-widest py-0.5 px-2 rounded-bl-lg flex items-center gap-1">
                                                    <HugeiconsIcon icon={CrownIcon} size={8} /> Class Head
                                                </div>
                                            )}

                                            {/* Teacher Info */}
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center font-semibold text-[#052e16] text-sm">
                                                    {teacher.name[0]}
                                                </div>
                                                <div className="overflow-hidden flex-1 min-w-0">
                                                    <h4 className="font-semibold text-[11px] text-slate-900 truncate pr-6">{teacher.name}</h4>
                                                    <p className="text-[9px] text-slate-400 truncate">{teacher.email}</p>
                                                </div>
                                            </div>

                                            {/* Subjects */}
                                            <div className="mb-4">
                                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Subjects</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {teacher.subjects.length > 0 ? teacher.subjects.map((sub, i) => (
                                                        <span key={i} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-[8px] font-semibold rounded border border-indigo-100">
                                                            {sub}
                                                        </span>
                                                    )) : (
                                                        <span className="text-[9px] text-slate-300 italic">No subjects assigned</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex flex-col gap-1.5 pt-3 border-t border-slate-100">
                                                {!teacher.isClassTeacher ? (
                                                    <button
                                                        onClick={() => handleAssignClassTeacher(teacher.id)}
                                                        className="w-full py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[9px] font-semibold uppercase tracking-wider transition-all border border-emerald-200"
                                                    >
                                                        Set as Head
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleAssignClassTeacher(null)}
                                                        className="w-full py-1.5 bg-[#052e16] text-white hover:bg-[#0a4a25] rounded-lg text-[9px] font-semibold uppercase tracking-wider transition-all"
                                                    >
                                                        Remove as Head
                                                    </button>
                                                )}

                                                <div className="flex gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setMoveTeacherForm({ teacherId: teacher.id, classId: "", subjectName: "" });
                                                            setShowMoveTeacherModal(true);
                                                        }}
                                                        className="flex-1 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all border border-blue-100 text-[9px] font-semibold uppercase tracking-wider"
                                                    >
                                                        Move
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteConfirm({ teacherId: teacher.id, name: teacher.name, type: 'remove' })}
                                                        className="flex-1 py-1.5 text-slate-500 hover:bg-slate-50 rounded-lg transition-all border border-slate-200 text-[9px] font-semibold uppercase tracking-wider"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>

                                                <button
                                                    onClick={() => setDeleteConfirm({ teacherId: teacher.id, name: teacher.name, type: 'delete' })}
                                                    className="w-full py-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all border border-red-100 text-[9px] font-semibold uppercase tracking-wider opacity-50 hover:opacity-100"
                                                >
                                                    Delete from System
                                                </button>
                                            </div>
                                        </Card>
                                    )) : (
                                        <div className="col-span-full h-32 flex flex-col items-center justify-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
                                            <HugeiconsIcon icon={TeacherIcon} size={28} className="text-slate-200 mb-2" />
                                            <p className="text-slate-400 text-[11px] font-medium">No Faculty Assigned</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Move Teacher Modal */}
            <Modal isOpen={showMoveTeacherModal} onClose={() => setShowMoveTeacherModal(false)} title="Move Faculty to Another Class">
                <form onSubmit={handleMoveTeacher} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Destination Class</label>
                        <select
                            value={moveTeacherForm.classId}
                            onChange={(e) => setMoveTeacherForm({...moveTeacherForm, classId: e.target.value})}
                            required
                            className="w-full bg-slate-50 border border-slate-200 h-9 px-3 rounded-lg outline-none focus:border-[#052e16] transition-all text-[11px] font-medium text-slate-700 appearance-none cursor-pointer"
                        >
                            <option value="">Choose a class...</option>
                            {classes.filter(c => c.id != selectedClassId).map(c => (
                                <option key={c.id} value={c.id}>Class {c.name} {c.section}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Subject</label>
                        <input
                            type="text"
                            value={moveTeacherForm.subjectName}
                            onChange={(e) => setMoveTeacherForm({...moveTeacherForm, subjectName: e.target.value})}
                            required
                            placeholder="Type subject name..."
                            className="w-full bg-slate-50 border border-slate-200 h-9 px-3 rounded-lg outline-none focus:border-[#052e16] transition-all text-[11px] font-medium text-slate-700 placeholder:text-slate-300"
                        />
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setShowMoveTeacherModal(false)}
                            className="flex-1 h-9 rounded-lg text-[10px] font-semibold uppercase tracking-widest border border-slate-200"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 bg-[#052e16] hover:bg-[#0a4a25] text-white h-9 rounded-lg text-[10px] font-semibold uppercase tracking-widest"
                        >
                            Confirm Move
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Confirmation Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 font-inter">
                        <h3 className="text-[14px] font-semibold text-slate-900 mb-1">
                            {deleteConfirm.type === 'delete' ? 'Delete Teacher Permanently' : 'Remove from Class'}
                        </h3>
                        <p className="text-[11px] text-slate-500 mb-4">
                            {deleteConfirm.type === 'delete'
                                ? `This will permanently delete ${deleteConfirm.name} and their user account from the entire system. This action cannot be undone.`
                                : `Remove ${deleteConfirm.name} from this class? All subject assignments for this class will be removed.`
                            }
                        </p>
                        {deleteConfirm.type === 'delete' && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                                <p className="text-[10px] text-red-700 font-medium">All attendance records, assignment grades, ratings, and other data linked to this teacher will be lost.</p>
                            </div>
                        )}
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-4 py-2 text-[10px] font-semibold text-slate-500 hover:text-slate-700 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmAction}
                                className={`px-4 py-2 text-[10px] font-semibold rounded-lg text-white transition-all ${
                                    deleteConfirm.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#052e16] hover:bg-[#0a4a25]'
                                }`}
                            >
                                {deleteConfirm.type === 'delete' ? 'Delete Permanently' : 'Remove'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function TabButton({ active, onClick, icon, label }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all font-medium text-[10px] uppercase tracking-wider ${
                active
                ? 'bg-[#052e16] text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white'
            }`}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}
