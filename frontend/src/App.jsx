import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./authentication/AuthContext";
import LandingPage from "./authentication/LandingPage";
import RoleSelection from "./authentication/RoleSelection";
import AdminSignup from "./authentication/AdminSignup";
import TeacherSignup from "./authentication/TeacherSignup";
import ParentSignup from "./authentication/ParentSignup";
import StudentSignup from "./authentication/StudentSignup";
import Login from "./authentication/Login";
import SelectChild from "./authentication/SelectChild";
import AdminDashboard from "./AdminDashboard/AdminDashboard";
import ParentDashboard from "./ParentsDashboard/ParentDashboard";
import ForgotPassword from "./authentication/ForgotPassword";
import ForgotSchoolCode from "./authentication/ForgotSchoolCode";
import VerifyEmail from "./authentication/VerifyEmail";
import StudentWelcome from "./StudentDashboard/StudentWelcome";
import StudentDashboard from "./StudentDashboard/StudentDashboard";
import TeacherDashboard from "./TeacherDashboard/TeacherDashboard";
import StudentPerformanceGraph from "./TeacherDashboard/StudentPerformanceGraph";
import TrendlinePage from "./TeacherDashboard/TrendlinePage";
import AttendancePage from "./TeacherDashboard/AttendancePage";
import QuizHistory from "./StudentDashboard/QuizHistory";


function App() {
  return (
    <AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/role-selection" element={<RoleSelection />} />

          {/* Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/admin-signup" element={<AdminSignup />} />
          <Route path="/teacher-signup" element={<TeacherSignup />} />
          <Route path="/parent-signup" element={<ParentSignup />} />
          <Route path="/select-child" element={<SelectChild />} />
          <Route path="/student-signup" element={<StudentSignup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/forgot-school-code" element={<ForgotSchoolCode />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/student-welcome" element={<StudentWelcome />} />


          {/* Dashboards */}
          <Route path="/dashboard/admin" element={<AdminDashboard />} />
          <Route path="/dashboard/teacher" element={<TeacherDashboard />} />
          <Route path="/dashboard/student" element={<StudentDashboard />} />
          <Route path="/dashboard/parent" element={<ParentDashboard />} />
          <Route path="/unique-student/graph/:studentId" element={<StudentPerformanceGraph />} />
          <Route path="/dashboard/teacher/trendline" element={<TrendlinePage />} />
          <Route path="/dashboard/teacher/attendance" element={<AttendancePage />} />
          <Route path="/student/quiz-history" element={<QuizHistory />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}


export default App;
