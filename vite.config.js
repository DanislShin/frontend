// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./", // Netlify 또는 정적 서버용
  plugins: [react()],
  server: {
    proxy: {
      "/review": "http://localhost:3000", // 백엔드 프록시
    },
  },
});
