import { defineConfig } from 'bunup';
import { tailwindcss } from '@bunup/plugin-tailwindcss';

export default defineConfig({
        entry: 'src/main.tsx',      // adjust to your entry file
        plugins: [tailwindcss()],
});

