declare module 'react-test-renderer' {
  namespace TestRenderer {
    interface ReactTestInstance {
      props: Record<string, unknown>;
      findAllByProps(props: Record<string, unknown>): ReactTestInstance[];
    }

    interface ReactTestRenderer {
      toJSON(): object | null;
      root: ReactTestInstance;
      unmount(): void;
    }

    function create(element: {}): ReactTestRenderer;
  }

  export = TestRenderer;
}
