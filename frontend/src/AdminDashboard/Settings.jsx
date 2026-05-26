import React from "react";
import { Card, Input, Button } from "../components/ui/Shared";
import toast from "react-hot-toast";
import { dashboardService } from "../services/api";
import { Shield, School, Settings as SettingsIcon, Check, Edit2, X, AlertTriangle } from "lucide-react";
import { HugeiconsIcon } from '@hugeicons/react';
import {
    Configuration01Icon, Building02Icon, Mail02Icon, SmartPhone01Icon,
    Location01Icon, SecurityCheckIcon, PencilEdit02Icon, CheckmarkCircle02Icon,
    Cancel01Icon, Alert02Icon, StarIcon, MessageUser02Icon, IdVerifiedIcon,
    Tick02Icon
} from '@hugeicons/core-free-icons';

// Returns the end date of a given session + year
function getSessionEndDate(session, year) {
    const endMonths = { '1st Session': 2, '2nd Session': 5, '3rd Session': 8, '4th Session': 11 };
    const month = endMonths[session];
    if (month === undefined) return null;
    return new Date(year, month + 1, 0, 23, 59, 59, 999); // last ms of last day of that month
}

const SESSION_ORDER = ['1st Session', '2nd Session', '3rd Session', '4th Session'];

function isSessionStillActive(session, year, activePerformanceSession) {
    // If the school's performance session has already moved past this session, it's no longer active
    if (activePerformanceSession) {
        const ratingIdx = SESSION_ORDER.indexOf(session);
        const perfIdx = SESSION_ORDER.indexOf(activePerformanceSession);
        if (perfIdx > ratingIdx) return false; // already advanced past it
    }
    const endDate = getSessionEndDate(session, year);
    if (!endDate) return false;
    return new Date() <= endDate;
}

