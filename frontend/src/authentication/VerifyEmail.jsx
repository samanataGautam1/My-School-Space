import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { Button, Input, Card } from "../components/ui/Shared";
import { CheckCircle, AlertCircle, Mail, RotateCw } from "lucide-react";

export default function VerifyEmail() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();

    // Prioritize state email (from signup), then query param, then empty
    const [email, setEmail] = useState(location.state?.email || searchParams.get("email") || "");

    // Check if we "know" the email effectively to hide the input
    const [isEmailKnown, setIsEmailKnown] = useState(!!(location.state?.email || searchParams.get("email")));

    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        const paramEmail = searchParams.get("email");
        if (paramEmail && !email) {
            setEmail(paramEmail);
            setIsEmailKnown(true);
        }
    }, [searchParams, email, location.state]);

    useEffect(() => {
        if (cooldown > 0) {
            const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldown]);

    const { loginAfterVerification } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setLoading(true);

        try {
            const response = await fetch("/api/verify/email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, code }),
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess(data.message);

                if (data.token && data.user) {
                    loginAfterVerification(data.user, data.token);

                    const roleMap = {
                        'ADMIN': '/dashboard/admin',
                        'TEACHER': '/dashboard/teacher',
                        'STUDENT': '/student-welcome',
                        'PARENT': '/dashboard/parent',
                    };

                    setTimeout(() => {
                        navigate(roleMap[data.user.role] || '/');
                    }, 1500);
                } else {
                    setTimeout(() => {
                        navigate("/login");
                    }, 2000);
                }
            } else {
                setError(data.error || "Verification failed");
                setLoading(false);
            }
        } catch (err) {
            setError("Something went wrong. Please try again.");
            setLoading(false);
        }
    };

    const handleResendCode = async () => {
        if (!email) return setError("Please enter your email first.");
        setResending(true);
        setError("");
        setSuccess("");

        try {
            const response = await fetch("/api/verify/resend-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            const data = await response.json();
            if (response.ok) {
                setSuccess(data.message);
                setCooldown(60);
            } else {
                setError(data.error || "Failed to resend code.");
            }
        } catch (err) {
            setError("Failed to connect to server.");
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#fcfaf2] flex items-center justify-center p-6">
            <div className="w-full max-w-sm">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-slate-900">Verify Email</h1>
                    <p className="mt-1 text-sm text-slate-600 font-medium">Enter the code sent to your email</p>
                </div>

                <Card className="p-5">
                    <form onSubmit={handleSubmit} className="space-y-5">

                        {success && (
                            <div className="p-2.5 bg-green-50 text-green-700 rounded-lg flex items-center gap-2 text-sm">
                                <CheckCircle size={16} /> {success}
                            </div>
                        )}
                        {error && (
                            <div className="p-2.5 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 text-sm">
                                <AlertCircle size={16} /> {error}
                            </div>
                        )}

                        {isEmailKnown && email ? (
                            <div className="flex items-center gap-3 p-2.5 bg-gray-50 border border-slate-200 rounded-xl text-slate-600">
                                <div className="p-1.5 bg-white rounded-lg shadow-sm border border-slate-100 text-emerald-600">
                                    <Mail size={14} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] uppercase font-bold text-slate-400 leading-tight">Verifying for</span>
                                    <span className="font-semibold text-slate-800 text-xs truncate max-w-[180px]">{email}</span>
                                </div>
                            </div>
                        ) : (
                            <Input
                                label="Email Address"
                                type="email"
                                size="sm"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="your@email.com"
                                required
                            />
                        )}

                        <Input
                            label="Verification Code"
                            size="sm"
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            placeholder="5-DIGIT CODE"
                            maxLength={5}
                            className="text-center tracking-[0.3em] uppercase font-mono"
                            required
                        />

                        <div className="space-y-3 pt-1">
                            <Button type="submit" size="sm" className="w-full" disabled={loading}>
                                {loading ? "Verifying..." : "Verify Account"}
                            </Button>

                            <button
                                type="button"
                                onClick={handleResendCode}
                                disabled={resending || cooldown > 0}
                                className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-emerald-700 hover:text-emerald-800 disabled:text-slate-400 transition-colors py-1"
                            >
                                <RotateCw size={12} className={resending ? "animate-spin" : ""} />
                                {cooldown > 0 ? `Resend Code in ${cooldown}s` : "Didn't receive code? Resend"}
                            </button>
                        </div>

                        <div className="text-center">
                            <Link to="/login" className="text-xs text-slate-500 hover:text-emerald-700 font-medium transition-colors">
                                Back to Login
                            </Link>
                        </div>
                    </form>
                </Card>
            </div>
        </div>
    );
}
