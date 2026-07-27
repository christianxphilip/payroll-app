import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { employeeAPI, timesheetAPI } from '../services/api';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    pendingReviews: 0,
    submittedTimesheets: 0,
  });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [employees, pendingTimesheets, submittedTimesheets] = await Promise.all([
        employeeAPI.getAll(),
        timesheetAPI.getAll({ reviewFlag: 'true', isSubmitted: 'false' }),
        timesheetAPI.getAll({ isSubmitted: 'true' }),
      ]);

      setStats({
        totalEmployees: employees.count || 0,
        pendingReviews: pendingTimesheets.count || 0,
        submittedTimesheets: submittedTimesheets.count || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, bgColor, link }) => (
    <Link to={link} className={`${bgColor} rounded-lg shadow-lg p-6 hover:opacity-90 transition-opacity`}>
      <h3 className="text-white text-lg font-semibold mb-2">{title}</h3>
      <p className="text-white text-4xl font-bold">{value}</p>
    </Link>
  );

  const QuickLink = ({ to, title, description }) => (
    <Link
      to={to}
      className="block p-4 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200"
    >
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </Link>
  );

  if (loading) {
    return (
      <div className="px-4 py-6">
        <LoadingSkeleton type="card" />
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <LoadingSkeleton type="card" />
          <LoadingSkeleton type="card" />
          <LoadingSkeleton type="card" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Total Employees"
          value={stats.totalEmployees}
          bgColor="bg-blue-600"
          link="/employees"
        />
        <StatCard
          title="Pending Reviews"
          value={stats.pendingReviews}
          bgColor="bg-yellow-600"
          link="/timesheets?reviewFlag=true"
        />
        <StatCard
          title="Submitted Timesheets"
          value={stats.submittedTimesheets}
          bgColor="bg-green-600"
          link="/timesheets?isSubmitted=true"
        />
      </div>

      {/* Quick Links */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Quick Links</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickLink
            to="/employees"
            title="Manage Employees"
            description="Add, edit, or remove employees"
          />
          <QuickLink
            to="/holidays"
            title="Holiday Management"
            description="Configure regular and special holidays"
          />
          <QuickLink
            to="/schedules"
            title="Schedules"
            description="Upload and manage employee schedules"
          />
          <QuickLink
            to="/timesheets"
            title="Timesheets"
            description="Log and review employee time entries"
          />
          {user?.role === 'admin' ? (
            <QuickLink
              to="/payroll"
              title="Payroll Report"
              description="Generate consolidated payroll reports"
            />
          ) : (
            <QuickLink
              to="/reports"
              title="Timesheet Reports"
              description="Generate hours-focused timesheet reports"
            />
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-xl font-bold text-blue-900 mb-3">Getting Started</h2>
        <ol className="list-decimal list-inside space-y-2 text-blue-800">
          <li>Add employees to the system</li>
          <li>Configure holidays (regular and special)</li>
          <li>Upload weekly schedule CSV files or manually enter schedules</li>
          <li>Log timesheet entries (time in/out)</li>
          <li>Review flagged timesheets and apply batch adjustments</li>
          <li>Generate payroll reports and export to CSV</li>
        </ol>
      </div>
    </div>
  );
};

export default Dashboard;

