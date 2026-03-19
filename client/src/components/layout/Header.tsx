import { useActivePlayer } from '../../context/ActivePlayerContext';

export default function Header() {
  const { players, activePlayer, setActivePlayer } = useActivePlayer();

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="text-sm text-gray-500">
        Publisher Dashboard
      </div>
      <div className="flex items-center gap-4">
        <label className="text-sm text-gray-600">Active Player:</label>
        <select
          className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          value={activePlayer?.id || ''}
          onChange={(e) => setActivePlayer(e.target.value)}
        >
          <option value="" disabled>Select player...</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.playerName} ({p.publisherPlayerId})
            </option>
          ))}
        </select>
        {activePlayer && (
          <img
            src={activePlayer.playerProfileImage}
            alt={activePlayer.playerName}
            className="w-8 h-8 rounded-full border-2 border-primary-300"
          />
        )}
      </div>
    </header>
  );
}
