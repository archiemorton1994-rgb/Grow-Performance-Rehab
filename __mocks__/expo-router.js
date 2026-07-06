const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockDismissAll = jest.fn();

const router = {
  push: mockPush,
  replace: mockReplace,
  back: mockBack,
  dismissAll: mockDismissAll,
};

let _params = {};

/** Set params returned by useLocalSearchParams for a single test. */
const __setParams = (p) => { _params = p; };
/** Restore empty params after a test that called __setParams. */
const __clearParams = () => { _params = {}; };

module.exports = {
  router,
  useRouter: () => router,
  useLocalSearchParams: () => _params,
  useSegments: () => [],
  __mockPush: mockPush,
  __mockReplace: mockReplace,
  __mockBack: mockBack,
  __setParams,
  __clearParams,
};
