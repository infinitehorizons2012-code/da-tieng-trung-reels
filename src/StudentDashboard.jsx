import React, { useState, useEffect } from 'react';
import { reelsData } from './data';
import { Play, Heart, MessageCircle, Share2, MoreHorizontal, X, ArrowLeft, LogOut, CheckCircle, Clock, XCircle, Trophy, Users } from 'lucide-react';
import { db } from './firebase';
import { collection, query, where, getDocs, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

function ReelCard({ data, progress, onClick }) {
  const status = progress?.status;
  const streak = status === 'PASSED' ? 5 : (progress?.streak || 0);

  let statusColor = 'transparent';
  if (status === 'PASSED') statusColor = '#4caf50'; // green
  if (status === 'PRACTICING') statusColor = '#ff9800'; // orange
  if (status === 'FAILED') statusColor = '#f44336'; // red
  if (status === 'WAITING') statusColor = '#1976d2'; // blue

  return (
    <div id={`reel-${data.id}`} className="reel-card" onClick={() => onClick(data)} style={{ border: status ? `3px solid ${statusColor}` : 'none' }}>
      {data.image ? (
        <img src={data.image} alt={data.title} loading="lazy" />
      ) : data.videoUrl ? (
        <video src={data.videoUrl} preload="metadata" muted playsInline style={{width: '100%', height: '100%', objectFit: 'contain'}} />
      ) : null}
      
      {/* Status Badge */}
      {status && (
        <div style={{ position: 'absolute', top: 8, left: 8, background: statusColor, color: 'white', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', zIndex: 10 }}>
          {status === 'PASSED' ? 'Đã đạt 100%' : status === 'PRACTICING' ? `Đang luyện tập (${streak}/5)` : status === 'FAILED' ? 'Chưa qua' : 'Đang chờ KT'}
        </div>
      )}

      <div className="reel-card-overlay">
        <div className="card-chinese">{data.title}</div>
      </div>
    </div>
  );
}

function ReelViewer({ data, progress, onClose, onRegisterTest, onLoginClick }) {
  const videoRef = React.useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const [liked, setLiked] = useState(false);
  const [registering, setRegistering] = useState(false);

  const status = progress?.status;
  const streak = status === 'PASSED' ? 5 : (progress?.streak || 0);

  const handleRegister = async () => {
    if (!onRegisterTest) return;
    setRegistering(true);
    await onRegisterTest(data.id);
    setRegistering(false);
  };

  return (
    <div className="viewer-overlay">
      <button className="close-btn" onClick={onClose}>
        <ArrowLeft size={24} />
      </button>
      
      {/* Top Right Action Button */}
      <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 100 }}>
        {!onRegisterTest ? (
          <button onClick={onLoginClick} style={{ background: '#ff4081', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
            Đăng nhập để lưu tiến độ
          </button>
        ) : status === 'WAITING' ? (
          <button disabled style={{ background: '#1976d2', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '20px', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
            Đã đăng ký kiểm tra
          </button>
        ) : status === 'PASSED' ? (
          <button disabled style={{ background: '#4caf50', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '20px', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
            <CheckCircle size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '4px' }} /> Đã thuộc 100%
          </button>
        ) : status === 'PRACTICING' ? (
          <button onClick={handleRegister} disabled={registering} style={{ background: '#ff9800', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
            {registering ? 'Đang đăng ký...' : `Tiếp tục luyện tập (${streak}/5)`}
          </button>
        ) : (
          <button onClick={handleRegister} disabled={registering} style={{ background: '#ff4081', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
            {registering ? 'Đang đăng ký...' : 'Đăng ký kiểm tra'}
          </button>
        )}
      </div>

      <div className="viewer-content">
        {data.videoUrl ? (
          <div style={{ position: 'relative', width: '100%', height: '100%' }} onClick={togglePlay}>
            <video ref={videoRef} src={data.videoUrl} autoPlay loop playsInline controls={false} />
            {!isPlaying && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.5)', borderRadius: '50%', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Play size={48} color="white" fill="white" />
              </div>
            )}
          </div>
        ) : (
          <img src={data.image} alt={data.title} />
        )}
        
        <div className="viewer-info">
          <div className="viewer-chinese">{data.title}</div>
          <div className="viewer-pinyin">{data.pinyin}</div>
          <div className="viewer-vietnamese">{data.vietnamese}</div>
        </div>
      </div>
    </div>
  );
}

export default function StudentDashboard({ user, onLogout, onLoginClick }) {
  const [selectedReel, setSelectedReel] = useState(null);
  const [progressData, setProgressData] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [teachersList, setTeachersList] = useState([]);
  const [selectedTeachers, setSelectedTeachers] = useState([]);

  useEffect(() => {
    if (user) {
      fetchProgress();
    }
  }, [user?.id]);

  const fetchProgress = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'progress'), where('userId', '==', user.id));
      const snapshot = await getDocs(q);
      const pData = {};
      snapshot.docs.forEach(doc => {
        pData[doc.data().videoId] = doc.data();
      });
      setProgressData(pData);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      // Get all students
      const uQ = query(collection(db, 'users'), where('role', '==', 'student'));
      const uSnap = await getDocs(uQ);
      const students = {};
      uSnap.docs.forEach(d => { students[d.id] = { id: d.id, name: d.data().name, passed: 0 }; });

      // Get all passed progress
      const pQ = query(collection(db, 'progress'), where('status', '==', 'PASSED'));
      const pSnap = await getDocs(pQ);
      pSnap.docs.forEach(d => {
        const userId = d.data().userId;
        if (students[userId]) {
          students[userId].passed++;
        }
      });

      const sorted = Object.values(students).sort((a, b) => b.passed - a.passed);
      setLeaderboard(sorted);
      setShowLeaderboard(true);
    } catch (err) {
      console.error(err);
    }
  };

  const openTeacherModal = async () => {
    if (!user) return;
    setShowTeacherModal(true);
    try {
      // 1. Fetch teachers
      const tQ = query(collection(db, 'users'), where('role', '==', 'teacher'));
      const tSnap = await getDocs(tQ);
      setTeachersList(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      // 2. Fetch current user's teacherIds
      const userRef = doc(db, 'users', user.id);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const uData = userSnap.data();
        setSelectedTeachers(uData.teacherIds || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const saveTeachers = async () => {
    if (selectedTeachers.length === 0) {
      alert("Bạn phải chọn ít nhất 1 giáo viên!");
      return;
    }
    try {
      const userRef = doc(db, 'users', user.id);
      await setDoc(userRef, { teacherIds: selectedTeachers }, { merge: true });
      
      const updatedUser = { ...user, teacherIds: selectedTeachers };
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      
      alert("Cập nhật giáo viên thành công!");
      setShowTeacherModal(false);
    } catch (err) {
      console.error(err);
      alert("Lỗi khi lưu!");
    }
  };

  const handleRegisterTest = async (videoId) => {
    if (!user) return;
    try {
      const docId = `${user.id}_${videoId}`;
      await setDoc(doc(db, 'progress', docId), {
        userId: user.id,
        videoId: videoId,
        status: 'WAITING',
        updatedAt: serverTimestamp()
      });
      setProgressData(prev => ({ ...prev, [videoId]: 'WAITING' }));
    } catch (err) {
      console.error(err);
      alert('Có lỗi khi đăng ký!');
    }
  };

  const handleClose = () => {
    const closedId = selectedReel.id;
    setSelectedReel(null);
    setTimeout(() => {
      const el = document.getElementById(`reel-${closedId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  return (
    <div className="app-container">
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>
          <img src="https://images.unsplash.com/photo-1590845947698-8924d7409b56?w=100&h=100&fit=crop" alt="Avatar" className="avatar" />
          {user ? `Xin chào, ${user.name}!` : 'Xin chào, Khách!'}
        </h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          {user ? (
            <>
              <button onClick={openTeacherModal} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#e3f2fd', color: '#1976d2', border: '1px solid #1976d2', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                <Users size={18} /> Đổi giáo viên
              </button>
              <button onClick={fetchLeaderboard} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff9c4', color: '#fbc02d', border: '1px solid #fbc02d', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                <Trophy size={18} /> Bảng Vàng
              </button>
              <button onClick={onLogout} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffebee', color: '#d32f2f', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>
                <LogOut size={18} /> Thoát
              </button>
            </>
          ) : (
            <button onClick={onLoginClick} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#e3f2fd', color: '#1976d2', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              Đăng nhập
            </button>
          )}
        </div>
      </header>

      <main className="reels-grid">
        {reelsData.map((reel) => (
          <ReelCard 
            key={reel.id} 
            data={reel}
            progress={user ? progressData[reel.id] : null}
            onClick={setSelectedReel} 
          />
        ))}
      </main>

      {selectedReel && (
        <ReelViewer 
          data={selectedReel}
          progress={user ? progressData[selectedReel.id] : null}
          onClose={handleClose}
          onRegisterTest={user ? handleRegisterTest : null}
          onLoginClick={onLoginClick}
        />
      )}

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '16px', width: '90%', maxWidth: '400px', position: 'relative' }}>
            <button onClick={() => setShowLeaderboard(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
            <h2 style={{ textAlign: 'center', color: '#fbc02d', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <Trophy size={32} /> Bảng Vàng Thành Tích
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {leaderboard.map((student, index) => (
                <div key={student.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: index === 0 ? '#fff9c4' : '#f5f5f5', borderRadius: '8px', fontWeight: 'bold' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '20px', color: index === 0 ? '#fbc02d' : index === 1 ? '#9e9e9e' : index === 2 ? '#ff9800' : '#777' }}>#{index + 1}</span>
                    <span style={{ fontSize: '18px' }}>{student.name}</span>
                  </div>
                  <div style={{ background: '#4caf50', color: 'white', padding: '4px 12px', borderRadius: '12px' }}>{student.passed} video 100%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Teacher Selection Modal */}
      {showTeacherModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '16px', width: '90%', maxWidth: '400px', position: 'relative' }}>
            <button onClick={() => setShowTeacherModal(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
            <h2 style={{ textAlign: 'center', color: '#1976d2', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <Users size={32} /> Chọn Giáo Viên
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto', marginBottom: '24px' }}>
              {teachersList.length > 0 ? teachersList.map(t => (
                <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', background: '#f5f5f5', padding: '12px', borderRadius: '8px' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedTeachers.includes(t.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedTeachers([...selectedTeachers, t.id]);
                      else setSelectedTeachers(selectedTeachers.filter(id => id !== t.id));
                    }}
                    style={{ width: '20px', height: '20px' }}
                  />
                  <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{t.name}</span>
                </label>
              )) : (
                <div style={{ textAlign: 'center', color: '#666' }}>Không tìm thấy giáo viên nào.</div>
              )}
            </div>

            <button 
              onClick={saveTeachers}
              style={{ width: '100%', background: '#4caf50', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Lưu thay đổi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
