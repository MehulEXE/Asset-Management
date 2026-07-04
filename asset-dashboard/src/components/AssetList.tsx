import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, Trash2, Eye, ShieldAlert, MonitorUp, Send, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { RequestAssetModal } from './RequestAssetModal';
import { apiUrl } from '../services/apiConfig';

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
  employee_name?: string;
  employee_email?: string;
}

interface AssetListProps {
  assets: Asset[];
  onAddAsset: (asset: Omit<Asset, 'id' | 'last_seen'>) => void;
  onUpdateAsset: (asset: Asset) => void;
  onDeleteAsset: (id: string) => void;
  readOnly?: boolean;
}

export const AssetList: React.FC<AssetListProps> = ({ assets, onAddAsset, onUpdateAsset, onDeleteAsset, readOnly = false }) => {
  const { token } = useAuth();
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Form states
  const [formAssetId, setFormAssetId] = useState('');
  const [formHostname, setFormHostname] = useState('');
  const [formCategory, setFormCategory] = useState('Laptop');
  const [formCustomCategory, setFormCustomCategory] = useState('');
  const [formManufacturer, setFormManufacturer] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formOSName, setFormOSName] = useState('Microsoft Windows 10 Pro');
  const [formOSVersion, setFormOSVersion] = useState('10.0.19045');
  const [formIP, setFormIP] = useState('');
  const [formMAC, setFormMAC] = useState('');
  const [formCPU, setFormCPU] = useState('');
  const [formCPUCores, setFormCPUCores] = useState(4);
  const [formRAM, setFormRAM] = useState('16.00 GB');
  const [formStatus, setFormStatus] = useState('Available');
  const [formEmployeeName, setFormEmployeeName] = useState('');
  const [formEmployeeEmail, setFormEmployeeEmail] = useState('');
  const [allocSearch, setAllocSearch] = useState('');
  const [showAllocDropdown, setShowAllocDropdown] = useState(false);
  const [isNewAllocUser, setIsNewAllocUser] = useState(false);
  const [highlightedAllocIdx, setHighlightedAllocIdx] = useState(0);
  const [allocDropdownStyle, setAllocDropdownStyle] = useState<React.CSSProperties>({});
  const allocRef = useRef<HTMLDivElement>(null);

  const allocatedUsers = React.useMemo(() => {
    const map = new Map<string, string>();
    assets.forEach(a => {
      if (a.employee_name) map.set(a.employee_name, a.employee_email || '');
    });
    return Array.from(map.entries())
      .map(([name, email]) => ({ name, email }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [assets]);

  const filteredAllocUsers = React.useMemo(() => {
    if (!allocSearch) return allocatedUsers;
    const q = allocSearch.toLowerCase();
    return allocatedUsers.filter(u => u.name.toLowerCase().includes(q));
  }, [allocatedUsers, allocSearch]);

  const handleAllocSelect = (name: string, email: string) => {
    if (name === '__new__') {
      setIsNewAllocUser(true);
      setFormEmployeeName('');
      setFormEmployeeEmail('');
      setAllocSearch('');
    } else {
      setIsNewAllocUser(false);
      setFormEmployeeName(name);
      setFormEmployeeEmail(email);
      setAllocSearch(name);
    }
    setShowAllocDropdown(false);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (allocRef.current && !allocRef.current.contains(e.target as Node)) {
        setShowAllocDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showColDropdown, setShowColDropdown] = useState(false);
  const [highlightedCol, setHighlightedCol] = useState(0);

  const columnDefs = [
    { label: 'Asset ID', field: 'asset_id' },
    { label: 'Hostname', field: 'hostname' },
    { label: 'Category', field: 'category' },
    { label: 'Status', field: 'status' },
    { label: 'Allocated To', field: 'employee_name' },
    { label: 'Serial Number', field: 'serial_number' },
    { label: 'Manufacturer', field: 'manufacturer' },
    { label: 'Model', field: 'model' },
    { label: 'IP Address', field: 'ip_address' },
    { label: 'MAC Address', field: 'mac_address' },
    { label: 'CPU Model', field: 'cpu_model' },
    { label: 'OS Name', field: 'os_name' },
    { label: 'RAM', field: 'ram_total' },
  ];

  const parseSearchInput = useCallback((input: string) => {
    if (!input.startsWith('/')) return { column: null as string | null, value: input, columnTyped: '' };
    const rest = input.slice(1);
    const trimmed = rest.trimStart();
    if (trimmed.startsWith("'")) {
      const end = trimmed.indexOf("'", 1);
      if (end === -1) return { column: null, value: input, columnTyped: trimmed.slice(1) };
      return { column: trimmed.slice(1, end), value: trimmed.slice(end + 1).trimStart(), columnTyped: '' };
    }
    const space = trimmed.indexOf(' ');
    if (space === -1) return { column: null, value: input, columnTyped: trimmed };
    return { column: trimmed.slice(0, space), value: trimmed.slice(space + 1).trimStart(), columnTyped: '' };
  }, []);

  const parsed = parseSearchInput(searchTerm);
  const activeColumn = parsed.column;
  const activeColumnDef = activeColumn
    ? columnDefs.find(c => c.label.toLowerCase() === activeColumn.toLowerCase())
    : null;
  const filteredColumnDefs = parsed.columnTyped
    ? columnDefs.filter(c => c.label.toLowerCase().includes(parsed.columnTyped.toLowerCase()))
    : columnDefs;

  const selectColumn = (label: string) => {
    const quoted = label.includes(' ') ? `'${label}' ` : `${label} `;
    setSearchTerm('/' + quoted);
    setShowColDropdown(false);
    inputRef.current?.focus();
  };

  const clearColumn = () => {
    setSearchTerm('');
    setShowColDropdown(false);
    inputRef.current?.focus();
  };

  const handleValueChange = (val: string) => {
    if (activeColumnDef) {
      const label = activeColumnDef.label;
      const quoted = label.includes(' ') ? `'${label}' ` : `${label} `;
      setSearchTerm('/' + quoted + val);
    } else {
      setSearchTerm(val);
    }
  };

  const handleSearchContainerKeyDown = (e: React.KeyboardEvent) => {
    if (activeColumnDef && !parsed.value && (e.key === 'Backspace' || e.key === 'Delete')) {
      clearColumn();
      return;
    }
    handleSearchKeyDown(e);
  };

  useEffect(() => {
    if (!searchTerm.startsWith('/')) { setShowColDropdown(false); return; }
    const afterSlash = searchTerm.slice(1).trimStart();
    if (afterSlash.startsWith("'")) {
      const end = afterSlash.indexOf("'", 1);
      if (end !== -1 && afterSlash.slice(end + 1).trimStart().length > 0) {
        setShowColDropdown(false);
        return;
      }
    } else {
      const space = afterSlash.indexOf(' ');
      if (space !== -1 && afterSlash.slice(space + 1).trimStart().length > 0) {
        setShowColDropdown(false);
        return;
      }
    }
    if (searchTerm === '/') { setShowColDropdown(true); setHighlightedCol(0); return; }
    if (filteredColumnDefs.length > 0) { setShowColDropdown(true); setHighlightedCol(0); return; }
    setShowColDropdown(false);
  }, [searchTerm, filteredColumnDefs.length]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowColDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!showColDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedCol(p => Math.min(p + 1, filteredColumnDefs.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedCol(p => Math.max(p - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (filteredColumnDefs[highlightedCol]) {
        selectColumn(filteredColumnDefs[highlightedCol].label);
      }
    } else if (e.key === 'Escape') {
      setShowColDropdown(false);
    }
  };

  // Category dropdown state
  const [catSearch, setCatSearch] = useState('');
  const [showCatDropdown, setShowCatDropdown] = useState(false);
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [highlightedCatIdx, setHighlightedCatIdx] = useState(0);
  const [catDropdownStyle, setCatDropdownStyle] = useState<React.CSSProperties>({});
  const catRef = useRef<HTMLDivElement>(null);

  const baseCategories = ['Laptop', 'Desktop', 'Server', 'Printer', 'Network Device', 'Firewall', 'Mobile Device', 'Software License'];

  const allCategories = React.useMemo(() => {
    const set = new Set<string>(baseCategories);
    assets.forEach(a => { if (a.category) set.add(a.category); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [assets]);

  const filteredCategories = React.useMemo(() => {
    if (!catSearch) return allCategories;
    const q = catSearch.toLowerCase();
    return allCategories.filter(c => c.toLowerCase().includes(q));
  }, [allCategories, catSearch]);

  const getDropdownFixedStyle = (el: HTMLElement): React.CSSProperties => {
    const rect = el.getBoundingClientRect();
    return {
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 10000,
      backgroundColor: 'var(--bg-primary)',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      maxHeight: '220px',
      overflowY: 'auto',
    };
  };

  const openCatDropdown = () => {
    if (catRef.current) setCatDropdownStyle(getDropdownFixedStyle(catRef.current));
    setShowCatDropdown(true);
    setHighlightedCatIdx(0);
  };

  const openAllocDropdown = () => {
    if (allocRef.current) setAllocDropdownStyle(getDropdownFixedStyle(allocRef.current));
    setShowAllocDropdown(true);
    setHighlightedAllocIdx(0);
  };

  const handleCategorySelect = (cat: string) => {
    if (cat === '__new__') {
      setIsNewCategory(true);
      setFormCategory('');
      setFormCustomCategory('');
      setCatSearch('');
    } else {
      setIsNewCategory(false);
      setFormCategory(cat);
      setFormCustomCategory('');
      setCatSearch(cat);
    }
    setShowCatDropdown(false);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (catRef.current && !catRef.current.contains(e.target as Node)) {
        setShowCatDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const categories = ['Laptop', 'Desktop', 'Server', 'Printer', 'Network Device', 'Firewall', 'Mobile Device', 'Software License', 'Other'];

  // Filters logic
  const filteredAssets = assets.filter(asset => {
    let matchesSearch = true;
    if (activeColumnDef && parsed.value) {
      const rawFieldVal = String(asset[activeColumnDef.field as keyof Asset] ?? '').toLowerCase();
      if (activeColumnDef.field === 'ram_total') {
        const ramNum = parseFloat(rawFieldVal);
        const searchNum = parseFloat(parsed.value);
        if (!isNaN(ramNum) && !isNaN(searchNum)) {
          matchesSearch = Math.abs(ramNum - searchNum) <= 0.9;
        } else {
          matchesSearch = rawFieldVal.includes(parsed.value.toLowerCase());
        }
      } else {
        matchesSearch = rawFieldVal.includes(parsed.value.toLowerCase());
      }
    } else if (searchTerm) {
      matchesSearch = asset.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      asset.asset_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      asset.serial_number.toLowerCase().includes(searchTerm.toLowerCase());
    }
    const matchesCategory = categoryFilter === 'All' || asset.category === categoryFilter;
    const matchesStatus = statusFilter === 'All' || asset.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const openAddModal = () => {
    setIsEditing(false);
    setFormAssetId(`AGENT-WIN-${Math.floor(100000 + Math.random() * 900000)}`);
    setFormHostname('');
    setFormCategory('Laptop');
    setFormCustomCategory('');
    setFormManufacturer('');
    setFormModel('');
    setFormOSName('Microsoft Windows 10 Pro');
    setFormOSVersion('10.0.19045');
    setFormIP('192.168.1.50');
    setFormMAC('A0:B1:C2:D3:E4:F5');
    setFormCPU('Intel Core i7-10700K');
    setFormCPUCores(8);
    setFormRAM('16.00 GB');
    setFormStatus('Available');
    setFormEmployeeName('');
    setFormEmployeeEmail('');
    setIsNewCategory(false);
    setCatSearch('Laptop');
    setFormCustomCategory('');
    setIsNewAllocUser(true);
    setAllocSearch('');
    setShowAddModal(true);
  };

  const openEditModal = (asset: Asset) => {
    setIsEditing(true);
    setSelectedAsset(asset);
    setFormAssetId(asset.asset_id);
    setFormHostname(asset.hostname);
    if (allCategories.includes(asset.category)) {
      setFormCategory(asset.category);
      setFormCustomCategory('');
      setIsNewCategory(false);
      setCatSearch(asset.category);
    } else {
      setFormCategory('');
      setFormCustomCategory(asset.category);
      setIsNewCategory(true);
      setCatSearch('');
    }
    setFormManufacturer(asset.manufacturer);
    setFormModel(asset.model);
    setFormOSName(asset.os_name);
    setFormOSVersion(asset.os_version);
    setFormIP(asset.ip_address);
    setFormMAC(asset.mac_address);
    setFormCPU(asset.cpu_model);
    setFormCPUCores(asset.cpu_cores);
    setFormRAM(asset.ram_total);
    setFormStatus(asset.status);
    if (asset.employee_name) {
      setFormEmployeeName(asset.employee_name);
      setFormEmployeeEmail(asset.employee_email || '');
      setIsNewAllocUser(false);
      setAllocSearch(asset.employee_name);
    } else {
      setFormEmployeeName('');
      setFormEmployeeEmail('');
      setIsNewAllocUser(true);
      setAllocSearch('');
    }
    setShowAddModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      asset_id: formAssetId,
      hostname: formHostname,
      category: isNewCategory ? formCustomCategory : formCategory,
      manufacturer: formManufacturer,
      model: formModel,
      os_name: formOSName,
      os_version: formOSVersion,
      ip_address: formIP,
      mac_address: formMAC,
      cpu_model: formCPU,
      cpu_cores: formCPUCores,
      ram_total: formRAM,
      status: formStatus,
      serial_number: isEditing && selectedAsset ? selectedAsset.serial_number : `SN-${Math.floor(100000 + Math.random() * 900000)}`,
      employee_name: formEmployeeName,
      employee_email: formEmployeeEmail,
      disks: isEditing && selectedAsset ? selectedAsset.disks : [],
      software_inventory: isEditing && selectedAsset ? selectedAsset.software_inventory : []
    };

    if (isEditing && selectedAsset) {
      onUpdateAsset({
        ...selectedAsset,
        ...payload
      });
    } else {
      onAddAsset(payload);
    }
    setShowAddModal(false);
  };

  return (
    <div className="animated-fade">
      {/* Search and Filters Bar */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div style={{ display: 'flex', gap: '12px', flexGrow: 1, maxWidth: '700px' }}>
            <div ref={searchRef} style={{ position: 'relative', maxWidth: '350px', flex: 1 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px',
                border: '1px solid var(--border-color)', borderRadius: '6px',
                background: 'var(--bg-primary)', minHeight: '36px',
              }}>
                {activeColumnDef && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                    padding: '2px 10px 2px 12px', borderRadius: '20px', fontSize: '0.78rem',
                    fontWeight: 600, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: '#fff', whiteSpace: 'nowrap', letterSpacing: '0.02em',
                    boxShadow: '0 1px 4px rgba(99,102,241,0.3)',
                  }}>
                    {activeColumnDef.label}
                    <button
                      onClick={clearColumn}
                      title="Remove column filter"
                      style={{
                        background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
                        cursor: 'pointer', padding: '0 0 0 5px', fontSize: '14px',
                        lineHeight: 1, borderRadius: '50%', width: '16px', height: '16px',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        marginLeft: '2px',
                      }}
                    >×</button>
                  </span>
                )}
                <input
                  ref={inputRef}
                  type="text"
                  style={{
                    border: 'none', outline: 'none', background: 'transparent',
                    flex: 1, fontSize: '0.85rem', padding: '2px 4px', minWidth: '60px',
                    color: 'var(--text-primary)',
                  }}
                  placeholder={activeColumnDef ? `Search ${activeColumnDef.label}...` : "Search assets by Hostname, ID, or Serial Number..."}
                  value={activeColumnDef ? parsed.value : searchTerm}
                  onChange={e => handleValueChange(e.target.value)}
                  onKeyDown={handleSearchContainerKeyDown}
                  onFocus={() => {
                    if (searchTerm.startsWith('/') && !activeColumnDef && filteredColumnDefs.length > 0) {
                      setShowColDropdown(true);
                    }
                  }}
                />
              </div>
              {showColDropdown && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
                  backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                  borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', marginTop: '4px',
                  maxHeight: '260px', overflowY: 'auto',
                }}>
                  <div style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                    Select a column to filter by &mdash; type to narrow
                  </div>
                  {filteredColumnDefs.map((col, i) => (
                    <div
                      key={col.field}
                      onClick={() => selectColumn(col.label)}
                      onMouseEnter={() => setHighlightedCol(i)}
                      style={{
                        padding: '8px 12px', cursor: 'pointer', fontSize: '0.85rem',
                        backgroundColor: i === highlightedCol ? 'var(--bg-tertiary)' : 'transparent',
                        color: 'var(--text-primary)', transition: 'background 0.1s',
                      }}
                    >
                      {col.label}
                      <span style={{ float: 'right', fontSize: '0.7rem', color: 'var(--text-tertiary)', fontFamily: 'Consolas' }}>
                        {col.field}
                      </span>
                    </div>
                  ))}
                  {filteredColumnDefs.length === 0 && (
                    <div style={{ padding: '12px', fontSize: '0.8rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                      No matching columns
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <select 
              className="form-control" 
              value={categoryFilter} 
              onChange={e => setCategoryFilter(e.target.value)}
              style={{ maxWidth: '180px' }}
            >
              <option value="All">All Categories</option>
              {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select 
              className="form-control" 
              value={statusFilter} 
              onChange={e => setStatusFilter(e.target.value)}
              style={{ maxWidth: '150px' }}
            >
              <option value="All">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Allocated">Allocated</option>
              <option value="In Repair">In Repair</option>
              <option value="Retired">Retired</option>
            </select>
          </div>

          {!readOnly && (
            <button className="btn btn-primary" onClick={openAddModal}>
              <Plus size={18} /> New Asset
            </button>
          )}
          {readOnly && (
            <button className="btn btn-primary" onClick={() => setShowRequestModal(true)}>
              <Send size={18} /> Request New Asset
            </button>
          )}
        </div>
      </div>

      {/* Asset Table Card */}
      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Asset ID</th>
                <th>Hostname</th>
                <th>Category</th>
                <th>Specs (CPU / RAM / Disk)</th>
                <th>IP & MAC Address</th>
                <th>Status</th>
                <th>Allocated To</th>
                {!readOnly && <th style={{ textAlign: 'center' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map(asset => (
                <tr key={asset.id}>
                  <td style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{asset.asset_id}</td>
                  <td>
                    <div style={{ fontWeight: '600' }}>{asset.hostname}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{asset.manufacturer} {asset.model}</div>
                  </td>
                  <td>{asset.category}</td>
                  <td>
                    <div style={{ fontSize: '0.85rem', fontWeight: '500' }}>{asset.cpu_model}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <span>RAM: {asset.ram_total} ({asset.cpu_cores} Cores)</span>
                      {asset.disks && asset.disks.length > 0 && (
                        <div style={{ marginTop: '2px', color: 'var(--primary)' }}>
                          <strong>Disk: </strong>
                          {asset.disks.map((d: any, i: number) => (
                            <span key={i} style={{ marginRight: '6px' }}>{d.drive} {d.total_size}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.85rem' }}>{asset.ip_address}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'Consolas' }}>{asset.mac_address}</div>
                  </td>
                  <td>
                    <span className={`badge badge-${
                      asset.status === 'Available' ? 'success' : 
                      asset.status === 'Allocated' ? 'info' : 'warning'
                    }`}>
                      {asset.status}
                    </span>
                  </td>
                  <td>
                    {asset.employee_name || (
                      <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Unassigned</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button className="btn btn-secondary" style={{ padding: '6px' }} title="View Software Inventory" onClick={() => setSelectedAsset(asset)}>
                        <Eye size={15} />
                      </button>
                      {!readOnly && (
                        <>
                          <button className="btn btn-secondary" style={{ padding: '6px' }} title="Edit" onClick={() => openEditModal(asset)}>
                            <Edit2 size={15} />
                          </button>
                          <button className="btn btn-secondary" style={{ padding: '6px', color: 'var(--danger)' }} title="Delete" onClick={() => onDeleteAsset(asset.id)}>
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: ADD/EDIT ASSET */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{isEditing ? 'Edit Asset Properties' : 'Register New IT Asset'}</h2>
              <button className="btn-icon" onClick={() => setShowAddModal(false)} style={{ border: 'none', background: 'none' }}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group">
                    <label>Asset ID</label>
                    <input type="text" className="form-control" value={formAssetId} disabled />
                  </div>
                  <div className="form-group">
                    <label>Hostname</label>
                    <input type="text" className="form-control" value={formHostname} onChange={e => setFormHostname(e.target.value)} required />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group">
                    <label>Category</label>
                    <div ref={catRef} style={{ position: 'relative' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '4px', padding: '0 8px',
                        border: '1px solid var(--border-color)', borderRadius: '6px',
                        background: 'var(--bg-primary)', minHeight: '36px',
                        cursor: 'pointer',
                      }}>
                        <input
                          type="text"
                          className="form-control"
                          style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, padding: '8px 0', cursor: 'pointer' }}
                          placeholder="Search or select category..."
                          value={isNewCategory ? formCustomCategory : catSearch}
                          onChange={e => {
                            const val = e.target.value;
                            setIsNewCategory(true);
                            setFormCustomCategory(val);
                            setCatSearch(val);
                            setShowCatDropdown(true);
                          }}
                          onFocus={openCatDropdown}
                          onKeyDown={e => {
                            if (!showCatDropdown) return;
                            const items = ['__new__', ...filteredCategories];
                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              setHighlightedCatIdx(p => Math.min(p + 1, items.length - 1));
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              setHighlightedCatIdx(p => Math.max(p - 1, 0));
                            } else if (e.key === 'Enter') {
                              e.preventDefault();
                              const item = items[highlightedCatIdx];
                              if (item) handleCategorySelect(item);
                            } else if (e.key === 'Escape') {
                              setShowCatDropdown(false);
                            }
                          }}
                        />
                        <ChevronDown size={15} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} onClick={() => showCatDropdown ? setShowCatDropdown(false) : openCatDropdown()} />
                      </div>
                      {showCatDropdown && (
                        <div style={catDropdownStyle}>
                          <div
                            onClick={() => handleCategorySelect('__new__')}
                            onMouseEnter={() => setHighlightedCatIdx(0)}
                            style={{
                              padding: '10px 12px', cursor: 'pointer', fontSize: '0.85rem',
                              backgroundColor: highlightedCatIdx === 0 ? 'var(--bg-tertiary)' : 'transparent',
                              color: 'var(--primary)', fontWeight: 600,
                              borderBottom: '1px solid var(--border-color)',
                              display: 'flex', alignItems: 'center', gap: '8px',
                            }}
                          >
                            <Plus size={16} /> New
                          </div>
                          {filteredCategories.length > 0 ? (
                            filteredCategories.map((c, i) => (
                              <div
                                key={c}
                                onClick={() => handleCategorySelect(c)}
                                onMouseEnter={() => setHighlightedCatIdx(i + 1)}
                                style={{
                                  padding: '10px 12px', cursor: 'pointer', fontSize: '0.85rem',
                                  backgroundColor: highlightedCatIdx === i + 1 ? 'var(--bg-tertiary)' : 'transparent',
                                  color: 'var(--text-primary)',
                                  borderBottom: i < filteredCategories.length - 1 ? '1px solid var(--border-color)' : 'none',
                                }}
                              >
                                {c}
                              </div>
                            ))
                          ) : !isNewCategory && (
                            <div style={{ padding: '12px', fontSize: '0.8rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                              No matching categories
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {isNewCategory && (
                      <input className="form-control" style={{ marginTop: 8 }} value={formCustomCategory} onChange={e => { setFormCustomCategory(e.target.value); setCatSearch(e.target.value); }} placeholder="Type the new category name..." required />
                    )}
                  </div>
                  <div className="form-group">
                    <label>Asset Status</label>
                    <select className="form-control" value={formStatus} onChange={e => setFormStatus(e.target.value)}>
                      <option value="Available">Available</option>
                      <option value="Allocated">Allocated</option>
                      <option value="In Repair">In Repair</option>
                      <option value="Retired">Retired</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group">
                    <label>Manufacturer</label>
                    <input type="text" className="form-control" value={formManufacturer} onChange={e => setFormManufacturer(e.target.value)} placeholder="e.g. Dell" />
                  </div>
                  <div className="form-group">
                    <label>Model</label>
                    <input type="text" className="form-control" value={formModel} onChange={e => setFormModel(e.target.value)} placeholder="e.g. Latitude 5420" />
                  </div>
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Allocated To</label>
                  <div ref={allocRef} style={{ position: 'relative' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '4px', padding: '0 8px',
                      border: '1px solid var(--border-color)', borderRadius: '6px',
                      background: 'var(--bg-primary)', minHeight: '36px',
                      cursor: 'pointer',
                    }}>
                      <input
                        type="text"
                        className="form-control"
                        style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, padding: '8px 0', cursor: 'pointer' }}
                        placeholder="Search or select user..."
                        value={isNewAllocUser ? formEmployeeName : allocSearch}
                        onChange={e => {
                          const val = e.target.value;
                          setIsNewAllocUser(true);
                          setFormEmployeeName(val);
                          setAllocSearch(val);
                          openAllocDropdown();
                        }}
                        onFocus={openAllocDropdown}
                        onKeyDown={e => {
                          if (!showAllocDropdown) return;
                          const items = [{ name: '__new__', email: '' }, ...filteredAllocUsers];
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setHighlightedAllocIdx(p => Math.min(p + 1, items.length - 1));
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setHighlightedAllocIdx(p => Math.max(p - 1, 0));
                          } else if (e.key === 'Enter') {
                            e.preventDefault();
                            const item = items[highlightedAllocIdx];
                            if (item) handleAllocSelect(item.name, item.email);
                          } else if (e.key === 'Escape') {
                            setShowAllocDropdown(false);
                          }
                        }}
                      />
                      <ChevronDown size={15} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} onClick={() => showAllocDropdown ? setShowAllocDropdown(false) : openAllocDropdown()} />
                    </div>
                    {showAllocDropdown && (
                      <div style={allocDropdownStyle}>
                        <div
                          onClick={() => handleAllocSelect('__new__', '')}
                          onMouseEnter={() => setHighlightedAllocIdx(0)}
                          style={{
                            padding: '10px 12px', cursor: 'pointer', fontSize: '0.85rem',
                            backgroundColor: highlightedAllocIdx === 0 ? 'var(--bg-tertiary)' : 'transparent',
                            color: 'var(--primary)', fontWeight: 600,
                            borderBottom: '1px solid var(--border-color)',
                            display: 'flex', alignItems: 'center', gap: '8px',
                          }}
                        >
                          <Plus size={16} /> New
                        </div>
                        {filteredAllocUsers.length > 0 ? (
                          filteredAllocUsers.map((u, i) => (
                            <div
                              key={u.name}
                              onClick={() => handleAllocSelect(u.name, u.email)}
                              onMouseEnter={() => setHighlightedAllocIdx(i + 1)}
                              style={{
                                padding: '10px 12px', cursor: 'pointer', fontSize: '0.85rem',
                                backgroundColor: highlightedAllocIdx === i + 1 ? 'var(--bg-tertiary)' : 'transparent',
                                color: 'var(--text-primary)',
                                borderBottom: i < filteredAllocUsers.length - 1 ? '1px solid var(--border-color)' : 'none',
                              }}
                            >
                              <div style={{ fontWeight: 500 }}>{u.name}</div>
                              {u.email && <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{u.email}</div>}
                            </div>
                          ))
                        ) : !isNewAllocUser && (
                          <div style={{ padding: '12px', fontSize: '0.8rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                            No matching users
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <input
                    type="email"
                    className="form-control"
                    style={{ marginTop: '8px' }}
                    placeholder="Email (auto-filled for existing users)"
                    value={formEmployeeEmail}
                    onChange={e => setFormEmployeeEmail(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group">
                    <label>Operating System</label>
                    <input type="text" className="form-control" value={formOSName} onChange={e => setFormOSName(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>CPU Model</label>
                    <input type="text" className="form-control" value={formCPU} onChange={e => setFormCPU(e.target.value)} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label>RAM</label>
                    <input type="text" className="form-control" value={formRAM} onChange={e => setFormRAM(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>IP Address</label>
                    <input type="text" className="form-control" value={formIP} onChange={e => setFormIP(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>MAC Address</label>
                    <input type="text" className="form-control" value={formMAC} onChange={e => setFormMAC(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{isEditing ? 'Save Changes' : 'Register'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SOFTWARE INVENTORY & SPECS VIEW */}
      {selectedAsset && !showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '800px' }}>
            <div className="modal-header">
              <div>
                <h2>Asset Details: {selectedAsset.hostname}</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '3px' }}>ID: {selectedAsset.asset_id} • OS: {selectedAsset.os_name}</p>
              </div>
              <button className="btn-icon" onClick={() => setSelectedAsset(null)} style={{ border: 'none', background: 'none' }}>×</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '24px' }}>
                <div className="card" style={{ padding: '16px', backgroundColor: 'var(--bg-tertiary)' }}>
                  <h3 style={{ fontSize: '0.9rem', marginBottom: '10px', color: 'var(--primary)' }}>Network Parameters</h3>
                  <p style={{ fontSize: '0.85rem' }}><strong>IP Address:</strong> {selectedAsset.ip_address}</p>
                  <p style={{ fontSize: '0.85rem', marginTop: '4px' }}><strong>MAC Address:</strong> {selectedAsset.mac_address}</p>
                  <p style={{ fontSize: '0.85rem', marginTop: '4px' }}><strong>Status:</strong> {selectedAsset.status}</p>
                </div>
                <div className="card" style={{ padding: '16px', backgroundColor: 'var(--bg-tertiary)' }}>
                  <h3 style={{ fontSize: '0.9rem', marginBottom: '10px', color: 'var(--primary)' }}>Hardware Architecture</h3>
                  <p style={{ fontSize: '0.85rem' }}><strong>CPU Model:</strong> {selectedAsset.cpu_model}</p>
                  <p style={{ fontSize: '0.85rem', marginTop: '4px' }}><strong>Physical Cores:</strong> {selectedAsset.cpu_cores} Cores</p>
                  <p style={{ fontSize: '0.85rem', marginTop: '4px' }}><strong>Installed Memory:</strong> {selectedAsset.ram_total}</p>
                </div>
                <div className="card" style={{ padding: '16px', backgroundColor: 'var(--bg-tertiary)' }}>
                  <h3 style={{ fontSize: '0.9rem', marginBottom: '10px', color: 'var(--primary)' }}>Storage Volumes</h3>
                  {selectedAsset.disks && selectedAsset.disks.length > 0 ? (
                    selectedAsset.disks.map((d: any, idx: number) => {
                      const total = parseFloat(d.total_size) || 1;
                      const used = parseFloat(d.used_size) || 0;
                      const pct = Math.min(100, Math.max(0, (used / total) * 100));
                      return (
                        <div key={idx} style={{ marginBottom: idx < selectedAsset.disks.length - 1 ? '10px' : '0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 'bold' }}>
                            <span>Drive {d.drive}</span>
                            <span>{d.free_size} free / {d.total_size}</span>
                          </div>
                          <div style={{ height: '6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden', marginTop: '4px' }}>
                            <div style={{ 
                              height: '100%', 
                              backgroundColor: pct > 85 ? 'var(--danger)' : 'var(--success)', 
                              width: `${pct}%` 
                            }} />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No storage data reported.</p>
                  )}
                </div>
              </div>

              {/* Installed Software Registry List */}
              <h3 style={{ fontSize: '1.1rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MonitorUp size={18} /> Installed Registry Software ({selectedAsset.software_inventory?.length || 0})
              </h3>
              <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                {selectedAsset.software_inventory && selectedAsset.software_inventory.length > 0 ? (
                  <table>
                    <thead>
                      <tr>
                        <th>Application Name</th>
                        <th>Version</th>
                        <th>Publisher</th>
                        <th>Install Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedAsset.software_inventory.map((soft, index) => (
                        <tr key={index}>
                          <td style={{ fontWeight: '600', fontSize: '0.85rem' }}>{soft.name}</td>
                          <td style={{ fontSize: '0.8rem', fontFamily: 'Consolas' }}>{soft.version}</td>
                          <td style={{ fontSize: '0.85rem' }}>{soft.publisher}</td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{soft.install_date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-tertiary)' }}>
                    <ShieldAlert size={32} style={{ marginBottom: '10px' }} />
                    <p>No installed software reported. Make sure the Windows Discovery Agent is actively running.</p>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedAsset(null)}>Close Window</button>
            </div>
          </div>
        </div>
      )}

      {showRequestModal && (
        <RequestAssetModal
          allocatedUsers={allocatedUsers}
          onClose={() => setShowRequestModal(false)}
          onSubmit={async (data) => {
            if (!token) throw new Error('Not authenticated');
            const res = await fetch(apiUrl('/api/asset-requests'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify(data),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.error || 'Failed to submit request');
            }
          }}
        />
      )}
    </div>
  );
};
