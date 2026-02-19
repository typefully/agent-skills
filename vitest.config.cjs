/** @type {import('vitest/config').UserConfig} */
module.exports = {
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
    globals: true,
  },
};
