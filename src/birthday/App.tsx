// @ts-nocheck
import './arcade.css';
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  Crown,
  Download,
  Gamepad2,
  Gem,
  Gift,
  Grid2X2,
  Heart,
  Home as HomeIcon,
  ImagePlus,
  LockKeyhole,
  Mail,
  Music2,
  Play,
  RotateCcw,
  Settings2,
  Sparkles,
  Star,
  Ticket,
  Trash2,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { Link, useLocation } from '@tanstack/react-router';
import { downloadSourceZip } from '@/lib/download-source.functions';

type GameId = 'wheel' | 'slots' | 'memory' | 'hearts';
type RewardId = 'theme' | 'vip' | 'boost' | 'letter';
type SymbolId = 'berry' | 'heart' | 'star' | 'ticket' | 'crown' | 'sweet';

const games: { id: GameId; number: string; title: string; description: string }[] = [
  { id: 'wheel', number: '01', title: 'Lucky Wheel', description: 'Let the little wheel decide.' },
  { id: 'slots', number: '02', title: 'Cupid Slots', description: 'Three chances, one sweet jackpot.' },
  { id: 'memory', number: '03', title: 'Kawaii Memory', description: 'Find the pairs hiding in plain sight.' },
  { id: 'hearts', number: '04', title: 'Pop-a-Heart', description: 'Catch a heart before it drifts away.' },
];

const rewards: { id: RewardId; title: string; description: string; cost: number; icon: typeof Gift }[] = [
  { id: 'theme', title: 'Golden Arcade Theme', description: 'A warm little glow for your next visit.', cost: 250, icon: Star },
  { id: 'vip', title: 'VIP Arcade Champion', description: 'The fanciest badge in the whole arcade.', cost: 500, icon: Crown },
  { id: 'boost', title: '2x Ticket Boost', description: 'Every future win gets a little extra sparkle.', cost: 1000, icon: Zap },
  { id: 'letter', title: 'Birthday Letter', description: 'A private note, waiting just for you.', cost: 5000, icon: Mail },
];

const ticketPrizes: { symbol: SymbolId; amount: number; chance: number }[] = [
  { symbol: 'ticket', amount: 5, chance: 35 },
  { symbol: 'sweet', amount: 10, chance: 25 },
  { symbol: 'heart', amount: 20, chance: 18 },
  { symbol: 'star', amount: 40, chance: 12 },
  { symbol: 'berry', amount: 80, chance: 7 },
  { symbol: 'crown', amount: 100, chance: 3 },
];
const slotPairPayout = 10;
const slotPrizes = ticketPrizes.map(prize => ({
  ...prize,
  triplePayout: prize.symbol === 'crown' ? 777 : 40,
}));
const pickWeightedSlotSymbol = () => {
  const roll = Math.random() * 100;
  let accumulated = 0;
  return slotPrizes.find(prize => {
    accumulated += prize.chance;
    return roll < accumulated;
  })?.symbol ?? 'ticket';
};
const slotNoMatchChance = slotPrizes.reduce((total, first, firstIndex) => total + slotPrizes.reduce((inner, second, secondIndex) => {
  if (firstIndex === secondIndex) return inner;
  const firstChance = first.chance / 100;
  const secondChance = second.chance / 100;
  return inner + firstChance * secondChance * (1 - firstChance - secondChance);
}, 0), 0);
const slotAnyMatchChance = 1 - slotNoMatchChance;
const slotTripleChance = slotPrizes.reduce((total, prize) => total + Math.pow(prize.chance / 100, 3), 0);
const slotJackpotChance = Math.pow((slotPrizes.find(prize => prize.symbol === 'crown')?.chance ?? 0) / 100, 3);
const formatSlotChance = (chance: number) => `${(chance * 100).toFixed(chance * 100 < 1 ? 2 : 1)}%`;
const slotSymbolLabels: Record<SymbolId, string> = {
  ticket: 'Ticket',
  sweet: 'Sweet',
  heart: 'Heart',
  star: 'Star',
  berry: 'Berry',
  crown: 'Crown',
};
const wheelColors: Record<SymbolId, string> = {
  ticket: '#ff8fab',
  sweet: '#b9fbc0',
  heart: '#ffc2d4',
  star: '#241b2e',
  berry: '#ff8fab',
  crown: '#b9fbc0',
};
const wheelGradient = `conic-gradient(${ticketPrizes.reduce<string[]>((stops, prize, index) => {
  const start = ticketPrizes.slice(0, index).reduce((total, item) => total + item.chance, 0);
  const end = start + prize.chance;
  stops.push(`${wheelColors[prize.symbol]} ${start}% ${end}%`);
  return stops;
}, []).join(', ')})`;
const wheelSegment = (index: number) => {
  const start = ticketPrizes.slice(0, index).reduce((total, prize) => total + prize.chance, 0);
  return { start, end: start + ticketPrizes[index].chance, midpoint: start + ticketPrizes[index].chance / 2 };
};
const pickWeightedPrize = () => {
  const roll = Math.random() * 100;
  let accumulated = 0;
  return ticketPrizes.findIndex(prize => {
    accumulated += prize.chance;
    return roll < accumulated;
  });
};
const wheelLabelPosition = (index: number): CSSProperties => {
  const { midpoint } = wheelSegment(index);
  const angle = (midpoint * 3.6 - 90) * Math.PI / 180;
  const labelRadius = 40;
  return {
    left: `${50 + Math.cos(angle) * labelRadius}%`,
    top: `${50 + Math.sin(angle) * labelRadius}%`,
  };
};
const shuffled = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);

