const path = require('path');

module.exports = {
  entry: './turnkey-entry.js',
  output: {
    filename: 'turnkey.min.js',
    path: path.resolve(__dirname, 'public'),
  },
  mode: 'production',
  target: 'web',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  resolve: {
    extensions: ['.js'],
    fallback: {
      crypto: require.resolve('crypto-browserify'),
      vm: require.resolve('vm-browserify'),
      stream: require.resolve('stream-browserify')
    }
  }
};
