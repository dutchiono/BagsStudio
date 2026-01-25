import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';

export const ScannerDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Scene timing (in frames at 30fps)
  const scene1End = 90; // 0-3s: Intro
  const scene2End = 210; // 3-7s: Connect Wallet
  const scene3End = 330; // 7-11s: View Tokens
  const scene4End = 450; // 11-15s: Apply Filters
  const scene5End = 570; // 15-19s: Runner Opportunities
  const scene6End = 660; // 19-22s: Buy Token

  // Animation helpers
  const fadeIn = (start: number, duration = 20) => {
    return interpolate(frame, [start, start + duration], [0, 1], {
      extrapolateRight: 'clamp',
    });
  };

  const slideIn = (start: number, duration = 30) => {
    return spring({
      frame: frame - start,
      fps,
      config: {
        damping: 100,
      },
    });
  };

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Scene 1: Intro */}
      {frame < scene1End && (
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            opacity: fadeIn(0),
          }}
        >
          <div
            style={{
              fontFamily: 'monospace',
              color: '#00ff41',
              fontSize: 80,
              fontWeight: 'bold',
              textAlign: 'center',
            }}
          >
            BAGS SCANNER
          </div>
          <div
            style={{
              fontFamily: 'monospace',
              color: '#00ff41',
              fontSize: 32,
              marginTop: 20,
              opacity: fadeIn(30),
            }}
          >
            Discover New Token Launches
          </div>
        </AbsoluteFill>
      )}

      {/* Scene 2: Connect Wallet */}
      {frame >= scene1End && frame < scene2End && (
        <AbsoluteFill style={{ padding: 40 }}>
          <div
            style={{
              fontFamily: 'monospace',
              color: '#00ff41',
              fontSize: 48,
              marginBottom: 40,
              opacity: fadeIn(scene1End),
            }}
          >
            Step 1: Connect Your Wallet
          </div>

          {/* Mock wallet button */}
          <div
            style={{
              border: '2px solid #9945FF',
              backgroundColor: '#9945FF',
              padding: '16px 32px',
              borderRadius: 8,
              fontFamily: 'monospace',
              color: 'white',
              fontSize: 24,
              alignSelf: 'flex-start',
              transform: `scale(${slideIn(scene1End + 20)})`,
            }}
          >
            CONNECT WALLET
          </div>

          <div
            style={{
              fontFamily: 'monospace',
              color: '#ffff00',
              fontSize: 20,
              marginTop: 40,
              opacity: fadeIn(scene1End + 40),
            }}
          >
            ✓ Wallet Connected: 8xK...mPz7
          </div>
        </AbsoluteFill>
      )}

      {/* Scene 3: View Tokens */}
      {frame >= scene2End && frame < scene3End && (
        <AbsoluteFill style={{ padding: 40 }}>
          <div
            style={{
              fontFamily: 'monospace',
              color: '#00ff41',
              fontSize: 48,
              marginBottom: 30,
            }}
          >
            Step 2: Browse Live Tokens
          </div>

          {/* Mock token table */}
          <div style={{ opacity: fadeIn(scene2End) }}>
            {['DOGE2', 'PEPE3', 'MOON', 'ROCKET'].map((token, i) => (
              <div
                key={token}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: 16,
                  border: '1px solid #00ff41',
                  marginBottom: 10,
                  fontFamily: 'monospace',
                  color: '#00ff41',
                  fontSize: 20,
                  opacity: fadeIn(scene2End + 10 + i * 10),
                }}
              >
                <span>{token}</span>
                <span>${(Math.random() * 100).toFixed(1)}K</span>
                <span style={{ color: '#ffff00' }}>
                  +{(Math.random() * 200).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>

          <div
            style={{
              fontFamily: 'monospace',
              color: 'white',
              fontSize: 18,
              marginTop: 20,
              opacity: fadeIn(scene2End + 50),
            }}
          >
            1,200+ tokens • Auto-refresh every 10s
          </div>
        </AbsoluteFill>
      )}

      {/* Scene 4: Apply Filters */}
      {frame >= scene3End && frame < scene4End && (
        <AbsoluteFill style={{ padding: 40 }}>
          <div
            style={{
              fontFamily: 'monospace',
              color: '#00ff41',
              fontSize: 48,
              marginBottom: 30,
            }}
          >
            Step 3: Filter Opportunities
          </div>

          {/* Mock filters */}
          <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
            {[
              { label: 'Min Market Cap', value: '$10K' },
              { label: 'Max Market Cap', value: '$1M' },
              { label: 'Min Holders', value: '50' },
              { label: 'Min MCAP Growth', value: '+100%' },
            ].map((filter, i) => (
              <div
                key={filter.label}
                style={{
                  opacity: fadeIn(scene3End + i * 15),
                  transform: `translateX(${interpolate(
                    frame,
                    [scene3End + i * 15, scene3End + i * 15 + 20],
                    [-100, 0],
                    { extrapolateRight: 'clamp' }
                  )}px)`,
                }}
              >
                <div
                  style={{
                    fontFamily: 'monospace',
                    color: '#00ff41',
                    fontSize: 18,
                    marginBottom: 8,
                  }}
                >
                  {filter.label}
                </div>
                <div
                  style={{
                    border: '2px solid #00ff41',
                    padding: '12px 24px',
                    fontFamily: 'monospace',
                    color: '#ffff00',
                    fontSize: 24,
                    fontWeight: 'bold',
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
              fontSize: 22,
              marginTop: 50,
              opacity: fadeIn(scene3End + 80),
            }}
          >
            ✓ Filtered to 23 high-growth opportunities
          </div>
        </AbsoluteFill>
      )}

      {/* Scene 5: Runner Opportunities */}
      {frame >= scene4End && frame < scene5End && (
        <AbsoluteFill style={{ padding: 40 }}>
          <div
            style={{
              fontFamily: 'monospace',
              color: '#00ff41',
              fontSize: 48,
              marginBottom: 30,
            }}
          >
            Step 4: AI Runner Detection
          </div>

          <div
            style={{
              border: '2px solid #ffff00',
              padding: 30,
              backgroundColor: 'rgba(255, 255, 0, 0.1)',
              opacity: fadeIn(scene4End),
            }}
          >
            <div
              style={{
                fontFamily: 'monospace',
                color: '#ffff00',
                fontSize: 32,
                marginBottom: 20,
              }}
            >
              🚀 RUNNER DETECTED
            </div>

            <div
              style={{
                fontFamily: 'monospace',
                color: 'white',
                fontSize: 24,
              }}
            >
              <div style={{ opacity: fadeIn(scene4End + 20) }}>
                Token: MOONSHOT
              </div>
              <div style={{ opacity: fadeIn(scene4End + 30) }}>
                Market Cap: $45.2K → $127.8K
              </div>
              <div style={{ opacity: fadeIn(scene4End + 40) }}>
                Growth: +183% (5min)
              </div>
              <div style={{ opacity: fadeIn(scene4End + 50) }}>
                Holders: 127 (+45)
              </div>
            </div>
          </div>

          <div
            style={{
              fontFamily: 'monospace',
              color: '#00ff41',
              fontSize: 20,
              marginTop: 30,
              opacity: fadeIn(scene4End + 70),
            }}
          >
            AI analyzes growth patterns every 30 seconds
          </div>
        </AbsoluteFill>
      )}

      {/* Scene 6: Buy Token */}
      {frame >= scene5End && frame < scene6End && (
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
              fontSize: 48,
              marginBottom: 40,
            }}
          >
            Step 5: Execute Trade
          </div>

          {/* Buy button */}
          <div
            style={{
              border: '3px solid #00ff41',
              backgroundColor: '#00ff41',
              padding: '24px 80px',
              fontFamily: 'monospace',
              color: '#000',
              fontSize: 40,
              fontWeight: 'bold',
              transform: `scale(${slideIn(scene5End)})`,
              cursor: 'pointer',
            }}
          >
            BUY NOW
          </div>

          <div
            style={{
              fontFamily: 'monospace',
              color: '#ffff00',
              fontSize: 28,
              marginTop: 40,
              opacity: fadeIn(scene5End + 40),
            }}
          >
            ✓ Transaction Successful
          </div>

          <div
            style={{
              fontFamily: 'monospace',
              color: 'white',
              fontSize: 20,
              marginTop: 20,
              opacity: fadeIn(scene5End + 60),
            }}
          >
            bags.fm/scanner - Start discovering today
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
