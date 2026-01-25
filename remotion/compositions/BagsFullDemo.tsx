import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Sequence,
  Audio,
  staticFile,
} from 'remotion';

export const BagsFullDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Detect orientation
  const isMobile = height > width; // Portrait
  const isSquare = width === height;

  // Responsive sizing
  const scale = isMobile ? 0.5 : isSquare ? 0.6 : 1;
  const padding = isMobile ? 40 : isSquare ? 50 : 80;

  // Responsive font size helper
  const fs = (size: number) => size * scale;

  // Simple fade helper
  const fadeIn = (start: number, duration = 30) => {
    return interpolate(frame, [start, start + duration], [0, 1], {
      extrapolateRight: 'clamp',
    });
  };

  const fadeOut = (start: number, duration = 30) => {
    return interpolate(frame, [start, start + duration], [1, 0], {
      extrapolateRight: 'clamp',
    });
  };

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Background Music - Looped */}
      <Audio src={staticFile('assets/Bagsong.m4a')} loop />

      {/* INTRO: Platform Overview (0-4s / 0-120 frames) */}
      <Sequence from={0} durationInFrames={120}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            opacity: interpolate(frame, [0, 20, 100, 120], [0, 1, 1, 0]),
          }}
        >
          <div
            style={{
              fontFamily: 'monospace',
              color: '#00ff41',
              fontSize: 100 * scale,
              fontWeight: 'bold',
              textShadow: '0 0 30px #00ff41',
            }}
          >
            BAGSSTUDIO
          </div>
          <div
            style={{
              fontFamily: 'monospace',
              color: 'white',
              fontSize: 40 * scale,
              marginTop: 30 * scale,
              opacity: fadeIn(30),
            }}
          >
            Launch Fast • Discover First • Win
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* PART 1: STUDIO */}

      {/* Studio Intro (4-7s / 120-210 frames) */}
      <Sequence from={120} durationInFrames={90}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            opacity: interpolate(frame, [120, 140, 190, 210], [0, 1, 1, 0]),
          }}
        >
          <div
            style={{
              fontFamily: 'monospace',
              color: '#00ff41',
              fontSize: fs(70),
              fontWeight: 'bold',
              marginBottom: fs(30),
            }}
          >
            STUDIO
          </div>
          <div
            style={{
              fontFamily: 'monospace',
              color: 'white',
              fontSize: fs(36),
            }}
          >
            Launch Your Token in 60 Seconds
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Studio: Configure (7-13s / 210-390 frames) */}
      <Sequence from={210} durationInFrames={180}>
        <AbsoluteFill style={{ padding }}>
          <div
            style={{
              fontFamily: 'monospace',
              color: '#00ff41',
              fontSize: fs(48),
              marginBottom: fs(50),
              opacity: fadeIn(210),
            }}
          >
            Configure Your Project
          </div>

          <div
            style={{
              border: '2px solid #00ff41',
              padding: fs(50),
              backgroundColor: '#0a0a0a',
              maxWidth: 700,
              opacity: fadeIn(230),
            }}
          >
            <div
              style={{
                fontFamily: 'monospace',
                color: '#00ff41',
                fontSize: fs(28),
                marginBottom: fs(40),
                borderBottom: '2px solid #00ff41',
                paddingBottom: 20,
              }}
            >
              PROJECT CONFIG
            </div>

            {[
              { label: 'NAME', value: 'MoonRocket', delay: 0 },
              { label: 'TICKER', value: '$MOON', delay: 40 },
              { label: 'TYPE', value: 'MEME COIN', delay: 80 },
              { label: 'DESCRIPTION', value: 'To the moon! 🚀', delay: 120 },
            ].map((field) => (
              <div
                key={field.label}
                style={{
                  marginBottom: fs(30),
                  opacity: fadeIn(260 + field.delay),
                }}
              >
                <div
                  style={{
                    fontFamily: 'monospace',
                    color: '#00ff41',
                    fontSize: fs(18),
                    marginBottom: fs(12),
                  }}
                >
                  {field.label}
                </div>
                <div
                  style={{
                    border: '1px solid #00ff41',
                    padding: '16px 24px',
                    fontFamily: 'monospace',
                    color: 'white',
                    fontSize: fs(24),
                    backgroundColor: '#000',
                  }}
                >
                  {field.value}
                </div>
              </div>
            ))}
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Studio: AI Chat (13-20s / 390-600 frames) */}
      <Sequence from={390} durationInFrames={210}>
        <AbsoluteFill style={{ padding: 80 }}>
          <div
            style={{
              fontFamily: 'monospace',
              color: '#00ff41',
              fontSize: fs(48),
              marginBottom: fs(50),
              opacity: fadeIn(390),
            }}
          >
            Chat with AI Architect
          </div>

          <div
            style={{
              border: '2px solid #00ff41',
              padding: fs(50),
              backgroundColor: '#0a0a0a',
              maxWidth: 1600,
              opacity: fadeIn(410),
            }}
          >
            {/* User message */}
            <div
              style={{
                marginBottom: fs(50),
                opacity: fadeIn(430),
              }}
            >
              <div
                style={{
                  fontFamily: 'monospace',
                  color: '#ffff00',
                  fontSize: fs(20),
                  marginBottom: fs(15),
                }}
              >
                YOU:
              </div>
              <div
                style={{
                  backgroundColor: '#1a1a1a',
                  border: '2px solid #ffff00',
                  padding: fs(25),
                  fontFamily: 'monospace',
                  color: 'white',
                  fontSize: fs(24),
                }}
              >
                Create a space-themed landing page with rocket animations
              </div>
            </div>

            {/* AI Response */}
            <div style={{ opacity: fadeIn(510) }}>
              <div
                style={{
                  fontFamily: 'monospace',
                  color: '#00ff41',
                  fontSize: fs(20),
                  marginBottom: fs(15),
                }}
              >
                AI ARCHITECT:
              </div>
              <div
                style={{
                  backgroundColor: '#0f2f0f',
                  border: '2px solid #00ff41',
                  padding: fs(25),
                  fontFamily: 'monospace',
                  color: '#00ff41',
                  fontSize: fs(24),
                  lineHeight: 1.8,
                }}
              >
                I'll create a landing page with:
                <br />
                <br />
                • Animated rocket hero section
                <br />
                • Starfield background
                <br />
                • Cosmic color palette
                <br />
                • Call-to-action button
                <br />
                <br />
                Generating now...
              </div>
            </div>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Studio: Preview (20-27s / 600-810 frames) */}
      <Sequence from={600} durationInFrames={210}>
        <AbsoluteFill style={{ padding: 80 }}>
          <div
            style={{
              fontFamily: 'monospace',
              color: '#00ff41',
              fontSize: fs(48),
              marginBottom: fs(50),
              opacity: fadeIn(600),
            }}
          >
            Preview Your Page
          </div>

          <div
            style={{
              border: '3px solid #00ff41',
              borderRadius: 8,
              overflow: 'hidden',
              width: isMobile ? width * 0.85 : isSquare ? width * 0.9 : 1600,
              height: isMobile ? height * 0.6 : isSquare ? height * 0.65 : 850,
              opacity: fadeIn(620),
            }}
          >
            {/* Landing Page Preview */}
            <div
              style={{
                background: 'linear-gradient(180deg, #001a33 0%, #000000 100%)',
                height: '100%',
                padding: fs(80),
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              {/* Stars */}
              {[...Array(30)].map((_, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    width: 3,
                    height: 3,
                    backgroundColor: 'white',
                    borderRadius: '50%',
                    left: `${(i * 137) % 100}%`,
                    top: `${(i * 97) % 100}%`,
                    opacity: 0.6,
                  }}
                />
              ))}

              {/* Rocket */}
              <div
                style={{
                  fontSize: fs(140),
                  marginBottom: fs(40),
                  transform: `translateY(${Math.sin((frame - 600) / 30) * 15}px) rotate(-45deg)`,
                }}
              >
                🚀
              </div>

              {/* Content */}
              <div
                style={{
                  fontFamily: 'monospace',
                  color: '#00ff41',
                  fontSize: fs(90),
                  fontWeight: 'bold',
                  marginBottom: fs(20),
                  textShadow: '0 0 20px #00ff41',
                }}
              >
                MOONROCKET
              </div>

              <div
                style={{
                  fontFamily: 'monospace',
                  color: '#ffff00',
                  fontSize: fs(48),
                  marginBottom: fs(30),
                }}
              >
                $MOON
              </div>

              <div
                style={{
                  fontFamily: 'monospace',
                  color: 'white',
                  fontSize: fs(32),
                  marginBottom: fs(60),
                }}
              >
                To the moon! 🌙
              </div>

              {/* CTA */}
              <div
                style={{
                  border: '3px solid #00ff41',
                  backgroundColor: '#00ff41',
                  padding: '25px 80px',
                  fontFamily: 'monospace',
                  color: '#000',
                  fontSize: fs(36),
                  fontWeight: 'bold',
                }}
              >
                LAUNCH TOKEN
              </div>
            </div>
          </div>

          <div
            style={{
              fontFamily: 'monospace',
              color: '#ffff00',
              fontSize: fs(28),
              marginTop: fs(40),
              opacity: fadeIn(760),
            }}
          >
            ✓ Page generated in seconds
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* TRANSITION (27-30s / 810-900 frames) */}
      <Sequence from={810} durationInFrames={90}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            opacity: interpolate(frame, [810, 830, 880, 900], [0, 1, 1, 0]),
          }}
        >
          <div
            style={{
              fontFamily: 'monospace',
              color: '#00ff41',
              fontSize: fs(70),
              fontWeight: 'bold',
              marginBottom: fs(30),
            }}
          >
            SCANNER
          </div>
          <div
            style={{
              fontFamily: 'monospace',
              color: 'white',
              fontSize: fs(36),
            }}
          >
            Catch Launches Before Everyone Else
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* PART 2: SCANNER */}

      {/* Scanner: Browse Tokens (30-36s / 900-1080 frames) */}
      <Sequence from={900} durationInFrames={180}>
        <AbsoluteFill style={{ padding: 80 }}>
          <div
            style={{
              fontFamily: 'monospace',
              color: '#00ff41',
              fontSize: fs(48),
              marginBottom: fs(50),
              opacity: fadeIn(900),
            }}
          >
            1,200+ Tokens Tracked in Real-Time
          </div>

          <div style={{ opacity: fadeIn(920) }}>
            {[
              { name: 'PEPE3', mcap: '$85K', growth: '+245%', holders: 127 },
              { name: 'DOGE2', mcap: '$128K', growth: '+189%', holders: 203 },
              { name: 'MOON', mcap: '$44K', growth: '+312%', holders: 89 },
              { name: 'ROCKET', mcap: '$156K', growth: '+156%', holders: 241 },
              { name: 'SHIB2', mcap: '$92K', growth: '+203%', holders: 167 },
            ].map((token, i) => (
              <div
                key={token.name}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: fs(30),
                  border: '2px solid #00ff41',
                  marginBottom: fs(20),
                  fontFamily: 'monospace',
                  backgroundColor: '#0a0a0a',
                  opacity: fadeIn(930 + i * 20),
                }}
              >
                <div style={{ color: '#00ff41', fontSize: fs(28), flex: 1 }}>
                  {token.name}
                </div>
                <div style={{ color: 'white', fontSize: fs(28), flex: 1 }}>
                  {token.mcap}
                </div>
                <div
                  style={{
                    color: '#ffff00',
                    fontSize: fs(28),
                    fontWeight: 'bold',
                    flex: 1,
                  }}
                >
                  {token.growth}
                </div>
                <div style={{ color: 'white', fontSize: fs(24), flex: 1 }}>
                  {token.holders} holders
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              fontFamily: 'monospace',
              color: 'white',
              fontSize: fs(24),
              marginTop: fs(40),
              opacity: fadeIn(1030),
            }}
          >
            1,200+ tokens tracked • Updates every 10 seconds
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Scanner: Filters (36-42s / 1080-1260 frames) */}
      <Sequence from={1080} durationInFrames={180}>
        <AbsoluteFill style={{ padding: 80 }}>
          <div
            style={{
              fontFamily: 'monospace',
              color: '#00ff41',
              fontSize: fs(48),
              marginBottom: fs(50),
              opacity: fadeIn(1080),
            }}
          >
            Find Winners with Smart Filters
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 60,
              opacity: fadeIn(1100),
            }}
          >
            {[
              { label: 'Min Market Cap', value: '$10K' },
              { label: 'Max Market Cap', value: '$500K' },
              { label: 'Min Holders', value: '50' },
              { label: 'Min Growth (5m)', value: '+150%' },
            ].map((filter, i) => (
              <div key={filter.label} style={{ opacity: fadeIn(1110 + i * 20) }}>
                <div
                  style={{
                    fontFamily: 'monospace',
                    color: '#00ff41',
                    fontSize: fs(22),
                    marginBottom: fs(20),
                  }}
                >
                  {filter.label}
                </div>
                <div
                  style={{
                    border: '2px solid #00ff41',
                    padding: '20px 40px',
                    fontFamily: 'monospace',
                    color: '#ffff00',
                    fontSize: fs(32),
                    fontWeight: 'bold',
                    backgroundColor: '#0a0a0a',
                    textAlign: 'center',
                  }}
                >
                  {filter.value}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              fontFamily: 'monospace',
              color: '#ffff00',
              fontSize: fs(32),
              marginTop: fs(70),
              textAlign: 'center',
              opacity: fadeIn(1200),
            }}
          >
            ✓ 23 high-growth tokens found
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Scanner: Runner Alert (42-48s / 1260-1440 frames) */}
      <Sequence from={1260} durationInFrames={180}>
        <AbsoluteFill style={{ padding: 80 }}>
          <div
            style={{
              fontFamily: 'monospace',
              color: '#00ff41',
              fontSize: fs(48),
              marginBottom: fs(50),
              opacity: fadeIn(1260),
            }}
          >
            AI Catches 183% Gains Automatically
          </div>

          <div
            style={{
              border: '3px solid #ffff00',
              padding: fs(60),
              backgroundColor: 'rgba(255, 255, 0, 0.05)',
              opacity: fadeIn(1280),
            }}
          >
            <div
              style={{
                fontFamily: 'monospace',
                color: '#ffff00',
                fontSize: fs(52),
                marginBottom: fs(50),
                textAlign: 'center',
              }}
            >
              🚀 RUNNER DETECTED
            </div>

            <div
              style={{
                fontFamily: 'monospace',
                color: 'white',
                fontSize: fs(32),
                lineHeight: 2,
              }}
            >
              <div style={{ opacity: fadeIn(1310) }}>
                <span style={{ color: '#00ff41' }}>Token:</span> MOONSHOT
              </div>
              <div style={{ opacity: fadeIn(1340) }}>
                <span style={{ color: '#00ff41' }}>Market Cap:</span> $45K → $128K
              </div>
              <div style={{ opacity: fadeIn(1370) }}>
                <span style={{ color: '#00ff41' }}>Growth:</span>{' '}
                <span style={{ color: '#ffff00', fontWeight: 'bold' }}>
                  +183% (5 min)
                </span>
              </div>
              <div style={{ opacity: fadeIn(1400) }}>
                <span style={{ color: '#00ff41' }}>Holders:</span> 127 (+45)
              </div>
            </div>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Scanner: Trade (48-52s / 1440-1560 frames) */}
      <Sequence from={1440} durationInFrames={120}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontFamily: 'monospace',
              color: '#00ff41',
              fontSize: fs(48),
              marginBottom: fs(70),
              opacity: fadeIn(1440),
            }}
          >
            Execute Trade
          </div>

          <div
            style={{
              border: '4px solid #00ff41',
              backgroundColor: '#00ff41',
              padding: '35px 140px',
              fontFamily: 'monospace',
              color: '#000',
              fontSize: fs(56),
              fontWeight: 'bold',
              opacity: fadeIn(1460),
            }}
          >
            BUY NOW
          </div>

          <div
            style={{
              fontFamily: 'monospace',
              color: '#ffff00',
              fontSize: fs(36),
              marginTop: fs(70),
              opacity: fadeIn(1500),
            }}
          >
            ✓ Transaction Successful
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* OUTRO (52-56s / 1560-1680 frames) */}
      <Sequence from={1560} durationInFrames={120}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            opacity: interpolate(frame, [1560, 1580, 1660, 1680], [0, 1, 1, 0]),
          }}
        >
          <div
            style={{
              fontFamily: 'monospace',
              color: '#00ff41',
              fontSize: fs(100),
              fontWeight: 'bold',
              marginBottom: fs(40),
              textShadow: '0 0 30px #00ff41',
            }}
          >
            BAGSSTUDIO
          </div>

          <div
            style={{
              fontFamily: 'monospace',
              color: 'white',
              fontSize: fs(38),
              marginBottom: fs(50),
            }}
          >
            Be First. Be Fast. Be Profitable.
          </div>

          <div
            style={{
              fontFamily: 'monospace',
              color: '#ffff00',
              fontSize: fs(44),
            }}
          >
            Coming Soon to Bags.FM
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
