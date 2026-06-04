import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Eye, ShieldAlert, MonitorUp, Send } from 'lucide-react';
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

  const categories = ['Laptop', 'Desktop', 'Server', 'Printer', 'Network Device', 'Firewall', 'Mobile Device', 'Software License', 'Other'];

  // Filters logic
  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.hostname.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          asset.asset_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          asset.serial_number.toLowerCase().includes(searchTerm.toLowerCase());
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
    setShowAddModal(true);
  };

  const openEditModal = (asset: Asset) => {
    setIsEditing(true);
    setSelectedAsset(asset);
    setFormAssetId(asset.asset_id);
    setFormHostname(asset.hostname);
    if (categories.includes(asset.category)) {
      setFormCategory(asset.category);
      setFormCustomCategory('');
    } else {
      setFormCategory('Other');
      setFormCustomCategory(asset.category);
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
    setShowAddModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      asset_id: formAssetId,
      hostname: formHostname,
      category: formCategory === 'Other' ? formCustomCategory : formCategory,
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
      serial_number: `SN-${Math.floor(100000 + Math.random() * 900000)}`,
      disks: [],
      software_inventory: []
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
            <input 
              type="text" 
              className="form-control" 
              placeholder="Search assets by Hostname, ID, or Serial Number..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ maxWidth: '350px' }}
            />
            
            <select 
              className="form-control" 
              value={categoryFilter} 
              onChange={e => setCategoryFilter(e.target.value)}
              style={{ maxWidth: '180px' }}
            >
              <option value="All">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
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
                    <select className="form-control" value={formCategory} onChange={e => { setFormCategory(e.target.value); if (e.target.value !== 'Other') setFormCustomCategory(''); }}>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {formCategory === 'Other' && (
                      <input className="form-control" style={{ marginTop: 8 }} value={formCustomCategory} onChange={e => setFormCustomCategory(e.target.value)} placeholder="Describe the type..." required />
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
