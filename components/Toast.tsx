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
    }, 3000); // El toast desaparece después de 3 segundos

    return () => {
      clearTimeout(timer);
    };
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';
  const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle';

  return (
    <div className={`fixed bottom-5 right-5 z-50 flex items-center p-4 rounded-lg text-white shadow-lg animate-fade-in-up ${bgColor}`}>
      <i className={`fa-solid ${icon} mr-3 text-lg`}></i>
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-4 text-white opacity-70 hover:opacity-100">
        <i className="fa-solid fa-times"></i>
      </button>
    </div>
  );
};

export default Toast;
