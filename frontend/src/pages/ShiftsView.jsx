import { useState, useEffect } from 'react';
import { shiftAPI } from '../services/api';
import Modal from '../components/Modal';

const ShiftsView = () => {
    const [shifts, setShifts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingShift, setEditingShift] = useState(null);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [formData, setFormData] = useState({
        name: '',
        startTime: '',
        endTime: '',
        daysOfWeek: [],
        isDefault: false
    });

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    useEffect(() => {
        fetchShifts();
    }, []);

    const fetchShifts = async () => {
        try {
            const response = await shiftAPI.getAll();
            setShifts(response.data || []);
        } catch (error) {
            showMessage('error', 'Failed to fetch shifts');
        } finally {
            setLoading(false);
        }
    };

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    };

    const openAddModal = () => {
        setEditingShift(null);
        setFormData({
            name: '',
            startTime: '',
            endTime: '',
            daysOfWeek: [],
            isDefault: false
        });
        setIsModalOpen(true);
    };

    const openEditModal = (shift) => {
        setEditingShift(shift);
        setFormData({
            name: shift.name,
            startTime: shift.startTime,
            endTime: shift.endTime,
            daysOfWeek: shift.daysOfWeek || [],
            isDefault: shift.isDefault || false
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingShift) {
                await shiftAPI.update(editingShift._id, formData);
                showMessage('success', 'Shift updated successfully');
            } else {
                await shiftAPI.create(formData);
                showMessage('success', 'Shift created successfully');
            }
            setIsModalOpen(false);
            fetchShifts();
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Operation failed');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this shift?')) return;
        try {
            await shiftAPI.delete(id);
            showMessage('success', 'Shift deleted successfully');
            fetchShifts();
        } catch (error) {
            showMessage('error', 'Failed to delete shift');
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

    if (loading) return <div className="p-6">Loading shifts...</div>;

    return (
        <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Shift Guides</h2>
                <button
                    onClick={openAddModal}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Add Shift
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
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {shifts.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="px-6 py-4 text-center text-gray-500">No shifts configured</td>
                            </tr>
                        ) : (
                            shifts.map((shift) => (
                                <tr key={shift._id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getShiftColor(shift.name)}`}>
                                            {shift.name}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                                        {shift.startTime} - {shift.endTime}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">
                                        {shift.daysOfWeek.length === 7 ? 'Everyday' :
                                            shift.daysOfWeek.length === 0 ? 'Not set' :
                                                shift.daysOfWeek.join(', ')}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => openEditModal(shift)} className="text-blue-600 hover:text-blue-900 mr-4">Edit</button>
                                        <button onClick={() => handleDelete(shift._id)} className="text-red-600 hover:text-red-900">Delete</button>
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
                title={editingShift ? 'Edit Shift' : 'Add Shift'}
            >
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Shift Name</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            placeholder="e.g., Opening"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                            <input
                                type="text"
                                value={formData.startTime}
                                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                placeholder="e.g., 2PM"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                            <input
                                type="text"
                                value={formData.endTime}
                                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                placeholder="e.g., 11PM"
                                required
                            />
                        </div>
                    </div>
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
                            {editingShift ? 'Update' : 'Save'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default ShiftsView;
