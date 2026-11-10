# Nexora AI - Frontend Client

This package contains the single-page React 19 application for **Nexora AI**, powered by Vite 7 and Tailwind CSS v4.

## Key Features & Structure

- **Authentication**: Powered by `@clerk/react` with sign-in modals, profile management, and billing pricing tables.
- **API Client**: Centralized Axios instance at `src/services/api.js` with automatic Bearer token injection and 401 error interception.
- **Pages**:
  - `Home`: Marketing landing page with hero CTA, interactive AI tools grid, testimonials, and plan comparison.
  - `Dashboard`: User generation metrics, plan tier indicator, and recent creation history.
  - `WriteArticle`: Long-form article generator with word count selector and Markdown preview.
  - `BlogTitles`: SEO blog title ideation across 8 industry categories.
  - `GenerateImages`: Text-to-image synthesis with style selection and community publishing toggle.
  - `RemoveBackground`: Image background remover with transparent checkerboard preview.
  - `ReviewResume`: Dual-purpose career suite with AI resume critique and grounded RAG conversational assistant.
  - `Community`: Public creation showcase with likes and feed caching.

## Local Development

```bash
# Install dependencies from monorepo root or inside client/
npm install

# Start Vite dev server on http://localhost:5173
npm run dev

# Run production build
npm run build

# Run ESLint check
npm run lint
```

## Environment Configuration

Configure `client/.env` based on `client/.env.example`:

- `VITE_CLERK_PUBLISHABLE_KEY`: Clerk publishable API key (`pk_test_...`)
- `VITE_BASE_URL`: Express backend origin (e.g., `http://localhost:3000`)
