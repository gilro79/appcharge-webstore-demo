import { useState, useEffect } from 'react';
import { useActivePlayer } from '../context/ActivePlayerContext';
import { api } from '../hooks/api';
import type { Player, Tier } from 'shared/types';

function PlayerForm({ player, tiers, onSave, onCancel }: {
  player?: Player;
  tiers: { id: string; name: string }[];
  onSave: (data: Partial<Player>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    publisherPlayerId: player?.publisherPlayerId || '',
    playerName: player?.playerName || '',
    playerProfileImage: player?.playerProfileImage || '',
    description: player?.description || '',
    tierId: player?.tierId || (tiers[0]?.id || ''),
    sessionMetadata: JSON.stringify(player?.sessionMetadata || {}, null, 2),
    balances: { ...(player?.balances || {}) } as Record<string, number>,
  });

  // Fetch products for balance editing
  const [products, setProducts] = useState<{ publisherProductId: string; name?: string }[]>([]);
  useEffect(() => {
    api.getProducts().then((data) => {
      const list = Array.isArray(data) ? data : [];
      setProducts(list.map((p: any) => ({ publisherProductId: p.publisherProductId, name: p.name })));
    }).catch(() => {});
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Clean up balances: remove zero-value entries
      const cleanBalances: Record<string, number> = {};
      for (const [k, v] of Object.entries(form.balances)) {
        if (v > 0) cleanBalances[k] = v;
      }
      onSave({
        publisherPlayerId: form.publisherPlayerId,
        playerName: form.playerName,
        playerProfileImage: form.playerProfileImage,
        description: form.description,
        tierId: form.tierId,
        sessionMetadata: JSON.parse(form.sessionMetadata),
        balances: Object.keys(cleanBalances).length > 0 ? cleanBalances : undefined,
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Tier</label>
        <select
          value={form.tierId}
          onChange={(e) => setForm({ ...form, tierId: e.target.value })}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          {tiers.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
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
      {/* Balances */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Balances</label>
        <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-2">
          {products.map((p) => (
            <div key={p.publisherProductId} className="flex items-center gap-2">
              <span className="text-sm text-gray-600 w-40 truncate" title={p.publisherProductId}>
                {p.name || p.publisherProductId}
              </span>
              <input
                type="number"
                min={0}
                value={form.balances[p.publisherProductId] ?? 0}
                onChange={(e) => {
                  setForm({
                    ...form,
                    balances: { ...form.balances, [p.publisherProductId]: parseInt(e.target.value) || 0 },
                  });
                }}
                className="border border-gray-300 rounded-md px-2 py-1 text-sm w-24 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          ))}
          {products.length === 0 && (
            <p className="text-xs text-gray-400">No products found. Configure a publisher token to load products.</p>
          )}
        </div>
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
  const { players, refreshPlayers } = useActivePlayer();
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [tiers, setTiers] = useState<{ id: string; name: string }[]>([]);

  // Fetch tiers from the API
  useEffect(() => {
    api.getTiers().then((data: Tier[]) => {
      setTiers(data.map((t) => ({ id: t.id, name: t.name })));
    }).catch(() => {});
  }, []);

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
            tiers={tiers}
            onSave={editingPlayer ? handleUpdate : handleCreate}
            onCancel={() => { setShowForm(false); setEditingPlayer(null); }}
          />
        </div>
      )}

      <div className="grid gap-4">
        {players.map((player) => (
          <div
            key={player.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-5"
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
                    {player.tierId && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        player.tierId.includes('diamond') ? 'bg-blue-100 text-blue-800' :
                        player.tierId.includes('gold') ? 'bg-yellow-100 text-yellow-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {tiers.find((t) => t.id === player.tierId)?.name || player.tierId}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 font-mono">ID: {player.publisherPlayerId}</p>
                  {player.description && (
                    <p className="text-sm text-gray-500 mt-1">{player.description}</p>
                  )}
                  {/* Balances */}
                  {player.balances && Object.keys(player.balances).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {Object.entries(player.balances).map(([productId, qty]) => (
                        <span
                          key={productId}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800"
                        >
                          {productId}: {qty}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-2">
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                      metadata: {JSON.stringify(player.sessionMetadata)}
                    </code>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
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
