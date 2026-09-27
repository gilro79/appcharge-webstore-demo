import { useState, useEffect } from 'react';
import { useActivePlayer } from '../context/ActivePlayerContext';
import { api } from '../hooks/api';
import type { Player, Tier, Balance } from 'shared/types';

const TIERS = [
  { id: 'tier-diamond', name: 'Diamond' },
  { id: 'tier-gold', name: 'Gold' },
  { id: 'tier-bronze', name: 'Bronze' },
];

function randomQty() {
  return Math.floor(Math.random() * 9901) + 100; // 100–10000
}

function PlayerForm({ player, onSave, onCancel, productIds }: {
  player?: Player;
  onSave: (data: Partial<Player>) => void;
  onCancel: () => void;
  productIds: string[];
}) {
  const defaultBalances = (): Balance[] => {
    if (player?.balances?.length) return player.balances;
    // Default: first 2 products with random quantities
    return productIds.slice(0, 2).map((id) => ({
      publisherProductId: id,
      quantity: randomQty(),
    }));
  };

  const [form, setForm] = useState({
    publisherPlayerId: player?.publisherPlayerId || '',
    playerName: player?.playerName || '',
    playerProfileImage: player?.playerProfileImage || '',
    description: player?.description || '',
    tierId: player?.tierId || 'tier-bronze',
    sessionMetadata: JSON.stringify(player?.sessionMetadata || {}, null, 2),
  });
  const [balances, setBalances] = useState<Balance[]>(defaultBalances);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      onSave({
        publisherPlayerId: form.publisherPlayerId,
        playerName: form.playerName,
        playerProfileImage: form.playerProfileImage,
        description: form.description,
        tierId: form.tierId,
        sessionMetadata: JSON.parse(form.sessionMetadata),
        balances,
      });
    } catch {
      alert('Invalid JSON in session metadata');
    }
  };

  const updateBalance = (index: number, field: keyof Balance, value: string | number) => {
    setBalances((prev) => prev.map((b, i) => i === index ? { ...b, [field]: value } : b));
  };

  const removeBalance = (index: number) => {
    setBalances((prev) => prev.filter((_, i) => i !== index));
  };

  const addBalance = () => {
    const used = new Set(balances.map((b) => b.publisherProductId));
    const next = productIds.find((id) => !used.has(id)) || productIds[0] || '';
    setBalances((prev) => [...prev, { publisherProductId: next, quantity: randomQty() }]);
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
          {TIERS.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Balances */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Balances</label>
        <div className="space-y-2">
          {balances.map((bal, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <select
                value={bal.publisherProductId}
                onChange={(e) => updateBalance(idx, 'publisherProductId', e.target.value)}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {productIds.map((pid) => (
                  <option key={pid} value={pid}>{pid}</option>
                ))}
              </select>
              <input
                type="number"
                value={bal.quantity}
                onChange={(e) => updateBalance(idx, 'quantity', Number(e.target.value))}
                className="w-28 border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                min={0}
              />
              <button
                type="button"
                onClick={() => removeBalance(idx)}
                className="text-red-500 hover:text-red-700 text-sm font-medium px-2"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        {productIds.length > 0 && (
          <button
            type="button"
            onClick={addBalance}
            className="mt-2 text-sm text-primary-600 hover:text-primary-800 font-medium"
          >
            + Add Balance
          </button>
        )}
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
  const { players, refreshPlayers } = useActivePlayer();
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [productIds, setProductIds] = useState<string[]>([]);

  useEffect(() => {
    api.getTiers().then((tiers: Tier[]) => {
      const ids = new Set<string>();
      for (const t of tiers) {
        for (const col of t.productColumns) ids.add(col);
      }
      setProductIds(Array.from(ids).sort());
    });
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
            key={editingPlayer?.id || 'new'}
            player={editingPlayer || undefined}
            onSave={editingPlayer ? handleUpdate : handleCreate}
            onCancel={() => { setShowForm(false); setEditingPlayer(null); }}
            productIds={productIds}
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
                        player.tierId === 'tier-diamond' ? 'bg-blue-100 text-blue-800' :
                        player.tierId === 'tier-gold' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {TIERS.find((t) => t.id === player.tierId)?.name || player.tierId}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 font-mono">ID: {player.publisherPlayerId}</p>
                  {player.description && (
                    <p className="text-sm text-gray-500 mt-1">{player.description}</p>
                  )}
                  {player.balances && player.balances.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {player.balances.map((b) => (
                        <span
                          key={b.publisherProductId}
                          className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded-md border border-green-200"
                        >
                          <span className="font-medium">{b.publisherProductId}:</span>
                          <span className="font-mono">{b.quantity.toLocaleString()}</span>
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
