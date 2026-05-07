import { useEffect, useState } from 'react';
import apiClient from '../api/client';

const ServiceManagerPanel = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', url: '', tags: '', assertKeyword: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/services');
      setServices(Array.isArray(res.data) ? res.data : []);
    } catch {
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/admin/services', {
        name: formData.name,
        url: formData.url,
        tags: formData.tags.split(',').map((t) => t.trim()).filter(Boolean),
        assertKeyword: formData.assertKeyword || null,
      });
      setShowForm(false);
      setFormData({ name: '', url: '', tags: '', assertKeyword: '' });
      load();
    } catch {}
  };

  const toggleEnabled = async (svc) => {
    try {
      await apiClient.patch(`/admin/services/${svc._id}`, { enabled: !svc.enabled });
      load();
    } catch {}
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this service?')) return;
    try {
      await apiClient.delete(`/admin/services/${id}`);
      load();
    } catch {}
  };

  return (
    <div className="bg-white border border-[#d9dde2] rounded-md p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#2c3138]">Monitored Services</h3>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="text-xs px-3 py-1.5 rounded-md bg-[#4f46e5] text-white hover:bg-[#4338ca]"
        >
          {showForm ? 'Cancel' : 'Add Service'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="border border-[#d9dde2] rounded-md p-3 mb-4 space-y-2 bg-[#fafbfc]">
          <input
            className="w-full border border-[#d9dde2] rounded px-2 py-1 text-sm"
            placeholder="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <input
            className="w-full border border-[#d9dde2] rounded px-2 py-1 text-sm"
            placeholder="URL"
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            required
          />
          <input
            className="w-full border border-[#d9dde2] rounded px-2 py-1 text-sm"
            placeholder="Tags (comma-separated)"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
          />
          <input
            className="w-full border border-[#d9dde2] rounded px-2 py-1 text-sm"
            placeholder="Assert keyword (optional)"
            value={formData.assertKeyword}
            onChange={(e) => setFormData({ ...formData, assertKeyword: e.target.value })}
          />
          <button type="submit" className="text-xs px-3 py-1.5 rounded-md bg-[#4f46e5] text-white">Save</button>
        </form>
      )}

      {loading ? (
        <div className="h-32 bg-gray-50 rounded animate-pulse" />
      ) : services.length === 0 ? (
        <div className="text-sm text-[#7a808a] py-6 text-center">No services configured.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[#7a808a] uppercase border-b border-[#d9dde2]">
                <th className="py-2 px-2">Name</th>
                <th className="py-2 px-2">URL</th>
                <th className="py-2 px-2">Tags</th>
                <th className="py-2 px-2">Enabled</th>
                <th className="py-2 px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {services.map((svc) => (
                <tr key={svc._id} className="border-b border-[#f0f1f3]">
                  <td className="py-2 px-2 font-medium text-[#2c3138]">{svc.name}</td>
                  <td className="py-2 px-2 text-xs text-[#7a808a] break-all">{svc.url}</td>
                  <td className="py-2 px-2">
                    <div className="flex flex-wrap gap-1">
                      {(svc.tags || []).map((t) => (
                        <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{t}</span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <button
                      type="button"
                      onClick={() => toggleEnabled(svc)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        svc.enabled ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          svc.enabled ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="py-2 px-2">
                    <button
                      type="button"
                      onClick={() => remove(svc._id)}
                      className="text-xs px-2 py-1 rounded border border-red-200 text-red-600"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ServiceManagerPanel;
