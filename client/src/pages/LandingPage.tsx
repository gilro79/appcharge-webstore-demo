import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const sections = [
  {
    to: '/demo',
    title: 'Webstore Demo',
    description: 'Configure players, tiers, offers, and test the full Appcharge integration',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    color: 'from-blue-500 to-blue-600',
    hoverColor: 'hover:from-blue-600 hover:to-blue-700',
  },
  {
    to: '/checkout',
    title: 'Checkout Demo',
    description: 'Preview the live mock webstore with checkout flow',
    icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'from-indigo-500 to-indigo-600',
    hoverColor: 'hover:from-indigo-600 hover:to-indigo-700',
  },
  {
    to: '/tools',
    title: 'Tools',
    description: 'Environment duplication and management utilities',
    icon: 'M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085',
    color: 'from-emerald-500 to-emerald-600',
    hoverColor: 'hover:from-emerald-600 hover:to-emerald-700',
  },
];

export default function LandingPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-8 py-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Appcharge Demo</h1>
          <p className="text-xs text-gray-500">Publisher Backend</p>
        </div>
        {user && (
          <div className="flex items-center gap-3">
            {user.picture && (
              <img
                src={user.picture}
                alt={user.name}
                className="w-7 h-7 rounded-full"
                referrerPolicy="no-referrer"
              />
            )}
            <span className="text-sm text-gray-700">{user.name}</span>
            <button
              onClick={logout}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </header>

      {/* Cards */}
      <div className="flex-1 flex items-center justify-center px-8 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
          {sections.map((section) => (
            <Link
              key={section.to}
              to={section.to}
              className={`group flex flex-col items-center gap-4 p-8 rounded-2xl bg-gradient-to-br ${section.color} ${section.hoverColor} text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-1`}
            >
              <svg className="w-12 h-12 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={section.icon} />
              </svg>
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <p className="text-sm text-white/80 text-center leading-relaxed">{section.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
