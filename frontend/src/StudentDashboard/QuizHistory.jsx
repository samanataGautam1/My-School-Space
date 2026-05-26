import React, { useEffect, useState } from 'react';
import { useAuth } from '../authentication/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, BookOpen, Clock, CheckCircle, XCircle, MessageSquare, Award } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function QuizHistory() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await api.get('/api/materials/quiz/history');
                if (res.data.ok) {
                    setHistory(res.data.data);
                }
            } catch (e) {
                console.error("Failed to fetch quiz history", e);
                toast.error("Failed to load quiz history");
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, []);

    return (
        <div className="min-h-screen bg-[#f5f2ed] p-4 md:p-8 font-inter">
            <div className="max-w-4xl mx-auto">
                <button 
                    onClick={() => navigate('/student-dashboard')}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors mb-6 font-medium text-sm"
                >
                    <ChevronLeft size={20} />
                    Back to Dashboard
                </button>

                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 shadow-sm border border-amber-100">
                        <Award size={28} />
                    </div>
                    <div>
                        <h1 className="text-xl font-medium text-slate-800 tracking-tight leading-none">Quiz History</h1>
                        <p className="text-slate-500 text-[11px] font-medium mt-1">Review your solved questions and teacher feedback</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
                        <p className="text-slate-400 mt-4 font-medium text-xs uppercase tracking-widest">Loading History...</p>
                    </div>
                ) : history.length > 0 ? (
                    <div className="space-y-4">
                        {history.map((resp) => (
                            <div key={resp.id} className="bg-[#fffdfa] rounded-2xl border border-slate-200 shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-medium rounded uppercase border border-slate-200">
                                                    {resp.question.quizset.studyMaterial.subject}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                                                    <Clock size={11} />
                                                    {new Date(resp.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <h3 className="font-medium text-slate-800 text-[13px]">{resp.question.quizset.studyMaterial.title}</h3>
                                        </div>
                                        {resp.isCorrect !== null && (
                                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider ${
                                                resp.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                                {resp.isCorrect ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                                {resp.isCorrect ? 'Correct' : 'Incorrect'}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-4">
                                        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                            <p className="text-[9px] font-medium text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                                <BookOpen size={12} className="text-emerald-500" />
                                                Question
                                            </p>
                                            <p className="text-[13px] text-slate-700 font-medium leading-relaxed">{resp.question.text}</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/30">
                                                <p className="text-[9px] font-medium text-emerald-600 uppercase tracking-widest mb-2">Your Answer</p>
                                                <p className="text-[13px] text-slate-700 font-medium">{resp.answer}</p>
                                            </div>

                                            {resp.feedback && (
                                                <div className="p-4 rounded-xl border border-amber-100 bg-amber-50/30 ring-2 ring-amber-500/5">
                                                    <p className="text-[9px] font-medium text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                                        <MessageSquare size={12} />
                                                        Teacher Feedback
                                                    </p>
                                                    <p className="text-[13px] text-slate-700 italic font-medium leading-relaxed">"{resp.feedback}"</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-[#fffdfa] rounded-3xl border-2 border-dashed border-slate-200">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 grayscale opacity-40">
                            <BookOpen size={32} className="text-slate-400" />
                        </div>
                        <h3 className="text-slate-800 font-medium uppercase tracking-tight text-lg">No Quizzes Solved Yet</h3>
                        <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">Complete video classes and solve the interactive quizzes to see your history here.</p>
                        <button 
                            onClick={() => navigate('/student-dashboard')}
                            className="mt-8 px-6 py-3 bg-[#052e16] text-white rounded-xl font-medium text-sm hover:bg-[#042f24] transition-colors shadow-lg shadow-emerald-900/10"
                        >
                            Go to Dashboard
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
