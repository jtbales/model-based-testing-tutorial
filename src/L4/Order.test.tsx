import { createModel } from "@xstate/test";
import { Machine, assign } from "xstate";
import Order from "./Order";
import { render, RenderResult, fireEvent, wait } from "@testing-library/react";
import React from "react";

////////////////////////////////////////////////////////////////////////////////
// Testing Asynchronous Services
////////////////////////////////////////////////////////////////////////////////

// 1. Copy in machine updates
//    Service is not needed in test machine, just src
// But we do need to mock the UI service's Promise resolve and reject
// Oh no! If the event for done/error happens after we already clicked "Place Order"
//    how do we mock?!
// No worries, we can pass the promise through the Test Cycle and resolve/reject later
// 2. Wrap render in an object so we can manage a context for the Test Cycle (TestCycleContext)
// 3. Pass in all the needed properties
// 4. Update exec functions to deconstruct from TestCycleContext
// 5. Mock in PLACE_ORDER event before clicking,
//    setSubmitOrderCallbacks to the callbacks of the promised that is passed into mockReturnValueOnce
// 6. Add Event for done.invoke.submitOrder to resolve
// 7. Add Event for error.platform.submitOrder to reject
// 8. Add Assertions for placingOrder state
// 9. Add Assertions for orderFailed state
// 10. Add context to ensure the order fails then succeeds in a path
// 11. Add filter to avoid infinite loops

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
      },
      states: {
        shopping: { on: { ADD_TO_CART: "cart" } },
        cart: {
          on: {
            PLACE_ORDER: "ordered",
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
      },
    }
  );

const getEventConfigs = () => {
  const eventConfigs = {
    ADD_TO_CART: {
      exec: async ({ getByText }: RenderResult) => {
        fireEvent.click(getByText("Add to cart"));
      },
    },
    PLACE_ORDER: {
      exec: async ({ getByText }: RenderResult) => {
        fireEvent.click(getByText("Place Order"));
      },
    },
    CONTINUE_SHOPPING: {
      exec: async ({ getByText }: RenderResult) => {
        fireEvent.click(getByText("Continue Shopping"));
      },
    },
    CANCEL: {
      exec: async ({ getByText }: RenderResult) => {
        fireEvent.click(getByText("Cancel"));
      },
    },
  };

  return eventConfigs;
};

const shoppingTest = {
  test: async ({ getByText }: RenderResult) => {
    await wait(() => expect(() => getByText("shopping")).not.toThrowError());
  },
};
const cartTest = {
  test: async ({ getByText }: RenderResult) => {
    await wait(() => expect(() => getByText("cart")).not.toThrowError());
  },
};
const orderedTest = {
  test: async ({ getByText }: RenderResult) => {
    await wait(() => expect(() => getByText("ordered")).not.toThrowError());
  },
};

describe("Order", () => {
  describe("matches all paths", () => {
    const testMachine = getTestMachine();

    (testMachine.states.shopping as any).meta = shoppingTest;
    (testMachine.states.cart as any).meta = cartTest;
    (testMachine.states.ordered as any).meta = orderedTest;

    const testModel = createModel(testMachine).withEvents(
      getEventConfigs() as any
    );

    const testPlans = testModel
      .getShortestPathPlans({
        filter: (state) =>
          state.context.ordersCompleted <= 1 &&
          state.context.cartsCanceled <= 1,
      })
      // Added post-generation filter to reduce combinatorial explosion
      // 10 tests instead of 35 tests
      .filter(
        (plan) =>
          plan.state.context.ordersCompleted === 1 &&
          plan.state.context.cartsCanceled === 1
      );

    testPlans.forEach((plan) => {
      describe(plan.description, () => {
        plan.paths.forEach((path) => {
          it(path.description, async () => {
            // You'll need these for the TestCycleContext
            const submitOrderMock = jest.fn();

            const shared: Shared = {};

            const setSubmitOrderCallbacks = (
              submitOrderCallbacks: PromiseCallbacks
            ) => {
              shared.submitOrderCallbacks = submitOrderCallbacks;
            };

            await path.test(render(<Order />));
          });
        });
      });
    });

    it("should have full coverage", () => {
      return testModel.testCoverage();
    });
  });
});
