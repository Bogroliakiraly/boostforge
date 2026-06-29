/* BoostForge marketing site — trilingual content (EN / HU / DE). */

// For now the installer ships right next to this site (website/BoostForge-Setup.exe),
// so the Download button works with no server setup at all. Once you publish a real
// GitHub repo and start tagging releases, switch this back to the Releases URL so the
// button always serves the newest build automatically:
//   const GITHUB_REPO = "OWNER/REPO";
//   const DOWNLOAD_URL = `https://github.com/${GITHUB_REPO}/releases/latest/download/BoostForge-Setup.exe`;
const DOWNLOAD_URL = "./BoostForge-Setup.exe";
// Replace with your Stripe Payment Link / Checkout URL once payments are set up:
const BUY_URL = "https://buy.stripe.com/your-payment-link";

const I18N = {
  en: {
    "nav.features": "Features",
    "nav.honesty": "Honesty",
    "nav.pricing": "Pricing",
    "nav.download": "Download",
    "hero.pill": "No fake numbers. Ever.",
    "hero.title1": "Optimize Windows for gaming —",
    "hero.title2": "the honest way.",
    "hero.sub":
      "BoostForge boosts real performance using only measurable, reversible and safe changes. No placebo tweaks, no fake FPS, no risky registry hacks.",
    "hero.ctaDownload": "Download free",
    "hero.ctaPro": "See Pro",
    "hero.hint": "Windows 10 & 11 · Free 7-day Pro trial included",
    "features.eyebrow": "Real features",
    "features.title": "Everything you need, nothing you don't",
    "features.sub":
      "Live monitoring, safe cleanup, a reversible Game Mode and a full diagnostics toolkit.",
    "shots.eyebrow": "See it for yourself",
    "shots.title": "The actual app, not a mockup",
    "shots.sub": "Real screens from a running BoostForge install.",
    "shots.demoPreview": "Demo · running {n}s — not a read of your PC",
    "pricing.comingSoon": "Online Pro purchases aren't open yet — download the free version below for now, and check back soon.",
    "honesty.eyebrow": "Honesty by design",
    "honesty.title": "What BoostForge will never do",
    "honesty.sub":
      "Trust is the product. These are the lines we refuse to cross.",
    "pricing.eyebrow": "Pricing",
    "pricing.title": "Start free. Upgrade when you're ready.",
    "pricing.sub": "Cancel anytime. The free tier stays useful forever.",
    "pricing.freeName": "Free",
    "pricing.proName": "Pro",
    "pricing.perMonth": "/month",
    "pricing.freeCta": "Download",
    "pricing.proCta": "Get Pro",
    "pricing.note":
      "Pro unlocks Game Mode, the memory optimizer and automation. A 7-day trial is included — no card required.",
    "download.eyebrow": "Get started",
    "download.title": "Download BoostForge",
    "download.sub": "A 1–4 MB installer. Updates arrive automatically inside the app.",
    "download.cta": "Download for Windows",
    "download.req": "Windows 10 / 11 · 64-bit · WebView2",
    "footer.tagline": "Measurable. Reversible. Safe.",
    features: [
      ["📊", "Live system monitor", "Real CPU, RAM, network and disk metrics — straight from the OS."],
      ["🎮", "Game Mode", "Switches to a performance power plan and restores it exactly afterward."],
      ["🧹", "Safe cleaner", "9 genuinely safe categories — temp, shader cache, Windows Update cache, thumbnails, error reports, memory dumps and more. Each item shows benefit and downside."],
      ["⚡", "Memory optimizer", "Frees physical RAM before a game and shows the real, measured result."],
      ["📶", "Network latency monitor", "Measures real connection latency and jitter to a host — a stability check before multiplayer sessions."],
      ["🕒", "Scheduled cleanup", "A real Windows scheduled task runs the safe cleaner daily, with a visible log of what it freed."],
      ["🚀", "Startup manager", "Disable startup apps reversibly — the original entry is preserved."],
      ["🛡️", "Safety net", "Restore points, registry backups and a full undo history."],
    ],
    honesty: [
      "Never fabricate GPU, temperature, FPS or RAM readings.",
      "Never disable Windows services for unmeasurable gains.",
      "Never delete Prefetch or make irreversible changes silently.",
      "Never claim fixed FPS numbers it cannot verify.",
      "Never call a TCP latency measurement \"ping\" — it says exactly what it measured.",
    ],
    free: ["Live system monitor", "Safe disk cleaner", "Process & startup viewer", "Diagnostics toolkit"],
    pro: ["Everything in Free", "Game Mode (power plans)", "Memory optimizer", "Network latency monitor", "Scheduled automatic cleanup", "Automatic updates & priority support"],
  },

  hu: {
    "nav.features": "Funkciók",
    "nav.honesty": "Őszinteség",
    "nav.pricing": "Árazás",
    "nav.download": "Letöltés",
    "hero.pill": "Soha nincs hamis szám.",
    "hero.title1": "Optimalizáld a Windowst játékra —",
    "hero.title2": "őszintén.",
    "hero.sub":
      "A BoostForge valódi teljesítményt nyújt, kizárólag mérhető, visszafordítható és biztonságos változtatásokkal. Nincs placebo, nincs hamis FPS, nincs kockázatos registry-trükk.",
    "hero.ctaDownload": "Ingyenes letöltés",
    "hero.ctaPro": "Pro megtekintése",
    "hero.hint": "Windows 10 és 11 · 7 napos ingyenes Pro próbával",
    "features.eyebrow": "Valódi funkciók",
    "features.title": "Minden, amire szükség van — semmi felesleges",
    "features.sub":
      "Élő figyelés, biztonságos tisztítás, visszafordítható Játék mód és teljes diagnosztikai eszköztár.",
    "shots.eyebrow": "Nézd meg magad",
    "shots.title": "A valódi app, nem makett",
    "shots.sub": "Valódi képernyők egy futó BoostForge telepítésről.",
    "shots.demoPreview": "Demó · {n}s óta fut — nem a te géped adata",
    "pricing.comingSoon": "Az online Pro-vásárlás még nem elérhető — addig töltsd le az ingyenes verziót lent, és nézz vissza hamarosan.",
    "honesty.eyebrow": "Tervezetten őszinte",
    "honesty.title": "Amit a BoostForge soha nem tesz",
    "honesty.sub": "A bizalom maga a termék. Ezeket a határokat nem lépjük át.",
    "pricing.eyebrow": "Árazás",
    "pricing.title": "Kezdd ingyen. Válts, ha készen állsz.",
    "pricing.sub": "Bármikor lemondható. Az ingyenes csomag örökre hasznos marad.",
    "pricing.freeName": "Ingyenes",
    "pricing.proName": "Pro",
    "pricing.perMonth": "/hó",
    "pricing.freeCta": "Letöltés",
    "pricing.proCta": "Pro beszerzése",
    "pricing.note":
      "A Pro feloldja a Játék módot, a memória-optimalizálót és az automatizálást. 7 napos próba jár hozzá — kártya nélkül.",
    "download.eyebrow": "Első lépések",
    "download.title": "Töltsd le a BoostForge-ot",
    "download.sub": "1–4 MB-os telepítő. A frissítések automatikusan érkeznek az appban.",
    "download.cta": "Letöltés Windowsra",
    "download.req": "Windows 10 / 11 · 64 bites · WebView2",
    "footer.tagline": "Mérhető. Visszafordítható. Biztonságos.",
    features: [
      ["📊", "Élő rendszerfigyelő", "Valódi CPU-, RAM-, hálózati és lemezadatok — közvetlenül az OS-ből."],
      ["🎮", "Játék mód", "Teljesítmény-energiasémára vált, majd pontosan visszaállítja az eredetit."],
      ["🧹", "Biztonságos tisztító", "9 valóban biztonságos kategória — temp, shader cache, Windows Update gyorsítótár, bélyegképek, hibajelentések, memóriaképfájlok és más. Minden tételnél látszik az előny és hátrány."],
      ["⚡", "Memória-optimalizáló", "Játék előtt felszabadítja a fizikai RAM-ot, és a valós, mért eredményt mutatja."],
      ["📶", "Hálózati késleltetés-mérő", "Valódi kapcsolat-késleltetést és jittert mér egy megadott szerverhez — stabilitás-ellenőrzés multiplayer meccsek előtt."],
      ["🕒", "Ütemezett tisztítás", "Valódi Windows ütemezett feladat naponta lefuttatja a biztonságos tisztítót, látható naplóval arról, mennyit szabadított fel."],
      ["🚀", "Indítópult-kezelő", "Visszafordíthatóan tiltsd le az indítóappokat — az eredeti bejegyzés megmarad."],
      ["🛡️", "Biztonsági háló", "Visszaállítási pontok, registry-mentés és teljes visszavonási előzmény."],
    ],
    honesty: [
      "Soha nem talál ki GPU-, hőmérséklet-, FPS- vagy RAM-értéket.",
      "Soha nem tilt le Windows-szolgáltatást nem mérhető előnyért.",
      "Soha nem töröl Prefetch-et, és nem végez visszafordíthatatlan változtatást csendben.",
      "Soha nem ígér fix FPS-számot, amit nem tud igazolni.",
      "Soha nem nevez egy TCP-késleltetés-mérést „ping”-nek — pontosan megmondja, mit mért.",
    ],
    free: ["Élő rendszerfigyelő", "Biztonságos lemeztisztító", "Folyamat- és indítópult-nézet", "Diagnosztikai eszköztár"],
    pro: ["Minden az Ingyenesből", "Játék mód (energiasémák)", "Memória-optimalizáló", "Hálózati késleltetés-mérő", "Ütemezett automatikus tisztítás", "Automatikus frissítés és elsőbbségi támogatás"],
  },

  de: {
    "nav.features": "Funktionen",
    "nav.honesty": "Ehrlichkeit",
    "nav.pricing": "Preise",
    "nav.download": "Download",
    "hero.pill": "Niemals gefälschte Zahlen.",
    "hero.title1": "Windows fürs Gaming optimieren —",
    "hero.title2": "ehrlich.",
    "hero.sub":
      "BoostForge steigert echte Leistung ausschließlich mit messbaren, umkehrbaren und sicheren Änderungen. Keine Placebos, keine gefälschten FPS, keine riskanten Registry-Hacks.",
    "hero.ctaDownload": "Kostenlos laden",
    "hero.ctaPro": "Pro ansehen",
    "hero.hint": "Windows 10 & 11 · 7 Tage Pro-Test inklusive",
    "features.eyebrow": "Echte Funktionen",
    "features.title": "Alles, was du brauchst — nichts, was du nicht brauchst",
    "features.sub":
      "Live-Überwachung, sichere Bereinigung, ein umkehrbarer Spielmodus und ein komplettes Diagnose-Toolkit.",
    "shots.eyebrow": "Sieh es selbst",
    "shots.title": "Die echte App, kein Mockup",
    "shots.sub": "Echte Bildschirme aus einer laufenden BoostForge-Installation.",
    "shots.demoPreview": "Demo · läuft seit {n}s — keine Daten von deinem PC",
    "pricing.comingSoon": "Online-Pro-Käufe sind noch nicht möglich — lade vorerst unten die kostenlose Version herunter und schau bald wieder vorbei.",
    "honesty.eyebrow": "Ehrlich konzipiert",
    "honesty.title": "Was BoostForge niemals tut",
    "honesty.sub": "Vertrauen ist das Produkt. Diese Grenzen überschreiten wir nicht.",
    "pricing.eyebrow": "Preise",
    "pricing.title": "Gratis starten. Upgraden, wenn du bereit bist.",
    "pricing.sub": "Jederzeit kündbar. Die Gratis-Version bleibt für immer nützlich.",
    "pricing.freeName": "Gratis",
    "pricing.proName": "Pro",
    "pricing.perMonth": "/Monat",
    "pricing.freeCta": "Download",
    "pricing.proCta": "Pro holen",
    "pricing.note":
      "Pro schaltet Spielmodus, Speicher-Optimierer und Automatisierung frei. 7-Tage-Test inklusive — ohne Karte.",
    "download.eyebrow": "Loslegen",
    "download.title": "BoostForge herunterladen",
    "download.sub": "Ein 1–4 MB Installer. Updates kommen automatisch in der App an.",
    "download.cta": "Für Windows laden",
    "download.req": "Windows 10 / 11 · 64-Bit · WebView2",
    "footer.tagline": "Messbar. Umkehrbar. Sicher.",
    features: [
      ["📊", "Live-Systemmonitor", "Echte CPU-, RAM-, Netzwerk- und Festplattenwerte — direkt vom Betriebssystem."],
      ["🎮", "Spielmodus", "Wechselt zu einem Leistungs-Energieplan und stellt ihn danach exakt wieder her."],
      ["🧹", "Sicherer Bereiniger", "9 wirklich sichere Kategorien — Temp, Shader-Cache, Windows Update-Cache, Miniaturansichten, Fehlerberichte, Speicherabbilder und mehr. Jeder Punkt zeigt Nutzen und Nachteil."],
      ["⚡", "Speicher-Optimierer", "Gibt vor dem Spiel physischen RAM frei und zeigt das echte, gemessene Ergebnis."],
      ["📶", "Netzwerklatenz-Monitor", "Misst echte Verbindungslatenz und Jitter zu einem Host — eine Stabilitätsprüfung vor Multiplayer-Sitzungen."],
      ["🕒", "Geplante Bereinigung", "Eine echte Windows-Aufgabenplanung führt täglich den sicheren Bereiniger aus, mit sichtbarem Protokoll, was freigegeben wurde."],
      ["🚀", "Autostart-Manager", "Autostart-Apps umkehrbar deaktivieren — der Originaleintrag bleibt erhalten."],
      ["🛡️", "Sicherheitsnetz", "Wiederherstellungspunkte, Registry-Backups und volle Rückgängig-Historie."],
    ],
    honesty: [
      "Niemals GPU-, Temperatur-, FPS- oder RAM-Werte erfinden.",
      "Niemals Windows-Dienste für nicht messbare Gewinne deaktivieren.",
      "Niemals Prefetch löschen oder still unumkehrbare Änderungen vornehmen.",
      "Niemals feste FPS-Zahlen behaupten, die es nicht belegen kann.",
      "Niemals eine TCP-Latenzmessung „Ping“ nennen — die App sagt genau, was sie gemessen hat.",
    ],
    free: ["Live-Systemmonitor", "Sicherer Festplatten-Bereiniger", "Prozess- & Autostart-Ansicht", "Diagnose-Toolkit"],
    pro: ["Alles aus Gratis", "Spielmodus (Energiepläne)", "Speicher-Optimierer", "Netzwerklatenz-Monitor", "Geplante automatische Bereinigung", "Automatische Updates & Priority-Support"],
  },
};

