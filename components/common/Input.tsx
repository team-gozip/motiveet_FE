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
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    className={`
            w-full px-4 py-2.5 bg-[var(--highlight-bg)] text-[var(--foreground)] border rounded-xl
            focus:ring-2 focus:ring-[var(--accent-primary)]/30 focus:border-[var(--accent-primary)]
            placeholder:text-[var(--text-tertiary)]
            transition-all duration-200
            ${error ? 'border-[var(--danger)]' : 'border-[var(--border-color)]'}
            ${className}
          `}
                    {...props}
                />
                {error && (
                    <p className="mt-1.5 text-sm text-[var(--danger)]">{error}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

export default Input;
