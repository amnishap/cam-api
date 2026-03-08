module.exports = {
  default: {
    requireModule: ['ts-node/register'],
    require: ['features/step-definitions/**/*.ts'],
    format: ['progress-bar'],
    parallel: 1,
  },
};
