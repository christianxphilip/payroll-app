import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [account, setAccount] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('checking');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('This password reset link is invalid.');
      setStatus('invalid');
      return;
    }
    authAPI.validateResetToken(token)
      .then((response) => {
        setAccount(response.data);
        setStatus('ready');
      })
      .catch((requestError) => {
        setError(requestError.response?.data?.error || 'This password reset link is invalid or has expired.');
        setStatus('invalid');
      });
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setStatus('submitting');
    try {
      await authAPI.resetPassword(token, password);
      setStatus('complete');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to reset password. Please request a new link.');
      setStatus('ready');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-2xl p-8">
        <h1 className="text-3xl font-bold text-gray-900 text-center">Reset password</h1>
        {status === 'checking' && <p className="text-gray-600 text-center mt-6">Checking your reset link...</p>}
        {status === 'invalid' && (
          <div className="mt-6 text-center">
            <p className="p-3 bg-red-100 text-red-700 rounded">{error}</p>
            <p className="text-sm text-gray-600 mt-4">Ask your administrator to generate a new link.</p>
          </div>
        )}
        {status === 'complete' && (
          <div className="mt-6 text-center">
            <p className="p-3 bg-green-100 text-green-800 rounded">Your password has been reset successfully.</p>
            <Link to="/login" className="inline-block mt-5 text-blue-600 font-semibold hover:underline">Go to login</Link>
          </div>
        )}
        {(status === 'ready' || status === 'submitting') && (
          <form onSubmit={handleSubmit} className="mt-6">
            <p className="text-sm text-gray-600 mb-5">
              Account: <span className="font-semibold text-gray-900">{account?.employeeName}</span>
              {account?.username && <> ({account.username})</>}
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-2">New password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength="8" required className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
            <label className="block text-sm font-medium text-gray-700 mt-4 mb-2">Confirm new password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength="8" required className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
            {error && <div className="mt-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
            <button type="submit" disabled={status === 'submitting'} className="w-full mt-6 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400">
              {status === 'submitting' ? 'Resetting...' : 'Reset password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
