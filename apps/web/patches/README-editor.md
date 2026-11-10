# Filerobot 5.0.1 React imports

The published JS in HistoryButtons, TabsResponsive and TabsNavbar calls
React.createElement without importing React. Production error
ImageEditorModal-Dg-HxvOd.js:212:20195 maps directly to HistoryButtons.
The app's TSX uses the automatic JSX runtime; Vite cannot repair already
compiled dependency calls. Removing manualChunks does not fix missing imports.

The version-specific patch adds local imports in all three affected files;
postinstall applies it through the existing patch-package setup. No global
React shim or bundler changes are needed. Remove it only after verifying an
upstream replacement fixes all three modules.

Run `npm run test:editor:production` (install Playwright Chromium first, or set
CHROME_PATH). This builds the real lazy editor with the production Vite config
and tests desktop/mobile, history/tab rendering, curves/levels, local export
and close using a generated image and local save callback. Translation requests
are intercepted locally, and external traffic and writes are blocked.
The unpatched package reproduces ReferenceError: React is not defined; the
patched package passes at 1440px and 390px. This does not test backend saving.
