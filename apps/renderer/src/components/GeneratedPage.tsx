import { TokenProject } from '@bagsstudio/shared';

interface GeneratedPageProps {
  project: TokenProject & {
    layout?: 'classic' | 'hero' | 'minimal' | 'brutalist';
    emoji?: string;
    twitterHandle?: string;
    telegramLink?: string;
    contractAddress?: string;
    [key: string]: any
  };
}

export default function GeneratedPage({ project }: GeneratedPageProps) {
  console.log('Rendering GeneratedPage with project:', project?.name);
  // Safe defaults
  const themeColor = project.themeColor || '#000000';
  const secondaryColor = project.secondaryColor || '#ffffff';

  // Safe hex color with opacity
  const bgWithOpacity = themeColor.startsWith('#')
    ? `${themeColor}10`
    : `${themeColor}`;

  // Layout Switcher
  const renderLayout = () => {
    switch (project.layout) {
      case 'minimal':
        return (
          <div className="max-w-4xl mx-auto px-8 py-20 text-center">
            <div className="text-6xl mb-8">{project.emoji}</div>
            <h1 className="text-6xl font-bold mb-6 tracking-tight" style={{ color: themeColor }}>{project.name}</h1>
            <p className="text-xl text-gray-600 mb-10 leading-relaxed">{project.description}</p>
            <div className="flex justify-center gap-4">
              <a href={project.telegramLink || '#'} className="px-6 py-3 rounded-lg border-2 font-bold transition-colors hover:bg-gray-50" style={{ borderColor: themeColor, color: themeColor }}>Telegram</a>
              <a href={project.twitterHandle ? `https://x.com/${project.twitterHandle.replace('@', '')}` : '#'} className="px-6 py-3 rounded-lg border-2 font-bold transition-colors hover:bg-gray-50" style={{ borderColor: themeColor, color: themeColor }}>Twitter</a>
            </div>
            {project.contractAddress && (
              <div className="mt-12 p-4 bg-gray-100 rounded-xl font-mono text-sm break-all">
                CA: {project.contractAddress}
              </div>
            )}
          </div>
        );

      case 'hero':
        return (
          <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ background: `radial-gradient(circle at center, ${themeColor}, transparent 70%)` }} />
            <h1 className="text-[12vw] font-black leading-none mb-4 uppercase mix-blend-multiply opacity-90" style={{ color: themeColor }}>
              {project.symbol}
            </h1>
            <div className="relative z-10 bg-white/80 backdrop-blur-md p-8 rounded-3xl border shadow-xl max-w-2xl transform rotate-[-2deg]">
              <h2 className="text-4xl font-bold mb-4">{project.tagline}</h2>
              <p className="text-lg font-medium opacity-80 mb-6">{project.description}</p>
              <button className="w-full py-4 rounded-xl font-black text-xl text-white uppercase shadow-lg hover:scale-[1.02] transition-transform" style={{ backgroundColor: themeColor }}>
                Buy {project.name}
              </button>
            </div>
          </div>
        );

      case 'brutalist':
        return (
          <div className="min-h-screen bg-slate-200 p-4 font-mono">
            <div className="border-4 border-black bg-white p-8 max-w-5xl mx-auto shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex justify-between border-b-4 border-black pb-4 mb-8">
                <h1 className="text-4xl font-black uppercase">{project.name}</h1>
                <div className="text-4xl">{project.emoji}</div>
              </div>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="border-4 border-black p-6 bg-yellow-300">
                  <h2 className="font-bold text-xl mb-4 border-b-4 border-black inline-block">MANIFESTO</h2>
                  <p className="text-lg font-bold">{project.description}</p>
                </div>
                <div className="space-y-4">
                  <div className="border-4 border-black p-4 bg-green-400 hover:bg-green-300 cursor-pointer shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold text-center">
                    BUY NOW
                  </div>
                  <div className="border-4 border-black p-4 bg-blue-400 hover:bg-blue-300 cursor-pointer shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold text-center">
                    TELEGRAM
                  </div>
                  <div className="border-4 border-black p-4 bg-white hover:bg-gray-100 cursor-pointer shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold text-center break-all">
                    CA: {project.contractAddress || 'NOT DEPLOYED'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'classic':
      default:
        // The original "Slop" layout
        return (
          <main className="relative z-10 max-w-7xl mx-auto px-8 py-12">
            {/* Empty State */}
            {!project.tagline && !project.description && (
              <div className="flex flex-col items-center justify-center min-h-[50vh] text-center opacity-50">
                <div className="text-6xl mb-4">✨</div>
                <h2 className="text-2xl font-bold mb-2" style={{ color: themeColor }}>Ready to Create</h2>
                <p>Tell the AI what to build...</p>
              </div>
            )}

            {/* Hero Section */}
            {(project.tagline || project.description) && (
              <section className="text-center mb-32">
                {project.symbol && (
                  <div className="inline-block px-8 py-2 rounded-full mb-6 font-bold text-sm uppercase tracking-widest bg-white shadow-sm" style={{ color: themeColor }}>
                    Introducing ${project.symbol}
                  </div>
                )}
                <h1 className="text-6xl md:text-8xl font-black mb-8 leading-tight animate-float font-bungee" style={{ color: themeColor }}>
                  {project.tagline}
                </h1>
                <p className="max-w-2xl mx-auto text-xl text-gray-600 font-medium leading-relaxed mb-12">
                  {project.description}
                </p>
                <div className="flex flex-wrap justify-center gap-6">
                  <button className="px-12 py-5 rounded-[30px] font-black text-2xl text-white shadow-2xl transition-all hover:translate-y-[-5px] active:translate-y-0 uppercase" style={{ backgroundColor: themeColor }}>
                    BUY NOW
                  </button>
                  <button className="px-12 py-5 rounded-[30px] font-black text-2xl border-4 transition-all hover:bg-white/50 uppercase" style={{ borderColor: themeColor, color: themeColor }}>
                    TELEGRAM
                  </button>
                </div>
              </section>
            )}

            {/* Tokenomics Grid */}
            {project.tokenomics && Object.values(project.tokenomics).some(v => v) && (
              <section className="grid md:grid-cols-3 gap-8 mb-32">
                {Object.entries(project.tokenomics).map(([key, value], idx) => value ? (
                  <div key={key} className="p-8 rounded-[40px] bg-white shadow-xl hover:shadow-2xl transition-shadow border-b-8" style={{ borderBottomColor: idx % 2 === 0 ? themeColor : secondaryColor }}>
                    <h4 className="font-bold text-sm opacity-50 uppercase mb-2">{key}</h4>
                    <p className="font-black text-4xl" style={{ color: themeColor }}>{value}</p>
                  </div>
                ) : null)}
              </section>
            )}

            {/* Features / Roadmap */}
            {project.roadmap && project.roadmap.length > 0 && (
              <section className="bg-white/60 backdrop-blur-md rounded-[60px] p-12 mb-32 border-4 border-dashed" style={{ borderColor: `${themeColor}40` }}>
                <h2 className="text-5xl font-black text-center mb-16" style={{ color: themeColor }}>The Master Plan</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
                  {project.roadmap.map((item, i) => (
                    <div key={i} className="relative">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-3xl text-white mb-6" style={{ backgroundColor: i % 2 === 0 ? themeColor : secondaryColor }}>
                        {i + 1}
                      </div>
                      <h3 className="font-black text-xl mb-4" style={{ color: themeColor }}>{item.phase}</h3>
                      <p className="font-medium text-gray-600">{item.goal}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Contract Address */}
            {(project.tagline || project.description) && (
              <section className="mb-16">
                <div className="p-6 rounded-[30px] bg-white/80 backdrop-blur-md shadow-lg text-center">
                  <h4 className="font-bold text-sm opacity-50 uppercase mb-2">Contract Address</h4>
                  <p className="font-mono text-lg break-all" style={{ color: themeColor }}>
                    {project.contractAddress || 'NOT DEPLOYED'}
                  </p>
                </div>
              </section>
            )}

            {/* Community Slop */}
            {(project.tagline || project.description) && (
              <section className="text-center pb-20">
                <div className="text-9xl mb-12 animate-bounce">{project.emoji}</div>
                <h2 className="text-6xl font-black mb-8" style={{ color: themeColor }}>Join the Pile</h2>
                <p className="font-medium text-xl mb-12 opacity-70">Don't miss the ultimate slop session of the decade.</p>
                <div className="flex justify-center gap-8">
                  <div className="w-20 h-20 rounded-full bg-white shadow-lg flex items-center justify-center text-3xl cursor-pointer hover:scale-125 transition-transform">🐦</div>
                  <div className="w-20 h-20 rounded-full bg-white shadow-lg flex items-center justify-center text-3xl cursor-pointer hover:scale-125 transition-transform">📱</div>
                  <div className="w-20 h-20 rounded-full bg-white shadow-lg flex items-center justify-center text-3xl cursor-pointer hover:scale-125 transition-transform">👾</div>
                </div>
              </section>
            )}
          </main>
        );
    }
  };

  return (
    <div className={`min-h-screen w-full relative overflow-hidden ${project.layout === 'brutalist' ? '' : 'transition-colors'}`}
      style={{ backgroundColor: project.layout === 'brutalist' ? '#e2e8f0' : bgWithOpacity }}>

      {/* Background blobs (Only for classic/hero) */}
      {(project.layout === 'classic' || !project.layout) && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-20">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] aspect-square liquid-shape" style={{ backgroundColor: themeColor }} />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] aspect-square liquid-shape" style={{ backgroundColor: secondaryColor, animationDelay: '-2s' }} />
        </div>
      )}

      {/* Nav (Shared for Classic/Minimal/Hero) - Brutalist has its own */}
      {project.layout !== 'brutalist' && (
        <nav className="relative z-10 px-8 py-6 flex justify-between items-center max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{project.emoji}</span>
            <span className="font-bold text-2xl font-bungee" style={{ color: themeColor }}>{project.name}</span>
          </div>
          <button
            className="px-6 py-2 rounded-full font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
            style={{ backgroundColor: themeColor }}
          >
            Buy ${project.symbol}
          </button>
        </nav>
      )}

      {renderLayout()}

      {project.layout !== 'brutalist' && (
        <footer className="relative z-10 py-12 text-center font-medium text-gray-400">
          © 2024 {project.name} • Built with Bags Studio
        </footer>
      )}
    </div>
  );
}
