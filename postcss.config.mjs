const config = {
  plugins: [
    // Resolve and inline @import rules before other transformations
    "postcss-import",
  // Support SCSS-like nesting syntax (.child) in our CSS files
  "postcss-nested",
    "@tailwindcss/postcss",
  ],
};

export default config;
