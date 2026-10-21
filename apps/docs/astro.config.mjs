import react from '@astrojs/react';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

export default defineConfig({
  integrations: [
    starlight({
      title: 'lunisolar-picker',
      description: 'Modern, accessible date pickers for React with optional Korean lunisolar calendar support.',
      customCss: ['./src/styles/docs.css'],
      sidebar: [{ label: 'Start here', items: ['getting-started', 'theming'] }],
    }),
    react(),
  ],
});
