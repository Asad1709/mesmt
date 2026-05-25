import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock, ListTodo, Map as MapIcon, BarChart3, Settings, ShieldAlert, ChevronRight, Activity, ArrowUpCircle, X, Archive, ArchiveRestore } from 'lucide-react';
import { cn } from '../lib/utils';
import LiveHeatmap from '../components/LiveHeatmap';
import UserNameLabel from '../components/UserNameLabel';
import { getComplaints, updateComplaintAssignment, updateComplaintStatus, archiveComplaint } from '../services/api.js';

const categories = ['All', 'Road Maintenance', 'Water & Sanitation', 'Electrical & Streetlights', 'Garbage & Waste', 'Public Infrastructure'];
const priorities = ['All', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const departments = ['Road Works', 'Water & Sanitation', 'Electrical', 'Waste Management', 'Public Infrastructure', 'Emergency Response'];

function departmentForCategory(category) {
  const map = {
    'Road Maintenance': 'Road Works',
    'Water & Sanitation': 'Water & Sanitation',
    'Electrical & Streetlights': 'Electrical',
    'Garbage & Waste': 'Waste Management',
    'Public Infrastructure': 'Public Infrastructure'
  };
  return map[category] || 'Public Infrastructure';
}

export default function AdminDashboard() {
  const { role, loading } = useAuth();
  const [issues, setIssues] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('');
  const [assignmentDrafts, setAssignmentDrafts] = useState({});
  const [actionError, setActionError] = useState('');
  const [viewMode, setViewMode] = useState('active'); // active | archived

  useEffect(() => {
    if (role !== 'admin') return;

    let isMounted = true;
    const loadIssues = async () => {
      try {
        const data = await getComplaints({ isArchived: 'all' });
        if (isMounted) setIssues(data);
      } catch (error) {
        console.error('Could not load complaints', error);
      }
    };
    loadIssues();
    const interval = window.setInterval(loadIssues, 30000);
    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [role]);

  if (loading) return null;
  
  if (role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  const activeIssuesList = issues.filter(i => !i.isArchived);
  const archivedIssuesList = issues.filter(i => i.isArchived);
  
  const currentViewList = viewMode === 'active' ? activeIssuesList : archivedIssuesList;

  // Stats (only compute for active ones except maybe total)
  const totalComplaints = activeIssuesList.length;
  const resolvedIssues = activeIssuesList.filter(i => i.status === 'Resolved').length;
  const pendingIssues = activeIssuesList.filter(i => i.status === 'Pending Review' || i.status === 'Assigned' || i.status === 'In Progress').length;
  const urgentIssues = activeIssuesList.filter(i => i.priority === 'URGENT' || i.priority === 'HIGH').length;
  const assignedIssues = activeIssuesList.filter(i => i.assignedTo || i.status === 'Assigned').length;

  const filteredIssues = currentViewList.filter(issue => {
    const matchesCategory = categoryFilter === 'All' || issue.category === categoryFilter;
    const matchesPriority = priorityFilter === 'All' || issue.priority === priorityFilter;
    const place = `${issue.locationName || ''} ${issue.location?.address || ''}`.toLowerCase();
    const matchesLocation = !locationFilter.trim() || place.includes(locationFilter.trim().toLowerCase());
    return matchesCategory && matchesPriority && matchesLocation;
  });

  const getAssignmentDraft = (issue) => assignmentDrafts[issue.id] || {
    assignedTo: issue.assignedTo || '',
    assignedDepartment: issue.assignedDepartment || departmentForCategory(issue.category),
    taskNotes: issue.taskNotes || '',
    dueDate: issue.dueDate ? issue.dueDate.slice(0, 10) : ''
  };

  const updateAssignmentDraft = (issue, updates) => {
    setAssignmentDrafts(prev => ({
      ...prev,
      [issue.id]: {
        ...getAssignmentDraft(issue),
        ...updates
      }
    }));
  };

  const updateStatus = async (issueId, newStatus) => {
    setActionError('');
    setIssues(prev => prev.map(issue => issue.id === issueId ? { ...issue, status: newStatus } : issue));
    try {
      const updatedIssue = await updateComplaintStatus(issueId, newStatus);
      setIssues(prev => prev.map(issue => issue.id === issueId ? updatedIssue : issue));
    } catch (error) {
      console.error('Could not update complaint status', error);
      setActionError(error?.response?.data?.error || 'Could not update status. Please try again.');
      try {
        const data = await getComplaints({ isArchived: 'all' });
        setIssues(data);
      } catch (reloadError) {
        console.error('Could not reload complaints after status failure', reloadError);
      }
    }
  };

  const saveAssignment = async (issue) => {
    setActionError('');
    try {
      const draft = getAssignmentDraft(issue);
      const updatedIssue = await updateComplaintAssignment(issue.id, draft);
      setIssues(prev => prev.map(item => item.id === issue.id ? updatedIssue : item));
      setAssignmentDrafts(prev => {
        const next = { ...prev };
        delete next[issue.id];
        return next;
      });
    } catch (error) {
      console.error('Could not assign complaint', error);
      setActionError(error?.response?.data?.error || 'Could not save assignment. Please try again.');
    }
  };

  const toggleArchive = async (issue) => {
    setActionError('');
    const newArchivedState = !issue.isArchived;
    setIssues(prev => prev.map(i => i.id === issue.id ? { ...i, isArchived: newArchivedState } : i));
    try {
      const updatedIssue = await archiveComplaint(issue.id, newArchivedState);
      setIssues(prev => prev.map(i => i.id === issue.id ? updatedIssue : i));
    } catch (error) {
      console.error('Could not archive complaint', error);
      setActionError(error?.response?.data?.error || 'Could not update archive status. Please try again.');
      try {
        const data = await getComplaints({ isArchived: 'all' });
        setIssues(data);
      } catch (reloadError) {
        console.error('Could not reload complaints after archive failure', reloadError);
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Resolved': return 'text-green-600 bg-green-50 ring-green-200';
      case 'Assigned': return 'text-indigo-600 bg-indigo-50 ring-indigo-200';
      case 'In Progress': return 'text-blue-600 bg-blue-50 ring-blue-200';
      case 'Scheduled': return 'text-purple-600 bg-purple-50 ring-purple-200';
      case 'Pending Review': return 'text-orange-600 bg-orange-50 ring-orange-200';
      case 'Rejected': return 'text-red-600 bg-red-50 ring-red-200';
      default: return 'text-gray-600 dark:text-[#AAAAAA] bg-gray-50 dark:bg-[#272727] dark:shadow-none ring-gray-200';
    }
  };

  return (
    <div className="p-4 space-y-6 animate-in fade-in zoom-in-95 duration-300 pb-24">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-600" />
          Admin Dashboard
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard 
          title="Total Complaints" 
          value={totalComplaints} 
          icon={<ListTodo className="w-5 h-5 text-blue-500" />} 
          bgColor="bg-blue-50"
          textColor="text-blue-700"
        />
        <MetricCard 
          title="Resolved" 
          value={resolvedIssues} 
          icon={<CheckCircle2 className="w-5 h-5 text-green-500" />} 
          bgColor="bg-green-50"
          textColor="text-green-700"
        />
        <MetricCard 
          title="Pending" 
          value={pendingIssues} 
          icon={<Clock className="w-5 h-5 text-orange-500" />} 
          bgColor="bg-orange-50"
          textColor="text-orange-700"
        />
        <MetricCard 
          title="Urgent Needs" 
          value={urgentIssues} 
          icon={<AlertCircle className="w-5 h-5 text-red-500" />} 
          bgColor="bg-red-50"
          textColor="text-red-700"
        />
        <MetricCard 
          title="Assigned Tasks" 
          value={assignedIssues} 
          icon={<Activity className="w-5 h-5 text-indigo-500" />} 
          bgColor="bg-indigo-50"
          textColor="text-indigo-700"
        />
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <MapIcon className="w-5 h-5 text-indigo-500" />
          Incident Heatmap
        </h3>
        <p className="text-sm text-gray-500 dark:text-[#AAAAAA] mb-4">Visualizing areas with high complaint frequency and priority.</p>
        
        <LiveHeatmap issues={issues} height="h-72" />
      </div>

      <div className="space-y-3 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-500" />
              Complaint Processing
            </h3>
            <p className="text-sm text-gray-500 dark:text-[#AAAAAA]">Review and update the status of complaints.</p>
          </div>
        </div>

        <div className="flex bg-gray-100 dark:bg-[#272727] dark:shadow-none p-1 rounded-xl w-full max-w-sm mb-4">
          <button 
            onClick={() => setViewMode('active')}
            className={cn("flex-1 py-1.5 px-3 text-sm font-bold rounded-lg transition-all", viewMode === 'active' ? "bg-white dark:bg-[#0F0F0F] dark:shadow-none text-indigo-600 shadow-sm" : "text-gray-500 dark:text-[#AAAAAA] hover:text-gray-700 dark:text-[#F1F1F1]")}
          >
            Active ({activeIssuesList.length})
          </button>
          <button 
            onClick={() => setViewMode('archived')}
            className={cn("flex-1 py-1.5 px-3 text-sm font-bold rounded-lg transition-all", viewMode === 'archived' ? "bg-white dark:bg-[#0F0F0F] dark:shadow-none text-indigo-600 shadow-sm" : "text-gray-500 dark:text-[#AAAAAA] hover:text-gray-700 dark:text-[#F1F1F1]")}
          >
            Archived ({archivedIssuesList.length})
          </button>
        </div>

        {actionError && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-xs font-medium p-3 rounded-xl">
            {actionError}
          </div>
        )}

        <div className="bg-white dark:bg-[#0F0F0F] dark:shadow-none p-3 rounded-2xl shadow-sm border border-gray-100 dark:border-white/10 grid grid-cols-1 gap-3">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-gray-50 dark:bg-[#272727] dark:shadow-none border border-gray-200 text-gray-700 dark:text-[#F1F1F1] text-xs font-semibold py-2.5 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              {categories.map(category => <option key={category}>{category}</option>)}
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full bg-gray-50 dark:bg-[#272727] dark:shadow-none border border-gray-200 text-gray-700 dark:text-[#F1F1F1] text-xs font-semibold py-2.5 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              {priorities.map(priority => <option key={priority} value={priority}>{priority === 'All' ? 'All Priorities' : priority}</option>)}
            </select>
          </div>
          <input
            type="text"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            placeholder="Filter by place, ward, road, landmark..."
            className="w-full bg-gray-50 dark:bg-[#272727] dark:shadow-none border border-gray-200 text-gray-700 dark:text-[#F1F1F1] text-sm py-2.5 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 placeholder:text-gray-400"
          />
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            Showing {filteredIssues.length} of {issues.length} complaints
          </div>
        </div>

        <div className="space-y-3">
          {filteredIssues.length === 0 && (
            <div className="bg-white dark:bg-[#0F0F0F] dark:shadow-none p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-white/10 text-center text-sm text-gray-500 dark:text-[#AAAAAA]">
              No complaints match the current filters.
            </div>
          )}
          {filteredIssues.map(issue => {
            const draft = getAssignmentDraft(issue);
            return (
            <div key={issue.id} className="bg-white dark:bg-[#0F0F0F] dark:shadow-none p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-white/10 flex flex-col gap-3">
              <div className="flex gap-3">
                <img 
                  src={issue.imageUrl || 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&q=80&w=400'} 
                  alt="Issue" 
                  className={cn("w-16 h-16 rounded-xl object-cover bg-gray-100 dark:bg-[#272727] dark:shadow-none flex-shrink-0", issue.imageUrl ? "cursor-pointer hover:opacity-80 transition-opacity" : "")}
                  onClick={() => issue.imageUrl && setSelectedImage(issue.imageUrl)}
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-gray-900 dark:text-white truncate">{issue.title || issue.category}</h4>
                  <p className="text-sm text-gray-500 dark:text-[#AAAAAA] truncate">{issue.category}</p>
                  <p className="text-xs text-gray-500 dark:text-[#AAAAAA] truncate">{issue.locationName || 'Location not provided'}</p>
                  <UserNameLabel userId={issue.userId} />
                  
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide",
                      issue.priority === 'URGENT' ? 'bg-red-100 text-red-700' :
                      issue.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                      issue.priority === 'MEDIUM' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 dark:bg-[#272727] dark:shadow-none text-gray-700 dark:text-[#F1F1F1]'
                    )}>
                      {issue.priority}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-[#AAAAAA] bg-gray-50 dark:bg-[#272727] dark:shadow-none px-2 py-0.5 rounded-full">
                      <ArrowUpCircle className="w-3 h-3 text-gray-400" />
                      <span className="font-medium">{issue.upvotesCount || 0}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 border-t border-gray-50 pt-3">
                <span className="text-xs font-semibold text-gray-500 dark:text-[#AAAAAA] uppercase tracking-wider">Status</span>
                <select 
                  value={issue.status}
                  onChange={(e) => updateStatus(issue.id, e.target.value)}
                  className={cn(
                    "ml-auto text-sm font-bold bg-transparent border-0 rounded-lg focus:ring-2 focus:ring-indigo-500/20 py-1 pl-2 pr-8 appearance-none cursor-pointer text-right",
                    getStatusColor(issue.status).split(' ')[0]
                  )}
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: `right 0.25rem center`,
                    backgroundRepeat: `no-repeat`,
                    backgroundSize: `1.5em 1.5em`
                  }}
                >
                  <option value="Pending Review">Pending Review</option>
                  <option value="Assigned">Assigned</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              {issue.status === 'Resolved' && (
                <div className="flex justify-end pb-2">
                  <button 
                    onClick={() => toggleArchive(issue)}
                    className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-[#AAAAAA] hover:text-gray-900 dark:text-white transition-colors bg-gray-50 dark:bg-[#272727] dark:shadow-none hover:bg-gray-100 dark:bg-[#272727] dark:shadow-none py-1.5 px-3 rounded-lg"
                  >
                    {issue.isArchived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                    {issue.isArchived ? "Unarchive Report" : "Archive Report"}
                  </button>
                </div>
              )}

              <div className="border-t border-gray-50 pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 dark:text-[#AAAAAA] uppercase tracking-wider">Task Assignment</span>
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full",
                    issue.assignedTo || issue.status === 'Assigned' ? "bg-indigo-50 text-indigo-700" : "bg-gray-100 dark:bg-[#272727] dark:shadow-none text-gray-500 dark:text-[#AAAAAA]"
                  )}>
                    {issue.assignedTo || issue.status === 'Assigned' ? 'Assigned' : 'Ready'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={draft.assignedDepartment}
                    onChange={(e) => updateAssignmentDraft(issue, { assignedDepartment: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-[#272727] dark:shadow-none border border-gray-200 text-gray-700 dark:text-[#F1F1F1] text-xs font-semibold py-2.5 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">Department</option>
                    {departments.map(department => <option key={department}>{department}</option>)}
                  </select>
                  <input
                    type="date"
                    value={draft.dueDate}
                    onChange={(e) => updateAssignmentDraft(issue, { dueDate: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-[#272727] dark:shadow-none border border-gray-200 text-gray-700 dark:text-[#F1F1F1] text-xs font-semibold py-2.5 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <input
                  type="text"
                  value={draft.assignedTo}
                  onChange={(e) => updateAssignmentDraft(issue, { assignedTo: e.target.value })}
                  placeholder="Assign to officer, team, or contractor"
                  className="w-full bg-gray-50 dark:bg-[#272727] dark:shadow-none border border-gray-200 text-gray-700 dark:text-[#F1F1F1] text-sm py-2.5 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 placeholder:text-gray-400"
                />

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={draft.taskNotes}
                    onChange={(e) => updateAssignmentDraft(issue, { taskNotes: e.target.value })}
                    placeholder="Task note"
                    className="flex-1 min-w-0 bg-gray-50 dark:bg-[#272727] dark:shadow-none border border-gray-200 text-gray-700 dark:text-[#F1F1F1] text-sm py-2.5 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 placeholder:text-gray-400"
                  />
                  <button
                    type="button"
                    onClick={() => saveAssignment(issue)}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md shadow-indigo-500/20 active:scale-95 transition-all"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )})}
        </div>
      </div>

      {selectedImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" onClick={() => setSelectedImage(null)}>
          <img src={selectedImage} alt="Full screen preview" className="max-w-full max-h-full rounded-lg object-contain" />
          <button className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, icon, bgColor, textColor }) {
  return (
    <div className="bg-white dark:bg-[#0F0F0F] dark:shadow-none p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-white/10 flex flex-col items-center justify-center text-center gap-2">
      <div className={`p-2 rounded-xl ${bgColor}`}>
        {icon}
      </div>
      <div className="text-2xl font-black text-gray-900 dark:text-white">{value}</div>
      <div className={`text-xs font-bold uppercase tracking-wider ${textColor}`}>{title}</div>
    </div>
  );
}

