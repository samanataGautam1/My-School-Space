import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { Button } from "../components/ui/Shared";
import AuthLayout from "./AuthLayout";
import { Eye, EyeOff, User, Mail, School, Lock } from "lucide-react";
import { GoogleLogin } from '@react-oauth/google';
import toast from "react-hot-toast";

export default function AdminSignup() {
    const { registerAdmin, loginWithGoogle } = useAuth();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        username: "",
        email: "",
        password: "",
        schoolName: "",
        schoolCode: "",
        emailPass: "", // For SMTP fallback
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        const schoolCodeRegex = /^[A-Z]{2}\d{2}$/;
        if (!schoolCodeRegex.test(formData.schoolCode)) {
            setError("School Code must be 2 uppercase letters followed by 2 numbers (e.g., AB12)");
            return;
        }

        if (formData.password.length < 8 ||
            !/[0-9]/.test(formData.password) ||
            !/[A-Z]/.test(formData.password)) {
            setError("Password must be at least 8 characters with 1 number and 1 uppercase letter.");
            return;
        }

        setLoading(true);

        const result = await registerAdmin(
            formData.schoolName,
            formData.firstName.trim(),
            formData.lastName.trim(),
            formData.username,
            formData.password,
            formData.email,
            formData.schoolCode,
            formData.emailPass
        );

        setLoading(false);

        if (result.success) {
            navigate('/verify-email', {
                state: {
                    email: formData.email,
                    message: "Account created! Please verify your email.",
                    verificationCode: result.verificationCode
                }
            });

            if (result.verificationCode) {
                console.log("DEV: Verification Code:", result.verificationCode);
                toast.success(`DEV MODE: Your code is ${result.verificationCode}`, { duration: 10000, icon: '🔑' });
            }
        } else {
            setError(result.message);
            setFormData(prev => ({ ...prev, password: "" }));
        }
    };

    return (
        <AuthLayout
            title={<>Create Admin <span className="text-green-700">Account</span></>}
            subtitle="Start managing your school today"
            footerText="Already have an account?"
            footerLink="/login"
            footerLinkText="Login"
        >
            <form onSubmit={handleSubmit} className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5 ml-1">First Name</label>
                        <div className="relative">
                            <div className="absolute left-2.5 top-2.5 text-slate-400"><User size={14} /></div>
                            <input
                                type="text"
                                className="w-full h-8 pl-8 pr-2 rounded-lg bg-gray-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-green-950 transition-all placeholder:text-slate-400 text-xs"
                                placeholder="John"
                                value={formData.firstName}
                                onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5 ml-1">Last Name</label>
                        <div className="relative">
                            <div className="absolute left-2.5 top-2.5 text-slate-400"><User size={14} /></div>
                            <input
                                type="text"
                                className="w-full h-8 pl-8 pr-2 rounded-lg bg-gray-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-green-950 transition-all placeholder:text-slate-400 text-xs"
                                placeholder="Doe"
                                value={formData.lastName}
                                onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                required
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5 ml-1">Username</label>
                        <div className="relative">
                            <div className="absolute left-2.5 top-2.5 text-slate-400"><User size={14} /></div>
                            <input
                                type="text"
                                className="w-full h-8 pl-8 pr-2 rounded-lg bg-gray-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-green-950 transition-all placeholder:text-slate-400 text-xs"
                                placeholder="admin_user"
                                value={formData.username}
                                onChange={e => setFormData({ ...formData, username: e.target.value })}
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5 ml-1">School Code</label>
                        <div className="relative">
                            <div className="absolute left-2.5 top-2.5 text-slate-400"><Lock size={14} /></div>
                            <input
                                type="text"
                                className="w-full h-8 pl-8 pr-2 rounded-lg bg-gray-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-green-950 transition-all placeholder:text-slate-400 text-xs"
                                placeholder="e.g. AB12"
                                value={formData.schoolCode}
                                onChange={e => setFormData({ ...formData, schoolCode: e.target.value })}
                                required
                            />
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5 ml-1">Email</label>
                    <div className="relative">
                        <div className="absolute left-2.5 top-2.5 text-slate-400"><Mail size={14} /></div>
                        <input
                            type="email"
                            className="w-full h-8 pl-8 pr-2 rounded-lg bg-gray-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-green-950 transition-all placeholder:text-slate-400 text-xs"
                            placeholder="email@school.com"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5 ml-1">
                        Email App Password (Optional)
                    </label>
                    <div className="relative">
                        <div className="absolute left-2.5 top-2.5 text-slate-400"><Lock size={14} /></div>
                        <input
                            type="password"
                            className="w-full h-8 pl-8 pr-2 rounded-lg bg-gray-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-green-950 transition-all placeholder:text-slate-400 text-xs"
                            placeholder="For SMTP fallback (16-char code)"
                            value={formData.emailPass}
                            onChange={e => setFormData({ ...formData, emailPass: e.target.value })}
                        />
                    </div>
                    <p className="text-[8px] text-slate-400 mt-0.5 ml-1 italic">
                        Only needed if regular email delivery (Resend) fails.
                    </p>
                </div>

                <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5 ml-1">School Name</label>
                    <div className="relative">
                        <div className="absolute left-2.5 top-2.5 text-slate-400"><School size={14} /></div>
                        <input
                            type="text"
                            className="w-full h-8 pl-8 pr-2 rounded-lg bg-gray-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-green-950 transition-all placeholder:text-slate-400 text-xs"
                            placeholder="Lincoln High School"
                            value={formData.schoolName}
                            onChange={e => setFormData({ ...formData, schoolName: e.target.value })}
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5 ml-1">Password</label>
                    <div className="relative">
                        <div className="absolute left-2.5 top-2.5 text-slate-400"><Lock size={14} /></div>
                        <input
                            type={showPassword ? "text" : "password"}
                            className="w-full h-8 pl-8 pr-8 rounded-lg bg-gray-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-green-950 transition-all placeholder:text-slate-400 text-xs"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                            required
                        />
                        <button
                            type="button"
                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                    </div>
                    <div className="mt-1 grid grid-cols-4 gap-1">
                        <div className={`text-[9px] flex items-center justify-center gap-1 ${formData.password.length >= 8 ? 'text-green-600' : 'text-slate-400'}`}>
                            <span className={`w-1 h-1 rounded-full ${formData.password.length >= 8 ? 'bg-green-600' : 'bg-slate-300'}`}></span>
                            8+
                        </div>
                        <div className={`text-[9px] flex items-center justify-center gap-1 ${/[0-9]/.test(formData.password) ? 'text-green-600' : 'text-slate-400'}`}>
                            <span className={`w-1 h-1 rounded-full ${/[0-9]/.test(formData.password) ? 'bg-green-600' : 'bg-slate-300'}`}></span>
                            Num
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
                </div>

                {error && <p className="text-red-500 text-[10px] bg-red-50 p-1.5 rounded border border-red-100 text-center">{error}</p>}

                <Button type="submit" loading={loading} className="w-full bg-green-950 hover:bg-green-900 text-white font-bold h-10 rounded-xl text-xs mt-1 shadow-md">
                    Create Admin Account
                </Button>


            </form>
        </AuthLayout >
    );
}
