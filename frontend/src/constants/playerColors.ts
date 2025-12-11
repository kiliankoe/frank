export interface PlayerColor {
  id: string;
  name: string;
  hex: string;
  tailwind: string;
}

export const PLAYER_COLORS: PlayerColor[] = [
  { id: "red", name: "Red", hex: "#ef4444", tailwind: "bg-red-500" },
  { id: "blue", name: "Blue", hex: "#3b82f6", tailwind: "bg-blue-500" },
  { id: "green", name: "Green", hex: "#22c55e", tailwind: "bg-green-500" },
  { id: "yellow", name: "Yellow", hex: "#eab308", tailwind: "bg-yellow-500" },
];

export function getPlayerColor(colorId: string): PlayerColor {
  return (
    PLAYER_COLORS.find((c) => c.id === colorId) ?? PLAYER_COLORS[0]
  );
}
