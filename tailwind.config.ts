import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      fontFamily: {
        serif: ["PixelCowboy"],
        sans: ["Pixelify Sans"],
      },
      colors: {
        black_01: "#0B0012",
        blue_01: "#0A3465",
        brown_01: "#843706",
        brown_02: "#FBC070",
        brown_03: "#5E140A",
      },
      keyframes: {
        fadeInOut: {
          "100%": { opacity: "0" },
          "0%": { opacity: "1" },
        },
        typing: {
          "0%": { width: "0%" },
          "100%": { width: "100%" },
        },
      },
      animation: {
        fade: "fadeInOut 3s linear",
        type: "typing 3.5s steps(40, end)",
      },
    },
  },
  plugins: [],
};
export default config;
