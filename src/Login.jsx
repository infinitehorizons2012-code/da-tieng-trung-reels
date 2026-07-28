import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { User, Lock, UserPlus, LogIn } from 'lucide-react';

export default function Login({ onLogin }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    // Load users for the dropdown
    const fetchUsers = async () => {
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
      if (usersData.length > 0 && !isRegistering) {
        setName(usersData[0].name);
      }
    };
    fetchUsers();
  }, [isRegistering]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (pin.length < 4) {
      setError('Mã PIN phải có ít nhất 4 số');
      setLoading(false);
      return;
    }

    try {
      if (isRegistering) {
        // Check if name exists
        const q = query(collection(db, 'users'), where('name', '==', name));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          setError('Tên này đã được đăng ký, vui lòng chọn tên khác');
          setLoading(false);
          return;
        }

        const docRef = await addDoc(collection(db, 'users'), {
          name,
          pin,
          role
        });
        
        const newUser = { id: docRef.id, name, pin, role };
        localStorage.setItem('currentUser', JSON.stringify(newUser));
        onLogin(newUser);
      } else {
        // Login
        const q = query(collection(db, 'users'), where('name', '==', name), where('pin', '==', pin));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
          setError('Tên hoặc mã PIN không đúng');
        } else {
          const userDoc = snapshot.docs[0];
          const userData = { id: userDoc.id, ...userDoc.data() };
          localStorage.setItem('currentUser', JSON.stringify(userData));
          onLogin(userData);
        }
      }
    } catch (err) {
      console.error(err);
      setError('Có lỗi xảy ra, vui lòng thử lại');
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
      <div style={{ background: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          {isRegistering ? <><UserPlus /> Đăng ký tài khoản</> : <><LogIn /> Đăng nhập</>}
        </h2>
        
        {error && <div style={{ color: 'red', background: '#ffebee', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{error}</div>}
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Tên của bạn</label>
            {isRegistering || users.length === 0 ? (
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc' }}
                placeholder="Nhập tên..."
              />
            ) : (
              <select 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc' }}
              >
                {users.map(u => (
                  <option key={u.id} value={u.name}>{u.name} ({u.role === 'teacher' ? 'Nhân viên' : 'Học sinh'})</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Mã PIN (4 số)</label>
            <input 
              type="password" 
              value={pin} 
              onChange={(e) => setPin(e.target.value)} 
              required 
              maxLength={4}
              pattern="\d*"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc' }}
              placeholder="VD: 1234"
            />
          </div>

          {isRegistering && (
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Vai trò</label>
              <select 
                value={role} 
                onChange={(e) => setRole(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc' }}
              >
                <option value="student">Học sinh</option>
                <option value="teacher">Nhân viên kiểm tra</option>
              </select>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              background: '#1877f2', color: 'white', border: 'none', padding: '12px', 
              borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer',
              marginTop: '8px', opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Đang xử lý...' : (isRegistering ? 'Đăng ký' : 'Đăng nhập')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <button 
            onClick={() => { setIsRegistering(!isRegistering); setError(''); setName(''); setPin(''); }}
            style={{ background: 'none', border: 'none', color: '#1877f2', cursor: 'pointer', fontSize: '14px', textDecoration: 'underline' }}
          >
            {isRegistering ? 'Đã có tài khoản? Đăng nhập ngay' : 'Chưa có tài khoản? Đăng ký mới'}
          </button>
        </div>
      </div>
    </div>
  );
}
