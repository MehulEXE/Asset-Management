import React, { useState } from 'react';
import { IndianRupee, Tag, ShoppingBag } from 'lucide-react';

interface Purchase {
  id: string;
  asset_id: string;
  hostname: string;
  purchase_date: string;
  invoice_number: string;
  vendor: string;
  cost: number;
  warranty_start: string;
  warranty_end: string;
}

interface PurchasesProps {
  purchases: Purchase[];
}

export const Purchases: React.FC<PurchasesProps> = ({ purchases }) => {
  const [vendorFilter, setVendorFilter] = useState('All');
  
  // Calculate Totals
  const totalSpend = purchases.reduce((acc, cur) => acc + cur.cost, 0);
  const averageCost = totalSpend / (purchases.length || 1);
  const vendors = Array.from(new Set(purchases.map(p => p.vendor)));

  const filteredPurchases = purchases.filter(p => vendorFilter === 'All' || p.vendor === vendorFilter);

  return (
    <div className="animated-fade">
      {/* 1. Spend KPI Summary */}
      <div className="grid-kpi">
        <div className="card-kpi">
          <div className="kpi-icon" style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)' }}>
            <IndianRupee />
          </div>
          <div className="kpi-info">
            <h3>Total Expenditure</h3>
            <p>₹{totalSpend.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>

        <div className="card-kpi">
          <div className="kpi-icon" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
            <ShoppingBag />
          </div>
          <div className="kpi-info">
            <h3>Average Cost / Asset</h3>
            <p>₹{averageCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>

        <div className="card-kpi">
          <div className="kpi-icon" style={{ backgroundColor: 'var(--warning-light)', color: 'var(--warning)' }}>
            <Tag />
          </div>
          <div className="kpi-info">
            <h3>Total Orders</h3>
            <p>{purchases.length} Items</p>
          </div>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 24px' }}>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>Filter by Vendor:</span>
          <select 
            className="form-control" 
            value={vendorFilter} 
            onChange={e => setVendorFilter(e.target.value)}
            style={{ maxWidth: '250px' }}
          >
            <option value="All">All Vendors</option>
            {vendors.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Asset / Hostname</th>
                <th>Vendor</th>
                <th>Purchase Date</th>
                <th>Cost</th>
                <th>Warranty Coverage</th>
                <style>{`
                  .warranty-progress {
                    width: 100%;
                    height: 8px;
                    background-color: var(--bg-tertiary);
                    border-radius: 4px;
                    overflow: hidden;
                    margin-top: 6px;
                  }
                `}</style>
                <th>Warranty Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.map(p => {
                // Compute warranty duration fraction
                const start = new Date(p.warranty_start).getTime();
                const end = new Date(p.warranty_end).getTime();
                const now = new Date().getTime();
                const total = end - start;
                const elapsed = now - start;
                const percent = Math.min(100, Math.max(0, (elapsed / total) * 100));
                const isExpired = now > end;

                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 'bold' }}>{p.invoice_number}</td>
                    <td>
                      <div style={{ fontWeight: '600' }}>{p.hostname}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ID: {p.asset_id}</div>
                    </td>
                    <td>{p.vendor}</td>
                    <td>{p.purchase_date}</td>
                    <td style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                      ₹{p.cost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{p.warranty_start}</span>
                        <span>{p.warranty_end}</span>
                      </div>
                      <div className="warranty-progress">
                        <div style={{ 
                          height: '100%', 
                          backgroundColor: isExpired ? 'var(--danger)' : 'var(--success)', 
                          width: `${percent}%` 
                        }} />
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${isExpired ? 'danger' : 'success'}`}>
                        {isExpired ? 'Expired' : 'Active'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
