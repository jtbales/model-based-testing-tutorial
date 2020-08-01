import { createModel } from "@xstate/test";
import { Machine, assign, StateMachine, State } from "xstate";
import createOrderMachine from "./OrderMachine";

////////////////////////////////////////////////////////////////////////////////
// Model Based Testing the State Machine
////////////////////////////////////////////////////////////////////////////////

// The best way to test State Machines is to utilize the pure function calls https://xstate.js.org/docs/guides/transitions.html#machine-transition-method
// Here's what's changed in the setup
// * The render() target was replaced with the pure StateMachine
// * currentState was added to TestCycleContext.shared
// * setCurrentStateWithActions was added to update currentState and execute action side effects, if any
// * References to the UI were removed
//
// 1. Update Event Configs to transition from the current state using the StateMachine,
//    save the new state and execute side effects with setCurrentStateWithActions
// 2. Update the Assertions to validate the currentState.
//    Here you would also validate the context, but in this case there is none.

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
      }: TestCycleContext) => {},
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
        }
      },
    },
    CONTINUE_SHOPPING: {
      exec: async ({
        stateMachine,
        shared: { currentState },
        setCurrentStateWithActions,
      }: TestCycleContext) => {},
    },
    CANCEL: {
      exec: async ({
        stateMachine,
        shared: { currentState },
        setCurrentStateWithActions,
      }: TestCycleContext) => {},
    },
  };

  return eventConfigs;
};

const shoppingTest = {
  test: ({ shared: { currentState } }: TestCycleContext) => {},
};
const cartTest = {
  test: ({ shared: { currentState } }: TestCycleContext) => {},
};
const orderFailedTest = {
  test: ({ shared: { currentState } }: TestCycleContext) => {},
};
const placingOrderTest = {
  test: ({ shared: { currentState } }: TestCycleContext) => {},
};
const orderedTest = {
  test: ({ shared: { currentState } }: TestCycleContext) => {},
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
