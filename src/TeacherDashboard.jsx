import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { LogOut, CheckCircle, Clock, XCircle, Users, Play, X, Trash2, CalendarDays } from 'lucide-react';
import { reelsData } from './data';

function ReportView({ stats, progress, reels }) {
  const grouped = {};
  stats.forEach(s => {
    if (!grouped[s.date]) grouped[s.date] = [];
    grouped[s.date].push(s);
  });

  const dates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

  if (dates.length === 0) {
    return <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>Chưa có dữ liệu học tập nào được ghi nhận.</div>;
  }

  return (
    <div>
      {dates.map(date => {
        const d = new Date(date);
        const dateStr = d.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' });
        return (
          <div key={date} style={{ marginBottom: '32px' }}>
            <h4 style={{ background: '#f5f5f5', padding: '12px', borderRadius: '8px', marginBottom: '12px', color: '#333' }}>{dateStr}</h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left', background: '#fafafa' }}>
                    <th style={{ padding: '12px', width: '40%' }}>Video bài học</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Số lần Click mở</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Xem hết vòng lặp</th>
                    <th style={{ padding: '12px' }}>Trạng thái hiện tại</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped[date].map(s => {
                    const video = reels.find(r => r.id === s.videoId);
                    if (!video) return null;

                    const p = progress[s.videoId] || {};
                    let statusText = 'Chưa luyện tập';
                    let statusColor = '#999';
                    if (p.status === 'PASSED') { statusText = 'Đạt 100%'; statusColor = '#4caf50'; }
                    if (p.status === 'WAITING') { statusText = 'Đang chờ KT'; statusColor = '#1976d2'; }
                    if (p.status === 'PRACTICING') { statusText = 'Đang luyện tập'; statusColor = '#ff9800'; }
                    if (p.status === 'FAILED') { statusText = 'Làm sai'; statusColor = '#f44336'; }

                    const videoTab = video ? (video.tab || "1") : "1";
                    const tabVideos = reels.filter(r => (r.tab || "1") === videoTab);
                    const localIndex = video ? tabVideos.findIndex(r => r.id === video.id) : -1;
                    
                    const tabLabels = { "1": "Bé Trai", "2": "Bé Gái 1", "3": "Bé Gái 2", "4": "Người Nữ", "5": "Người Nam" };
                    const tabName = tabLabels[videoTab] || `Tab ${videoTab}`;

                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: 'bold' }}>
                            {video ? (
                              <a href={video.videoUrl} target="_blank" rel="noreferrer" style={{ color: '#1976d2', textDecoration: 'none' }}>
                                {video.title || `[${tabName}] Video số ${localIndex + 1}`}
                              </a>
                            ) : 'Video đã xóa'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#666' }}>{video ? video.vietnamese : ''}</div>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#1976d2', fontSize: '16px' }}>{s.clicks || 0}</td>
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#4caf50', fontSize: '16px' }}>{s.fullWatches || 0}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ background: `${statusColor}22`, color: statusColor, padding: '4px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold' }}>
                            {statusText}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function TeacherDashboard({ user, onLogout }) {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [progressData, setProgressData] = useState({});
  const [testingVideo, setTestingVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('grading');
  const [dailyStats, setDailyStats] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedStudent) {
      fetchDailyStats(selectedStudent.id);
    }
  }, [selectedStudent]);

  const fetchDailyStats = async (studentId) => {
    try {
      const q = query(collection(db, 'daily_stats'), where('userId', '==', studentId));
      const snap = await getDocs(q);
      const stats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDailyStats(stats);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch all students
      const q = query(collection(db, 'users'), where('role', '==', 'student'));
      const snapshot = await getDocs(q);
      const studentsList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const filteredStudents = studentsList.filter(s => {
        return s.teacherIds && s.teacherIds.includes(user.id);
      });
      setStudents(filteredStudents);

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

  const handleRejectStudent = async (studentId, studentName) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa học sinh "${studentName}" khỏi lớp của bạn? (Tài khoản học sinh sẽ không bị xóa vĩnh viễn)`)) {
      try {
        const student = students.find(s => s.id === studentId);
        if (student && student.teacherIds) {
          const newTeacherIds = student.teacherIds.filter(id => id !== user.id);
          await setDoc(doc(db, 'users', studentId), { teacherIds: newTeacherIds }, { merge: true });
        }
        setStudents(students.filter(s => s.id !== studentId));
        if (selectedStudent?.id === studentId) setSelectedStudent(null);
        alert('Đã xóa học sinh khỏi danh sách lớp!');
      } catch (err) {
        console.error(err);
        alert('Có lỗi xảy ra khi từ chối!');
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

  const handleDeleteProgress = async (videoId) => {
    if (!selectedStudent) return;
    if (!window.confirm("Bạn có chắc muốn xóa video này khỏi lịch sử của học sinh?")) return;
    
    try {
      const docId = `${selectedStudent.id}_${videoId}`;
      await deleteDoc(doc(db, 'progress', docId));
      
      // Update local state
      setProgressData(prev => {
        const newStudentData = { ...prev[selectedStudent.id] };
        delete newStudentData[videoId];
        return {
          ...prev,
          [selectedStudent.id]: newStudentData
        };
      });
    } catch (err) {
      alert("Lỗi khi xóa!");
      console.error(err);
    }
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
                  <div style={{ fontWeight: 'bold', fontSize: '18px' }}>
                    {student.name} <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#666' }}>(PIN: {student.pin})</span>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleRejectStudent(student.id, student.name); }}
                    style={{ background: 'none', border: 'none', color: '#f44336', cursor: 'pointer', padding: '4px' }}
                    title="Từ chối học sinh này"
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
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid #eee' }}>
                    <button 
                      onClick={() => setActiveTab('grading')}
                      style={{ padding: '12px 24px', background: 'none', border: 'none', borderBottom: activeTab === 'grading' ? '3px solid #1877f2' : '3px solid transparent', fontWeight: 'bold', color: activeTab === 'grading' ? '#1877f2' : '#666', cursor: 'pointer', fontSize: '16px', transition: 'all 0.3s' }}
                    >
                      <CheckCircle size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Chấm bài & Lịch sử
                    </button>
                    <button 
                      onClick={() => setActiveTab('report')}
                      style={{ padding: '12px 24px', background: 'none', border: 'none', borderBottom: activeTab === 'report' ? '3px solid #1877f2' : '3px solid transparent', fontWeight: 'bold', color: activeTab === 'report' ? '#1877f2' : '#666', cursor: 'pointer', fontSize: '16px', transition: 'all 0.3s' }}
                    >
                      <CalendarDays size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Báo cáo theo ngày
                    </button>
                  </div>

                  {activeTab === 'grading' ? (
                    <>
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
                          <div key={video.id} style={{ position: 'relative' }}>
                            <div onClick={() => setTestingVideo(video)} style={{ cursor: 'pointer', borderRadius: '8px', overflow: 'hidden', border: `3px solid ${color}`, opacity: 0.9 }}>
                              <video src={video.videoUrl} style={{ width: '100%', height: '120px', objectFit: 'cover' }} />
                            </div>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProgress(video.id);
                              }}
                              title="Xóa khỏi lịch sử"
                              style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#f44336', color: 'white', border: '2px solid white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                            >
                              <X size={14} strokeWidth={3} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ padding: '20px', background: '#f5f5f5', borderRadius: '8px', color: '#666', textAlign: 'center' }}>
                      Chưa có lịch sử học tập
                    </div>
                  )}
                    </>
                  ) : (
                    <ReportView stats={dailyStats} progress={studentProgress} reels={safeReels} />
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <button onClick={() => setTestingVideo(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', cursor: 'pointer', color: 'white', zIndex: 1001 }}>
             <X size={32} />
          </button>
          
          <div 
            style={{ height: '50vh', maxWidth: '400px', width: '100%', position: 'relative', background: '#000', cursor: 'pointer', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}
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

          <div style={{ color: 'white', textAlign: 'center', marginBottom: '24px', maxWidth: '600px' }}>
             <h2 style={{ fontFamily: '"ZCOOL KuaiLe", cursive', color: '#FFD700', marginBottom: '8px' }}>{testingVideo.title}</h2>
             <p style={{ fontSize: '24px', marginBottom: '8px' }}>{testingVideo.pinyin}</p>
             <p style={{ fontSize: '18px' }}>{testingVideo.vietnamese}</p>
             
             {(() => {
                const currentProgress = progressData[selectedStudent.id]?.[testingVideo.id] || {};
                const streak = currentProgress.status === 'PASSED' ? 5 : (currentProgress.streak || 0);
                return <p style={{ fontSize: '20px', color: '#00e676', fontWeight: 'bold', marginTop: '16px' }}>🔥 Chuỗi đúng: {streak}/5</p>
             })()}
          </div>

          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => handleGrade(testingVideo.id, true)} style={{ background: '#4caf50', color: 'white', border: '2px solid white', padding: '16px 40px', borderRadius: '50px', fontSize: '20px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(76, 175, 80, 0.4)' }}>
               <CheckCircle size={28} /> ĐÚNG
            </button>
            <button onClick={() => handleGrade(testingVideo.id, false)} style={{ background: '#f44336', color: 'white', border: '2px solid white', padding: '16px 40px', borderRadius: '50px', fontSize: '20px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(244, 67, 54, 0.4)' }}>
               <XCircle size={28} /> SAI
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
