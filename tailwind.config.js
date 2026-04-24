/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		fontFamily: {
  			inter: ['var(--font-inter)']
  		},
  		fontSize: {
  			'micro': ['0.6875rem', { lineHeight: '0.875rem', fontWeight: '600', letterSpacing: '0.05em' }],
  			'caption': ['0.8125rem', { lineHeight: '1.125rem', fontWeight: '500' }],
  			'body': ['0.9375rem', { lineHeight: '1.375rem', fontWeight: '400' }],
  			'title': ['1.375rem', { lineHeight: '1.75rem', fontWeight: '600' }],
  			'display': ['2.5rem', { lineHeight: '2.75rem', fontWeight: '700' }],
  			'display-xl': ['3.5rem', { lineHeight: '3.75rem', fontWeight: '700' }],
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			},
  			'cat-futbol': '#2E8B57',
  			'cat-f1': '#E2342A',
  			'cat-motogp': '#F37021',
  			'cat-nba': '#C7611F',
  			'cat-tenis': '#DCCC28',
  			'cat-voleybol': '#2859C7',
  			'cat-tv': '#C42A7A',
  			'cat-turnuva': '#C89B2A',
  		},
  		keyframes: {
  			'accordion-down': {
  				from: { height: '0' },
  				to: { height: 'var(--radix-accordion-content-height)' }
  			},
  			'accordion-up': {
  				from: { height: 'var(--radix-accordion-content-height)' },
  				to: { height: '0' }
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  safelist: [
    'bg-cat-futbol', 'bg-cat-f1', 'bg-cat-motogp', 'bg-cat-nba',
    'bg-cat-tenis', 'bg-cat-voleybol', 'bg-cat-tv', 'bg-cat-turnuva',
    'text-cat-futbol', 'text-cat-f1', 'text-cat-motogp', 'text-cat-nba',
    'text-cat-tenis', 'text-cat-voleybol', 'text-cat-tv', 'text-cat-turnuva',
    'border-cat-futbol', 'border-cat-f1', 'border-cat-motogp', 'border-cat-nba',
    'border-cat-tenis', 'border-cat-voleybol', 'border-cat-tv', 'border-cat-turnuva',
  ],
  plugins: [require("tailwindcss-animate")],
}