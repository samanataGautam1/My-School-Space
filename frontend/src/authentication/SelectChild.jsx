import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import AuthLayout from "./AuthLayout";
import { GraduationCap, User, ChevronRight, School } from "lucide-react";

export default function SelectChild() {
    const { currentUser, setSelectedStudent } = useAuth();
    const navigate = useNavigate();
    const [groupedStudents, setGroupedStudents] = useState({});
    const [selectedClassName, setSelectedClassName] = useState(null);

    useEffect(() => {
        if (!currentUser || currentUser.role !== "PARENT") {
            navigate("/login");
            return;
        }

        const students = currentUser.students || [];
        if (students.length === 0) {
            navigate("/dashboard/parent");
            return;
        }

        // Group students by class
        const groups = students.reduce((acc, s) => {
            const cls = s.className || "Unassigned";
            if (!acc[cls]) acc[cls] = [];
            acc[cls].push(s);
            return acc;
        }, {});

        setGroupedStudents(groups);

        // If only one class, auto-expand it? User says "if child is from same class then after clicking class show student names"
        // Let's just show classes first.
    }, [currentUser, navigate]);

    const handleSelectStudent = (student) => {
        setSelectedStudent(student);
        navigate("/dashboard/parent");
    };

    const classes = Object.keys(groupedStudents);

    return (
        <AuthLayout
            title="Guardian Portal"
            subtitle="Select a student to view their dashboard"
        >
            <div className="space-y-4">
                {!selectedClassName ? (
                    <>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2">Registered Classes</p>
                        <div className="grid gap-3">
                            {classes.map((cls) => (
                                <button
                                    key={cls}
                                    onClick={() => {
                                        if (groupedStudents[cls].length === 1) {
                                            handleSelectStudent(groupedStudents[cls][0]);
                                        } else {
                                            setSelectedClassName(cls);
                                        }
                                    }}
                                    className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200 hover:border-green-600 hover:bg-green-50/30 transition-all group shadow-sm"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-green-100 group-hover:text-green-700 transition-colors">
                                            <School size={20} />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-bold text-slate-800 tracking-tight">Class {cls}</p>
                                            <p className="text-[10px] font-medium text-slate-400">
                                                {groupedStudents[cls].length} {groupedStudents[cls].length === 1 ? 'Student' : 'Students'}
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronRight size={18} className="text-slate-300 group-hover:text-green-600 transition-colors" />
                                </button>
                            ))}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex items-center gap-2 mb-4 ml-1">
                            <button 
                                onClick={() => setSelectedClassName(null)}
                                className="text-[10px] font-bold text-slate-400 hover:text-slate-800 transition-colors uppercase tracking-tight"
                            >
                                Classes
                            </button>
                            <ChevronRight size={12} className="text-slate-300" />
                            <span className="text-[10px] font-bold text-green-700 uppercase tracking-tight">Class {selectedClassName}</span>
                        </div>
                        
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2">Select Student</p>
                        <div className="grid gap-3">
                            {groupedStudents[selectedClassName].map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => handleSelectStudent(s)}
                                    className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200 hover:border-green-600 hover:bg-green-50/30 transition-all group shadow-sm"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-green-100 group-hover:text-green-700 transition-colors">
                                            <User size={20} />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-bold text-slate-800 tracking-tight">{s.name}</p>
                                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{s.studentCode}</p>
                                        </div>
                                    </div>
                                    <div className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase border border-emerald-100 opacity-0 group-hover:opacity-100 transition-opacity">
                                        Select
                                    </div>
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </AuthLayout>
    );
}