function usePersistentState<T>(key: string, initial: T): [T, (value: T | ((previous: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? (JSON.parse(saved) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private browsing */ }
  }, [key, value]);
  return [value, setValue];
}

type MusicRuntime = {
  context: AudioContext;
  master: GainNode;
  interval: number;
};

function useArcadeMusic(): [boolean, () => void] {
  const [musicOn, setMusicOn] = usePersistentState('birthday-arcade-music', false);
  const runtime = useRef<MusicRuntime | null>(null);

  const stopMusic = () => {
    const active = runtime.current;
    if (!active) return;
    window.clearInterval(active.interval);
    active.master.gain.cancelScheduledValues(active.context.currentTime);
    active.master.gain.setTargetAtTime(0, active.context.currentTime, 0.08);
    window.setTimeout(() => void active.context.close(), 240);
    runtime.current = null;
  };

  const startMusic = () => {
    if (runtime.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const AudioContextClass = window.AudioContext
      ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const master = context.createGain();
    master.gain.value = 0.035;
    master.connect(context.destination);
    const notes = [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23];
    let noteIndex = 0;
    const playNote = () => {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const now = context.currentTime;
      oscillator.type = 'sine';
      oscillator.frequency.value = notes[noteIndex % notes.length];
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime(0.8, now + 0.05);
      envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
      oscillator.connect(envelope);
      envelope.connect(master);
      oscillator.start(now);
      oscillator.stop(now + 0.76);
      noteIndex += 1;
    };

    playNote();
    const interval = window.setInterval(playNote, 900);
    runtime.current = { context, master, interval };
  };

  useEffect(() => {
    if (musicOn) startMusic();
    else stopMusic();
    return stopMusic;
  }, [musicOn]);

  return [musicOn, () => {
    setMusicOn(previous => {
      if (previous) stopMusic();
      else startMusic();
      return !previous;
    });
  }];
}

function SymbolIcon({ symbol, size = 18 }: { symbol: SymbolId; size?: number }) {
  const common = { size, strokeWidth: 2.1 };
  if (symbol === 'heart') return <Heart {...common} fill="currentColor" />;
  if (symbol === 'star') return <Star {...common} fill="currentColor" />;
  if (symbol === 'ticket') return <Ticket {...common} />;
  if (symbol === 'crown') return <Crown {...common} />;
  if (symbol === 'sweet') return <Gift {...common} />;
  return <Sparkles {...common} />;
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

const TOGETHER_SINCE = new Date(2025, 10, 28); // 28 Nov 2025
const TRACK_SECONDS = 268; // 4:28

function Shell({ children, tickets, musicOn, toggleMusic }: { children: ReactNode; tickets: number; musicOn: boolean; toggleMusic: () => void }) {
  const location = useLocation({ select: (s) => s.pathname });
  const now = useNow();
  const [playElapsed, setPlayElapsed] = useState(0);
  useEffect(() => {
    if (!musicOn) { setPlayElapsed(0); return; }
    const timer = window.setInterval(() => setPlayElapsed(previous => (previous + 1) % (TRACK_SECONDS + 1)), 1000);
    return () => window.clearInterval(timer);
  }, [musicOn]);
  const togetherMs = Math.max(0, now.getTime() - TOGETHER_SINCE.getTime());
  const togetherDays = Math.floor(togetherMs / 86_400_000);
  const togetherH = String(Math.floor(togetherMs / 3_600_000) % 24).padStart(2, '0');
  const togetherM = String(Math.floor(togetherMs / 60_000) % 60).padStart(2, '0');
  const togetherS = String(Math.floor(togetherMs / 1000) % 60).padStart(2, '0');
  const clockTime = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const clockDate = now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  const formatTrackTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const links = [
    { href: '/', label: 'Home', icon: HomeIcon },
    { href: '/arcade', label: 'Arcade', icon: Gamepad2 },
    { href: '/letter', label: 'Letter', icon: Mail },
    { href: '/vault', label: 'Vault', icon: Gem },
    { href: '/settings', label: 'Settings', icon: Settings2 },
  ];
  return (
    <div className="arcade-app">
      <div className="dashboard-shell">
        <aside className="side-rail">
          <Link to="/" className="profile-mark" data-testid="link-home-brand" aria-label="Birthday Arcade home">
            <span className="profile-orb"><Heart size={15} fill="currentColor" /></span>
            <span className="profile-copy"><strong>LEVEL 02</strong><b>HER-BIRTHDAY</b></span>
          </Link>
          <nav className="side-nav" aria-label="Main navigation">
            {links.map(({ href, label, icon: Icon }) => (
              <Link key={href} to={href} className={`side-nav-link ${location === href ? 'active' : ''}`} data-testid={`link-nav-${label.toLowerCase().replace(' ', '-')}`} aria-current={location === href ? 'page' : undefined}>
                <Icon size={14} /> <span>{label}</span>
                {label === 'Letters' && <LockKeyhole size={10} className="side-nav-lock" />}
              </Link>
            ))}
          </nav>
          <div className="together-card">
            <span>TOGETHER FOR</span>
            <strong>{togetherDays} <small>DAYS</small></strong>
            <p>{togetherH} : {togetherM} : {togetherS}</p>
            <small>since 28. 11. 2025 ✦</small>
          </div>
          <div className="mini-player">
            <div className={`mini-player-disc ${musicOn ? 'is-spinning' : ''}`}><Music2 size={14} /></div>
            <strong>{musicOn ? 'Now playing' : 'No track playing'}</strong>
            <span>{musicOn ? 'soft lights / level 02' : '—'}</span>
            <div className="mini-player-progress"><i style={{ width: `${(playElapsed / TRACK_SECONDS) * 100}%` }} /></div>
            <div className="mini-player-controls">
              <small>{musicOn ? formatTrackTime(playElapsed) : '0:00'}</small>
              <button type="button" onClick={toggleMusic} aria-label={musicOn ? 'Pause music' : 'Play music'} data-testid="button-toggle-music-sidebar">
                {musicOn ? <Volume2 size={13} /> : <Play size={12} fill="currentColor" />}
              </button>
              <small>4:28</small>
            </div>
          </div>
          <div className="rail-footer">v1.0.0 <span>© 2026 For Her, forever.</span></div>
        </aside>
        <div className="dashboard-main">
          <header className="dashboard-topbar">
            <div className="topbar-breadcrumb"><span>HER</span><b> / </b><strong>LEVEL 02 : HER-BIRTHDAY</strong></div>
            <div className="topbar-actions">
              <div className="topbar-time"><strong>{clockTime}</strong><span>{clockDate}</span></div>
              <div className="topbar-tickets" data-testid="text-ticket-count" aria-label={`${tickets.toLocaleString()} tickets`}><Ticket size={13} /><b>{tickets}</b></div>
              <button className={`topbar-music ${musicOn ? 'on' : ''}`} onClick={toggleMusic} aria-label={musicOn ? 'Turn music off' : 'Turn music on'} aria-pressed={musicOn}>
                {musicOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </button>
              <div className="topbar-avatar" aria-label="Adel profile">A</div>
            </div>
          </header>
          <main className="page-content">{children}</main>
          <footer className="site-footer"><span>made with soft lights &amp; very good memories</span><span>for Adel · level 02</span></footer>
        </div>
      </div>
    </div>
  );
}

type Memory = { id: string; src: string };

const readMemoryFile = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('read failed'));
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => reject(new Error('image failed'));
    img.onload = () => {
      const maxSide = 720;
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.src = String(reader.result);
  };
  reader.readAsDataURL(file);
});

function Home({ tickets, musicOn, toggleMusic }: { tickets: number; musicOn: boolean; toggleMusic: () => void }) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [memories, setMemories] = usePersistentState<Memory[]>('birthday-arcade-memories', []);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const now = useNow();
  const togetherDays = Math.max(0, Math.floor((now.getTime() - TOGETHER_SINCE.getTime()) / 86_400_000));
  const addMemoryFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const additions: Memory[] = [];
    for (const file of Array.from(files).slice(0, 9)) {
      try { additions.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, src: await readMemoryFile(file) }); } catch { /* skip unreadable file */ }
    }
    if (additions.length) setMemories(previous => [...previous, ...additions]);
  };
  const quickTiles = [
    { href: '/arcade', label: 'Arcade', blurb: 'Four little games, infinite tickets to win.', icon: Gamepad2, tone: 'pink', testId: 'quick-access-music' },
    { href: '/letter', label: 'Letter', blurb: 'A note that has been waiting all year.', icon: Mail, tone: 'lilac', testId: 'quick-access-letters' },
    { href: '/vault', label: 'Vault', blurb: 'Spend tickets on real-life rewards.', icon: Gem, tone: 'yellow', testId: 'quick-access-for-you' },
    { href: '/settings', label: 'Settings', blurb: 'Tune the arcade to feel like home.', icon: Settings2, tone: 'mint', testId: 'quick-access-gallery' },
  ];
  return (
    <div className="home-bento reveal">
      <section className="home-tile home-hero">
        <div className="hero-night-sky" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>
        <Heart className="home-hero-heart" size={180} fill="currentColor" aria-hidden="true" />
        <div className="home-hero-copy">
          <span className="home-kicker">Welcome back · Player 01</span>
          <h1>My Favorite Human</h1>
          <p>"This is not just a website. This is where our memories live."</p>
          <div className="home-hero-mood">
            <span>TODAY'S MOOD</span>
            <strong><Heart size={13} fill="currentColor" /> 100%</strong>
            <small>Thank you for being here ☕</small>
          </div>
        </div>
      </section>

      <section className="home-tile home-stat home-stat-tickets" data-testid="text-ticket-count-home" aria-label={`${tickets.toLocaleString()} tickets`}>
        <span className="home-stat-label">Tickets</span>
        <div className="home-stat-value"><i className="home-pulse" /><strong>{tickets.toString().padStart(3, '0')}</strong></div>
        <Link to="/vault" className="home-stat-link">Open vault <ChevronRight size={11} /></Link>
      </section>

      <section className="home-tile home-stat home-stat-days">
        <span className="home-stat-label">Days together</span>
        <div className="home-stat-value"><strong>{togetherDays}</strong></div>
        <small className="home-stat-sub">since 28. 11. 2025 ✦</small>
      </section>

      <section className={`home-tile home-music ${musicOn ? 'is-playing' : ''}`}>
        <div className={`mini-player-disc ${musicOn ? 'is-spinning' : ''}`}><Music2 size={20} /></div>
        <div className="home-music-copy">
          <strong>{musicOn ? 'soft lights / level 02' : 'No track playing'}</strong>
          <span>{musicOn ? 'Now playing' : 'Press play for a little atmosphere'}</span>
        </div>
        <button type="button" className="home-music-play" onClick={toggleMusic} aria-label={musicOn ? 'Pause music' : 'Play music'} data-testid="button-toggle-music-home">
          {musicOn ? <Volume2 size={14} /> : <Play size={13} fill="currentColor" />}
        </button>
      </section>

      <section className="home-tile home-memories">
        <div className="dashboard-panel-heading">
          <h2><ImagePlus size={13} /> Memory Vault</h2>
          <button type="button" onClick={() => setGalleryOpen(true)} data-testid="button-view-memory-gallery">View Gallery <ArrowRight size={12} /></button>
        </div>
        <div className="home-memory-row" aria-label="Memory polaroid gallery">
          {memories.length === 0 && [0, 1, 2].map(index => (
            <div className={`empty-polaroid empty-polaroid-${index + 1}`} key={index}>
              <div><ImagePlus size={17} /></div>
            </div>
          ))}
          {memories.slice(-3).map((memory, index) => (
            <div className={`empty-polaroid filled-polaroid empty-polaroid-${index + 1}`} key={memory.id}>
              <img src={memory.src} alt={`Memory ${index + 1}`} />
            </div>
          ))}
          <button type="button" className="home-memory-add" onClick={() => fileInput.current?.click()} data-testid="button-add-memory">
            <ImagePlus size={18} />
            <span>NEW PHOTO</span>
            <small><b>{memories.length}</b> saved</small>
          </button>
        </div>
        <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={event => { void addMemoryFiles(event.target.files); event.target.value = ''; }} />
      </section>

      <section className="home-quick">
        {quickTiles.map(({ href, label, blurb, icon: Icon, tone, testId }) => (
          <Link key={href} to={href} className={`home-tile home-quick-tile home-tone-${tone}`} data-testid={testId}>
            <span className="home-quick-icon"><Icon size={18} /></span>
            <strong>{label}</strong>
            <p>{blurb}</p>
          </Link>
        ))}
      </section>

      <section className="home-tile home-banner">
        <div className="home-banner-copy">
          <span>LEVEL 02 : HER-BIRTHDAY</span>
          <strong>Made for you, <em>always.</em></strong>
          <p>Four small games, a letter, and a little room for the memories still to come.</p>
        </div>
        <Link to="/arcade" className="dashboard-cta" data-testid="link-enter-arcade">Enter the arcade <ArrowRight size={13} /></Link>
      </section>
      {galleryOpen && (
        <div className="memory-gallery-overlay" role="dialog" aria-modal="true" aria-labelledby="memory-gallery-title">
          <div className="memory-gallery-dialog">
            <button type="button" className="memory-gallery-close" onClick={() => setGalleryOpen(false)} aria-label="Close memory gallery">×</button>
            <span className="welcome-kicker">Your little archive</span>
            <h2 id="memory-gallery-title">Memory Polaroids</h2>
            {memories.length === 0 && (
              <>
                <div className="gallery-empty-art"><ImagePlus size={21} /></div>
                <p>No memories here yet.<br />The first one is still waiting to be made.</p>
              </>
            )}
            {memories.length > 0 && (
              <div className="memory-gallery-grid">
                {memories.map((memory, index) => (
                  <figure className="memory-gallery-item" key={memory.id}>
                    <img src={memory.src} alt={`Memory ${index + 1}`} />
                    <button type="button" className="memory-delete" onClick={() => setMemories(previous => previous.filter(item => item.id !== memory.id))} aria-label={`Delete memory ${index + 1}`}><Trash2 size={12} /></button>
                  </figure>
                ))}
              </div>
            )}
            <div className="memory-gallery-actions">
              <button type="button" className="primary-button" onClick={() => fileInput.current?.click()} data-testid="button-gallery-add"><ImagePlus size={13} /> add a photo</button>
              <button type="button" className="dashboard-cta" onClick={() => setGalleryOpen(false)}>back to home <ArrowRight size={13} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GameArt({ id }: { id: GameId }) {
  if (id === 'wheel') return <div className="wheel" style={{ width: 90, height: 90, borderWidth: 4 }}><div className="wheel-center" style={{ width: 28, height: 28, fontSize: 8 }}>GO</div></div>;
  if (id === 'slots') return <div className="slot-machine" style={{ transform: 'scale(.55)' }}><div className="slot-window"><SymbolIcon symbol="berry" /></div><div className="slot-window"><SymbolIcon symbol="heart" /></div><div className="slot-window"><SymbolIcon symbol="star" /></div></div>;
  if (id === 'memory') return <div className="memory-board" style={{ transform: 'scale(.62)' }}><div className="memory-card flipped"><SymbolIcon symbol="berry" /></div><div className="memory-card"><Sparkles size={18} /></div><div className="memory-card flipped"><SymbolIcon symbol="sweet" /></div><div className="memory-card"><Sparkles size={18} /></div></div>;
  return <Heart size={64} fill="currentColor" />;
}

function Arcade({ tickets, addTickets, spendTickets }: { tickets: number; addTickets: (amount: number, message?: string) => void; spendTickets: (amount: number, message?: string) => boolean }) {
  const [selected, setSelected] = useState<GameId>('wheel');
  const [spinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [wheelSpin, setWheelSpin] = useState<{ from: number; to: number } | null>(null);
  const [wheelResult, setWheelResult] = useState('');
  const [wheelAmount, setWheelAmount] = useState(0);
  const [wheelFx, setWheelFx] = useState(0);
  const [wheelWinBig, setWheelWinBig] = useState(false);
  const [slotValue, setSlotValue] = useState<SymbolId[]>(['berry', 'heart', 'star']);
  const [slotResult, setSlotResult] = useState('');
  const [slotSpinning, setSlotSpinning] = useState(false);
  const [slotResultKind, setSlotResultKind] = useState<'match' | 'triple' | 'jackpot' | ''>('');
  const [slotFx, setSlotFx] = useState(0);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [memoryResult, setMemoryResult] = useState('');
  const [memoryFx, setMemoryFx] = useState(0);
  const [memoryDeck, setMemoryDeck] = useState(() => shuffled<SymbolId>(['berry', 'sweet', 'crown', 'heart', 'star', 'ticket', 'berry', 'sweet', 'crown', 'heart', 'star', 'ticket']));
  const [heartPosition, setHeartPosition] = useState({ left: 46, top: 43 });
  const [heartCount, setHeartCount] = useState(0);
  const [heartTime, setHeartTime] = useState(15);
  const [heartPlaying, setHeartPlaying] = useState(false);
  const [heartRoundTickets, setHeartRoundTickets] = useState(0);
  const [heartRare, setHeartRare] = useState(false);
  const [heartPopFx, setHeartPopFx] = useState<{ id: number; left: number; top: number; amount: number; rare: boolean } | null>(null);
  const [popMessage, setPopMessage] = useState('Spend 10 tickets to start a 15 second heart hunt.');
  useEffect(() => {
    if (!heartPlaying) return;
    const timer = window.setInterval(() => {
      setHeartTime(previous => {
        if (previous <= 1) {
          setHeartPlaying(false);
          setPopMessage(`Time! You caught ${heartCount} hearts and earned ${heartRoundTickets} tickets.`);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [heartPlaying, heartCount, heartRoundTickets]);

  const spinWheel = () => {
    if (spinning) return;
    setSpinning(true); setWheelResult(''); setWheelFx(0); setWheelWinBig(false);
    const prizeIndex = pickWeightedPrize();
    const amount = ticketPrizes[prizeIndex].amount;
    const targetAngle = wheelSegment(prizeIndex).midpoint * 3.6;
    const extraTurns = 5 + Math.floor(Math.random() * 2);
    const from = wheelRotation;
    const normalized = ((from % 360) + 360) % 360;
    const correction = (360 - targetAngle - normalized) % 360;
    const to = from + extraTurns * 360 + correction;
    setWheelSpin({ from, to });
    setWheelRotation(to);
    window.setTimeout(() => {
      setSpinning(false);
      setWheelSpin(null);
      setWheelResult(`You won ${amount} tickets.`);
      setWheelAmount(amount);
      setWheelWinBig(amount >= 80);
      setWheelFx(previous => previous + 1);
      addTickets(amount, `Lucky wheel paid ${amount} tickets`);
    }, 2850);
  };
  const spinSlots = () => {
    if (slotSpinning) return;
    const next = [0, 1, 2].map(() => pickWeightedSlotSymbol());
    setSlotValue(next);
    const tripleMatch = next[0] === next[1] && next[1] === next[2];
    const pairMatch = new Set(next).size <= 2;
    const crownJackpot = tripleMatch && next[0] === 'crown';
    const resultKind = crownJackpot ? 'jackpot' : tripleMatch ? 'triple' : pairMatch ? 'match' : '';
    const amount = crownJackpot ? 777 : tripleMatch ? 40 : pairMatch ? slotPairPayout : 0;
    setSlotSpinning(true);
    setSlotResult('');
    setSlotResultKind('');
    setSlotFx(0);
    window.setTimeout(() => {
      setSlotSpinning(false);
      setSlotResultKind(resultKind);
      setSlotResult(crownJackpot ? 'Crown jackpot — 777 tickets!' : tripleMatch ? `Triple hit — ${amount} tickets.` : pairMatch ? `Pair hit — ${amount} tickets.` : 'No match this time — try again.');
      if (amount > 0) {
        const nextFx = slotFx + 1;
        setSlotFx(nextFx);
        window.setTimeout(() => setSlotFx(current => current === nextFx ? 0 : current), 1200);
        addTickets(amount, `Cupid slots paid ${amount} tickets`);
      }
    }, 900);
  };
  const flipMemory = (index: number) => {
    if (flipped.length === 2 || flipped.includes(index) || matched.includes(index)) return;
    const next = [...flipped, index]; setFlipped(next);
    if (next.length === 2) {
      if (memoryDeck[next[0]] === memoryDeck[next[1]]) {
        const amount = ticketPrizes[Math.floor(Math.random() * ticketPrizes.length)].amount;
        const nextMatched = [...matched, ...next];
        setMatched(nextMatched);
        setFlipped([]);
        setMemoryResult(nextMatched.length === memoryDeck.length ? 'Board complete. You remembered everything.' : `Pair found — +${amount} tickets.`);
        const nextFx = memoryFx + 1;
        setMemoryFx(nextFx);
        window.setTimeout(() => setMemoryFx(current => current === nextFx ? 0 : current), 1100);
        addTickets(amount, `Memory pair paid ${amount} tickets`);
      } else {
        setMemoryResult('Not a pair — keep looking.');
        window.setTimeout(() => setFlipped([]), 700);
      }
    }
  };
  const startHeartRound = () => {
    if (heartPlaying) return;
    if (!spendTickets(10, '10 tickets spent — the heart hunt has begun.')) {
      setPopMessage(`You need 10 tickets to start. You have ${tickets}.`);
      return;
    }
    setHeartPlaying(true); setHeartTime(15); setHeartCount(0); setHeartRoundTickets(0); setHeartRare(false);
    setPopMessage('Catch every heart you can. The dark heart is worth 20.');
    setHeartPosition({ left: 7 + Math.floor(Math.random() * 82), top: 8 + Math.floor(Math.random() * 75) });
  };
  const popHeart = () => {
    if (!heartPlaying) return;
    const nextCount = heartCount + 1; setHeartCount(nextCount);
    const rare = Math.random() < 0.18; const amount = rare ? 20 : 5;
    setHeartRare(rare); setHeartRoundTickets(previous => previous + amount);
    const poppedAt = heartPosition;
    const fxId = Date.now();
    setHeartPopFx({ id: fxId, left: poppedAt.left, top: poppedAt.top, amount, rare });
    window.setTimeout(() => setHeartPopFx(current => current?.id === fxId ? null : current), 950);
    setHeartPosition({ left: 7 + Math.floor(Math.random() * 82), top: 8 + Math.floor(Math.random() * 75) });
    addTickets(amount, rare ? 'Rare dark heart caught: 20 tickets' : 'Heart caught: 5 tickets');
    setPopMessage(rare ? 'Rare dark heart! +20 tickets.' : 'Heart caught! +5 tickets.');
  };
  const resetMemory = () => { setFlipped([]); setMatched([]); setMemoryFx(0); setMemoryResult(''); setMemoryDeck(shuffled<SymbolId>(['berry', 'sweet', 'crown', 'heart', 'star', 'ticket', 'berry', 'sweet', 'crown', 'heart', 'star', 'ticket'])); };
  const current = games.find(game => game.id === selected) ?? games[0];
  return (
    <>
      <div className="page-header reveal"><div><div className="eyebrow">the main attraction · 04 games</div><h1 className="display-title">Pick a<br /><em>feeling.</em></h1></div><p className="body-copy">Your tickets are yours to keep. Try everything, follow your instincts, and remember: there is no wrong way to celebrate.</p></div>
      <div className="arcade-board" role="tablist" aria-label="Choose an arcade game">
        {games.map(game => (
          <button key={game.id} className={`game-card ${selected === game.id ? 'selected' : ''}`} onClick={() => setSelected(game.id)} role="tab" aria-selected={selected === game.id} data-testid={`button-game-${game.id}`}>
            <span className="game-number">{game.number}</span><h3>{game.title}</h3><p>{game.description}</p><div className="game-art"><GameArt id={game.id} /></div><span className="play-mini">{selected === game.id ? 'playing' : 'play'} <Play size={10} fill="currentColor" /></span>
          </button>
        ))}
      </div>
      <div className="game-studio">
        <section className="studio-panel" aria-live="polite">
          <div className="studio-top"><div className="studio-title"><div className="eyebrow">now playing · {current.number}</div><h2>{current.title}</h2><p>{current.description}</p></div><button className="ghost-button" onClick={() => setSelected('wheel')} data-testid="button-back-to-wheel"><RotateCcw size={14} /> reset view</button></div>
          <div className="game-action-zone">
            {selected === 'wheel' && (
              <div className="wheel-game text-center">
                <div className="wheel-cabinet">
                  <div className="wheel-marquee"><h3>Lucky Wheel</h3><span className="marquee-dots" aria-hidden="true"><i /><i /><i /></span></div>
                  <div className={`wheel-stage ${spinning ? 'is-spinning' : ''} ${wheelResult ? 'has-win' : ''}`}>
                    <div className="wheel-wrap">
                      <div
                        className={`wheel ${spinning ? 'is-spinning' : ''}`}
                        style={{
                          transform: spinning ? undefined : `rotate(${wheelRotation}deg)`,
                          background: wheelGradient,
                          '--wheel-start': `${wheelSpin?.from ?? wheelRotation}deg`,
                          '--wheel-end': `${wheelSpin?.to ?? wheelRotation}deg`,
                        } as CSSProperties}
                        aria-label="Prize wheel"
                      >
                        {ticketPrizes.map(({ symbol, amount }, index) => {
                          const onDark = wheelColors[symbol] === '#241b2e';
                          return <span className="wheel-prize" style={{ ...wheelLabelPosition(index), color: onDark ? '#ffc2d4' : '#241b2e' }} key={symbol}><SymbolIcon symbol={symbol} size={16} /><small>{amount}</small></span>;
                        })}
                        <div className="wheel-center">LUCK</div>
                        {wheelFx > 0 && <div className={`game-vfx wheel-vfx ${wheelWinBig ? 'is-big' : ''}`} key={wheelFx} aria-hidden="true"><span className="vfx-halo" /><span className="vfx-rays" /><span className="vfx-ring" /><span className="vfx-core"><b>{wheelWinBig ? 'BIG WIN' : 'WIN'}</b><small>+{wheelAmount} tickets</small></span>{Array.from({ length: 18 }, (_, index) => <i key={index} style={{ '--particle': index, '--angle': `${index * 20}deg` } as CSSProperties} />)}</div>}
                      </div>
                      <div className="pointer" />
                    </div>
                    <div className="wheel-entry"><span><Ticket size={11} /> free play</span><span>six tiny chances</span></div>
                    <div className="wheel-odds" aria-label="Wheel prizes">
                      {ticketPrizes.map(({ symbol, amount, chance }) => <span className="wheel-odd" key={amount} style={{ '--chip': wheelColors[symbol], color: wheelColors[symbol] === '#241b2e' ? '#ffc2d4' : '#241b2e' } as CSSProperties}><strong>{amount}</strong><small>{chance}%</small></span>)}
                    </div>
                  </div>
                  <div className="wheel-controls">
                    <div className="wheel-meter"><div><span>your tickets</span><strong>{tickets.toLocaleString()}</strong></div><i /><div><span>last win</span><strong>{wheelAmount > 0 ? `+${wheelAmount}` : '—'}</strong></div></div>
                    <button className="wheel-spin-button" onClick={spinWheel} disabled={spinning} data-testid="button-spin-wheel" aria-busy={spinning}>{spinning ? 'spinning…' : 'spin now'} <Sparkles size={15} /></button>
                    <div className="result-callout wheel-result" role="status" data-testid="text-wheel-result">{wheelResult || 'The wheel is waiting for you.'}</div>
                  </div>
                  <i className="cabinet-btn is-left" aria-hidden="true" /><i className="cabinet-btn is-right" aria-hidden="true" />
                </div>
              </div>
            )}
            {selected === 'slots' && (
              <div className="slots-game slot-command-center">
                <div className="slots-heading">
                  <div>
                    <span className="eyebrow">cupid co. // probability lab</span>
                    <h3>The Dream Machine.</h3>
                    <p>Three weighted reels. One tiny chance to make the whole room sparkle.</p>
                  </div>
                  <div className="slot-system-status"><i /> <span>system online</span><b>free play</b></div>
                </div>
                <div className="slot-command-grid">
                  <aside className="slot-weights slot-panel" aria-label="Reel weights">
                    <div className="slot-panel-head"><span>01 // reel weights</span><small>each reel</small></div>
                    <div className="slot-weight-list">
                      {slotPrizes.map(({ symbol, chance }) => <div className="slot-weight-row" key={symbol}><span className="slot-weight-name"><SymbolIcon symbol={symbol} size={13} />{slotSymbolLabels[symbol]}</span><strong>{chance}%</strong><span className="slot-weight-track"><i style={{ width: `${chance}%`, background: wheelColors[symbol] }} /></span></div>)}
                    </div>
                    <div className="slot-panel-foot"><span>REEL SEED</span><strong>HONEST / LIVE</strong></div>
                  </aside>
                  <div className={`slot-stage ${slotSpinning ? 'is-spinning' : ''} ${slotResultKind === 'match' ? 'has-match' : ''} ${slotResultKind === 'triple' ? 'has-triple' : ''} ${slotResultKind === 'jackpot' ? 'has-jackpot' : ''}`}>
                    <div className={`slot-reactor-field ${slotSpinning ? 'is-spinning' : ''} ${slotFx > 0 ? 'has-fx' : ''} ${slotResultKind ? `is-${slotResultKind}` : ''}`} aria-hidden="true"><span className="reactor-grid" /><span className="reactor-orbit orbit-one" /><span className="reactor-orbit orbit-two" /><span className="reactor-beam" /><span className="reactor-core" />{Array.from({ length: 16 }, (_, index) => <i key={index} style={{ '--particle': index, '--angle': `${index * 22.5}deg` } as CSSProperties} />)}</div>
                    <div className="slot-machine-label"><span>♡ DREAM MACHINE / 03</span><small>{slotSpinning ? 'LOCKING REELS' : 'READY TO PULL'}</small></div>
                    <div className={`slot-machine ${slotSpinning ? 'is-spinning' : ''} ${slotResultKind === 'match' ? 'has-match' : ''} ${slotResultKind === 'triple' ? 'has-triple' : ''} ${slotResultKind === 'jackpot' ? 'has-jackpot' : ''}`}>
                      <div className="slot-reels">
                        {slotValue.map((symbol, index) => <div className={`slot-window ${slotSpinning ? 'is-spinning' : ''}`} key={`${symbol}-${index}`}><span className="reel-number">0{index + 1}</span><span className="reel-sheen" /><span className="reel-scanline" /><SymbolIcon symbol={symbol} /><small>{slotSymbolLabels[symbol]}</small></div>)}
                      </div>
                      <button className={`lever ${slotSpinning ? 'is-pulled' : ''}`} onClick={spinSlots} disabled={slotSpinning} aria-label="Pull slot lever" data-testid="button-spin-slots"><span>GO</span></button>
                      {slotFx > 0 && <div className={`slot-burst ${slotResultKind === 'jackpot' ? 'is-jackpot' : ''} ${slotResultKind === 'triple' ? 'is-triple' : ''}`} key={slotFx} aria-hidden="true"><span className="burst-halo" /><span className="burst-rays" /><span className="burst-ring" /><span className="burst-core"><b>{slotResultKind === 'jackpot' ? 'JACKPOT' : slotResultKind === 'triple' ? 'TRIPLE' : 'PAIR'}</b><small>{slotResultKind === 'jackpot' ? '777 tickets' : slotResultKind === 'triple' ? '40 tickets' : '10 tickets'}</small></span>{Array.from({ length: 18 }, (_, index) => <i key={index} style={{ '--particle': index, '--angle': `${index * 20}deg` } as CSSProperties} />)}</div>}
                    </div>
                    <div className="slot-machine-foot"><span>INSERT JOY</span><span className="slot-lights"><i /><i /><i /></span><span>GOOD LUCK</span></div>
                    <div className={`slot-stage-readout ${slotResultKind ? `is-${slotResultKind}` : ''}`}><span>{slotSpinning ? 'CALCULATING OUTCOME' : slotResultKind ? slotResultKind.toUpperCase() : 'AWAITING INPUT'}</span><strong>{slotSpinning ? '•••' : slotResultKind === 'jackpot' ? '+777' : slotResultKind === 'triple' ? '+40' : slotResultKind === 'match' ? '+10' : '—'}</strong></div>
                  </div>
                  <aside className="slot-telemetry slot-panel" aria-label="Payout telemetry">
                    <div className="slot-panel-head"><span>02 // payout matrix</span><small>per pull</small></div>
                    <div className="slot-jackpot-readout"><strong>777</strong><span>MAX PAYOUT</span><small>{formatSlotChance(slotJackpotChance)} crown × 3</small></div>
                    <div className="slot-payout-list">
                      <div className="slot-payout jackpot"><span><Crown size={13} /> crown × 3</span><strong>777</strong><small>{formatSlotChance(slotJackpotChance)}</small></div>
                      <div className="slot-payout"><span><Sparkles size={13} /> any × 3</span><strong>40</strong><small>{formatSlotChance(slotTripleChance)}</small></div>
                      <div className="slot-payout"><span><Heart size={13} /> exact pair</span><strong>10</strong><small>{formatSlotChance(slotAnyMatchChance - slotTripleChance)}</small></div>
                      <div className="slot-payout miss"><span>no match</span><strong>—</strong><small>{formatSlotChance(slotNoMatchChance)}</small></div>
                    </div>
                    <div className="slot-telemetry-meter"><span><small>LUCK INDEX</small><b>{formatSlotChance(slotAnyMatchChance)}</b></span><i><em style={{ width: `${slotAnyMatchChance * 100}%` }} /></i></div>
                  </aside>
                </div>
                <div className="slot-command-footer">
                  <div className="slot-protocol"><span><i /> LIVE PROBABILITY MODEL</span><span><Ticket size={11} /> NO ENTRY FEE</span><span><Sparkles size={11} /> ONE PULL / ONE OUTCOME</span></div>
                  <div className={`slot-last-signal ${slotResultKind ? `is-${slotResultKind}` : ''}`}><small>last signal</small><strong>{slotResult || 'ready for your first pull'}</strong></div>
                </div>
                <div className={`result-callout slot-result ${slotResultKind ? `is-${slotResultKind}` : ''}`} role="status" aria-live="polite" data-testid="text-slots-result">{slotResult || 'Pull the lever. The probability model is live.'}</div>
              </div>
            )}
            {selected === 'memory' && (
              <div className="memory-game text-center">
                <div className={`memory-stage ${memoryFx > 0 ? 'has-win' : ''}`}>
                  <div className="memory-board">
                    {memoryDeck.map((symbol, index) => {
                      const isFaceUp = flipped.includes(index) || matched.includes(index);
                      return <button key={index} className={`memory-card ${isFaceUp ? 'flipped' : ''} ${matched.includes(index) ? 'matched' : ''}`} onClick={() => flipMemory(index)} aria-label={`Memory card ${index + 1}`} data-testid={`button-memory-card-${index}`}>{isFaceUp ? <SymbolIcon symbol={symbol} size={20} /> : <Sparkles size={18} />}</button>;
                    })}
                  </div>
                  {memoryFx > 0 && <div className="game-vfx memory-vfx" key={memoryFx} aria-hidden="true"><span className="vfx-halo" /><span className="vfx-rays" /><span className="vfx-ring" /><span className="vfx-core"><b>PAIR FOUND</b><small>memory magic</small></span>{Array.from({ length: 14 }, (_, index) => <i key={index} style={{ '--particle': index, '--angle': `${index * (360 / 14)}deg` } as CSSProperties} />)}</div>}
                </div>
                <button className="text-button mt-6" onClick={resetMemory} data-testid="button-reset-memory">reset the board <RotateCcw size={12} /></button>
                <div className="result-callout" role="status">{memoryResult || `${matched.length / 2} of 6 pairs found`}</div>
              </div>
            )}
            {selected === 'hearts' && (
              <div className="text-center w-full">
                <div className={`heart-hunt-status ${heartPlaying ? 'is-playing' : ''}`}><span>{heartPlaying ? 'time left' : 'entry fee'}</span><strong>{heartPlaying ? `${heartTime}s` : '10 tickets'}</strong><small>{heartPlaying ? `${heartRoundTickets} tickets this round` : '15 seconds · 5 or 20 per heart'}</small></div>
                <div className="heart-field">
                  <button className={`heart-target ${heartRare ? 'rare' : ''}`} style={{ left: `${heartPosition.left}%`, top: `${heartPosition.top}%` }} onClick={popHeart} aria-label="Pop heart" disabled={!heartPlaying} data-testid="button-pop-heart"><Heart size={41} fill="currentColor" /></button>
                   {heartPopFx && <div className={`heart-pop-vfx ${heartPopFx.rare ? 'is-rare' : ''}`} style={{ left: `${heartPopFx.left}%`, top: `${heartPopFx.top}%` }} key={heartPopFx.id} aria-hidden="true"><span className="vfx-halo" /><span className="vfx-rays" /><span className="vfx-ring" /><span className="vfx-core"><Heart size={12} fill="currentColor" /><b>+{heartPopFx.amount}</b><small>{heartPopFx.rare ? 'rare' : 'caught'}</small></span>{Array.from({ length: 10 }, (_, index) => <i key={index} style={{ '--particle': index, '--angle': `${index * 36}deg` } as CSSProperties} />)}</div>}
                  <Sparkles className="sparkle s1" size={14} /><Sparkles className="sparkle s2" size={12} />
                </div>
                <button className="primary-button heart-start" onClick={startHeartRound} disabled={heartPlaying} data-testid="button-start-heart-round"><Heart size={14} fill="currentColor" /> {heartPlaying ? 'hunt in progress' : 'start heart hunt'}</button>
                <div className="result-callout" role="status" data-testid="text-heart-result">{popMessage} {heartPlaying && <strong>{heartCount} caught</strong>}</div>
              </div>
            )}
          </div>
        </section>
        <aside className="score-panel"><div className="eyebrow" style={{ color: '#efb3c8' }}>your scorecard</div><h3>A very good<br />time so far.</h3><div className="score-number">+ {tickets} tickets</div><p>There is no scoreboard here, only proof that you showed up and played along.</p><div className="score-rule" /><div className="score-line"><span>games available</span><strong>04</strong></div><div className="score-line mt-4"><span>pairs to find</span><strong>06</strong></div><div className="score-line mt-4"><span>hearts in the air</span><strong>07</strong></div><Link to="/vault" className="ghost-button mt-8 w-full" data-testid="link-score-vault">visit the vault <ArrowRight size={14} /></Link></aside>
      </div>
    </>
  );
}

function Vault({ tickets, unlocked, unlockReward, addTickets }: { tickets: number; unlocked: RewardId[]; unlockReward: (reward: RewardId, cost: number, title: string) => void; addTickets: (amount: number, message?: string) => void }) {
  return (
    <>
      <div className="vault-top page-header reveal"><div><div className="eyebrow">behind the velvet curtain</div><h1 className="display-title">The <em>vault.</em></h1></div><div><p className="body-copy">Small rewards for a very big deal.</p><div className="vault-balance" data-testid="text-vault-balance"><span>your balance</span><strong>{tickets.toLocaleString()} tickets</strong></div></div></div>
      <div className="vault-grid">
        {rewards.map(({ id, title, description, cost, icon: Icon }) => {
          const isUnlocked = unlocked.includes(id); const canUnlock = tickets >= cost;
          return <article className="vault-card" key={id} data-testid={`card-reward-${id}`}>
            {isUnlocked && <span className="unlocked-stamp"><Check size={11} /> unlocked</span>}
            <Icon size={24} color={isUnlocked ? '#d85c7e' : '#c0879c'} /><h3>{title}</h3><p>{description}</p><div className="reward-price"><Ticket size={14} /> {cost.toLocaleString()} tickets</div>
            {isUnlocked ? <button className="ghost-button" disabled data-testid={`button-reward-${id}`}><Check size={14} /> yours now</button> : <button className={canUnlock ? 'primary-button' : 'ghost-button'} disabled={!canUnlock} onClick={() => unlockReward(id, cost, title)} data-testid={`button-reward-${id}`}>{canUnlock ? 'unlock reward' : 'keep playing'} <ChevronRight size={13} /></button>}
          </article>;
        })}
      </div>
      <div className="home-cta" style={{ marginTop: 30 }}><div className="eyebrow">still curious?</div><h2 className="section-heading">There is a letter<br /><em>with your name on it.</em></h2><Link className="ghost-button" to="/letter" data-testid="link-vault-letter">open the envelope <Mail size={14} /></Link></div>
      <button className="text-button mt-8 mx-auto block" onClick={() => addTickets(0, 'Tickets are earned in the arcade, sweet thing.')} data-testid="button-vault-reminder"><Clock3 size={13} /> how do tickets work?</button>
    </>
  );
}

function Letter() {
  const [open, setOpen] = useState(false);
  return (
    <div className="letter-wrap reveal">
      <div className={`letter-split ${open ? 'letter-open' : ''}`}>
        <aside className="letter-envelope-side">
          <div className="letter-frame" aria-hidden="true" />
          <div className="letter-envelope-head">
            <div className="letter-confidential">Strictly Confidential</div>
            <h1>For <em>Adel</em></h1>
          </div>
          <div className="letter-seal-wrap">
            <div className={`letter-seal ${open ? 'is-broken' : ''}`} aria-hidden="true">
              <div className="letter-seal-inner"><span>A</span></div>
            </div>
            <button className="letter-action" onClick={() => setOpen(true)} disabled={open} data-testid="button-open-letter">
              {open ? 'seal broken' : 'break the seal'} <Sparkles size={12} />
            </button>
          </div>
          <div className="letter-envelope-foot">Sealed with a little trouble</div>
        </aside>
        <section className="letter-paper-side" aria-hidden={!open}>
          <div className="letter-paper-head"><span>A letter for you</span><em>read when ready</em></div>
          <div className="letter-paper-body">
            <h2>My dearest Adel,</h2>
            <p>I hope this year gives you more of the days that make you lose track of the time — the good kind, with the windows open and something delicious nearby.</p>
            <p>You make ordinary things feel like they have a secret level. Thank you for the quick laughs, the long conversations, and for being exactly, wonderfully yourself.</p>
            <p>Here is to the next lap around the sun. I am so glad I get a front-row seat.</p>
            <div className="letter-sign">With all my love,<br /><strong>Dika</strong> <Heart size={15} fill="currentColor" className="inline ml-1" /></div>
          </div>
          {!open && <div className="letter-veil"><LockKeyhole size={18} /><span>the letter waits inside</span></div>}
        </section>
      </div>
      <div className="text-center mt-8"><Link className="text-button" to="/" data-testid="link-letter-home"><HomeIcon size={13} /> back to the beginning</Link></div>
    </div>
  );
}

function SettingsPage({ musicOn, toggleMusic }: { musicOn: boolean; toggleMusic: () => void }) {
  const [zipDownloading, setZipDownloading] = useState(false);
  const [zipDone, setZipDone] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const downloadWebZip = async () => {
    if (zipDownloading) return;
    setZipDownloading(true);
    setZipDone(false);
    try {
      const { base64 } = await downloadSourceZip();
      const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'birthday-arcade-web.zip';
      anchor.click();
      URL.revokeObjectURL(url);
      setZipDone(true);
      window.setTimeout(() => setZipDone(false), 3200);
    } catch { /* ignore */ }
    setZipDownloading(false);
  };
  const resetEverything = () => {
    if (!confirmReset) { setConfirmReset(true); window.setTimeout(() => setConfirmReset(false), 4000); return; }
    try {
      ['birthday-arcade-tickets', 'birthday-arcade-unlocked', 'birthday-arcade-memories', 'birthday-arcade-music'].forEach(key => localStorage.removeItem(key));
    } catch { /* ignore */ }
    window.location.reload();
  };
  return (
    <div className="settings-page reveal">
      <div className="page-header settings-hero">
        <div>
          <div className="eyebrow">the control booth</div>
          <h1 className="display-title">Little <em>settings.</em></h1>
        </div>
        <p className="body-copy">Every knob and switch in the arcade, gathered in one cozy room.</p>
      </div>
      <div className="settings-grid">
        <article className="settings-card" data-testid="card-setting-music">
          <div className="settings-card-icon"><Music2 size={20} /></div>
          <div className="settings-card-body">
            <h3>Arcade music</h3>
            <p>The soft-lights track that hums while you play. Your choice is remembered between visits.</p>
          </div>
          <button
            type="button"
            className={`settings-switch ${musicOn ? 'on' : ''}`}
            role="switch"
            aria-checked={musicOn}
            aria-label="Toggle arcade music"
            onClick={toggleMusic}
            data-testid="switch-settings-music"
          >
            <span className="settings-switch-thumb" />
          </button>
          <span className={`settings-state ${musicOn ? 'on' : ''}`}>{musicOn ? 'playing softly' : 'resting'}</span>
        </article>

        <article className="settings-card" data-testid="card-setting-download">
          <div className="settings-card-icon"><Download size={20} /></div>
          <div className="settings-card-body">
            <h3>Take the whole arcade home</h3>
            <p>Download every page, style and line of code that makes this place — wrapped up as one .zip file.</p>
          </div>
          <button
            type="button"
            className="primary-button settings-card-action"
            onClick={downloadWebZip}
            disabled={zipDownloading}
            data-testid="button-settings-download-zip"
          >
            {zipDownloading ? <><Sparkles size={13} /> packing files…</> : zipDone ? <><Check size={13} /> downloaded!</> : <><Download size={13} /> download .zip</>}
          </button>
          <span className="settings-state">keepsake, not required</span>
        </article>

        <article className="settings-card settings-card-danger" data-testid="card-setting-reset">
          <div className="settings-card-icon"><RotateCcw size={20} /></div>
          <div className="settings-card-body">
            <h3>Start the night over</h3>
            <p>Return tickets, rewards and polaroids to how they were at the very beginning. The memories stay in real life, of course.</p>
          </div>
          <button
            type="button"
            className={`ghost-button settings-card-action ${confirmReset ? 'settings-confirm' : ''}`}
            onClick={resetEverything}
            data-testid="button-settings-reset"
          >
            <RotateCcw size={13} /> {confirmReset ? 'are you sure? tap again' : 'reset everything'}
          </button>
          <span className="settings-state">{confirmReset ? 'one more tap to confirm' : 'handle with care'}</span>
        </article>

        <article className="settings-card settings-card-about">
          <div className="settings-card-icon"><Heart size={20} fill="currentColor" /></div>
          <div className="settings-card-body">
            <h3>About this arcade</h3>
            <p>Level 02 · made for Adel, with soft lights and very good memories. Version 1.0.0 — the forever edition.</p>
          </div>
          <span className="settings-badge">© 2026</span>
        </article>
      </div>
      <div className="text-center mt-8"><Link className="text-button" to="/" data-testid="link-settings-home"><HomeIcon size={13} /> back to the beginning</Link></div>
    </div>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation({ select: (s) => s.pathname });
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Router() {
  const pathname = useLocation({ select: (s) => s.pathname });
  const [tickets, setTickets] = usePersistentState('birthday-arcade-tickets', 0);
  const [unlocked, setUnlocked] = usePersistentState<RewardId[]>('birthday-arcade-unlocked', []);
  const [musicOn, toggleMusic] = useArcadeMusic();
  const [toast, setToast] = useState('');
  const addTickets = (amount: number, message?: string) => {
    if (amount > 0) setTickets(previous => previous + amount);
    if (message) { setToast(message); window.setTimeout(() => setToast(''), 2200); }
  };
  const unlockReward = (reward: RewardId, cost: number, title: string) => {
    if (tickets < cost || unlocked.includes(reward)) return;
    setTickets(previous => previous - cost); setUnlocked(previous => [...previous, reward]); setToast(`${title} is yours. A lovely choice.`);
    window.setTimeout(() => setToast(''), 2600);
  };
  const spendTickets = (amount: number, message?: string) => {
    if (tickets < amount) return false;
    setTickets(previous => previous - amount);
    if (message) { setToast(message); window.setTimeout(() => setToast(''), 2200); }
    return true;
  };
  return (
    <RoutedErrorBoundary>
       <Shell tickets={tickets} musicOn={musicOn} toggleMusic={toggleMusic}>
        {pathname === '/' ? (
          <Home tickets={tickets} musicOn={musicOn} toggleMusic={toggleMusic} />
        ) : pathname === '/arcade' ? (
          <Arcade tickets={tickets} addTickets={addTickets} spendTickets={spendTickets} />
        ) : pathname === '/vault' ? (
          <Vault tickets={tickets} unlocked={unlocked} unlockReward={unlockReward} addTickets={addTickets} />
        ) : pathname === '/letter' ? (
          <Letter />
        ) : pathname === '/settings' ? (
          <SettingsPage musicOn={musicOn} toggleMusic={toggleMusic} />
        ) : (
          <NotFound />
        )}
      </Shell>
      {toast && <div className="toast-note" role="status" data-testid="status-toast"><Sparkles size={14} className="inline mr-2" />{toast}</div>}
    </RoutedErrorBoundary>
  );
}

export function BirthdayApp() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="arcade-app" style={{ minHeight: '100dvh' }} />;
  return <Router />;
}
