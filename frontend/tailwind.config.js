/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,jsx}'],
    theme: {
        extend: {
            fontFamily: {
                display: ['"DM Serif Display"', 'Georgia', 'serif'],
                body: ['"DM Sans"', 'system-ui', 'sans-serif'],
                mono: ['"JetBrains Mono"', 'monospace']
            },
            colors: {
                ink: {
                    50: '#f7f6f3',
                    100: '#eceae4',
                    200: '#d8d4c9',
                    300: '#bfb9aa',
                    400: '#a09787',
                    500: '#877d6d',
                    600: '#6e6457',
                    700: '#574f44',
                    800: '#3d3830',
                    900: '#27231e',
                    950: '#161310'
                },
                amber: {
                    50: '#fffbeb',
                    400: '#fbbf24',
                    500: '#f59e0b',
                    600: '#d97706'
                },
                teal: {
                    400: '#2dd4bf',
                    500: '#14b8a6',
                    600: '#0d9488'
                }
            }
        }
    },
    plugins: []
}