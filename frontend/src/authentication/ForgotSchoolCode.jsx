import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import { Button, Card } from "../components/ui/Shared";
import { Mail, Key, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

export default function ForgotSchoolCode() {
    const { requestSchoolCode } = useAuth();
    const [loading, setLoading] = useState(false);
    const [usernameOrEmail, setUsernameOrEmail] = useState("");
    const [step, setStep] = useState(1); // 1: request, 2: info

    async function handleRequest(e) {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await requestSchoolCode({ usernameOrEmail });
            if (res.ok) {
                toast.success(res.message || "Request submitted");
                setStep(2);
            } else {
                toast.error(res.error || "Failed to submit request");
            }
        } catch (err) {
            toast.error("An error occurred");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-[#fcfaf2] flex items-center justify-center p-6">
            <div className="w-full max-w-md">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-slate-900">Recover <span className="text-green-900">School Code</span></h1>
                    <p className="mt-2 text-slate-600">Admins receive code via email. Teachers/Parents need admin approval.</p>
                </div>

                <Card>
                    {step === 1 && (
                        <form onSubmit={handleRequest} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-sm text-slate-400 font-medium">Username or Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-gray-50 border border-slate-200 rounded-lg py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-green-950 transition-all text-slate-900"
                                        placeholder="Enter your username or email"
                                        value={usernameOrEmail}
                                        onChange={(e) => setUsernameOrEmail(e.target.value)}
                                    />
                                </div>
                            </div>
                            <Button type="submit" className="w-full bg-green-950 hover:bg-green-900 border-none py-6 text-lg font-bold mt-2" disabled={loading}>
                                {loading ? "Submitting..." : "Request School Code"}
                            </Button>
                        </form>
                    )}

                    {step === 2 && (
                        <div className="space-y-4 text-center">
                            <div className="bg-gray-50 p-4 rounded-lg border border-slate-200">
                                <Key className="w-6 h-6 text-green-500 mx-auto mb-2" />
                                <p className="text-sm text-slate-600">
                                    If you are an Admin, the school code has been emailed to your registered email.
                                    Teachers and Parents: your request is pending Admin approval. You will receive the school code via email once approved.
                                </p>
                            </div>
                            <Link to="/login" className="inline-flex items-center justify-center text-green-700 hover:underline text-sm">
                                <ArrowLeft className="w-4 h-4 mr-1" /> Back to Login
                            </Link>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
