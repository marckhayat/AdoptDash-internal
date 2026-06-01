// =============================================================================
// idb.js — IndexedDB persistence for APP_DATA
// =============================================================================
// Stores up to two named dataset slots: "workspan" and "lci".
// Each entry: { type, data (APP_DATA array), meta: { filename, rowCount, loadedAt, ... } }
// =============================================================================

var IDB = (function () {
  var DB_NAME    = "AdoptionDashboard";
  var DB_VERSION = 1;
  var STORE      = "datasets";
  var _db        = null;

  function open() {
    return new Promise(function (resolve, reject) {
      if (_db) { resolve(_db); return; }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "type" });
        }
      };
      req.onsuccess  = function (e) { _db = e.target.result; resolve(_db); };
      req.onerror    = function (e) { reject(e.target.error); };
    });
  }

  function save(type, data, meta) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx  = db.transaction(STORE, "readwrite");
        var store = tx.objectStore(STORE);
        var req = store.put({ type: type, data: data, meta: meta });
        req.onsuccess = resolve;
        req.onerror   = function (e) { reject(e.target.error); };
      });
    });
  }

  function load(type) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx    = db.transaction(STORE, "readonly");
        var store = tx.objectStore(STORE);
        var req   = store.get(type);
        req.onsuccess = function (e) { resolve(e.target.result || null); };
        req.onerror   = function (e) { reject(e.target.error); };
      });
    });
  }

  function remove(type) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx    = db.transaction(STORE, "readwrite");
        var store = tx.objectStore(STORE);
        var req   = store.delete(type);
        req.onsuccess = resolve;
        req.onerror   = function (e) { reject(e.target.error); };
      });
    });
  }

  function loadAll() {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx    = db.transaction(STORE, "readonly");
        var store = tx.objectStore(STORE);
        var req   = store.getAll();
        req.onsuccess = function (e) { resolve(e.target.result || []); };
        req.onerror   = function (e) { reject(e.target.error); };
      });
    });
  }

  return { save: save, load: load, remove: remove, loadAll: loadAll };
})();
