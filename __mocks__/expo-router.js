const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

const router = {
  push: mockPush,
  replace: mockReplace,
  back: mockBack,
};

module.exports = {
  router,
  useRouter: () => router,
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
  __mockPush: mockPush,
  __mockReplace: mockReplace,
  __mockBack: mockBack,
};
