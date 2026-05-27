import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { Button } from "../components/ui/Shared";
import AuthLayout from "./AuthLayout";
import { Eye, EyeOff } from "lucide-react";

import toast from "react-hot-toast";

export default function StudentSignup() {
    const { registerStudent } = useAuth();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        username: "",
        password: "",
        schoolCode: "",
        className: "",
        rollNo: "",
        email: "",
    });
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        // School Code Validation
        const schoolCodeRegex = /^[A-Z]{2}\d{2}$/;
        if (!schoolCodeRegex.test(formData.schoolCode.toUpperCase().trim())) {
            setError("School Code must be 2 letters followed by 2 numbers (e.g., AB12)");
            return;
        }

        const result = await registerStudent(
            `${formData.firstName} ${formData.lastName}`.trim(),
            formData.username,
            formData.password,
            formData.schoolCode,
            formData.className,
            formData.rollNo,
            formData.email
        );

        if (result.requiresVerification) {
            toast.success("Registration initiated! Please verify your email.");
            navigate('/verify-email', { state: { email: formData.email } });
        } else if (result.success) {
            toast.success("Registration submitted! Please wait for your class head to approve your account.", { duration: 8000 });
            navigate('/login');
        } else {
            setError(result.message);
            setFormData(prev => ({ ...prev, password: "" }));
        }
    };

    return (
        <AuthLayout
            title={<>Join as <span className="text-green-700">Student</span></>}
            subtitle="Start your learning journey"
            footerText="Already have an account?"
            footerLink="/login"
            footerLinkText="Login"
        >
            <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 ml-1">First Name</label>
                        <input
                            className="w-full h-8 px-3 rounded-lg bg-gray-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-green-950 transition-all placeholder:text-slate-400 text-sm"
                            placeholder="Jane"
                            value={formData.firstName}
                            onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 ml-1">Last Name</label>
                        <input
                            className="w-full h-8 px-3 rounded-lg bg-gray-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-green-950 transition-all placeholder:text-slate-400 text-sm"
                            placeholder="Doe"
                            value={formData.lastName}
                            onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 ml-1">Class/Grade</label>
                        <input
                            className="w-full h-8 px-3 rounded-lg bg-gray-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-green-950 transition-all placeholder:text-slate-400 text-sm"
                            placeholder="10A"
                            value={formData.className}
                            onChange={e => setFormData({ ...formData, className: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 ml-1">School Code</label>
                        <input
                            className="w-full h-8 px-3 rounded-lg bg-gray-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-green-950 transition-all placeholder:text-slate-400 text-sm"
                            placeholder="AB12"
                            value={formData.schoolCode}
                            onChange={e => setFormData({ ...formData, schoolCode: e.target.value.toUpperCase() })}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 ml-1">Roll No</label>
                    <input
                        type="number"
                        className="w-full h-8 px-3 rounded-lg bg-gray-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-green-950 transition-all placeholder:text-slate-400 text-sm"
                        placeholder="15"
                        value={formData.rollNo}
                        onChange={e => setFormData({ ...formData, rollNo: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 ml-1">Email Address</label>
                    <input
                        type="email"
                        className="w-full h-8 px-3 rounded-lg bg-gray-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-green-950 transition-all placeholder:text-slate-400 text-sm"
                        placeholder="jane.doe@example.com"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        required
                    />
                </div>


                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 ml-1">Username</label>
                        <input
                            className="w-full h-8 px-3 rounded-lg bg-gray-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-green-950 transition-all placeholder:text-slate-400 text-sm"
                            placeholder="user123"
                            value={formData.username}
                            onChange={e => setFormData({ ...formData, username: e.target.value })}
                        />
                    </div>
                    <div className="relative">
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 ml-1">Password</label>
                        <input
                            type={showPassword ? "text" : "password"}
                            className="w-full h-8 px-3 rounded-lg bg-gray-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-green-950 transition-all placeholder:text-slate-400 text-sm"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                        />
                        <button
                            type="button"
                            className="absolute right-3 top-[26px] text-slate-400 hover:text-slate-600 focus:outline-none"
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </div>
                {/* Password Strength Indicators (Spanning full width) */}
                <div className="mt-1 grid grid-cols-4 gap-1">
                    <div className={`text-[9px] flex items-center justify-center gap-1 ${formData.password.length >= 8 ? 'text-green-600' : 'text-slate-400'}`}>
                        <span className={`w-1 h-1 rounded-full ${formData.password.length >= 8 ? 'bg-green-600' : 'bg-slate-300'}`}></span>
                        8+
                    </div>
                    <div className={`text-[9px] flex items-center justify-center gap-1 ${/[0-9]/.test(formData.password) ? 'text-green-600' : 'text-slate-400'}`}>
                        <span className={`w-1 h-1 rounded-full ${/[0-9]/.test(formData.password) ? 'bg-green-600' : 'bg-slate-300'}`}></span>
                        123
                    </div>
                    <div className={`text-[9px] flex items-center justify-center gap-1 ${/[!@#$%^&*]/.test(formData.password) ? 'text-green-600' : 'text-slate-400'}`}>
                        <span className={`w-1 h-1 rounded-full ${/[!@#$%^&*]/.test(formData.password) ? 'bg-green-600' : 'bg-slate-300'}`}></span>
                        Sym
                    </div>
                    <div className={`text-[9px] flex items-center justify-center gap-1 ${/[A-Z]/.test(formData.password) ? 'text-green-600' : 'text-slate-400'}`}>
                        <span className={`w-1 h-1 rounded-full ${/[A-Z]/.test(formData.password) ? 'bg-green-600' : 'bg-slate-300'}`}></span>
                        ABC
                    </div>
                </div>


                {error && <p className="text-red-500 text-xs">{error}</p>}

                <Button type="submit" className="w-full bg-green-950 hover:bg-green-900 text-white font-bold h-10 rounded-xl text-sm mt-3 shadow-md">
                    Register as Student
                </Button>
            </form>
        </AuthLayout >
    );
}
