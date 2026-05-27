import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { authService, dashboardService, passwordService, schoolService } from "../services/api";

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(() => {
        const savedUser = localStorage.getItem("user");
        try {
            return savedUser ? JSON.parse(savedUser) : null;
        } catch {
            return null;
        }
    });

    const [selectedStudent, setSelectedStudent] = useState(() => {
        const saved = localStorage.getItem("selectedStudent");
        try {
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });
    const [loading, setLoading] = useState(!localStorage.getItem("token"));

    const verifySession = useCallback(async () => {
        const token = localStorage.getItem("token");
        if (!token) {
            setLoading(false);
            return;
        }

        try {
            const data = await authService.checkAuth();

            if (data.ok && data.user) {
                setCurrentUser(data.user);
                localStorage.setItem("user", JSON.stringify(data.user));
            } else {
                throw new Error(data.error || "Invalid session");
            }
        } catch (error) {
            console.error("Session restore failed:", error);
            setCurrentUser(null);
            // The interceptor in api.js handles clearing localStorage on 401
        } finally {
            setLoading(false);
        }
    }, []);

    // Check for active session on load & listen for cross-tab changes
    useEffect(() => {
        verifySession();

        const handleStorageChange = (e) => {
            if (e.key === "token" || e.key === "user" || e.key === "selectedStudent") {
                if (!localStorage.getItem("token")) {
                    setCurrentUser(null);
                    setSelectedStudent(null);
                } else {
                    const savedUser = localStorage.getItem("user");
                    if (savedUser) {
                        try {
                            setCurrentUser(JSON.parse(savedUser));
                        } catch (err) {
                            console.error("Failed to parse cross-tab user data", err);
                        }
                    }

                    if (e.key === "selectedStudent") {
                        const savedStudent = localStorage.getItem("selectedStudent");
                        try {
                            setSelectedStudent(savedStudent ? JSON.parse(savedStudent) : null);
                        } catch (err) {
                            console.error("Failed to parse cross-tab student data", err);
                        }
                    }
                }
            }
        };

        window.addEventListener("storage", handleStorageChange);
        return () => window.removeEventListener("storage", handleStorageChange);
    }, [verifySession]);

    useEffect(() => {
        if (selectedStudent) {
            localStorage.setItem("selectedStudent", JSON.stringify(selectedStudent));
        } else {
            localStorage.removeItem("selectedStudent");
        }
    }, [selectedStudent]);

    const login = async (usernameOrCode, password, schoolCode) => {
        const result = await authService.login({ usernameOrCode, password, schoolCode });
        if (result.ok) {
            localStorage.setItem("token", result.token);
            localStorage.setItem("user", JSON.stringify(result.user));
            setCurrentUser(result.user);
            toast.success("Successfully logged in!");
            return { success: true, user: result.user };
        }
        toast.error(result.message || "Login failed");
        return { success: false, message: result.message };
    };

    const loginAfterVerification = (user, token) => {
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));
        setCurrentUser(user);
        toast.success("Verification successful! Logged in.");
    };

    const logout = () => {
        setCurrentUser(null);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        toast.success("Logged out successfully");
    };

    const registerAdmin = async (schoolName, firstName, lastName, username, password, email, schoolCode, emailPass = "") => {
        const result = await authService.registerAdmin({ schoolName, firstName, lastName, username, password, email, schoolCode, emailPass });
        if (result.success) {
            toast.success("School Registered!");
            return { success: true, schoolCode: schoolCode, verificationCode: result.verificationCode };
        }
        return { success: false, message: result.message };
    };

    const registerTeacher = async (firstName, lastName, username, password, email, schoolCode, assignments, classTeacherFor = null) => {
        const result = await authService.registerTeacher({ firstName, lastName, username, password, email, schoolCode, assignments, classTeacherFor });
        if (result.success) {
            toast.success("Teacher Registered!");
            return { success: true, verificationCode: result.verificationCode };
        }
        return { success: false, message: result.message };
    };

    const registerStudent = async (firstName, lastName, username, password, schoolCode, className, rollNo, email) => {
        return authService.registerStudent({
            firstName, lastName, username, password, schoolCode, className, rollNo, email
        });
    };

    const registerParent = async (email, username, password, schoolCode, studentCodes, firstName, lastName) => {
        let result;
        if (firstName) {
            result = await authService.registerParent({ firstName, lastName, email, username, password, schoolCode, studentCodes });
        } else {
            result = await authService.registerParent({ email, username, password, schoolCode, studentCodes });
        }

        if (result.success) {
            toast.success("Parent Registered!");
            return { success: true, verificationCode: result.verificationCode };
        }
        return { success: false, message: result.message };
    };

    const verifyEmail = async (email, code) => {
        return authService.verifyEmail(email, code);
    };

    const resendCode = async (email) => {
        return authService.resendCode(email);
    };

    const refreshUser = async () => {
        try {
            const data = await authService.checkAuth();

            if (data.ok && data.user) {
                setCurrentUser(data.user);
                localStorage.setItem("user", JSON.stringify(data.user));
                return data.user;
            }

            return null;
        } catch (err) {
            return null;
        }
    };

    const value = {
        currentUser,
        selectedStudent,
        setSelectedStudent,
        login,
        logout: () => {
            logout();
            setSelectedStudent(null);
        },
        loginAfterVerification,
        refreshUser,
        registerAdmin,
        registerTeacher,
        registerStudent,
        registerParent,
        verifyEmail,
        resendCode,

        getDashboardOverview: dashboardService.getOverview,
        getDashboardTeachers: dashboardService.getTeachers,
        getDashboardMessages: dashboardService.getMessages,
        acceptMessage: dashboardService.acceptMessage,
        rejectMessage: dashboardService.rejectMessage,
        filterTeachers: dashboardService.filterTeachers,
        getStudents: dashboardService.getStudents,
        updateTeacher: dashboardService.updateTeacher,
        deleteTeacher: dashboardService.deleteTeacher,
        updateStudent: dashboardService.updateStudent,
        deleteStudent: dashboardService.deleteStudent,
        getNotifications: dashboardService.getNotifications,
        requestPasswordReset: passwordService.requestReset,
        resetPassword: passwordService.resetPassword,
        getAdminPasswordRequests: passwordService.getAdminRequests,
        approvePasswordRequest: passwordService.approveRequest,
        requestSchoolCode: schoolService.requestRecovery,
        getAdminSchoolCodeRequests: schoolService.getAdminRequests,
        approveSchoolCodeRequest: schoolService.approveRequest,
    };

    return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}
