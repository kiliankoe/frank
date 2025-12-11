import { useEffect, useRef, useState } from "react";
import { useAudioStore, type MicrophoneInput } from "../../stores";
import { PLAYER_COLORS, getPlayerColor } from "../../constants/playerColors";

/**
 * Hook to monitor audio levels for microphone inputs.
 * Handles both mono devices and individual stereo channels.
 */
function useMicLevels(inputs: MicrophoneInput[], isOpen: boolean) {
  const [levels, setLevels] = useState<Map<string, number>>(new Map());
  const streamsRef = useRef<Map<string, MediaStream>>(new Map());
  const analysersRef = useRef<Map<string, AnalyserNode>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isSetupRef = useRef(false);

  useEffect(() => {
    if (!isOpen || inputs.length === 0) {
      return;
    }

    // Skip if already set up (React StrictMode double-invocation)
    if (isSetupRef.current && analysersRef.current.size > 0) {
      return;
    }

    let isCancelled = false;
    isSetupRef.current = true;

    const setupMics = async () => {
      // Create audio context if needed
      if (
        !audioContextRef.current ||
        audioContextRef.current.state === "closed"
      ) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;

      // Resume audio context (required after user interaction)
      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      // Group inputs by deviceId to share streams for stereo devices
      const deviceInputs = new Map<string, MicrophoneInput[]>();
      for (const input of inputs) {
        const existing = deviceInputs.get(input.deviceId) ?? [];
        existing.push(input);
        deviceInputs.set(input.deviceId, existing);
      }

      // Connect to each device and set up analysers for each channel
      for (const [deviceId, deviceChannels] of deviceInputs) {
        if (isCancelled) return;
        if (streamsRef.current.has(deviceId)) continue;

        try {
          // Request stereo if any channel needs it
          const needsStereo = deviceChannels.some((c) => c.channel !== "mono");
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: { ideal: deviceId },
              channelCount: needsStereo ? { ideal: 2 } : undefined,
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            },
          });

          if (isCancelled) {
            for (const track of stream.getTracks()) {
              track.stop();
            }
            return;
          }
          streamsRef.current.set(deviceId, stream);

          const source = ctx.createMediaStreamSource(stream);

          if (needsStereo) {
            // Create channel splitter for stereo devices
            const splitter = ctx.createChannelSplitter(2);
            source.connect(splitter);

            // Set up analyser for each channel
            for (const input of deviceChannels) {
              const analyser = ctx.createAnalyser();
              analyser.fftSize = 256;
              analyser.smoothingTimeConstant = 0.3;

              const channelIndex = input.channel === "left" ? 0 : 1;
              const gainNode = ctx.createGain();
              gainNode.channelCount = 1;
              gainNode.channelCountMode = "explicit";
              splitter.connect(gainNode, channelIndex);
              gainNode.connect(analyser);

              analysersRef.current.set(input.inputId, analyser);
            }
          } else {
            // Mono device: connect directly
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.3;
            source.connect(analyser);
            analysersRef.current.set(deviceChannels[0].inputId, analyser);
          }
        } catch (err) {
          console.error(`Failed to connect to mic ${deviceId}:`, err);
        }
      }

      if (isCancelled) return;

      // Start animation loop to read levels
      const updateLevels = () => {
        if (isCancelled) return;

        const newLevels = new Map<string, number>();

        for (const [inputId, analyser] of analysersRef.current) {
          const dataArray = new Float32Array(analyser.fftSize);
          analyser.getFloatTimeDomainData(dataArray);

          // Calculate RMS level
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i] * dataArray[i];
          }
          const rms = Math.sqrt(sum / dataArray.length);
          const level = Math.min(1, rms * 5);

          newLevels.set(inputId, level);
        }

        setLevels(newLevels);
        animationFrameRef.current = requestAnimationFrame(updateLevels);
      };

      updateLevels();
    };

    setupMics();

    return () => {
      isCancelled = true;

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      for (const stream of streamsRef.current.values()) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
      }
      streamsRef.current.clear();
      analysersRef.current.clear();
      isSetupRef.current = false;

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [isOpen, inputs]);

  return levels;
}

