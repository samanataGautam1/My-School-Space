import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import AuthLayout from "./AuthLayout";
import { Eye, EyeOff, User, Lock } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";

export default function Login() {
  const { login, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    usernameOrCode: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const roleMap = {
    ADMIN: "/dashboard/admin",
    TEACHER: "/dashboard/teacher",
    STUDENT: "/dashboard/student",
    PARENT: "/dashboard/parent",
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.usernameOrCode || !formData.password) {
      setError("All fields are required");
      return;
    }

    setLoading(true);
    const result = await login(
      formData.usernameOrCode,
      formData.password
    );
    setLoading(false);

    if (!result.success) {
      setError(result.message || "Login failed");
      return;
    }

    const user = await refreshUser();

    if (!user) {
      setError("Session invalid");
      return;
    }

    navigate(roleMap[user.role] || "/");
  };

  const handleGoogleLogin = async (credentialResponse) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/google`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: credentialResponse.credential,
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        setError(data.error);
        return;
      }

      // save token
      localStorage.setItem("token", data.token);

      // sync user from backend (/me)
      const user = await refreshUser();

      if (!user) {
        setError("Session invalid");
        return;
      }

      navigate(roleMap[user.role] || "/");
    } catch (err) {
      setError("Google login failed");
    }
  };

  return (
    <AuthLayout
      subtitle="Welcome back — log in to your school account"
      footerText="Don't have an account?"
      footerLink="/role-selection"
      footerLinkText="Sign Up"
    >
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Username */}
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
            Username
          </label>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <User size={15} />
            </div>
            <input
              type="text"
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-white border border-slate-200"
              placeholder="Username or Student Code"
              value={formData.usernameOrCode}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  usernameOrCode: e.target.value,
                })
              }
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
            Password
          </label>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <Lock size={15} />
            </div>

            <input
              type={showPassword ? "text" : "password"}
              className="w-full h-11 pl-10 pr-10 rounded-xl bg-white border border-slate-200"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  password: e.target.value,
                })
              }
            />

            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff size={15} />
              ) : (
                <Eye size={15} />
              )}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-600 text-xs bg-red-50 p-2 rounded">
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 bg-[#052e16] text-white rounded-xl"
        >
          {loading ? "Signing in..." : "Continue"}
        </button>

        {/* Google Login */}
        <div className="pt-2">
          <GoogleLogin onSuccess={handleGoogleLogin} />
        </div>
      </form>
    </AuthLayout>
  );
}