let CURRENT_LANG = "en";

function apply(lang) {
  const dict = I18N[lang] || I18N.en;
  CURRENT_LANG = I18N[lang] ? lang : "en";
  document.documentElement.lang = lang;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) el.textContent = dict[key];
  });

  // Feature cards
  const fg = document.getElementById("feature-grid");
  fg.innerHTML = dict.features
    .map(
      ([ico, title, body]) =>
        `<div class="card"><div class="ico">${ico}</div><h3>${title}</h3><p>${body}</p></div>`,
    )
    .join("");

  // Honesty list
  document.getElementById("honesty-list").innerHTML = dict.honesty
    .map((line) => `<div class="row"><span class="x">✕</span><span>${line}</span></div>`)
    .join("");

  // Pricing lists
  const li = (items) =>
    items.map((t) => `<li><span class="c">✓</span><span>${t}</span></li>`).join("");
  document.getElementById("free-list").innerHTML = li(dict.free);
  document.getElementById("pro-list").innerHTML = li(dict.pro);

  // Active language button
  document.querySelectorAll("#langs button").forEach((b) => {
    b.classList.toggle("active", b.dataset.lang === lang);
  });

  setupReveal();

  // Opening this file directly (file://) restricts localStorage in some
  // browsers; fail silently rather than breaking language switching.
  try {
    localStorage.setItem("bf.site.lang", lang);
  } catch (e) {
    /* ignored — not essential, just remembers the choice for next visit */
  }
}

