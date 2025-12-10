import { useEffect } from "react";
import { useAudioStore, useGameStore } from "../../stores";

export function MicrophoneSetup() {
  const {
    microphones,
    selectedMicrophones,
    permissionGranted,
    requestMicrophonePermission,
    refreshMicrophones,
    selectMicrophone,
    deselectMicrophone,
  } = useAudioStore();

  const { song, addPlayer, removePlayer, players } = useGameStore();

  // Check if this is a duet song
  const isDuet = Boolean(song?.notes_p2 && song.notes_p2.length > 0);
  const maxPlayers = isDuet ? 2 : 4; // Limit duets to 2 players
  const canAddMore = selectedMicrophones.length < maxPlayers;

  useEffect(() => {
    if (permissionGranted) {
      refreshMicrophones();
    }
  }, [permissionGranted, refreshMicrophones]);

  // Recreate players for pre-selected microphones when mounting
  useEffect(() => {
    if (permissionGranted && microphones.length > 0) {
      for (const deviceId of selectedMicrophones) {
        // Read current state directly from store to avoid stale closure issues
        // (React StrictMode double-invokes effects before re-render occurs)
        const currentPlayers = useGameStore.getState().players;
        const hasPlayer = currentPlayers.some((p) => p.microphoneId === deviceId);
        if (!hasPlayer) {
          const mic = microphones.find((m) => m.deviceId === deviceId);
          addPlayer(mic?.label || "Player", deviceId);
        }
      }
    }
  }, [permissionGranted, microphones, selectedMicrophones, addPlayer]);

  const handleToggleMicrophone = (deviceId: string) => {
    if (selectedMicrophones.includes(deviceId)) {
      deselectMicrophone(deviceId);
      const player = players.find((p) => p.microphoneId === deviceId);
      if (player) {
        removePlayer(player.id);
      }
    } else if (canAddMore) {
      selectMicrophone(deviceId);
      const mic = microphones.find((m) => m.deviceId === deviceId);
      addPlayer(mic?.label || "Player", deviceId);
    }
  };

  if (!permissionGranted) {
    return (
      <div className="bg-white/5 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">
          Microphone Setup
        </h2>
        <p className="text-gray-400 mb-4">
          Grant microphone permission to start singing
        </p>
        <button
          type="button"
          onClick={requestMicrophonePermission}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Enable Microphone
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white/5 rounded-lg p-6">
      <h2 className="text-xl font-semibold text-white mb-4">
        Select Microphones
      </h2>

      {isDuet && (
        <p className="text-pink-400 text-sm mb-4">
          Duet mode: Select exactly 2 microphones
        </p>
      )}

      {microphones.length === 0 ? (
        <p className="text-gray-400">No microphones found</p>
      ) : (
        <div className="space-y-2">
          {microphones.map((mic) => {
            const isSelected = selectedMicrophones.includes(mic.deviceId);
            const isDisabled = !isSelected && !canAddMore;

            return (
              <label
                key={mic.deviceId}
                className={`flex items-center gap-3 p-3 bg-white/5 rounded-lg transition-colors ${
                  isDisabled
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer hover:bg-white/10"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggleMicrophone(mic.deviceId)}
                  disabled={isDisabled}
                  className="w-5 h-5 rounded border-gray-600 text-purple-600 focus:ring-purple-500 focus:ring-offset-0 bg-gray-700 disabled:opacity-50"
                />
                <span className="text-white">{mic.label}</span>
              </label>
            );
          })}
        </div>
      )}

      {players.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Players</h3>
          <div className="space-y-1">
            {players.map((player, index) => (
              <div
                key={player.id}
                className="text-white flex items-center gap-2"
              >
                <span
                  className={`w-3 h-3 rounded-full ${
                    index === 0 ? "bg-purple-500" : "bg-pink-500"
                  }`}
                />
                {isDuet
                  ? `${index === 0 ? (song?.metadata.duet_singer_p1 ?? "P1") : (song?.metadata.duet_singer_p2 ?? "P2")}: ${player.name}`
                  : `Player ${index + 1}: ${player.name}`}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
