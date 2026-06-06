import { useState, useEffect } from 'react';
import { 
  Laptop, 
  IndianRupee, 
  UserCheck, 
  Activity, 
  ShieldAlert, 
  Bot, 
  LayoutDashboard, 
  Sun, 
  Moon,
  Users,
  LogOut,
  FileCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Menu
} from 'lucide-react';

// Components
import { Dashboard } from './components/Dashboard';
import { AssetList } from './components/AssetList';
import { Purchases } from './components/Purchases';
import { Allocation } from './components/Allocation';
import { LiveTelemetry } from './components/LiveTelemetry';
import { ScreenViewer } from './components/ScreenViewer';
import { SecuritySettings } from './components/SecuritySettings';
import { AIAssistant } from './components/AIAssistant';
import { ActiveAgents } from './components/ActiveAgents';
import { UserManagement } from './components/UserManagement';
import { AssetRequests } from './components/AssetRequests';
import { NotificationBell } from './components/NotificationBell';
import { LoginScreen } from './components/LoginScreen';
import { useAuth } from './contexts/AuthContext';
import { apiUrl } from './services/apiConfig';

// Main Interface Definitions
interface Asset {
  id: string;
  asset_id: string;
  hostname: string;
  category: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  os_name: string;
  os_version: string;
  ip_address: string;
  mac_address: string;
  cpu_model: string;
  cpu_cores: number;
  ram_total: string;
  disks: any;
  software_inventory: Array<{
    name: string;
    version: string;
    publisher: string;
    install_date: string;
  }>;
  status: string;
  last_seen: string;
  employee_email?: string;
}

