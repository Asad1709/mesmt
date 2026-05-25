import React, { useEffect, useState, useRef } from 'react';
import { Shield, Award, MapPin, Target, Settings, HelpCircle, Bell, User as UserIcon, Camera, Loader2, Moon, Sun, Trash2, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { updateProfile, deleteUser } from 'firebase/auth';
import { UserAvatar } from '../components/UserAvatar';
import { getComplaints, updateUserProfile, anonymizeUser, sendSupportMessage } from '../services/api.js';

export default function Profile() {
  const { user, userData, logout } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const [reportedCount, setReportedCount] = useState(0);
  const [resolvedCount, setResolvedCount] = useState(0);

  const [isEditing, setIsEditing] = useState(false);
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isSupportFormOpen, setIsSupportFormOpen] = useState(false);
  const [supportMessage, setSupportMessage] = useState('');
  const [isSendingSupport, setIsSendingSupport] = useState(false);
  const [isSupportSent, setIsSupportSent] = useState(false);
  const [editName, setEditName] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    const loadStats = async () => {
      try {
        const complaints = await getComplaints({ userId: user.uid, isArchived: 'all' });
        if (!isMounted) return;
        setReportedCount(complaints.length);
        setResolvedCount(complaints.filter(complaint => complaint.status === 'Resolved').length);
      } catch (error) {
        console.error('Could not load profile stats', error);
      }
    };

    loadStats();
    const interval = window.setInterval(loadStats, 30000);
    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [user]);

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const maxDim = 400; // Profile pics don't need to be massive
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height *= maxDim / width;
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width *= maxDim / height;
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
            setPhotoPreview(compressedBase64);
          }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const updates = {};
      
      if (editName.trim() !== user.displayName) {
        updates.name = editName.trim();
      }
      if (photoPreview) {
         updates.photoURL = photoPreview;
      }

      if (Object.keys(updates).length > 0) {
        await updateUserProfile(user.uid, updates);
        
        // Update Firebase Auth profile
        if (updates.name) {
          await updateProfile(user, {
            displayName: updates.name
          });
        }
      }

      setIsEditing(false);
      window.location.reload();
    } catch (error) {
      console.error('Could not save profile', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="p-5 flex flex-col items-center justify-center min-h-full text-center animate-in fade-in zoom-in duration-300 pb-20">
        <div className="w-20 h-20 bg-gray-50 dark:bg-[#272727] dark:shadow-none text-gray-400 rounded-full flex items-center justify-center mb-6 ring-8 ring-gray-50/50">
          <UserIcon className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Your Profile</h2>
        <p className="text-gray-500 dark:text-[#AAAAAA] text-sm mt-2 max-w-[280px] mx-auto leading-relaxed mb-8">
          Sign in to view your trust score, track your reported issues, and manage your account settings.
        </p>
        <button 
          onClick={() => navigate('/auth')}
          className="bg-blue-600 text-white font-semibold py-3.5 px-6 rounded-xl shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all active:scale-[0.98] flex items-center justify-center gap-3 w-full max-w-[280px] mx-auto"
        >
          Sign In
        </button>
      </div>
    );
  }

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm("Are you sure you want to delete your account? This action cannot be undone.");
    if (!confirmDelete || !user) return;
    
    setIsDeleting(true);
    try {
      await anonymizeUser(user.uid);
      await deleteUser(user);
      logout();
      navigate('/');
    } catch (error) {
      console.error('Could not delete account', error);
      alert('Could not delete account. If you just logged in recently, you might need to sign in again to perform this action.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSupportSubmit = async () => {
    if (!supportMessage.trim()) return;
    setIsSendingSupport(true);
    try {
      await sendSupportMessage(supportMessage);
      setIsSendingSupport(false);
      setIsSupportSent(true);
      setTimeout(() => {
        setIsSupportSent(false);
        setIsSupportFormOpen(false);
        setSupportMessage('');
      }, 2000);
    } catch (err) {
      console.error(err);
      alert('Failed to send support message.');
      setIsSendingSupport(false);
    }
  };

  if (isAccountSettingsOpen) {
    return (
      <div className="p-4 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="flex items-center justify-between mb-4 mt-2">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Account Settings</h2>
          <button 
            onClick={() => setIsAccountSettingsOpen(false)}
            className="text-sm font-semibold text-gray-500 dark:text-[#AAAAAA] hover:text-gray-700 dark:text-[#F1F1F1] dark:hover:text-gray-300 transition-colors"
          >
            Done
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-white dark:bg-[#0F0F0F] dark:shadow-none rounded-xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/10">
              <div className="flex items-center gap-3">
                {isDarkMode ? <Moon className="w-5 h-5 text-gray-500 dark:text-[#AAAAAA]" /> : <Sun className="w-5 h-5 text-gray-500 dark:text-[#AAAAAA]" />}
                <div className="font-medium text-sm text-gray-900 dark:text-white">Dark Mode</div>
              </div>
              <button 
                onClick={toggleDarkMode}
                className={cn(
                  "w-11 h-6 rounded-full transition-colors relative", 
                  isDarkMode ? "bg-blue-600" : "bg-gray-200"
                )}
              >
                <div className={cn(
                  "w-5 h-5 bg-white dark:bg-[#0F0F0F] dark:shadow-none rounded-full shadow absolute top-0.5 transition-transform",
                  isDarkMode ? "translate-x-5" : "translate-x-0.5"
                )} />
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0F0F0F] dark:shadow-none rounded-xl border border-red-100 dark:border-red-900 shadow-sm overflow-hidden mt-6 text-left p-4">
            <h3 className="text-red-600 font-bold mb-2">Danger Zone</h3>
            <p className="text-xs text-gray-500 dark:text-[#AAAAAA] mb-4 max-w-[280px]">
              Deleting your account will anonymize all your submitted reports and securely remove your personal data.
            </p>
            <button 
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="w-full bg-red-50 dark:bg-red-900/20 text-red-600 font-semibold py-3 px-4 rounded-xl shadow-sm hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors flex items-center justify-center gap-2"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {isDeleting ? "Deleting..." : "Delete Account"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isSupportOpen) {
    return (
      <div className="p-4 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 pb-20">
        <div className="flex items-center justify-between mb-4 mt-2">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Support & Help</h2>
          <button 
            onClick={() => setIsSupportOpen(false)}
            className="text-sm font-semibold text-gray-500 dark:text-[#AAAAAA] hover:text-gray-700 dark:text-[#F1F1F1] transition-colors"
          >
            Done
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-white dark:bg-[#0F0F0F] rounded-xl border border-gray-100 dark:border-white/10 shadow-sm p-5 space-y-5">
            <h3 className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-wider">Frequently Asked Questions</h3>
            <div className="space-y-4">
              <details className="group">
                <summary className="text-sm font-semibold cursor-pointer text-gray-700 dark:text-[#F1F1F1] outline-none">How do I report a civic issue?</summary>
                <p className="mt-2 text-xs text-gray-600 dark:text-[#AAAAAA] leading-relaxed">Navigate to the Report tab, select an issue category, describe the problem, and upload a clear photo. Once submitted, our AI will automatically classify and assign it to the relevant department.</p>
              </details>
              <div className="h-px bg-gray-100 dark:bg-white/5 w-full" />
              <details className="group">
                <summary className="text-sm font-semibold cursor-pointer text-gray-700 dark:text-[#F1F1F1] outline-none">What is the Trust Score?</summary>
                <p className="mt-2 text-xs text-gray-600 dark:text-[#AAAAAA] leading-relaxed">The Trust Score highlights reliable citizens. It increases as you accurately report issues and administrators approve them. High scores may receive faster response times from city personnel.</p>
              </details>
              <div className="h-px bg-gray-100 dark:bg-white/5 w-full" />
              <details className="group">
                <summary className="text-sm font-semibold cursor-pointer text-gray-700 dark:text-[#F1F1F1] outline-none">How do I track my issue's progress?</summary>
                <p className="mt-2 text-xs text-gray-600 dark:text-[#AAAAAA] leading-relaxed">Visit the Track tab to see real-time status updates (e.g., Assigned, In Progress, Resolved) and any comments left by city administrators.</p>
              </details>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-[#004ac6]/10 rounded-xl p-5 border border-blue-100 dark:border-[#004ac6]/30 text-center space-y-3 shadow-sm">
            <HelpCircle className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto" strokeWidth={1.5} />
            <h3 className="font-bold text-blue-900 dark:text-blue-300 text-sm">Need More Direct Help?</h3>
            <p className="text-xs text-blue-700 dark:text-[#AAAAAA] leading-relaxed max-w-[250px] mx-auto mb-4">Our civic administration team is available Monday through Friday to assist with critical inquiries.</p>
            
            {!isSupportFormOpen ? (
              <button 
                onClick={() => setIsSupportFormOpen(true)}
                className="mt-4 bg-blue-600 text-white text-xs font-bold py-3 px-4 rounded-xl shadow-md hover:bg-blue-700 active:scale-95 transition-all w-full"
              >
                Contact Support Team
              </button>
            ) : (
              <div className="text-left mt-4 animate-in fade-in slide-in-from-top-2">
                <textarea
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  placeholder="Describe your issue or question in detail..."
                  className="w-full bg-white dark:bg-black border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3 min-h-[100px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600"
                />
                <div className="flex gap-2">
                  <button 
                    onClick={() => { setIsSupportFormOpen(false); setSupportMessage(''); }}
                    className="flex-1 bg-white dark:bg-black border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold py-3 px-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSupportSubmit}
                    disabled={isSendingSupport || isSupportSent || !supportMessage.trim()}
                    className={cn(
                      "flex-[2] text-white text-xs font-bold py-3 px-4 rounded-xl shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2",
                      isSupportSent ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"
                    )}
                  >
                    {isSendingSupport && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isSupportSent && <Check className="w-4 h-4" />}
                    {isSendingSupport ? 'Sending...' : isSupportSent ? 'Sent!' : 'Send Message'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="p-4 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="flex items-center justify-between mb-4 mt-2">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Profile</h2>
          <button 
            onClick={() => { setIsEditing(false); setPhotoPreview(null); }}
            className="text-sm font-semibold text-gray-500 dark:text-[#AAAAAA] hover:text-gray-700 dark:text-[#F1F1F1] transition-colors"
          >
            Cancel
          </button>
        </div>

        <div className="flex flex-col items-center justify-center space-y-4 py-4">
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <UserAvatar 
              photoURL={photoPreview || userData?.photoURL || user?.photoURL}
              name={userData?.name || user?.displayName}
              email={user?.email}
              className="w-28 h-28 text-4xl border-4 border-white shadow-md"
            />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-8 h-8 text-white" />
            </div>
            <div className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full ring-4 ring-white shadow-sm">
               <Camera className="w-4 h-4" />
            </div>
          </div>
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Change Photo</span>
          
          <input 
            type="file" 
            accept="image/*" 
            capture="user"
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleImageChange} 
          />
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold text-gray-600 dark:text-[#AAAAAA] uppercase tracking-wider">
              Display Name
            </label>
            <input 
              type="text" 
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="What should we call you?"
              className="w-full bg-white dark:bg-[#0F0F0F] dark:shadow-none border border-gray-200 text-gray-800 dark:text-white py-4 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="pt-8">
          <button 
            onClick={saveProfile}
            disabled={isSaving || !editName.trim()}
            className="w-full bg-blue-600 disabled:bg-blue-400 text-white font-semibold py-4 rounded-xl shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            {isSaving ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      {/* Profile Header */}
      <div className="flex flex-col items-center justify-center text-center space-y-2 py-4">
        <div className="relative">
          <UserAvatar 
            photoURL={userData?.photoURL || user?.photoURL}
            name={userData?.name || user?.displayName}
            email={user?.email}
            className="w-20 h-20 text-3xl border-4 border-white shadow-md"
          />
          <div className="absolute -bottom-2 bg-green-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full ring-2 ring-white uppercase tracking-wider text-center flex justify-center items-center left-1/2 -translate-x-1/2">
            Verified
          </div>
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mt-2">{userData?.name || user?.displayName || "Citizen"}</h2>
          <p className="text-xs text-gray-500 dark:text-[#AAAAAA] font-medium flex items-center justify-center gap-1">
            {user?.email || "No email"}
          </p>
        </div>
      </div>

      {/* Trust Score Card */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-5 border border-blue-200 shadow-sm relative overflow-hidden">
        <div className="absolute -right-4 -top-4 text-blue-200/50">
          <Shield className="w-32 h-32" />
        </div>
        <div className="relative z-10 flex justify-between items-end">
          <div>
            <p className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-1">Trust Score</p>
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-black text-blue-600 tracking-tighter">{userData?.trustScore ?? 100}</span>
              <span className="text-sm font-bold text-blue-400">/100+</span>
            </div>
          </div>
          <div className="text-right">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white mb-1 shadow-md shadow-blue-500/30">
              <Shield className="w-4 h-4" />
            </div>
            <p className="text-xs font-semibold text-blue-800">
              {(userData?.trustScore ?? 100) >= 150 ? 'Elite Status' : 
               (userData?.trustScore ?? 100) >= 120 ? 'Trusted Citizen' : 'Active Citizen'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-[#0F0F0F] dark:shadow-none rounded-xl p-4 border border-gray-100 dark:border-white/10 shadow-sm flex flex-col justify-center">
          <Target className="w-5 h-5 text-purple-500 mb-2" />
          <div className="text-xs font-medium text-gray-500 dark:text-[#AAAAAA] mb-0.5">Issues Reported</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{reportedCount}</div>
        </div>
        <div className="bg-white dark:bg-[#0F0F0F] dark:shadow-none rounded-xl p-4 border border-gray-100 dark:border-white/10 shadow-sm flex flex-col justify-center">
          <Award className="w-5 h-5 text-green-500 mb-2" />
          <div className="text-xs font-medium text-gray-500 dark:text-[#AAAAAA] mb-0.5">Resolved Issues</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{resolvedCount}</div>
        </div>
      </div>

      {/* Settings Links */}
      <div className="bg-white dark:bg-[#0F0F0F] dark:shadow-none rounded-xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
        <SettingsLink 
          onClick={() => {
            setEditName(userData?.name || user?.displayName || '');
            setPhotoPreview(null);
            setIsEditing(true);
          }} 
          icon={<UserIcon className="w-4 h-4" />} 
          label="Edit Profile" 
        />
        <SettingsLink 
          onClick={() => setIsAccountSettingsOpen(true)}
          icon={<Settings className="w-4 h-4" />} 
          label="Account Settings" 
        />
        <SettingsLink icon={<Bell className="w-4 h-4" />} label="Notification Preferences" />
        <SettingsLink onClick={() => setIsSupportOpen(true)} icon={<HelpCircle className="w-4 h-4" />} label="Support & Help" />
        <SettingsLink onClick={() => { logout(); navigate('/'); }} icon={<svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>} label="Log Out" isLast className="text-red-600" />
      </div>

    </div>
  );
}

function SettingsLink({ icon, label, isLast = false, onClick, className }) {
  return (
    <button onClick={onClick} className={cn(
      "w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:bg-[#272727] dark:shadow-none transition-colors",
      !isLast && "border-b border-gray-50"
    )}>
      <div className={cn("flex items-center gap-3 text-sm font-medium text-gray-700 dark:text-[#F1F1F1]", className)}>
        <div className="text-gray-400">{icon}</div>
        {label}
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400" />
    </button>
  );
}

function ChevronRight({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>    
}

