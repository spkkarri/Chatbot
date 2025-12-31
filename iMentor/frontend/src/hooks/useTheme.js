// import { useContext } from 'react';
// import { AppStateContext } from '../contexts/AppStateContext'; // Assuming theme is in AppStateContext

// export const useTheme = () => {
//     const context = useContext(AppStateContext);
//     if (!context) {
//         throw new Error('useTheme must be used within an AppStateProvider');
//     }
//     return { theme: context.theme, toggleTheme: context.toggleTheme };
// };


import { useContext } from 'react';
import { AppStateContext } from '../contexts/AppStateContext.jsx'; // Correct named import for the context object

export const useTheme = () => {
    const context = useContext(AppStateContext); // Use the imported context object
    if (!context) {
        throw new Error('useTheme must be used within an AppStateProvider');
    }
    return { theme: context.theme, toggleTheme: context.toggleTheme };
};