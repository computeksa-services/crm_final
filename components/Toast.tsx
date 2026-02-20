import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000); // El toast desaparece después de 4 segundos

    return () => {
      clearTimeout(timer);
    };
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';
  const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle';

  return (
    <div className={`fixed top-5 right-5 z-[9999] flex items-center px-5 py-4 rounded-xl text-white shadow-2xl animate-fade-in-up ${bgColor} min-w-[280px]`}>
      <i className={`fa-solid ${icon} mr-3 text-xl`}></i>
      <span className="text-base font-semibold flex-1">{message}</span>
      <button onClick={onClose} className="ml-4 text-white opacity-70 hover:opacity-100 transition-opacity">
        <i className="fa-solid fa-times text-lg"></i>
      </button>
    </div>
  );
};

export default Toast;
