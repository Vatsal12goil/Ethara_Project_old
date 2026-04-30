import React, { useEffect } from 'react';
import { useAuth } from '../services/authContext';
import { LogIn } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const { user, signIn, loading } = useAuth();
  const navigate = useNavigate();
  const [isSigningIn, setIsSigningIn] = React.useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  const handleSignIn = async () => {
    try {
      setIsSigningIn(true);
      const result = await signIn();
      if (result) {
        navigate('/');
      }
    } catch (error) {
      console.error(error);
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-400 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-12 rounded-xl border border-slate-200 shadow-2xl max-w-md w-full text-center relative z-10"
      >
        <div className="mb-10">
          <div className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-indigo-200 shadow-lg">
            <span className="text-2xl font-bold">P</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">CollabGrid</h1>
          <p className="text-slate-500 text-sm leading-relaxed">Unified workspace for modern teams.<br/>Collaborate, build, and ship faster.</p>
        </div>

        <button 
          onClick={handleSignIn}
          disabled={isSigningIn || loading}
          className="w-full flex items-center justify-center gap-3 bg-indigo-600 text-white py-4 px-6 rounded-xl font-bold hover:bg-indigo-700 transition-all active:scale-[0.98] shadow-xl shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSigningIn || (loading && !user) ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Authenticating...
            </span>
          ) : (
            <>
              <LogIn size={20} />
              Sign in with Google
            </>
          )}
        </button>
        
        <p className="mt-10 text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] text-center">
          Enterprise Security Standard
        </p>
      </motion.div>
    </div>
  );
}
