import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from 'remotion';

export const StudioDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Scene timing (in frames at 30fps)
  const scene1End = 90; // 0-3s: Intro
  const scene2End = 210; // 3-7s: Open Studio
  const scene3End = 360; // 7-12s: Fill Project Config
  const scene4End = 540; // 12-18s: AI Chat Interaction
  const scene5End = 690; // 18-23s: Preview Generated
  const scene6End = 780; // 23-26s: Outro

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

  const typewriterEffect = (start: number, text: string, speed = 2) => {
    const progress = Math.max(0, frame - start);
    const charsToShow = Math.floor(progress / speed);
    return text.substring(0, charsToShow);
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
            BAGS STUDIO
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
            AI-Powered Token Creation
          </div>
        </AbsoluteFill>
      )}

      {/* Scene 2: Open Studio */}
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
            Step 1: Launch Studio
          </div>

          {/* Mock browser window */}
          <div
            style={{
              border: '2px solid #00ff41',
              borderRadius: 8,
              overflow: 'hidden',
              opacity: fadeIn(scene1End + 20),
              transform: `scale(${slideIn(scene1End + 20)})`,
            }}
          >
            {/* Browser header */}
            <div
              style={{
                backgroundColor: '#00ff41',
                padding: '12px 20px',
                fontFamily: 'monospace',
                color: '#000',
                fontSize: 20,
              }}
            >
              bags.fm/studio
            </div>

            {/* Studio UI Preview */}
            <div
              style={{
                padding: 40,
                backgroundColor: '#0a0a0a',
              }}
            >
              <div
                style={{
                  fontFamily: 'monospace',
                  color: '#00ff41',
                  fontSize: 32,
                  opacity: fadeIn(scene1End + 50),
                }}
              >
                Welcome to Bags Studio
              </div>
              <div
                style={{
                  fontFamily: 'monospace',
                  color: 'white',
                  fontSize: 20,
                  marginTop: 20,
                  opacity: fadeIn(scene1End + 70),
                }}
              >
                Create your token project with AI assistance
              </div>
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* Scene 3: Fill Project Config */}
      {frame >= scene2End && frame < scene3End && (
        <AbsoluteFill style={{ padding: 40, display: 'flex', gap: 40 }}>
          <div
            style={{
              fontFamily: 'monospace',
              color: '#00ff41',
              fontSize: 48,
              position: 'absolute',
              top: 40,
            }}
          >
            Step 2: Configure Project
          </div>

          {/* Left Panel - Config Window */}
          <div
            style={{
              position: 'absolute',
              left: 40,
              top: 140,
              width: 500,
              border: '2px solid #00ff41',
              padding: 30,
              backgroundColor: '#0a0a0a',
              opacity: fadeIn(scene2End),
            }}
          >
            <div
              style={{
                fontFamily: 'monospace',
                color: '#00ff41',
                fontSize: 24,
                marginBottom: 30,
                borderBottom: '1px solid #00ff41',
                paddingBottom: 10,
              }}
            >
              PROJECT CONFIG
            </div>

            {/* Form Fields */}
            {[
              { label: 'PROJECT NAME', value: 'MoonRocket', delay: 0 },
              { label: 'TICKER', value: '$MOON', delay: 20 },
              { label: 'TYPE', value: 'MEME COIN', delay: 40 },
            ].map((field, i) => (
              <div
                key={field.label}
                style={{
                  marginBottom: 20,
                  opacity: fadeIn(scene2End + 20 + field.delay),
                }}
              >
                <div
                  style={{
                    fontFamily: 'monospace',
                    color: '#00ff41',
                    fontSize: 14,
                    marginBottom: 8,
                  }}
                >
                  {field.label}
                </div>
                <div
                  style={{
                    border: '1px solid #00ff41',
                    padding: '10px 15px',
                    fontFamily: 'monospace',
                    color: 'white',
                    fontSize: 18,
                    backgroundColor: '#000',
                  }}
                >
                  {frame >= scene2End + 30 + field.delay
                    ? field.value
                    : field.value.substring(
                        0,
                        Math.floor(
                          ((frame - (scene2End + 30 + field.delay)) / 3) *
                            field.value.length
                        )
                      )}
                  {frame < scene2End + 30 + field.delay + 20 && (
                    <span style={{ opacity: frame % 20 > 10 ? 1 : 0 }}>_</span>
                  )}
                </div>
              </div>
            ))}

            {/* Description */}
            <div
              style={{
                marginTop: 20,
                opacity: fadeIn(scene2End + 90),
              }}
            >
              <div
                style={{
                  fontFamily: 'monospace',
                  color: '#00ff41',
                  fontSize: 14,
                  marginBottom: 8,
                }}
              >
                DESCRIPTION
              </div>
              <div
                style={{
                  border: '1px solid #00ff41',
                  padding: '10px 15px',
                  fontFamily: 'monospace',
                  color: 'white',
                  fontSize: 16,
                  backgroundColor: '#000',
                  minHeight: 60,
                }}
              >
                {frame >= scene2End + 100 &&
                  'To the moon and beyond! 🚀'}
              </div>
            </div>
          </div>

          {/* Right side hint */}
          <div
            style={{
              position: 'absolute',
              right: 100,
              top: 300,
              fontFamily: 'monospace',
              color: '#ffff00',
              fontSize: 24,
              opacity: fadeIn(scene2End + 130),
              textAlign: 'right',
            }}
          >
            → Fill in your project details
            <br />
            → Upload logo (optional)
            <br />
            → Add social links
          </div>
        </AbsoluteFill>
      )}

      {/* Scene 4: AI Chat Interaction */}
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
            Step 3: AI Architect Chat
          </div>

          {/* Chat Window */}
          <div
            style={{
              border: '2px solid #00ff41',
              padding: 30,
              backgroundColor: '#0a0a0a',
              maxWidth: 1200,
              opacity: fadeIn(scene3End),
            }}
          >
            <div
              style={{
                fontFamily: 'monospace',
                color: '#00ff41',
                fontSize: 20,
                marginBottom: 30,
                borderBottom: '1px solid #00ff41',
                paddingBottom: 10,
              }}
            >
              AI ARCHITECT
            </div>

            {/* User message */}
            <div
              style={{
                marginBottom: 30,
                opacity: fadeIn(scene3End + 20),
              }}
            >
              <div
                style={{
                  fontFamily: 'monospace',
                  color: '#ffff00',
                  fontSize: 16,
                  marginBottom: 8,
                }}
              >
                YOU:
              </div>
              <div
                style={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #ffff00',
                  padding: 15,
                  fontFamily: 'monospace',
                  color: 'white',
                  fontSize: 18,
                }}
              >
                {typewriterEffect(
                  scene3End + 30,
                  'Create a fun, space-themed meme coin landing page with rocket animations',
                  1
                )}
              </div>
            </div>

            {/* AI Response */}
            <div
              style={{
                opacity: fadeIn(scene3End + 120),
              }}
            >
              <div
                style={{
                  fontFamily: 'monospace',
                  color: '#00ff41',
                  fontSize: 16,
                  marginBottom: 8,
                }}
              >
                AI ARCHITECT:
              </div>
              <div
                style={{
                  backgroundColor: '#0f2f0f',
                  border: '1px solid #00ff41',
                  padding: 15,
                  fontFamily: 'monospace',
                  color: '#00ff41',
                  fontSize: 18,
                  lineHeight: 1.6,
                }}
              >
                {typewriterEffect(
                  scene3End + 130,
                  "Perfect! I'll design a landing page with:\n\n✓ Animated rocket hero section\n✓ Star field background\n✓ Cosmic color scheme\n✓ Interactive tokenomics chart\n✓ Community links section\n\nGenerating preview now...",
                  1.5
                )}
              </div>
            </div>

            {/* Streaming indicator */}
            {frame >= scene3End + 130 && frame < scene4End - 20 && (
              <div
                style={{
                  marginTop: 20,
                  fontFamily: 'monospace',
                  color: '#00ff41',
                  fontSize: 16,
                  opacity: Math.sin((frame - scene3End - 130) / 10) * 0.5 + 0.5,
                }}
              >
                {'>'} Streaming response...
              </div>
            )}
          </div>
        </AbsoluteFill>
      )}

      {/* Scene 5: Preview Generated */}
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
            Step 4: Preview Generated Page
          </div>

          {/* Preview Window */}
          <div
            style={{
              border: '3px solid #00ff41',
              borderRadius: 8,
              overflow: 'hidden',
              width: 1200,
              height: 700,
              opacity: fadeIn(scene4End),
              transform: `scale(${slideIn(scene4End)})`,
            }}
          >
            {/* Mock Landing Page */}
            <div
              style={{
                background: 'linear-gradient(180deg, #000033 0%, #000000 100%)',
                height: '100%',
                padding: 60,
                position: 'relative',
              }}
            >
              {/* Stars */}
              {[...Array(20)].map((_, i) => (
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
                    opacity: Math.sin((frame + i * 10) / 20) * 0.5 + 0.5,
                  }}
                />
              ))}

              {/* Rocket */}
              <div
                style={{
                  fontSize: 120,
                  position: 'absolute',
                  left: '50%',
                  top: interpolate(
                    frame,
                    [scene4End, scene4End + 60],
                    [120, 80],
                    {
                      extrapolateRight: 'clamp',
                      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
                    }
                  ),
                  transform: 'translateX(-50%)',
                }}
              >
                🚀
              </div>

              {/* Title */}
              <div
                style={{
                  fontFamily: 'monospace',
                  color: '#00ff41',
                  fontSize: 72,
                  fontWeight: 'bold',
                  textAlign: 'center',
                  marginTop: 200,
                  opacity: fadeIn(scene4End + 30),
                  textShadow: '0 0 20px #00ff41',
                }}
              >
                MOONROCKET
              </div>

              <div
                style={{
                  fontFamily: 'monospace',
                  color: '#ffff00',
                  fontSize: 36,
                  textAlign: 'center',
                  marginTop: 20,
                  opacity: fadeIn(scene4End + 50),
                }}
              >
                $MOON
              </div>

              <div
                style={{
                  fontFamily: 'monospace',
                  color: 'white',
                  fontSize: 24,
                  textAlign: 'center',
                  marginTop: 30,
                  opacity: fadeIn(scene4End + 70),
                }}
              >
                To the moon and beyond! 🌙
              </div>

              {/* CTA Button */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  marginTop: 60,
                  opacity: fadeIn(scene4End + 90),
                }}
              >
                <div
                  style={{
                    border: '3px solid #00ff41',
                    backgroundColor: '#00ff41',
                    padding: '20px 60px',
                    fontFamily: 'monospace',
                    color: '#000',
                    fontSize: 28,
                    fontWeight: 'bold',
                    boxShadow: '0 0 30px #00ff41',
                  }}
                >
                  LAUNCH TOKEN
                </div>
              </div>
            </div>
          </div>

          {/* Success message */}
          <div
            style={{
              fontFamily: 'monospace',
              color: '#ffff00',
              fontSize: 24,
              marginTop: 20,
              opacity: fadeIn(scene4End + 120),
            }}
          >
            ✓ Landing page generated successfully!
          </div>
        </AbsoluteFill>
      )}

      {/* Scene 6: Outro */}
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
              fontSize: 64,
              fontWeight: 'bold',
              textAlign: 'center',
              opacity: fadeIn(scene5End),
            }}
          >
            BAGS STUDIO
          </div>

          <div
            style={{
              fontFamily: 'monospace',
              color: 'white',
              fontSize: 32,
              marginTop: 40,
              textAlign: 'center',
              opacity: fadeIn(scene5End + 30),
            }}
          >
            Create. Design. Launch.
          </div>

          <div
            style={{
              fontFamily: 'monospace',
              color: '#00ff41',
              fontSize: 28,
              marginTop: 40,
              opacity: fadeIn(scene5End + 60),
            }}
          >
            bags.fm/studio
          </div>

          <div
            style={{
              fontFamily: 'monospace',
              color: '#ffff00',
              fontSize: 20,
              marginTop: 60,
              opacity: fadeIn(scene5End + 90),
            }}
          >
            Powered by AI • Built for Creators
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
