import { useNavigate } from 'react-router-dom'
import {
  Mic,
  Upload,
  BarChart2,
  Shield,
  Zap,
  Globe,
  ChevronRight,
  Star,
  Play,
  CheckCircle,
  ArrowRight,
  Brain,
  Activity,
  Users,
} from 'lucide-react'
import './Landing.css'

const FEATURES = [
  {
    icon: Brain,
    title: 'AI-Powered Analysis',
    desc: 'Deep learning models trained on millions of audio samples detect nuanced sentiment with up to 95% accuracy.',
    color: 'indigo',
  },
  {
    icon: Mic,
    title: 'Real-time Recording',
    desc: 'Record directly from your browser microphone and get instant sentiment feedback without any uploads.',
    color: 'green',
  },
  {
    icon: Upload,
    title: 'Batch File Upload',
    desc: 'Drag and drop MP3, WAV, or M4A files up to 50 MB. Supports customer calls, interviews, and podcasts.',
    color: 'blue',
  },
  {
    icon: Activity,
    title: 'Emotion Breakdown',
    desc: 'Go beyond positive/negative. See a detailed breakdown of joy, anger, sadness, fear, trust, and more.',
    color: 'purple',
  },
  {
    icon: BarChart2,
    title: 'Analytics Dashboard',
    desc: 'Track trends over time with a clean dashboard showing sentiment distribution and historical analyses.',
    color: 'orange',
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    desc: 'All audio is processed securely. Your data is tied to your account and never shared with third parties.',
    color: 'red',
  },
]

const STATS = [
  { value: '98%', label: 'Accuracy Rate' },
  { value: '< 2s', label: 'Analysis Speed' },
  { value: '10K+', label: 'Analyses Run' },
  { value: '3', label: 'Sentiment Classes' },
]

const TESTIMONIALS = [
  {
    name: 'Sarah Chen',
    role: 'Customer Success Manager',
    company: 'TechFlow Inc.',
    avatar: 'SC',
    text: 'AudioSense transformed how we handle customer feedback. We can now process 200+ support calls daily and instantly flag negative experiences for follow-up.',
    rating: 5,
  },
  {
    name: 'Marcus Obi',
    role: 'UX Researcher',
    company: 'DesignHub',
    avatar: 'MO',
    text: 'The emotion breakdown feature is incredible. I use it to analyze user interview recordings and spot frustration patterns I might have missed manually.',
    rating: 5,
  },
  {
    name: 'Priya Nair',
    role: 'Podcast Producer',
    company: 'WaveMedia',
    avatar: 'PN',
    text: 'I analyze every episode before publishing. AudioSense helps me ensure the tone matches our brand — engaging, positive, and energetic.',
    rating: 5,
  },
]

