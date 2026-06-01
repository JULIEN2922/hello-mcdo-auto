import postcssNesting from 'postcss-nesting';

export default {
  plugins: {
    'tailwindcss/nesting': postcssNesting,
    tailwindcss: {},
    autoprefixer: {},
  },
}
