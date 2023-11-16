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
        sans: ["Peepo"],
      },
      colors: {
        blue_01: "#0A3465",
        brown_01: "#843706",
        brown_02: "#FBC070",
        brown_03: "#5E140A",
      },
      keyframes: {
        fadeInOut: {
          "0%, 100%": { opacity: "0" },
          "30%, 70%": { opacity: "1" },
        },
      },
      animation: {
        fade: "fadeInOut 3s linear",
      },
    },
  },
  plugins: [],
};
export default config;
