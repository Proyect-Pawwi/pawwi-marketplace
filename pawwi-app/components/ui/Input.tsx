"use client";

import { type InputHTMLAttributes, forwardRef, useId } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = "", id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-semibold text-midnight font-body">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={[
            "h-12 w-full rounded-xl border px-4 text-base text-midnight placeholder:text-midnight/40 font-body",
            "bg-white outline-none transition-colors",
            "focus:border-tangerine focus:ring-2 focus:ring-tangerine/20",
            "disabled:bg-midnight/4 disabled:text-midnight/40 disabled:cursor-not-allowed",
            error
              ? "border-red-400 focus:border-red-400 focus:ring-red-200"
              : "border-midnight/20 hover:border-midnight/40",
            className,
          ].join(" ")}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-sm text-red-500 font-body">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-sm text-midnight/50 font-body">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
export type { InputProps };
