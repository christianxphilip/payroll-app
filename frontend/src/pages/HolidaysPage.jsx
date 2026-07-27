import { useState, useEffect } from 'react';
import { holidayAPI } from '../services/api';
import Modal from '../components/Modal';
import { formatDate } from '../utils/formatters';

const HolidaysPage = () => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [formData, setFormData] = useState({
    date: '',
    description: '',
    type: 'Regular',
  });
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchHolidays();
  }, [filterType]);

  const fetchHolidays = async () => {
    try {
      const filters = filterType ? { type: filterType } : {};
      const response = await holidayAPI.getAll(filters);
      setHolidays(response.data || []);
    } catch (error) {
      showMessage('error', 'Failed to fetch holidays');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const openAddModal = () => {
    setEditingHoliday(null);
    setFormData({ date: '', description: '', type: 'Regular' });
    setIsModalOpen(true);
  };

  const openEditModal = (holiday) => {
    setEditingHoliday(holiday);
    setFormData({
      date: formatDate(holiday.date),
      description: holiday.description,
      type: holiday.type,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingHoliday) {
        await holidayAPI.update(editingHoliday._id, formData);
        showMessage('success', 'Holiday updated successfully');
      } else {
        await holidayAPI.create(formData);
        showMessage('success', 'Holiday added successfully');
      }
      setIsModalOpen(false);
      fetchHolidays();
    } catch (error) {
      showMessage('error', error.response?.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this holiday?')) return;

    try {
      await holidayAPI.delete(id);
      showMessage('success', 'Holiday deleted successfully');
      fetchHolidays();
    } catch (error) {
      showMessage('error', 'Failed to delete holiday');
    }
  };

  const handleImportHolidays = async () => {
    const yearStr = prompt('Enter the year to import holidays for:', new Date().getFullYear());
    if (!yearStr) return;
    const year = parseInt(yearStr);
    if (isNaN(year) || year < 2000 || year > 2100) {
      showMessage('error', 'Please enter a valid year between 2000 and 2100');
      return;
    }
    
    setImporting(true);
    try {
      const res = await holidayAPI.bulkCreateFromExternal(year);
      showMessage('success', res.message || `Successfully processed holidays for ${year}`);
      fetchHolidays();
    } catch (error) {
      showMessage('error', error.response?.data?.error || 'Failed to import holidays');
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading holidays...</div>;
  }

  return (
    <div className="px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Holidays</h1>
        <div className="flex gap-2">
          <button
            onClick={handleImportHolidays}
            disabled={importing}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {importing ? 'Importing...' : 'Import Holidays'}
          </button>
          <button
            onClick={openAddModal}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Add Holiday
          </button>
        </div>
      </div>

      {message.text && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Filter */}
      <div className="mb-6">
        <label className="text-sm font-medium text-gray-700 mr-2">Filter by Type:</label>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg"
        >
          <option value="">All</option>
          <option value="Regular">Regular</option>
          <option value="Special">Special</option>
        </select>
      </div>

      {/* Holidays Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {holidays.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-6 py-4 text-center text-gray-500">
                  No holidays found
                </td>
              </tr>
            ) : (
              holidays.map((holiday) => (
                <tr key={holiday._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {new Date(holiday.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">{holiday.description}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        holiday.type === 'Regular'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {holiday.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => openEditModal(holiday)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(holiday._id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingHoliday ? 'Edit Holiday' : 'Add Holiday'}
      >
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            >
              <option value="Regular">Regular</option>
              <option value="Special">Special</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {editingHoliday ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default HolidaysPage;

