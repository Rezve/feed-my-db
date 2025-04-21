const path = require('path');
const rules = require('./webpack.rules');
const plugins = require('./webpack.plugins');

module.exports = {
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        use: 'ts-loader',
      },
      {
        test: /\.css$/,
        exclude: /node_modules/,
        use: [
          'style-loader', // Injects CSS into the DOM
          'css-loader', // Resolves CSS imports
          'postcss-loader', // Processes CSS with PostCSS (Tailwind)
        ],
      },
    ],
  },
  plugins: [],
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
    alias: {
      // Add any aliases you might need
    },
  },
};
