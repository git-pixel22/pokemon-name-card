// ── Data (ported from backend) ───────────────────────────────────────────────

const GENERATIONS = [
  [1,   151],   // Gen 1 — Red/Blue
  [152, 251],   // Gen 2 — Gold/Silver
  [252, 386],   // Gen 3 — Ruby/Sapphire
  [387, 493],   // Gen 4 — Diamond/Pearl
  [494, 649],   // Gen 5 — Black/White
  [650, 721],   // Gen 6 — X/Y
  [722, 809],   // Gen 7 — Sun/Moon
  [810, 905],   // Gen 8 — Sword/Shield
  [906, 1025],  // Gen 9 — Scarlet/Violet
];

const GEN_NAMES = [
  "Red & Blue", "Gold & Silver", "Ruby & Sapphire",
  "Diamond & Pearl", "Black & White", "X & Y",
  "Sun & Moon", "Sword & Shield", "Scarlet & Violet",
];

const COUNTRY_VIBES = {
  US: ["adventurous", "🇺🇸"], GB: ["sophisticated", "🇬🇧"],
  JP: ["legendary",   "🇯🇵"], BR: ["fierce",        "🇧🇷"],
  IN: ["wise",        "🇮🇳"], DE: ["precise",       "🇩🇪"],
  FR: ["elegant",     "🇫🇷"], CA: ["chill",         "🇨🇦"],
  AU: ["wild",        "🇦🇺"], MX: ["spirited",      "🇲🇽"],
  KR: ["strategic",   "🇰🇷"], CN: ["ancient",       "🇨🇳"],
  RU: ["resilient",   "🇷🇺"], IT: ["passionate",    "🇮🇹"],
  ES: ["bold",        "🇪🇸"], NG: ["unstoppable",   "🇳🇬"],
  PH: ["tenacious",   "🇵🇭"], ID: ["harmonious",    "🇮🇩"],
  PK: ["determined",  "🇵🇰"], TR: ["fearless",      "🇹🇷"],
};

