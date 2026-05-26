import api from '../services/api';

/**
 * teacherService – used by AttendancePage and other teacher-facing components.
 */
const teacherService = {
    /**
     * Fetch the teacher's class-head details including the students list.
     * 1. GET /api/teacher/dashboard/profile  → teacher.classHead (class info)
     * 2. GET /api/attendance/students/:classId → students for that class
     * Returns { ok, data: { id, name, section, students[] } }
     */
    getClassHead: async (userId) => {
        try {
            // Step 1: get teacher profile which includes classHead info
            const profileRes = await api.get('/api/teacher/dashboard/profile');
            if (!profileRes.data?.ok) {
                return { ok: false, message: profileRes.data?.error || 'Failed to fetch teacher profile' };
            }

            const classHead = profileRes.data.data?.classHead;
            if (!classHead) {
                return { ok: false, message: 'You are not assigned as a class head.' };
            }

            // Step 2: get students in that class
            const studentsRes = await api.get(`/api/attendance/students/${classHead.id}`);
            if (!studentsRes.data?.ok) {
                return { ok: false, message: studentsRes.data?.error || 'Failed to fetch students' };
            }

            return {
                ok: true,
                data: {
                    id: classHead.id,
                    name: classHead.name,
                    section: classHead.section,
                    students: studentsRes.data.data || []
                }
            };
        } catch (error) {
            return {
                ok: false,
                message: error.response?.data?.error || error.message || 'Failed to fetch class head data'
            };
        }
    },

    getOverview: async () => {
        try {
            const response = await api.get('/api/teacher/dashboard/overview');
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to fetch overview' };
        }
    },

    // Assign Class Head
    assignClassTeacher: async (id, teacherId) => {
        try {
            const response = await api.patch(`/admin/classes/${id}/assign-class-teacher`, { teacherId });
            return response.data;
        } catch (error) {
            return { ok: false, message: 'Failed to assign class head' };
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

    getTeacherProfile: async () => {
        try {
            const response = await api.get('/api/teacher/dashboard/profile');
            return response.data;
        } catch (error) {
            return { ok: false, message: error.response?.data?.error || 'Failed to fetch profile' };
        }
    }
};

export default teacherService;