const HOW_IT_WORKS = [
  { step: '01', title: 'Upload or Record', desc: 'Drop an audio file or record directly from your microphone.' },
  { step: '02', title: 'AI Processes It', desc: 'Our ML model analyzes speech patterns, tone, and vocal features.' },
  { step: '03', title: 'Get Instant Results', desc: 'View sentiment score, emotion breakdown, and actionable insights.' },
]

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="landing">
      {/* ── Navbar ── */}
      <header className="landing__header">
        <div className="landing__header-inner">
          <div className="landing__logo">
            <span className="landing__logo-icon">🎙</span>
            <span className="landing__logo-name">AudioSense</span>
          </div>
          <nav className="landing__nav">
            <a href="#features" className="landing__nav-link">Features</a>
            <a href="#how-it-works" className="landing__nav-link">How it works</a>
            <a href="#testimonials" className="landing__nav-link">Testimonials</a>
          </nav>
          <div className="landing__header-cta">
            <button className="btn btn--ghost btn--sm" onClick={() => navigate('/login')}>
              Sign in
            </button>
            <button className="btn btn--primary btn--sm" onClick={() => navigate('/register')}>
              Get started free
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="landing__hero">
        <div className="landing__hero-inner">
          <div className="landing__hero-badge">
            <Zap size={13} />
            <span>Powered by advanced speech AI</span>
          </div>
          <h1 className="landing__hero-title">
            Understand the emotion<br />
            <span className="landing__hero-gradient">behind every voice</span>
          </h1>
          <p className="landing__hero-sub">
            AudioSense analyzes audio recordings and live speech to detect sentiment, classify emotions, and surface insights — in seconds.
          </p>
          <div className="landing__hero-actions">
            <button className="btn btn--primary btn--large" onClick={() => navigate('/register')}>
              Start for free
              <ArrowRight size={18} />
            </button>
            <button className="btn btn--outline btn--large" onClick={() => navigate('/login')}>
              <Play size={16} />
              Sign in
            </button>
          </div>
          <p className="landing__hero-note">No credit card required · Free forever on the starter plan</p>
        </div>

        {/* Hero visual card */}
        <div className="landing__hero-visual">
          <div className="landing__demo-card">
            <div className="landing__demo-header">
              <div className="landing__demo-dots">
                <span></span><span></span><span></span>
              </div>
              <span className="landing__demo-title">Live Analysis</span>
            </div>
            <div className="landing__demo-body">
              <div className="landing__demo-waveform">
                {[4,7,5,9,6,11,8,13,10,8,6,9,7,5,8,10,12,9,7,5].map((h, i) => (
                  <div key={i} className="landing__demo-bar" style={{ height: `${h * 3}px`, animationDelay: `${i * 0.08}s` }} />
                ))}
              </div>
              <div className="landing__demo-result">
                <span className="badge badge--positive badge--large">POSITIVE</span>
                <div className="landing__demo-confidence">
                  <span>Confidence</span>
                  <span className="landing__demo-pct">87.4%</span>
                </div>
                <div className="landing__demo-track">
                  <div className="landing__demo-fill" style={{ width: '87.4%' }} />
                </div>
              </div>
              <div className="landing__demo-emotions">
                {[['😊 Joy', 72], ['🤝 Trust', 58], ['🔮 Anticipation', 44]].map(([name, val]) => (
                  <div key={name} className="landing__demo-emotion">
                    <span>{name}</span>
                    <div className="landing__demo-ebar">
                      <div style={{ width: `${val}%` }} className="landing__demo-efill" />
                    </div>
                    <span className="landing__demo-epct">{val}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="landing__stats">
        <div className="landing__stats-inner">
          {STATS.map(({ value, label }) => (
            <div key={label} className="landing__stat">
              <p className="landing__stat-value">{value}</p>
              <p className="landing__stat-label">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="landing__features" id="features">
        <div className="landing__section-inner">
          <div className="landing__section-header">
            <p className="landing__section-eyebrow">Features</p>
            <h2 className="landing__section-title">Everything you need to understand your audio</h2>
            <p className="landing__section-sub">From single recordings to bulk analysis pipelines — AudioSense has you covered.</p>
          </div>
          <div className="landing__features-grid">
            {FEATURES.map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="landing__feature-card">
                <div className={`landing__feature-icon landing__feature-icon--${color}`}>
                  <Icon size={22} />
                </div>
                <h3 className="landing__feature-title">{title}</h3>
                <p className="landing__feature-desc">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="landing__how" id="how-it-works">
        <div className="landing__section-inner">
          <div className="landing__section-header">
            <p className="landing__section-eyebrow">How it works</p>
            <h2 className="landing__section-title">Sentiment analysis in three steps</h2>
          </div>
          <div className="landing__how-steps">
            {HOW_IT_WORKS.map(({ step, title, desc }, idx) => (
              <div key={step} className="landing__how-step">
                <div className="landing__how-step-num">{step}</div>
                <div className="landing__how-step-content">
                  <h3 className="landing__how-step-title">{title}</h3>
                  <p className="landing__how-step-desc">{desc}</p>
                </div>
                {idx < HOW_IT_WORKS.length - 1 && (
                  <div className="landing__how-arrow" aria-hidden="true">
                    <ChevronRight size={24} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="landing__testimonials" id="testimonials">
        <div className="landing__section-inner">
          <div className="landing__section-header">
            <p className="landing__section-eyebrow">Testimonials</p>
            <h2 className="landing__section-title">Loved by teams who work with audio</h2>
          </div>
          <div className="landing__testimonials-grid">
            {TESTIMONIALS.map(({ name, role, company, avatar, text, rating }) => (
              <div key={name} className="landing__testimonial-card">
                <div className="landing__testimonial-stars">
                  {Array.from({ length: rating }).map((_, i) => (
                    <Star key={i} size={14} fill="currentColor" />
                  ))}
                </div>
                <p className="landing__testimonial-text">"{text}"</p>
                <div className="landing__testimonial-author">
                  <div className="landing__testimonial-avatar">{avatar}</div>
                  <div>
                    <p className="landing__testimonial-name">{name}</p>
                    <p className="landing__testimonial-role">{role} · {company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="landing__cta-banner">
        <div className="landing__cta-banner-inner">
          <div className="landing__cta-icon">
            <Mic size={32} />
          </div>
          <h2 className="landing__cta-title">Ready to hear what your audio is really saying?</h2>
          <p className="landing__cta-sub">Join thousands of teams using AudioSense to decode sentiment from voice.</p>
          <div className="landing__cta-actions">
            <button className="btn btn--large landing__cta-btn-primary" onClick={() => navigate('/register')}>
              Create free account
              <ArrowRight size={18} />
            </button>
            <button className="btn btn--outline btn--large landing__cta-btn-outline" onClick={() => navigate('/login')}>
              Sign in to dashboard
            </button>
          </div>
          <div className="landing__cta-checks">
            {['Free to get started', 'No setup required', 'Works in your browser'].map((item) => (
              <span key={item} className="landing__cta-check">
                <CheckCircle size={14} />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing__footer">
        <div className="landing__footer-inner">
          <div className="landing__footer-brand">
            <span className="landing__logo-icon">🎙</span>
            <span className="landing__logo-name">AudioSense</span>
          </div>
          <p className="landing__footer-copy">
            © {new Date().getFullYear()} AudioSense. Built with React + Firebase.
          </p>
          <div className="landing__footer-links">
            <button className="landing__footer-link" onClick={() => navigate('/login')}>Sign in</button>
            <button className="landing__footer-link" onClick={() => navigate('/register')}>Register</button>
          </div>
        </div>
      </footer>
    </div>
  )
}
