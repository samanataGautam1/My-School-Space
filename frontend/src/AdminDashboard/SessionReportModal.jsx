import React, { useState, useEffect } from 'react';
import { X, Printer, Download, Mail, FileText, Calendar, CheckCircle, TrendingUp } from 'lucide-react';
import { dashboardService } from '../../services/api';
import toast from 'react-hot-toast';
import { Button } from '../ui/Shared';

const SessionReportModal = ({ isOpen, onClose, studentId, session, year }) => {
    const [loading, setLoading] = useState(true);
    const [report, setReport] = useState(null);

    useEffect(() => {
        if (isOpen && studentId && session && year) {
            fetchReport();
        }
    }, [isOpen, studentId, session, year]);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const res = await dashboardService.getSessionReport(studentId, session, year);
            if (res.ok) {
                setReport(res.data);
            } else {
                toast.error(res.message || "Failed to fetch report");
                onClose();
            }
        } catch (error) {
            console.error("Report Fetch Error:", error);
            toast.error("An error occurred while fetching the report");
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
            <div className="bg-[#fffdfa] rounded-[2.5rem] w-full max-w-5xl h-full max-h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                {/* Header - Non-printable by default, but we'll use CSS to handle it */}
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white flex justify-between items-center no-print">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                            <FileText className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Session Progress Report</h2>
                            <p className="text-slate-400 text-xs">Academic Year {year} • {report?.session}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" onClick={handlePrint} className="bg-white/5 border-white/10 text-white hover:bg-white/10 gap-2">
                            <Printer size={16} /> Print Report
                        </Button>
                        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Report Content */}
                <div className="flex-1 overflow-y-auto p-8 md:p-12 print-container" id="printable-report">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center space-y-4">
                            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-slate-500 font-medium font-outfit">Compiling academic records...</p>
                        </div>
                    ) : report && (
                        <div className="space-y-10 max-w-4xl mx-auto">
                            {/* School & Student Header */}
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-slate-100 pb-8 gap-6">
                                <div className="space-y-4">
                                    <div className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">
                                        {report.schoolName || 'School Report'}
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-2xl font-bold text-slate-900">{report.student.name}</h3>
                                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500 font-medium">
                                            <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-emerald-500" /> Student ID: {report.student.id}</span>
                                            <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-emerald-500" /> Class: {report.student.class}</span>
                                            <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-emerald-500" /> Roll No: {report.student.rollNo}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-slate-50 px-6 py-4 rounded-3xl border border-slate-100 text-right min-w-[200px]">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                                        {report.isLocked ? "Final Session Score" : "Current Session Score"}
                                    </p>
                                    <div className={`text-4xl font-black tracking-tighter ${report.isLocked ? 'text-blue-600' : 'text-emerald-600'}`}>
                                        {report.finalScore.toFixed(1)}%
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-tighter">
                                        {report.isLocked ? "Snapshot Performance" : "Overall Performance"}
                                    </p>
                                    {report.isLocked && (
                                        <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600 text-[9px] font-black text-white rounded-full uppercase tracking-tighter no-print">
                                            <CheckCircle size={10} /> Session Finalized
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Attendance & Assignments Monthly Tables */}
                            <div className="space-y-6">
                                <h4 className="text-sm font-black uppercase tracking-[0.2em] text-[#052e16] flex items-center gap-2">
                                    <Calendar className="w-4 h-4" /> Monthly Progress Tracking
                                </h4>
                                <div className="overflow-x-auto rounded-3xl border border-slate-100 shadow-sm">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/80 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100">
                                                <th className="px-6 py-4">Subject Name</th>
                                                {report.months.map(m => (
                                                    <th key={m} className="px-6 py-4 text-center">Month {m}</th>
                                                ))}
                                                <th className="px-6 py-4 text-right bg-emerald-50/50 text-[#052e16]">Avg</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {report.subjects.map(sub => (
                                                <tr key={sub.id} className="hover:bg-slate-50/30 transition-colors group">
                                                    <td className="px-6 py-4 font-bold text-slate-800 text-sm">{sub.name}</td>
                                                    {sub.monthlyBreakdown.map((mb, idx) => (
                                                        <td key={idx} className="px-6 py-4 text-center">
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-xs font-bold text-slate-700">{mb.assignment.toFixed(0)}%</span>
                                                                <span className="text-[9px] font-medium text-slate-400 uppercase tracking-tighter">Grade</span>
                                                            </div>
                                                        </td>
                                                    ))}
                                                    <td className="px-6 py-4 text-right font-black text-emerald-600 bg-emerald-50/20">
                                                        {(sub.monthlyBreakdown.reduce((sum, b) => sum + b.assignment, 0) / (sub.monthlyBreakdown.length || 1)).toFixed(1)}%
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Exam Metrics */}
                            <div className="space-y-6">
                                <h4 className="text-sm font-black uppercase tracking-[0.2em] text-[#052e16] flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4" /> Subject Performance (Exams)
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {report.subjects.map(sub => (
                                        <div key={sub.id} className="bg-[#fffdfa] border border-slate-100 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all group flex justify-between items-center">
                                            <div>
                                                <h5 className="font-bold text-slate-800 text-sm group-hover:text-emerald-700 transition-colors">{sub.name}</h5>
                                                <p className="text-[10px] text-slate-400 font-medium uppercase mt-1">
                                                    {sub.exams.length > 0 ? sub.exams.map(e => `${e.type}: ${e.marks}/${e.fullMarks}`).join(' | ') : 'No Exam Data'}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xl font-black text-slate-900 italic tracking-tighter">
                                                    {sub.examPercentage.toFixed(1)}%
                                                </div>
                                                <div className="w-16 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${sub.examPercentage}%` }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Footer / Signature Area */}
                            <div className="pt-20 flex justify-between items-end border-t border-dashed border-slate-200">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Generation Date</p>
                                    <p className="text-sm font-bold text-slate-800">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                </div>
                                <div className="flex gap-12 text-center">
                                    <div className="space-y-8 min-w-[150px]">
                                        <div className="border-b border-slate-900 pb-1"></div>
                                        <p className="text-[10px] font-bold uppercase tracking-tighter text-slate-500">Class Head Signature</p>
                                    </div>
                                    <div className="space-y-8 min-w-[150px]">
                                        <div className="border-b border-slate-900 pb-1"></div>
                                        <p className="text-[10px] font-bold uppercase tracking-tighter text-slate-500">Principal Signature</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Print Styles */}
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @media print {
                        .no-print { display: none !important; }
                        body * { visibility: hidden; }
                        #printable-report, #printable-report * { visibility: visible; }
                        #printable-report { 
                            position: absolute; 
                            left: 0; 
                            top: 0; 
                            width: 100%; 
                            padding: 0;
                            margin: 0;
                            height: auto;
                            overflow: visible !important;
                        }
                        .print-container { overflow: visible !important; height: auto !important; max-height: none !important; }
                        .rounded-[2.5rem], .rounded-3xl { border-radius: 0.5rem !important; }
                        .shadow-2xl, .shadow-sm, .shadow-md { box-shadow: none !important; border: 1px solid #e2e8f0 !important; }
                        @page { size: auto; margin: 20mm; }
                    }
                ` }} />
            </div>
        </div >
    );
};

export default SessionReportModal;
