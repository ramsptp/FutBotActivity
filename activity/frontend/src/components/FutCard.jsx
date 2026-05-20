// Displays a pre-designed card PNG at its natural aspect ratio.
// The PNG already contains the full card design — do not add frames on top.
export default function FutCard({ card, onClick, selected, dimmed, highlight, style = {} }) {
  if (!card) return null

  const glow =
    highlight === 'win'  ? '0 0 20px 5px #f0c040, 0 0 40px 10px rgba(240,192,64,0.4)' :
    highlight === 'lose' ? 'none' :
    selected             ? '0 0 14px 3px #5865f2' :
    'none'

  return (
    <div
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        borderRadius: 10,
        overflow: 'hidden',
        transition: 'transform 0.15s, box-shadow 0.2s, opacity 0.2s',
        transform: selected ? 'translateY(-6px) scale(1.04)' : highlight === 'win' ? 'scale(1.06)' : 'scale(1)',
        boxShadow: glow,
        opacity: dimmed ? 0.45 : 1,
        animation: highlight === 'win' ? 'winPulse 1.2s ease infinite' : 'none',
        flexShrink: 0,
        ...style,
      }}
    >
      {card.image_url ? (
        <img
          src={card.image_url}
          alt={card.name}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      ) : (
        <div style={{
          width: '100%', paddingBottom: '140%', background: '#1a2236',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', borderRadius: 10,
        }}>
          <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: '#555', fontSize: 28 }}>
            {card.position?.[0] ?? '?'}
          </span>
        </div>
      )}
    </div>
  )
}