const VIBE_FLAVOR = {
  adventurous:  "Always charging headfirst — no cave left unexplored.",
  sophisticated:"Prefers strategy over brute force. Rarely sweats.",
  legendary:    "Rarely encountered in the wild. Immediately respected.",
  fierce:       "Strikes fast and leaves a permanent impression.",
  wise:         "Ancient knowledge flows through every single move.",
  precise:      "Every action calculated. No wasted energy.",
  elegant:      "Battles with grace. Wins with style.",
  chill:        "Unshakeable. Relaxed even when the world is on fire.",
  wild:         "Unpredictable. That's the whole strategy.",
  spirited:     "Never backs down. Never runs out of energy.",
  strategic:    "Three moves ahead. Always.",
  ancient:      "Power that predates the Pokédex itself.",
  resilient:    "Knocked down seven times. Gets up eight.",
  passionate:   "Fights with the heart, not just the stats.",
  bold:         "First in, last out.",
  unstoppable:  "Has no concept of 'impossible'.",
  tenacious:    "Holds on longer than anyone thought possible.",
  harmonious:   "Balances power and peace like no other.",
  determined:   "The mission doesn't end until it's done.",
  fearless:     "Stares down legendaries without blinking.",
  mysterious:   "Origin unknown. Power undeniable.",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function ageToGenIndex(age) {
  if (age >= 55) return 0;
  if (age >= 45) return 1;
  if (age >= 38) return 2;
  if (age >= 30) return 3;
  if (age >= 24) return 4;
  if (age >= 18) return 5;
  if (age >= 13) return 6;
  if (age >= 8)  return 7;
  return 8;
}

// Deterministic djb2 hash — same name always picks the same Pokémon
function nameHash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(hash, 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

// ── Core logic ───────────────────────────────────────────────────────────────

let lastResult = null;

async function analyze() {
  const name = document.getElementById('nameInput').value.trim();
  if (!name || name.length < 2) return;

  setLoading(true);
  hideError();
  hideCard();

  try {
    const encoded = encodeURIComponent(name);

    // Hit all 3 name APIs in parallel
    const [ageData, genderData, nationData] = await Promise.all([
      fetch(`https://api.agify.io/?name=${encoded}`).then(r => r.json()),
      fetch(`https://api.genderize.io/?name=${encoded}`).then(r => r.json()),
      fetch(`https://api.nationalize.io/?name=${encoded}`).then(r => r.json()),
    ]);

    const estimatedAge = ageData.age || 25;
    const gender       = genderData.gender || 'unknown';
    const countries    = nationData.country || [];
    const topCountry   = countries.length ? countries[0].country_id : 'US';

    // Determine generation from estimated age
    const genIndex          = ageToGenIndex(estimatedAge);
    const [genStart, genEnd] = GENERATIONS[genIndex];
    const pokemonId         = genStart + (nameHash(name.toLowerCase()) % (genEnd - genStart + 1));

    // Fetch Pokémon + species data in parallel
    const [poke, species] = await Promise.all([
      fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`).then(r => r.json()),
      fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokemonId}`).then(r => r.json()),
    ]);

    const types  = poke.types.map(t => t.type.name);
    const sprite = poke.sprites.other['official-artwork'].front_default
                || poke.sprites.front_default;

    const pokedexText = (species.flavor_text_entries || [])
      .filter(e => e.language.name === 'en')
      .map(e => e.flavor_text.replace(/[\n\f]/g, ' '))[0] || '';

    const [vibe, flag] = COUNTRY_VIBES[topCountry] || ['mysterious', '🌍'];

    const data = {
      pokemon_name:    poke.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      pokemon_id:      pokemonId,
      sprite,
      types,
      estimated_age:   estimatedAge,
      gender,
      country:         topCountry,
      country_flag:    flag,
      vibe,
      generation:      genIndex + 1,
      gen_games:       GEN_NAMES[genIndex],
      pokedex_text:    pokedexText,
      personality:     VIBE_FLAVOR[vibe] || 'An enigma wrapped in mystery.',
    };

    lastResult = data;
    renderCard(name, data);
  } catch (e) {
    showError(e.message || 'Something went wrong.');
  } finally {
    setLoading(false);
  }
}

// ── Rendering ────────────────────────────────────────────────────────────────

function renderCard(name, d) {
  const primaryType = d.types[0];

  document.getElementById('cardName').textContent = name.toUpperCase();
  document.getElementById('cardNum').textContent  = `#${String(d.pokemon_id).padStart(4, '0')}`;

  const sprite = document.getElementById('sprite');
  sprite.src = d.sprite;
  sprite.alt = d.pokemon_name;

  document.querySelector('.card-sprite-wrap').className = `card-sprite-wrap glow-${primaryType}`;

  document.getElementById('typeBadges').innerHTML = d.types
    .map(t => `<span class="type-badge type-${t}">${t}</span>`)
    .join('');

  document.getElementById('pokemonName').textContent = d.pokemon_name;
  document.getElementById('flavorText').textContent  = d.pokedex_text ? `"${d.pokedex_text}"` : '';

  document.getElementById('statGen').textContent     = `Gen ${d.generation} — ${d.gen_games}`;
  document.getElementById('statAge').textContent     = `~${d.estimated_age} yrs`;
  document.getElementById('statCountry').textContent = `${d.country_flag} ${d.country}`;
  document.getElementById('statVibe').textContent    = capitalize(d.vibe);

  document.getElementById('personality').textContent = `✦ ${d.personality}`;

  showCard();
}

function shareOnTwitter() {
  if (!lastResult) return;
  const d = lastResult;

  const tweet = `I'm ${d.pokemon_name} ${d.country_flag}\nGen ${d.generation} · ${d.types.join('/')} · ${capitalize(d.vibe)}\n\npokéname.vercel.app`;

  window.open(`https://x.com/compose/tweet?text=${encodeURIComponent(tweet)}`, '_blank');
}

// ── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('nameInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') analyze();
  });
});

// ── UI helpers ───────────────────────────────────────────────────────────────

function setLoading(on) {
  const btn    = document.getElementById('searchBtn');
  const text   = document.getElementById('btnText');
  const loader = document.getElementById('btnLoader');
  btn.disabled = on;
  text.classList.toggle('hidden', on);
  loader.classList.toggle('hidden', !on);
}

function showCard()  { document.getElementById('card').classList.remove('hidden'); }
function hideCard()  { document.getElementById('card').classList.add('hidden'); }
function showError(msg) {
  const el = document.getElementById('error');
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideError() { document.getElementById('error').classList.add('hidden'); }
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
