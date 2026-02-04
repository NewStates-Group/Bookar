import React from 'react';

export const BuildingBlocksLoader = () => {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <style jsx>{`
        @keyframes build {
          0% { opacity: 0; transform: translateY(-20px); }
          15% { opacity: 1; transform: translateY(0); }
          70% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(0); }
        }
        .block-anim {
          animation: build 3s ease-in-out infinite;
          opacity: 0;
        }
      `}</style>
      <div className="relative w-32 h-24">
        {/* Base Layer */}
        <div className="absolute bottom-0 left-0 w-10 h-10 bg-primary rounded-sm shadow-sm block-anim" style={{ animationDelay: '0s' }}></div>
        <div className="absolute bottom-0 left-11 w-10 h-10 bg-primary/90 rounded-sm shadow-sm block-anim" style={{ animationDelay: '0.2s' }}></div>
        <div className="absolute bottom-0 left-22 w-10 h-10 bg-primary/80 rounded-sm shadow-sm block-anim" style={{ animationDelay: '0.4s' }}></div>

        {/* Middle Layer */}
        <div className="absolute bottom-11 left-5 w-10 h-10 bg-primary/70 rounded-sm shadow-sm block-anim" style={{ animationDelay: '0.6s' }}></div>
        <div className="absolute bottom-11 left-16 w-10 h-10 bg-primary/60 rounded-sm shadow-sm block-anim" style={{ animationDelay: '0.8s' }}></div>

        {/* Top Layer */}
        <div className="absolute bottom-22 left-11 w-10 h-10 bg-primary/50 rounded-sm shadow-sm block-anim" style={{ animationDelay: '1s' }}></div>
      </div>
    </div>
  );
};
