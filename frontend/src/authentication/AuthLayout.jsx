import React from "react";
import { Link } from "react-router-dom";
import { GraduationCap, BookOpen, Users, BarChart3, ShieldCheck, Star } from "lucide-react";

const FEATURES = [
    { icon: BookOpen,    text: "Smart study materials with interactive quizzes" },
    { icon: BarChart3,   text: "Real-time performance & analytics dashboard" },
    { icon: Users,       text: "Seamless parent-teacher-student communication" },
    { icon: ShieldCheck, text: "Secure role-based access for every user" },
];

export default function AuthLayout({ children, subtitle, footerText, footerLink, footerLinkText }) {
    return (
        <div className="h-screen w-screen flex overflow-hidden font-sans">

            {/* ── LEFT PANEL ─────────────────────────────────────────────── */}
            <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] relative flex-col overflow-hidden bg-[#052e16]">

                {/* Layered gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#052e16] via-[#0a4a28] to-[#063d1c]" />

                {/* Decorative circles */}
                <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-white/5" />
                <div className="absolute top-1/3 -right-20 w-64 h-64 rounded-full bg-emerald-400/10" />
                <div className="absolute -bottom-20 left-1/4 w-96 h-96 rounded-full bg-emerald-900/40" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-emerald-800/20 blur-3xl" />


                {/* Content */}
                <div className="relative z-10 flex flex-col h-full px-12 py-10">

                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <span className="text-white text-lg tracking-widest uppercase">MySchoolSpace</span>
                    </div>

                    {/* Hero text */}
                    <div className="flex-1 flex flex-col justify-center">
                        <div className="mb-10">
                            <h2 className="text-white text-4xl xl:text-5xl font-bold leading-tight mb-4 tracking-tight">
                                Education<br />
                                <span className="text-emerald-400">Reimagined</span>
                            </h2>
                            <p className="text-emerald-100/60 text-sm leading-relaxed max-w-sm">
                                One platform for students, teachers, and parents — with smart tools for learning, tracking, and growing together.
                            </p>
                        </div>

                        {/* Feature list */}
                        <div className="space-y-3.5">
                            {FEATURES.map(({ icon: Icon, text }) => (
                                <div key={text} className="flex items-start gap-3.5">

                                    <p className="text-emerald-100/70 text-[13px] leading-snug pt-1">{text}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bottom note */}
                    <p className="text-emerald-100/30 text-[11px]">© 2026 School Space. All rights reserved.</p>
                </div>
            </div>

            {/* ── RIGHT PANEL ────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col bg-[#fafaf8] overflow-y-auto">

                {/* Mobile-only logo bar */}
                <div className="lg:hidden flex items-center gap-2 px-6 py-5 border-b border-slate-100">
                    <span className="text-slate-800 text-sm font-bold tracking-widest uppercase">MySchoolSpace</span>
                </div>

                {/* Form area */}
                <div className="flex-1 flex items-center justify-center px-6 py-10">
                    <div className="w-full max-w-[420px]">

                        {/* Header */}
                        <div className="mb-8">
                            <div className="hidden lg:flex items-center gap-2.5 mb-6">
                                
                                <span className="text-slate-800 text-sm font-bold tracking-widest uppercase">MySchoolSpace</span>
                            </div>
                            {subtitle && (
                                <p className="text-slate-500 text-sm">{subtitle}</p>
                            )}
                        </div>

                        {/* Form content */}
                        <div className="space-y-4">
                            {children}
                        </div>

                        {/* Footer link */}
                        {(footerText || footerLink) && (
                            <div className="mt-6 text-center text-sm text-slate-500">
                                {footerText}{" "}
                                {footerLink && (
                                    <Link to={footerLink} className="text-[#052e16] font-bold hover:underline">
                                        {footerLinkText || "Click here"}
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
