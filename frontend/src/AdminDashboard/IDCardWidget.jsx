import React, { useState, useEffect } from 'react';
import { dashboardService } from '../../services/api';
import { Download, Printer, RefreshCw, IdCard } from 'lucide-react';
import toast from 'react-hot-toast';

export default function IDCardWidget({ schoolName }) {
    const [classes, setClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        dashboardService.getClasses().then(res => {
            if (res.ok) setClasses(res.data);
        });
    }, []);

    const handleClassChange = async (e) => {
        const clsId = e.target.value;
        setSelectedClass(clsId);
        setSelectedStudent(null);
        if (!clsId) {
            setStudents([]);
            return;
        }

        setLoading(true);
        const res = await dashboardService.getClassStudents(clsId);
        setLoading(false);
        if (res.ok) {
            setStudents(res.data);
            if (res.data.length > 0) setSelectedStudent(res.data[0]);
        }
    };

    const handlePrint = () => {
        if (!selectedStudent) return;
        toast.success("Preparing ID Card for printing...");
        // In a real app, this would trigger a PDF generation. 
        // For now, we simulate a print action
        window.print();
    };

    return (
        <div className="flex flex-col md:flex-row gap-6 h-full">
            {/* Controls */}
            <div className="w-full md:w-1/3 flex flex-col gap-4">
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Select Class</label>
                    <select
                        value={selectedClass}
                        onChange={handleClassChange}
                        className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-blue-500"
                    >
                        <option value="">-- Choose Class --</option>
                        {classes.map(c => (
                            <option key={c.id} value={c.id}>{c.name}{c.section}</option>
                        ))}
                    </select>
                </div>

                {selectedClass && (
                    <div className="flex-1 flex flex-col min-h-0">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2">Students ({students.length})</label>
                        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                            {loading ? (
                                <div className="p-4 text-center text-xs text-slate-400">Loading...</div>
                            ) : students.length === 0 ? (
                                <div className="p-4 text-center text-xs text-slate-400">No students found</div>
                            ) : (
                                students.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => setSelectedStudent(s)}
                                        className={`w-full text-left px-3 py-2 text-xs border-b border-slate-50 truncate hover:bg-slate-50 transition-colors ${selectedStudent?.id === s.id ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600'}`}
                                    >
                                        {s.name} <span className="text-slate-400 ml-1">({s.rollNo})</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Preview */}
            <div className="w-full md:w-2/3 flex flex-col items-center justify-center p-4 bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 relative">
                {!selectedStudent ? (
                    <div className="text-center text-slate-400">
                        <IdCard size={48} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Select a student to generate ID Card</p>
                    </div>
                ) : (
                    <div className="animate-fade-in print:fixed print:top-0 print:left-0 print:w-full print:h-full print:bg-white print:z-[9999] print:flex print:items-center print:justify-center">
                        {/* ID CARD DESIGN */}
                        <div className="w-[320px] h-[500px] bg-white rounded-xl overflow-hidden shadow-2xl relative print:shadow-none print:border print:border-slate-200 print:scale-100">
                            {/* Header Gradient */}
                            <div className="h-32 bg-gradient-to-br from-blue-900 to-blue-700 relative flex flex-col items-center justify-center text-white p-4 text-center">
                                <div className="w-16 h-16 bg-white/10 rounded-full absolute -top-4 -left-4"></div>
                                <div className="w-32 h-32 bg-white/5 rounded-full absolute -bottom-16 -right-8"></div>
                                <h2 className="font-bold text-lg leading-tight uppercase relative z-10">{schoolName || 'School'}</h2>
                                <p className="text-[10px] opacity-80 mt-1 relative z-10">Excellence in Education</p>
                            </div>

                            {/* Photo Overlay */}
                            <div className="relative -mt-12 flex justify-center">
                                <div className="w-24 h-24 rounded-full border-4 border-white bg-slate-200 shadow-md flex items-center justify-center overflow-hidden">
                                    {/* Placeholder Avatar */}
                                    <img
                                        src={`https://ui-avatars.com/api/?name=${selectedStudent.name}&background=random&size=128`}
                                        alt="Student"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </div>

                            {/* Details */}
                            <div className="text-center mt-4 px-6 space-y-4">
                                <div>
                                    <h3 className="font-bold text-xl text-slate-800">{selectedStudent.name}</h3>
                                    <p className="text-sm text-blue-600 font-bold uppercase">{selectedStudent.studentCode}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-y-3 text-left text-xs bg-slate-50 p-4 rounded-lg">
                                    <div>
                                        <p className="text-slate-400 uppercase text-[10px]">Class</p>
                                        <p className="font-bold text-slate-700">{selectedStudent.className}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 uppercase text-[10px]">Roll No</p>
                                        <p className="font-bold text-slate-700">{selectedStudent.rollNo}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 uppercase text-[10px]">DOB</p>
                                        <p className="font-bold text-slate-700">{selectedStudent.dob}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 uppercase text-[10px]">Blood Grp</p>
                                        <p className="font-bold text-slate-700">{selectedStudent.bloodGroup}</p>
                                    </div>
                                </div>

                                {/* QR Code Simulation */}
                                <div className="flex flex-col items-center gap-2">
                                    <div className="bg-white p-1 rounded border border-slate-200">
                                        <img
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${selectedStudent.studentCode}`}
                                            alt="QR"
                                            className="w-20 h-20"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400">Scan to verify identity</p>
                                </div>
                            </div>

                            {/* Bottom Strip */}
                            <div className="absolute bottom-0 w-full h-2 bg-blue-600"></div>
                        </div>

                        {/* Action Buttons (Hidden on Print) */}
                        <div className="absolute top-4 right-4 flex gap-2 print:hidden">
                            <button
                                onClick={handlePrint}
                                className="bg-green-950 hover:bg-green-900 text-white px-3 py-1.5 rounded-lg shadow-lg transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider active:scale-95"
                                title="Generate ID Card"
                            >
                                <Printer size={14} /> Generate File
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
