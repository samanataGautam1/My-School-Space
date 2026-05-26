import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ClassTrendlineView from './ClassTrendlineView';

export default function TrendlinePage() {
    const navigate = useNavigate();
    const location = useLocation();
    const viewMode = location.state?.viewMode || 'performance';

    return (
        <div className="min-h-screen bg-beige">
            <header className="bg-beige border-b border-slate-200 sticky top-0 z-30 px-4 py-4 sm:px-8">
                <div className="max-w-7xl mx-auto flex items-center gap-4">
                    <h1 className="text-xl font-bold text-slate-800">Trendline Graph Preparation</h1>
                </div>
            </header>
            <main className="max-w-7xl mx-auto px-4 py-8 sm:px-8">
                <ClassTrendlineView 
                    onBack={() => navigate('/dashboard/teacher')} 
                    isInline={false} 
                    initialViewMode={viewMode}
                />
            </main>
        </div>
    );
}

