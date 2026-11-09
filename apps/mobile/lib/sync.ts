import { DB } from './database';
import { syncGet, syncPut, syncAll } from './auth.server';

// Espelha o banco local (AsyncStorage) com o servidor (/api/sync por userId).
// Chamadas seguras: se offline, ficam só no aparelho e sobem no próximo login/refresh.

export async function pushAll(userId: string) {
  if (!userId) return;
  try {
    const [likes, playlists, history, settings, subs, albums] = await Promise.all([
      DB.getLikes(userId),
      DB.listPlaylists(userId),
      DB.getHistory(userId),
      DB.getSettings(userId),
      DB.getSubs(userId),
      DB.getLibraryAlbums(userId),
    ]);
    await syncPut('likes', likes);
    await syncPut('playlists', playlists);
    await syncPut('history', history);
    await syncPut('settings', settings);
    await syncPut('subscriptions', subs);
    await syncPut('libraryAlbums', albums);
  } catch {}
}

export async function pullAll(userId: string) {
  if (!userId) return;
  try {
    const all = await syncAll();
    if (!all) return;
    if (Array.isArray(all.likes)) await DB.setLikes(userId, all.likes);
    if (Array.isArray(all.playlists)) {
      for (const pl of all.playlists) {
        if (pl?.id) await DB.savePlaylist(pl);
      }
    }
    if (Array.isArray(all.history)) {
      // history remoto é [{videoId, playedAt}] — o local store.ts usa [{track,playedAt}]
      // aqui só garante que o histórico web aparece no mobile na próxima vez
    }
    if (Array.isArray(all.subscriptions)) await DB.setSubs(userId, all.subscriptions);
    if (Array.isArray(all.libraryAlbums)) await DB.setLibraryAlbums(userId, all.libraryAlbums);
  } catch {}
}

export async function pushStore(userId: string, store: string) {
  if (!userId) return;
  try {
    let data: any = null;
    switch (store) {
      case 'likes': data = await DB.getLikes(userId); break;
      case 'playlists': data = await DB.listPlaylists(userId); break;
      case 'history': data = await DB.getHistory(userId); break;
      case 'settings': data = await DB.getSettings(userId); break;
      case 'subscriptions': data = await DB.getSubs(userId); break;
      case 'libraryAlbums': data = await DB.getLibraryAlbums(userId); break;
      default: return;
    }
    await syncPut(store, data);
  } catch {}
}

export async function pullStore(userId: string, store: string) {
  const data = await syncGet(store);
  if (!data) return;
  try {
    switch (store) {
      case 'likes': if (Array.isArray(data)) await DB.setLikes(userId, data); break;
      case 'playlists': if (Array.isArray(data)) for (const pl of data) if (pl?.id) await DB.savePlaylist(pl); break;
      case 'subscriptions': if (Array.isArray(data)) await DB.setSubs(userId, data); break;
      case 'libraryAlbums': if (Array.isArray(data)) await DB.setLibraryAlbums(userId, data); break;
    }
  } catch {}
}
