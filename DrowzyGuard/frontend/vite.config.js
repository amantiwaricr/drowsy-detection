import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // must match FRONTEND_ORIGIN in backend/.env
    strictPort: true,
  },
});
