/**
 * tauri-adapter.js — Replaces Electron's preload.js for Tauri builds.
 *
 * Provides the same `window.desktopWindow` interface that the frontend expects,
 * using Tauri's invoke() and event system instead of Electron IPC.
 *
 * Auto-detected: only activates when window.__TAURI__ is present.
 * In Electron builds, preload.js takes over instead.
 */
(function () {
  'use strict';

  // Only activate in Tauri environment
  if (typeof window.__TAURI__ === 'undefined') return;

  const tauri = window.__TAURI__;

  // Safely resolve invoke — may be missing for HTTP URLs in some Tauri configs
  function getInvoke() {
    if (typeof tauri.invoke === 'function') return tauri.invoke;
    // Fallback: try core module
    if (tauri.core && typeof tauri.core.invoke === 'function') return tauri.core.invoke;
    return null;
  }

  const invoke = getInvoke();

  // Safely resolve event APIs
  const eventModule = tauri.event || {};
  const listenFn = typeof eventModule.listen === 'function' ? eventModule.listen : null;
  const emitFn = typeof eventModule.emit === 'function' ? eventModule.emit : null;

  if (!invoke) {
    console.warn('[tauri-adapter] Tauri invoke() not available — window.__TAURI__:',
      Object.keys(tauri));
  }

  // Known Tauri server port (must match tauri.conf.json / server default)
  var TAURI_SERVER_PORT = 3000;

  // Determine if current page origin differs from the Rust server port.
  // If the page is served from a different port (e.g. 3001), HTTP fallback
  // must target the Rust server port instead of the page origin.
  var pagePort = '';
  try {
    pagePort = String(window.location.port || '');
  } catch (_) {}
  var needPortRedirect = pagePort && pagePort !== String(TAURI_SERVER_PORT);
  var serverBase = needPortRedirect
    ? (window.location.protocol + '//' + window.location.hostname + ':' + TAURI_SERVER_PORT)
    : '';

  if (needPortRedirect) {
    console.warn('[tauri-adapter] Page port (' + pagePort + ') differs from server port (' + TAURI_SERVER_PORT + ') — HTTP calls will target server port');
  }

  // Safe invoke wrapper — falls back to HTTP POST when IPC fails
  function safeInvoke(cmd, args) {
    if (!invoke) {
      return httpInvoke(cmd, args);
    }
    return invoke(cmd, args).catch(function (err) {
      var msg = String(err && err.message ? err.message : err || '');
      // "Couldn't find callback id" — stale IPC from before page reload;
      // do NOT fall back to HTTP for this, it's a transient warning.
      if (msg.indexOf('callback') !== -1) {
        console.debug('[tauri-adapter] stale IPC callback for', cmd, '(will retry)');
        // Retry once after a short delay to let IPC channel stabilise
        return new Promise(function (resolve) {
          setTimeout(function () {
            invoke(cmd, args).then(resolve).catch(function () {
              resolve(httpInvoke(cmd, args));
            });
          }, 50);
        });
      }
      if (msg.indexOf('not allowed') !== -1 ||
          msg.indexOf('Plugin not found') !== -1 ||
          msg.indexOf('not found') !== -1 ||
          msg.indexOf('No such command') !== -1) {
        console.warn('[tauri-adapter] IPC failed for', cmd, '— falling back to HTTP');
        return httpInvoke(cmd, args);
      }
      throw err;
    });
  }

  // HTTP fallback for commands that fail via ipc.localhost.
  // Uses the Rust server port (3000) when the page origin port differs.
  function httpInvoke(cmd, args) {
    var url = serverBase + '/api/invoke/' + encodeURIComponent(cmd);
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args || {}),
    }).then(function (r) { return r.json(); }).catch(function (err) {
      console.warn('[tauri-adapter] HTTP invoke failed for', cmd, ':', err);
      return null;
    });
  }

  // Helper: create an event listener that returns an unsubscribe function
  function onEvent(eventName, callback) {
    if (typeof callback !== 'function') return () => {};
    if (!listenFn) {
      console.warn('[tauri-adapter] event.listen unavailable for:', eventName);
      return () => {};
    }
    let unlisten = null;
    listenFn(eventName, (event) => {
      callback(event.payload || {});
    }).then((fn) => { unlisten = fn; }).catch((err) => {
      console.warn('[tauri-adapter] listen failed for', eventName, ':', err);
    });
    return () => { if (unlisten) unlisten(); };
  }

  window.desktopWindow = {
    isDesktop: true,

    // Window management
    minimize: () => safeInvoke('window_minimize'),
    toggleMaximize: () => safeInvoke('window_toggle_maximize'),
    toggleFullscreen: () => safeInvoke('window_toggle_fullscreen'),
    exitFullscreenWindowed: () => safeInvoke('window_exit_fullscreen_windowed'),
    getState: () => safeInvoke('window_get_state'),
    close: () => safeInvoke('window_close'),

    // Login windows — openNeteaseMusicLogin returns a Promise<{ok, cookie}>
    openNeteaseMusicLogin: () => {
      // Open the webview via HTTP fallback or IPC
      const openPromise = safeInvoke('open_netease_login');
      // The Rust backend polls for MUSIC_U cookie and emits 'netease-login-cookie'
      return new Promise((resolve, reject) => {
        let settled = false;
        let unlisten = null;

        // Listen for the cookie event from backend
        if (listenFn) {
          listenFn('netease-login-cookie', (event) => {
            if (settled) return;
            settled = true;
            if (unlisten) unlisten();
            const payload = event.payload || event || {};
            resolve(payload);
          }).then((fn) => { unlisten = fn; }).catch(() => {});
        }

        // Also start the open call — if it returns a cookie directly, use it
        openPromise.then((result) => {
          if (result && result.cookie && !settled) {
            settled = true;
            if (unlisten) unlisten();
            resolve(result);
          }
          // If no cookie in result, wait for the event
        }).catch((err) => {
          if (!settled) {
            settled = true;
            if (unlisten) unlisten();
            reject(err);
          }
        });

        // Timeout after 5 minutes
        setTimeout(() => {
          if (!settled) {
            settled = true;
            if (unlisten) unlisten();
            reject(new Error('Netease login timed out'));
          }
        }, 300000);
      });
    },
    clearNeteaseMusicLogin: () => safeInvoke('clear_netease_login'),
    openQQMusicLogin: () => {
      const openPromise = safeInvoke('open_qq_login');
      // The Rust backend polls for QQ cookies (uin + qm_keyst) and emits 'qq-login-cookie'
      return new Promise((resolve, reject) => {
        let settled = false;
        let unlisten = null;

        if (listenFn) {
          listenFn('qq-login-cookie', (event) => {
            if (settled) return;
            settled = true;
            if (unlisten) unlisten();
            const payload = event.payload || event || {};
            resolve(payload);
          }).then((fn) => { unlisten = fn; }).catch(() => {});
        }

        openPromise.then((result) => {
          if (result && result.cookie && !settled) {
            settled = true;
            if (unlisten) unlisten();
            resolve(result);
          }
        }).catch((err) => {
          if (!settled) {
            settled = true;
            if (unlisten) unlisten();
            reject(err);
          }
        });

        // Timeout after 5 minutes
        setTimeout(() => {
          if (!settled) {
            settled = true;
            if (unlisten) unlisten();
            reject(new Error('QQ login timed out'));
          }
        }, 300000);
      });
    },
    clearQQMusicLogin: () => safeInvoke('clear_qq_login'),

    // App lifecycle
    openUpdateInstaller: (filePath) => safeInvoke('open_update_installer', { filePath }),
    restartApp: () => safeInvoke('restart_app'),

    // Global hotkeys
    configureGlobalHotkeys: (bindings) => safeInvoke('configure_global_hotkeys', { bindings: bindings || [] }),
    onGlobalHotkey: (callback) => onEvent('mineradio-global-hotkey', callback),

    // File operations
    exportJsonFile: (payload) => safeInvoke('export_json_file', { payload: payload || {} }),
    importJsonFile: () => safeInvoke('import_json_file'),

    // Desktop lyrics overlay
    setDesktopLyricsEnabled: (enabled, payload) =>
      safeInvoke('desktop_lyrics_set_enabled', { enabled: !!enabled, payload: payload || {} }),
    updateDesktopLyrics: (payload) =>
      safeInvoke('desktop_lyrics_update', { payload: payload || {} }),
    onDesktopLyricsLockState: (callback) => onEvent('mineradio-desktop-lyrics-lock-state', callback),
    onDesktopLyricsEnabledState: (callback) => onEvent('mineradio-desktop-lyrics-enabled-state', callback),

    // Wallpaper mode
    setWallpaperMode: (enabled, payload) =>
      safeInvoke('wallpaper_set_enabled', { enabled: !!enabled, payload: payload || {} }),
    updateWallpaperMode: (payload) =>
      safeInvoke('wallpaper_update', { payload: payload || {} }),

    // Window state change events
    onStateChange: (callback) => onEvent('desktop-window-state', callback),
  };

  // Add desktop CSS classes on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addDesktopClasses);
  } else {
    addDesktopClasses();
  }

  function addDesktopClasses() {
    document.documentElement.classList.add('desktop-shell-root');
    document.body.classList.add('desktop-shell');
  }

  console.log('[tauri-adapter] Mineradio Tauri adapter loaded (invoke:',
    invoke ? 'OK' : 'MISSING', ', listen:', listenFn ? 'OK' : 'MISSING', ')');
})();
