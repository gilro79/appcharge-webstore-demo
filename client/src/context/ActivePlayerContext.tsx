import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../hooks/api';
import type { Player } from 'shared/types';

interface PlayersContextType {
  players: Player[];
  refreshPlayers: () => Promise<void>;
}

const PlayersContext = createContext<PlayersContextType>({
  players: [],
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

  return (
    <PlayersContext.Provider value={{ players, refreshPlayers }}>
      {children}
    </PlayersContext.Provider>
  );
}

export function useActivePlayer() {
  return useContext(PlayersContext);
}