interface MicSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MicSettingsModal({ isOpen, onClose }: MicSettingsModalProps) {
  const {
    microphoneInputs,
    micAssignments,
    permissionGranted,
    requestMicrophonePermission,
    refreshMicrophones,
    assignMicColor,
    unassignMic,
    getColorByMic,
  } = useAudioStore();

  const levels = useMicLevels(microphoneInputs, isOpen);

  useEffect(() => {
    if (isOpen && permissionGranted) {
      refreshMicrophones();
    }
  }, [isOpen, permissionGranted, refreshMicrophones]);

  const handleColorClick = (inputId: string, colorId: string) => {
    const currentColor = getColorByMic(inputId);
    if (currentColor === colorId) {
      // Clicking same color unassigns
      unassignMic(inputId);
    } else {
      assignMicColor(inputId, colorId);
    }
  };

  const getAssignedColor = (inputId: string): string | undefined => {
    return micAssignments.find((a) => a.inputId === inputId)?.colorId;
  };

  const isColorAssigned = (colorId: string): string | undefined => {
    return micAssignments.find((a) => a.colorId === colorId)?.inputId;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white">
            Microphone Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {!permissionGranted ? (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4">
              Grant microphone permission to configure your mics
            </p>
            <button
              type="button"
              onClick={requestMicrophonePermission}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Enable Microphone
            </button>
          </div>
        ) : microphoneInputs.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No microphones found</p>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm mb-4">
              Assign a color to each microphone. Speak into a mic to see its
              level. Stereo devices (like Singstar mics) show separate
              left/right channels.
            </p>

            {microphoneInputs.map((input) => {
              const level = levels.get(input.inputId) ?? 0;
              const assignedColor = getAssignedColor(input.inputId);

              return (
                <div key={input.inputId} className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    {assignedColor && (
                      <span
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: getPlayerColor(assignedColor).hex,
                        }}
                      />
                    )}
                    <span className="text-white text-sm truncate flex-1">
                      {input.label}
                    </span>
                    {input.channel !== "mono" && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          input.channel === "left"
                            ? "bg-blue-500/20 text-blue-300"
                            : "bg-red-500/20 text-red-300"
                        }`}
                      >
                        {input.channel === "left" ? "L" : "R"}
                      </span>
                    )}
                  </div>

                  {/* Audio level meter */}
                  <div className="h-2 bg-gray-700 rounded-full mb-3 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-75"
                      style={{ width: `${level * 100}%` }}
                    />
                  </div>

                  {/* Color buttons */}
                  <div className="flex gap-2">
                    {PLAYER_COLORS.map((color) => {
                      const isThisMicColor = assignedColor === color.id;
                      const assignedToOther = isColorAssigned(color.id);
                      const isUsedByOther =
                        assignedToOther && assignedToOther !== input.inputId;

                      return (
                        <button
                          key={color.id}
                          type="button"
                          onClick={() =>
                            handleColorClick(input.inputId, color.id)
                          }
                          className={`w-10 h-10 rounded-full transition-all ${
                            isThisMicColor
                              ? "ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110"
                              : isUsedByOther
                                ? "opacity-30"
                                : "hover:scale-110"
                          }`}
                          style={{ backgroundColor: color.hex }}
                          title={`${color.name}${isUsedByOther ? " (assigned to another mic)" : ""}`}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Summary of assignments */}
            {micAssignments.length > 0 && (
              <div className="mt-6 pt-4 border-t border-white/10">
                <h3 className="text-sm font-medium text-gray-400 mb-2">
                  Active Players
                </h3>
                <div className="flex gap-3">
                  {micAssignments.map((assignment) => {
                    const color = getPlayerColor(assignment.colorId);
                    return (
                      <div
                        key={assignment.colorId}
                        className="flex items-center gap-2 bg-white/5 rounded-full px-3 py-1"
                      >
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: color.hex }}
                        />
                        <span className="text-white text-sm">{color.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
