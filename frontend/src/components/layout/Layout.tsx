import { Outlet } from "react-router-dom";

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-900 to-black">
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
