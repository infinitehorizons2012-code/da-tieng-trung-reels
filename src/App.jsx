import React, { useState, useEffect } from 'react';
import { reelsData } from './data';
import { Play, Heart, MessageCircle, Share2, MoreHorizontal, X, ArrowLeft } from 'lucide-react';
import './index.css';

function ReelCard({ data, onClick }) {
  return (
    <div id={`reel-${data.id}`} className="reel-card" onClick={() => onClick(data)}>
      {data.image ? (
        <img src={data.image} alt={data.title} loading="lazy" />
      ) : data.videoUrl ? (
        <video src={data.videoUrl} preload="metadata" muted playsInline style={{width: '100%', height: '100%', objectFit: 'contain'}} />
      ) : null}
      <div className="reel-card-overlay">
        <div className="card-chinese">{data.title}</div>
        <div className="card-views">
          <Play fill="white" size={12} />
          {data.views}
        </div>
      </div>
    </div>
  );
}

function ReelViewer({ data, onClose }) {
  // Prevent scrolling on body when viewer is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const [liked, setLiked] = useState(false);

  return (
    <div className="viewer-overlay">
      <button className="close-btn" onClick={onClose}>
        <ArrowLeft size={24} />
      </button>
      
      <div className="viewer-content">
        {data.videoUrl ? (
          <video src={data.videoUrl} autoPlay loop playsInline controls={false} />
        ) : (
          <img src={data.image} alt={data.title} />
        )}
        
        {/* Overlay Info */}
        <div className="viewer-info">
          <div className="viewer-chinese">{data.title}</div>
          <div className="viewer-pinyin">{data.pinyin}</div>
          <div className="viewer-vietnamese">{data.vietnamese}</div>
        </div>

        {/* Actions Menu */}
        <div className="viewer-actions">
          <button className="action-btn" onClick={() => setLiked(!liked)}>
            <Heart size={32} fill={liked ? "#ff2a5f" : "none"} color={liked ? "#ff2a5f" : "white"} />
            <span>{data.likes}</span>
          </button>
          <button className="action-btn">
            <MessageCircle size={32} />
            <span>Bình luận</span>
          </button>
          <button className="action-btn">
            <Share2 size={32} />
            <span>Chia sẻ</span>
          </button>
          <button className="action-btn">
            <MoreHorizontal size={32} />
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [selectedReel, setSelectedReel] = useState(null);

  const handleClose = () => {
    const closedId = selectedReel.id;
    setSelectedReel(null);
    setTimeout(() => {
      const el = document.getElementById(`reel-${closedId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <h1>
          <img 
            src="https://images.unsplash.com/photo-1590845947698-8924d7409b56?w=100&h=100&fit=crop" 
            alt="Avatar" 
            className="avatar" 
          />
          Bé học tiếng Trung
        </h1>
      </header>

      {/* Main Grid */}
      <main className="reels-grid">
        {reelsData.map((reel) => (
          <ReelCard 
            key={reel.id} 
            data={reel} 
            onClick={setSelectedReel} 
          />
        ))}
      </main>

      {/* Fullscreen Viewer */}
      {selectedReel && (
        <ReelViewer 
          data={selectedReel} 
          onClose={handleClose} 
        />
      )}
    </div>
  );
}

export default App;
