import React, { useState, useEffect, useRef } from 'react';
import { ScrapeConfig, ScrapeStatus } from '../../common/types';
import { ProgressBar } from './ProgressBar';
import { ProxySettings } from './ProxySettings';
import { WarningSystem } from './WarningSystem';
import { HelpContent } from './HelpContent';
import { filterCities } from '../data/cities';

interface ControlPanelProps {
  status: ScrapeStatus;
  onStart: (config: ScrapeConfig) => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onExport: () => void;
  onExportExcel: () => void;
  count: number;
  errorMessage?: string;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ status, onStart, onStop, onPause, onResume, onExport, onExportExcel, count, errorMessage }) => {
  const [keyword, setKeyword] = useState('');
  const [city, setCity] = useState('');
  const [speed, setSpeed] = useState<ScrapeConfig['speed']>('normal');
  const [useProxy, setUseProxy] = useState(false);
  const [proxies, setProxies] = useState('');

  // Autocomplete state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const cityInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleStart = () => {
    if (!keyword || !city) return;
    const proxyList = useProxy ? proxies.split('\n').map(p => p.trim()).filter(p => p) : undefined;
    onStart({
      keyword,
      city,
      speed,
      useProxy,
      proxies: proxyList
    });
  };

  // Handle city input change with autocomplete
  const handleCityChange = (value: string) => {
    setCity(value);
    const filtered = filterCities(value);
    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
    setSelectedIndex(-1);
  };

  // Handle keyboard navigation in autocomplete
  const handleCityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          selectCity(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Select a city from suggestions
  const selectCity = (cityName: string) => {
    setCity(cityName);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        cityInputRef.current &&
        !cityInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isActive = isRunning || isPaused;

  return (
    <div className="glass-panel">
      <div className="glass-panel-inner">
        {/* Input Row */}
        <div className="control-grid">
          {/* Keyword Input */}
          <div className="form-group">
            <label className="form-label">
              🎯 Keyword
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Plumbers, Coffee Shops..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              disabled={isActive}
              aria-label="Search keyword"
              maxLength={100}
            />
          </div>

          {/* City Input with Autocomplete */}
          <div className="form-group" style={{ position: 'relative' }}>
            <label className="form-label">
              📍 Location
            </label>
            <input
              ref={cityInputRef}
              type="text"
              className="form-input"
              placeholder="Start typing city name..."
              value={city}
              onChange={(e) => handleCityChange(e.target.value)}
              onKeyDown={handleCityKeyDown}
              onFocus={() => {
                if (city && suggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
              disabled={isActive}
              aria-label="City or location"
              aria-autocomplete="list"
              maxLength={100}
            />

            {/* City Suggestions Dropdown */}
            {showSuggestions && (
              <div ref={dropdownRef} className="dropdown">
                <div className="dropdown-header">
                  📍 Select a city ({suggestions.length} found)
                </div>
                {suggestions.length > 0 ? (
                  suggestions.map((suggestion, index) => (
                    <div
                      key={suggestion}
                      className={`dropdown-item ${index === selectedIndex ? 'selected' : ''}`}
                      onClick={() => selectCity(suggestion)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <span className="dropdown-item-icon">📍</span>
                      <span className="dropdown-item-text">{suggestion}</span>
                    </div>
                  ))
                ) : (
                  <div className="dropdown-empty">No cities found</div>
                )}
              </div>
            )}

            {/* Helper text */}
            {!city && !isActive && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                💡 Try: New York, London, Tokyo, Sydney...
              </div>
            )}
          </div>

          {/* Speed Selector */}
          <div className="form-group">
            <label className="form-label">
              ⚡ Speed
            </label>
            <div className="speed-selector">
              <button
                type="button"
                className={`speed-option ${speed === 'slow' ? 'active' : ''}`}
                onClick={() => setSpeed('slow')}
                disabled={isActive}
              >
                🐢 Safe
              </button>
              <button
                type="button"
                className={`speed-option ${speed === 'normal' ? 'active' : ''}`}
                onClick={() => setSpeed('normal')}
                disabled={isActive}
              >
                🚀 Normal
              </button>
              <button
                type="button"
                className={`speed-option ${speed === 'fast' ? 'active' : ''}`}
                onClick={() => setSpeed('fast')}
                disabled={isActive}
              >
                ⚡ Fast
              </button>
            </div>
          </div>
        </div>

        {/* Proxy Settings */}
        <ProxySettings
          useProxy={useProxy}
          onUseProxyChange={setUseProxy}
          proxies={proxies}
          onProxiesChange={setProxies}
          disabled={isActive}
        />

        {/* Action Buttons Row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 'var(--space-lg)',
          paddingTop: 'var(--space-lg)',
          borderTop: 'var(--border-subtle)'
        }}>
          {/* Left side: Control buttons */}
          <div className="control-actions">
            {!isActive ? (
              <button
                className="btn btn-primary btn-lg"
                onClick={handleStart}
                disabled={!keyword || !city}
              >
                ▶️ Start Mining
              </button>
            ) : (
              <>
                {isRunning && (
                  <button className="btn btn-warning" onClick={onPause}>
                    ⏸️ Pause
                  </button>
                )}
                {isPaused && (
                  <button className="btn btn-primary" onClick={onResume}>
                    ▶️ Resume
                  </button>
                )}
                <button className="btn btn-danger" onClick={onStop}>
                  ⏹️ Stop
                </button>
              </>
            )}
          </div>

          {/* Right side: Stats and Export */}
          <div className="control-stats">
            <div className="stat-item">
              <span className="stat-value">{count}</span>
              <span className="stat-label">Leads Found</span>
            </div>

            <div className="flex gap-sm">
              <button
                className="btn btn-success"
                onClick={onExport}
                disabled={count === 0}
              >
                📄 CSV
              </button>
              <button
                className="btn btn-success"
                onClick={onExportExcel}
                disabled={count === 0}
              >
                📊 Excel
              </button>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <ProgressBar status={status} />

        {/* Warning System */}
        <WarningSystem status={status} errorMessage={errorMessage} />

        {/* Help */}
        <HelpContent />
      </div>
    </div>
  );
};
