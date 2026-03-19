import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../hooks/api';
import type { Player } from 'shared/types';

interface ActivePlayerContextType {
  players: Player[];
  activePlayer: Player | null;
  setActivePlayer: (id: string) => Promise<void>;
  refreshPlayers: () => Promise<void>;
}

const ActivePlayerContext = createContext<ActivePlayerContextType>({
  players: [],
  activePlayer: null,
  setActivePlayer: async () => {},
  refreshPlayers: async () => {},
});

export function ActivePlayerProvider({ children }: { children: React.ReactNode }) {
  const [players, setPlayers] = useState<Player[]>([]);

  const refreshPlayers = useCallback(async () => {
    try {
      const data = await api.getPlayers();
      setPlayers(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refreshPlayers();
  }, [refreshPlayers]);

  const activePlayer = players.find((p) => p.isActive) || null;

  const setActivePlayer = async (id: string) => {
    await api.activatePlayer(id);
    await refreshPlayers();
  };

  return (
    <ActivePlayerContext.Provider value={{ players, activePlayer, setActivePlayer, refreshPlayers }}>
      {children}
    </ActivePlayerContext.Provider>
  );
}

export function useActivePlayer() {
  return useContext(ActivePlayerContext);
}
