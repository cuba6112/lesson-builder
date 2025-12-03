import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';

// Pre-built interactive components available in the sandbox
const scopeComponents = {
  // React core (needed for JSX)
  React,

  // Hooks
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,

  // UI Components
  Button: ({ children, onClick, variant = 'primary', disabled = false }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg font-medium transition-all ${
        variant === 'primary'
          ? 'bg-blue-500 text-white hover:bg-blue-600 disabled:bg-blue-300'
          : variant === 'secondary'
          ? 'bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:bg-gray-100'
          : variant === 'success'
          ? 'bg-green-500 text-white hover:bg-green-600 disabled:bg-green-300'
          : variant === 'danger'
          ? 'bg-red-500 text-white hover:bg-red-600 disabled:bg-red-300'
          : 'bg-blue-500 text-white hover:bg-blue-600'
      }`}
    >
      {children}
    </button>
  ),

  Card: ({ children, title, className = '' }) => (
    <div className={`bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden ${className}`}>
      {title && (
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 font-semibold text-gray-700">
          {title}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  ),

  Badge: ({ children, color = 'blue' }) => (
    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
      color === 'blue' ? 'bg-blue-100 text-blue-700' :
      color === 'green' ? 'bg-green-100 text-green-700' :
      color === 'red' ? 'bg-red-100 text-red-700' :
      color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
      color === 'purple' ? 'bg-purple-100 text-purple-700' :
      'bg-gray-100 text-gray-700'
    }`}>
      {children}
    </span>
  ),

  Progress: ({ value = 0, max = 100, color = 'blue' }) => (
    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-300 ${
          color === 'blue' ? 'bg-blue-500' :
          color === 'green' ? 'bg-green-500' :
          color === 'red' ? 'bg-red-500' :
          color === 'yellow' ? 'bg-yellow-500' :
          'bg-blue-500'
        }`}
        style={{ width: `${Math.min(100, Math.max(0, (value / max) * 100))}%` }}
      />
    </div>
  ),

  Alert: ({ children, type = 'info' }) => (
    <div className={`p-4 rounded-lg border ${
      type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-800' :
      type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
      type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
      type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
      'bg-gray-50 border-gray-200 text-gray-800'
    }`}>
      {children}
    </div>
  ),

  Input: ({ value, onChange, placeholder, type = 'text', className = '' }) => (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${className}`}
    />
  ),

  Flex: ({ children, direction = 'row', gap = 2, align = 'center', justify = 'start', wrap = false }) => (
    <div className={`flex ${
      direction === 'column' ? 'flex-col' : 'flex-row'
    } gap-${gap} items-${align} justify-${justify} ${wrap ? 'flex-wrap' : ''}`}>
      {children}
    </div>
  ),

  Grid: ({ children, cols = 2, gap = 4 }) => (
    <div className={`grid grid-cols-${cols} gap-${gap}`}>
      {children}
    </div>
  ),

  // Quiz Component
  Quiz: ({ question, options, correctIndex, onAnswer }) => {
    const [selected, setSelected] = useState(null);
    const [revealed, setRevealed] = useState(false);

    const handleSelect = (index) => {
      if (revealed) return;
      setSelected(index);
    };

    const handleCheck = () => {
      setRevealed(true);
      if (onAnswer) onAnswer(selected === correctIndex);
    };

    return (
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-5 rounded-xl border border-purple-200">
        <p className="font-semibold text-gray-800 mb-4">{question}</p>
        <div className="space-y-2 mb-4">
          {options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                revealed
                  ? i === correctIndex
                    ? 'bg-green-100 border-green-400 text-green-800'
                    : i === selected
                    ? 'bg-red-100 border-red-400 text-red-800'
                    : 'bg-white border-gray-200'
                  : selected === i
                  ? 'bg-blue-100 border-blue-400'
                  : 'bg-white border-gray-200 hover:border-blue-300'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        {!revealed && selected !== null && (
          <button
            onClick={handleCheck}
            className="w-full py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
          >
            Check Answer
          </button>
        )}
        {revealed && (
          <p className={`text-center font-medium ${selected === correctIndex ? 'text-green-600' : 'text-red-600'}`}>
            {selected === correctIndex ? '✓ Correct!' : '✗ Try again!'}
          </p>
        )}
      </div>
    );
  },

  // Counter demo
  Counter: ({ initial = 0, step = 1 }) => {
    const [count, setCount] = useState(initial);
    return (
      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
        <button
          onClick={() => setCount(c => c - step)}
          className="w-10 h-10 rounded-full bg-red-500 text-white text-xl font-bold hover:bg-red-600"
        >
          -
        </button>
        <span className="text-2xl font-bold min-w-[60px] text-center">{count}</span>
        <button
          onClick={() => setCount(c => c + step)}
          className="w-10 h-10 rounded-full bg-green-500 text-white text-xl font-bold hover:bg-green-600"
        >
          +
        </button>
      </div>
    );
  },

  // Toggle/Switch
  Toggle: ({ label, checked, onChange }) => {
    const [isOn, setIsOn] = useState(checked || false);
    const handleToggle = () => {
      setIsOn(!isOn);
      if (onChange) onChange(!isOn);
    };
    return (
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={handleToggle}
          className={`w-12 h-6 rounded-full p-1 transition-colors ${isOn ? 'bg-blue-500' : 'bg-gray-300'}`}
        >
          <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${isOn ? 'translate-x-6' : ''}`} />
        </div>
        {label && <span className="text-gray-700">{label}</span>}
      </label>
    );
  },

  // Tabs component
  Tabs: ({ tabs }) => {
    const [active, setActive] = useState(0);
    return (
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex border-b border-gray-200 bg-gray-50">
          {tabs.map((tab, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`px-4 py-2 font-medium transition-colors ${
                active === i
                  ? 'bg-white text-blue-600 border-b-2 border-blue-500'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="p-4">{tabs[active]?.content}</div>
      </div>
    );
  },
};

export { scopeComponents };