export default function App() {
  const { isAuthenticated, isLoading, logout, currentUser, isAdmin, token } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [usersRefreshKey, setUsersRefreshKey] = useState(0);
  const [theme, setTheme] = useState<string>('dark');

  // Unified State
  const [assets, setAssets] = useState<Asset[]>([]);

  const [purchases, setPurchases] = useState<any[]>([]);

  const [allocations, setAllocations] = useState<any[]>([]);

  const [historyLogs, setHistoryLogs] = useState<any[]>([]);

  const [metrics, setMetrics] = useState<any[]>([]);

  const [screenAgentId, setScreenAgentId] = useState<string | null>(null);
  const [screenHostname, setScreenHostname] = useState<string>('');

  // Non-admin users only see assets allocated to them
  const userAssets = isAdmin
    ? assets
    : assets.filter(a => a.employee_email?.toLowerCase() === currentUser?.email?.toLowerCase());

  // Set HTML theme data attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Live API Polling Loop
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [assetsRes, metricsRes, historyRes, purchasesRes] = await Promise.all([
          fetch(apiUrl("/api/v1/assets")),

          fetch(apiUrl("/api/v1/metrics")),

          fetch(apiUrl("/api/v1/history")),

          fetch(apiUrl("/api/purchases")),
        ]);
        if (assetsRes.ok) setAssets(await assetsRes.json());
        if (metricsRes.ok) setMetrics(await metricsRes.json());
        if (historyRes.ok) setHistoryLogs(await historyRes.json());
        if (purchasesRes.ok) setPurchases(await purchasesRes.json());
      } catch (err) {
        // Silent fallback
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  // Screen Share Actions
  const handleWatchScreen = async (agentId: string, hostname: string) => {
    try {
      await fetch(apiUrl(`/api/screen/${encodeURIComponent(agentId)}/start`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname }),
      });
    } catch {
      // silent
    }
    setScreenAgentId(agentId);
    setScreenHostname(hostname);
  };

  const handleStopScreen = () => {
    setScreenAgentId(null);
    setScreenHostname('');
  };

  // CRUD Actions
  const handleAddAsset = (newAsset: Omit<Asset, 'id' | 'last_seen'>) => {
    const freshAsset: Asset = {
      ...newAsset,
      id: String(assets.length + 1),
      last_seen: new Date().toISOString().replace('T', ' ').split('.')[0]
    };
    setAssets([...assets, freshAsset]);
    
    // Auto-update metrics
    setMetrics([...metrics, {
      id: freshAsset.id,
      hostname: freshAsset.hostname,
      category: freshAsset.category,
      cpu_usage: 10,
      ram_usage: 35,
      disk_usage: 15,
      last_seen: 'Just now'
    }]);

    // Add Discovery History Log
    setHistoryLogs([{
      id: String(historyLogs.length + 1),
      hostname: freshAsset.hostname,
      event_type: 'Discovery',
      description: `New asset manually registered: ${freshAsset.hostname}`,
      changed_by: 'Admin',
      created_at: new Date().toISOString().replace('T', ' ').split('.')[0].substring(0, 16)
    }, ...historyLogs]);
  };

  const handleUpdateAsset = async (updatedAsset: Asset) => {
    setAssets(assets.map(a => a.id === updatedAsset.id ? updatedAsset : a));

    try {
      await fetch(apiUrl(`/api/assets/${encodeURIComponent(updatedAsset.id)}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedAsset),
      });
    } catch {
      // silent
    }

    setHistoryLogs([{
      id: String(historyLogs.length + 1),
      hostname: updatedAsset.hostname,
      event_type: 'Configuration Change',
      description: `Asset parameters updated: ${updatedAsset.hostname}`,
      changed_by: 'Admin',
      created_at: new Date().toISOString().replace('T', ' ').split('.')[0].substring(0, 16)
    }, ...historyLogs]);
  };

  const handleDeleteAsset = async (id: string) => {
    const targetAsset = assets.find(a => a.id === id);
    if (!targetAsset) return;
    
    // Optimistic UI updates
    setAssets(assets.filter(a => a.id !== id));
    setMetrics(metrics.filter(m => m.id !== id));
    
    try {
      await fetch(apiUrl(`/api/assets/${id}`), {
        method: 'DELETE'
      });
    } catch (err) {
      console.error("Failed to delete asset on server:", err);
    }

    setHistoryLogs([{
      id: String(historyLogs.length + 1),
      hostname: targetAsset.hostname,
      event_type: 'Disposal',
      description: `Asset retired and permanently removed from catalog: ${targetAsset.hostname}`,
      changed_by: 'Admin',
      created_at: new Date().toISOString().replace('T', ' ').split('.')[0].substring(0, 16)
    }, ...historyLogs]);
  };

  // Allocation Triggers
  const handleAllocate = (assetId: string, employeeName: string, employeeEmail: string) => {
    const targetAsset = assets.find(a => a.id === assetId);
    if (!targetAsset) return;

    // Persist allocation on backend
    fetch(apiUrl(`/api/assets/${encodeURIComponent(assetId)}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        employee_name: employeeName,
        employee_email: employeeEmail,
        status: 'Allocated'
      }),
    }).catch(() => {});

    // Update Asset Status to Allocated
    setAssets(assets.map(a => a.id === assetId ? { ...a, status: 'Allocated', employee_name: employeeName, employee_email: employeeEmail } : a));

    // Register Allocation
    const newAlloc = {
      id: String(allocations.length + 1),
      asset_id: targetAsset.asset_id,
      hostname: targetAsset.hostname,
      employee_name: employeeName,
      employee_email: employeeEmail,
      allocated_at: new Date().toISOString().split('T')[0],
      returned_at: null
    };
    setAllocations([newAlloc, ...allocations]);

    // Audit Log
    setHistoryLogs([{
      id: String(historyLogs.length + 1),
      hostname: targetAsset.hostname,
      event_type: 'Allocation',
      description: `Asset allocated to ${employeeName} (${employeeEmail}).`,
      changed_by: 'Admin',
      created_at: new Date().toISOString().replace('T', ' ').split('.')[0].substring(0, 16)
    }, ...historyLogs]);

    setUsersRefreshKey(k => k + 1);
  };

  const handleReturn = (allocationId: string) => {
    const targetAlloc = allocations.find(a => a.id === allocationId);
    if (!targetAlloc) return;

    // Find target asset by hostname or ID
    const targetAsset = assets.find(a => a.asset_id === targetAlloc.asset_id);
    if (!targetAsset) return;

    // Persist deallocation on backend
    fetch(apiUrl(`/api/assets/${encodeURIComponent(targetAsset.id)}/deallocate`), {
      method: 'PUT',
    }).catch(() => {});

    // Update Asset Status to Available
    setAssets(assets.map(a => a.id === targetAsset.id ? { ...a, status: 'Available', employee_name: '', employee_email: '' } : a));

    // Close Allocation
    setAllocations(allocations.map(a => a.id === allocationId ? {
      ...a,
      returned_at: new Date().toISOString().split('T')[0]
    } : a));

    // Audit Log
    setHistoryLogs([{
      id: String(historyLogs.length + 1),
      hostname: targetAsset.hostname,
      event_type: 'Return',
      description: `Asset returned from ${targetAlloc.employee_name} and marked Available.`,
      changed_by: 'Operator',
      created_at: new Date().toISOString().replace('T', ' ').split('.')[0].substring(0, 16)
    }, ...historyLogs]);

    setUsersRefreshKey(k => k + 1);
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--charcoal)' }}>
        <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--hairline-strong)', borderTopColor: 'var(--ink)', borderRadius: '50%' }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <div className="app-container">
      {/* Mobile sidebar backdrop */}
      <div className={`sidebar-backdrop${mobileSidebarOpen ? ' visible' : ''}`} onClick={() => setMobileSidebarOpen(false)} />
      
      {/* 1. SIDEBAR */}
      <aside className={`sidebar${sidebarCollapsed ? ' collapsed' : ''}${mobileSidebarOpen ? ' mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <Laptop size={24} />
          <span className="brand-text">ITAM Portal v1.0</span>
          <button className="compact-toggle" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <ul className="sidebar-menu">
          <li>
            <a className={`menu-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('dashboard'); setMobileSidebarOpen(false); }}>
              <LayoutDashboard /> <span className="menu-label">Dashboard</span>
            </a>
          </li>
          <li>
            <a className={`menu-item ${activeTab === 'assets' ? 'active' : ''}`} onClick={() => { setActiveTab('assets'); setMobileSidebarOpen(false); }}>
              <Laptop /> <span className="menu-label">Asset Inventory</span>
            </a>
          </li>
          <li>
            <a className={`menu-item ${activeTab === 'active_agents' ? 'active' : ''}`} onClick={() => { setActiveTab('active_agents'); setMobileSidebarOpen(false); }}>
              <Activity /> <span className="menu-label">{isAdmin ? 'Active Agents' : 'My Assignments'}</span>
            </a>
          </li>
          <li>
            <a className={`menu-item ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => { setActiveTab('requests'); setMobileSidebarOpen(false); }}>
              <FileCheck /> <span className="menu-label">{isAdmin ? 'Pending Approvals' : 'My Requests'}</span>
            </a>
          </li>
          {isAdmin && (
            <li>
              <a className={`menu-item ${activeTab === 'purchases' ? 'active' : ''}`} onClick={() => { setActiveTab('purchases'); setMobileSidebarOpen(false); }}>
                <IndianRupee /> <span className="menu-label">Purchases & Costs</span>
              </a>
            </li>
          )}
          {isAdmin && (
            <li>
              <a className={`menu-item ${activeTab === 'allocations' ? 'active' : ''}`} onClick={() => { setActiveTab('allocations'); setMobileSidebarOpen(false); }}>
                <UserCheck /> <span className="menu-label">Allocation Logs</span>
              </a>
            </li>
          )}
          {isAdmin && (
            <li>
              <a className={`menu-item ${activeTab === 'monitoring' ? 'active' : ''}`} onClick={() => { setActiveTab('monitoring'); setMobileSidebarOpen(false); }}>
                <Activity /> <span className="menu-label">Live Telemetry</span>
              </a>
            </li>
          )}
          <li>
            <a className={`menu-item ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => { setActiveTab('ai'); setMobileSidebarOpen(false); }}>
              <Bot /> <span className="menu-label">ITAM AI Assistant</span>
            </a>
          </li>
          {isAdmin && (
            <li>
              <a className={`menu-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => { setActiveTab('users'); setMobileSidebarOpen(false); }}>
                <Users /> <span className="menu-label">User Management</span>
              </a>
            </li>
          )}
          <li>
            <a className={`menu-item ${activeTab === 'security' ? 'active' : ''}`} onClick={() => { setActiveTab('security'); setMobileSidebarOpen(false); }}>
              <ShieldAlert /> <span className="menu-label">Security & API</span>
            </a>
          </li>
        </ul>

        <div className="sidebar-footer">
          <div className="sidebar-footer-content">
            <div className="user-info" style={{ fontSize: '14px', color: 'var(--charcoal)', padding: '0 4px' }}>
              <strong>{currentUser?.name}</strong>
              <span style={{ display: 'block', fontSize: '12px', color: 'var(--mute)' }}>{currentUser?.email}</span>
            </div>
            <div className="footer-actions" style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? <><Sun size={14} style={{ marginRight: '6px' }} /> <span className="btn-label">Light</span></> : <><Moon size={14} style={{ marginRight: '6px' }} /> <span className="btn-label">Dark</span></>}
              </button>
              <button className="btn btn-secondary" style={{ color: 'var(--accent-red)' }} onClick={logout} title="Logout">
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE */}
      <main className="main-content" style={{ position: 'relative' }}>
        {/* Atmospheric background glows */}
        <div className="portal-bg-orb portal-bg-orb-1" />
        <div className="portal-bg-orb portal-bg-orb-2" />
        <div className="portal-bg-orb portal-bg-orb-3" />
        <header className="top-bar">
          <div className="page-title">
            <h1>
              {activeTab === 'dashboard' && 'Operations Dashboard'}
              {activeTab === 'assets' && 'Asset Discovery Grid'}
              {activeTab === 'active_agents' && (isAdmin ? 'Discovered Active Agents' : 'My Assigned Devices')}
              {activeTab === 'requests' && (isAdmin ? 'Pending Approvals' : 'My Requests')}
              {activeTab === 'purchases' && 'Purchase Invoices & Warranties'}
              {activeTab === 'allocations' && 'Asset Allocation Tracking'}
              {activeTab === 'users' && 'User Management'}
              {isAdmin && activeTab === 'monitoring' && 'Live Telemetry & Diagnostics'}
              {activeTab === 'ai' && 'AI Copilot Assistant'}
              {activeTab === 'security' && 'Security & API Settings'}
            </h1>
            <p>
              {activeTab === 'dashboard' && 'Overview of active endpoint hardware, software saturation, and status indicators.'}
              {activeTab === 'assets' && 'Audit and modify discovered assets, CPU specs, and individual registry software sets.'}
              {activeTab === 'active_agents' && (isAdmin ? 'Manage discovered background endpoint agents, map fleet groups, and execute administrative device registration.' : 'View devices assigned by you to employees.')}
              {activeTab === 'requests' && (isAdmin ? 'Review and approve/reject asset requests from users.' : 'Track your hardware and software requests and submit new ones.')}
              {activeTab === 'purchases' && 'Record and analyze IT financial spending, vendor logs, and warranty contracts.'}
              {activeTab === 'allocations' && 'Assign assets to employees, return devices, and trace full audit trails.'}
              {activeTab === 'users' && 'Manage registered users, promote or demote administrators, and view device allocations.'}
              {isAdmin && activeTab === 'monitoring' && 'Live screen access for allocated Laptops and Desktops.'}
              {activeTab === 'ai' && 'OpenAI-powered assistant for natural language search, report generation, and warranty forecasts.'}
              {activeTab === 'security' && 'Manage API keys, agent tokens, and view security configurations.'}
            </p>
          </div>
          
          <div className="top-bar-actions">
            <button className="mobile-hamburger" onClick={() => setMobileSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <NotificationBell />
            <span style={{ fontSize: '14px', color: 'var(--charcoal)' }}>System Role: <strong>{isAdmin ? 'Admin' : 'Support Engineer'}</strong></span>
          </div>
        </header>

        {/* Tab Router Panels */}
        {activeTab === 'dashboard' && <Dashboard assets={assets} setActiveTab={setActiveTab} />}
        {activeTab === 'assets' && <AssetList assets={userAssets} onAddAsset={handleAddAsset} onUpdateAsset={handleUpdateAsset} onDeleteAsset={handleDeleteAsset} readOnly={!isAdmin} />}
        {activeTab === 'active_agents' && <ActiveAgents />}
        {activeTab === 'requests' && <AssetRequests />}
        {isAdmin && activeTab === 'purchases' && <Purchases purchases={purchases} />}
        {isAdmin && activeTab === 'allocations' && <Allocation assets={assets} allocations={allocations} historyLogs={historyLogs} onAllocate={handleAllocate} onReturn={handleReturn} />}
        {isAdmin && activeTab === 'users' && <UserManagement refreshKey={usersRefreshKey} />}
        {isAdmin && activeTab === 'monitoring' && <LiveTelemetry onWatchScreen={handleWatchScreen} />}
        {activeTab === 'ai' && <AIAssistant />}
        {activeTab === 'security' && <SecuritySettings />}
      </main>

      {screenAgentId && (
        <ScreenViewer agentId={screenAgentId} hostname={screenHostname} onClose={handleStopScreen} />
      )}
    </div>
  );
}
