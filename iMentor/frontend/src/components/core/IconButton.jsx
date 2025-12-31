import React from 'react';
import { Loader2 } from 'lucide-react';

const IconButton = ({
    icon: Icon, // Pass the Lucide icon component directly
    onClick,
    variant = 'ghost', // 'ghost', 'outline', 'subtle'
    size = 'md', // 'sm', 'md', 'lg'
    isLoading = false,
    disabled = false,
    className = '',
    title, // For accessibility and tooltips
    ariaLabel,
    ...props
}) => {
    const baseStyles = "rounded-md focus:outline-none focus:ring-2 focus:ring-opacity-75 transition-colors duration-150 flex items-center justify-center";

    const variantStyles = {
        ghost: "text-text-muted-light dark:text-text-muted-dark hover:bg-gray-200 dark:hover:bg-gray-700 focus:ring-primary",
        outline: "border border-gray-300 dark:border-gray-600 text-text-muted-light dark:text-text-muted-dark hover:border-primary hover:text-primary focus:ring-primary",
        subtle: "bg-gray-100 dark:bg-gray-700 text-text-light dark:text-text-dark hover:bg-gray-200 dark:hover:bg-gray-600 focus:ring-primary",
        danger: "text-red-500 hover:bg-red-100 dark:hover:bg-red-900 focus:ring-red-500"
    };

    const sizeStyles = {
        sm: "p-1.5", // Icon size typically 14-16px
        md: "p-2",   // Icon size typically 18-20px
        lg: "p-2.5", // Icon size typically 22-24px
    };
    
    const iconSizeMap = {
        sm: 16,
        md: 20,
        lg: 24,
    };

    const disabledStyle = (disabled || isLoading) ? "opacity-50 cursor-not-allowed" : "cursor-pointer";

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled || isLoading}
            className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${disabledStyle} ${className}`}
            title={title}
            aria-label={ariaLabel || title}
            {...props}
        >
            {isLoading ? (
                <Loader2 size={iconSizeMap[size]} className="animate-spin" />
            ) : (
                Icon && <Icon size={iconSizeMap[size]} />
            )}
        </button>
    );
};

export default IconButton;