// Fades + slides each `.reveal` element in once it scrolls into view. Safe to
// call repeatedly (e.g. after a language switch re-renders innerHTML) — it
// only (re-)observes elements that aren't already marked `.in-view`.
function setupReveal() {
  if (!("IntersectionObserver" in window)) {
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in-view"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 },
  );
  document.querySelectorAll(".reveal:not(.in-view)").forEach((el) => io.observe(el));
}

// "Live wallpaper": a slow-drifting particle network on a full-screen canvas,
// layered under the color blobs. Skipped entirely under reduced-motion.
function setupParticles() {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx = canvas.getContext("2d");
  let w, h, particles;
  const COUNT = 46;
  const LINK_DIST = 130;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  particles = Array.from({ length: COUNT }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.25,
    vy: (Math.random() - 0.5) * 0.25,
  }));

  function step() {
    ctx.clearRect(0, 0, w, h);
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
    }
    ctx.strokeStyle = "rgba(91,140,255,0.16)";
    ctx.lineWidth = 1;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i],
          b = particles[j];
        const dx = a.x - b.x,
          dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < LINK_DIST) {
          ctx.globalAlpha = 1 - dist / LINK_DIST;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(91,140,255,0.6)";
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// Makes the hero mockup feel alive: the gauge numbers drift with a small
// random walk. Purely cosmetic — clearly labeled "Demo" so nobody mistakes
// it for a real read of their machine.
function setupLiveGauges() {
  const els = document.querySelectorAll(".mockup-gauge-value");
  if (!els.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let state = [32, 54, 18];
  setInterval(() => {
    state = state.map((v) => Math.max(8, Math.min(92, v + (Math.random() * 16 - 8))));
    els.forEach((el, i) => {
      if (state[i] != null) el.textContent = Math.round(state[i]) + "%";
    });
  }, 1800);
}

// A genuinely real elapsed-time counter (not invented data) labeling the
// hero mockup as a demo, so the "live" feel never implies it's reading the
// visitor's actual PC.
function setupDemoTicker() {
  const el = document.getElementById("demo-ticker");
  if (!el) return;
  const start = Date.now();
  function tick() {
    const secs = Math.floor((Date.now() - start) / 1000);
    const dict = I18N[CURRENT_LANG] || I18N.en;
    el.textContent = (dict["shots.demoPreview"] || "Demo · {n}s").replace("{n}", secs);
  }
  tick();
  setInterval(tick, 1000);
}

// Click any screenshot to view it full-size; click the backdrop, the close
// button, or press Escape to dismiss.
function setupLightbox() {
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const closeBtn = document.getElementById("lightbox-close");
  if (!lightbox || !lightboxImg) return;

  function open(src, alt) {
    lightboxImg.src = src;
    lightboxImg.alt = alt || "";
    lightbox.classList.add("open");
  }
  function close() {
    lightbox.classList.remove("open");
    lightboxImg.src = "";
  }

  document.querySelectorAll(".shot-card img").forEach((img) => {
    img.addEventListener("click", () => open(img.src, img.alt));
  });
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) close();
  });
  closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}

