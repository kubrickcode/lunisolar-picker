import react from '@astrojs/react';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

export default defineConfig({
  integrations: [
    starlight({
      title: 'lunisolar-picker',
      description: 'Modern, accessible date pickers for React with optional Korean lunisolar calendar support.',
      customCss: ['./src/styles/docs.css'],
      sidebar: [
        { label: 'Start here', items: ['getting-started', 'theming'] },
        {
          label: 'Pickers',
          items: [
            'pickers/date-picker',
            'pickers/date-range-picker',
            'pickers/month-picker',
            'pickers/wheel-date-picker',
            'pickers/wheel-time-picker',
            'pickers/time-picker',
          ],
        },
        {
          label: 'Parts',
          items: ['parts/calendar', 'parts/date-field', 'parts/wheel', 'parts/time-field', 'parts/popover-and-sheet'],
        },
        {
          label: 'Guides',
          items: [
            'guides/customizing-pickers',
            'guides/lunar-calendar',
            'guides/forms',
            'guides/nextjs',
            'guides/accessibility',
            'guides/migrating-from-react-day-picker',
          ],
        },
      ],
    }),
    react(),
  ],
});
