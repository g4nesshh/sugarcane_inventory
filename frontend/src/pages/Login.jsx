import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../api/client';

const field =
  'mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cane-500 focus:border-cane-500';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cane-700 p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded border border-cane-600/20 p-8 space-y-5">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink-900">Sugar Factory</h1>
          <p className="text-sm text-ink-500 mt-0.5">Inventory Management System</p>
        </div>
        <label className="block text-sm font-medium text-ink-700">
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
        </label>
        <label className="block text-sm font-medium text-ink-700">
          Password
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
        </label>
        <button
          disabled={busy}
          className="w-full rounded bg-cane-500 py-2.5 text-sm font-semibold text-white hover:bg-cane-600 disabled:opacity-60 transition-colors"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
