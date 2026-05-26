import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StudentAnalysisView from './StudentAnalysisView';

export default function StudentPerformanceGraph() {
    const { studentId } = useParams();
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-5xl mx-auto">
                <StudentAnalysisView 
                    studentId={studentId} 
                    onBack={() => navigate(-1)} 
                />
            </div>
        </div>
    );
}
