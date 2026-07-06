module.exports = {
  __esModule: true,
  generateWorkout: jest.fn(() => []),
  generate1RMWorkout: jest.fn(() => []),
  getSessionLabel: jest.fn((type) => type),
  getSessionSubtitle: jest.fn(() => ''),
  getPainRegionLabel: jest.fn((region) => {
    const labels = {
      knee: 'Knee',
      lower_back: 'Lower Back',
      front_shoulder: 'Front Shoulder',
      rear_shoulder: 'Rear Shoulder',
      elbow_wrist: 'Elbow / Wrist',
      neck: 'Neck',
      upper_back: 'Upper Back',
      core_ribs: 'Core / Ribs',
      hip_groin: 'Hip / Groin',
      ankle_achilles: 'Ankle / Achilles',
      calf_shin: 'Calf / Shin',
    };
    return labels[region] ?? region;
  }),
  getRestPeriod: jest.fn(() => 'Rest 90 sec between sets'),
  getWeightGuide: jest.fn(() => []),
  REST_PERIOD_SECONDS: {
    main: 120,
    accessory: 90,
    mechanical: 60,
    neuro: 90,
    prehab: 60,
    finisher: 30,
    prep: 30,
  },
};
