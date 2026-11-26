# cd cheffbuild-solar-dimension

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

`npm run dev` starts both the Vite interface and the local Node API.

### Administration du catalogue de prix

The administration page is intentionally unlinked from the main interface. Open `/admin/catalogue` and sign in with the server-side `ADMIN_PASSWORD` environment variable (minimum 12 characters). The password is never sent to or stored in the browser after the login request.

For local development in PowerShell:

```powershell
$env:ADMIN_PASSWORD = "choose-a-long-password"
npm.cmd run dev
```

In production, build the interface and start the Node server in the same deployment:

```powershell
$env:ADMIN_PASSWORD = "choose-a-long-password"
$env:APP_ORIGIN = "https://your-domain.example"
npm.cmd run build
npm.cmd run start
```

The shared catalogue is stored in `server/data/catalogue-prix.json` by default. Configure `CATALOGUE_FILE` to point to a persistent writable volume when deploying; otherwise catalogue edits may be lost when the hosting platform replaces the application instance. Use HTTPS in production.

### Type-Check, Compile and Minify for Production

```sh
npm run build
```
