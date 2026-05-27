import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { Button } from "../components/ui/Shared";
import AuthLayout from "./AuthLayout";
import { Eye, EyeOff } from "lucide-react";
import toast from 'react-hot-toast';

export default function ParentSignup() {
    const { registerParent } = useAuth();
    const navigate = useNavigate();

    // Browser Notification Helper
    const sendBrowserNotification = async (title, body) => {
        if (!("Notification" in window)) return;
        if (Notification.permission === "granted") {
            new Notification(title, { body });
        } else if (Notification.permission !== "denied") {
            const permission = await Notification.requestPermission();
            if (permission === "granted") {
                new Notification(title, { body });
            }
        }
    };

    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        username: "",
        password: "",
        email: "",
        schoolCode: "",
        studentCodes: [""],
    });
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const addStudentField = () => {
        if (formData.studentCodes.length < 5) {
            setFormData(prev => ({
                ...prev,
                studentCodes: [...prev.studentCodes, ""]
            }));
        } else {
            toast.error("Maximum 5 students allowed");
        }
    };

    const removeStudentField = (index) => {
        if (formData.studentCodes.length > 1) {
            const newCodes = [...formData.studentCodes];
            newCodes.splice(index, 1);
            setFormData(prev => ({ ...prev, studentCodes: newCodes }));
        }
    };

    const handleStudentCodeChange = (index, value) => {
        const newCodes = [...formData.studentCodes];
        newCodes[index] = value;
        setFormData(prev => ({ ...prev, studentCodes: newCodes }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        // School Code Validation
        const schoolCodeRegex = /^[A-Z]{2}\d{2}$/;
        if (!schoolCodeRegex.test(formData.schoolCode.toUpperCase().trim())) {
            setError("School Code must be 2 letters followed by 2 numbers (e.g., AB12)");
            return;
        }

        const result = await registerParent(
            formData.email,
            formData.username,
            formData.password,
            formData.schoolCode,
            formData.studentCodes.filter(code => code.trim() !== ""),
            `${formData.firstName} ${formData.lastName}`.trim()
        );

        if (result.success) {
            // Navigate FIRST
            navigate('/verify-email', {
                state: {
                    email: formData.email,
                    verificationCode: result.verificationCode
                }
            });

            // Side effects
            if (result.verificationCode) {
                console.log("DEV: Verification Code:", result.verificationCode);
                try {
                    toast.success(`DEV MODE: Your code is ${result.verificationCode}`, { duration: 10000, icon: '🔑' });
                    setTimeout(() => {
                        sendBrowserNotification("Verification Code", `Your code is: ${result.verificationCode}`).catch(console.error);
                    }, 500);
                } catch (e) {
                    console.error("Notification error:", e);
                }
            }
        } else {
            setError(result.message);
            setFormData(prev => ({ ...prev, password: "" }));
        }
        setIsLoading(false);
    };

    const handleGoogleLogin = () => {
        alert("Google Signup is simulated.");
    };

    return (
        <AuthLayout
            title={<>Join as <span className="text-green-700">Parent</span></>}
            subtitle="Track your child's progress"
            footerText="Already have an account?"
            footerLink="/login"
            footerLinkText="Login"
        >
            <form onSubmit={handleSubmit} className="space-y-3">
                <div className="bg-amber-50 p-2 rounded-lg border border-amber-100 mb-2">
                    <p className="text-[10px] text-amber-600 text-center">Required: Child's Student Code</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 ml-1">First Name</label>
                        <input
                            className="w-full h-8 px-3 rounded-lg bg-gray-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-green-950 transition-all placeholder:text-slate-400 text-sm"
                            placeholder="John"
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

                <div className="space-y-2">
                    <div className="flex justify-between items-center mb-1 ml-1">
                        <label className="block text-[10px] uppercase font-bold text-slate-500">Student Codes</label>
                        {formData.studentCodes.length < 5 && (
                            <button
                                type="button"
                                onClick={addStudentField}
                                className="text-[10px] font-bold text-green-700 hover:text-green-800 transition-colors uppercase tracking-wider"
                            >
                                + Add another child
                            </button>
                        )}
                    </div>
                    {formData.studentCodes.map((code, index) => (
                        <div key={index} className="flex gap-2">
                            <div className="flex-1">
                                <input
                                    className="w-full h-8 px-3 rounded-lg bg-gray-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-green-950 transition-all placeholder:text-slate-400 text-sm"
                                    placeholder="ST-123456"
                                    value={code}
                                    onChange={e => handleStudentCodeChange(index, e.target.value)}
                                    required={index === 0}
                                />
                            </div>
                            {formData.studentCodes.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removeStudentField(index)}
                                    className="px-3 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                                    title="Remove child"
                                >
                                    <span className="font-bold">×</span>
                                </button>
                            )}
                        </div>
                    ))}
                    {formData.studentCodes.length >= 5 && (
                        <p className="text-[9px] text-slate-400 italic ml-1 mt-1">Maximum 5 student codes allowed per parent.</p>
                    )}
                </div>

                {/* School Code */}
                <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 ml-1">
                        School Code
                    </label>

                    <input
                        type="text"
                        className="w-full h-8 px-3 rounded-lg bg-gray-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-green-950 transition-all placeholder:text-slate-400 text-sm uppercase"
                        placeholder="AB12"
                        value={formData.schoolCode}
                        onChange={e =>
                            setFormData({
                                ...formData,
                                schoolCode: e.target.value.toUpperCase()
                            })
                        }
                        maxLength={4}
                        required
                    />

                    <p className="text-[9px] text-slate-400 mt-1 ml-1">
                        Format: 2 letters + 2 numbers (Example: AB12)
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 ml-1">Email</label>
                        <input
                            type="email"
                            className="w-full h-8 px-3 rounded-lg bg-gray-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-green-950 transition-all placeholder:text-slate-400 text-sm"
                            placeholder="parent@example.com"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 ml-1">Username</label>
                        <input
                            className="w-full h-8 px-3 rounded-lg bg-gray-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-green-950 transition-all placeholder:text-slate-400 text-sm"
                            placeholder="user123"
                            value={formData.username}
                            onChange={e => setFormData({ ...formData, username: e.target.value })}
                        />
                    </div>
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
                {/* Password Strength Indicators */}
                <div className="mt-2 grid grid-cols-4 gap-2">
                    <div className={`text-[10px] flex items-center justify-center gap-1 ${formData.password.length >= 8 ? 'text-green-600' : 'text-slate-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${formData.password.length >= 8 ? 'bg-green-600' : 'bg-slate-300'}`}></span>
                        8+
                    </div>
                    <div className={`text-[10px] flex items-center justify-center gap-1 ${/[0-9]/.test(formData.password) ? 'text-green-600' : 'text-slate-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${/[0-9]/.test(formData.password) ? 'bg-green-600' : 'bg-slate-300'}`}></span>
                        Num
                    </div>
                    <div className={`text-[10px] flex items-center justify-center gap-1 ${/[!@#$%^&*]/.test(formData.password) ? 'text-green-600' : 'text-slate-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${/[!@#$%^&*]/.test(formData.password) ? 'bg-green-600' : 'bg-slate-300'}`}></span>
                        Sym
                    </div>
                    <div className={`text-[10px] flex items-center justify-center gap-1 ${/[A-Z]/.test(formData.password) ? 'text-green-600' : 'text-slate-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${/[A-Z]/.test(formData.password) ? 'bg-green-600' : 'bg-slate-300'}`}></span>
                        ABC
                    </div>
                </div>

                {error && <p className="text-red-500 text-xs">{error}</p>}

                <Button type="submit" loading={isLoading} className="w-full bg-green-950 hover:bg-green-900 text-white font-bold h-10 rounded-xl text-sm mt-2 shadow-md">
                    Register as Parent
                </Button>


            </form>
        </AuthLayout>
    );
}
