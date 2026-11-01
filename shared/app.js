// app.js — PhuzzBox as an app of its own: registers the service worker (../sw.js, which keeps a
// copy of every file so the app opens without the server) and shows an Install button where the
// browser offers installing (Chrome and Edge; on a Mac, the app gets its own window and Dock icon).

const root = new URL('../', import.meta.url);

export function registerApp() {
  if (!('serviceWorker' in navigator) || !isSecureContext) return;
  navigator.serviceWorker.register(new URL('sw.js', root), { scope: root.pathname }).catch(() => {});
}

export const installed = () => matchMedia('(display-mode: standalone)').matches;

// `button` is shown when the browser will install, and hidden again once it has
export function offerInstall(button) {
  let prompt = null;
  button.hidden = true;
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); prompt = e; button.hidden = installed(); });
  addEventListener('appinstalled', () => { prompt = null; button.hidden = true; });
  button.addEventListener('click', async () => { if (!prompt) return; prompt.prompt(); await prompt.userChoice; prompt = null; button.hidden = true; });
}
