import { useState, useEffect } from 'react';
import { settingsAPI } from '../services/api';
import Modal from '../components/Modal';

const SettingsPage = () => {
  const [settings, setSettings] = useState({
    overtimeMultiplier: 1.25,
    nightDifferentialMultiplier: 0.1,
    regularHolidayMultiplier: 1.0,
    specialHolidayMultiplier: 0.3,
    overtimeRegularHolidayMultiplier: 2.6,
    overtimeSpecialHolidayMultiplier: 1.69,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await settingsAPI.get();
      if (response.data) {
        setSettings(response.data);
      }
    } catch (error) {
      showMessage('error', 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const handleChange = (field, value) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setSettings(prev => ({ ...prev, [field]: numValue }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await settingsAPI.update(settings);
      showMessage('success', 'Settings updated successfully');
    } catch (error) {
      showMessage('error', error.response?.data?.error || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading settings...</div>;
  }

  return (
    <div className="px-4 py-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Settings</h1>

      {message.text && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Payroll Multipliers</h2>
        <p className="text-sm text-gray-600 mb-6">
          Configure the multipliers used for calculating overtime, night differential, and holiday pay.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Overtime Multiplier */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Overtime Multiplier
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={settings.overtimeMultiplier}
                  onChange={(e) => handleChange('overtimeMultiplier', e.target.value)}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
                <span className="text-sm text-gray-600">
                  (e.g., 1.25 = 125% of base rate, applies only to full-time employees)
                </span>
              </div>
            </div>

            {/* Night Differential Multiplier */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Night Differential Multiplier
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={settings.nightDifferentialMultiplier}
                  onChange={(e) => handleChange('nightDifferentialMultiplier', e.target.value)}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
                <span className="text-sm text-gray-600">
                  (e.g., 0.1 = 10% of base rate for hours worked between 10PM - 6AM)
                </span>
              </div>
            </div>

            {/* Regular Holiday Multiplier */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Regular Holiday Multiplier
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={settings.regularHolidayMultiplier}
                  onChange={(e) => handleChange('regularHolidayMultiplier', e.target.value)}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
                <span className="text-sm text-gray-600">
                  (e.g., 1.0 = 100% premium on top of base rate for regular holidays)
                </span>
              </div>
            </div>

            {/* Special Holiday Multiplier */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Special Holiday Multiplier
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={settings.specialHolidayMultiplier}
                  onChange={(e) => handleChange('specialHolidayMultiplier', e.target.value)}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
                <span className="text-sm text-gray-600">
                  (e.g., 0.3 = 30% premium on top of base rate for special holidays)
                </span>
              </div>
            </div>

            {/* Overtime Regular Holiday Multiplier */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Overtime Regular Holiday Multiplier
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={settings.overtimeRegularHolidayMultiplier}
                  onChange={(e) => handleChange('overtimeRegularHolidayMultiplier', e.target.value)}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
                <span className="text-sm text-gray-600">
                  (e.g., 2.6 = 260% of base rate for overtime hours on regular holidays, applies only to full-time employees)
                </span>
              </div>
            </div>

            {/* Overtime Special Holiday Multiplier */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Overtime Special Holiday Multiplier
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={settings.overtimeSpecialHolidayMultiplier}
                  onChange={(e) => handleChange('overtimeSpecialHolidayMultiplier', e.target.value)}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
                <span className="text-sm text-gray-600">
                  (e.g., 1.69 = 169% of base rate for overtime hours on special holidays, applies only to full-time employees)
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-2">
            <button
              type="button"
              onClick={fetchSettings}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsPage;

