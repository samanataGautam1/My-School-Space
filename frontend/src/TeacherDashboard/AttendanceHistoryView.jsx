import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, Loader2, User, CheckCircle, XCircle, Info, FileText, Search } from 'lucide-react';
import attendanceService from './attendanceService';
import toast from 'react-hot-toast';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

export default function AttendanceHistoryView({ classId, onBack }) {
    const [historyData, setHistoryData] = useState([]);
    const [viewType, setViewType] = useState('detailed'); // 'detailed' or 'aggregated'
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters
    const now = new Date();
    const [year] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [selectedDate, setSelectedDate] = useState(null);

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            setError(null);
            try {
                const result = await attendanceService.getAttendanceHistory(
                    classId,
                    year,
                    month
                );
                if (result.ok) {
                    setHistoryData(result.data);
                    setViewType(result.type);
                } else {
                    setError(result.message || "Failed to load history");
                }
            } catch (err) {
                setError("An error occurred while fetching history data.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        if (classId) {
            fetchHistory();
        }
    }, [classId, year, month]);

    // Derived: filtered history data if a specific date is selected (only for detailed view)
    const filteredData = (viewType === 'detailed' && selectedDate)
        ? historyData.filter(record => {
            const d = new Date(record.date);
            return d.getDate() === selectedDate.getDate() &&
                d.getMonth() === selectedDate.getMonth() &&
                d.getFullYear() === selectedDate.getFullYear();
        })
        : historyData;

    // Date constraints for the picker
    const minDate = new Date(year, month - 1, 1);
    const maxDate = new Date(year, month, 0); // Last day of chosen month

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-600"
                        title="Go Back"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h2 className="text-base font-medium text-gray-900 flex items-center gap-2">
                            <CalendarIcon className="h-5 w-5 text-green-700" />
                            Attendance History
                        </h2>
                        <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                            Archive — {months[month - 1]} {year}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">

                    {viewType === 'detailed' && (
                        <div className="relative">
                            <DatePicker
                                selected={selectedDate}
                                onChange={(date) => setSelectedDate(date)}
                                placeholderText="Filter by date"
                                className="pl-9 pr-3 py-2 text-[13px] bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-600 transition-all w-40 font-medium cursor-pointer"
                                dateFormat="MMM d, yyyy"
                                minDate={minDate}
                                maxDate={maxDate}
                                isClearable
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                        </div>
                    )}

                    <select
                        value={month}
                        onChange={(e) => {
                            setMonth(parseInt(e.target.value));
                            setSelectedDate(null);
                        }}
                        className="text-[13px] font-medium bg-white border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-600 transition-all cursor-pointer"
                    >
                        {months.map((m, i) => (
                            <option key={m} value={i + 1}>{m}</option>
                        ))}
                    </select>

                    <div className="text-[13px] font-medium bg-gray-200 text-gray-700 px-4 py-2 rounded-lg border border-gray-300">
                        {year}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="p-6 min-h-[400px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-green-700" />
                        <p className="text-[13px] font-medium text-gray-500">Loading history logs...</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-3">
                            <Info className="h-6 w-6" />
                        </div>
                        <h3 className="text-gray-900 font-medium mb-1">Could Not Load History</h3>
                        <p className="text-[13px] text-gray-500 max-w-xs">{error}</p>
                    </div>
                ) : filteredData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                        <div className="w-12 h-12 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mb-3">
                            <FileText className="h-6 w-6" />
                        </div>
                        <h3 className="text-gray-900 font-medium mb-1">No Records Found</h3>
                        <p className="text-[13px] text-gray-500">
                            {selectedDate
                                ? `No attendance records for ${selectedDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long' })}.`
                                : `There are no attendance records for ${months[month - 1]} ${year}.`}
                        </p>
                        {selectedDate && (
                            <button
                                onClick={() => setSelectedDate(null)}
                                className="mt-4 text-[13px] font-medium text-green-700 hover:text-green-800"
                            >
                                Clear Date Filter
                            </button>
                        )}
                    </div>
                ) : viewType === 'detailed' ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-[13px]">
                            <thead>
                                <tr className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Student</th>
                                    <th className="px-4 py-3">Roll</th>
                                    <th className="px-4 py-3 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredData.map((record, i) => (
                                    <tr key={record.id || i} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-gray-600">
                                            {new Date(record.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-medium text-slate-500">
                                                    <User className="h-3 w-3" />
                                                </div>
                                                <span className="font-medium text-gray-900">
                                                    {record.student?.user?.firstName || 'Unknown'} {record.student?.user?.lastName || ''}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 font-medium">#{record.student?.rollNo}</td>
                                        <td className="px-4 py-3 text-right text-[10px]">
                                            <span className={`inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded uppercase tracking-tighter
                                                ${record.status === 'P' ? 'bg-green-100 text-green-700' : 
                                                  record.status === 'H' ? 'bg-amber-100 text-amber-700' : 
                                                  record.status === 'S' ? 'bg-blue-100 text-blue-700' : 
                                                  'bg-red-100 text-red-600'}`}>
                                                {record.status === 'P' ? 'Present' : 
                                                 record.status === 'H' ? 'Holiday' : 
                                                 record.status === 'S' ? 'Skipped' : 
                                                 'Absent'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <div className="mb-6 flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                            <Info className="h-5 w-5 text-indigo-600 flex-shrink-0" />
                            <p className="text-[10px] text-indigo-800 leading-relaxed font-medium">
                                Showing archived summary for <strong>{months[month - 1]}</strong>. Daily logs are aggregated for performance reporting.
                            </p>
                        </div>
                        <table className="w-full text-[13px]">
                            <thead>
                                <tr className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                    <th className="px-4 py-3">Student Name</th>
                                    <th className="px-4 py-3 text-center">Present</th>
                                    <th className="px-4 py-3 text-center">Absent</th>
                                    <th className="px-4 py-3 text-center">Holiday</th>
                                    <th className="px-4 py-3 text-center">Skipped</th>
                                    <th className="px-4 py-3 text-right">Attendance Rate</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {historyData.map((stat, i) => {
                                    const rate = ((stat.present / (stat.total - stat.holiday)) * 100).toFixed(0);
                                    return (
                                        <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center font-medium text-green-700 border border-green-100">
                                                        {(stat.studentName || 'U')[0]}
                                                    </div>
                                                    <div>
                                                        <span className="font-medium text-gray-900 block">{stat.studentName || 'Unknown Student'}</span>
                                                        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Roll #{stat.rollNo}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-[10px] font-medium border border-green-100">
                                                    <CheckCircle className="h-3 w-3" /> {stat.present}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-medium border border-red-100">
                                                    <XCircle className="h-3 w-3" /> {stat.absent}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-center text-orange-600 font-medium">
                                                {stat.holiday}
                                            </td>
                                            <td className="px-4 py-4 text-center text-gray-500 font-medium">
                                                {stat.skipped}
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className={`text-[13px] font-medium ${parseInt(rate) >= 80 ? 'text-green-600' : 'text-orange-600'}`}>{rate}%</span>
                                                    <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200/50">
                                                        <div
                                                            className={`h-full transition-all duration-1000 ease-out ${parseInt(rate) >= 80 ? 'bg-green-500' : 'bg-orange-400'}`}
                                                            style={{ width: `${rate}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Footer Stats Strip (if data exists) */}
            {!loading && !error && historyData.length > 0 && (
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-[10px] font-medium text-gray-400 uppercase tracking-widest">
                    <span>Year: {year}</span>
                    <span>System: SchoolManagement v1.0</span>
                    <span>Class ID: {classId}</span>
                </div>
            )}
        </div>
    );
}
