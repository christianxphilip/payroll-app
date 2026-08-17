import { useState, useEffect } from 'react';
import { employeeAPI } from '../services/api';
import Modal from '../components/Modal';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { useAuth } from '../context/AuthContext';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import Tooltip from '../components/Tooltip';

const EmployeesPage = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [adjustmentsModalEmployee, setAdjustmentsModalEmployee] = useState(null);
  const [adjustments, setAdjustments] = useState([]);
  const [adjustmentForm, setAdjustmentForm] = useState({
    type: 'ALLOWANCE',
    name: '',
    amount: 0,
    frequency: 'MONTHLY',
    appliesFrom: '',
    appliesTo: ''
  });
  const [formData, setFormData] = useState({
    employeeName: '',
    position: '',
    email: '',
    birthday: '',
    address: '',
    hiredDate: '',
    resignedDate: '',
    lastWorkingDate: '',
    status: 'ACTIVE',
    employmentType: 'FULL_TIME',
    wageType: 'HOURLY',
    wageRate: '',
    username: '',
    password: ''
  });
  const [showModalPassword, setShowModalPassword] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, employeeName: null });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getAll(searchTerm);
      setEmployees(response.data || []);
    } catch (error) {
      showMessage('error', 'Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const handleSearch = () => {
    setLoading(true);
    fetchEmployees();
  };

  const openAddModal = () => {
    setEditingEmployee(null);
    setFormData({
      employeeName: '',
      position: '',
      email: '',
      birthday: '',
      address: '',
      hiredDate: '',
      resignedDate: '',
      lastWorkingDate: '',
      status: 'ACTIVE',
      employmentType: 'FULL_TIME',
      wageType: 'HOURLY',
      wageRate: '',
      username: '',
      password: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      employeeName: employee.employeeName || '',
      position: employee.position || '',
      email: employee.email || '',
      birthday: employee.birthday ? employee.birthday.split('T')[0] : '',
      address: employee.address || '',
      hiredDate: employee.hiredDate ? employee.hiredDate.split('T')[0] : '',
      resignedDate: employee.resignedDate ? employee.resignedDate.split('T')[0] : '',
      lastWorkingDate: employee.lastWorkingDate ? employee.lastWorkingDate.split('T')[0] : '',
      status: employee.status || 'ACTIVE',
      employmentType: employee.employmentType || 'FULL_TIME',
      wageType: employee.wageType || 'HOURLY',
      wageRate: employee.wageRate != null ? String(employee.wageRate) : '',
      username: employee.username || '',
      password: employee.portalPassword || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.employeeName || formData.employeeName.trim() === '') {
      showMessage('error', 'Employee name is required');
      return;
    }
    
    const wageRateNum = formData.wageRate === '' ? 0 : parseFloat(formData.wageRate);
    if (isNaN(wageRateNum) || wageRateNum < 0) {
      showMessage('error', 'Wage rate must be a positive number');
      return;
    }
    
    try {
      // Convert wageRate to a number just before sending to backend
      const payload = {
        ...formData,
        wageRate: wageRateNum
      };

      if (editingEmployee) {
        await employeeAPI.update(editingEmployee.employeeName, payload);
        showMessage('success', 'Employee updated successfully');
      } else {
        await employeeAPI.create(payload);
        showMessage('success', 'Employee added successfully');
      }
      setIsModalOpen(false);
      fetchEmployees();
    } catch (error) {
      showMessage('error', error.response?.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (employeeName) => {
    setDeleteConfirm({ isOpen: true, employeeName });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.employeeName) return;
    
    try {
      await employeeAPI.delete(deleteConfirm.employeeName);
      showMessage('success', 'Employee deleted successfully');
      fetchEmployees();
      setDeleteConfirm({ isOpen: false, employeeName: null });
    } catch (error) {
      showMessage('error', 'Failed to delete employee');
    }
  };

  const openAdjustmentsModal = async (employee) => {
    setAdjustmentsModalEmployee(employee);
    setAdjustmentForm({
      type: 'ALLOWANCE',
      name: '',
      amount: 0,
      frequency: 'MONTHLY',
      appliesFrom: '',
      appliesTo: ''
    });
    try {
      const res = await employeeAPI.getAdjustments(employee._id);
      setAdjustments(res.data || res);
    } catch (error) {
      showMessage('error', 'Failed to load allowances/deductions');
    }
  };

  const handleAddAdjustment = async (e) => {
    e.preventDefault();
    if (!adjustmentsModalEmployee) return;
    try {
      const payload = {
        ...adjustmentForm,
        amount: parseFloat(adjustmentForm.amount || '0')
      };
      const res = await employeeAPI.createAdjustment(adjustmentsModalEmployee._id, payload);
      setAdjustments((prev) => [res.data || res, ...prev]);
      setAdjustmentForm({
        ...adjustmentForm,
        name: '',
        amount: 0
      });
      showMessage('success', 'Adjustment added');
    } catch (error) {
      showMessage('error', error.response?.data?.error || 'Failed to add adjustment');
    }
  };

  const handleDeleteAdjustment = async (id) => {
    if (!confirm('Delete this allowance/deduction?')) return;
    try {
      await employeeAPI.deleteAdjustment(id);
      setAdjustments((prev) => prev.filter((a) => a._id !== id));
      showMessage('success', 'Adjustment deleted');
    } catch (error) {
      showMessage('error', 'Failed to delete adjustment');
    }
  };

  if (loading) {
    return <div className="p-6">Loading employees...</div>;
  }

  return (
    <div className="px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Employees</h1>
        <button
          onClick={openAddModal}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Add Employee
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

      {/* Search & Actions Bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg min-h-[44px]"
          />
          <button
            onClick={handleSearch}
            className="bg-gray-600 text-white px-5 py-2 rounded-lg hover:bg-gray-700 font-medium min-h-[44px]"
          >
            Search
          </button>
        </div>
      </div>

      {/* Employees View */}
      {loading ? (
        <LoadingSkeleton type="table" rows={5} cols={4} />
      ) : employees.length === 0 ? (
        <EmptyState
          title="No Employees Found"
          message={searchTerm ? `No employees match "${searchTerm}". Try a different search term.` : "Get started by adding your first employee to the system."}
          actionLabel="Add Employee"
          onAction={openAddModal}
        />
      ) : (
        <>
          {/* Mobile Card List (< 768px) */}
          <div className="block md:hidden space-y-4">
            {employees.map((employee) => (
              <div key={employee._id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg text-gray-900">{employee.employeeName}</h3>
                    {employee.position && <p className="text-sm text-gray-600">{employee.position}</p>}
                    {employee.email && <p className="text-xs text-gray-500">{employee.email}</p>}
                  </div>
                  <span
                    className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                      employee.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-800'
                        : employee.status === 'RENDERING'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    {employee.status || 'ACTIVE'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 border-t border-b border-gray-100 py-2">
                  <div>
                    <span className="font-medium text-gray-500">Type:</span> {employee.employmentType || 'FULL_TIME'}
                  </div>
                  {user?.role === 'admin' && (
                    <div>
                      <span className="font-medium text-gray-500">Wage:</span> {employee.wageType || 'HOURLY'} @ ₱{employee.wageRate ?? 0}
                    </div>
                  )}
                  {employee.updatedAt && (
                    <div className="col-span-2 text-gray-400">
                      Updated: {new Date(employee.updatedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-1 justify-end">
                  <button
                    onClick={() => openEditModal(employee)}
                    className="flex-1 py-2 px-3 bg-blue-50 text-blue-700 rounded-md text-xs font-semibold hover:bg-blue-100 min-h-[40px]"
                  >
                    Edit
                  </button>
                  {user?.role === 'admin' && (
                    <button
                      onClick={() => openAdjustmentsModal(employee)}
                      className="flex-1 py-2 px-3 bg-orange-50 text-orange-700 rounded-md text-xs font-semibold hover:bg-orange-100 min-h-[40px]"
                    >
                      Allowances
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(employee.employeeName)}
                    className="py-2 px-3 bg-red-50 text-red-700 rounded-md text-xs font-semibold hover:bg-red-100 min-h-[40px]"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View (>= 768px) */}
          <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Position / Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    <Tooltip text={user?.role === 'admin' ? "Employment type and wage rate configuration" : "Employment type configuration"}>
                      {user?.role === 'admin' ? "Payroll Settings" : "Employment Type"}
                    </Tooltip>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {employees.map((employee) => (
                  <tr key={employee._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{employee.employeeName}</div>
                      {employee.position && (
                        <div className="text-sm text-gray-700">{employee.position}</div>
                      )}
                      {employee.email && (
                        <div className="text-xs text-gray-500">{employee.email}</div>
                      )}
                      {employee.updatedAt && (
                        <div className="text-xs text-gray-400 mt-1">
                          Updated: {new Date(employee.updatedAt).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          employee.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-800'
                            : employee.status === 'RENDERING'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-200 text-gray-800'
                        }`}
                      >
                        {employee.status || 'ACTIVE'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      <div className="text-xs text-gray-600">
                        Type: {employee.employmentType || 'FULL_TIME'}
                      </div>
                      {user?.role === 'admin' && (
                        <div className="text-xs text-gray-600">
                          Wage: {employee.wageType || 'HOURLY'} @ {employee.wageRate ?? 0}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => openEditModal(employee)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        Edit
                      </button>
                      {user?.role === 'admin' && (
                        <button
                          onClick={() => openAdjustmentsModal(employee)}
                          className="text-orange-600 hover:text-orange-900 mr-4"
                        >
                          Allowances &amp; Deductions
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(employee.employeeName)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, employeeName: null })}
        onConfirm={confirmDelete}
        title="Delete Employee"
        message={`Are you sure you want to delete ${deleteConfirm.employeeName}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        type="danger"
      />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEmployee ? 'Edit Employee' : 'Add Employee'}
      >
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Employee Name
            </label>
            <input
              type="text"
              value={formData.employeeName}
              onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
              <input
                type="text"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
          <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
            <h4 className="text-xs font-semibold text-indigo-800 uppercase tracking-wider mb-2">Employee Portal Login Credentials</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  placeholder="e.g. john.doe"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showModalPassword ? 'text' : 'password'}
                    placeholder="Enter login password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-1.5 pr-10 text-sm border border-gray-300 rounded-lg bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowModalPassword(!showModalPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1"
                    aria-label={showModalPassword ? 'Hide password' : 'Show password'}
                  >
                    {showModalPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.05 10.05 0 012.122-.363c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m-3.266 1.72a3 3 0 11-4.243-4.243m4.243 4.243L3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Birthday</label>
              <input
                type="date"
                value={formData.birthday}
                onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Hired Date</label>
              <input
                type="date"
                value={formData.hiredDate}
                onChange={(e) => setFormData({ ...formData, hiredDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Last Working Date</label>
              <input
                type="date"
                value={formData.lastWorkingDate}
                onChange={(e) => setFormData({ ...formData, lastWorkingDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows="2"
            />
          </div>
          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="RENDERING">RENDERING</option>
                <option value="RESIGNED">RESIGNED</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Tooltip text="Full-time employees get overtime multipliers. Part-time and on-call employees are paid hourly without OT multipliers.">
                  <span className="flex items-center gap-1 cursor-help">
                    Employment Type
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                </Tooltip>
              </label>
              <select
                value={formData.employmentType}
                onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="FULL_TIME">FULL_TIME</option>
                <option value="PART_TIME">PART_TIME</option>
                <option value="ON_CALL">ON_CALL</option>
              </select>
            </div>
            {user?.role === 'admin' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Tooltip text="HOURLY: Rate per hour. DAILY: Rate per day (automatically divided by 8 for hourly calculations).">
                    <span className="flex items-center gap-1 cursor-help">
                      Wage Type
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </span>
                  </Tooltip>
                </label>
                <select
                  value={formData.wageType}
                  onChange={(e) => setFormData({ ...formData, wageType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="HOURLY">HOURLY</option>
                  <option value="DAILY">DAILY</option>
                </select>
              </div>
            )}
          </div>
          {user?.role === 'admin' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Tooltip text={`Enter the ${formData.wageType === 'DAILY' ? 'daily' : 'hourly'} rate. For daily rates, the system automatically calculates hourly rate (daily ÷ 8).`}>
                  <span className="flex items-center gap-1">
                    Wage Rate <span className="text-red-500">*</span>
                    <svg className="w-4 h-4 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                </Tooltip>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.wageRate}
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow empty string for better UX while typing
                  if (value === '' || (!isNaN(value) && parseFloat(value) >= 0)) {
                    setFormData({ ...formData, wageRate: value });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsModalOpen(false);
                  }
                  // Prevent negative numbers
                  if (e.key === '-' || e.key === '+') {
                    e.preventDefault();
                  }
                }}
                className={`w-full px-3 py-2 border rounded-lg ${
                  formData.wageRate && parseFloat(formData.wageRate) < 0
                    ? 'border-red-300 bg-red-50'
                    : formData.wageRate && !isNaN(formData.wageRate) && parseFloat(formData.wageRate) >= 0
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-300'
                }`}
                required
                placeholder={formData.wageType === 'DAILY' ? 'e.g., 500 (per day)' : 'e.g., 62.50 (per hour)'}
              />
              {formData.wageRate && parseFloat(formData.wageRate) < 0 && (
                <p className="text-red-500 text-xs mt-1">Wage rate cannot be negative</p>
              )}
              {formData.wageRate && !isNaN(formData.wageRate) && parseFloat(formData.wageRate) >= 0 && (
                <p className="text-green-600 text-xs mt-1">
                  {formData.wageType === 'DAILY' 
                    ? `Hourly rate: ₱${(parseFloat(formData.wageRate) / 8).toFixed(2)}`
                    : `Rate: ₱${parseFloat(formData.wageRate).toFixed(2)}/hour`}
                </p>
              )}
              {!formData.wageRate && (
                <p className="text-xs text-gray-500 mt-1">
                  For HOURLY, basic salary = total payable hours × hourly rate. For DAILY, this will be interpreted per day.
                </p>
              )}
            </div>
          )}
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
              {editingEmployee ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Allowances & Deductions Modal */}
      <Modal
        isOpen={!!adjustmentsModalEmployee}
        onClose={() => setAdjustmentsModalEmployee(null)}
        title={
          adjustmentsModalEmployee
            ? `Allowances & Deductions - ${adjustmentsModalEmployee.employeeName}`
            : 'Allowances & Deductions'
        }
      >
        {adjustmentsModalEmployee && (
          <div className="space-y-4">
            <form onSubmit={handleAddAdjustment} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={adjustmentForm.type}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="ALLOWANCE">ALLOWANCE</option>
                    <option value="DEDUCTION">DEDUCTION</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                  <select
                    value={adjustmentForm.frequency}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, frequency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="WEEKLY">WEEKLY</option>
                    <option value="MONTHLY">MONTHLY</option>
                    <option value="YEARLY">YEARLY</option>
                    <option value="ONE_TIME">ONE_TIME</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustmentForm.amount}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={adjustmentForm.name}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="e.g., Transport Allowance"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Applies From</label>
                  <input
                    type="date"
                    value={adjustmentForm.appliesFrom}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, appliesFrom: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Applies To (optional)</label>
                  <input
                    type="date"
                    value={adjustmentForm.appliesTo}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, appliesTo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm"
                >
                  Add
                </button>
              </div>
            </form>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Existing Items</h3>
              {adjustments.length === 0 ? (
                <p className="text-sm text-gray-500">No allowances or deductions yet.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 uppercase">
                        <th className="px-2 py-1">Name</th>
                        <th className="px-2 py-1">Type</th>
                        <th className="px-2 py-1">Freq</th>
                        <th className="px-2 py-1 text-right">Amount</th>
                        <th className="px-2 py-1">Period</th>
                        <th className="px-2 py-1 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adjustments.map((item) => (
                        <tr key={item._id} className="border-t">
                          <td className="px-2 py-1">{item.name}</td>
                          <td className="px-2 py-1">
                            <span
                              className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                                item.type === 'ALLOWANCE'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {item.type}
                            </span>
                          </td>
                          <td className="px-2 py-1 text-xs text-gray-600">{item.frequency}</td>
                          <td className="px-2 py-1 text-right">
                            {Number(item.amount || 0).toFixed(2)}
                          </td>
                          <td className="px-2 py-1 text-xs text-gray-600">
                            {item.appliesFrom &&
                              new Date(item.appliesFrom).toLocaleDateString()}{' '}
                            {item.appliesTo &&
                              `– ${new Date(item.appliesTo).toLocaleDateString()}`}
                          </td>
                          <td className="px-2 py-1 text-right">
                            <button
                              onClick={() => handleDeleteAdjustment(item._id)}
                              className="text-xs text-red-600 hover:text-red-900"
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
          </div>
        )}
      </Modal>
    </div>
  );
};

export default EmployeesPage;

