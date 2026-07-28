import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { LogOut, CheckCircle, Clock, XCircle, Users, Play, X, Trash2 } from 'lucide-react';
import { reelsData } from './data';

export default function TeacherDashboard({ user, onLogout }) {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [progressData, setProgressData] = useState({});
  const [testingVideo, setTestingVideo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch all students
      const q = query(collection(db, 'users'), where('role', '==', 'student'));
      const snapshot = await getDocs(q);
      const studentsList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setStudents(studentsList);

      // 2. Fetch all progress
      const pQ = query(collection(db, 'progress'));
      const pSnapshot = await getDocs(pQ);
      const pData = {};
      pSnapshot.docs.forEach(d => {
        const data = d.data();
        if (!pData[data.userId]) pData[data.userId] = {};
        pData[data.userId][data.videoId] = data;
      });
      setProgressData(pData);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleDeleteStudent = async (studentId, studentName) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản học sinh "${studentName}" không?`)) {
      try {
        await deleteDoc(doc(db, 'users', studentId));
        setStudents(students.filter(s => s.id !== studentId));
        if (selectedStudent?.id === studentId) setSelectedStudent(null);
        alert('Đã xóa tài khoản thành công!');
      } catch (err) {
        console.error(err);
        alert('Có lỗi xảy ra khi xóa!');
      }
    }
  };

  const getStudentStats = (studentId) => {
    const sData = progressData[studentId] || {};
    let waiting = 0, passed = 0, practicing = 0, failed = 0;
    
    Object.values(sData).forEach(p => {
      if (p.status === 'WAITING') waiting++;
      if (p.status === 'PASSED') passed++;
      if (p.status === 'PRACTICING') practicing++;
      if (p.status === 'FAILED') failed++;
    });
    
    return { waiting, passed, practicing, failed, total: passed + practicing + failed + waiting };
  };

  const handleGrade = async (videoId, isCorrect) => {
    if (!selectedStudent) return;
    try {
      const docId = `${selectedStudent.id}_${videoId}`;
      
      const currentProgress = progressData[selectedStudent.id]?.[videoId] || {};
      let currentStreak = currentProgress.streak || 0;
      if (currentProgress.status === 'PASSED') {
          currentStreak = 5;
      }

      let newStreak = isCorrect ? currentStreak + 1 : 0;
      let newStatus = 'WAITING';
      
      if (newStreak >= 5) {
          newStatus = 'PASSED';
      } else if (newStreak > 0) {
          newStatus = 'PRACTICING';
      } else {
          newStatus = 'FAILED';
      }

      await setDoc(doc(db, 'progress', docId), {
        userId: selectedStudent.id,
        videoId: videoId,
        status: newStatus,
        streak: newStreak,
        updatedAt: serverTimestamp(),
        gradedBy: user.name
      });
      
      // Refresh local state
      setProgressData(prev => ({
        ...prev,
        [selectedStudent.id]: {
          ...(prev[selectedStudent.id] || {}),
          [videoId]: { ...currentProgress, status: newStatus, streak: newStreak }
        }
      }));
      setTestingVideo(null); // Close viewer after grading
    } catch (err) {
      alert("Lỗi khi chấm điểm!");
      console.error(err);
    }
  };

  const getRandomVideoForTest = () => {
    if (!selectedStudent) return;
    // Lấy danh sách video đã được học/đăng ký
    const sData = progressData[selectedStudent.id] || {};
    const eligibleVideoIds = Object.keys(sData).map(id => parseInt(id));
    
    if (eligibleVideoIds.length === 0) {
      alert("Học sinh này chưa học hoặc đăng ký video nào!");
      return;
    }
    
    const randomId = eligibleVideoIds[Math.floor(Math.random() * eligibleVideoIds.length)];
    const video = reelsData.find(r => r.id === randomId);
    if (video) setTestingVideo(video);
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Đang tải dữ liệu...</div>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', borderBottom: '1px solid #ddd', paddingBottom: '16px' }}>
        <h2><Users style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Quản lý Học sinh (Nhân viên: {user.name})</h2>
        <button onClick={onLogout} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffebee', color: '#d32f2f', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>
          <LogOut size={18} /> Đăng xuất
        </button>
      </header>

      {/* Main Layout */}
      <div style={{ display: 'flex', gap: '24px', flexDirection: window.innerWidth < 768 ? 'column' : 'row' }}>
        
        {/* Sidebar: List of Students */}
        <div style={{ flex: '0 0 300px', background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', height: 'fit-content' }}>
          <h3 style={{ marginBottom: '16px' }}>Danh sách học sinh</h3>
          {students.map(student => {
            const stats = getStudentStats(student.id);
            const isSelected = selectedStudent?.id === student.id;
            return (
              <div 
                key={student.id} 
                onClick={() => setSelectedStudent(student)}
                style={{ 
                  padding: '12px', marginBottom: '8px', borderRadius: '8px', cursor: 'pointer',
                  border: isSelected ? '2px solid #1877f2' : '1px solid #eee',
                  background: isSelected ? '#f0f8ff' : 'white'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '18px' }}>{student.name}</div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteStudent(student.id, student.name); }}
                    style={{ background: 'none', border: 'none', color: '#f44336', cursor: 'pointer', padding: '4px' }}
                    title="Xóa học sinh này"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '8px', fontSize: '12px', flexWrap: 'wrap' }}>
                  {stats.waiting > 0 && <span style={{ background: '#e3f2fd', color: '#1976d2', padding: '2px 8px', borderRadius: '12px' }}>{stats.waiting} Đăng ký chờ</span>}
                  <span style={{ background: '#e8f5e9', color: '#388e3c', padding: '2px 8px', borderRadius: '12px' }}>{stats.passed} Đạt 100%</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Main Content: Student Detail & Test */}
        <div style={{ flex: 1, background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          {selectedStudent ? (
            (() => {
              const studentProgress = progressData[selectedStudent.id] || {};
              const safeReels = Array.isArray(reelsData) ? reelsData : [];
              
              const waitingVideos = safeReels.filter(v => studentProgress[v.id] && studentProgress[v.id].status === 'WAITING');
              const historyVideos = safeReels.filter(v => studentProgress[v.id] && studentProgress[v.id].status !== 'WAITING');

              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h3>Hồ sơ học tập: {selectedStudent.name}</h3>
                    <button 
                      onClick={getRandomVideoForTest}
                      style={{ background: '#9c27b0', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <Play size={18} /> Hỏi bài ngẫu nhiên
                    </button>
                  </div>

                  {/* Waiting for test */}
                  <h4 style={{ color: '#1976d2', marginBottom: '12px' }}>Video đang chờ kiểm tra ({waitingVideos.length})</h4>
                  {waitingVideos.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                      {waitingVideos.map(video => (
                        <div key={video.id} onClick={() => setTestingVideo(video)} style={{ cursor: 'pointer', borderRadius: '8px', overflow: 'hidden', border: '2px solid #1976d2', position: 'relative', aspectRatio: '9/16' }}>
                          <video src={video.videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.7)', color: 'white', padding: '8px', fontSize: '12px', textAlign: 'center' }}>Bấm để kiểm tra</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '20px', background: '#f5f5f5', borderRadius: '8px', marginBottom: '32px', color: '#666', textAlign: 'center' }}>
                      Chưa có video nào đang chờ kiểm tra
                    </div>
                  )}

                  {/* All other videos history */}
                  <h4 style={{ marginBottom: '12px' }}>Lịch sử luyện tập ({historyVideos.length})</h4>
                  {historyVideos.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' }}>
                      {historyVideos.map(video => {
                        const status = studentProgress[video.id].status;
                        let color = '#ccc';
                        if (status === 'PASSED') color = '#4caf50';
                        if (status === 'PRACTICING') color = '#ff9800';
                        if (status === 'FAILED') color = '#f44336';
                        return (
                          <div key={video.id} onClick={() => setTestingVideo(video)} style={{ cursor: 'pointer', borderRadius: '8px', overflow: 'hidden', border: `3px solid ${color}`, opacity: 0.9 }}>
                            <video src={video.videoUrl} style={{ width: '100%', height: '120px', objectFit: 'cover' }} />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ padding: '20px', background: '#f5f5f5', borderRadius: '8px', color: '#666', textAlign: 'center' }}>
                      Chưa có lịch sử học tập
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <div style={{ textAlign: 'center', color: '#777', padding: '60px 20px' }}>
              Hãy chọn một học sinh bên trái để xem hồ sơ và kiểm tra.
            </div>
          )}
        </div>
      </div>

      {/* Testing Modal */}
      {testingVideo && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
          <button onClick={() => setTestingVideo(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', cursor: 'pointer', color: 'white', zIndex: 1001 }}>
             <X size={32} />
          </button>
          
          <div 
            style={{ flex: 1, position: 'relative', background: '#000', cursor: 'pointer' }}
            onClick={() => {
              const video = document.getElementById('teacher-video');
              if (video) {
                if (video.paused) video.play();
                else video.pause();
              }
            }}
          >
            <video 
              id="teacher-video"
              src={testingVideo.videoUrl} 
              autoPlay 
              loop 
              style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} 
            />
          </div>

          <div style={{ color: 'white', textAlign: 'center', marginBottom: '24px' }}>
             <h2 style={{ fontFamily: '"ZCOOL KuaiLe", cursive', color: '#FFD700' }}>{testingVideo.title}</h2>
             <p style={{ fontSize: '20px' }}>{testingVideo.pinyin}</p>
             <p>{testingVideo.vietnamese}</p>
             
             {(() => {
                const currentProgress = progressData[selectedStudent.id]?.[testingVideo.id] || {};
                const streak = currentProgress.status === 'PASSED' ? 5 : (currentProgress.streak || 0);
                return <p style={{ fontSize: '20px', color: '#00e676', fontWeight: 'bold', marginTop: '16px' }}>🔥 Chuỗi đúng: {streak}/5</p>
             })()}
          </div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => handleGrade(testingVideo.id, true)} style={{ background: '#4caf50', color: 'white', border: 'none', padding: '16px 32px', borderRadius: '8px', fontSize: '20px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
               <CheckCircle size={28} /> ĐÚNG
            </button>
            <button onClick={() => handleGrade(testingVideo.id, false)} style={{ background: '#f44336', color: 'white', border: 'none', padding: '16px 32px', borderRadius: '8px', fontSize: '20px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
               <XCircle size={28} /> SAI
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
