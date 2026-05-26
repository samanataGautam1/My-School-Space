import React, { useState, useEffect, useRef } from 'react';
import { Send, X, User, MessageSquare, Clock, CheckCircle, Paperclip, FileText, Download } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:4008';

function parseFileUrl(raw) {
    if (!raw) return null;
    const idx = raw.lastIndexOf('|');
    if (idx === -1) return { url: raw, name: 'Attachment' };
    return { url: raw.slice(0, idx), name: raw.slice(idx + 1) };
}

export default function ParentChatInterface({ onClose }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [subject, setSubject] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user) setCurrentUser(user);
    }, []);

    const fetchMessages = async () => {
        try {
            const res = await api.get('/api/parent/dashboard/messages');
            if (res.data.ok) setMessages(res.data.data);
        } catch (error) {
            console.error('Fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages();
        const interval = setInterval(fetchMessages, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() && !selectedFile) return;

        const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
        if (lastMessage && lastMessage.fromUserId === currentUser?.id && lastMessage.status === 'PENDING') {
            toast.error('Please wait for your previous message to be approved.');
            return;
        }

        setSending(true);
        const tempId = Date.now();
        const tempMsg = {
            id: tempId,
            subject,
            body: newMessage,
            fromUserId: currentUser?.id,
            createdAt: new Date().toISOString(),
            status: 'PENDING',
            isTemp: true
        };
        setMessages(prev => [...prev, tempMsg]);
        setNewMessage('');
        setSubject('');
        const fileToSend = selectedFile;
        setSelectedFile(null);

        try {
            let messageBody = tempMsg.body || '';

            // Convert image to base64 and embed in body
            if (fileToSend) {
                const base64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.readAsDataURL(fileToSend);
                });
                messageBody = messageBody ? `${messageBody}\n[IMG:${base64}]` : `[IMG:${base64}]`;
            }

            const form = new FormData();
            form.append('subject', tempMsg.subject || 'No Subject');
            form.append('body', messageBody);
            const res = await api.post('/api/parent/dashboard/messages/send', form);

            if (res.data.ok) {
                fetchMessages();
            } else {
                toast.error(res.data.error || 'Failed to send');
                setMessages(prev => prev.filter(m => m.id !== tempId));
            }
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to send');
            setMessages(prev => prev.filter(m => m.id !== tempId));
        } finally {
            setSending(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Only allow images
        if (!file.type.startsWith('image/')) {
            toast.error('Only image files are allowed (PNG, JPG, GIF)');
            e.target.value = '';
            return;
        }

        // Max 30KB
        if (file.size > 500 * 1024) {
            toast.error(`File too large (${(file.size / 1024).toFixed(0)}KB). Maximum 500KB allowed.`);
            e.target.value = '';
            return;
        }

        setSelectedFile(file);
        e.target.value = '';
    };

    const isBlocked = messages.length > 0 &&
        messages[messages.length - 1].fromUserId === currentUser?.id &&
        messages[messages.length - 1].status === 'PENDING';

    return (
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-2xl border-l border-slate-200 z-50 flex flex-col animate-slide-in-right">
            {/* Header */}
            <div className="h-16 border-b border-slate-100 flex items-center justify-between px-6 bg-slate-50/50">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold border-2 border-white shadow-sm">
                            <User size={20} />
                        </div>
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 leading-tight">Admin Support</h3>
                        <p className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">Online</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                    <X size={20} />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30 custom-scrollbar">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                        <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs font-medium">Loading chat...</span>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-6 opacity-60">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <MessageSquare className="text-slate-400" size={24} />
                        </div>
                        <h4 className="font-bold text-slate-600 mb-1">No messages yet</h4>
                        <p className="text-xs text-slate-400">Start a conversation with the school administration.</p>
                    </div>
                ) : (
                    messages.map((msg, i) => {
                        const isMe = msg.fromUserId === currentUser?.id;
                        const attachment = parseFileUrl(msg.fileUrl);
                        return (
                            <div key={msg.id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm group space-y-2
                                    ${isMe
                                        ? 'bg-emerald-950 text-white rounded-tr-sm'
                                        : 'bg-white text-slate-700 border border-slate-200 rounded-tl-sm'
                                    }`}
                                >
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

                                    {/* File attachment */}
                                    {attachment && (
                                        <a
                                            href={`${BACKEND_URL}${attachment.url}`}
                                            download={attachment.name}
                                            target="_blank"
                                            rel="noreferrer"
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isMe
                                                ? 'bg-white/10 hover:bg-white/20 text-white'
                                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                                                }`}
                                        >
                                            <FileText size={13} className="shrink-0" />
                                            <span className="truncate max-w-[140px]">{attachment.name}</span>
                                            <Download size={12} className="shrink-0 ml-auto opacity-70" />
                                        </a>
                                    )}

                                </div>
                                <div className="flex items-center gap-2 mt-1 px-1">
                                    <span className="text-[10px] text-slate-300">
                                        {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                                    </span>
                                    {isMe && (
                                        <>
                                            {msg.status === 'PENDING' && <span className="text-[10px] font-bold text-amber-500 flex items-center gap-0.5"><Clock size={10} /> Reviewing</span>}
                                            {msg.status === 'ACCEPTED' && <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-0.5"><CheckCircle size={10} /> Seen</span>}
                                            {msg.status === 'REJECTED' && <span className="text-[10px] font-bold text-red-500">Rejected</span>}
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t border-slate-100">
                {isBlocked ? (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-center gap-3 text-amber-800">
                        <Clock size={20} className="shrink-0" />
                        <p className="text-xs font-medium leading-tight">
                            Your last message is waiting for approval.
                            <br /><span className="opacity-75">You can reply once an admin accepts it.</span>
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSendMessage} className="flex flex-col gap-2">
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Subject"
                            className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl px-4 py-2 outline-none text-sm transition-all font-bold"
                        />

                        {/* File preview */}
                        {selectedFile && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                                <img src={URL.createObjectURL(selectedFile)} alt="Preview" className="w-8 h-8 rounded object-cover border border-slate-200" />
                                <span className="text-xs text-slate-700 font-medium truncate flex-1">{selectedFile.name}</span>
                                <span className="text-[10px] text-slate-400">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                                <button type="button" onClick={() => setSelectedFile(null)} className="text-slate-400 hover:text-red-500 transition-colors">
                                    <X size={13} />
                                </button>
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 hover:border-slate-300 focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10 rounded-xl px-4 py-3 gap-2 transition-all">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type a message..."
                                    className="flex-1 bg-transparent outline-none text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`text-slate-400 hover:text-slate-600 transition-colors shrink-0 ${selectedFile ? 'text-emerald-600' : ''}`}
                                    title="Attach file"
                                >
                                    <Paperclip size={16} />
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
                                disabled={(!newMessage.trim() && !selectedFile) || !subject.trim() || sending}
                                className="p-3 bg-emerald-950 hover:bg-emerald-900 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl transition-all shadow-md active:scale-95"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </form>
                )}
            </div>

            <style jsx>{`
                .animate-slide-in-right {
                    animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
