/*!
 * Signal Activate — shared authentication (Firebase / Google)
 * One Firebase init, one auth-state listener, one consistent header widget
 * across every Signal Activate page. Session persists site-wide automatically.
 *
 * Include once per page, deferred:
 *   <script defer src="/assets/signal-auth.js"></script>
 * Put a mount where the account control should appear:
 *   <span id="signalAuth"></span>            (falls back to first <nav> if absent)
 *
 * Optional per-page hooks — define BEFORE this script loads:
 *   window.SignalAuthConfig = {
 *     onChange:  function(user){ ... },                 // fires on every auth change
 *     extraMenu: function(user){ return [ {label, onClick} ] }  // extra menu items
 *   };
 * Public API: window.SignalAuth = { user, onChange(fn), signIn(), signOut(), token() }
 */
(function () {
  "use strict";

  var CONFIG = {
    apiKey: "AIzaSyBoCX3VwXeWWfh7KVrPEIDdZ85U509B1qQ",
    authDomain: "signal-beta.firebaseapp.com",
    projectId: "signal-beta",
    storageBucket: "signal-beta.firebasestorage.app",
    messagingSenderId: "514941657214",
    appId: "1:514941657214:web:263c6a729f958f1c4ef82f"
  };
  var SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
  var FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,Helvetica,Arial,sans-serif";

  var cfg = window.SignalAuthConfig || {};
  var subs = [];
  var USER = null, AUTH = null, ready = false, menuOpen = false;

  // ---------------------------------------------------------------- public API
  var API = {
    get user() { return USER; },
    onChange: function (fn) {
      if (typeof fn === "function") { subs.push(fn); if (ready) { try { fn(USER); } catch (e) {} } }
      return API;
    },
    signIn: function () { doSignIn(); },
    signOut: function () { if (AUTH) AUTH.signOut().catch(function () {}); },
    token: function () { return (USER && USER.getIdToken) ? USER.getIdToken() : Promise.resolve(null); }
  };
  window.SignalAuth = API;
  // convenience globals (some inline handlers call these directly)
  window.signIn = window.signIn || function () { doSignIn(); };

  // -------------------------------------------------------------------- styles
  var CSS =
"#signalAuth{display:inline-flex;align-items:center;font-family:" + FONT + "}" +
"#signalAuth .sa-btn{font:600 13.5px/1 " + FONT + ";padding:9px 16px;border-radius:10px;border:1px solid #e7ebf0;background:#fff;color:#14181f;cursor:pointer;transition:border-color .15s,color .15s,box-shadow .15s}" +
"#signalAuth .sa-btn:hover{border-color:#c3cfdd;color:#0B67D0;box-shadow:0 2px 12px -8px rgba(16,22,35,.5)}" +
"#signalAuth .sa-wrap{position:relative;display:inline-flex}" +
"#signalAuth .sa-chip{display:inline-flex;align-items:center;gap:8px;padding:5px 10px 5px 5px;border-radius:100px;border:1px solid #e7ebf0;background:#fff;cursor:pointer;transition:border-color .15s,box-shadow .15s}" +
"#signalAuth .sa-chip:hover{border-color:#c3cfdd;box-shadow:0 3px 14px -8px rgba(16,22,35,.55)}" +
"#signalAuth .sa-av{width:27px;height:27px;border-radius:50%;object-fit:cover;display:block;flex:none;padding:0;margin:0;box-shadow:none}" +
"#signalAuth .sa-ini{display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0B67D0,#3B8EE8);color:#fff;font:700 11px/1 " + FONT + "}" +
"#signalAuth .sa-name{font:600 13px/1 " + FONT + ";color:#14181f;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
"#signalAuth .sa-caret{color:#9aa1ab;flex:none;transition:transform .18s ease}" +
"#signalAuth .sa-chip[aria-expanded='true'] .sa-caret{transform:rotate(180deg)}" +
"#signalAuth .sa-menu{position:absolute;top:calc(100% + 9px);right:0;min-width:220px;background:#fff;border:1px solid #e7ebf0;border-radius:14px;box-shadow:0 22px 50px -20px rgba(16,22,35,.5),0 3px 10px -5px rgba(16,22,35,.22);padding:6px;opacity:0;transform:translateY(-6px) scale(.98);transform-origin:top right;pointer-events:none;transition:opacity .16s ease,transform .16s ease;z-index:9999}" +
"#signalAuth .sa-menu.on{opacity:1;transform:none;pointer-events:auto}" +
"#signalAuth .sa-head{padding:9px 11px 11px;border-bottom:1px solid #f0f3f7;margin-bottom:5px}" +
"#signalAuth .sa-hn{font:600 13.5px/1.25 " + FONT + ";color:#14181f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
"#signalAuth .sa-he{font:400 12px/1.3 " + FONT + ";color:#8b929b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}" +
"#signalAuth .sa-item{display:flex;align-items:center;gap:9px;width:100%;text-align:left;box-sizing:border-box;font:500 13.5px/1.1 " + FONT + ";color:#14181f;background:none;border:0;border-radius:9px;padding:10px 11px;cursor:pointer;text-decoration:none;transition:background .12s,color .12s}" +
"#signalAuth .sa-item:hover{background:#f5f7fb;color:#0B67D0}" +
"#signalAuth .sa-item svg{width:16px;height:16px;flex:none;color:#8b929b}" +
"#signalAuth .sa-item:hover svg{color:#0B67D0}" +
"#signalAuth .sa-sep{height:1px;background:#f0f3f7;margin:5px 4px}" +
"#signalAuth .sa-out{color:#c0392b}#signalAuth .sa-out:hover{background:#fdeceb;color:#c0392b}#signalAuth .sa-out svg{color:#d06a63}#signalAuth .sa-out:hover svg{color:#c0392b}" +
"#sa-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(12px);max-width:min(460px,92vw);background:#0d1b2a;color:#fff;font:600 13.5px/1.45 " + FONT + ";padding:12px 18px;border-radius:12px;box-shadow:0 18px 44px -14px rgba(0,0,0,.6);opacity:0;pointer-events:none;transition:opacity .25s,transform .25s;z-index:99999;text-align:center}" +
"#sa-toast.on{opacity:1;transform:translateX(-50%) translateY(0)}" +
"@media(max-width:520px){#signalAuth .sa-name{max-width:84px}}";

  function injectCSS() {
    if (document.getElementById("sa-css")) return;
    var s = document.createElement("style");
    s.id = "sa-css"; s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  // ---------------------------------------------------------------------- boot
  function loadScript(src, cb) {
    var el = document.createElement("script");
    el.src = src; el.async = false;
    el.onload = cb;
    el.onerror = function () { console.error("[SignalAuth] could not load " + src); toast("Sign-in service could not load. Check your connection and refresh."); };
    (document.head || document.documentElement).appendChild(el);
  }

  function boot() {
    injectCSS();
    renderWidget(); // show a neutral "Sign In" immediately
    if (window.firebase && window.firebase.auth) return init();
    loadScript(SDK + "firebase-app-compat.js", function () {
      loadScript(SDK + "firebase-auth-compat.js", function () { init(); });
    });
  }

  function init() {
    try {
      if (!firebase.apps.length) firebase.initializeApp(CONFIG);
      AUTH = firebase.auth();
      try { AUTH.setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch (e) {}
      AUTH.onAuthStateChanged(function (u) {
        USER = u || null; ready = true;
        renderWidget();
        try { identifyToSignal(USER); } catch (e) {}   // 6C: establish first-party identity (best-effort)
        subs.forEach(function (fn) { try { fn(USER); } catch (e) {} });
        if (cfg.onChange) { try { cfg.onChange(USER); } catch (e) {} }
      }, function (err) { console.error("[SignalAuth] listener error", err); });
    } catch (e) {
      console.error("[SignalAuth] init failed", e);
      ready = true; renderWidget();
    }
  }

  // ---------------------------------------------- Batch 6C: customer identity (ADDITIVE)
  // After a verified Firebase sign-in, tell Signal's own backend that this browser session belongs
  // to a verified identity. The server verifies the ID token itself and derives the identity from
  // the VERIFIED claims — nothing here asserts who the user is, and no email is ever sent.
  //
  // Boundaries:
  //   * Grants the customer NO analytics access. The endpoint returns {ok, linked} and nothing else.
  //   * Best-effort and fully isolated: any failure is swallowed, so a backend problem, an offline
  //     browser or a blocked request can NEVER break or delay sign-in.
  //   * Idempotent server-side, and guarded here too, so a re-fired auth state does not re-post.
  //   * Sends only the canonical session id and (if consent allowed one) the first-party visitor
  //     token, both of which are opaque first-party values.
  var IDENTIFY_EP = "https://signal-pulse-765082978315.europe-west2.run.app/frontdoor/identify";
  var _identified = null;

  function identifyToSignal(u) {
    if (!u || !u.getIdToken) return;
    var uid = u.uid || "";
    if (_identified === uid) return;          // already done for this user in this page life
    _identified = uid;
    var sid = "";
    try { sid = (window.SignalTracker && window.SignalTracker.sessionId)
                  ? window.SignalTracker.sessionId() : ""; } catch (e) {}
    var vid = null;
    try { vid = (window.saVisitorId ? window.saVisitorId() : null); } catch (e) {}
    u.getIdToken().then(function (tok) {
      if (!tok) return;
      var body = {};
      if (sid) body.session_id = sid;
      if (vid) body.visitor_id = vid;
      return fetch(IDENTIFY_EP, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok },
        body: JSON.stringify(body),
        credentials: "omit",
        keepalive: true
      });
    }).catch(function () { _identified = null; });   // allow a later retry; never surface an error
  }

  // ------------------------------------------------------------------ sign-in
  function doSignIn() {
    if (!AUTH) { toast("Sign-in is still loading — one moment, then try again."); return; }
    var p = new firebase.auth.GoogleAuthProvider();
    p.setCustomParameters({ prompt: "select_account" });
    AUTH.signInWithPopup(p).catch(function (err) { handleErr(err); });
  }

  function handleErr(err) {
    var code = (err && err.code) || "";
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return; // user aborted
    var msg = "Couldn’t complete sign-in. Please try again.";
    if (code === "auth/unauthorized-domain")
      msg = "This domain (" + location.hostname + ") isn’t authorised for sign-in. Add it in Firebase → Authentication → Settings → Authorized domains.";
    else if (code === "auth/popup-blocked")
      msg = "Your browser blocked the sign-in window. Allow pop-ups for this site, then try again.";
    else if (code === "auth/network-request-failed")
      msg = "Network problem reaching sign-in. Check your connection and try again.";
    else if (code === "auth/operation-not-allowed")
      msg = "Google sign-in isn’t enabled for this project yet.";
    console.error("[SignalAuth] sign-in error:", code, err);
    toast(msg);
  }

  // -------------------------------------------------------------------- widget
  function mountEl() {
    var m = document.getElementById("signalAuth");
    if (m) return m;
    var nav = document.querySelector("nav");
    if (!nav) return null;
    m = document.createElement("span"); m.id = "signalAuth";
    nav.appendChild(m); return m;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function initials(u) {
    var n = (u.displayName || u.email || "?").trim();
    var parts = n.split(/\s+/);
    var a = parts[0] ? parts[0][0] : "";
    var b = parts[1] ? parts[1][0] : (n.length > 1 ? n[1] : "");
    return (a + b).toUpperCase().slice(0, 2) || "?";
  }
  function shortName(u) {
    var n = (u.displayName || u.email || "Account").trim();
    if (n.indexOf("@") > -1) return n.split("@")[0];
    return n.split(/\s+/)[0];
  }

  var ICON = {
    hub: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8"/></svg>',
    out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>'
  };

  function renderWidget() {
    var m = mountEl(); if (!m) return;

    if (!USER) {
      menuOpen = false;
      m.innerHTML = '<button type="button" class="sa-btn" id="saSignin">Sign In</button>';
      m.querySelector("#saSignin").onclick = function () { doSignIn(); };
      return;
    }

    var u = USER;
    var full = u.displayName || u.email || "Account";
    var avatar = u.photoURL
      ? '<img class="sa-av" src="' + esc(u.photoURL) + '" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'sa-av sa-ini\',textContent:\'' + esc(initials(u)) + '\'}))">'
      : '<span class="sa-av sa-ini">' + esc(initials(u)) + '</span>';

    var extra = [];
    if (cfg.extraMenu) { try { extra = cfg.extraMenu(u) || []; } catch (e) { extra = []; } }
    var extraHTML = extra.map(function (it, i) {
      return '<button type="button" class="sa-item" data-x="' + i + '">' + ICON.box + esc(it.label) + '</button>';
    }).join("");

    m.innerHTML =
      '<div class="sa-wrap">' +
        '<button type="button" class="sa-chip" id="saChip" aria-haspopup="menu" aria-expanded="false">' +
          avatar +
          '<span class="sa-name">' + esc(shortName(u)) + '</span>' +
          '<svg class="sa-caret" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>' +
        '</button>' +
        '<div class="sa-menu" id="saMenu" role="menu">' +
          '<div class="sa-head"><div class="sa-hn">' + esc(full) + '</div>' +
            (u.email ? '<div class="sa-he">' + esc(u.email) + '</div>' : '') + '</div>' +
          '<a class="sa-item" role="menuitem" href="/hub">' + ICON.hub + 'Signal Hub</a>' +
          extraHTML +
          '<div class="sa-sep"></div>' +
          '<button type="button" class="sa-item sa-out" role="menuitem" id="saOut">' + ICON.out + 'Sign out</button>' +
        '</div>' +
      '</div>';

    var chip = m.querySelector("#saChip"), menu = m.querySelector("#saMenu");
    chip.onclick = function (e) {
      e.stopPropagation();
      menuOpen = !menuOpen;
      menu.classList.toggle("on", menuOpen);
      chip.setAttribute("aria-expanded", menuOpen ? "true" : "false");
    };
    m.querySelector("#saOut").onclick = function () { closeMenu(); API.signOut(); };
    Array.prototype.forEach.call(menu.querySelectorAll(".sa-item[data-x]"), function (b) {
      var ix = +b.getAttribute("data-x");
      b.onclick = function () { closeMenu(); try { if (extra[ix] && extra[ix].onClick) extra[ix].onClick(); } catch (e) {} };
    });
  }

  function closeMenu() {
    menuOpen = false;
    var menu = document.getElementById("saMenu"), chip = document.getElementById("saChip");
    if (menu) menu.classList.remove("on");
    if (chip) chip.setAttribute("aria-expanded", "false");
  }
  document.addEventListener("click", function () { if (menuOpen) closeMenu(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && menuOpen) closeMenu(); });

  // --------------------------------------------------------------------- toast
  function toast(msg) {
    var t = document.getElementById("sa-toast");
    if (!t) { t = document.createElement("div"); t.id = "sa-toast"; (document.body || document.documentElement).appendChild(t); }
    t.textContent = msg; t.className = "on";
    clearTimeout(t._h); t._h = setTimeout(function () { t.className = ""; }, 6000);
  }
  API.toast = toast;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
