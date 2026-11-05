import { $, esc, loading, copyText } from "./util.js";

let gisLoaded;
function loadGis() {
  gisLoaded ||= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
  return gisLoaded;
}

const ss = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch {} },
};

export function initMembers(root, config) {
  const params = new URLSearchParams(location.search);
  if (params.get("join")) ss.set("scc:join", params.get("join"));
  let joinCode = ss.get("scc:join");
  const domain = config.allowedDomain || "pleasantonusd.net";

  root.innerHTML = `
  <div class="wrap segment">
    <div class="lower-third"><span class="tag">Members only</span><div class="title"><h2>Members</h2></div></div>
    <div id="mbStage"></div>
  </div>`;
  const stage = $("#mbStage", root);

  function signInView(message) {
    const invited = Boolean(joinCode);
    stage.innerHTML = `
    <div class="split">
      <div class="panel">
        <span class="eyebrow">${invited ? "You've been invited" : "Member sign-in"}</span>
        <h3 style="margin-top:8px">${invited ? "Join the Sports Commentary Club" : "Sign in with your school account"}</h3>
        <p>${invited
          ? `Sign in with your <b>@${esc(domain)}</b> Google account to join the club roster.`
          : `Members join with a private invite link from a club officer. Already joined? Sign in with your <b>@${esc(domain)}</b> account.`}</p>
        ${message ? `<div class="callout warn" style="margin-bottom:14px">${esc(message)}</div>` : ""}
        <div id="gBtn" style="min-height:44px"></div>
        <p class="note" style="margin-top:12px">Only PUSD student and staff Google accounts can sign in. Personal Gmail accounts are turned away.</p>
      </div>
      <div class="panel dark">
        <h4>Members get</h4>
        <ul class="list-clean">
          <li><span>The club roster and officer contacts</span></li>
          <li><span>Meeting info, Google Classroom code and sign-up forms in one place</span></li>
          <li><span>First word on trips like the planned Sharks game at SAP Center</span></li>
          <li><span>Fantasy basketball league and commentary contest updates</span></li>
        </ul>
        <p class="note" style="color:#bdbdbd;margin-top:12px">No invite link? Email <span style="color:#fff">ap4956@pleasantonusd.net</span> or come to a Friday meeting in H-9.</p>
      </div>
    </div>`;
    if (!config.googleClientId) {
      $("#gBtn", stage).innerHTML = `<div class="callout">Member sign-in isn't switched on yet. A club officer needs to add the Google sign-in settings (see the README).</div>`;
      return;
    }
    loadGis().then(() => {
      google.accounts.id.initialize({ client_id: config.googleClientId, callback: (r) => submit(r.credential), hd: domain, ux_mode: "popup", auto_select: false });
      google.accounts.id.renderButton($("#gBtn", stage), { theme: "filled_black", size: "large", text: invited ? "signup_with" : "signin_with", shape: "rectangular" });
    }).catch(() => { $("#gBtn", stage).innerHTML = `<div class="callout warn">Couldn't load Google sign-in. Check your connection or ad blocker.</div>`; });
  }

  async function submit(credential, opt = {}) {
    const action = opt.action || (joinCode ? "join" : "me");
    stage.innerHTML = loading(action === "remove" ? "Updating roster…" : "Checking your school account…");
    try {
      const r = await fetch("/api/members", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential, action, joinCode, email: opt.email }),
      });
      const data = await r.json();
      if (!r.ok) { ss.set("scc:cred", null); return signInView(data.error); }
      ss.set("scc:cred", credential);
      if (joinCode) { joinCode = null; ss.set("scc:join", null); history.replaceState(null, "", location.pathname + "#members"); }
      dashboard(data, credential);
    } catch {
      signInView("Couldn't reach the server. Try again.");
    }
  }

  function dashboard(d, credential) {
    const me = d.me;
    const invite = d.officer && d.inviteCode ? `${location.origin}/?join=${encodeURIComponent(d.inviteCode)}#members` : "";
    stage.innerHTML = `
    <div class="panel dark" style="margin-bottom:20px">
      <div class="row" style="justify-content:space-between">
        <div class="row">
          ${me.picture ? `<img src="${esc(me.picture)}" alt="" width="52" height="52" style="border-radius:50%" referrerpolicy="no-referrer">` : ""}
          <div><span class="eyebrow" style="color:var(--yellow)">${d.officer ? "Officer" : "Member"}${me.joinedAt ? " · joined " + new Date(me.joinedAt).toLocaleDateString() : ""}</span>
          <div style="font:800 28px/1.1 var(--display);letter-spacing:-.02em">Welcome to the booth, ${esc((me.name || "").split(" ")[0])}</div></div>
        </div>
        <button class="btn small" style="color:#fff;border-color:#fff;background:transparent" id="mbOut">Sign out</button>
      </div>
    </div>

    <div class="grid cols-3" style="margin-bottom:24px">
      <div class="panel"><h4>Next meeting</h4><p style="margin:0"><b>Friday, lunch · Room H-9</b><br><span class="note">Schedule may change. Check Classroom. Can't make it? Email the club ahead of time.</span></p></div>
      <div class="panel"><h4>Google Classroom</h4><div class="copy-row"><span class="code-pill">ao7yexzb</span><button class="btn small" data-copy="ao7yexzb">Copy</button></div></div>
      <div class="panel"><h4>Quick links</h4><div class="row">
        <a class="btn small" target="_blank" rel="noopener" href="https://docs.google.com/document/d/1SyCfGvPPlXTAGZsRdEf0nVrwdW6vvqApdL8qWWm6JFk/edit?tab=t.fqtyitbmkzia">Logistics doc</a>
        <a class="btn small" target="_blank" rel="noopener" href="https://forms.gle/AKgLiW5cy1r23C12A">Fantasy league</a>
        <a class="btn small" target="_blank" rel="noopener" href="https://forms.gle/YDAS8Aj7DrMF1w1k8">Mailing list</a></div></div>
    </div>

    ${invite ? `<div class="panel soft" style="margin-bottom:24px">
      <h4>Officer tools · invite link</h4>
      <p class="note">Share this link with new members (school accounts only). Change MEMBER_INVITE_CODE in the hosting settings to retire it.</p>
      <div class="copy-row"><input type="text" readonly value="${esc(invite)}" id="mbInvite" style="flex:1;min-width:220px"><button class="btn small primary" data-copy="${esc(invite)}">Copy link</button></div>
    </div>` : ""}

    <div class="row" style="justify-content:space-between;margin-bottom:12px"><h3 style="margin:0">Club roster</h3><span class="eyebrow">${d.members.length} member${d.members.length === 1 ? "" : "s"}</span></div>
    <div class="member-grid">${d.members.map((m) => `
      <div class="member">
        ${m.picture ? `<img src="${esc(m.picture)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar">${esc((m.name || "?")[0])}</span>`}
        <div style="min-width:0"><b>${esc(m.name)}${m.officer ? '<span class="badge-officer">Officer</span>' : ""}</b>
        <small>${m.email ? esc(m.email) + " · " : ""}joined ${new Date(m.joinedAt).toLocaleDateString()}</small>
        ${d.officer && m.email && m.email !== me.email ? `<button class="btn small" style="margin-top:6px;padding:4px 8px" data-remove="${esc(m.email)}">Remove</button>` : ""}</div>
      </div>`).join("") || '<div class="empty-state">No members yet. Share the invite link!</div>'}</div>`;

    $("#mbOut", stage).addEventListener("click", () => {
      ss.set("scc:cred", null);
      try { google.accounts.id.disableAutoSelect(); } catch {}
      signInView();
    });
    stage.querySelectorAll("[data-remove]").forEach((b) => b.addEventListener("click", () => {
      if (b.dataset.confirm) return submit(credential, { action: "remove", email: b.dataset.remove });
      b.dataset.confirm = "1"; b.textContent = "Click again to remove";
    }));
  }

  const saved = ss.get("scc:cred");
  if (saved && !joinCode) submit(saved);
  else signInView();
}
