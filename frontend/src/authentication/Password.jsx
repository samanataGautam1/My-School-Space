import React, { useState } from 'react';
import { requestPasswordReset, resetPassword } from '../api';

const Password = () => {
    const [step, setStep] = useState(1); // 1: Request, 2: Enter Code
    const [formData, setFormData] = useState({
        usernameOrEmail: '',
        schoolCode: '',
        code: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [requiresApproval, setRequiresApproval] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError('');
    };

    const handleRequestReset = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        try {
            const response = await requestPasswordReset({
                usernameOrEmail: formData.usernameOrEmail,
                schoolCode: formData.schoolCode
            });

            setMessage(response.message);
            setRequiresApproval(response.requiresApproval);

            if (!response.requiresApproval) {
                setStep(2);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to request password reset');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();

        // Validate passwords match
        if (formData.newPassword !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        // Validate password requirements
        if (formData.newPassword.length < 8) {
            setError('Password must be at least 8 characters long');
            return;
        }

        if (!/[A-Z]/.test(formData.newPassword)) {
            setError('Password must contain at least one uppercase letter');
            return;
        }

        if (!/\d/.test(formData.newPassword)) {
            setError('Password must contain at least one number');
            return;
        }

        setLoading(true);
        setError('');
        setMessage('');

        try {
            const response = await resetPassword({
                usernameOrEmail: formData.usernameOrEmail,
                schoolCode: formData.schoolCode,
                code: formData.code,
                newPassword: formData.newPassword
            });

            setMessage(response.message);

            // Redirect to login after 2 seconds
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
                <h2 className="text-3xl font-bold text-green-800 mb-6 text-center">
                    Forgot Password
                </h2>

                {message && (
                    <div className={`mb-4 p-4 rounded-lg ${requiresApproval ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
                        <p className={`text-sm ${requiresApproval ? 'text-yellow-800' : 'text-green-800'}`}>
                            {message}
                        </p>
                    </div>
                )}

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800">{error}</p>
                    </div>
                )}

                {step === 1 && (
                    <form onSubmit={handleRequestReset} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Username or Email
                            </label>
                            <input
                                type="text"
                                name="usernameOrEmail"
                                value={formData.usernameOrEmail}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                placeholder="Enter your username or email"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                School Code
                            </label>
                            <input
                                type="text"
                                name="schoolCode"
                                value={formData.schoolCode}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                placeholder="Enter your school code"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-green-950 hover:bg-green-900 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Processing...' : 'Request Password Reset'}
                        </button>
                    </form>
                )}

                {step === 2 && (
                    <form onSubmit={handleResetPassword} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Verification Code
                            </label>
                            <input
                                type="text"
                                name="code"
                                value={formData.code}
                                onChange={handleChange}
                                required
                                maxLength={6}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-center text-2xl tracking-widest"
                                placeholder="000000"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Enter the 6-digit code sent to your email
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                New Password
                            </label>
                            <input
                                type="password"
                                name="newPassword"
                                value={formData.newPassword}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                placeholder="Enter new password"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Min 8 characters, 1 uppercase, 1 number
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Confirm Password
                            </label>
                            <input
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                placeholder="Confirm new password"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-green-950 hover:bg-green-900 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Resetting...' : 'Reset Password'}
                        </button>

                        <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="w-full text-green-600 py-2 text-sm hover:underline"
                        >
                            Back to request form
                        </button>
                    </form>
                )}

                <div className="mt-6 text-center">
                    <a href="/login" className="text-sm text-green-600 hover:underline">
                        Back to Login
                    </a>
                </div>
            </div>
        </div>
    );
};

export default Password;