// BUY_URL is still a placeholder until Stripe (or another processor) is
// actually wired up — pointing the button at it leads to a broken
// AccessDenied page. Until a real link is configured, intercept the click
// and explain instead of navigating somewhere broken.
function setupBuyButton() {
  const buy = document.getElementById("buy");
  if (!buy) return;
  const isPlaceholder = BUY_URL.includes("your-payment-link");
  if (!isPlaceholder) {
    buy.href = BUY_URL;
    return;
  }
  buy.href = "#download";
  buy.addEventListener("click", (e) => {
    e.preventDefault();
    const dict = I18N[CURRENT_LANG] || I18N.en;
    alert(dict["pricing.comingSoon"] || I18N.en["pricing.comingSoon"]);
    document.getElementById("download")?.scrollIntoView({ behavior: "smooth" });
  });
}

function init() {
  document.getElementById("download-link").href = DOWNLOAD_URL;
  setupBuyButton();

  document.querySelectorAll("#langs button").forEach((b) => {
    b.addEventListener("click", () => apply(b.dataset.lang));
  });

  let saved = null;
  try {
    saved = localStorage.getItem("bf.site.lang");
  } catch (e) {
    /* ignored — falls back to browser language below */
  }
  const sys = (navigator.language || "en").slice(0, 2);
  apply(saved || (["hu", "de"].includes(sys) ? sys : "en"));

  setupParticles();
  setupLiveGauges();
  setupDemoTicker();
  setupLightbox();
}

init();
