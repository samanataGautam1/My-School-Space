import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { passwordService } from "../services/api";
import AuthLayout from "./AuthLayout";

export default function ForgotPassword() {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [requiresApproval, setRequiresApproval] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const [formData, setFormData] = useState({
        usernameOrEmail: "",
        parentEmail: "",
        schoolCode: "",
        code: "",
        newPassword: "",
        confirmPassword: ""
    });

    const validatePassword = (password) => {
        const errors = [];
        if (password.length < 8) errors.push("At least 8 characters");
        if (!/[A-Z]/.test(password)) errors.push("One uppercase letter");
        if (!/[0-9]/.test(password)) errors.push("One number");
        return errors;
    };

    async function handleRequest(e) {
        e.preventDefault();
        if (!formData.usernameOrEmail.trim() || !formData.schoolCode.trim()) {
            return toast.error("All fields are required");
        }
        setLoading(true);
        try {
            const res = await passwordService.requestReset({
                usernameOrEmail: formData.usernameOrEmail.trim(),
                schoolCode: formData.schoolCode.trim().toUpperCase(),
                parentEmail: formData.parentEmail.trim()
            });
            if (res.ok) {
                toast.success(res.message);
                setRequiresApproval(res.requiresApproval || false);
                // In dev mode, auto-fill the code if returned
                if (res.devCode) {
                    setFormData(prev => ({ ...prev, code: res.devCode }));
                    toast.success(`Dev code: ${res.devCode}`, { duration: 10000 });
                }
                setStep(2);
            } else {
                toast.error(res.message || res.error || "Failed to request reset");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setLoading(false);
        }
    }

    async function handleReset(e) {
        e.preventDefault();
        if (formData.newPassword !== formData.confirmPassword) {
            return toast.error("Passwords do not match");
        }
        const pwdErrors = validatePassword(formData.newPassword);
        if (pwdErrors.length > 0) {
            return toast.error("Password needs: " + pwdErrors.join(", "));
        }
        setLoading(true);
        try {
            const res = await passwordService.resetPassword({
                usernameOrEmail: formData.usernameOrEmail.trim(),
                schoolCode: formData.schoolCode.trim().toUpperCase(),
                code: formData.code.trim(),
                newPassword: formData.newPassword
            });
            if (res.ok) {
                toast.success("Password updated successfully!");
                setStep(3);
            } else {
                toast.error(res.message || res.error || "Invalid code or request not approved");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setLoading(false);
        }
    }

    return (
        <AuthLayout
            subtitle="Reset your password"
            footerText="Remember your password?"
            footerLink="/login"
            footerLinkText="Log in"
        >
            {/* Steps indicator */}
            <div className="flex items-center gap-2 mb-6">
                {[1, 2, 3].map(s => (
                    <div key={s} className="flex items-center gap-2 flex-1">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            step >= s ? 'bg-[#052e16] text-white' : 'bg-slate-200 text-slate-400'
                        }`}>{step > s ? <CheckCircle size={12} /> : s}</div>
                        {s < 3 && <div className={`flex-1 h-px ${step > s ? 'bg-[#052e16]' : 'bg-slate-200'}`} />}
                    </div>
                ))}
            </div>

            {/* Step 1: Request */}
            {step === 1 && (
                <form onSubmit={handleRequest} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Username or Email</label>
                        <input
                            type="text"
                            required
                            className="w-full h-11 px-4 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#052e16] focus:border-transparent transition-all placeholder:text-slate-400"
                            placeholder="Enter your username or email"
                            value={formData.usernameOrEmail}
                            onChange={(e) => setFormData({ ...formData, usernameOrEmail: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider flex justify-between">
                            <span>Parent's Email</span>
                            <span className="text-[10px] text-slate-400 font-normal normal-case italic">Only for students</span>
                        </label>
                        <input
                            type="email"
                            className="w-full h-11 px-4 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#052e16] focus:border-transparent transition-all placeholder:text-slate-400"
                            placeholder="Enter parent's email"
                            value={formData.parentEmail}
                            onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">School Code</label>
                        <input
                            type="text"
                            required
                            className="w-full h-11 px-4 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#052e16] focus:border-transparent transition-all placeholder:text-slate-400 uppercase"
                            placeholder="e.g. SS01"
                            value={formData.schoolCode}
                            onChange={(e) => setFormData({ ...formData, schoolCode: e.target.value })}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-11 bg-[#052e16] hover:bg-[#0a4a28] text-white font-semibold rounded-xl text-sm shadow-md shadow-[#052e16]/20 transition-all disabled:opacity-60 mt-1"
                    >
                        {loading ? "Verifying..." : "Request Password Reset"}
                    </button>
                </form>
            )}

            {/* Step 2: Enter code + new password */}
            {step === 2 && (
                <form onSubmit={handleReset} className="space-y-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 leading-relaxed">
                        {formData.parentEmail ? (
                            <p>A 6-digit verification code has been sent to your parent's email: <strong>{formData.parentEmail}</strong>. It expires in 15 minutes.</p>
                        ) : (
                            <p>A 6-digit verification code has been sent to your email. It expires in 15 minutes.</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Verification Code</label>
                        <input
                            type="text"
                            required
                            maxLength={6}
                            className="w-full h-11 px-4 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#052e16] focus:border-transparent transition-all placeholder:text-slate-400 text-center tracking-[0.3em] font-bold"
                            placeholder="000000"
                            value={formData.code}
                            onChange={(e) => setFormData({ ...formData, code: e.target.value.replace(/\D/g, '') })}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">New Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                className="w-full h-11 px-4 pr-11 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#052e16] focus:border-transparent transition-all placeholder:text-slate-400"
                                placeholder="Min 8 chars, 1 uppercase, 1 number"
                                value={formData.newPassword}
                                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                            />
                            <button type="button" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowPassword(!showPassword)}>
                                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Confirm Password</label>
                        <input
                            type="password"
                            required
                            className="w-full h-11 px-4 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#052e16] focus:border-transparent transition-all placeholder:text-slate-400"
                            placeholder="Re-enter password"
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        />
                    </div>

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="flex-1 h-11 border border-slate-200 text-slate-600 font-semibold rounded-xl text-sm hover:bg-slate-50 transition-all"
                        >
                            Back
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-[2] h-11 bg-[#052e16] hover:bg-[#0a4a28] text-white font-semibold rounded-xl text-sm shadow-md shadow-[#052e16]/20 transition-all disabled:opacity-60"
                        >
                            {loading ? "Updating..." : "Update Password"}
                        </button>
                    </div>
                </form>
            )}

            {/* Step 3: Success */}
            {step === 3 && (
                <div className="text-center py-6">
                    <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-7 h-7 text-emerald-600" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 mb-1">Password Updated</h2>
                    <p className="text-slate-500 text-sm mb-6">You can now log in with your new password.</p>
                    <Link
                        to="/login"
                        className="block w-full h-11 bg-[#052e16] hover:bg-[#0a4a28] text-white font-semibold rounded-xl text-sm leading-[44px] text-center shadow-md shadow-[#052e16]/20 transition-all"
                    >
                        Go to Login
                    </Link>
                </div>
            )}
        </AuthLayout>
    );
}
