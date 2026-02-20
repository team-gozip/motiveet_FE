'use client';

import React, { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, className = '', ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-medium text-[var(--foreground)] opacity-80 mb-1">
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    className={`
            w-full px-4 py-2 bg-[var(--card-bg)] text-[var(--foreground)] border rounded-lg
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            placeholder:text-[var(--foreground)] placeholder:opacity-40
            transition-all duration-200
            ${error ? 'border-red-500' : 'border-[var(--border-color)]'}
            ${className}
          `}
                    {...props}
                />
                {error && (
                    <p className="mt-1 text-sm text-red-500">{error}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

export default Input;
