import { useState, useEffect } from 'react';
import { useActivePlayer } from '../context/ActivePlayerContext';
import { api } from '../hooks/api';
import type { Player } from 'shared/types';

function PlayerForm({ player, onSave, onCancel }: {
  player?: Player;
  onSave: (data: Partial<Player>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    publisherPlayerId: player?.publisherPlayerId || '',
    playerName: player?.playerName || '',
    playerProfileImage: player?.playerProfileImage || '',
    description: player?.description || '',
    sessionMetadata: JSON.stringify(player?.sessionMetadata || {}, null, 2),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      onSave({
        publisherPlayerId: form.publisherPlayerId,
        playerName: form.playerName,
        playerProfileImage: form.playerProfileImage,
        description: form.description,
        sessionMetadata: JSON.parse(form.sessionMetadata),
      });
    } catch {
      alert('Invalid JSON in session metadata');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Player Name</label>
        <input
          type="text"
          value={form.playerName}
          onChange={(e) => setForm({ ...form, playerName: e.target.value })}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Publisher Player ID</label>
        <input
          type="text"
          value={form.publisherPlayerId}
          onChange={(e) => setForm({ ...form, publisherPlayerId: e.target.value })}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Profile Image URL</label>
        <input
          type="text"
          value={form.playerProfileImage}
          onChange={(e) => setForm({ ...form, playerProfileImage: e.target.value })}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <input
          type="text"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Session Metadata (JSON)</label>
        <textarea
          value={form.sessionMetadata}
          onChange={(e) => setForm({ ...form, sessionMetadata: e.target.value })}
          rows={4}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 text-sm text-white bg-primary-600 rounded-md hover:bg-primary-700">
          {player ? 'Update' : 'Create'} Player
        </button>
      </div>
    </form>
  );
}

export default function PlayersPage() {
  const { players, refreshPlayers, activePlayer, setActivePlayer } = useActivePlayer();
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handleCreate = async (data: Partial<Player>) => {
    await api.createPlayer(data);
    await refreshPlayers();
    setShowForm(false);
  };

  const handleUpdate = async (data: Partial<Player>) => {
    if (!editingPlayer) return;
    await api.updatePlayer(editingPlayer.id, data);
    await refreshPlayers();
    setEditingPlayer(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this player?')) return;
    await api.deletePlayer(id);
    await refreshPlayers();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Players</h1>
          <p className="text-gray-500 mt-1">Manage player profiles for Appcharge auth responses</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingPlayer(null); }}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 text-sm font-medium"
        >
          + Add Player
        </button>
      </div>

      {(showForm || editingPlayer) && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">
            {editingPlayer ? `Edit ${editingPlayer.playerName}` : 'New Player'}
          </h2>
          <PlayerForm
            player={editingPlayer || undefined}
            onSave={editingPlayer ? handleUpdate : handleCreate}
            onCancel={() => { setShowForm(false); setEditingPlayer(null); }}
          />
        </div>
      )}

      <div className="grid gap-4">
        {players.map((player) => (
          <div
            key={player.id}
            className={`bg-white rounded-lg shadow-sm border p-5 ${
              player.isActive ? 'border-primary-400 ring-1 ring-primary-200' : 'border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <img
                  src={player.playerProfileImage}
                  alt={player.playerName}
                  className="w-12 h-12 rounded-full border-2 border-gray-200"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{player.playerName}</h3>
                    {player.isActive && (
                      <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full font-medium">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 font-mono">ID: {player.publisherPlayerId}</p>
                  {player.description && (
                    <p className="text-sm text-gray-500 mt-1">{player.description}</p>
                  )}
                  <div className="mt-2">
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                      metadata: {JSON.stringify(player.sessionMetadata)}
                    </code>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {!player.isActive && (
                  <button
                    onClick={() => setActivePlayer(player.id)}
                    className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                  >
                    Set Active
                  </button>
                )}
                <button
                  onClick={() => { setEditingPlayer(player); setShowForm(false); }}
                  className="text-xs text-gray-600 hover:text-gray-800 font-medium"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(player.id)}
                  className="text-xs text-red-600 hover:text-red-800 font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
