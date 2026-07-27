import { useState, useEffect } from 'react';
import { availabilityAPI, employeeAPI } from '../services/api';
import Modal from '../components/Modal';

const AvailabilityView = () => {
    const [availability, setAvailability] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAvailability, setEditingAvailability] = useState(null);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [formData, setFormData] = useState({
        employeeName: '',
        type: 'WEEKLY',
        startDate: '',
        endDate: '',
        daysOfWeek: [],
        specificDates: [],
        shiftType: 'Any',
        notes: ''
    });

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const types = [
        { value: 'WEEKLY', label: 'Weekly' },
        { value: 'MONTHLY', label: 'Monthly' },
        { value: 'INDEFINITE', label: 'Indefinite' },
        { value: 'SPECIFIC_DATES', label: 'Specific Dates' }
    ];

    useEffect(() => {
        fetchEmployees();
        fetchAvailability();
    }, []);

    const fetchEmployees = async () => {
        try {
            const response = await employeeAPI.getAll();
            setEmployees(response.data || []);
        } catch (error) {
            console.error('Failed to fetch employees');
        }
    };

    const fetchAvailability = async () => {
        try {
            const response = await availabilityAPI.getAll();
            setAvailability(response.data || []);
        } catch (error) {
            showMessage('error', 'Failed to fetch availability');
        } finally {
            setLoading(false);
        }
    };

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    };

    const openAddModal = () => {
        setEditingAvailability(null);
        setFormData({
            employeeName: '',
            type: 'WEEKLY',
            startDate: '',
            endDate: '',
            daysOfWeek: [],
            specificDates: [],
            shiftType: 'Any',
            notes: ''
        });
        setIsModalOpen(true);
    };

    const openEditModal = (item) => {
        setEditingAvailability(item);
        setFormData({
            employeeName: item.employeeName,
            type: item.type,
            startDate: item.startDate ? new Date(item.startDate).toISOString().split('T')[0] : '',
            endDate: item.endDate ? new Date(item.endDate).toISOString().split('T')[0] : '',
            daysOfWeek: item.daysOfWeek || [],
            specificDates: item.specificDates || [],
            shiftType: item.shiftType || 'Any',
            notes: item.notes || ''
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingAvailability) {
                await availabilityAPI.update(editingAvailability._id, formData);
                showMessage('success', 'Availability updated successfully');
            } else {
                await availabilityAPI.create(formData);
                showMessage('success', 'Availability created successfully');
            }
            setIsModalOpen(false);
            fetchAvailability();
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Operation failed');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this availability?')) return;
        try {
            await availabilityAPI.delete(id);
            showMessage('success', 'Availability deleted successfully');
            fetchAvailability();
        } catch (error) {
            showMessage('error', 'Failed to delete availability');
        }
    };

    const getShiftColor = (shiftName) => {
        const name = shiftName.toLowerCase();
        if (name.includes('opening')) return 'bg-blue-100 text-blue-800 border-blue-200';
        if (name.includes('mid')) return 'bg-green-100 text-green-800 border-green-200';
        if (name.includes('closing')) return 'bg-purple-100 text-purple-800 border-purple-200';
        if (name.includes('any')) return 'bg-gray-100 text-gray-800 border-gray-200';
        return 'bg-gray-50 text-gray-600 border-gray-100';
    };

    const toggleDay = (day) => {
        setFormData(prev => ({
            ...prev,
            daysOfWeek: prev.daysOfWeek.includes(day)
                ? prev.daysOfWeek.filter(d => d !== day)
                : [...prev.daysOfWeek, day]
        }));
    };

    if (loading) return <div className="p-6">Loading availability...</div>;

    return (
        <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Employee Availability</h2>
                <button
                    onClick={openAddModal}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Add Availability
                </button>
            </div>

            {message.text && (
                <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {message.text}
                </div>
            )}


            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shift</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {availability.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="px-6 py-4 text-center text-gray-500">No availability records found</td>
                            </tr>
                        ) : (
                            availability.map((item) => (
                                <tr key={item._id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{item.employeeName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">{item.type}</td>
                                    <td className="px-6 py-4 text-gray-600">
                                        {item.type === 'WEEKLY' && item.daysOfWeek.join(', ')}
                                        {item.type === 'MONTHLY' && `Monthly (${item.startDate ? new Date(item.startDate).toLocaleDateString() : ''})`}
                                        {item.type === 'INDEFINITE' && 'Indefinite'}
                                        {item.type === 'SPECIFIC_DATES' && item.specificDates.length + ' dates'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getShiftColor(item.shiftType)}`}>
                                            {item.shiftType}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => openEditModal(item)} className="text-blue-600 hover:text-blue-900 mr-4">Edit</button>
                                        <button onClick={() => handleDelete(item._id)} className="text-red-600 hover:text-red-900">Delete</button>
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
                title={editingAvailability ? 'Edit Availability' : 'Add Availability'}
            >
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Employee</label>
                        <select
                            value={formData.employeeName}
                            onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            required
                        >
                            <option value="">Select Employee</option>
                            {employees.map(emp => (
                                <option key={emp._id} value={emp.employeeName}>{emp.employeeName}</option>
                            ))}
                        </select>
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Availability Type</label>
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            required
                        >
                            {types.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>

                    {formData.type === 'WEEKLY' && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Days of Week</label>
                            <div className="flex flex-wrap gap-2">
                                {days.map(day => (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => toggleDay(day)}
                                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${formData.daysOfWeek.includes(day)
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        {day.substring(0, 3)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {formData.type === 'SPECIFIC_DATES' && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Select Dates</label>
                            <div className="flex gap-2 mb-2">
                                <input
                                    type="date"
                                    id="specific-date-input"
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const input = document.getElementById('specific-date-input');
                                        if (input.value && !formData.specificDates.includes(input.value)) {
                                            setFormData({
                                                ...formData,
                                                specificDates: [...formData.specificDates, input.value]
                                            });
                                            input.value = '';
                                        }
                                    }}
                                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                                >
                                    Add
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {formData.specificDates.map(date => (
                                    <span key={date} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                        {date}
                                        <button
                                            type="button"
                                            onClick={() => setFormData({
                                                ...formData,
                                                specificDates: formData.specificDates.filter(d => d !== date)
                                            })}
                                            className="ml-1.5 inline-flex items-center justify-center w-3 h-3 text-gray-400 hover:text-gray-600"
                                        >
                                            ✕
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {(formData.type === 'MONTHLY' || formData.type === 'WEEKLY') && (
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                                <input
                                    type="date"
                                    value={formData.startDate}
                                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">End Date (Optional)</label>
                                <input
                                    type="date"
                                    value={formData.endDate}
                                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>
                        </div>
                    )}

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Shift Preference</label>
                        <input
                            type="text"
                            value={formData.shiftType}
                            onChange={(e) => setFormData({ ...formData, shiftType: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            placeholder="e.g., Opening only, Any, Mid shift"
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            rows="3"
                            placeholder="Any additional information..."
                        ></textarea>
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
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
                            {editingAvailability ? 'Update' : 'Save'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default AvailabilityView;
