import { useSelector } from 'react-redux';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { selectUser } from '../../redux/slices/authSlice';
import { clearCredentials } from '../../redux/slices/authSlice';
import { logoutUser } from '../../api/auth.api';

export default function Navbar() {
  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch {
      // cookie is cleared regardless
    }
    dispatch(clearCredentials());
    navigate('/login');
  };

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <span className="font-bold text-indigo-600 text-lg tracking-tight">
        SchoolMS
      </span>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">{user?.name}</span>
        <button
          onClick={handleLogout}
          className="text-sm text-red-500 hover:text-red-700 font-medium transition"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
