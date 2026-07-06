module.exports = {
  __esModule: true,
  formatWeight: jest.fn((kg) => `${kg} kg`),
  kgToDisplayUnit: jest.fn((kg) => kg),
  displayUnitToKg: jest.fn((v) => v),
  convertLoadString: jest.fn((s) => s),
  daysSince: jest.fn(() => 0),
};
