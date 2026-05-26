import React, { useState, useEffect } from "react";
import { Card, Button, Badge } from "../components/ui/Shared";
import { Plus, School, Search, BookOpen, GraduationCap, Clock, AlertTriangle, ArrowLeft, Trash2, X, Check, Users, IdCard, ChevronDown } from "lucide-react";
import toast from "react-hot-toast";
import { dashboardService } from "../services/api";
import ClassroomEngineDetail from "./ClassroomEngineDetail";

export default function ClassManagement({ stats, navToClassId, onNavHandled }) {
    const [currentView, setCurrentView] = useState('overview'); // 'overview', 'addClass'
    const [overview, setOverview] = useState([]);
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [selectedClassId, setSelectedClassId] = useState(null);
    const [selectedClassDetails, setSelectedClassDetails] = useState(null); // Keep for inline expansion if needed, but "Show Detail" will switch view
    const [isAddingInline, setIsAddingInline] = useState(null); // ID of class adding subject to
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Form States
    const [newClass, setNewClass] = useState({ name: "", section: "" });
    const [inlineSubject, setInlineSubject] = useState("");
    const [inlineTeacher, setInlineTeacher] = useState("");
    const [newAssignment, setNewAssignment] = useState({ classId: "", subjectId: "", teacherId: "" });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchData();
    }, [currentView]);

    // Navigate to a specific class detail when triggered from outside (e.g. Terminal Results action button)
    useEffect(() => {
        if (navToClassId) {
            setSelectedClassId(navToClassId);
            setCurrentView('detail');
            onNavHandled?.();
        }
    }, [navToClassId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [overviewRes, classesRes, subjectsRes, teachersRes] = await Promise.all([
                dashboardService.getClassOverview(),
                dashboardService.getClasses(),
                dashboardService.getSubjects(),
                dashboardService.getTeachers()
            ]);

            if (overviewRes.ok) setOverview(overviewRes.data);
            if (classesRes.ok) setClasses(classesRes.data);
            if (subjectsRes.ok) setSubjects(subjectsRes.data);
            if (teachersRes.ok) setTeachers(teachersRes.data);
        } catch (error) {
            toast.error("Failed to fetch academic data");
        } finally {
            setLoading(false);
        }
    };

    const handleAddClass = async (e) => {
        e.preventDefault();
        if (!newClass.name || !newClass.section) return;

        setIsSubmitting(true);
        const loadingToast = toast.loading("Creating class...");

        try {
            const res = await dashboardService.createClass({
                name: newClass.name,
                section: newClass.section
            });

            if (res.ok) {
                toast.success("Class successfully created!");
                setNewClass({ name: "", section: "" });
                fetchData();
            } else {
                toast.error(res.message || "Failed to create class");
            }
        } catch (err) {
            toast.error("An error occurred while creating class");
        } finally {
            toast.dismiss(loadingToast);
            setIsSubmitting(false);
        }
    };

    const handleInlineSubmit = async (e) => {
        if (e) e.preventDefault();

        setIsSubmitting(true);
        const loadingToast = toast.loading("Processing allocation...");

        try {
            if (!inlineSubject || !inlineTeacher || !newAssignment.classId) {
                throw new Error("Subject and Teacher name are required.");
            }

            let targetSubjectId = null;
            const existingSubject = subjects.find(s => s.name.toLowerCase().trim() === inlineSubject.toLowerCase().trim());

            if (existingSubject) {
                targetSubjectId = existingSubject.id;
            } else {
                const createRes = await dashboardService.createSubject({ name: inlineSubject.trim() });
                if (createRes.ok) targetSubjectId = createRes.data.id;
                else throw new Error(createRes.message || "Failed to create subject");
            }


            const foundTeacher = teachers.find(t =>
                t.name.toLowerCase().trim() === inlineTeacher.toLowerCase().trim()
            );

            if (!foundTeacher) {
                throw new Error(`Teacher "${inlineTeacher}" not found. Please ensure they have signed up first.`);
            }


            const assignRes = await dashboardService.assignTeacher({
                classId: parseInt(newAssignment.classId),
                subjectName: inlineSubject.trim(),
                teacherId: parseInt(foundTeacher.id)
            });

            if (assignRes.ok) {
                toast.success("Successfully assigned!");
                setInlineSubject("");
                setInlineTeacher("");
                setIsAddingInline(null);
                fetchData();
            } else throw new Error(assignRes.message || "Mapping failed");
        } catch (error) {
            toast.error(error.message);
        } finally {
            toast.dismiss(loadingToast);
            setIsSubmitting(false);
        }
    };

    const handleDeleteClass = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;

        const loadingToast = toast.loading("Deleting class...");
        try {
            const res = await dashboardService.deleteClass(id);
            if (res.ok) {
                toast.success("Class deleted");
                fetchData();
            } else toast.error(res.message || "Failed to delete");
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            toast.dismiss(loadingToast);
        }
    };

    const filteredClasses = classes.filter(cls => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        // Match class name/section
        if (cls.name.toLowerCase().includes(q) || cls.section.toLowerCase().includes(q)) return true;
        if (`class ${cls.name}`.toLowerCase().includes(q)) return true;
        if (`${cls.name}${cls.section}`.toLowerCase().includes(q)) return true;
        // Match subjects or teachers in this class from overview data
        const classRows = overview.filter(o => o.classId === cls.id);
        return classRows.some(o =>
            (o.subjectName && o.subjectName.toLowerCase().includes(q)) ||
            (o.teacherName && o.teacherName.toLowerCase().includes(q))
        );
    });

    return (
        <div className="space-y-6 animate-fade-in relative max-w-7xl mx-auto">

            {currentView === 'overview' && (
                <>

                    <div className="bg-[#052e16] text-white p-5 rounded-2xl shadow-lg mb-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-emerald-500/20 transition-all duration-700"></div>

                        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                            <div>
                                <h1 className="text-lg font-medium uppercase tracking-tighter mb-1 font-inter">Class Management</h1>
                                <p className="text-emerald-100/60 text-[10px] font-medium max-w-xs font-inter">
                                    Manage classes, subjects, and teacher assignments.
                                </p>
                            </div>

                            <div className="grid grid-cols-3 gap-6 lg:gap-10 pr-4">
                                <SummaryStat label="Teachers" value={stats?.teachers || teachers.length} />
                                <SummaryStat label="Students" value={stats?.students || classes.reduce((acc, c) => acc + (c.studentCount || 0), 0)} />
                                <SummaryStat label="Parents" value={stats?.parents || classes.reduce((acc, c) => acc + (c.parentCount || 0), 0)} />
                            </div>

                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => {
                                        setSelectedClassId(classes[0]?.id);
                                        setCurrentView('detail');
                                    }}
                                    className="px-6 py-2 bg-white hover:bg-slate-50 text-[#052e16] font-medium text-[9px] uppercase tracking-widest rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-2 group/btn font-inter"
                                >
                                    Detailed View
                                    <ChevronDown size={12} className="group-hover:translate-y-0.5 transition-transform" />
                                </button>
                            </div>
                        </div>
                    </div>

                    
                    <div className="flex items-center gap-4 mb-4">
                        <div className="relative flex-1 group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-[#052e16] transition-colors" />
                            <input
                                placeholder="Find by class, subject, or teacher..."
                                className="w-full pl-10 pr-4 h-10 bg-[#fcfaf7] border border-slate-200 rounded-lg focus:outline-none focus:border-[#052e16] transition-all font-medium text-xs text-slate-700 shadow-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <Button 
                            onClick={() => setCurrentView('addClass')} 
                            className="h-9 text-[10px] px-5 bg-green-950 hover:bg-green-900 text-white shadow-sm flex items-center gap-2 uppercase tracking-widest rounded-lg transition-all active:scale-95 shrink-0 font-inter font-medium"
                        >
                            <Plus size={14} /> Configure Class
                        </Button>
                    </div>

                    {/* Redesigned Class Table */}
                    <Card className="overflow-hidden border border-slate-200 shadow-sm bg-[#fcfaf7]">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#f5f2ed] border-b border-slate-200">
                                        <th className="p-4 text-slate-500 uppercase tracking-widest text-[10px]">Division</th>
                                        <th className="p-4 text-slate-500 uppercase tracking-widest text-[10px]">Section</th>
                                        <th className="p-4 text-slate-500 uppercase tracking-widest text-[10px]">Students</th>
                                        <th className="p-4 text-slate-500 uppercase tracking-widest text-[10px]">Parents</th>
                                        <th className="p-4 text-slate-500 uppercase tracking-widest text-[10px]">Teachers</th>
                                        <th className="p-4 text-slate-500 uppercase tracking-widest text-[10px] text-right">Operations</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-[#fcfaf7]">
                                    {filteredClasses.length > 0 ? (
                                        [...filteredClasses].sort((a, b) => {
                                            const parseName = (name) => {
                                                const match = String(name).match(/\d+/);
                                                return match ? parseInt(match[0]) : name;
                                            };
                                            const nameA = parseName(a.name);
                                            const nameB = parseName(b.name);
                                            if (nameA !== nameB) {
                                                if (typeof nameA === 'number' && typeof nameB === 'number') return nameA - nameB;
                                                return String(nameA).localeCompare(String(nameB));
                                            }
                                            return (a.section || '').localeCompare(b.section || '');
                                        }).map((cls) => {
                                            const classSubjects = overview.filter(o => o.classId == cls.id);
                                            const actualSubjects = classSubjects.filter(s => s.subjectName && s.subjectName !== 'N/A');
                                            const uniqueTeachers = new Set(
                                                classSubjects
                                                    .filter(s => s.teacherName && s.teacherName !== 'Unassigned' && s.teacherName !== 'N/A')
                                                    .map(s => s.teacherId || s.teacherName)
                                            );
                                            const isExpanded = selectedClassDetails === cls.id;

                                            return (
                                                <React.Fragment key={cls.id}>
                                                    <tr className={`hover:bg-[#f5f2ed]/50 transition-colors ${isExpanded ? 'bg-green-50/20' : ''}`}>
                                                        <td className="p-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-medium text-[11px] border transition-colors font-inter ${isExpanded ? 'bg-green-100 text-green-700 border-green-200' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                                                                    {cls.name}
                                                                </div>
                                                                <span className="text-slate-800 text-xs font-inter">Class {cls.name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <Badge variant={isExpanded ? "green" : "indigo"} className="text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-widest border-none">
                                                                Section {cls.section}
                                                            </Badge>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex items-center gap-2">
                                                                
                                                                <span className="text-sm font-medium text-slate-700">{cls.studentCount || 0} Students</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex items-center gap-2">
                                                                
                                                                <span className="text-sm font-medium text-slate-700">{cls.parentCount || 0} Parents</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex items-center gap-2">
                                                               
                                                                <span className="text-sm font-medium text-slate-700">{uniqueTeachers.size} Teachers</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedClassId(cls.id);
                                                                        setCurrentView('detail');
                                                                    }}
                                                                    className="px-4 py-2 rounded-lg text-[10px] uppercase tracking-widest transition-all shadow-sm bg-green-900 text-white hover:bg-green-950"
                                                                >
                                                                    Show Detail
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteClass(cls.id, cls.name)}
                                                                    className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all border border-red-100"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {isExpanded && (
                                                        <tr className="bg-[#fcfaf7]">
                                                            <td colSpan="5" className="p-0 border-b border-green-100/50">
                                                                <div className="p-6 bg-green-50/10 border-x-4 border-green-600 animate-in slide-in-from-top-2 duration-300">
                                                                    <div className="flex items-center justify-between mb-5">
                                                                        <div className="flex items-center gap-4 font-inter">
                                                                            <p className="text-[10px] font-medium text-green-700 uppercase tracking-[0.2em] flex items-center gap-2 font-inter">
                                                                                <Clock size={12} /> Detailed Academic Allocation
                                                                            </p>
                                                                        </div>

                                                                        {!isAddingInline && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setIsAddingInline(cls.id);
                                                                                    setNewAssignment({ ...newAssignment, classId: cls.id.toString() });
                                                                                }}
                                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-900 hover:bg-green-950 text-white rounded-full text-[9px] font-medium uppercase tracking-widest transition-all shadow-md active:scale-95 font-inter"
                                                                            >
                                                                                <Plus size={12} /> Add Subject
                                                                            </button>
                                                                        )}
                                                                    </div>

                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                                                        {isAddingInline === cls.id && (
                                                                            <div className="col-span-full bg-[#fcfaf7] p-5 rounded-2xl border-2 border-green-200 shadow-xl animate-in zoom-in-95 duration-200 mb-4">
                                                                                <div className="flex items-center justify-between mb-4 font-inter">
                                                                                    <h4 className="text-xs font-medium text-green-900 uppercase tracking-widest font-inter">Manual Subject Assignment</h4>
                                                                                    <button onClick={() => setIsAddingInline(null)} className="p-1 text-slate-400 hover:text-red-500"><X size={16} /></button>
                                                                                </div>
                                                                                <form className="grid grid-cols-1 md:grid-cols-3 gap-4" onSubmit={handleInlineSubmit}>
                                                                                    <div className="space-y-1 font-inter">
                                                                                        <label className="text-[9px] font-medium text-slate-400 uppercase tracking-tighter">Subject Name</label>
                                                                                        <input
                                                                                            placeholder="Type Subject (e.g. Science)..."
                                                                                            className="w-full text-xs p-2.5 border border-slate-200 rounded-xl outline-none focus:border-green-600 shadow-inner bg-[#f5f2ed]/50"
                                                                                            list="subject-suggestions"
                                                                                            value={inlineSubject}
                                                                                            onChange={(e) => setInlineSubject(e.target.value)}
                                                                                            required
                                                                                        />
                                                                                        <datalist id="subject-suggestions">
                                                                                            {subjects.map(s => <option key={s.id} value={s.name} />)}
                                                                                        </datalist>
                                                                                    </div>
                                                                                    <div className="space-y-1">
                                                                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Teacher Name</label>
                                                                                        <input
                                                                                            placeholder="Type Teacher Name..."
                                                                                            className="w-full text-xs p-2.5 border border-slate-200 rounded-xl outline-none focus:border-green-600 shadow-inner bg-[#f5f2ed]/50"
                                                                                            list="teacher-suggestions"
                                                                                            value={inlineTeacher}
                                                                                            onChange={(e) => setInlineTeacher(e.target.value)}
                                                                                            required
                                                                                        />
                                                                                        <datalist id="teacher-suggestions">
                                                                                            {teachers.map(t => <option key={t.id} value={t.name} />)}
                                                                                        </datalist>
                                                                                        <p className="text-[8px] text-slate-400 mt-1 italic">Note: Teacher must have a registered account.</p>
                                                                                    </div>
                                                                                    <div className="flex items-end">
                                                                                        <Button type="submit" disabled={isSubmitting} className="w-full bg-green-900 hover:bg-green-950 text-white text-[10px] py-2.5 rounded-xl flex items-center justify-center gap-2">
                                                                                            <Check size={14} /> {isSubmitting ? "Processing..." : "Assign Allocation"}
                                                                                        </Button>
                                                                                    </div>
                                                                                </form>
                                                                            </div>
                                                                        )}

                                                                        {actualSubjects.length > 0 ? actualSubjects.map((s, idx) => (
                                                                            <div key={idx} className="flex flex-col p-4 bg-[#fcfaf7] rounded-xl border border-slate-200 shadow-sm hover:border-green-300 transition-all group font-inter">
                                                                                <div className="flex items-start justify-between mb-3">
                                                                                    <span className="text-xs font-medium text-slate-800 font-inter">{s.subjectName}</span>
                                                                                    <div className={`w-2 h-2 rounded-full ${s.status === 'ACTIVE' ? 'bg-green-600 shadow-[0_0_8px_rgba(22,163,74,0.5)]' : 'bg-slate-300'}`}></div>
                                                                                </div>
                                                                                <div className="flex items-center gap-2 mt-auto pt-2 border-t border-slate-50">
                                                                                    <div className="w-6 h-6 rounded-full bg-green-50 flex items-center justify-center text-green-600 border border-green-100">
                                                                                        
                                                                                    </div>
                                                                                    <div>
                                                                                        <div className="text-[8px] text-slate-400 font-medium uppercase tracking-tighter font-inter">Instructor</div>
                                                                                        <div className="text-[10px] text-slate-700 font-medium truncate max-w-[120px] font-inter">
                                                                                            {s.teacherName !== 'N/A' && s.teacherName !== 'Unassigned' ? s.teacherName : 'Pending'}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        )) : !isAddingInline && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setIsAddingInline(cls.id);
                                                                                    setNewAssignment({ ...newAssignment, classId: cls.id.toString() });
                                                                                }}
                                                                                className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400 bg-[#fcfaf7] rounded-xl border-2 border-dashed border-green-100 hover:border-green-500 hover:bg-green-50 transition-all group"
                                                                            >
                                                                                <School size={32} className="opacity-20 mb-3" />
                                                                                <p className="text-sm font-bold text-slate-500 tracking-tight">No Subjects Assigned</p>
                                                                                <p className="text-[10px] mt-1 uppercase tracking-widest font-semibold text-green-600">Click Add Subject to begin</p>
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan="6" className="py-20 text-center text-slate-400 text-[11px]">
                                                {searchTerm ? `No classes matching "${searchTerm}"` : 'No classes configured yet'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </>
            )}

            {currentView === 'addClass' && (
                <div className="animate-fade-in font-inter">
                    <button onClick={() => setCurrentView('overview')} className="mb-4 flex items-center gap-2 text-[11px] font-medium text-slate-500 hover:text-slate-700 transition-colors">
                        <ArrowLeft size={14} /> Back to overview
                    </button>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        {/* Create Form */}
                        <div>
                            <Card className="p-5 border-slate-200 bg-white shadow-sm rounded-xl">
                                <h3 className="text-[12px] font-semibold text-slate-900 mb-4">Create New Class</h3>
                                <form onSubmit={handleAddClass} className="space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Class Name</label>
                                        <input
                                            value={newClass.name}
                                            onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                                            required
                                            className="w-full text-[11px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#052e16] transition-all text-slate-700 font-medium"
                                            placeholder="e.g. 10"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Section</label>
                                        <input
                                            value={newClass.section}
                                            onChange={(e) => setNewClass({ ...newClass, section: e.target.value.toUpperCase() })}
                                            required
                                            className="w-full text-[11px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#052e16] transition-all text-slate-700 font-medium uppercase"
                                            maxLength="5"
                                            placeholder="e.g. A"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full py-2.5 bg-[#052e16] text-white text-[10px] font-semibold uppercase tracking-widest rounded-lg hover:bg-[#0a4a25] transition-all disabled:opacity-50 mt-2"
                                    >
                                        {isSubmitting ? 'Creating...' : 'Create Class'}
                                    </button>
                                </form>
                            </Card>
                        </div>

                        {/* Active Classes Grid */}
                        <div className="lg:col-span-2">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-[12px] font-semibold text-slate-900">Active Classes</h3>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{classes.length} total</span>
                            </div>

                            {classes.length === 0 ? (
                                <Card className="py-16 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-white">
                                    <p className="text-[11px] font-medium">No classes yet</p>
                                    <p className="text-[10px] mt-1 text-slate-300">Create your first class using the form</p>
                                </Card>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {[...classes]
                                        .sort((a, b) => {
                                            const n = s => { const m = String(s.name).match(/\d+/); return m ? parseInt(m[0]) : s.name; };
                                            return n(a) !== n(b) ? (typeof n(a) === 'number' && typeof n(b) === 'number' ? n(a) - n(b) : String(n(a)).localeCompare(String(n(b)))) : (a.section || '').localeCompare(b.section || '');
                                        })
                                        .map(c => {
                                            const classRows = overview.filter(o => o.classId === c.id);
                                            const subjects = classRows.filter(s => s.subjectName && s.subjectName !== 'N/A');
                                            const uniqueTeachers = [...new Set(classRows.filter(s => s.teacherName && s.teacherName !== 'Unassigned').map(s => s.teacherName))];
                                            const isComplete = subjects.length > 0 && uniqueTeachers.length > 0;
                                            const isPartial = subjects.length > 0 || uniqueTeachers.length > 0;

                                            return (
                                                <div key={c.id} className="group relative p-3.5 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all">
                                                    {/* Status dot */}
                                                    <div className={`absolute top-3 right-3 w-1.5 h-1.5 rounded-full ${isComplete ? 'bg-emerald-500' : isPartial ? 'bg-amber-400' : 'bg-slate-300'}`} />

                                                    {/* Header */}
                                                    <div className="flex items-center gap-2.5 mb-3">
                                                        <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex flex-col items-center justify-center shrink-0">
                                                            <span className="text-[11px] font-bold text-slate-700 leading-none">{c.name}</span>
                                                            <span className="text-[7px] font-bold text-slate-400 uppercase leading-none">{c.section}</span>
                                                        </div>
                                                        <div>
                                                            <p className="text-[11px] font-semibold text-slate-800">Class {c.name} — Sec {c.section}</p>
                                                            <p className="text-[9px] text-slate-400">
                                                                {isComplete ? 'Configured' : isPartial ? 'Partial' : 'Empty'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Stats */}
                                                    <div className="flex items-center gap-4 mb-3 text-[10px] text-slate-500">
                                                        <span><span className="font-semibold text-slate-700">{c.studentCount || 0}</span> students</span>
                                                        <span><span className="font-semibold text-slate-700">{subjects.length}</span> subjects</span>
                                                        <span><span className="font-semibold text-slate-700">{uniqueTeachers.length}</span> teachers</span>
                                                    </div>

                                                    {/* Subjects */}
                                                    {subjects.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1 mb-3">
                                                            {subjects.slice(0, 3).map((s, i) => (
                                                                <span key={i} className="px-1.5 py-0.5 bg-slate-50 text-slate-600 text-[8px] font-medium rounded border border-slate-200">
                                                                    {s.subjectName}
                                                                </span>
                                                            ))}
                                                            {subjects.length > 3 && (
                                                                <span className="px-1.5 py-0.5 bg-slate-50 text-slate-400 text-[8px] font-medium rounded">
                                                                    +{subjects.length - 3}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <p className="text-[9px] text-slate-300 mb-3">No subjects assigned</p>
                                                    )}

                                                    {/* Actions */}
                                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                                        <button
                                                            onClick={() => { setSelectedClassId(c.id); setCurrentView('detail'); }}
                                                            className="text-[9px] font-semibold text-[#052e16] hover:text-emerald-800 uppercase tracking-widest transition-colors"
                                                        >
                                                            View Detail
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteClass(c.id, `Class ${c.name}${c.section}`)}
                                                            className="p-1 text-slate-300 hover:text-red-500 rounded transition-all opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Trash2 size={11} />
                                                        </button>
                                                    </div>
                                                </div>
                                                );
                                            })}
                                    </div>
                                )}
                        </div>
                    </div>
                </div>
            )}
            {currentView === 'detail' && (
                <ClassroomEngineDetail 
                    initialClassId={selectedClassId} 
                    onBack={() => setCurrentView('overview')}
                    classes={classes}
                />
            )}
        </div>
    );
}

function SummaryStat({ label, value }) {
    return (
        <div className="flex flex-col gap-0.5 border-l border-emerald-500/20 pl-4 first:border-0 first:pl-0 font-inter">
            <div className="flex items-center gap-1.5 text-emerald-300/80 font-inter">
                <span className="text-[8px] font-medium uppercase tracking-widest leading-none font-inter">{label}</span>
            </div>
            <div className="text-sm font-medium tracking-tight text-white leading-none font-inter">{value}</div>
        </div>
    );
}
