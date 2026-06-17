import { useState } from 'react'

export default function Landing({ onSelectMode, user }) {
  const [hovered, setHovered] = useState(null)
  const [showHowToPlay, setShowHowToPlay] = useState(false)

  const avatarUrl = user?.avatar 
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
    : `https://cdn.discordapp.com/embed/avatars/${(user?.id ? Number(user.id) : 0) % 5}.png`

  return (
    <div style={s.root} className="landing-root">
      {/* Base Background (Split 50/50) */}
      <div style={s.bgSplit} />

      {/* Hover States Backgrounds */}
      <div style={{...s.bgArena, opacity: hovered === 'arena' ? 1 : 0}} />
      <div style={{...s.bgSocial, opacity: hovered === 'social' ? 1 : 0}} />

      {/* Ambient Fog / Overlay */}
      <div style={s.fogOverlay} />

      {/* Particles (CSS Animation added via style tag) */}
      <div className="landing-particles">
        {[...Array(12)].map((_, i) => (
          <div key={i} className={`particle p${i}`} />
        ))}
      </div>

      {/* HEADER */}
      <header style={s.header}>
        <button style={s.howToPlayBtn} onClick={() => setShowHowToPlay(true)}>
          <span className="material-symbols-outlined" style={{fontSize: 16}}>help</span>
          HOW TO PLAY
        </button>
        
        <div style={s.logoContainer}>
          <div style={s.logoWordmark}>FUTBOT</div>
          <div style={s.logoMain}>
            FUT<span style={{color: '#8B5CF6'}}>BOT</span>
          </div>
          <div style={s.logoSub}>FOOTBALL PARTY HUB</div>
          <div style={s.logoTag}>
            <span style={{color: '#eab308'}}>✨</span> Play with friends in Discord
          </div>
        </div>

        <div style={s.profileContainer} title="Profile">
          <img src={avatarUrl} style={s.profileImg} alt="Profile" onError={(e) => { e.target.src = 'https://cdn.discordapp.com/embed/avatars/0.png' }} />
        </div>
      </header>

      {/* HOW TO PLAY MODAL */}
      {showHowToPlay && (
        <div style={s.modalOverlay} onClick={() => setShowHowToPlay(false)}>
          <div style={s.modalContent} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Welcome to FUTBOT</h2>
              <button style={s.modalClose} onClick={() => setShowHowToPlay(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div style={s.modalBody}>
              <p style={{color: '#94a3b8', lineHeight: 1.6, marginBottom: 20}}>
                FUTBOT is your ultimate Discord football party hub!
              </p>
              <div style={s.modalSection}>
                <span className="material-symbols-outlined" style={{color: '#8B5CF6'}}>emoji_events</span>
                <div>
                  <strong style={{color: '#fff', display: 'block', marginBottom: 4}}>Arena Mode</strong>
                  <span>Build your ultimate deck, open packs, and battle your friends in competitive PvP card games.</span>
                </div>
              </div>
              <div style={s.modalSection}>
                <span className="material-symbols-outlined" style={{color: '#4DA3FF'}}>forum</span>
                <div>
                  <strong style={{color: '#fff', display: 'block', marginBottom: 4}}>Social Mode</strong>
                  <span>Jump into voice channels for quick party games like Guess the Player, Higher or Lower, and Survivor!</span>
                </div>
              </div>
            </div>
            <button style={s.modalGotItBtn} onClick={() => setShowHowToPlay(false)}>GOT IT</button>
          </div>
        </div>
      )}

      {/* MAIN LAYOUT - CARDS */}
      <main style={s.mainCards}>
        {/* ARENA CARD */}
        <div 
          style={{
            ...s.card, 
            borderColor: hovered === 'arena' ? 'rgba(139, 92, 246, 0.5)' : 'rgba(139, 92, 246, 0.1)',
            transform: hovered === 'arena' ? 'translateY(-10px) scale(1.02)' : hovered === 'social' ? 'scale(0.98)' : 'scale(1)',
            boxShadow: hovered === 'arena' ? '0 30px 60px rgba(0,0,0,0.6), 0 0 40px rgba(139, 92, 246, 0.2)' : '0 20px 40px rgba(0,0,0,0.4)',
            filter: hovered === 'social' ? 'brightness(0.6) blur(2px)' : 'none',
          }}
          className="arena-card"
          onMouseEnter={() => setHovered('arena')}
          onMouseLeave={() => setHovered(null)}
          onClick={() => onSelectMode('arena')}
        >
          <div style={s.cardHighlightArena} />
          <div style={s.cardTopTag}>COMPETE. COLLECT. WIN.</div>
          
          <div style={s.cardCenterBox}>
            <div style={s.cardIconBoxArena}>
              <span className="material-symbols-outlined" style={{fontSize: 'clamp(32px, 4vw, 64px)', color: '#fff', textShadow: '0 0 20px rgba(255,255,255,0.5)'}}>emoji_events</span>
            </div>
            <h2 style={s.cardTitle}>ARENA</h2>
            <div style={s.cardDescMain}>Card Battles & Trading</div>
            <div style={s.cardDescSub}>Build decks, open packs, battle friends</div>
          </div>

          <div style={s.featureList}>
            <div style={s.featureRow}>
              <span className="material-symbols-outlined" style={s.featureIconArena}>swords</span>
              <span style={s.featureText}>PvP Battles</span>
            </div>
            <div style={s.featureRow}>
              <span className="material-symbols-outlined" style={s.featureIconArena}>style</span>
              <span style={s.featureText}>Card Collection</span>
            </div>
            <div style={s.featureRow}>
              <span className="material-symbols-outlined" style={s.featureIconArena}>storefront</span>
              <span style={s.featureText}>Transfer Market</span>
            </div>
          </div>

          <button style={{...s.enterBtnArena, ...(hovered === 'arena' ? s.enterBtnHoverArena : {})}}>
            ENTER ARENA
            <span className="material-symbols-outlined" style={{fontSize: 20}}>arrow_forward</span>
          </button>
        </div>

        {/* SOCIAL CARD */}
        <div 
          style={{
            ...s.card, 
            borderColor: hovered === 'social' ? 'rgba(77, 163, 255, 0.5)' : 'rgba(77, 163, 255, 0.1)',
            transform: hovered === 'social' ? 'translateY(-10px) scale(1.02)' : hovered === 'arena' ? 'scale(0.98)' : 'scale(1)',
            boxShadow: hovered === 'social' ? '0 30px 60px rgba(0,0,0,0.6), 0 0 40px rgba(77, 163, 255, 0.2)' : '0 20px 40px rgba(0,0,0,0.4)',
            filter: hovered === 'arena' ? 'brightness(0.6) blur(2px)' : 'none',
          }}
          className="social-card"
          onMouseEnter={() => setHovered('social')}
          onMouseLeave={() => setHovered(null)}
          onClick={() => onSelectMode('social')}
        >
          <div style={s.cardHighlightSocial} />
          <div style={{...s.cardTopTag, color: '#4DA3FF'}}>PLAY. PARTY. CONNECT.</div>
          
          <div style={s.cardCenterBox}>
            <div style={s.cardIconBoxSocial}>
              <span className="material-symbols-outlined" style={{fontSize: 'clamp(32px, 4vw, 64px)', color: '#fff', textShadow: '0 0 20px rgba(255,255,255,0.5)'}}>forum</span>
              <span className="material-symbols-outlined" style={s.socialSubIcon}>sports_soccer</span>
            </div>
            <h2 style={s.cardTitle}>SOCIAL</h2>
            <div style={s.cardDescMain}>Party Games</div>
            <div style={s.cardDescSub}>Quick games with friends in voice channels</div>
          </div>

          <div style={s.featureList}>
            <div style={s.featureRow}>
              <div style={s.featureRowLeft}>
                <span className="material-symbols-outlined" style={s.featureIconSocial}>psychology_alt</span>
                <span style={s.featureText}>Guess The Player</span>
              </div>
              <div style={s.featureStats}>
                2-8 <span className="material-symbols-outlined" style={{fontSize:12, marginLeft: 2}}>group</span> 
              </div>
            </div>
            <div style={s.featureRow}>
              <div style={s.featureRowLeft}>
                <span className="material-symbols-outlined" style={s.featureIconSocial}>swap_vert</span>
                <span style={s.featureText}>Higher or Lower</span>
              </div>
              <div style={s.featureStats}>
                2-8 <span className="material-symbols-outlined" style={{fontSize:12, marginLeft: 2}}>group</span> 
              </div>
            </div>
            <div style={s.featureRow}>
              <div style={s.featureRowLeft}>
                <span className="material-symbols-outlined" style={s.featureIconSocial}>emoji_events</span>
                <span style={s.featureText}>Football Survivor</span>
              </div>
              <div style={s.featureStats}>
                3-12 <span className="material-symbols-outlined" style={{fontSize:12, marginLeft: 2}}>group</span> 
              </div>
            </div>
          </div>

          <button style={{...s.enterBtnSocial, ...(hovered === 'social' ? s.enterBtnHoverSocial : {})}}>
            ENTER SOCIAL
            <span className="material-symbols-outlined" style={{fontSize: 20}}>arrow_forward</span>
          </button>
        </div>
      </main>

      {/* FOOTER NAV BAR */}
      <div style={s.footerBar}>
        <div style={s.footerPill}>
          <span className="material-symbols-outlined" style={s.footerIcon}>sports_esports</span>
          <div>
            <div style={s.footerMainText}>7+ GAME MODES</div>
            <div style={s.footerSubText}>And more coming soon</div>
          </div>
        </div>
        <div style={s.footerPill}>
          <span className="material-symbols-outlined" style={s.footerIcon}>groups</span>
          <div>
            <div style={s.footerMainText}>MULTIPLAYER</div>
            <div style={s.footerSubText}>Play with friends</div>
          </div>
        </div>
        <div style={s.footerPill}>
          <span className="material-symbols-outlined" style={s.footerIcon}>mic</span>
          <div>
            <div style={s.footerMainText}>DISCORD VOICE</div>
            <div style={s.footerSubText}>Hang out while you play</div>
          </div>
        </div>
        <div style={s.footerPill}>
          <span className="material-symbols-outlined" style={s.footerIcon}>bolt</span>
          <div>
            <div style={s.footerMainText}>INSTANT PLAY</div>
            <div style={s.footerSubText}>No waiting. Just fun</div>
          </div>
        </div>
        <div style={s.footerPill}>
          <span className="material-symbols-outlined" style={s.footerIcon}>sports_soccer</span>
          <div>
            <div style={s.footerMainText}>FOOTBALL FIRST</div>
            <div style={s.footerSubText}>Built for football fans</div>
          </div>
        </div>
      </div>

      <div style={s.copyright}>
        Made with <span style={{color: '#8B5CF6'}}>💜</span> for the football community
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@500;700;900&family=Inter:wght@400;500;600;700&display=swap');
        
        .landing-root {
          font-family: 'Inter', system-ui, sans-serif;
          color: #fff;
        }

        .arena-card, .social-card {
          transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.4s ease, filter 0.4s ease, border-color 0.4s ease;
        }

        /* Animated Particles */
        .landing-particles {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 1;
        }
        .particle {
          position: absolute;
          border-radius: 50%;
          background: #fff;
          opacity: 0;
          animation: floatParticle 8s infinite linear;
        }
        @keyframes floatParticle {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          20% { opacity: 0.5; }
          80% { opacity: 0.3; }
          100% { transform: translateY(-200px) scale(0.5); opacity: 0; }
        }
        .p0 { left: 15%; width: 4px; height: 4px; animation-delay: 0s; animation-duration: 6s; box-shadow: 0 0 10px #8B5CF6; background: #8B5CF6; }
        .p1 { left: 25%; width: 6px; height: 6px; animation-delay: 2s; animation-duration: 9s; box-shadow: 0 0 10px #8B5CF6; background: #c4b5fd; }
        .p2 { left: 35%; width: 3px; height: 3px; animation-delay: 1s; animation-duration: 7s; }
        .p3 { left: 45%; width: 5px; height: 5px; animation-delay: 3s; animation-duration: 8s; }
        .p4 { left: 55%; width: 7px; height: 7px; animation-delay: 4s; animation-duration: 10s; }
        .p5 { left: 65%; width: 4px; height: 4px; animation-delay: 2s; animation-duration: 6s; }
        .p6 { left: 75%; width: 6px; height: 6px; animation-delay: 0.5s; animation-duration: 8s; box-shadow: 0 0 10px #4DA3FF; background: #bfdbfe; }
        .p7 { left: 85%; width: 5px; height: 5px; animation-delay: 1.5s; animation-duration: 7s; box-shadow: 0 0 10px #4DA3FF; background: #4DA3FF; }
        .p8 { left: 95%; width: 3px; height: 3px; animation-delay: 5s; animation-duration: 9s; }
        .p9 { left: 10%; width: 8px; height: 8px; animation-delay: 1.2s; animation-duration: 11s; }
        .p10 { left: 50%; width: 4px; height: 4px; animation-delay: 3.5s; animation-duration: 5s; }
        .p11 { left: 80%; width: 7px; height: 7px; animation-delay: 2.5s; animation-duration: 8s; }
        @keyframes slideUp { 0% { transform: translateY(20px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
      `}</style>
    </div>
  )
}

const s = {
  root: {
    height: '100svh',
    width: '100vw',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#030712', // Deep navy/black
    padding: 'clamp(16px, 2vw, 40px)',
    boxSizing: 'border-box',
  },
  // Backgrounds
  bgSplit: {
    position: 'absolute',
    inset: 0,
    background: 'url(/landingbg.png) no-repeat center center',
    backgroundSize: 'cover',
    zIndex: 0,
  },
  bgArena: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(circle at 20% 50%, rgba(139, 92, 246, 0.15) 0%, transparent 60%)',
    transition: 'opacity 0.6s ease',
    zIndex: 0,
  },
  bgSocial: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(circle at 80% 50%, rgba(77, 163, 255, 0.15) 0%, transparent 60%)',
    transition: 'opacity 0.6s ease',
    zIndex: 0,
  },
  fogOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, transparent 0%, rgba(3, 7, 18, 0.8) 100%)',
    pointerEvents: 'none',
    zIndex: 1,
  },

  header: {
    flex: '0 0 auto',
    height: 'clamp(80px, 15vh, 120px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: '1600px', // Allow header to spread wider
    margin: '0 auto',
    padding: '0 clamp(10px, 1.5vw, 20px)',
  },
  howToPlayBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 999,
    padding: '8px 16px',
    color: '#e2e8f0',
    fontFamily: "'Inter', sans-serif",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.05em',
    cursor: 'pointer',
    backdropFilter: 'blur(10px)',
  },
  logoContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
  },
  logoWordmark: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: 'clamp(80px, 15vw, 140px)',
    fontWeight: 900,
    fontFamily: "'Montserrat', sans-serif",
    color: 'rgba(255,255,255,0.02)',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
  },
  logoMain: {
    fontSize: 'clamp(34px, 4vw, 52px)',
    fontWeight: 900,
    fontFamily: "'Montserrat', sans-serif",
    letterSpacing: '0.05em',
    lineHeight: 1,
    textShadow: '0 4px 20px rgba(0,0,0,0.5)',
  },
  logoSub: {
    fontSize: 'clamp(11px, 1vw, 14px)',
    fontWeight: 700,
    letterSpacing: '0.25em',
    color: '#94a3b8',
    marginTop: '4px',
  },
  logoTag: {
    fontSize: 'clamp(10px, 0.8vw, 12px)',
    fontWeight: 500,
    color: '#cbd5e1',
    marginTop: '6px',
    background: 'rgba(255,255,255,0.05)',
    padding: '4px 12px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.05)',
  },
  profileContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 'clamp(40px, 4vw, 48px)',
    height: 'clamp(40px, 4vw, 48px)',
    borderRadius: '50%',
    background: 'rgba(15, 23, 42, 0.6)',
    border: '2px solid rgba(255,255,255,0.1)',
    backdropFilter: 'blur(10px)',
    cursor: 'pointer',
    overflow: 'hidden',
    transition: 'border-color 0.2s',
    ':hover': { borderColor: 'rgba(255,255,255,0.3)' }
  },
  profileImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  
  // Modal Styles
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.8)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: 20,
    animation: 'fadeIn 0.2s ease',
  },
  modalContent: {
    background: '#0f172a',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 24,
    width: '100%',
    maxWidth: 500,
    overflow: 'hidden',
    boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
    animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  modalHeader: {
    padding: '24px 32px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 800,
    color: '#fff',
  },
  modalClose: {
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    transition: 'all 0.2s',
  },
  modalBody: {
    padding: '32px',
  },
  modalSection: {
    display: 'flex',
    gap: 16,
    background: 'rgba(255,255,255,0.02)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    border: '1px solid rgba(255,255,255,0.03)',
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 1.5,
  },
  modalGotItBtn: {
    width: 'calc(100% - 64px)',
    margin: '0 32px 32px',
    background: '#fff',
    color: '#0f172a',
    border: 'none',
    padding: 16,
    borderRadius: 12,
    fontWeight: 800,
    fontSize: 15,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },

  // Main Cards Layout
  mainCards: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'stretch',
    gap: 'clamp(20px, 4vw, 80px)', // Allow gap to expand on wide screens
    flex: 1, // Let cards occupy remaining space
    minHeight: 0, // important for flex children to shrink
    marginTop: 'clamp(12px, 2vh, 30px)',
    marginBottom: 'clamp(12px, 2vh, 30px)',
    position: 'relative',
    perspective: '1000px',
    width: '100%',
    maxWidth: '1400px', // Contain the maximum spread
    margin: '0 auto',
  },
  card: {
    flex: 1,
    width: '100%',
    maxWidth: '500px',
    height: '100%',
    background: 'rgba(15, 23, 42, 0.4)',
    backdropFilter: 'blur(20px)',
    border: '1px solid',
    borderRadius: 'clamp(16px, 2vw, 24px)',
    padding: 'clamp(12px, 2vh, 32px) clamp(16px, 2.5vw, 32px)',
    display: 'grid',
    gridTemplateRows: 'auto auto 1fr auto',
    position: 'relative',
    overflow: 'hidden',
    cursor: 'pointer',
  },
  cardHighlightArena: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '2px',
    background: 'linear-gradient(90deg, transparent, #8B5CF6, transparent)',
    opacity: 0.8,
  },
  cardHighlightSocial: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '2px',
    background: 'linear-gradient(90deg, transparent, #4DA3FF, transparent)',
    opacity: 0.8,
  },
  cardTopTag: {
    fontSize: 'clamp(9px, 1vw, 11px)',
    fontWeight: 800,
    letterSpacing: '0.15em',
    color: '#8B5CF6',
    marginBottom: 'clamp(8px, 1.5vh, 32px)',
  },
  cardCenterBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: 'clamp(8px, 2vh, 40px)',
  },
  cardIconBoxArena: {
    width: 'clamp(64px, 8vw, 100px)',
    height: 'clamp(64px, 8vw, 100px)',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, rgba(139, 92, 246, 0) 70%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 'clamp(4px, 1vh, 16px)',
    position: 'relative',
  },
  cardIconBoxSocial: {
    width: 'clamp(64px, 8vw, 100px)',
    height: 'clamp(64px, 8vw, 100px)',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(77, 163, 255, 0.4) 0%, rgba(77, 163, 255, 0) 70%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 'clamp(4px, 1vh, 16px)',
    position: 'relative',
  },
  socialSubIcon: {
    position: 'absolute',
    fontSize: 'clamp(16px, 2vw, 24px)',
    color: '#0f172a',
    bottom: 'clamp(4px, 1vh, 12px)',
    right: 'clamp(4px, 1vh, 12px)',
    background: '#4DA3FF',
    borderRadius: '50%',
    padding: 2,
    border: '2px solid #0f172a'
  },
  cardTitle: {
    fontSize: 'clamp(28px, 3vw, 42px)',
    fontWeight: 900,
    fontFamily: "'Montserrat', sans-serif",
    letterSpacing: '0.05em',
    margin: 0,
    lineHeight: 1,
  },
  cardDescMain: {
    fontSize: 'clamp(14px, 1.5vw, 18px)',
    fontWeight: 700,
    marginTop: 'clamp(4px, 1vh, 12px)',
  },
  cardDescSub: {
    fontSize: 'clamp(11px, 1.2vw, 14px)',
    color: '#94a3b8',
    marginTop: 'clamp(2px, 0.5vh, 4px)',
  },
  featureList: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 'clamp(4px, 1vh, 12px)',
    minHeight: 0,
  },
  featureRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.05)',
    padding: 'clamp(6px, 1vh, 14px) clamp(12px, 1.5vw, 20px)',
    borderRadius: 'clamp(12px, 1.5vw, 16px)',
  },
  featureRowLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 'clamp(8px, 1vw, 12px)',
  },
  featureIconArena: {
    color: '#c4b5fd',
    fontSize: 'clamp(16px, 1.5vw, 20px)',
  },
  featureIconSocial: {
    color: '#bfdbfe',
    fontSize: 'clamp(16px, 1.5vw, 20px)',
  },
  featureText: {
    fontSize: 'clamp(12px, 1.2vw, 15px)',
    fontWeight: 600,
    color: '#e2e8f0',
  },
  featureStats: {
    fontSize: 'clamp(10px, 1vw, 12px)',
    fontWeight: 600,
    color: '#64748b',
    display: 'flex',
    alignItems: 'center',
  },
  enterBtnArena: {
    width: '100%',
    background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
    border: '1px solid #a78bfa',
    borderRadius: 'clamp(12px, 1.5vw, 16px)',
    padding: 'clamp(10px, 1.5vh, 20px)',
    color: '#fff',
    fontSize: 'clamp(14px, 1.2vw, 16px)',
    fontWeight: 800,
    letterSpacing: '0.1em',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(124, 58, 237, 0.4)',
    transition: 'all 0.2s',
  },
  enterBtnHoverArena: {
    boxShadow: '0 8px 25px rgba(124, 58, 237, 0.6), inset 0 2px 5px rgba(255,255,255,0.2)',
    filter: 'brightness(1.1)',
  },
  enterBtnSocial: {
    width: '100%',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    border: '1px solid #60a5fa',
    borderRadius: 'clamp(12px, 1.5vw, 16px)',
    padding: 'clamp(10px, 1.5vh, 20px)',
    color: '#fff',
    fontSize: 'clamp(14px, 1.2vw, 16px)',
    fontWeight: 800,
    letterSpacing: '0.1em',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(37, 99, 235, 0.4)',
    transition: 'all 0.2s',
  },
  enterBtnHoverSocial: {
    boxShadow: '0 8px 25px rgba(37, 99, 235, 0.6), inset 0 2px 5px rgba(255,255,255,0.2)',
    filter: 'brightness(1.1)',
  },

  // Footer Nav Bar
  footerBar: {
    flex: '0 0 auto',
    height: 'clamp(50px, 12vh, 80px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'clamp(8px, 1vw, 12px)',
    position: 'relative',
    zIndex: 10,
    flexWrap: 'wrap',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  footerPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 'clamp(8px, 1vw, 12px)',
    background: 'rgba(15, 23, 42, 0.6)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.05)',
    padding: 'clamp(8px, 1vh, 12px) clamp(12px, 1.5vw, 20px)',
    borderRadius: '16px',
  },
  footerIcon: {
    color: '#cbd5e1',
    fontSize: 'clamp(18px, 2vw, 24px)',
  },
  footerMainText: {
    fontSize: 'clamp(11px, .9vw, 13px)',
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '0.05em',
  },
  footerSubText: {
    fontSize: 'clamp(9px, .7vw, 11px)',
    fontWeight: 500,
    color: '#64748b',
    marginTop: '2px',
  },

  copyright: {
    flex: '0 0 auto',
    textAlign: 'center',
    paddingTop: 'clamp(12px, 2vh, 24px)',
    fontSize: 'clamp(10px, .8vw, 12px)',
    fontWeight: 500,
    color: '#475569',
    position: 'relative',
    zIndex: 10,
  }
}
