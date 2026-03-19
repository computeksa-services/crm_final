import React from 'react';

const APP_HEADER_HEIGHT = 52;

type AppModalViewportProps = React.HTMLAttributes<HTMLDivElement> & {
  respectAppHeader?: boolean;
};

const isInsideAppShell = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.location.pathname.startsWith('/app');
};

const AppModalViewport: React.FC<AppModalViewportProps> = ({
  respectAppHeader = true,
  className = '',
  style,
  ...props
}) => {
  const topOffset = respectAppHeader && isInsideAppShell() ? APP_HEADER_HEIGHT : 0;

  return (
    <div
      {...props}
      className={`fixed inset-x-0 bottom-0 ${className}`.trim()}
      style={{ top: topOffset, ...style }}
    />
  );
};

export default AppModalViewport;