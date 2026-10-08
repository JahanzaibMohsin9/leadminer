import React, { useState, useMemo } from 'react';
import { BusinessData } from '../../common/types';

interface ResultsTableProps {
  data: BusinessData[];
}

type SortConfig = {
  key: keyof BusinessData;
  direction: 'asc' | 'desc';
} | null;

export const ResultsTable: React.FC<ResultsTableProps> = ({ data }) => {
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [filterText, setFilterText] = useState('');

  const handleSort = (key: keyof BusinessData) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedAndFilteredData = useMemo(() => {
    let processed = [...data];

    if (filterText) {
      const lower = filterText.toLowerCase();
      processed = processed.filter(item =>
        item.name.toLowerCase().includes(lower) ||
        (item.phone && item.phone.toLowerCase().includes(lower)) ||
        (item.email && item.email.toLowerCase().includes(lower)) ||
        (item.address && item.address.toLowerCase().includes(lower))
      );
    }

    if (sortConfig) {
      processed.sort((a, b) => {
        const aValue = (a[sortConfig.key] || '').toString().toLowerCase();
        const bValue = (b[sortConfig.key] || '').toString().toLowerCase();

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return processed;
  }, [data, filterText, sortConfig]);

  const getSortIcon = (key: keyof BusinessData) => {
    if (!sortConfig || sortConfig.key !== key) return '↕';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const isSorted = (key: keyof BusinessData) => sortConfig?.key === key;

  return (
    <div className="data-table-container">
      {/* Table Header */}
      <div className="data-table-header">
        <div className="data-table-title">
          📋 Lead Results
          {data.length > 0 && (
            <span className="data-table-count">{data.length}</span>
          )}
        </div>
        <input
          type="text"
          className="form-input data-table-filter"
          placeholder="🔍 Filter results..."
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          aria-label="Filter lead results"
        />
      </div>

      {/* Table Content */}
      <div className="data-table-scroll">
        {sortedAndFilteredData.length === 0 ? (
          <div className="data-table-empty">
            <div className="data-table-empty-icon">
              {data.length === 0 ? '⛏️' : '🔍'}
            </div>
            <div className="data-table-empty-title">
              {data.length === 0 ? 'Ready to Mine Leads' : 'No Matches Found'}
            </div>
            <div className="data-table-empty-text">
              {data.length === 0
                ? 'Enter a keyword and city above, then click "Start Mining" to begin collecting leads.'
                : 'Try adjusting your filter to see more results.'}
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th
                  scope="col"
                  className={isSorted('name') ? 'sorted' : ''}
                  onClick={() => handleSort('name')}
                >
                  Business Name
                  <span className="sort-icon">{getSortIcon('name')}</span>
                </th>
                <th
                  scope="col"
                  className={isSorted('phone') ? 'sorted' : ''}
                  onClick={() => handleSort('phone')}
                >
                  Phone
                  <span className="sort-icon">{getSortIcon('phone')}</span>
                </th>
                <th
                  scope="col"
                  className={isSorted('email') ? 'sorted' : ''}
                  onClick={() => handleSort('email')}
                >
                  Email
                  <span className="sort-icon">{getSortIcon('email')}</span>
                </th>
                <th
                  scope="col"
                  className={isSorted('website') ? 'sorted' : ''}
                  onClick={() => handleSort('website')}
                >
                  Website
                  <span className="sort-icon">{getSortIcon('website')}</span>
                </th>
                <th
                  scope="col"
                  className={isSorted('address') ? 'sorted' : ''}
                  onClick={() => handleSort('address')}
                >
                  Address
                  <span className="sort-icon">{getSortIcon('address')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedAndFilteredData.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                  </td>
                  <td>
                    {item.phone ? (
                      <span className="badge badge-phone">📞 {item.phone}</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>
                    {item.email ? (
                      <span className="badge badge-email">✉️ {item.email}</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>
                    {item.website ? (
                      <a
                        href={item.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="badge badge-website"
                        style={{ textDecoration: 'none' }}
                      >
                        🔗 Visit
                      </a>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.address || <span className="text-muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
