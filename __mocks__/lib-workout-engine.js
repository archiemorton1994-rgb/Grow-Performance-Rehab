const TIER_ORDER = ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'barbell', 'fullgym'];

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
      bicep: 'Bicep / Front Arm',
      tricep: 'Tricep / Back Arm',
    };
    return labels[region] ?? region;
  }),
  getRestPeriod: jest.fn(() => 'Rest 90 sec between sets'),
  getWeightGuide: jest.fn(() => []),
  getEquipmentLabel: jest.fn((tier) => {
    const labels = {
      bodyweight: 'Bodyweight',
      bands: 'Resistance Bands',
      dumbbells: 'Dumbbells',
      kettlebells: 'Kettlebells',
      barbell: 'Barbell',
      fullgym: 'Full Gym',
    };
    return labels[tier] ?? tier;
  }),
  getEquipmentIcon: jest.fn(() => 'barbell-outline'),
  getEffectiveTier: jest.fn((tiers) => {
    if (!tiers || !tiers.length) return 'bodyweight';
    let best = 'bodyweight';
    for (const t of tiers) {
      if (TIER_ORDER.indexOf(t) > TIER_ORDER.indexOf(best)) best = t;
    }
    return best;
  }),
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
