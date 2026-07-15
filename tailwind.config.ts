import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "#fcc419",
          foreground: "#0a0a0f",
        },
        secondary: {
          DEFAULT: "#2A2C34",
          foreground: "#FFFFFF",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        celo: {
          green: "#35d46a",
          dark: "#0a0a0f",
        },
        duel: {
          gold: "#fcc419",
          bg: "#0a0a0f",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        "slide-up": {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-5px)" },
          "75%": { transform: "translateX(5px)" },
        },
        float: {
          "0%": { transform: "translateY(0px)", opacity: "1" },
          "100%": { transform: "translateY(-40px)", opacity: "0" },
        },
        "trophy-slam": {
          "0%": { transform: "scale(0) rotate(-20deg)", opacity: "0" },
          "70%": { transform: "scale(1.15) rotate(5deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
        starburst: {
          "0%": { transform: "translate(-50%, -50%) scale(0)", opacity: "0" },
          "50%": { transform: "translate(-50%, -50%) scale(1.2)", opacity: "0.25" },
          "100%": { transform: "translate(-50%, -50%) scale(1)", opacity: "0.1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        "screen-flash": {
          "0%": { opacity: "0" },
          "20%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "letter-reveal": {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "deal-in": {
          "0%": { transform: "translateY(60px) rotate(6deg) scale(0.7)", opacity: "0" },
          "60%": { transform: "translateY(-6px) rotate(-2deg) scale(1.04)", opacity: "1" },
          "100%": { transform: "translateY(0) rotate(0deg) scale(1)", opacity: "1" },
        },
        "flip-reveal": {
          "0%": { transform: "rotateY(90deg) scale(0.9)", opacity: "0" },
          "55%": { transform: "rotateY(-12deg) scale(1.06)", opacity: "1" },
          "100%": { transform: "rotateY(0deg) scale(1)", opacity: "1" },
        },
        "clash-lunge": {
          "0%": { transform: "translateX(0) scale(1)" },
          "35%": { transform: "translateX(-8px) scale(1.05)" },
          "60%": { transform: "translateX(14px) scale(1.08)" },
          "100%": { transform: "translateX(0) scale(1)" },
        },
        "clash-lunge-mirror": {
          "0%": { transform: "translateX(0) scale(1)" },
          "35%": { transform: "translateX(8px) scale(1.05)" },
          "60%": { transform: "translateX(-14px) scale(1.08)" },
          "100%": { transform: "translateX(0) scale(1)" },
        },
        "arena-shake": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "15%": { transform: "translate(-6px, 2px)" },
          "30%": { transform: "translate(5px, -3px)" },
          "45%": { transform: "translate(-4px, -2px)" },
          "60%": { transform: "translate(3px, 2px)" },
          "75%": { transform: "translate(-2px, 1px)" },
          "90%": { transform: "translate(1px, -1px)" },
        },
        "float-up": {
          "0%": { transform: "translateY(0) scale(0.8)", opacity: "0" },
          "15%": { transform: "translateY(-2px) scale(1.15)", opacity: "1" },
          "80%": { transform: "translateY(-22px) scale(1)", opacity: "0.9" },
          "100%": { transform: "translateY(-32px) scale(0.95)", opacity: "0" },
        },
        "rise-in": {
          "0%": { transform: "translateY(24px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "hero-drop": {
          "0%": { transform: "translateY(-30px) scale(0.85)", opacity: "0" },
          "60%": { transform: "translateY(4px) scale(1.03)", opacity: "1" },
          "100%": { transform: "translateY(0) scale(1)", opacity: "1" },
        },
        "count-pop": {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "70%": { transform: "scale(1.15)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        pulse: "pulse 1s ease-in-out infinite",
        "slide-up": "slide-up 0.4s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        shake: "shake 0.2s ease-in-out",
        float: "float 1s ease-out forwards",
        "trophy-slam": "trophy-slam 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        starburst: "starburst 0.7s ease-out forwards",
        shimmer: "shimmer 3s linear infinite",
        "screen-flash": "screen-flash 0.5s ease-out forwards",
        "deal-in": "deal-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "flip-reveal": "flip-reveal 0.55s cubic-bezier(0.34, 1.4, 0.64, 1) both",
        "clash-lunge": "clash-lunge 0.45s cubic-bezier(0.36, 0, 0.66, 1) both",
        "clash-lunge-mirror": "clash-lunge-mirror 0.45s cubic-bezier(0.36, 0, 0.66, 1) both",
        "arena-shake": "arena-shake 0.45s linear both",
        "float-up": "float-up 1.1s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "rise-in": "rise-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        "hero-drop": "hero-drop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "count-pop": "count-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both",
      },
    },

  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
