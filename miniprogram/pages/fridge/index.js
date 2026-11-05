let G = null, D = null, E = null, S = null;
let loadErr = '';

try {
  G = require('../../lib/shim.js');
  require('../../lib/data.js');
  require('../../lib/engine.js');
  require('../../lib/store.js');
  D = G.DD_DATA; E = G.DD_ENGINE; S = G.DD_STORE;
} catch (e) {
  loadErr = String((e && e.message) || e);
}

Page({
  data: {
    total: 0,
    dbgCore: 'init',
    loadErr: loadErr || '(none)'
  },

  onLoad() {
    let total = 0;
    let dbg = '';
    try {
      dbg = [!!D, !!E, !!S].join('/');
      if (S) {
        S.load();
        if (!S.state.family.loggedIn) { S.demoFamily(); S.save(); }
        total = S.state.foods.length;
      }
    } catch (e) {
      loadErr = String((e && e.message) || e);
    }
    this.setData({ total: total, dbgCore: dbg, loadErr: loadErr || '(none)' });
    console.log('[mp-diag] core=', dbg, 'total=', total, 'err=', loadErr);
  }
});
