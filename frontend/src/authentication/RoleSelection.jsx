import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, GraduationCap, BookOpen, Users, ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/Shared";

export default function RoleSelection() {
    const navigate = useNavigate();

    const roles = [
        {
            id: "admin",
            title: "Admin",
            description: "Manage school operations, staff, and system settings.",

            route: "/admin-signup"
        },
        {
            id: "teacher",
            title: "Teacher",
            description: "Manage classes, assignments, and parent communication.",

            route: "/teacher-signup"
        },
        {
            id: "student",
            title: "Student",
            description: "View courses, assignments, grades, and updates.",

            route: "/student-signup"
        },
        {
            id: "parent",
            title: "Parent",
            description: "Monitor academic progress and attendance.",

            route: "/parent-signup"
        }
    ];

    return (
        <div className="h-screen bg-[#fffef9] flex items-center justify-center p-4 relative overflow-hidden font-inter">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-green-200/20 rounded-full blur-3xl -z-10" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-200/20 rounded-full blur-3xl -z-10" />

            {/* Back to Home */}
            <Link to="/" className="absolute top-6 left-6 z-20 flex items-center gap-2 text-slate-600 hover:text-green-900 transition-colors group">
                <div className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center shadow-sm group-hover:bg-green-50 group-hover:border-green-200 transition-all">
                    <ArrowLeft size={16} />
                </div>
                <span className="text-[13px] font-semibold tracking-tight">Back to Home</span>
            </Link>

            <div className="w-full max-w-5xl flex flex-col h-full justify-center pt-12 relative z-10">
                {/* Header */}
                <div className="text-center mb-6 shrink-0">
                    <h1 className="font-bold text-slate-900 mb-1" style={{ fontSize: '32px' }}>Welcome to MyschoolSpace</h1>
                    <p className="text-sm text-slate-500 max-w-xl mx-auto">Select your role to get started.</p>
                </div>

                {/* Role Cards Grid */}
                <div className="grid md:grid-cols-2 gap-3 mb-5 shrink-0">
                    {roles.map((role) => {
                        const Icon = role.icon;
                        return (
                            <div
                                key={role.id}
                                onClick={() => navigate(role.route)}
                                className="group relative bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer border border-slate-100 hover:border-green-200 hover:-translate-y-0.5 flex items-center gap-3"
                            >
                

                                {/* Content */}
                                <div className="flex-1 text-left">
                                    <h3 className="text-sm font-bold text-slate-900 mb-0.5">
                                        {role.title}
                                    </h3>
                                    <p className="text-[11px] text-slate-500 leading-snug mb-2">
                                        {role.description}
                                    </p>
                                    <Button
                                        size="sm"
                                        className="w-20 px-3 py-1 text-[11px] h-7 bg-green-950 text-white hover:bg-green-900 !rounded-sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(role.route);
                                        }}
                                    >
                                        Select
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Compact Footer */}
                <div className="text-center shrink-0">
                    <p className="text-sm text-slate-600 mb-2">
                        Already have an account?{" "}
                        <Link to="/login" className="text-green-900 font-semibold hover:underline">
                            Log in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
