try {
  const m = await import('../api/_lib/kv.js');
  console.log('import OK', Object.keys(m));
  console.log(await m.kvSet('test', { ok: true }));
  console.log(await m.kvGet('test'));
} catch (e) {
  console.error('IMPORT FAIL', e.message);
  console.error(e);
  process.exit(1);
}
