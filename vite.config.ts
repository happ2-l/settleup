import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // 상대 경로로 빌드해서 GitHub Pages 하위 경로(/settleup/)나 어느 정적 호스팅에서도 열리게
  base: './',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
