import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function WebstorePreviewPage() {
  const { user, logout } = useAuth();

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Standalone header */}
      <header className="h-14 flex-shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-gray-700 transition-colors" title="Back to Home">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </Link>
          <span className="text-sm font-medium text-gray-700">Checkout Demo</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://appcharge-mock-webstore.onrender.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            Open in new tab
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          {user && (
            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-gray-200">
              {user.picture && (
                <img src={user.picture} alt={user.name} className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
              )}
              <span className="text-sm text-gray-700">{user.name}</span>
              <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">Sign out</button>
            </div>
          )}
        </div>
      </header>

      {/* Iframe */}
      <div className="flex-1 p-4">
        <iframe
          src="https://appcharge-mock-webstore.onrender.com/"
          className="w-full h-full rounded-lg border border-gray-200 bg-gray-900"
          title="Mock Webstore"
          allow="payment"
        />
      </div>
    </div>
  );
}
