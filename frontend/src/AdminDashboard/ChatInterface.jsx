import React, { useState, useEffect, useRef } from 'react';
import { Send, X, User, Check, Paperclip, Download, FileText } from 'lucide-react';
import { dashboardService } from '../services/api';
import { toast } from 'react-hot-toast';

const BACKEND_URL = '';

// Parse "fileUrl|fileName" stored in message.fileUrl
function parseFileUrl(raw) {
    if (!raw) return null;
    const idx = raw.lastIndexOf('|');
    if (idx === -1) return { url: raw, name: 'Attachment' };
    return { url: raw.slice(0, idx), name: raw.slice(idx + 1) };
}

const ChatInterface = ({ parentId, parentName, studentInfo, onClose }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const user = JSON.parse(localStorage.getItem('user'));

    useEffect(() => {
        if (parentId) fetchConversation();
        const interval = setInterval(() => { if (parentId) fetchConversation(); }, 5000);
        return () => clearInterval(interval);
    }, [parentId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchConversation = async () => {
        if (!parentId) return;
        try {
            const response = await dashboardService.getConversation(parentId);
            if (response.ok) setMessages(response.data);
        } catch (error) {
            console.error('Failed to fetch conversation:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async (id) => {
        try {
            const response = await dashboardService.acceptMessage(id);
            if (response.ok) { toast.success('Message accepted'); fetchConversation(); }
            else toast.error(response.message || 'Failed to accept');
        } catch { toast.error('Error accepting message'); }
    };

    const handleReject = async (id) => {
        try {
            const response = await dashboardService.rejectMessage(id);
            if (response.ok) { toast.success('Message rejected'); fetchConversation(); }
            else toast.error(response.message || 'Failed to reject');
        } catch { toast.error('Error rejecting message'); }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() && !selectedFile) return;
        setSending(true);
        try {
            let messageBody = newMessage;

            // Embed image as base64 in body (since message model has no fileUrl field)
            if (selectedFile) {
                const base64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.readAsDataURL(selectedFile);
                });
                messageBody = messageBody ? `${messageBody}\n[IMG:${base64}]` : `[IMG:${base64}]`;
            }

            const response = await dashboardService.sendReply(
                { toUserId: parentId, body: messageBody }
            );
            if (response.ok) {
                setNewMessage('');
                setSelectedFile(null);
                fetchConversation();
            } else {
                toast.error(response.message || 'Failed to send message');
            }
        } catch {
            toast.error('Error sending message');
        } finally {
            setSending(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Only image files are allowed (PNG, JPG, GIF)');
            e.target.value = '';
            return;
        }

        if (file.size > 500 * 1024) {
            toast.error(`File too large (${(file.size / 1024).toFixed(0)}KB). Maximum 500KB allowed.`);
            e.target.value = '';
            return;
        }

        setSelectedFile(file);
        e.target.value = '';
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white w-full max-w-2xl h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="px-6 py-3 border-b bg-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 relative">
                            <User size={22} />
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-gray-800 text-base">{parentName || 'User'}</h3>
                                <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[10px] font-bold rounded-full border border-green-100 uppercase tracking-tighter">Online</span>
                            </div>
                            {studentInfo
                                ? <p className="text-xs text-emerald-600 font-medium">Student: {studentInfo}</p>
                                : <p className="text-xs text-gray-400">@{parentName?.toLowerCase().replace(/\s/g, '') || 'user'}</p>
                            }
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-3">
                            <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-xs text-gray-400 font-medium">Fetching thread...</p>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <div className="w-16 h-16 bg-green-100/50 rounded-full flex items-center justify-center mb-4">
                                <Send size={24} className="text-green-600 -rotate-12 translate-x-0.5" />
                            </div>
                            <p className="text-gray-400 text-sm font-medium">No messages in this thread yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {messages.map((msg, idx) => {
                                const isMe = msg.fromUserId === user.id;
                                const timeStr = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                const attachment = parseFileUrl(msg.fileUrl);

                                return (
                                    <div key={msg.id || idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                        <div className="flex items-center gap-2 mb-1.5 px-1">
                                            <span className="text-[11px] font-bold text-gray-700">{isMe ? 'You' : parentName}</span>
                                            <span className="text-[10px] text-gray-400">{timeStr}</span>
                                        </div>

                                        <div className={`flex items-end gap-2 max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                            {!isMe && (
                                                <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0 flex items-center justify-center text-gray-400">
                                                    <User size={14} />
                                                </div>
                                            )}

                                            <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm space-y-2
                                                ${isMe
                                                    ? 'bg-green-950 text-white rounded-tr-none'
                                                    : 'bg-[#f4f4f5] text-gray-800 rounded-tl-none border border-gray-100'
                                                }`}
                                            >
                                                {/* Message body / approval controls */}
                                                {!isMe && msg.status === 'PENDING' ? (
                                                    <div className="space-y-2">
                                                        <p className="font-bold text-xs text-gray-500 uppercase tracking-wide">Subject: {msg.subject}</p>
                                                        <p className="italic text-gray-400 text-xs">Message content hidden until approved.</p>
                                                        <div className="flex gap-2 pt-1">
                                                            <button onClick={() => handleAccept(msg.id)} className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-md text-xs font-bold hover:bg-green-200 transition-colors">
                                                                <Check size={13} /> Accept
                                                            </button>
                                                            <button onClick={() => handleReject(msg.id)} className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-md text-xs font-bold hover:bg-red-200 transition-colors">
                                                                <X size={13} /> Reject
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : !isMe && msg.status === 'REJECTED' ? (
                                                    <div className="relative cursor-not-allowed">
                                                        <p className="blur-sm select-none opacity-50">{msg.body}</p>
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded border border-red-200 uppercase">Rejected</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {!isMe && msg.subject && msg.subject !== 'No Subject' && msg.subject !== 'Reply from Admin' && (
                                                            <p className="font-bold text-xs text-gray-500 mb-1">{msg.subject}</p>
                                                        )}
                                                        {msg.body && (() => {
                                                            const imgMatch = msg.body.match(/\[IMG:(data:image\/[^;]+;base64,[^\]]+)\]/);
                                                            const textPart = msg.body.replace(/\[IMG:data:image\/[^\]]+\]/, '').trim();
                                                            return (
                                                                <>
                                                                    {textPart && <p>{textPart}</p>}
                                                                    {imgMatch && <img src={imgMatch[1]} alt="Attachment" className="mt-1 rounded-lg max-w-[200px] max-h-[150px] object-cover border border-slate-200" />}
                                                                </>
                                                            );
                                                        })()}
                                                    </>
                                                )}

                                                {/* File attachment */}
                                                {attachment && msg.status !== 'PENDING' && (
                                                    <a
                                                        href={`${BACKEND_URL}${attachment.url}`}
                                                        download={attachment.name}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className={`flex items-center gap-2 mt-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                                                            isMe
                                                                ? 'bg-white/10 hover:bg-white/20 text-white'
                                                                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                                                        }`}
                                                    >
                                                        <FileText size={14} className="shrink-0" />
                                                        <span className="truncate max-w-[160px]">{attachment.name}</span>
                                                        <Download size={13} className="shrink-0 ml-auto opacity-70" />
                                                    </a>
                                                )}
                                            </div>

                                            {isMe && (
                                                <div className="mb-1 text-green-600">
                                                    <Check size={14} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t bg-white">
                    {/* File preview */}
                    {selectedFile && (
                        <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                            <FileText size={14} className="text-slate-500 shrink-0" />
                            <span className="text-xs text-slate-700 font-medium truncate flex-1">{selectedFile.name}</span>
                            <span className="text-[10px] text-slate-400">{(selectedFile.size / 1024).toFixed(0)} KB</span>
                            <button onClick={() => setSelectedFile(null)} className="text-slate-400 hover:text-red-500 transition-colors">
                                <X size={14} />
                            </button>
                        </div>
                    )}

                    <form onSubmit={handleSend} className="flex items-center gap-3">
                        <div className="flex-1 flex items-center bg-[#f4f4f5] rounded-lg px-4 py-3 gap-2 focus-within:ring-2 focus-within:ring-emerald-100 transition-all">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Send a message"
                                className="flex-1 bg-transparent border-none outline-none text-sm text-gray-800 placeholder:text-gray-400"
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className={`text-gray-400 hover:text-gray-600 transition-colors shrink-0 ${selectedFile ? 'text-emerald-600' : ''}`}
                                title="Attach file"
                            >
                                <Paperclip size={18} />
                            </button>
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            onChange={handleFileChange}
                            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                        />

                        <button
                            type="submit"
                            disabled={(!newMessage.trim() && !selectedFile) || sending}
                            className={`p-2.5 rounded-full flex items-center justify-center transition-all shadow-md ${
                                (newMessage.trim() || selectedFile) && !sending
                                    ? 'bg-green-950 text-white hover:bg-green-900 active:scale-95'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                        >
                            <Send size={18} className={(newMessage.trim() || selectedFile) ? 'translate-x-0.5' : ''} />
                        </button>
                    </form>
                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
            `}</style>
        </div>
    );
};

export default ChatInterface;