export default function Settings({
    currentUser,
    schoolInfo,
    setSchoolInfo,
    toggleRatings,
    setActiveTab,
    handleRunCalculation,
    examSubmissions,
    classes
}) {
    // Session modal
    const [showSessionModal, setShowSessionModal] = React.useState(false);
    const [selectedSession, setSelectedSession] = React.useState("1st Session");
    const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear());

    // School Identity editing
    const [isEditing, setIsEditing] = React.useState(false);
    const [editForm, setEditForm] = React.useState({ name: '', email: '', address: '', phone: '' });
    const [showConfirmModal, setShowConfirmModal] = React.useState(false);
    const [savingIdentity, setSavingIdentity] = React.useState(false);

    const handleSaveSettings = async () => {
        try {
            const {
                ratingsEnabled,
                parentMessagingEnabled,
                multiClassTeachersEnabled,
                studentAnalyticsEnabled,
                activePerformanceSession,
                activePerformanceYear
            } = schoolInfo;
            const res = await dashboardService.updateSettings({
                ratingsEnabled,
                parentMessagingEnabled,
                multiClassTeachersEnabled,
                studentAnalyticsEnabled,
                activePerformanceSession,
                activePerformanceYear
            });
            if (res.ok) {
                toast.success("Settings saved successfully");
                setActiveTab("overview");
            } else toast.error(res.message);
        } catch (e) {
            toast.error("Failed to save settings");
        }
    };

    const handleToggleClick = () => {
        if (!schoolInfo.ratingsEnabled) {
            setShowSessionModal(true);
        } else {
            toggleRatings(false, null, null);
        }
    };

    const confirmEnableRatings = () => {
        toggleRatings(true, selectedSession, selectedYear);
        setShowSessionModal(false);
    };

    // School Identity handlers
    const handleStartEdit = () => {
        setEditForm({
            name: schoolInfo.name || '',
            email: schoolInfo.email || '',
            address: schoolInfo.address || '',
            phone: schoolInfo.phone || ''
        });
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditForm({ name: '', email: '', address: '', phone: '' });
    };

    const handleSaveIdentityClick = () => {
        if (!editForm.name.trim()) {
            toast.error('School name is required');
            return;
        }
        setShowConfirmModal(true);
    };

    const handleConfirmIdentityUpdate = async () => {
        setSavingIdentity(true);
        try {
            const res = await dashboardService.updateSchoolIdentity({
                name: editForm.name.trim(),
                email: editForm.email.trim(),
                address: editForm.address.trim(),
                phone: editForm.phone.trim()
            });
            if (res.ok) {
                setSchoolInfo(prev => ({ ...prev, name: editForm.name.trim(), email: editForm.email.trim(), address: editForm.address.trim(), phone: editForm.phone.trim() }));
                toast.success('School identity updated successfully');
                setIsEditing(false);
                setShowConfirmModal(false);
            } else {
                toast.error(res.message || 'Failed to update');
            }
        } catch (e) {
            toast.error('Failed to update school identity');
        } finally {
            setSavingIdentity(false);
        }
    };

    // Session validation: is the currently active ratings session still ongoing?
    // Respects both calendar end date AND whether performance session has already moved past it
    const activeSessionStillRunning = schoolInfo.ratingsEnabled
        && schoolInfo.activeRatingSession
        && isSessionStillActive(
            schoolInfo.activeRatingSession,
            schoolInfo.activeRatingYear || new Date().getFullYear(),
            schoolInfo.activePerformanceSession
        );

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in relative">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-900/20">
                    <HugeiconsIcon icon={Configuration01Icon} size={20} />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-slate-800 tracking-tight">School Configuration</h1>
                    <p className="text-xs text-slate-500 font-medium">Manage your school's identity and system preferences</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* ── School Identity Section ── */}
                <Card className="p-0 border border-slate-200/60 shadow-sm rounded-xl overflow-hidden bg-[#fcfaf7]">
                    <div className="px-6 py-4 border-b border-slate-100 bg-[#f5f2ed]/50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <HugeiconsIcon icon={Building02Icon} size={16} className="text-slate-400" />
                            <h4 className="font-bold text-[10px] text-slate-500 uppercase tracking-widest">School Identity</h4>
                        </div>
                        {!isEditing ? (
                            <button
                                onClick={handleStartEdit}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-[#fcfaf7] hover:bg-white border border-slate-200 rounded-lg transition-all"
                            >
                                <HugeiconsIcon icon={PencilEdit02Icon} size={11} />
                                Edit
                            </button>
                        ) : (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleCancelEdit}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-[#fcfaf7] hover:bg-white border border-slate-200 rounded-lg transition-all"
                                >
                                    <HugeiconsIcon icon={Cancel01Icon} size={11} />
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveIdentityClick}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-all"
                                >
                                    <HugeiconsIcon icon={Tick02Icon} size={11} />
                                    Save Changes
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <HugeiconsIcon icon={Building02Icon} size={11} className="text-slate-400" />School Name
                            </label>
                            <Input
                                value={isEditing ? editForm.name : (schoolInfo.name || 'Loading...')}
                                disabled={!isEditing}
                                onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                                className={`${isEditing ? 'bg-white border-slate-300 focus:border-slate-500' : 'bg-[#f5f2ed] border-slate-200'} font-semibold text-slate-700 h-9 text-xs`}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">School Code</label>
                            <div className="relative">
                                <Input
                                    value={schoolInfo.code || 'Loading...'}
                                    disabled
                                    className="bg-[#f5f2ed] border-slate-200 font-mono font-bold text-slate-700 h-9 text-xs pl-9"
                                />
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 bg-[#f5f2ed] rounded flex items-center justify-center text-[8px] font-bold text-slate-500">ID</div>
                            </div>
                            {isEditing && <p className="text-[10px] text-slate-400">School code cannot be changed.</p>}
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <HugeiconsIcon icon={Mail02Icon} size={11} className="text-slate-400" />Contact Email
                            </label>
                            <Input
                                value={isEditing ? editForm.email : (schoolInfo.email || '—')}
                                disabled={!isEditing}
                                onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                                placeholder={isEditing ? 'school@example.com' : ''}
                                className={`${isEditing ? 'bg-white border-slate-300 focus:border-slate-500' : 'bg-[#f5f2ed] border-slate-200'} text-slate-700 h-9 text-xs`}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <HugeiconsIcon icon={SmartPhone01Icon} size={11} className="text-slate-400" />Phone
                            </label>
                            <Input
                                value={isEditing ? editForm.phone : (schoolInfo.phone || '—')}
                                disabled={!isEditing}
                                onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))}
                                placeholder={isEditing ? '+1 234 567 8900' : ''}
                                className={`${isEditing ? 'bg-white border-slate-300 focus:border-slate-500' : 'bg-[#f5f2ed] border-slate-200'} text-slate-700 h-9 text-xs`}
                            />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <HugeiconsIcon icon={Location01Icon} size={11} className="text-slate-400" />Address
                            </label>
                            <Input
                                value={isEditing ? editForm.address : (schoolInfo.address || '—')}
                                disabled={!isEditing}
                                onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))}
                                placeholder={isEditing ? '123 School Street, City' : ''}
                                className={`${isEditing ? 'bg-white border-slate-300 focus:border-slate-500' : 'bg-[#f5f2ed] border-slate-200'} text-slate-700 h-9 text-xs`}
                            />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Administrator</label>
                            <div className="flex items-center gap-3 p-2 bg-[#f5f2ed] border border-slate-200 rounded-lg">
                                <div className="w-8 h-8 rounded-full bg-[#fcfaf7] flex items-center justify-center text-slate-600 font-bold text-xs">
                                    {currentUser.firstName?.[0]}{currentUser.lastName?.[0]}
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-800">{currentUser.firstName} {currentUser.lastName}</p>
                                    <p className="text-[10px] text-slate-400 font-medium">{currentUser.email}</p>
                                </div>
                                <div className="ml-auto flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded uppercase tracking-wider">
                                    <HugeiconsIcon icon={IdVerifiedIcon} size={10} />
                                    Verified
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* ── System Preferences Section ── */}
                <Card className="p-0 border border-slate-200/60 shadow-sm rounded-xl overflow-hidden bg-[#fcfaf7]">
                    <div className="px-6 py-4 border-b border-slate-100 bg-[#f5f2ed]/50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <HugeiconsIcon icon={SecurityCheckIcon} size={16} className="text-slate-400" />
                            <h4 className="font-bold text-[10px] text-slate-500 uppercase tracking-widest">System Preferences</h4>
                        </div>
                    </div>
                    <div className="p-6 space-y-4">
                        {/* Teacher Performance Ratings */}
                        <div className="flex items-center justify-between p-4 bg-[#fcfaf7] border border-slate-100 rounded-xl hover:border-slate-200 transition-colors shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${schoolInfo.ratingsEnabled ? "bg-emerald-50" : "bg-slate-100"}`}>
                                    <HugeiconsIcon icon={StarIcon} size={18} className={schoolInfo.ratingsEnabled ? "text-emerald-600" : "text-slate-400"} />
                                </div>
                                <div>
                                    <span className="text-sm font-bold text-slate-800 block mb-0.5">Teacher Performance Ratings</span>
                                    <p className="text-[10px] text-slate-500 font-medium">Allow students to rate teachers anonymously</p>
                                    {schoolInfo.ratingsEnabled && schoolInfo.activeRatingSession && (
                                        <div className="inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded text-[10px] font-bold text-emerald-700">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                            Active: {schoolInfo.activeRatingSession} ({schoolInfo.activeRatingYear})
                                        </div>
                                    )}
                                    {activeSessionStillRunning && (
                                        <div className="inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 bg-amber-50 border border-amber-100 rounded text-[10px] font-semibold text-amber-700">
                                            <HugeiconsIcon icon={Alert02Icon} size={10} />
                                            Session in progress — cannot switch until it ends
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="h-8 w-px bg-slate-100 mx-2"></div>
                                <button
                                    onClick={handleToggleClick}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${schoolInfo.ratingsEnabled ? 'bg-slate-900' : 'bg-slate-200'}`}
                                >
                                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${schoolInfo.ratingsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>

                        {/* Parent Messaging Toggle */}
                        <div className="flex items-center justify-between p-4 bg-[#fcfaf7] border border-slate-100 rounded-xl hover:border-slate-200 transition-colors shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${schoolInfo.parentMessagingEnabled ? "bg-blue-50" : "bg-slate-100"}`}>
                                    <HugeiconsIcon icon={MessageUser02Icon} size={18} className={schoolInfo.parentMessagingEnabled ? "text-blue-600" : "text-slate-400"} />
                                </div>
                                <div>
                                    <span className="text-sm font-bold text-slate-800 block mb-0.5">Parent Messaging</span>
                                    <p className="text-[10px] text-slate-500 font-medium">Allow parents to send messages directly to the admin.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="h-8 w-px bg-slate-100 mx-2"></div>
                                <button
                                    onClick={() => setSchoolInfo(prev => ({ ...prev, parentMessagingEnabled: !prev.parentMessagingEnabled }))}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${schoolInfo.parentMessagingEnabled ? 'bg-slate-900' : 'bg-slate-200'}`}
                                >
                                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${schoolInfo.parentMessagingEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="px-6 py-4 bg-[#f5f2ed]/50 border-t border-slate-100 flex justify-end">
                        <Button
                            className="bg-slate-900 hover:bg-slate-800 text-xs font-bold h-9 px-6 shadow-md shadow-slate-900/10"
                            onClick={handleSaveSettings}
                        >
                            Save Configuration
                        </Button>
                    </div>
                </Card>
            </div>

            {/* ── Session Selection Modal ── */}
            {showSessionModal && (
                <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-[#fcfaf7] rounded-xl p-6 max-w-sm w-full shadow-2xl animate-scale-in border border-slate-200">
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-slate-800">Activate Ratings</h3>
                            <p className="text-xs text-slate-500 mt-1">Select the active academic session for data collection.</p>
                        </div>

                        {activeSessionStillRunning && (
                            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                                <HugeiconsIcon icon={Alert02Icon} size={14} className="text-amber-600 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-[11px] font-bold text-amber-800">Session still active</p>
                                    <p className="text-[10px] text-amber-700 mt-0.5">
                                        {schoolInfo.activeRatingSession} ({schoolInfo.activeRatingYear}) hasn't ended yet.
                                        You cannot switch to a different session until the current one ends
                                        ({getSessionEndDate(schoolInfo.activeRatingSession, schoolInfo.activeRatingYear)?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}).
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4 mb-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Academic Session</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {["1st Session", "2nd Session", "3rd Session", "4th Session"].map(session => {
                                        const isCurrent = session === schoolInfo.activeRatingSession;
                                        const isBlocked = activeSessionStillRunning && !isCurrent;
                                        return (
                                            <div
                                                key={session}
                                                onClick={() => !isBlocked && setSelectedSession(session)}
                                                className={`p-3 rounded-lg border flex items-center justify-between transition-all ${isBlocked
                                                    ? 'border-slate-100 bg-slate-50 opacity-40 cursor-not-allowed'
                                                    : 'cursor-pointer'
                                                } ${selectedSession === session && !isBlocked
                                                    ? 'border-emerald-500 bg-emerald-50/50 text-emerald-800 ring-1 ring-emerald-500/20'
                                                    : !isBlocked ? 'border-slate-200 hover:border-slate-300 hover:bg-slate-50' : ''
                                                }`}
                                            >
                                                <span className="font-bold text-xs">{session}</span>
                                                <div className="flex items-center gap-1.5">
                                                    {isCurrent && <span className="text-[9px] font-bold text-emerald-600 uppercase">Current</span>}
                                                    {selectedSession === session && !isBlocked && <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} className="text-emerald-600" />}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Academic Year</label>
                                <Input
                                    type="number"
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                    disabled={activeSessionStillRunning}
                                    className="h-9 text-xs font-bold bg-slate-50"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button
                                variant="ghost"
                                className="flex-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 text-xs font-bold h-9"
                                onClick={() => setShowSessionModal(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 bg-green-950 hover:bg-green-900 text-xs font-bold h-9 shadow-lg shadow-green-950/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={confirmEnableRatings}
                                disabled={activeSessionStillRunning}
                            >
                                Activate System
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── School Identity Confirmation Modal ── */}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-[#fcfaf7] rounded-xl p-6 max-w-sm w-full shadow-2xl animate-scale-in border border-slate-200">
                        <div className="flex items-start gap-3 mb-5">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                                <HugeiconsIcon icon={Alert02Icon} size={18} className="text-amber-600" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-800">Confirm School Identity Update</h3>
                                <p className="text-xs text-slate-500 mt-1">This will update your school's identity across the entire platform.</p>
                            </div>
                        </div>

                        <div className="bg-[#f5f2ed] rounded-lg p-4 mb-5 space-y-2 text-xs">
                            {editForm.name !== schoolInfo.name && (
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-400 w-16 shrink-0">Name</span>
                                    <span className="line-through text-slate-400">{schoolInfo.name}</span>
                                    <span className="text-slate-300">→</span>
                                    <span className="font-bold text-slate-800">{editForm.name}</span>
                                </div>
                            )}
                            {editForm.email !== schoolInfo.email && (
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-400 w-16 shrink-0">Email</span>
                                    <span className="font-bold text-slate-800">{editForm.email || '—'}</span>
                                </div>
                            )}
                            {editForm.phone !== schoolInfo.phone && (
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-400 w-16 shrink-0">Phone</span>
                                    <span className="font-bold text-slate-800">{editForm.phone || '—'}</span>
                                </div>
                            )}
                            {editForm.address !== schoolInfo.address && (
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-400 w-16 shrink-0">Address</span>
                                    <span className="font-bold text-slate-800">{editForm.address || '—'}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="ghost"
                                className="flex-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 text-xs font-bold h-9"
                                onClick={() => setShowConfirmModal(false)}
                                disabled={savingIdentity}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 bg-slate-900 hover:bg-slate-800 text-xs font-bold h-9"
                                onClick={handleConfirmIdentityUpdate}
                                disabled={savingIdentity}
                            >
                                {savingIdentity ? 'Saving...' : 'Confirm Update'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
