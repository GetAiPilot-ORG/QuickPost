import React from 'react';

export default function HeartLikeCheckbox({
  checked = false,
  onChange,
  size = 20,
  id,
  disabled = false,
}) {
  return (
    <span
      id={id}
      role="button"
      tabIndex={0}
      title="Auto-like comment"
      className={`con-like ${checked ? 'is-checked' : ''} ${disabled ? 'opacity-70 cursor-not-allowed' : ''}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: '0 none',
        outline: 'none',
        boxShadow: 'none',
        padding: 0,
        margin: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) {
          onChange?.(!checked);
        } else {
          onChange?.(checked);
        }
      }}
    >
      <span
        className="checkmark"
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          outline: 'none',
          background: 'transparent',
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="outline"
          viewBox="0 0 24 24"
          style={{
            width: `${size}px`,
            height: `${size}px`,
            position: 'absolute',
            fill: checked ? '#ff3040' : '#9ca3af',
            display: checked ? 'none' : 'block',
            border: 'none',
            outline: 'none',
          }}
        >
          <path d="M17.5,1.917a6.4,6.4,0,0,0-5.5,3.3,6.4,6.4,0,0,0-5.5-3.3A6.8,6.8,0,0,0,0,8.967c0,4.547,4.786,9.513,8.8,12.88a4.974,4.974,0,0,0,6.4,0C19.214,18.48,24,13.514,24,8.967A6.8,6.8,0,0,0,17.5,1.917Zm-3.585,18.4a2.973,2.973,0,0,1-3.83,0C4.947,16.006,2,11.87,2,8.967a4.8,4.8,0,0,1,4.5-5.05A4.8,4.8,0,0,1,11,8.967a1,1,0,0,0,2,0,4.8,4.8,0,0,1,4.5-5.05A4.8,4.8,0,0,1,22,8.967C22,11.87,19.053,16.006,13.915,20.313Z" />
        </svg>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="filled"
          viewBox="0 0 24 24"
          style={{
            width: `${size}px`,
            height: `${size}px`,
            position: 'absolute',
            fill: '#ff3040',
            display: checked ? 'block' : 'none',
            border: 'none',
            outline: 'none',
          }}
        >
          <path d="M17.5,1.917a6.4,6.4,0,0,0-5.5,3.3,6.4,6.4,0,0,0-5.5-3.3A6.8,6.8,0,0,0,0,8.967c0,4.547,4.786,9.513,8.8,12.88a4.974,4.974,0,0,0,6.4,0C19.214,18.48,24,13.514,24,8.967A6.8,6.8,0,0,0,17.5,1.917Z" />
        </svg>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="celebrate"
          viewBox="0 0 100 100"
          style={{
            width: `${size * 2.5}px`,
            height: `${size * 2.5}px`,
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: checked ? 'block' : 'none',
            pointerEvents: 'none',
            border: 'none',
            outline: 'none',
          }}
        >
          <polygon className="poly" points="10,10 20,20" />
          <polygon className="poly" points="10,50 20,50" />
          <polygon className="poly" points="20,80 30,70" />
          <polygon className="poly" points="90,10 80,20" />
          <polygon className="poly" points="90,50 80,50" />
          <polygon className="poly" points="80,80 70,70" />
        </svg>
      </span>
    </span>
  );
}
