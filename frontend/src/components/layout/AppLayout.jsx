import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Home, PlusCircle, Activity, User, ShieldAlert, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import { UserAvatar } from '../UserAvatar';
import { getNotifications, markNotificationsRead } from '../../services/api.js';

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, user, userData, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    let isMounted = true;
    const loadNotifications = async () => {
      try {
        const data = await getNotifications(user.uid);
        let notificationsList = [];
        if (Array.isArray(data)) {
          notificationsList = data;
        } else if (data && Array.isArray(data.notifications)) {
          notificationsList = data.notifications;
        }
        const notifs = notificationsList.map(notification => {
        let timeString = 'Just now';
        if (notification.createdAt) {
          const date = new Date(notification.createdAt);
          const now = new Date();
          const diffStr = Math.round((now.getTime() - date.getTime()) / 60000);
          if (diffStr < 60) timeString = `${diffStr}m ago`;
          else if (diffStr < 1440) timeString = `${Math.round(diffStr / 60)}h ago`;
          else timeString = `${Math.round(diffStr / 1440)}d ago`;
        }
        return {
          id: notification.id || notification._id,
          title: notification.title,
          message: notification.message,
          isNew: notification.isNew !== undefined ? notification.isNew : notification.unread,
          time: timeString
        };
      });
        if (isMounted) setNotifications(notifs);
      } catch (error) {
        console.error('Could not load notifications', error);
      }
    };
    loadNotifications();
    const interval = window.setInterval(loadNotifications, 30000);
    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [user]);

  const unreadCount = notifications.filter(n => n.isNew).length;

  const markAllAsRead = async () => {
    if (!user) return;
    try {
      await markNotificationsRead(user.uid);
      setNotifications(prev => prev.map(notification => ({ ...notification, isNew: false })));
    } catch (e) {
      console.error('Could not mark notifications as read', e);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-slate-100 dark:bg-black mx-auto max-w-md shadow-2xl relative overflow-hidden">
      {/* Sidebar Menu Overlay */}
      {isMenuOpen && (
        <div className="absolute inset-0 z-[9999] flex">
          <div className="absolute inset-0 bg-black/20 dark:bg-black/40" onClick={() => setIsMenuOpen(false)} />
          <div className="relative w-64 bg-white dark:bg-[#0F0F0F] dark:shadow-none h-full flex flex-col shadow-xl animate-in slide-in-from-left duration-200">
            <div className="p-4 border-b border-gray-100 dark:border-white/10 flex items-center justify-between">
              <h2 className="font-bold text-gray-900 dark:text-white">Menu</h2>
              <button onClick={() => setIsMenuOpen(false)} className="p-1 text-gray-500 dark:text-[#AAAAAA] rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-col flex-1 gap-2 p-4">
              <SidebarItem to="/app" icon={<Home className="w-5 h-5" />} label="Home" onClick={() => setIsMenuOpen(false)} />
              <SidebarItem to="/app/report" icon={<PlusCircle className="w-5 h-5" />} label="Report Issue" onClick={() => setIsMenuOpen(false)} />
              {role === 'admin' && (
                <SidebarItem to="/app/admin" icon={<ShieldAlert className="w-5 h-5" />} label="Admin Dashboard" onClick={() => setIsMenuOpen(false)} />
              )}
              <SidebarItem to="/app/track" icon={<Activity className="w-5 h-5" />} label="Track Complaints" onClick={() => setIsMenuOpen(false)} />
              <SidebarItem to="/app/profile" icon={<User className="w-5 h-5" />} label="Profile" onClick={() => setIsMenuOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-[#0F0F0F] z-10 sticky top-0 relative">
        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gray-100 dark:bg-white/10 overflow-hidden shadow-sm">
          <div className="h-full w-[40%] bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-led-scan shadow-[0_0_8px_rgba(59,130,246,1)]" />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsMenuOpen(true)} className="p-1 -ml-1 text-gray-700 dark:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800">
            <MenuIcon className="w-5 h-5" />
          </button>
          <h1 className="font-semibold text-lg text-gray-900 dark:text-white tracking-tight">
            SmartNagar AI
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 font-medium border border-blue-100 flex items-center gap-1">
                {role === 'admin' ? <ShieldAlert className="w-3 h-3"/> : <User className="w-3 h-3"/>}
                {role === 'admin' ? 'Admin' : 'Citizen'}
              </div>
              <div className="relative">
                <Bell 
                  className="h-5 w-5 text-gray-600 dark:text-[#AAAAAA] cursor-pointer" 
                  onClick={() => setIsNotificationOpen(true)}
                />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border border-white flex items-center justify-center text-[10px] text-white font-bold">
                    {unreadCount}
                  </span>
                )}
              </div>
              <UserAvatar 
                photoURL={userData?.photoURL || user?.photoURL}
                name={userData?.name || user?.displayName}
                email={user?.email}
                onClick={() => navigate('/app/profile')}
                className="h-8 w-8 text-xs ring-2 ring-transparent hover:ring-blue-500 cursor-pointer transition-all"
                title="Go to profile"
              />
            </>
          ) : (
            <button 
              onClick={() => navigate('/auth')}
              className="text-xs bg-blue-600 text-white font-medium px-4 py-1.5 rounded-full hover:bg-blue-700 transition active:scale-95"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-20 no-scrollbar">
        <Outlet />
      </main>

      {/* Notifications Overlay */}
      {isNotificationOpen && (
        <div className="absolute inset-0 z-[9999] flex justify-end">
          <div className="absolute inset-0 bg-black/20 dark:bg-black/40" onClick={() => setIsNotificationOpen(false)} />
          <div className="relative w-80 bg-white dark:bg-[#0F0F0F] h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200 z-[9999] rounded-l-2xl">
            <div className="p-4 border-b border-gray-100 dark:border-white/10 flex items-center justify-between bg-blue-600 text-white rounded-tl-2xl">
              <div>
                <h2 className="font-bold flex items-center gap-2">
                  Notifications
                  {unreadCount > 0 && <span className="bg-white dark:bg-black text-blue-600 text-xs px-2 py-0.5 rounded-full">{unreadCount}</span>}
                </h2>
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-xs hover:text-blue-100 transition mr-2 font-medium">
                    Mark all read
                  </button>
                )}
                <button onClick={() => setIsNotificationOpen(false)} className="p-1 hover:bg-white/20 rounded-lg transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-slate-50/50 dark:bg-black">
              {notifications.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-[#AAAAAA] my-10 text-sm">No notifications yet.</div>
              ) : (
                notifications.map(n => (
                  <NotificationItem 
                    key={n.id} 
                    title={n.title} 
                    message={n.message} 
                    time={n.time} 
                    isNew={n.isNew} 
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="absolute bottom-0 left-0 right-0 bg-white dark:bg-[#0F0F0F] dark:shadow-none border-t border-gray-100 dark:border-white/10 px-6 py-2 flex justify-between items-center rounded-t-2xl z-20 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
        <NavItem to="/app" icon={<Home className="h-5 w-5" />} label="Home" active={location.pathname === '/app'} />
        <NavItem to="/app/report" icon={<PlusCircle className="h-5 w-5" />} label="Report" active={location.pathname === '/app/report'} />
        {role === 'admin' && (
          <NavItem to="/app/admin" icon={<ShieldAlert className="h-5 w-5" />} label="Admin" active={location.pathname === '/app/admin'} />
        )}
        <NavItem to="/app/track" icon={<Activity className="h-5 w-5" />} label="Track" active={location.pathname === '/app/track'} />
        <NavItem to="/app/profile" icon={<User className="h-5 w-5" />} label="Profile" active={location.pathname === '/app/profile'} />
      </nav>
    </div>
  );
}

function NavItem({ to, icon, label, active }) {
  return (
    <NavLink 
      to={to} 
      className={cn(
        "flex flex-col items-center gap-1 p-2 transition-colors",
        active ? "text-blue-600" : "text-gray-400 hover:text-gray-600 dark:text-[#AAAAAA]"
      )}
    >
      <div className={cn(
        "p-1.5 rounded-full transition-all",
        active ? "bg-blue-50" : "bg-transparent"
      )}>
        {icon}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </NavLink>
  );
}

function SidebarItem({ to, icon, label, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) => cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors",
        isActive ? "bg-blue-50 text-blue-600" : "text-gray-600 dark:text-[#AAAAAA] hover:bg-gray-50 dark:bg-[#272727] dark:shadow-none hover:text-gray-900 dark:text-white"
      )}
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

function MenuIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

const NotificationItem = ({ title, message, time, isNew }) => {
  return (
    <div className={cn("p-3 rounded-xl border", isNew ? "bg-blue-50/50 border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/30" : "bg-white dark:bg-[#0F0F0F] border-gray-100 dark:border-white/10")}>
      <div className="flex justify-between items-start gap-2 mb-1">
        <h4 className={cn("text-sm font-semibold", isNew ? "text-blue-900 dark:text-blue-400" : "text-gray-900 dark:text-white")}>{title}</h4>
        {isNew && <span className="w-2 h-2 rounded-full bg-blue-500 mt-1 flex-shrink-0" />}
      </div>
      <p className="text-xs text-gray-600 dark:text-[#AAAAAA] line-clamp-2">{message}</p>
      <span className="text-[10px] text-gray-400 mt-2 block font-medium">{time}</span>
    </div>
  );
};
