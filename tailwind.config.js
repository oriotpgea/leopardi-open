/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.js'],
    theme: {
        extend: {
            colors: { bp: '#ff6b00', dark: '#0f172a', darksec: '#1e293b' },
            fontFamily: { sans: ['Inter', 'sans-serif'] },
        },
    },
    plugins: [],
};
