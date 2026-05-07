import { Fragment, useEffect, useState } from 'react';
import apiClient from '../api/client';

const SEVERITY_BADGE = {
  critical: 'bg-red-100 text-red-700',
  major: 'bg-orange-100 text-orange-700',
  minor: 'bg-yellow-100 text-yellow-700',
  maintenance: 'bg-blue-100 text-blue-700',
};

const STATUS_BADGE = {
  investigating: 'bg-red-100 text-red-700',
  identified: 'bg-orange-100 text-orange-700',
  monitoring: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
};

const STATUS_OPTIONS = ['investigating', 'identified', 'monitoring', 'resolved'];
const SEVERITY_OPTIONS = ['critical', 'major', 'minor', 'maintenance'];

const fmtDate = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString();
  } catch { return '—'; }
};

const IncidentAdminPanel = () => {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    severity: 'minor',
    affectedServices: '',
    message: '',
  });
  const [updateForm, setUpdateForm] = useState({ status: 'investigating', message: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/incidents');
      setIncidents(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch {
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submitNew = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/admin/incidents', {
        title: formData.title,
        severity: formData.severity,
        affectedServices: formData.affectedServices.split(',').map((s) => s.trim()).filter(Boolean),
        message: formData.message,
      });
      setShowForm(false);
      setFormData({ title: '', severity: 'minor', affectedServices: '', message: '' });
      load();
    } catch {}
  };

  const submitUpdate = async (id) => {
    try {
      await apiClient.patch(`/admin/incidents/${id}`, updateForm);
      setEditingId(null);
      setUpdateForm({ status: 'investigating', message: '' });
      load();
    } catch {}
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this incident?')) return;
    try {
      await apiClient.delete(`/admin/incidents/${id}`);
      load();
    } catch {}
  };

  return (
    <div className="bg-white border border-[#d9dde2] rounded-md p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#2c3138]">Incidents</h3>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="text-xs px-3 py-1.5 rounded-md bg-[#4f46e5] text-white hover:bg-[#4338ca]"
        >
          {showForm ? 'Cancel' : 'New Incident'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submitNew} className="border border-[#d9dde2] rounded-md p-3 mb-4 space-y-2 bg-[#fafbfc]">
          <input
            className="w-full border border-[#d9dde2] rounded px-2 py-1 text-sm"
            placeholder="Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />
          <div className="flex gap-2">
            <select
              className="border border-[#d9dde2] rounded px-2 py-1 text-sm"
              value={formData.severity}
              onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
            >
              {SEVERITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input
              className="flex-1 border border-[#d9dde2] rounded px-2 py-1 text-sm"
              placeholder="Affected services (comma-separated)"
              value={formData.affectedServices}
              onChange={(e) => setFormData({ ...formData, affectedServices: e.target.value })}
            />
          </div>
          <textarea
            className="w-full border border-[#d9dde2] rounded px-2 py-1 text-sm"
            placeholder="Initial update message"
            rows={3}
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            required
          />
          <div className="flex gap-2">
            <button type="submit" className="text-xs px-3 py-1.5 rounded-md bg-[#4f46e5] text-white">Submit</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-xs px-3 py-1.5 rounded-md border border-[#d9dde2]">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="h-32 bg-gray-50 rounded animate-pulse" />
      ) : incidents.length === 0 ? (
        <div className="text-sm text-[#7a808a] py-6 text-center">No incidents.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[#7a808a] uppercase border-b border-[#d9dde2]">
                <th className="py-2 px-2">Title</th>
                <th className="py-2 px-2">Severity</th>
                <th className="py-2 px-2">Status</th>
                <th className="py-2 px-2">Affected</th>
                <th className="py-2 px-2">Created</th>
                <th className="py-2 px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => (
                <Fragment key={inc._id}>
                  <tr className="border-b border-[#f0f1f3]">
                    <td className="py-2 px-2 font-medium text-[#2c3138]">{inc.title}</td>
                    <td className="py-2 px-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${SEVERITY_BADGE[inc.severity] || 'bg-gray-100 text-gray-600'}`}>
                        {inc.severity}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[inc.status] || 'bg-gray-100 text-gray-600'}`}>
                        {inc.status === 'investigating' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                        {inc.status}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex flex-wrap gap-1">
                        {(inc.affectedServices || []).map((s) => (
                          <span key={s} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{s}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-xs text-[#7a808a]">{fmtDate(inc.createdAt)}</td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(editingId === inc._id ? null : inc._id);
                          setUpdateForm({ status: inc.status, message: '' });
                        }}
                        className="text-xs px-2 py-1 rounded border border-[#d9dde2] mr-1"
                      >
                        Update
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(inc._id)}
                        className="text-xs px-2 py-1 rounded border border-red-200 text-red-600"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                  {editingId === inc._id && (
                    <tr className="bg-[#fafbfc] border-b border-[#f0f1f3]">
                      <td colSpan={6} className="p-3">
                        <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center">
                          <select
                            className="border border-[#d9dde2] rounded px-2 py-1 text-sm"
                            value={updateForm.status}
                            onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
                          >
                            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <textarea
                            className="flex-1 border border-[#d9dde2] rounded px-2 py-1 text-sm"
                            placeholder="Update message"
                            rows={2}
                            value={updateForm.message}
                            onChange={(e) => setUpdateForm({ ...updateForm, message: e.target.value })}
                          />
                          <button
                            type="button"
                            onClick={() => submitUpdate(inc._id)}
                            className="text-xs px-3 py-1.5 rounded-md bg-[#4f46e5] text-white"
                          >
                            Save
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default IncidentAdminPanel;
