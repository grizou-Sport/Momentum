import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { authRedirect, locationsFetch, webOrigin } from './runtime.mjs';

if (Capacitor.isNativePlatform()) {
  window.MomentumNative = Object.freeze({
    origin: 'capacitor://localhost/',
    webOrigin,
    authRedirect,
    fetchLocations: (parameters, options) => locationsFetch(CapacitorHttp, parameters, options)
  });
  document.documentElement.classList.add('momentum-native');
  App.addListener('appStateChange', ({ isActive }) => {
    const auth = window.momentumDB?.auth;
    if (isActive) auth?.startAutoRefresh();
    else auth?.stopAutoRefresh();
  });
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link || event.defaultPrevented || link.hasAttribute('download')) return;
    const url = new URL(link.href, location.href);
    if (url.protocol !== 'https:') return;
    event.preventDefault();
    Browser.open({ url: url.href, presentationStyle: 'popover' }).catch(() => {});
  });
  function updateConnection() {
    let notice = document.getElementById('nativeConnectionNotice');
    if (!notice) {
      notice = document.createElement('p');
      notice.id = 'nativeConnectionNotice';
      notice.setAttribute('role', 'status');
      notice.textContent = 'Hors connexion. Retrouve le réseau pour charger ou enregistrer tes Moments.';
      document.body.append(notice);
    }
    notice.hidden = navigator.onLine;
  }
  document.addEventListener('DOMContentLoaded', updateConnection, { once: true });
  window.addEventListener('offline', updateConnection);
  window.addEventListener('online', updateConnection);
}
