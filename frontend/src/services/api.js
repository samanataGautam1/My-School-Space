import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '',
    headers: {
        'Content-Type': 'application/json'
    }
});


api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    console.log(`[API REQUEST] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Add response interceptor to handle 401 (Unauthorized)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            const isAuthCheck = error.config?.url?.includes('/api/auth/me') || error.config?.url?.includes('/api/login');

            if (isAuthCheck || !localStorage.getItem('token')) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }

            // Suppress error for auth checks — they're expected to fail when logged out
            if (error.config?.url?.includes('/api/auth/me')) {
                return Promise.reject({ silent: true, ...error });
            }
        }
        return Promise.reject(error);
    }
);



export const authService = {
    login: async (credentials) => {
        try {
            const response = await api.post('/api/login', credentials);
            if (response.data.token) {
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('user', JSON.stringify(response.data.user));
            }
            return response.data;
        } catch (error) {
            return {
                ok: false,
                message: error.response?.data?.error || 'Login failed'
            };
        }
    },

    checkAuth: async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return { ok: false };

            const response = await api.get('/api/auth/me');
            return response.data;
        } catch (error) {
            return { ok: false, error: 'Session invalid' };
        }
    },

    registerAdmin: async (data) => {
        try {
            // Transform data to match backend expectations
            const [firstName, ...lastNameParts] = data.adminName.split(' ');
            const lastName = lastNameParts.join(' ') || firstName;

            const payload = {
                username: data.username,
                password: data.password,
                firstName: firstName,
                lastName: lastName,
                schoolName: data.schoolName,
                schoolCode: data.schoolCode,
                email: data.email
            };

            const response = await api.post('/api/signup/admin', payload);
            return {
                success: response.data.ok,
                school: response.data.school,
                message: response.data.message,
                verificationCode: response.data.verificationCode
            };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.error || 'Registration failed'
            };
        }
    },

    registerTeacher: async (data) => {
        try {
            // Transform data to match backend expectations
            const [firstName, ...lastNameParts] = data.name.split(' ');
            const lastName = lastNameParts.join(' ') || firstName;

            const payload = {
                username: data.username,
                password: data.password,
                firstName: firstName,
                lastName: lastName,
                schoolCode: data.schoolCode,
                assignments: data.assignments,
                email: data.email,
                classTeacherFor: data.classTeacherFor
            };

            const response = await api.post('/api/signup/teacher', payload);
            return {
                success: response.data.ok,
                message: response.data.message,
                verificationCode: response.data.verificationCode
            };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.error || 'Registration failed'
            };
        }
    },

    registerStudent: async (data) => {
        try {
            // Transform data to match backend expectations
            const [firstName, ...lastNameParts] = data.name.split(' ');
            const lastName = lastNameParts.join(' ') || firstName;

            const payload = {
                username: data.username,
                password: data.password,
                firstName: firstName,
                lastName: lastName,
                schoolCode: data.schoolCode,
                className: data.className,
                rollNo: data.rollNo
            };

            const response = await api.post('/api/signup/student', payload);
            return {
                success: response.data.ok,
                studentCode: response.data.studentCode,
                message: response.data.message,
                verificationCode: response.data.verificationCode
            };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.error || 'Registration failed'
            };
        }
    },

    registerParent: async (data) => {
        try {
            // Transform data to match backend expectations
            const [firstName, ...lastNameParts] = (data.name || '').split(' ');
            const lastName = lastNameParts.join(' ') || firstName || '';

            const payload = {
                username: data.username,
                password: data.password,
                firstName: firstName || 'Parent',
                lastName: lastName || 'User',
                email: data.email,
                studentCodes: Array.isArray(data.studentCode) ? data.studentCode : [data.studentCode]
            };

            const response = await api.post('/api/signup/parent', payload);
            return {
                success: response.data.ok,
                message: response.data.message,
                verificationCode: response.data.verificationCode
            };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.error || 'Registration failed'
            };
        }
    },

    registerParentWithName: async (data) => {
        return authService.registerParent(data);
    },

    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
};

export const teacherService = {
    getOverview: async () => {
        try {
            const response = await api.get('/api/teacher/dashboard/overview');
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to fetch overview' };
        }
    },
    getStudentsByClass: async (classId) => {
        try {
            const response = await api.get(`/api/teacher/dashboard/class/${classId}/students`);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to fetch students' };
        }
    },
    getUpcomingLessons: async () => {
        try {
            const response = await api.get('/api/teacher/dashboard/upcoming-lessons');
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to fetch lessons' };
        }
    },
    getTeacherProfile: async () => {
        try {
            const response = await api.get('/api/teacher/dashboard/profile');
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to fetch profile' };
        }
    },
    updateStudentPotential: async (studentId, data) => {
        try {
            const response = await api.post(`/api/teacher/dashboard/student/${studentId}/potential`, data);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to update potential' };
        }
    }
};

export const parentService = {
    getOverview: async () => {
        try {
            const response = await api.get('/api/parent/dashboard/overview');
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to fetch overview' };
        }
    },
    getNotifications: async () => {
        try {
            const response = await api.get('/api/parent/dashboard/notifications');
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to fetch notifications' };
        }
    },
    getAttendance: async (studentId) => {
        try {
            const response = await api.get(`/api/parent/dashboard/child/${studentId}/attendance`);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to fetch attendance' };
        }
    },
    getExams: async (studentId) => {
        try {
            const response = await api.get(`/api/parent/dashboard/student/${studentId}/exams`);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to fetch exams' };
        }
    },
    getPublishedTerminals: async (studentId) => {
        try {
            const response = await api.get(`/api/parent/dashboard/child/${studentId}/terminals`);
            return response.data;
        } catch (error) {
            return { ok: false, message: 'Failed to fetch terminals' };
        }
    },
    getTerminalMarks: async (studentId, terminal) => {
        try {
            const response = await api.get(`/api/parent/dashboard/child/${studentId}/terminal-marks`, { params: { terminal } });
            return response.data;
        } catch (error) {
            return { ok: false, message: 'Failed to fetch marks' };
        }
    },
    getGradeSheet: async (studentId, terminal) => {
        try {
            const response = await api.get(`/api/parent/dashboard/student/${studentId}/grade-sheet/${terminal}`);
            return response.data;
        } catch (error) {
            return { ok: false, message: 'Failed to fetch grade sheet' };
        }
    },
    getChildAssignments: async () => {
        try {
            const response = await api.get('/api/parent/dashboard/children/assignments');
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to fetch assignments' };
        }
    },
    getChildAttendance: async (studentId, month, year) => {
        try {
            const params = {};
            if (month) params.month = month;
            if (year) params.year = year;
            const response = await api.get(`/api/parent/dashboard/child/${studentId}/attendance`, { params });
            return response.data;
        } catch (error) {
            return { ok: false, message: 'Failed to fetch attendance' };
        }
    }
};

export const dashboardService = {
    getOverview: async (session, year) => {
        try {
            const response = await api.get('/api/admin/overview', { params: { session, year } });
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to fetch overview' };
        }
    },
    getTeachers: async () => {
        try {
            const response = await api.get(`/api/admin/teachers-by-class?_t=${Date.now()}`);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to fetch teachers' };
        }
    },
    getMessagesRequests: async () => {
        try {
            const response = await api.get('/api/admin/messages/requests');
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to fetch requests' };
        }
    },
    acceptMessage: async (id) => {
        try {
            const response = await api.post(`/api/admin/messages/${id}/accept`);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to accept message' };
        }
    },
    deleteMessage: async (id) => {
        try {
            const response = await api.delete(`/api/admin/messages/${id}`);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to delete message' };
        }
    },
    rejectMessage: async (id) => {
        try {
            const response = await api.post(`/api/admin/messages/${id}/reject`);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to reject message' };
        }
    },
    processMessageAction: async (id, action) => {
        if (action === 'ACCEPT') {
            return dashboardService.acceptMessage(id);
        } else if (action === 'REJECT') {
            return dashboardService.rejectMessage(id);
        } else if (action === 'DELETE') {
            return dashboardService.deleteMessage(id);
        }
        return { ok: false, message: 'Invalid action' };
    },
    getTeacherRatings: (subject, className, session, year) => api.get(`/api/admin/teacher-ratings?subject=${subject || ''}&className=${className || ''}&session=${session || ''}&year=${year || ''}`).then(res => res.data),
    getReviews: (subject, className) => api.get(`/api/admin/reviews?subject=${subject || ''}&className=${className || ''}`).then(res => res.data),
    updateRatingSettings: (enabled, session, year) => api.patch('/api/admin/settings/ratings', { enabled, session, year }).then(res => res.data),
    updateSettings: async (data) => {
        try {
            const response = await api.patch('/api/admin/settings', data);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to update settings' };
        }
    },
    updateSchoolIdentity: async (data) => {
        try {
            const response = await api.patch('/api/admin/school-identity', data);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to update school identity' };
        }
    },
    getConversation: async (userId) => {
        try {
            const response = await api.get(`/api/admin/messages/conversation/${userId}`);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to fetch conversation' };
        }
    },
    sendReply: async (data, file) => {
        try {
            const payload = new FormData();
            payload.append('toUserId', data.toUserId);
            payload.append('body', data.body || '');
            if (data.subject) payload.append('subject', data.subject);
            if (file) payload.append('file', file);
            const response = await api.post('/api/admin/messages/reply', payload);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to send reply' };
        }
    },
    filterTeachers: async (subject, className) => {
        try {
            const response = await api.get('/api/admin/teachers/filter', { params: { subject, className } });
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to filter teachers' };
        }
    },
    getStudents: async (name, className) => {
        try {
            const response = await api.get('/api/admin/students', { params: { name, className } });
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to fetch students' };
        }
    },
    updateTeacher: async (id, data) => {
        try {
            const response = await api.patch(`/api/admin/teachers/${id}`, data);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to update teacher' };
        }
    },
    deleteTeacher: async (id) => {
        try {
            const response = await api.delete(`/api/admin/teachers/${id}`);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to delete teacher' };
        }
    },
    updateTeacherStatus: async (id, status) => {
        try {
            const response = await api.patch(`/api/admin/teachers/${id}/status`, { status });
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to update status' };
        }
    },
    inquireTeacherLeave: async (id) => {
        try {
            const response = await api.post(`/api/admin/teachers/${id}/inquiry`);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to send inquiry' };
        }
    },
    updateStudent: async (id, data) => {
        try {
            const response = await api.patch(`/api/admin/students/${id}`, data);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to update student' };
        }
    },
    deleteStudent: async (id) => {
        try {
            const response = await api.delete(`/api/admin/students/${id}`);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to delete student' };
        }
    },
    getNotifications: async () => {
        try {
            const response = await api.get('/api/admin/notifications');
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to fetch notifications' };
        }
    },
    markNotificationsRead: async () => {
        try {
            const response = await api.patch('/api/admin/notifications/read');
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to mark read' };
        }
    },
    getClasses: async () => {
        try {
            const response = await api.get('/api/admin/classes');
            return response.data;
        } catch (error) {
            return { ok: false, message: 'Failed to fetch classes' };
        }
    },
    getClassStudents: async (classId) => {
        try {
            const response = await api.get(`/api/admin/classes/${classId}/students`);
            return response.data;
        } catch (error) {
            return { ok: false, message: 'Failed to fetch students' };
        }
    },
    getFinancialStats: async (period) => {
        try {
            const response = await api.get('/api/admin/dashboard/financial-stats', { params: { period } });
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to fetch financial stats' };
        }
    },
    getPendingTeachers: async () => {
        try {
            const response = await api.get('/api/admin/pending-teachers');
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to fetch pending teachers' };
        }
    },
    approveTeacher: async (id) => {
        try {
            const response = await api.patch(`/api/admin/teachers/${id}/approve`);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to approve teacher' };
        }
    },
    rejectTeacher: async (id) => {
        try {
            const response = await api.patch(`/api/admin/teachers/${id}/reject`);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to reject teacher' };
        }
    },
    getClassOverview: async () => {
        try {
            const response = await api.get('/api/admin/classes/overview');
            return response.data;
        } catch (error) {
            return { ok: false, message: 'Failed to fetch academic data' };
        }
    },
    getSubjects: async () => {
        try {
            const response = await api.get('/api/admin/subjects');
            return response.data;
        } catch (error) {
            return { ok: false, message: 'Failed to fetch subjects' };
        }
    },
    createClass: async (data) => {
        try {
            const response = await api.post('/api/admin/classes', data);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to create class' };
        }
    },
    createSubject: async (data) => {
        try {
            const response = await api.post('/api/admin/subjects', data);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to create subject' };
        }
    },
    assignTeacher: async (data) => {
        try {
            const response = await api.post('/api/admin/classes/assign-teacher', data);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to assign teacher' };
        }
    },
    deleteClass: async (id) => {
        try {
            const response = await api.delete(`/api/admin/classes/${id}`);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to delete class' };
        }
    },
    getClassDetails: async (id) => {
        try {
            const response = await api.get(`/api/admin/classes/${id}/details`);
            return response.data;
        } catch (error) {
            return { ok: false, message: 'Failed to fetch class details' };
        }
    },
    // Assign Class Head
    assignClassTeacher: async (classId, teacherId) => {
        try {
            const response = await api.patch(`/api/admin/classes/${classId}/assign-class-teacher`, { teacherId });
            return response.data;
        } catch (error) {
            return { ok: false, message: 'Failed to assign class head' };
        }
    },
    removeTeacherFromClass: async (classId, teacherId) => {
        try {
            const response = await api.delete(`/api/admin/classes/${classId}/teachers/${teacherId}`);
            return response.data;
        } catch (error) {
            return { ok: false, message: 'Failed to remove teacher from class' };
        }
    },
    getExamSubmissions: async (examTerminal) => {
        try {
            const response = await api.get('/api/admin/exam-submissions', { params: { examTerminal } });
            return response.data;
        } catch (error) {
            return { ok: false, message: 'Failed to fetch exam submissions' };
        }
    },
    publishTerminal: async (terminal, schoolDetails = null) => {
        try {
            const response = await api.post('/api/admin/publish-terminal', {
                examTerminal: terminal,
                schoolDetails: schoolDetails
            });
            return response.data;
        } catch (error) {
            return { ok: false, message: 'Failed to publish results' };
        }
    },
    runCalculation: async (terminal) => {
        try {
            const response = await api.post('/api/admin/run-calculation', { examTerminal: terminal });
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to run calculations' };
        }
    },
    getClassResults: async (classId, terminal) => {
        try {
            const response = await api.get(`/api/admin/classes/${classId}/results`, { params: { terminal } });
            return response.data;
        } catch (error) {
            return { ok: false, message: 'Failed to fetch results' };
        }
    },
    getResultsHistory: async () => {
        try {
            const response = await api.get('/api/admin/results-history');
            return response.data;
        } catch (error) {
            return { ok: false, message: 'Failed to fetch results history' };
        }
    },
    advanceSession: async () => {
        try {
            const response = await api.post('/api/admin/advance-session');
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to advance session' };
        }
    },
    graduateClass10Early: async (confirmation, year) => {
        try {
            const response = await api.post('/api/admin/graduate-class10-early', { confirmation, year });
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to graduate Class 10' };
        }
    },
    getClass10Status: async () => {
        try {
            const response = await api.get('/api/admin/class10-status');
            return response.data;
        } catch (error) {
            return { ok: false, isFourthSession: false, total: 0, graduated: 0, remaining: 0, allGraduated: false };
        }
    },
    getSessionChecklist: async () => {
        try {
            const response = await api.get('/api/admin/session-checklist');
            return response.data;
        } catch (error) {
            return { ok: false, checklist: null, allPassed: false };
        }
    },
    startSession: async (session, year, confirmation) => {
        try {
            const response = await api.post('/api/admin/start-session', { session, year, confirmation });
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to start session' };
        }
    },
    endSession: async (confirmation) => {
        try {
            const response = await api.post('/api/admin/end-session', { confirmation });
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to end session' };
        }
    },
    getSessionHistory: async () => {
        try {
            const response = await api.get('/api/admin/session-history');
            return response.data;
        } catch (error) {
            return { ok: false, message: 'Failed to fetch session history' };
        }
    },
    previewAdvanceSession: async () => {
        try {
            const response = await api.get('/api/admin/advance-session/preview');
            return response.data;
        } catch (error) {
            return { ok: false, message: 'Failed to preview session advance' };
        }
    },
    getPromotions: async (classId) => {
        try {
            const params = {};
            if (classId) params.classId = classId;
            const response = await api.get('/api/admin/promotions', { params });
            return response.data;
        } catch (error) {
            return { ok: false, message: 'Failed to fetch promotion data' };
        }
    },
    promoteStudent: async (studentId) => {
        try {
            const response = await api.post(`/api/admin/promotions/${studentId}/promote`);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to promote student' };
        }
    },
    retainStudent: async (studentId) => {
        try {
            const response = await api.post(`/api/admin/promotions/${studentId}/retain`);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to retain student' };
        }
    },
    graduateStudent: async (studentId) => {
        try {
            const response = await api.post(`/api/admin/promotions/${studentId}/graduate`);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to graduate student' };
        }
    },
    bulkPromote: async () => {
        try {
            const response = await api.post('/api/admin/promotions/bulk');
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to run bulk promotion' };
        }
    },
    getGraduations: async () => {
        try {
            const response = await api.get('/api/admin/graduations');
            return response.data;
        } catch (error) {
            return { ok: false, message: 'Failed to fetch graduations' };
        }
    },
    getGraduatedBatches: async () => {
        try {
            const response = await api.get('/api/admin/graduated-batches');
            return response.data;
        } catch (error) {
            return { ok: false, message: 'Failed to fetch graduated batches' };
        }
    },
    broadcastNotice: async (message) => {
        try {
            const response = await api.post('/api/admin/broadcast-notice', { message });
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to broadcast' };
        }
    }
};


export const passwordService = {
    requestReset: async (data) => {
        try {
            const response = await api.post('/api/password/request', data);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to request reset' };
        }
    },
    resetPassword: async (data) => {
        try {
            const response = await api.post('/api/password/reset', data);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to reset password' };
        }
    },
    getAdminRequests: async () => {
        try {
            const response = await api.get('/api/password/admin/requests');
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to fetch password requests' };
        }
    },
    approveRequest: async (id) => {
        try {
            const response = await api.post(`/api/password/admin/approve/${id}`);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to approve password request' };
        }
    },
    rejectRequest: async (id) => {
        try {
            const response = await api.post(`/api/password/admin/reject/${id}`);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to reject password request' };
        }
    }
};

export const schoolService = {
    requestRecovery: async (data) => {
        try {
            const response = await api.post('/api/school-code/request', data);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to request school code' };
        }
    },
    getAdminRequests: async () => {
        try {
            const response = await api.get('/api/school-code/admin/requests');
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to fetch school code requests' };
        }
    },
    approveRequest: async (id) => {
        try {
            const response = await api.post(`/api/school-code/admin/approve/${id}`);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to approve school code request' };
        }
    },
    rejectRequest: async (id, reason) => {
        try {
            const response = await api.post(`/api/school-code/admin/reject/${id}`, { reason });
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to reject school code request' };
        }
    }
};

export const studentService = {
    getDashboard: async () => {
        try {
            const response = await api.get('/api/student/dashboard');
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to fetch dashboard' };
        }
    },
    getSettings: async () => {
        try {
            const response = await api.get('/api/student/settings');
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to fetch settings' };
        }
    },
    getTeachers: async () => {
        try {
            const response = await api.get('/api/student/teachers');
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to fetch teachers' };
        }
    },
    rateTeacher: async (data) => {
        try {
            const response = await api.post('/api/student/rate', data);
            return response.data;
        } catch (error) {
            return { ok: false, error: error.response?.data?.error || 'Failed to submit rating' };
        }
    },
    getNotifications: async () => {
        try {
            const response = await api.get('/api/student/notifications');
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to fetch notifications' };
        }
    },
    getPublishedTerminals: async () => {
        try {
            const response = await api.get('/api/student/results/terminals');
            return response.data;
        } catch (error) {
            return { ok: false, message: 'Failed to fetch terminals' };
        }
    },
    getGradeSheet: async (terminal) => {
        try {
            const response = await api.get(`/api/student/results/grade-sheet/${encodeURIComponent(terminal)}`);
            return response.data;
        } catch (error) {
            return { ok: false, message: 'Failed to fetch grade sheet' };
        }
    },
    getAttendanceHistory: async (month, year) => {
        try {
            const params = {};
            if (month) params.month = month;
            if (year) params.year = year;
            const response = await api.get('/api/student/attendance', { params });
            return response.data;
        } catch (error) {
            return { ok: false, message: 'Failed to fetch attendance' };
        }
    },
    getPromotionStatus: async () => {
        try {
            const response = await api.get('/api/student/promotion-status');
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to fetch promotion status' };
        }
    },
    acknowledgePromotion: async () => {
        try {
            const response = await api.post('/api/student/acknowledge-promotion');
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to acknowledge promotion' };
        }
    },
};

export const attendanceService = {
    getStudents: async (classId) => {
        try {
            const response = await api.get(`/api/attendance/students/${classId}`);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to fetch students' };
        }
    },
    saveAttendance: async (data) => {
        try {
            const response = await api.post('/api/attendance/save', data);
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to save attendance' };
        }
    },
    getAttendanceHistory: async (classId, year, month) => {
        try {
            const response = await api.get(`/api/attendance/history/${classId}`, {
                params: { year, month }
            });
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to fetch history' };
        }
    },
    getClasses: async () => {
        try {
            const response = await api.get('/api/attendance/classes');
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to fetch classes' };
        }
    }
};

api.getStudentSettings = studentService.getSettings;
api.getStudentTeachers = studentService.getTeachers;
api.rateTeacher = studentService.rateTeacher;

export default api;
