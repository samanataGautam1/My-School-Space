import React, { useState } from "react";
import { Badge, Card, Button } from "../components/ui/Shared";
import { Mail, MessageSquare, CheckCircle, XCircle, Search, Clock, User, ChevronRight, Inbox, Trash2 } from "lucide-react";

export default function ParentMessages({ moderationMessages = [], handleMessageAction, onOpenChat }) {
    const [selectedMessageId, setSelectedMessageId] = useState(null);
    const [filter, setFilter] = useState("ALL"); // ALL, PENDING, ACCEPTED, REJECTED
    const [searchTerm, setSearchTerm] = useState("");

    // Filter and Search Logic
    const filteredMessages = moderationMessages.filter(msg => {
        const matchesFilter = filter === "ALL" ? true : (msg.status || 'PENDING') === filter;
        const matchesSearch = (msg.from || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (msg.subject || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (msg.body || '').toLowerCase().includes(searchTerm.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const selectedMessage = moderationMessages.find(m => m.id === selectedMessageId) || filteredMessages[0];

    const getStatusBadge = (status) => {
        switch (status) {
            case 'PENDING': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-100 uppercase tracking-wide">Pending</span>;
            case 'ACCEPTED': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase tracking-wide">Accepted</span>;
            case 'REJECTED': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-600 border border-red-100 uppercase tracking-wide">Rejected</span>;
            default: return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-100 uppercase tracking-wide">{status}</span>;
        }
    };

    return (
        <div className="h-full animate-fade-in flex flex-col md:flex-row gap-6">
            {/* Sidebar / Message List */}
            <div className="w-full md:w-1/3 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Inbox className="text-slate-400" size={20} />
                        Inbox
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#f5f2ed] text-slate-600 text-[10px] font-bold border border-slate-200">
                        {filteredMessages.length} Messages
                    </span>
                </div>

                <div className="bg-[#fcfaf7] p-3 rounded-xl border border-slate-200 shadow-sm space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                        <input
                            placeholder="Search messages..."
                            className="w-full pl-9 pr-4 h-9 text-xs font-medium bg-[#f5f2ed] border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 transition-all placeholder:text-slate-400"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-1 p-1 bg-[#f5f2ed] rounded-lg">
                        {['ALL', 'PENDING', 'ACCEPTED'].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${filter === f ? 'bg-[#fcfaf7] text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 bg-[#fcfaf7] border border-slate-200/60 shadow-sm rounded-xl overflow-hidden overflow-y-auto">
                    {filteredMessages.length > 0 ? (
                        <div className="divide-y divide-slate-50">
                            {filteredMessages.map((msg) => (
                                <div
                                    key={msg.id}
                                    onClick={() => setSelectedMessageId(msg.id)}
                                    className={`p-4 cursor-pointer transition-all hover:bg-[#f5f2ed] group border-l-2 ${selectedMessage?.id === msg.id ? 'bg-[#f5f2ed] border-emerald-500' : 'border-transparent'}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${msg.status === 'PENDING' ? 'bg-amber-500' : 'bg-transparent'}`} />
                                            <div>
                                                <span className={`text-xs font-bold leading-none block ${selectedMessage?.id === msg.id ? 'text-emerald-900' : 'text-slate-700'}`}>{msg.from}</span>
                                                {msg.studentInfo && <span className="text-[9px] text-slate-400 font-medium block mt-0.5">{msg.studentInfo}</span>}
                                            </div>
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap ml-2">
                                            {msg.createdAt ? new Date(msg.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Today'}
                                        </span>
                                    </div>
                                    <p className={`text-[11px] font-medium truncate mb-1 ${msg.status === 'PENDING' ? 'text-slate-900' : 'text-slate-600'}`}>
                                        {msg.subject || 'No Subject'}
                                    </p>
                                    <p className="text-[10px] text-slate-400 line-clamp-1">
                                        {msg.body}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                            <Inbox size={32} className="mb-2 opacity-20" />
                            <p className="text-xs font-medium">No messages found</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Message View */}
            <div className="flex-1 h-full">
                {selectedMessage ? (
                    <Card className="h-full border border-slate-200/60 shadow-sm rounded-xl overflow-hidden flex flex-col bg-[#fcfaf7]">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 bg-[#f5f2ed]/30 relative z-10">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-[#fcfaf7] border border-slate-200 flex items-center justify-center text-slate-500 font-bold">
                                        <User size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800 leading-tight">{selectedMessage.subject || 'No Subject'}</h3>
                                        <div className="flex flex-col mt-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-medium text-slate-500">From: <span className="text-slate-900 font-bold">{selectedMessage.from}</span></span>
                                                <span className="text-[10px] text-slate-300">•</span>
                                                <span className="text-xs text-slate-400 font-medium">
                                                    {selectedMessage.createdAt ? new Date(selectedMessage.createdAt).toLocaleString() : 'Just now'}
                                                </span>
                                            </div>
                                            {selectedMessage.studentInfo && (
                                                <span className="text-xs text-emerald-600 font-medium mt-0.5">
                                                    Student: {selectedMessage.studentInfo}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    {getStatusBadge(selectedMessage.status)}
                                </div>
                            </div>

                            {/* Actions Toolbar */}
                            <div className="flex items-center gap-3 mt-4">
                                {selectedMessage.status === 'PENDING' || selectedMessage.status === 'REJECTED' ? (
                                    <>
                                        <Button
                                            onClick={() => handleMessageAction(selectedMessage.id, 'ACCEPT', selectedMessage)}
                                            className="bg-green-950 hover:bg-green-900 text-white text-[10px] h-7 px-3 font-bold shadow-sm shadow-green-950/20 uppercase tracking-wider"
                                        >
                                            {selectedMessage.status === 'REJECTED' ? 'Re-Accept & Chat' : 'Accept & Start Chat'}
                                        </Button>

                                        {selectedMessage.status !== 'REJECTED' && (
                                            <Button
                                                onClick={() => handleMessageAction(selectedMessage.id, 'REJECT')}
                                                className="bg-[#fcfaf7] border border-red-200 text-red-600 hover:bg-red-50 text-[10px] h-7 px-3 font-bold shadow-sm uppercase tracking-wider"
                                            >
                                                Reject
                                            </Button>
                                        )}

                                        <Button
                                            onClick={() => {
                                                if (window.confirm('Are you sure you want to delete this message?')) {
                                                    handleMessageAction(selectedMessage.id, 'DELETE');
                                                }
                                            }}
                                            className="bg-[#fcfaf7] border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-red-600 text-[10px] h-7 px-2 font-bold shadow-sm ml-auto uppercase tracking-wider"
                                            title="Delete Message"
                                        >
                                            Delete
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        onClick={() => onOpenChat({
                                            parentId: selectedMessage.fromUserId,
                                            parentName: selectedMessage.from,
                                            studentInfo: selectedMessage.studentInfo
                                        })}
                                        className="bg-green-950 hover:bg-green-900 text-white text-[10px] h-7 px-3 font-bold shadow-sm shadow-green-950/20 uppercase tracking-wider"
                                    >
                                        Reply / Open Chat
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 p-8 overflow-y-auto relative">
                            {selectedMessage.status === 'PENDING' ? (
                                <div className="flex flex-col items-center justify-center h-40 bg-[#f5f2ed] rounded-lg border border-dashed border-slate-200">
                                    <Clock className="text-amber-400 mb-2" size={24} />
                                    <p className="text-sm font-bold text-slate-500">Message content hidden</p>
                                    <p className="text-xs text-slate-400">Accept this message to view its content.</p>
                                </div>
                            ) : (
                                <div className={`prose prose-sm max-w-none text-slate-600 leading-relaxed text-sm transition-all duration-300 ${selectedMessage.status === 'REJECTED' ? 'blur-sm select-none opacity-50 grayscale' : ''}`}>
                                    {selectedMessage.body ? selectedMessage.body.split('\n').map((line, i) => (
                                        <p key={i} className="mb-2">{line}</p>
                                    )) : (
                                        <p className="italic text-slate-400">No content</p>
                                    )}
                                </div>
                            )}

                            {selectedMessage.status === 'REJECTED' && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="bg-[#fcfaf7]/80 backdrop-blur-sm px-4 py-2 rounded-full border border-red-100 shadow-sm">
                                        <p className="text-red-600 text-xs font-bold flex items-center gap-2">
                                            <XCircle size={14} /> Message Rejected
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center bg-[#f5f2ed] rounded-xl border border-slate-200 border-dashed text-slate-400">
                        <Mail className="w-12 h-12 mb-3 opacity-20" />
                        <p className="font-medium">Select a message to read</p>
                    </div>
                )}
            </div>
        </div>
    );
}
