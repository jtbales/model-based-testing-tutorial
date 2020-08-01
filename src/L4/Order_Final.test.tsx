import { createModel } from "@xstate/test";
import { Machine, assign } from "xstate";
import Order from "./Order";
import { render, RenderResult, fireEvent, wait } from "@testing-library/react";
import React from "react";

type PromiseCallbacks = {
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
};

type Shared = {
  submitOrderCallbacks?: PromiseCallbacks;
};

type TestCycleContext = {
  target: RenderResult;
  shared: Shared;
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
      exec: async ({ target: { getByText } }: TestCycleContext) => {
        fireEvent.click(getByText("Add to cart"));
      },
    },
    PLACE_ORDER: {
      exec: async ({
        target: { getByText },
        submitOrderMock,
        setSubmitOrderCallbacks,
      }: TestCycleContext) => {
        const submitOrderPromise = new Promise((resolve, reject) => {
          setSubmitOrderCallbacks({ resolve, reject });
        });

        submitOrderMock.mockReturnValueOnce(submitOrderPromise);

        fireEvent.click(getByText("Place Order"));
      },
    },
    "done.invoke.submitOrder": {
      exec: async ({ shared }: TestCycleContext) => {
        if (shared.submitOrderCallbacks) {
          shared.submitOrderCallbacks.resolve();
        }
      },
    },
    "error.platform.submitOrder": {
      exec: async ({ shared }: TestCycleContext) => {
        if (shared.submitOrderCallbacks) {
          shared.submitOrderCallbacks.reject(new Error());
        }
      },
    },
    CONTINUE_SHOPPING: {
      exec: async ({ target: { getByText } }: TestCycleContext) => {
        fireEvent.click(getByText("Continue Shopping"));
      },
    },
    CANCEL: {
      exec: async ({ target: { getByText } }: TestCycleContext) => {
        fireEvent.click(getByText("Cancel"));
      },
    },
  };

  return eventConfigs;
};

const shoppingTest = {
  test: async ({ target: { getByText } }: TestCycleContext) => {
    await wait(() => expect(() => getByText("shopping")).not.toThrowError());
  },
};
const cartTest = {
  test: async ({ target: { getByText } }: TestCycleContext) => {
    await wait(() => expect(() => getByText("cart")).not.toThrowError());
  },
};
const orderFailedTest = {
  test: async ({ target: { getByText } }: TestCycleContext) => {
    await wait(() => expect(() => getByText("orderFailed")).not.toThrowError());
  },
};
const placingOrderTest = {
  test: async ({ target: { getByText } }: TestCycleContext) => {
    await wait(() =>
      expect(() => getByText("placingOrder")).not.toThrowError()
    );
  },
};
const orderedTest = {
  test: async ({ target: { getByText } }: TestCycleContext) => {
    await wait(() => expect(() => getByText("ordered")).not.toThrowError());
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

            const shared: Shared = {};

            const setSubmitOrderCallbacks = (
              submitOrderCallbacks: PromiseCallbacks
            ) => {
              shared.submitOrderCallbacks = submitOrderCallbacks;
            };

            await path.test({
              target: render(
                <Order services={{ submitOrder: submitOrderMock as any }} />
              ),
              shared,
              setSubmitOrderCallbacks,
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
