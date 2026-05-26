import React, { useState } from 'react';
import { useAuth } from '../authentication/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Shared';
import { Eye, EyeOff } from 'lucide-react';

export default function StudentWelcome() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [showCode, setShowCode] = useState(false); // Default to hidden for privacy

    const studentCode = currentUser?.student?.studentCode || "LOADING...";

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#fcfaf2] p-4">
            <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full text-center space-y-6 border border-slate-100 animate-scale-in relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

                <div className="w-16 h-16 bg-emerald-50/50 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-emerald-100 shadow-sm backdrop-blur-sm">
                    <span className="text-3xl">🎓</span>
                </div>

                <h1 className="text-xl font-medium text-slate-800 tracking-tight">Welcome, {currentUser?.firstName}!</h1>

                <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 relative group transition-all hover:bg-slate-50 backdrop-blur-md">
                    <p className="text-[9px] text-slate-400 uppercase font-medium tracking-widest mb-2 italic">Your Student ID</p>
                    <div className="flex items-center justify-center gap-3">
                        <p className={`font-mono font-medium tracking-[0.2em] transition-all ${showCode ? "text-xl text-emerald-600" : "text-lg text-slate-300"}`}>
                            {showCode ? studentCode : "•••••••••"}
                        </p>
                        <button
                            onClick={() => setShowCode(!showCode)}
                            className="text-slate-300 hover:text-emerald-500 transition-colors p-1"
                            title={showCode ? "Hide ID" : "Show ID"}
                        >
                            {showCode ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed px-4 font-medium">
                    Please keep this ID safe. You will need it for exams and other school activities.
                </p>

                <Button
                    onClick={() => navigate('/dashboard/student')}
                    className="w-full bg-green-950 hover:bg-[#053d2e] text-white py-2.5 rounded-2xl text-[11px] font-medium shadow-xl shadow-green-950/20 transition-all hover:shadow-green-950/30 hover:-translate-y-0.5"
                >
                    Continue to Dashboard
                </Button>
            </div>
        </div>
    );
}
