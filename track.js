/* Aluvia VSL tracking.
   Who watched the video, how far, and who booked.
   Link tags:  ?r=<lead_code>  one lead (follow-up sequence)
               ?c=<tag>        one source, e.g. ?c=ai (AI reply), ?c=sub (follow-up, old leads)
               ?me=1           this browser is Waleed: stop tracking it (?me=0 turns it back on)
   With no POSTHOG_KEY set, only the Calendly tags run. */
(function () {
  var POSTHOG_KEY = "phc_uUvSWPU2TBZtvNdxrEPjeZQCJMDY8eEMSCHZp7ejp33x";                       // phc_... project key (public, safe in page code)
  var POSTHOG_HOST = "https://us.i.posthog.com";

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  var q = new URLSearchParams(location.search);
  var clean = function (s) { return (s || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40); };

  if (q.get("me") === "1") store("aluvia_me", "1");
  if (q.get("me") === "0") store("aluvia_me", "0");
  var isMe = store("aluvia_me") === "1";

  // Remember the tags so a second visit without them still counts for the same lead.
  var qr = clean(q.get("r"));
  if (/lead_?code/i.test(qr)) qr = "";        // merge tag left unfilled ({{lead_code}} with no column)
  var r = qr || store("aluvia_r") || "";
  var c = clean(q.get("c")) || store("aluvia_c") || "";
  if (qr) store("aluvia_r", qr);
  if (q.get("c")) store("aluvia_c", c);
  var niche = (location.pathname.split("/").filter(Boolean)[0] || "home");

  // Calendly: carry the tags into the booking so each call ties back to its lead.
  var cal = document.querySelector("iframe.cal");
  if (cal) {
    try {
      var u = new URL(cal.src);
      u.searchParams.set("utm_source", "aluvia-vsl");
      u.searchParams.set("utm_campaign", niche);
      if (c) u.searchParams.set("utm_medium", c);
      if (r) u.searchParams.set("utm_content", r);
      cal.src = u.toString();
    } catch (e) {}
  }

  if (!POSTHOG_KEY || isMe) return;

  // PostHog loader (official snippet, trimmed).
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once identify setPersonProperties reset opt_out_capturing".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: "identified_only",
    autocapture: false,
    capture_pageview: true,
    capture_pageleave: true
  });
  posthog.register({ niche: niche, lead_code: r || null, source: c || (r ? "lead" : "direct") });
  if (r) { posthog.identify("lead_" + r, { lead_code: r, niche: niche }); }

  // Video: play, 25/50/75/100%, and how far they got when they left.
  var v = document.getElementById("vsl");
  if (v) {
    var sent = {}, maxPct = 0, played = false;
    function pct() { return v.duration ? Math.min(100, Math.round(v.currentTime / v.duration * 100)) : 0; }
    v.addEventListener("play", function () {
      if (!played) { played = true; posthog.capture("vsl_play"); }
    });
    v.addEventListener("timeupdate", function () {
      var p = pct(); if (p > maxPct) maxPct = p;
      [25, 50, 75].forEach(function (m) {
        if (p >= m && !sent[m]) { sent[m] = 1; posthog.capture("vsl_" + m); }
      });
      if (p >= 95 && !sent[100]) { sent[100] = 1; posthog.capture("vsl_100"); }
    });
    v.addEventListener("ended", function () {
      maxPct = 100; if (!sent[100]) { sent[100] = 1; posthog.capture("vsl_100"); }
    });
    window.addEventListener("pagehide", function () {
      if (played) posthog.capture("vsl_left", { max_pct: maxPct }, { transport: "sendBeacon" });
    });
  }

  // Calendly steps.
  window.addEventListener("message", function (e) {
    if (!/calendly\.com$/.test((e.origin || "").replace(/^https?:\/\//, ""))) return;
    var ev = (e.data || {}).event || "";
    if (ev === "calendly.date_and_time_selected") posthog.capture("call_time_picked");
    if (ev === "calendly.event_scheduled") posthog.capture("call_booked");
  });
})();
