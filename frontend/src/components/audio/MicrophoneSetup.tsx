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

  const { addPlayer, removePlayer, players } = useGameStore();

  useEffect(() => {
    if (permissionGranted) {
      refreshMicrophones();
    }
  }, [permissionGranted, refreshMicrophones]);

  const handleToggleMicrophone = (deviceId: string) => {
    if (selectedMicrophones.includes(deviceId)) {
      deselectMicrophone(deviceId);
      const player = players.find((p) => p.microphoneId === deviceId);
      if (player) {
        removePlayer(player.id);
      }
    } else {
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

      {microphones.length === 0 ? (
        <p className="text-gray-400">No microphones found</p>
      ) : (
        <div className="space-y-2">
          {microphones.map((mic) => (
            <label
              key={mic.deviceId}
              className="flex items-center gap-3 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedMicrophones.includes(mic.deviceId)}
                onChange={() => handleToggleMicrophone(mic.deviceId)}
                className="w-5 h-5 rounded border-gray-600 text-purple-600 focus:ring-purple-500 focus:ring-offset-0 bg-gray-700"
              />
              <span className="text-white">{mic.label}</span>
            </label>
          ))}
        </div>
      )}

      {players.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Players</h3>
          <div className="space-y-1">
            {players.map((player, index) => (
              <div key={player.id} className="text-white">
                Player {index + 1}: {player.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
