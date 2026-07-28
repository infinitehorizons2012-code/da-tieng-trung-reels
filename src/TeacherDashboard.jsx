import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { LogOut, CheckCircle, Clock, XCircle, Users, Play, X } from 'lucide-react';
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

  const handleGrade = async (videoId, status) => {
    if (!selectedStudent) return;
    try {
      const docId = `${selectedStudent.id}_${videoId}`;
      await setDoc(doc(db, 'progress', docId), {
        userId: selectedStudent.id,
        videoId: videoId,
        status: status,
        updatedAt: serverTimestamp(),
        gradedBy: user.name
      });
      // Refresh local state
      setProgressData(prev => ({
        ...prev,
        [selectedStudent.id]: {
          ...(prev[selectedStudent.id] || {}),
          [videoId]: { status }
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
                <div style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '8px' }}>{student.name}</div>
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
              <h4 style={{ color: '#1976d2', marginBottom: '12px' }}>Video đang chờ kiểm tra</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                {reelsData.filter(v => (progressData[selectedStudent.id]?.[v.id]?.status === 'WAITING')).map(video => (
                  <div key={video.id} onClick={() => setTestingVideo(video)} style={{ cursor: 'pointer', borderRadius: '8px', overflow: 'hidden', border: '2px solid #1976d2', position: 'relative', aspectRatio: '9/16' }}>
                    <video src={video.videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.7)', color: 'white', padding: '8px', fontSize: '12px', textAlign: 'center' }}>Bấm để kiểm tra</div>
                  </div>
                ))}
              </div>

              {/* All other videos history */}
              <h4 style={{ marginBottom: '12px' }}>Lịch sử luyện tập</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' }}>
                {reelsData.filter(v => progressData[selectedStudent.id]?.[v.id]?.status && progressData[selectedStudent.id]?.[v.id]?.status !== 'WAITING').map(video => {
                  const status = progressData[selectedStudent.id]?.[v.id]?.status;
                  let color = '#ccc';
                  if (status === 'PASSED') color = '#4caf50';
                  if (status === 'PRACTICING') color = '#ff9800';
                  if (status === 'FAILED') color = '#f44336';
                  return (
                    <div key={video.id} onClick={() => setTestingVideo(video)} style={{ cursor: 'pointer', borderRadius: '8px', overflow: 'hidden', border: `2px solid ${color}`, opacity: 0.8 }}>
                      <video src={video.videoUrl} style={{ width: '100%', height: '120px', objectFit: 'cover' }} />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#777', padding: '60px 20px' }}>
              Hãy chọn một học sinh bên trái để xem hồ sơ và kiểm tra.
            </div>
          )}
        </div>
      </div>

      {/* Video Tester Modal */}
      {testingVideo && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={() => setTestingVideo(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={32} /></button>
          
          <div style={{ height: '70vh', maxWidth: '400px', width: '100%', background: '#000', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}>
             <video src={testingVideo.videoUrl} autoPlay loop controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          
          <div style={{ color: 'white', textAlign: 'center', marginBottom: '24px' }}>
             <h2 style={{ fontFamily: '"ZCOOL KuaiLe", cursive', color: '#FFD700' }}>{testingVideo.title}</h2>
             <p style={{ fontSize: '20px' }}>{testingVideo.pinyin}</p>
             <p>{testingVideo.vietnamese}</p>
          </div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => handleGrade(testingVideo.id, 'PASSED')} style={{ background: '#4caf50', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
               <CheckCircle /> Đạt 100%
            </button>
            <button onClick={() => handleGrade(testingVideo.id, 'PRACTICING')} style={{ background: '#ff9800', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
               <Clock /> Đang luyện tập
            </button>
            <button onClick={() => handleGrade(testingVideo.id, 'FAILED')} style={{ background: '#f44336', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
               <XCircle /> Chưa qua
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
