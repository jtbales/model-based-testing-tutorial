import { createModel } from "@xstate/test";
import { Machine, assign, StateMachine, State } from "xstate";
import createOrderMachine from "./OrderMachine";

////////////////////////////////////////////////////////////////////////////////
// Model Based Testing the State Machine - FINAL
////////////////////////////////////////////////////////////////////////////////

const executeActions = (state: State<any>) => {
  const { actions, context, _event } = state;

  actions.forEach((action) => {
    // eslint-disable-next-line no-unused-expressions
    action.exec && action.exec(context, _event.data, undefined as any);
  });
};

type PromiseCallbacks = {
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
};

type Shared = {
  currentState: State<any>;
  submitOrderCallbacks?: PromiseCallbacks;
};

type TestCycleContext = {
  stateMachine: StateMachine<any, any, any>;
  shared: Shared;
  setCurrentStateWithActions: (state: State<any>) => void;
  setSubmitOrderCallbacks: (submitOrderCallbacks: PromiseCallbacks) => void;
  submitOrderMock: jest.Mock<any, any>;
};

const getTestMachine = () =>
  Machine(
    {
      id: "order",
      initial: "shopping",
      context: {
        cartsCanceled: 0,
        ordersCompleted: 0,
        ordersFailed: 0,
      },
      states: {
        shopping: { on: { ADD_TO_CART: "cart" } },
        cart: {
          on: {
            PLACE_ORDER: "placingOrder",
            CANCEL: { actions: ["cartCanceled"], target: "shopping" },
          },
        },
        placingOrder: {
          invoke: {
            src: "submitOrder",
            onDone: "ordered",
            onError: { actions: ["orderFailed"], target: "orderFailed" },
          },
        },
        orderFailed: {
          on: {
            PLACE_ORDER: "placingOrder",
            CANCEL: { actions: ["cartCanceled"], target: "shopping" },
          },
        },
        ordered: {
          on: {
            CONTINUE_SHOPPING: {
              actions: ["orderCompleted"],
              target: "shopping",
            },
          },
        },
      },
    },
    {
      actions: {
        cartCanceled: assign((context) => ({
          cartsCanceled: context.cartsCanceled + 1,
        })),
        orderCompleted: assign((context) => ({
          ordersCompleted: context.ordersCompleted + 1,
        })),
        orderFailed: assign((context) => ({
          ordersFailed: context.ordersFailed + 1,
        })),
      },
    }
  );

const getEventConfigs = () => {
  const eventConfigs = {
    ADD_TO_CART: {
      exec: async ({
        stateMachine,
        shared: { currentState },
        setCurrentStateWithActions,
      }: TestCycleContext) => {
        setCurrentStateWithActions(
          stateMachine.transition(currentState, {
            type: "ADD_TO_CART",
          })
        );
      },
    },
    PLACE_ORDER: {
      exec: async ({
        stateMachine,
        shared: { currentState },
        submitOrderMock,
        setSubmitOrderCallbacks,
        setCurrentStateWithActions,
      }: TestCycleContext) => {
        const submitOrderPromise = new Promise((resolve, reject) => {
          setSubmitOrderCallbacks({ resolve, reject });
        }).catch(() => {}); // Use catch to satisfy UnhandledPromiseRejectionWarning

        submitOrderMock.mockReturnValueOnce(submitOrderPromise);

        setCurrentStateWithActions(
          stateMachine.transition(currentState, {
            type: "PLACE_ORDER",
          })
        );
      },
    },
    "done.invoke.submitOrder": {
      exec: async ({
        stateMachine,
        shared: { currentState, submitOrderCallbacks },
        setCurrentStateWithActions,
      }: TestCycleContext) => {
        if (submitOrderCallbacks) {
          submitOrderCallbacks.resolve();

          setCurrentStateWithActions(
            stateMachine.transition(currentState, {
              type: "done.invoke.submitOrder",
            })
          );
        }
      },
    },
    "error.platform.submitOrder": {
      exec: async ({
        stateMachine,
        shared: { currentState, submitOrderCallbacks },
        setCurrentStateWithActions,
      }: TestCycleContext) => {
        if (submitOrderCallbacks) {
          submitOrderCallbacks.reject(new Error());

          setCurrentStateWithActions(
            stateMachine.transition(currentState, {
              type: "error.platform.submitOrder",
            })
          );
        }
      },
    },
    CONTINUE_SHOPPING: {
      exec: async ({
        stateMachine,
        shared: { currentState },
        setCurrentStateWithActions,
      }: TestCycleContext) => {
        setCurrentStateWithActions(
          stateMachine.transition(currentState, {
            type: "CONTINUE_SHOPPING",
          })
        );
      },
    },
    CANCEL: {
      exec: async ({
        stateMachine,
        shared: { currentState },
        setCurrentStateWithActions,
      }: TestCycleContext) => {
        setCurrentStateWithActions(
          stateMachine.transition(currentState, {
            type: "CANCEL",
          })
        );
      },
    },
  };

  return eventConfigs;
};

const shoppingTest = {
  test: ({ shared: { currentState } }: TestCycleContext) => {
    expect(currentState.value).toBe("shopping");
  },
};
const cartTest = {
  test: ({ shared: { currentState } }: TestCycleContext) => {
    expect(currentState.value).toBe("cart");
  },
};
const orderFailedTest = {
  test: ({ shared: { currentState } }: TestCycleContext) => {
    expect(currentState.value).toBe("orderFailed");
  },
};
const placingOrderTest = {
  test: ({ shared: { currentState } }: TestCycleContext) => {
    expect(currentState.value).toBe("placingOrder");
  },
};
const orderedTest = {
  test: ({ shared: { currentState } }: TestCycleContext) => {
    expect(currentState.value).toBe("ordered");
  },
};

describe("Order", () => {
  describe("matches all paths", () => {
    const testMachine = getTestMachine();

    (testMachine.states.shopping as any).meta = shoppingTest;
    (testMachine.states.cart as any).meta = cartTest;
    (testMachine.states.orderFailed as any).meta = orderFailedTest;
    (testMachine.states.placingOrder as any).meta = placingOrderTest;
    (testMachine.states.ordered as any).meta = orderedTest;

    const testModel = createModel(testMachine).withEvents(
      getEventConfigs() as any
    );

    const testPlans = testModel.getShortestPathPlans({
      filter: (state) =>
        state.context.ordersCompleted <= 1 &&
        state.context.cartsCanceled <= 1 &&
        state.context.ordersFailed <= 1,
    });

    testPlans.forEach((plan) => {
      describe(plan.description, () => {
        plan.paths.forEach((path) => {
          it(path.description, async () => {
            const submitOrderMock = jest.fn();

            const stateMachine = createOrderMachine({
              submitOrder: submitOrderMock,
            });

            const shared: Shared = { currentState: stateMachine.initialState };

            const setSubmitOrderCallbacks = (
              submitOrderCallbacks: PromiseCallbacks
            ) => {
              shared.submitOrderCallbacks = submitOrderCallbacks;
            };

            const setCurrentStateWithActions = (state: State<any>) => {
              // Executing the actions is unnecessary in this case since this state machine has no actions.
              // But here it is anyways since it is such a common use case.
              executeActions(state);
              shared.currentState = state;
            };

            await path.test({
              stateMachine,
              shared,
              setSubmitOrderCallbacks,
              setCurrentStateWithActions,
              submitOrderMock,
            } as TestCycleContext);
          });
        });
      });
    });

    it("should have full coverage", () => {
      return testModel.testCoverage();
    });
  });
});
