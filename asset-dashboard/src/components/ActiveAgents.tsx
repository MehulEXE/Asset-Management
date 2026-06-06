import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Search, 
  Filter, 
  Users, 
  CheckCircle, 
  XCircle, 
  UserPlus, 
  Info, 
  Plus, 
  Eye,
  FileSpreadsheet,
  Globe,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import API_BASE from '../services/apiConfig';

const API_BASE_URL = API_BASE;

interface Agent {
  id: string;
  agent_id: string;
  hostname: string;
  mac_address: string;
  ip_address: string;
  serial_number: string;
  agent_version: string;
  os_name: string;
  os_version: string;
  cpu_model: string;
  cpu_cores: number;
  ram_total: string;
  disks: Array<{ drive: string; total_size: string; used_size: string; free_size: string }>;
  status: 'Online' | 'Offline';
  registration_status: 'Registered' | 'Unregistered';
  last_checkin: string;
  software_inventory: any[];
  employee_name?: string;
}

interface Group {
  id: string;
  name: string;
  group_type: string;
}

export const ActiveAgents: React.FC = () => {
  const { currentUser, isAdmin, token } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [groups, setGroups] = useState<Group[]>([
    { id: '1', name: 'Finance Team', group_type: 'Department-Based' },
    { id: '2', name: 'HR Team', group_type: 'Department-Based' },
    { id: '3', name: 'IT Team', group_type: 'Department-Based' },
    { id: '4', name: 'Development Team', group_type: 'Department-Based' },
    { id: '5', name: 'Delhi Office', group_type: 'Location-Based' },
    { id: '6', name: 'Bangalore Office', group_type: 'Location-Based' }
  ]);

  // UI States
  const [registerModalAgent, setRegisterModalAgent] = useState<Agent | null>(null);
  const [detailDrawerAgent, setDetailDrawerAgent] = useState<any | null>(null);
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterOS, setFilterOS] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterRegistration, setFilterRegistration] = useState('All');

  // Sorting
  const [sortField, setSortField] = useState<keyof Agent>('hostname');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Bulk Selection
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [showBulkGroupModal, setShowBulkGroupModal] = useState(false);
  const [bulkGroupId, setBulkGroupId] = useState('');

  // New Group Creation inside Modal
  const [showNewGroupForm, setShowNewGroupForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupType, setNewGroupType] = useState('General');

  // Registration Form State
  const [regCompany, setRegCompany] = useState('Enterprise Corp');
  const [regBusinessUnit, setRegBusinessUnit] = useState('Global Operations');
  const [regDept, setRegDept] = useState('IT Department');
  const [regLocation, setRegLocation] = useState('Bangalore Office');
  const [regBranchOffice, setRegBranchOffice] = useState('Tower B, Phase 2');
  
  const [regEmpName, setRegEmpName] = useState('');
  const [regEmpId, setRegEmpId] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regEmpType, setRegEmpType] = useState<'self' | 'other'>('self');
  const [regPhone, setRegPhone] = useState('');
  const [regManager, setRegManager] = useState('');

  const [regCategory, setRegCategory] = useState('Laptop');
  const [regCustomCategory, setRegCustomCategory] = useState('');
  const [regAssetTag, setRegAssetTag] = useState('');
  const [regPurchaseDate, setRegPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [regWarrantyExpiry, setRegWarrantyExpiry] = useState(new Date(Date.now() + 365*3*24*60*60*1000).toISOString().split('T')[0]);
  const [regVendor, setRegVendor] = useState('Dell Direct');
  const [regGroups, setRegGroups] = useState<string[]>([]);

  // Fetch Discovered Agents
  const fetchAgents = async () => {
    try {
      if (!token) return;
      const res = await fetch(`${API_BASE_URL}/api/agents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAgents(data);
      }
    } catch (err) {
      console.error("Failed to fetch discovered agents:", err);
    }
  };

  const handleTriggerImmediateScan = async () => {
    setIsScanning(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/agent/scan`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (res.ok) {
        setTimeout(() => {
          fetchAgents();
          setIsScanning(false);
        }, 3000);
      } else {
        setIsScanning(false);
      }
    } catch {
      setIsScanning(false);
    }
  };

  const handleRestartAgent = async () => {
    setIsRestarting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/agent/restart`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        setTimeout(() => {
          fetchAgents();
          setIsRestarting(false);
        }, 3000);
      } else {
        alert("Failed to restart agent.");
        setIsRestarting(false);
      }
    } catch {
      alert("Error contacting the restart endpoint.");
      setIsRestarting(false);
    }
  };

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 3000);
    return () => clearInterval(interval);
  }, []);

  // Sort & Filter logic
  const handleSort = (field: keyof Agent) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredAgents = agents.filter(a => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      a.hostname.toLowerCase().includes(term) ||
      a.mac_address.toLowerCase().includes(term) ||
      a.serial_number.toLowerCase().includes(term) ||
      a.ip_address.includes(term) ||
      (a.employee_name && a.employee_name.toLowerCase().includes(term));

    const matchesOS = filterOS === 'All' || a.os_name.toLowerCase().includes(filterOS.toLowerCase());
    const matchesStatus = filterStatus === 'All' || a.status === filterStatus;
    const matchesRegistration = filterRegistration === 'All' || a.registration_status === filterRegistration;

    return matchesSearch && matchesOS && matchesStatus && matchesRegistration;
  });

  const sortedAgents = [...filteredAgents].sort((a, b) => {
    const valA = a[sortField];
    const valB = b[sortField];
    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return 0;
  });

  // Pagination bounds
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sortedAgents.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedAgents.length / itemsPerPage);

  // Bulk Actions
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedAgentIds(currentItems.map(item => item.id));
    } else {
      setSelectedAgentIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedAgentIds([...selectedAgentIds, id]);
    } else {
      setSelectedAgentIds(selectedAgentIds.filter(x => x !== id));
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (selectedAgentIds.length === 0) return alert("Select at least one agent to export!");
    const selected = agents.filter(a => selectedAgentIds.includes(a.id));
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Host Name,MAC Address,IP Address,OS Name,CPU,RAM,Serial Number,Status,Registration Status\n";
    
    selected.forEach(s => {
      csvContent += `"${s.hostname}","${s.mac_address}","${s.ip_address}","${s.os_name}","${s.cpu_model}","${s.ram_total}","${s.serial_number}","${s.status}","${s.registration_status}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ITAM_Active_Agents_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open device registration form
  const openRegisterModal = (agent: Agent) => {
    setRegisterModalAgent(agent);
    setRegAssetTag(`AST-${agent.hostname}-${Math.floor(1000 + Math.random()*9000)}`);
    setRegEmpType('self');
    setRegEmpName(currentUser?.name || '');
    setRegEmpId('');
    setRegEmail(currentUser?.email || '');
    setRegPhone('');
    setRegGroups([]);
  };

  // Submit device registration
  const handleRegisterDeviceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerModalAgent) return;

    const payload = {
      id: registerModalAgent.id,
      agent_id: registerModalAgent.agent_id,
      mac_address: registerModalAgent.mac_address,
      category: regCategory === 'Other' ? regCustomCategory : regCategory,
      asset_tag: regAssetTag,
      company: regCompany,
      business_unit: regBusinessUnit,
      department: regDept,
      location: regLocation,
      branch_office: regBranchOffice,
      employee_name: regEmpName,
      employee_id: regEmpId,
      employee_email: regEmail,
      employee_phone: regPhone,
      manager_name: regManager,
      purchase_date: regPurchaseDate,
      warranty_expiry: regWarrantyExpiry,
      vendor_name: regVendor,
      groups: regGroups
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/agents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonSafeStringify(payload)
      });

      const data = await res.json().catch(() => null);

      if (res.ok) {
        alert(`Device ${registerModalAgent.hostname} successfully registered as managed IT asset!`);
        setRegisterModalAgent(null);
        fetchAgents();
      } else {
        alert(`Registration failed: ${data?.message || data?.error || res.statusText || 'Unknown error'}`);
      }
    } catch (err) {
      alert("Error submitting agent registration. Check backend connectivity.");
    }
  };

  // Create new group inside registration modal
  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/groups/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGroupName, group_type: newGroupType })
      });

      if (res.ok) {
        const data = await res.json();
        setGroups([...groups, data.group]);
        setRegGroups([...regGroups, data.group.name]);
        setNewGroupName('');
        setShowNewGroupForm(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // View registered device details drawer
  const openDeviceDetails = async (agent: Agent) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/assets/${agent.id}`);
      if (res.ok) {
        const data = await res.json();
        setDetailDrawerAgent(data);
      } else {
        // Fallback if unregistered yet
        setDetailDrawerAgent({
          unregistered: true,
          ...agent
        });
      }
    } catch (err) {
      setDetailDrawerAgent({
        unregistered: true,
        ...agent
      });
    }
  };

  // Handle Bulk Group Assignment
  const handleBulkGroupAssignSubmit = async () => {
    if (!bulkGroupId) return;
    const targetGroup = groups.find(g => g.id === bulkGroupId);
    if (!targetGroup) return;

    // Call PUT assign for all selected agents
    for (const agentId of selectedAgentIds) {
      try {
        const agentObj = agents.find(a => a.id === agentId);
        if (!agentObj) continue;

        await fetch(`${API_BASE_URL}/api/agents/${agentObj.agent_id}/assign`, {
          method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            groups: [targetGroup.name]
          })
        });
      } catch (err) {
        console.error(err);
      }
    }

    alert(`Successfully assigned selected devices to ${targetGroup.name}`);
    setShowBulkGroupModal(false);
    setSelectedAgentIds([]);
    fetchAgents();
  };

  function jsonSafeStringify(obj: any) {
    return JSON.stringify(obj, (_, value) => (value === undefined ? null : value));
  }

  // Count active stats
  const totalAgents = agents.length;
  const onlineAgents = agents.filter(a => a.status === 'Online').length;
  const registeredAgents = agents.filter(a => a.registration_status === 'Registered').length;
  const unregisteredAgents = totalAgents - registeredAgents;

  return (
    <div className="animated-fade">
      {/* 1. KEY DIAGNOSTIC CARDS */}
      <div className="grid-kpi" style={{ marginBottom: '24px' }}>
        <div className="card-kpi">
          <div className="kpi-icon" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
            <Activity />
          </div>
          <div className="kpi-info">
            <h3>Discovered Telemetry</h3>
            <p>{totalAgents} Agents</p>
          </div>
        </div>

        <div className="card-kpi">
          <div className="kpi-icon" style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)' }}>
            <CheckCircle />
          </div>
          <div className="kpi-info">
            <h3>Active Online</h3>
            <p>{onlineAgents} Live</p>
          </div>
        </div>

        <div className="card-kpi">
          <div className="kpi-icon" style={{ backgroundColor: 'var(--warning-light)', color: 'var(--warning)' }}>
            <Globe />
          </div>
          <div className="kpi-info">
            <h3>Registered Fleet</h3>
            <p>{registeredAgents} Assets</p>
          </div>
        </div>

        <div className="card-kpi">
          <div className="kpi-icon" style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger)' }}>
            <XCircle />
          </div>
          <div className="kpi-info">
            <h3>Unregistered Enrolls</h3>
            <p>{unregisteredAgents} Pending</p>
          </div>
        </div>
      </div>

      {/* 2. SEARCH & FILTER ACTION BAR */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          
          <div style={{ display: 'flex', gap: '12px', flexGrow: 1, maxWidth: '800px' }}>
            <div style={{ position: 'relative', flexGrow: 1, maxWidth: '350px' }}>
              <input 
                type="text" 
                className="form-control" 
                placeholder="Search hostname, IP, MAC, Serial, Employee..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '35px' }}
              />
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-tertiary)' }} />
            </div>

            <button 
              className="btn btn-secondary" 
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Filter size={15} /> Filters {showAdvancedFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {/* Bulk actions ribbon (only visible when assets checked) */}
            {isAdmin && selectedAgentIds.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: 'var(--bg-tertiary)', padding: '4px 12px', borderRadius: '8px', border: '1px solid var(--primary-light)' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--primary)' }}>{selectedAgentIds.length} Selected</span>
                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => setShowBulkGroupModal(true)}>
                  <Users size={14} style={{ marginRight: '4px' }} /> Group Assign
                </button>
                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={handleExportCSV}>
                  <FileSpreadsheet size={14} style={{ marginRight: '4px', color: 'var(--success)' }} /> Export CSV
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              Auto Syncing (3s)
            </span>
            <button 
              className="btn btn-primary" 
              onClick={handleTriggerImmediateScan} 
              disabled={isScanning || isRestarting}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: (isScanning || isRestarting) ? 'not-allowed' : 'pointer' }}
            >
              {isScanning ? (
                <>
                  <span className="animate-spin" style={{ width: '12px', height: '12px', border: '2px solid white', borderTop: '2px solid transparent', borderRadius: '50%', display: 'inline-block' }} />
                  Scanning Node...
                </>
              ) : (
                <>
                  <Activity size={14} />
                  Auto Scanning
                </>
              )}
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={handleRestartAgent} 
              disabled={isScanning || isRestarting}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: (isScanning || isRestarting) ? 'not-allowed' : 'pointer' }}
            >
              {isRestarting ? (
                <>
                  <span className="animate-spin" style={{ width: '12px', height: '12px', border: '2px solid var(--text-primary)', borderTop: '2px solid transparent', borderRadius: '50%', display: 'inline-block' }} />
                  Restarting...
                </>
              ) : (
                <>
                  <RefreshCw size={14} />
                  Restart Agent
                </>
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Advanced Filters */}
        {showAdvancedFilters && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <div className="form-group">
              <label>Operating System</label>
              <select className="form-control" value={filterOS} onChange={e => setFilterOS(e.target.value)}>
                <option value="All">All Operating Systems</option>
                <option value="Windows">Windows</option>
                <option value="Ubuntu">Ubuntu/Linux</option>
                <option value="Darwin">macOS</option>
              </select>
            </div>

            <div className="form-group">
              <label>Agent Status</label>
              <select className="form-control" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="All">All Statuses</option>
                <option value="Online">Online</option>
                <option value="Offline">Offline</option>
              </select>
            </div>

            <div className="form-group">
              <label>Enrollment Status</label>
              <select className="form-control" value={filterRegistration} onChange={e => setFilterRegistration(e.target.value)}>
                <option value="All">All Registered</option>
                <option value="Registered">Registered</option>
                <option value="Unregistered">Unregistered</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 3. DISCOVERY TABLE CARD */}
      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                {isAdmin && (
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      onChange={handleSelectAll} 
                      checked={selectedAgentIds.length === currentItems.length && currentItems.length > 0} 
                    />
                  </th>
                )}
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('hostname')}>Host Name</th>
                <th>MAC Address</th>
                <th>OS & Version</th>
                <th>Hardware Specs (CPU/RAM/Disk)</th>
                <th>Check-in & Version</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map(agent => (
                <tr key={agent.id} style={{ borderLeft: agent.status === 'Online' ? '3px solid var(--success)' : '3px solid var(--text-tertiary)' }}>
                  {isAdmin && (
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedAgentIds.includes(agent.id)} 
                        onChange={e => handleSelectRow(agent.id, e.target.checked)}
                      />
                    </td>
                  )}
                  <td>
                    <div style={{ fontWeight: 'bold' }}>{agent.hostname}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Serial: {agent.serial_number}</div>
                  </td>
                  <td style={{ fontFamily: 'Consolas', fontSize: '0.82rem' }}>{agent.mac_address}</td>
                  <td>
                    <div style={{ fontSize: '0.85rem' }}>{agent.os_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Ver: {agent.os_version}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.82rem', fontWeight: '500' }}>{agent.cpu_model}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      RAM: {agent.ram_total} | Disk: {agent.disks && agent.disks.length > 0 ? agent.disks[0].total_size : 'Unknown'}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.82rem' }}>{agent.last_checkin}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Agent v{agent.agent_version}</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span className={`badge badge-${agent.status === 'Online' ? 'success' : 'secondary'}`}>
                        {agent.status}
                      </span>
                      <span className={`badge badge-${agent.registration_status === 'Registered' ? 'info' : 'warning'}`}>
                        {agent.registration_status}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-secondary" style={{ padding: '6px' }} title="View Telemetry & Details" onClick={() => openDeviceDetails(agent)}>
                        <Eye size={15} />
                      </button>
                      {agent.registration_status === 'Unregistered' ? (
                        <button className="btn btn-primary" style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => openRegisterModal(agent)}>
                          <UserPlus size={14} /> Register
                        </button>
                      ) : (
                        <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem', color: 'var(--success)', cursor: 'default' }} disabled>
                          Registered
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {currentItems.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
                    <Info size={32} style={{ marginBottom: '10px' }} />
                    <p>No active discovered agents match the current filter selection.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 4. PAGINATION FOOTER */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Showing {indexOfFirstItem+1} to {Math.min(indexOfLastItem, sortedAgents.length)} of {sortedAgents.length} discovered devices</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="btn btn-secondary" style={{ padding: '6px 12px' }} disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>
                Previous
              </button>
              <button className="btn btn-secondary" style={{ padding: '6px 12px' }} disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: REGISTER DEVICE */}
      {registerModalAgent && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '850px' }}>
            <div className="modal-header">
              <div>
                <h2>Asset Registration Workflow</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Host: {registerModalAgent.hostname} • MAC: {registerModalAgent.mac_address}</p>
              </div>
              <button className="btn-icon" onClick={() => setRegisterModalAgent(null)} style={{ border: 'none', background: 'none' }}>×</button>
            </div>
            
            <form onSubmit={handleRegisterDeviceSubmit}>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                
                {/* Section A: Org details */}
                <h3 style={{ fontSize: '1rem', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '15px' }}>
                  1. Organization Parameters
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                  <div className="form-group">
                    <label>Company Name</label>
                    <input type="text" className="form-control" value={regCompany} onChange={e => setRegCompany(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Business Unit</label>
                    <input type="text" className="form-control" value={regBusinessUnit} onChange={e => setRegBusinessUnit(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Department</label>
                    <input type="text" className="form-control" value={regDept} onChange={e => setRegDept(e.target.value)} required />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                  <div className="form-group">
                    <label>Office Location</label>
                    <input type="text" className="form-control" value={regLocation} onChange={e => setRegLocation(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Branch / Building Block</label>
                    <input type="text" className="form-control" value={regBranchOffice} onChange={e => setRegBranchOffice(e.target.value)} />
                  </div>
                </div>

                {/* Section B: User Details */}
                <h3 style={{ fontSize: '1rem', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '15px' }}>
                  2. Assignment & User Details
                </h3>
                <div style={{ marginBottom: '15px' }}>
                  <div className="form-group">
                    <label>Assign To</label>
                    <select className="form-control" value={regEmpType} onChange={e => {
                      const val = e.target.value as 'self' | 'other';
                      setRegEmpType(val);
                      if (val === 'self') {
                        setRegEmpName(currentUser?.name || '');
                        setRegEmail(currentUser?.email || '');
                      } else {
                        setRegEmpName('');
                        setRegEmail('');
                      }
                    }}>
                      <option value="self">Self</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                  <div className="form-group">
                    <label>Employee Name</label>
                    {regEmpType === 'self' ? (
                      <input type="text" className="form-control" value={currentUser?.name || ''} disabled />
                    ) : (
                      <input type="text" className="form-control" value={regEmpName} onChange={e => setRegEmpName(e.target.value)} placeholder="e.g. John Doe" required />
                    )}
                  </div>
                  <div className="form-group">
                    <label>Employee ID</label>
                    <input type="text" className="form-control" value={regEmpId} onChange={e => setRegEmpId(e.target.value)} placeholder="e.g. EMP-9982" required />
                  </div>
                  <div className="form-group">
                    <label>Manager Name</label>
                    <input type="text" className="form-control" value={regManager} onChange={e => setRegManager(e.target.value)} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                  <div className="form-group">
                    <label>Email Address</label>
                    {regEmpType === 'self' ? (
                      <input type="email" className="form-control" value={currentUser?.email || ''} disabled />
                    ) : (
                      <input type="email" className="form-control" value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
                    )}
                  </div>
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input type="text" className="form-control" value={regPhone} onChange={e => setRegPhone(e.target.value)} />
                  </div>
                </div>

                {/* Section C: Asset details */}
                <h3 style={{ fontSize: '1rem', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '15px' }}>
                  3. Hardware Asset Attributes
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                  <div className="form-group">
                    <label>Asset Category</label>
                    <select className="form-control" value={regCategory} onChange={e => { setRegCategory(e.target.value); if (e.target.value !== 'Other') setRegCustomCategory(''); }}>
                      <option value="Laptop">Laptop</option>
                      <option value="Desktop">Desktop</option>
                      <option value="Server">Server</option>
                      <option value="VM">Virtual Machine</option>
                      <option value="Network Device">Network Device</option>
                      <option value="Other">Other</option>
                    </select>
                    {regCategory === 'Other' && (
                      <input className="form-control" style={{ marginTop: 8 }} value={regCustomCategory} onChange={e => setRegCustomCategory(e.target.value)} placeholder="Describe the type..." required />
                    )}
                  </div>
                  <div className="form-group">
                    <label>Asset Tag ID</label>
                    <input type="text" className="form-control" value={regAssetTag} onChange={e => setRegAssetTag(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Vendor Partner</label>
                    <input type="text" className="form-control" value={regVendor} onChange={e => setRegVendor(e.target.value)} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                  <div className="form-group">
                    <label>Purchase Date</label>
                    <input type="date" className="form-control" value={regPurchaseDate} onChange={e => setRegPurchaseDate(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Warranty Expiry</label>
                    <input type="date" className="form-control" value={regWarrantyExpiry} onChange={e => setRegWarrantyExpiry(e.target.value)} />
                  </div>
                </div>

                {/* Section D: Groups details */}
                <h3 style={{ fontSize: '1rem', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>4. Assign Fleet Groups</span>
                  <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => setShowNewGroupForm(!showNewGroupForm)}>
                    <Plus size={12} /> Create Custom Group
                  </button>
                </h3>

                {showNewGroupForm && (
                  <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '15px', marginBottom: '15px' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '10px' }}>Create New Security/Fleet Group</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: '12px', alignItems: 'flex-end' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Group Name</label>
                        <input type="text" className="form-control" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="e.g. Finance Team" />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Group Classification</label>
                        <select className="form-control" value={newGroupType} onChange={e => setNewGroupType(e.target.value)}>
                          <option value="General">General</option>
                          <option value="Department-Based">Department-Based</option>
                          <option value="Location-Based">Location-Based</option>
                        </select>
                      </div>
                      <button type="button" className="btn btn-primary" onClick={handleCreateGroupSubmit}>Create</button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                  {groups.map(g => {
                    const isChecked = regGroups.includes(g.name);
                    return (
                      <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', backgroundColor: isChecked ? 'var(--primary-light)' : 'var(--bg-tertiary)', borderRadius: '8px', border: `1px solid ${isChecked ? 'var(--primary)' : 'transparent'}`, cursor: 'pointer', transition: 'all 0.2s' }}>
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setRegGroups([...regGroups, g.name]);
                            } else {
                              setRegGroups(regGroups.filter(x => x !== g.name));
                            }
                          }}
                        />
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: '600' }}>{g.name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{g.group_type}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setRegisterModalAgent(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Register & Align Device</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER: REGISTERED DEVICE DETAIL INFRASTRUCTURE */}
      {detailDrawerAgent && (
        <div className="modal-overlay" style={{ justifyContent: 'flex-end', transition: 'all 0.3s' }}>
          <div className="modal-content" style={{ width: '650px', height: '100vh', borderRadius: '0', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div>
                <h2>{detailDrawerAgent.unregistered ? 'Agent Telemetry Log' : 'Asset Specification Grid'}</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Host: {detailDrawerAgent.hostname} • {detailDrawerAgent.unregistered ? 'Unregistered Discovered' : `Asset ID: ${detailDrawerAgent.asset_id}`}
                </p>
              </div>
              <button className="btn-icon" onClick={() => setDetailDrawerAgent(null)} style={{ border: 'none', background: 'none' }}>×</button>
            </div>
            
            <div className="modal-body" style={{ flexGrow: 1, overflowY: 'auto', padding: '24px' }}>
              
              {/* Telemetry Status Indicator */}
              <div style={{ display: 'flex', gap: '12px', backgroundColor: 'var(--bg-tertiary)', padding: '16px', borderRadius: '12px', borderLeft: `4px solid ${detailDrawerAgent.status === 'Online' ? 'var(--success)' : 'var(--danger)'}`, marginBottom: '24px' }}>
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Agent Telemetry Node Health</div>
                  <div style={{ fontSize: '1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: detailDrawerAgent.status === 'Online' ? 'var(--success)' : 'var(--danger)' }} />
                    {detailDrawerAgent.status === 'Online' ? 'Online Diagnostics Active' : 'Offline / Node Disconnected'}
                  </div>
                </div>
              </div>

              {/* SECTION 1: Hardware Specs */}
              <h3 style={{ fontSize: '0.95rem', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', marginBottom: '12px' }}>
                Hardware Inventory Specs
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Processor (CPU)</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: '600', marginTop: '2px' }}>{detailDrawerAgent.cpu_model} ({detailDrawerAgent.cpu_cores} Cores)</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>System Memory (RAM)</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: '600', marginTop: '2px' }}>{detailDrawerAgent.ram_total} Installed</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Motherboard / Serial</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: '600', marginTop: '2px' }}>{detailDrawerAgent.motherboard_serial || 'Lenovo motherboard'} / {detailDrawerAgent.serial_number}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>BIOS Version</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: '600', marginTop: '2px' }}>{detailDrawerAgent.bios_version || 'Lenovo BIOS v1.2'}</div>
                </div>
              </div>

              {/* SECTION 2: Storage Partition Mapping */}
              <h3 style={{ fontSize: '0.95rem', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', marginBottom: '12px' }}>
                Disks & Storage Partition Volumes
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginBottom: '20px' }}>
                {detailDrawerAgent.disks && detailDrawerAgent.disks.length > 0 ? (
                  detailDrawerAgent.disks.map((d: any, i: number) => (
                    <div key={i} style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 'bold' }}>
                        <span>Partition Volume {d.drive}</span>
                        <span>{d.free_size} Free / {d.total_size} Total</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No storage information queried by agent.</div>
                )}
              </div>

              {/* SECTION 3: Network Bindings */}
              <h3 style={{ fontSize: '0.95rem', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', marginBottom: '12px' }}>
                Network Parameters & Mac ID
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '24px' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Local IP Address</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: '600', marginTop: '2px' }}>{detailDrawerAgent.ip_address}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Hardware MAC ID</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: '600', marginTop: '2px', fontFamily: 'Consolas' }}>{detailDrawerAgent.mac_address}</div>
                </div>
              </div>

              {/* SECTION 4: ASSIGNMENTS / ALIGNMENTS */}
              {!detailDrawerAgent.unregistered ? (
                <>
                  <h3 style={{ fontSize: '0.95rem', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', marginBottom: '12px' }}>
                    Organization & Employee Assignments
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Assigned Employee</div>
                      <div style={{ fontSize: '0.88rem', fontWeight: '600', marginTop: '2px' }}>{detailDrawerAgent.employee_name} ({detailDrawerAgent.employee_id})</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Employee Contact</div>
                      <div style={{ fontSize: '0.85rem', marginTop: '2px' }}>{detailDrawerAgent.employee_email}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{detailDrawerAgent.employee_phone}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Company & Department</div>
                      <div style={{ fontSize: '0.88rem', fontWeight: '600', marginTop: '2px' }}>{detailDrawerAgent.company}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{detailDrawerAgent.department}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Location Details</div>
                      <div style={{ fontSize: '0.88rem', fontWeight: '600', marginTop: '2px' }}>{detailDrawerAgent.location}</div>
                    </div>
                    {detailDrawerAgent.groups && detailDrawerAgent.groups.length > 0 && (
                      <div style={{ gridColumn: 'span 2' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '6px' }}>Assigned Security/Fleet Groups</div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {detailDrawerAgent.groups.map((grp: string, idx: number) => (
                            <span key={idx} className="badge badge-info" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>{grp}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {isAdmin && (
                    <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '8px 16px', fontSize: '0.85rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                        onClick={async () => {
                          if (!confirm(`Deallocate ${detailDrawerAgent.hostname} from ${detailDrawerAgent.employee_name}?`)) return;
                          try {
                            const res = await fetch(`${API_BASE_URL}/api/assets/${detailDrawerAgent.id}/deallocate`, { method: 'PUT' });
                            if (res.ok) {
                              alert(`Device ${detailDrawerAgent.hostname} deallocated successfully`);
                              setDetailDrawerAgent(null);
                            } else {
                              const text = await res.text();
                              alert('Failed to deallocate device: ' + text);
                            }
                          } catch (err) {
                            alert('Error contacting the backend: ' + err);
                          }
                        }}
                      >
                        Deallocate Device
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ backgroundColor: 'var(--warning-light)', padding: '15px', borderRadius: '12px', borderLeft: '4px solid var(--warning)' }}>
                  <h4 style={{ color: 'var(--warning)', fontWeight: 'bold', fontSize: '0.88rem' }}>Asset Registration Pending</h4>
                  <p style={{ fontSize: '0.8rem', marginTop: '4px', lineHeight: '1.4' }}>
                    This discovered device is not registered inside the ITAM asset catalog yet. Register the device now to assign organization properties, locations, and groups.
                  </p>
                </div>
              )}

            </div>
            
            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)' }}>
              <button className="btn btn-secondary" onClick={() => setDetailDrawerAgent(null)}>Close Window</button>
            </div>
          </div>
        </div>
      )}

      {/* BULK ASSIGN GROUP MODAL */}
      {isAdmin && showBulkGroupModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '450px' }}>
            <div className="modal-header">
              <h2>Bulk Fleet Group Assignment</h2>
              <button className="btn-icon" onClick={() => setShowBulkGroupModal(false)} style={{ border: 'none', background: 'none' }}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                You have selected <strong>{selectedAgentIds.length}</strong> devices. Select a group to assign them all in bulk:
              </p>
              
              <div className="form-group">
                <label>Select Target Fleet Group</label>
                <select className="form-control" value={bulkGroupId} onChange={e => setBulkGroupId(e.target.value)} required>
                  <option value="">-- Choose Group --</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.group_type})</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowBulkGroupModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleBulkGroupAssignSubmit} disabled={!bulkGroupId}>Assign in Bulk</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
