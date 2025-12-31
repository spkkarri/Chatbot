// src/components/core/Button.jsx
import React from 'react';
import { Loader2 } from 'lucide-react'; // For loading spinner

const Button = ({
    children,
    onClick,
    type = 'button',
    variant = 'primary', // 'primary', 'secondary', 'danger', 'outline', 'ghost'
    size = 'md', // 'sm', 'md', 'lg'
    leftIcon,
    rightIcon,
    isLoading = false,
    disabled = false,
    fullWidth = false,
    className = '',
    ...props
}) => {
    const baseStyles = "font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-75 transition-all duration-150 ease-in-out flex items-center justify-center gap-2";

    const variantStyles = {
        primary: "bg-primary hover:bg-primary-dark text-white focus:ring-primary",
        secondary: "bg-secondary hover:bg-secondary-dark text-white focus:ring-secondary",
        danger: "bg-red-500 hover:bg-red-600 text-white focus:ring-red-500",
        outline: "border border-primary text-primary hover:bg-primary-light dark:hover:bg-opacity-10 focus:ring-primary",
        ghost: "text-primary hover:bg-primary-light dark:hover:bg-opacity-10 focus:ring-primary",
    };

    const sizeStyles = {
        sm: "px-3 py-1.5 text-xs",
        md: "px-4 py-2 text-sm",
        lg: "px-6 py-3 text-base",
    };

    const widthStyle = fullWidth ? "w-full" : "";
    const isDisabled = disabled || isLoading;
    const finalDisabledStyle = isDisabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer";

    const spinnerSize = size === 'sm' ? 14 : (size === 'lg' ? 20 : 16);
    
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={isDisabled} // Use the corrected variable
            className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyle} ${finalDisabledStyle} ${className}`}
            {...props}
        >
            {isLoading && (
                <Loader2 size={spinnerSize} className="animate-spin" />
            )}
            {!isLoading && leftIcon && <span className="icon-left">{leftIcon}</span>}

            <span className={isLoading ? 'ml-2' : ''}>{children}</span>

            {!isLoading && rightIcon && <span className="icon-right">{rightIcon}</span>}
        </button>
    );
};

export default Button;