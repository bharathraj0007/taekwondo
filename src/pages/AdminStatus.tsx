import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import { 
  Activity, 
  RefreshCw, 
  Database, 
  Cloud, 
  HardDrive, 
  Cpu, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  TrendingUp, 
  ArrowLeft 
} from 'lucide-react';

export const AdminStatus: React.FC = () => {
  const { isAdmin } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [runningScan, setRunningScan] = useState(false);
  const [statusData, setStatusData] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch status and history
  const fetchData = async () => {
    if (!isAdmin) return;
    try {
      setError(null);
      
      const [statusRes, historyRes] = await Promise.all([
        fetch('/api/admin/health/status', {
          credentials: 'include'
        }),
        fetch('/api/admin/health/history?hours=48', {
          credentials: 'include'
        })
      ]);

      if (!statusRes.ok || !historyRes.ok) {
        throw new Error('Failed to retrieve server-side diagnostics.');
      }

      const statusJson = await statusRes.json();
      const historyJson = await historyRes.json();

      setStatusData(statusJson);
      setHistoryData(historyJson);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error loading health details.');
    } finally {
      setLoading(false);
    }
  };

  // Run Manual Diagnostic Scan
  const handleRunManualScan = async () => {
    if (!isAdmin || runningScan) return;
    try {
      setRunningScan(true);
      setError(null);

      const res = await fetch('/api/admin/health/check-now', {
        method: 'POST',
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error('On-demand diagnostic scan failed.');
      }

      const data = await res.json();
      // Show instant alert
      alert(data.message || 'System diagnostic scan completed successfully!');
      
      // Refresh list
      await fetchData();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Manual scan failed.');
    } finally {
      setRunningScan(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchData();

      // Auto refresh data every 2 minutes (120000ms)
      const interval = setInterval(fetchData, 120000);
      return () => clearInterval(interval);
    }
  }, [isAdmin]);

  // Protect view
  if (!isAdmin) {
    return <Navigate to="/auth" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center space-y-4">
          <RefreshCw className="w-10 h-10 animate-spin text-red-500 mx-auto" />
          <p className="text-slate-400 font-bold uppercase tracking-wider text-xs">Booting CombatFlow Diagnostic Guard...</p>
        </div>
      </div>
    );
  }

  const latestLog = statusData?.latestLog;
  const services = latestLog?.services || [];
  const uptimeHours = statusData?.uptime ? (statusData.uptime / 3600).toFixed(2) : '0';
  
  // Format memory
  const heapUsed = statusData?.memory?.heapUsed ? (statusData.memory.heapUsed / 1024 / 1024).toFixed(2) : '0';
  const rss = statusData?.memory?.rss ? (statusData.memory.rss / 1024 / 1024).toFixed(2) : '0';

  const history = historyData?.history || [];
  const recoveries = historyData?.recoveries || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'up':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full uppercase shadow-sm"><CheckCircle className="w-3.5 h-3.5" /> Healthy</span>;
      case 'degraded':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200 rounded-full uppercase shadow-sm"><AlertTriangle className="w-3.5 h-3.5" /> Degraded</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-red-50 text-red-600 border border-red-200 rounded-full uppercase shadow-sm"><XCircle className="w-3.5 h-3.5" /> Offline</span>;
    }
  };

  const getServiceIcon = (name: string) => {
    const lowercaseName = name.toLowerCase();
    if (lowercaseName.includes('mongodb')) return <Database className="w-5 h-5 text-indigo-500" />;
    if (lowercaseName.includes('cloudinary')) return <Cloud className="w-5 h-5 text-sky-400" />;
    if (lowercaseName.includes('system')) return <Cpu className="w-5 h-5 text-emerald-500" />;
    if (lowercaseName.includes('disk')) return <HardDrive className="w-5 h-5 text-amber-500" />;
    return <Activity className="w-5 h-5 text-slate-500" />;
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      {/* Header breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link to="/admin" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 font-semibold uppercase mb-2">
            <ArrowLeft className="w-3 h-3" /> Back to Dashboard
          </Link>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Health Guard Panel</h1>
          <p className="text-sm text-slate-500">Automated self-recovery audits and SMTP alerts dashboard.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="px-4 py-2 border border-slate-200 text-xs font-bold uppercase rounded-xl hover:bg-slate-50 bg-white shadow-sm cursor-pointer inline-flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" /> Refresh Data
          </button>
          
          <button
            onClick={handleRunManualScan}
            disabled={runningScan}
            className="px-4 py-2 bg-slate-900 text-white border border-slate-900 text-xs font-bold uppercase rounded-xl hover:bg-slate-800 shadow-sm cursor-pointer inline-flex items-center gap-2 disabled:opacity-50"
          >
            <Activity className={`w-3.5 h-3.5 ${runningScan ? 'animate-spin' : ''}`} />
            {runningScan ? 'Scanning...' : 'Run Diagnostics Now'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 animate-pulse">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Error: {error}</span>
        </div>
      )}

      {/* Overview stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-bold uppercase">Overall Guard State</span>
          <div className="mt-2.5">
            {getStatusBadge(latestLog?.status || 'healthy')}
          </div>
          <span className="text-[9px] text-slate-400 mt-3 block">Last Audit: {latestLog?.checkedAt ? new Date(latestLog.checkedAt).toLocaleTimeString() : 'Never'}</span>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">API Host Process Uptime</span>
          <span className="text-2xl font-black text-slate-950 font-mono block mt-1.5">{uptimeHours} <span className="text-xs font-sans font-bold text-slate-400">hours</span></span>
          <span className="text-[9px] text-slate-400 mt-2 block">System running continuously.</span>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">API RAM Footprint</span>
          <span className="text-2xl font-black text-slate-950 font-mono block mt-1.5">{rss} <span className="text-xs font-sans font-bold text-slate-400">MB</span></span>
          <span className="text-[9px] text-slate-400 mt-2 block">V8 heap used: {heapUsed} MB</span>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Active Scan Cron Interval</span>
            <span className="text-xl font-black text-slate-950 font-mono block mt-1.5">{statusData?.cronSchedule || '0 */3 * * *'}</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-sans">
            <span className="text-[10px] text-slate-400 font-bold uppercase">SMTP Gateway</span>
            {statusData?.smtpConfigured ? (
              <span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px]">
                <CheckCircle className="w-3 h-3" /> Active ✅
              </span>
            ) : (
              <Link 
                to="/admin?tab=smtp"
                className="inline-flex items-center gap-1 font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-full text-[10px] transition-all cursor-pointer shadow-sm"
                title="Click to configure custom SMTP gateway in Admin Settings"
              >
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                <span>Configure SMTP →</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Services status details */}
      <div className="space-y-4">
        <h2 className="text-xs font-black uppercase text-slate-500 tracking-wider">Core Systems Diagnostic Checks</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {services.map((s: any, idx: number) => (
            <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {getServiceIcon(s.service)}
                  <span className="font-bold text-slate-900 text-sm">{s.service}</span>
                </div>
                <div>
                  {s.status === 'up' ? (
                    <span className="text-[9px] font-black bg-emerald-50 text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded-full uppercase">UP</span>
                  ) : s.status === 'degraded' ? (
                    <span className="text-[9px] font-black bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full uppercase">DEGRADED</span>
                  ) : (
                    <span className="text-[9px] font-black bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded-full uppercase">DOWN</span>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed break-words">{s.message}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recovery Action Logs and Uptime History split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recovery action log */}
        <div className="space-y-4">
          <h2 className="text-xs font-black uppercase text-slate-500 tracking-wider">Automated Self-Recovery Agent Log</h2>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Component</th>
                    <th className="py-3 px-4">Action Taken</th>
                    <th className="py-3 px-4">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {recoveries.map((r: any) => (
                    <tr key={r._id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 text-slate-400 font-mono">
                        {new Date(r.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{r.service}</td>
                      <td className="py-3 px-4 text-slate-500 leading-relaxed">
                        <div>{r.action}</div>
                        {r.details && <div className="text-[10px] text-slate-400 mt-0.5">{r.details}</div>}
                      </td>
                      <td className="py-3 px-4">
                        {r.outcome === 'resolved' ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200 font-bold text-[9px] uppercase">
                            Auto-Resolved
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-red-50 text-red-600 border border-red-200 font-bold text-[9px] uppercase">
                            Escalated
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {recoveries.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                        No recent failover occurrences logged. Services pristine.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Diagnostic Timeline */}
        <div className="space-y-4">
          <h2 className="text-xs font-black uppercase text-slate-500 tracking-wider">Last 24-48 Hours Availability Log</h2>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                    <th className="py-3 px-4">Check Date / Time</th>
                    <th className="py-3 px-4">Service State</th>
                    <th className="py-3 px-4">Breakdown Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {history.map((h: any) => {
                    const errors = h.services.filter((s: any) => s.status !== 'up').map((s: any) => s.service);
                    return (
                      <tr key={h._id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 text-slate-500 font-mono">
                          {new Date(h.checkedAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          {h.status === 'healthy' ? (
                            <span className="font-bold text-emerald-600">Healthy</span>
                          ) : h.status === 'degraded' ? (
                            <span className="font-bold text-amber-500">Degraded</span>
                          ) : (
                            <span className="font-bold text-red-600">Unhealthy</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-400 leading-tight">
                          {errors.length > 0 ? (
                            <span className="text-slate-600 font-semibold">{errors.join(', ')} failed checks</span>
                          ) : (
                            'All checks successful'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-12 text-center text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                        No previous availability history logs found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
