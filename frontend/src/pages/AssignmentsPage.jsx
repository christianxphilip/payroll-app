import { useState, useEffect } from 'react';
import { assignmentAPI } from '../services/api';
import Modal from '../components/Modal';

const AssignmentsPage = () => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    label: '',
    color: '#6b7280',
    isActive: true,
    order: 0,
  });
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      const response = await assignmentAPI.getAll();
      setAssignments(response.data || []);
    } catch (error) {
      showMessage('error', 'Failed to fetch assignments');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }, 3000));
  };

  const openAddModal = () => {
    setEditingAssignment(null);
    setFormData({
      code: '',
      label: '',
      color: '#6b7280',
      isActive: true,
      order: assignments.length,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (assignment) => {
    setEditingAssignment(assignment);
    setFormData({
      code: assignment.code,
      label: assignment.label,
      color: assignment.color,
      isActive: assignment.isActive,
      order: assignment.order || 0,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingAssignment) {
        await assignmentAPI.update(editingAssignment._id, formData);
        showMessage('success', 'Assignment updated successfully');
      } else {
        await assignmentAPI.create(formData);
        showMessage('success', 'Assignment added successfully');
      }
      setIsModalOpen(false);
      fetchAssignments();
    } catch (error) {
      showMessage('error', error.response?.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return;

    try {
      await assignmentAPI.delete(id);
      showMessage('success', 'Assignment deleted successfully');
      fetchAssignments();
    } catch (error) {
      showMessage('error', error.response?.data?.error || 'Failed to delete assignment');
    }
  };

  const handleToggleActive = async (assignment) => {
    try {
      await assignmentAPI.update(assignment._id, {
        ...assignment,
        isActive: !assignment.isActive,
      });
      showMessage('success', `Assignment ${!assignment.isActive ? 'activated' : 'deactivated'} successfully`);
      fetchAssignments();
    } catch (error) {
      showMessage('error', 'Failed to update assignment');
    }
  };

  if (loading) {
    return <div className="p-6">Loading assignments...</div>;
  }

  return (
    <div className="px-4 py-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Assignments</h1>
        <button
          onClick={openAddModal}
          className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 font-medium min-h-[44px]"
        >
          Add Assignment
        </button>
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

      {/* Mobile Card View (< 768px) */}
      <div className="block md:hidden space-y-3">
        {assignments.length === 0 ? (
          <div className="p-6 text-center text-gray-500 bg-white rounded-lg border">
            No assignments found. Click "Add Assignment" to create one.
          </div>
        ) : (
          assignments.map((assignment) => (
            <div
              key={assignment._id}
              className={`bg-white rounded-lg border border-gray-200 p-4 space-y-3 shadow-sm ${
                !assignment.isActive ? 'opacity-60' : ''
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded border border-gray-300 flex-shrink-0"
                    style={{ backgroundColor: assignment.color }}
                  />
                  <div>
                    <div className="font-semibold text-gray-900">{assignment.label}</div>
                    <div className="text-xs text-gray-500 font-mono">Code: {assignment.code}</div>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                    assignment.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {assignment.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-gray-500 border-t border-gray-100 pt-2">
                <span>Display Order: {assignment.order || 0}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleActive(assignment)}
                    className={`px-2.5 py-1 rounded text-xs font-medium ${
                      assignment.isActive
                        ? 'bg-yellow-50 text-yellow-700'
                        : 'bg-green-50 text-green-700'
                    }`}
                  >
                    {assignment.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => openEditModal(assignment)}
                    className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(assignment._id)}
                    className="px-2.5 py-1 bg-red-50 text-red-700 rounded text-xs font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View (>= 768px) */}
      <div className="hidden md:block bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Label
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Color
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Order
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {assignments.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                  No assignments found. Click "Add Assignment" to create one.
                </td>
              </tr>
            ) : (
              assignments.map((assignment) => (
                <tr key={assignment._id} className={!assignment.isActive ? 'opacity-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {assignment.code}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {assignment.label}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded border border-gray-300"
                        style={{ backgroundColor: assignment.color }}
                      />
                      <span className="text-sm text-gray-500">{assignment.color}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {assignment.order || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        assignment.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {assignment.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleToggleActive(assignment)}
                        className={`${
                          assignment.isActive
                            ? 'text-yellow-600 hover:text-yellow-900'
                            : 'text-green-600 hover:text-green-900'
                        }`}
                      >
                        {assignment.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => openEditModal(assignment)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(assignment._id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAssignment ? 'Edit Assignment' : 'Add Assignment'}
      >
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="e.g. GENERAL"
              required
              disabled={!!editingAssignment}
            />
            <p className="mt-1 text-xs text-gray-500">
              {editingAssignment ? 'Code cannot be changed' : 'Unique code (uppercase, no spaces)'}
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Label <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="e.g. General"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-16 h-10 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="#6b7280"
                pattern="^#[0-9A-Fa-f]{6}$"
                required
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">Hex color code (e.g., #6b7280)</p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Order</label>
            <input
              type="number"
              value={formData.order}
              onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="0"
              min="0"
            />
            <p className="mt-1 text-xs text-gray-500">Display order (lower numbers appear first)</p>
          </div>

          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Active</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
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
              {editingAssignment ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AssignmentsPage;

