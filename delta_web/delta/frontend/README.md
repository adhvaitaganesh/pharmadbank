# Frontend Design

This document describes the design and architecture of the frontend application within the Delta project.

## Overview

The frontend is a React-based Single Page Application (SPA). It is integrated directly into the Django backend structure rather than being hosted as a standalone service.

## Hosting & Serving

-   **Hosting**: The frontend application is compiled into static files (JavaScript and CSS bundles). These files are hosted by the Django backend.
-   **Serving**:
    -   In development, Django's static file serving mechanism handles requests for the frontend assets.
    -   In production, `WhiteNoise` (configured in `settings.py`) is used to serve these static files efficiently.
    -   The main entry point is `index.html` (rendered by a Django view), which loads the compiled React bundle.

## Port Configuration

-   **Port**: The frontend does **not** run on a separate port (e.g., 3000). It is served from the same port as the Django backend (default `8000`).
-   There is no `webpack-dev-server` configured. The `npm run dev` script uses Webpack in watch mode to rebuild files upon changes, but it does not start a web server.

## NPM & Build Process

The frontend build process is managed via `npm` scripts defined in `package.json`:

-   **`npm run dev`**: Runs Webpack in development mode with the `--watch` flag. This watches for changes in `src/` and rebuilds the bundle to `static/frontend/main.js`.
-   **`npm run build`**: Runs Webpack in production mode to create an optimized bundle in `static/frontend/main.js`.

## File Structure

-   `src/`: Contains the React source code.
-   `static/frontend/`: The destination for compiled bundles (`main.js`).
-   `templates/frontend/`: Contains the `index.html` template served by Django.
-   `webpack.config.js`: Configuration for the Webpack bundler.
